<script lang="ts">
    import { browser } from "$app/environment";
    import { enhance } from "$app/forms";
    import type { PageData, ActionData } from "./$types";
    import LocationPicker from "$lib/components/LocationPicker.svelte";
    import { goto } from "$app/navigation";
    import { onDestroy } from "svelte";
    import { Upload } from "tus-js-client";
    import BreadcrumbBar from "$lib/components/BreadcrumbBar.svelte";

    interface Props {
        data: PageData;
        form: ActionData;
    }

    const { data, form }: Props = $props();

    // Form state
    let videoFile = $state<File | null>(null);
    let title = $state("");
    let description = $state("");
    let uploadDate = $state("");
    let latitude = $state<number | undefined>(undefined);
    let longitude = $state<number | undefined>(undefined);
    let selectedThumbnail = $state<string>("");
    let videoUrl = $state(""); // This would be set after uploading to storage
    let duration = $state(0);

    // UI state
    let isProcessing = $state(false);
    let processingStatus = $state("");
    let thumbnails = $state<string[]>([]);
    let videoPreviewUrl = $state<string>("");
    let wordCount = $state(0);
    let isSubmitting = $state(false);
    let locationStatus = $state<"detecting" | "found" | "not-found" | null>(
        null,
    );

    // Worker for video processing
    let worker: Worker | null = null;

    // TUS upload state
    type UploadState = "idle" | "creating" | "uploading" | "paused" | "success" | "error";
    let tusUpload: Upload | null = null;
    let uploadStatus = $state<UploadState>("idle");
    let uploadError = $state<string | null>(null);
    let uploadProgress = $state(0);
    let bytesUploaded = $state(0);
    let totalBytes = $state(0);
    let bunnyVideoId = $state("");
    let cdnHostname = $state("");

    const uploaderDisplayName = $derived(
        data.uploader?.name ??
            data.sessionUser?.user_metadata?.name ??
            data.sessionUser?.email ??
            "Your account",
    );

    function buildStreamUrl(host: string, videoId: string) {
        const trimmedHost = host?.replace(/^https?:\/\//, "").replace(/\/+$/, "");
        if (!trimmedHost || !videoId) return "";
        return `https://${trimmedHost}/${videoId}/playlist.m3u8`;
    }

    async function resetTusUpload(options: { terminate?: boolean; clearVideoUrl?: boolean } = {}) {
        const { terminate = false, clearVideoUrl = true } = options;
        if (tusUpload) {
            try {
                await tusUpload.abort(terminate);
            } catch (error) {
                console.warn("Failed to abort resumable upload", error);
            }
            tusUpload = null;
        }

        uploadStatus = "idle";
        uploadError = null;
        uploadProgress = 0;
        bytesUploaded = 0;
        totalBytes = 0;
        bunnyVideoId = "";
        cdnHostname = "";

        if (clearVideoUrl) {
            videoUrl = "";
        }
    }

    function formatBytes(bytes: number) {
        if (!Number.isFinite(bytes) || bytes <= 0) return "0 MB";
        return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
    }

    async function startTusUpload() {
        if (!browser || !videoFile) return;
        if (!data.uploader) {
            uploadError = "Your account isn't linked to a creator profile yet.";
            return;
        }
        if (uploadStatus === "uploading" || uploadStatus === "creating") return;
        if (uploadStatus === "paused" && tusUpload) {
            resumeTusUpload();
            return;
        }

        await resetTusUpload({ terminate: false, clearVideoUrl: true });
        uploadStatus = "creating";
        uploadError = null;
        totalBytes = videoFile.size;

        const inferredTitle =
            title?.trim().length && videoFile
                ? title.trim()
                : videoFile.name.replace(/\.[^/.]+$/, "").replace(/[_-]/g, " ");

        try {
            const response = await fetch("/account/new/tus", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    title: inferredTitle,
                    fileType: videoFile.type,
                    thumbnailTime: Math.max(0, Math.round(duration * 1000)),
                }),
            });

            if (!response.ok) {
                const errorPayload = await response.json().catch(() => null);
                throw new Error(
                    errorPayload?.message ?? "Unable to initialise resumable upload.",
                );
            }

            const payload: {
                videoId: string;
                expires: number;
                signature: string;
                libraryId: string | number;
                uploadUrl: string;
                cdnHost?: string | null;
            } = await response.json();

            bunnyVideoId = payload.videoId;
            cdnHostname = payload.cdnHost ?? "";
            totalBytes = videoFile.size;

            tusUpload = new Upload(videoFile, {
                endpoint: payload.uploadUrl,
                retryDelays: [0, 3000, 5000, 10000, 20000, 60000],
                metadata: {
                    filetype: videoFile.type ?? "video/mp4",
                    title: inferredTitle,
                },
                headers: {
                    AuthorizationSignature: payload.signature,
                    AuthorizationExpire: String(payload.expires),
                    LibraryId: String(payload.libraryId),
                    VideoId: payload.videoId,
                },
                onError: (error) => {
                    uploadStatus = "error";
                    uploadError =
                        error?.message ?? "Upload failed. Please try again.";
                },
                onProgress: (uploadedBytes, total) => {
                    bytesUploaded = uploadedBytes;
                    totalBytes = total;
                    if (total > 0) {
                        uploadProgress = Math.max(
                            0,
                            Math.min(100, Math.round((uploadedBytes / total) * 100)),
                        );
                    }
                },
                onSuccess: () => {
                    uploadStatus = "success";
                    uploadError = null;
                    uploadProgress = 100;
                    if (cdnHostname && bunnyVideoId) {
                        videoUrl = buildStreamUrl(cdnHostname, bunnyVideoId);
                    }
                },
            });

            if (!tusUpload) {
                throw new Error("Failed to initialise resumable upload.");
            }

            const previousUploads = await tusUpload
                .findPreviousUploads()
                .catch(() => []);
            if (previousUploads && previousUploads.length > 0) {
                tusUpload.resumeFromPreviousUpload(previousUploads[0]);
            }

            uploadStatus = "uploading";
            tusUpload.start();
        } catch (error) {
            console.error("Failed to start resumable upload:", error);
            await resetTusUpload({ terminate: false, clearVideoUrl: true });
            uploadStatus = "error";
            uploadError =
                error instanceof Error
                    ? error.message
                    : "Failed to start upload. Please try again.";
        }
    }

    async function pauseTusUpload() {
        if (!tusUpload || uploadStatus !== "uploading") return;
        try {
            await tusUpload.abort();
            uploadStatus = "paused";
        } catch (error) {
            console.warn("Failed to pause upload", error);
        }
    }

    function resumeTusUpload() {
        if (!tusUpload || uploadStatus !== "paused") return;
        uploadStatus = "uploading";
        uploadError = null;
        tusUpload.start();
    }

    const uploadCompleted = $derived(
        uploadStatus === "success" && (Boolean(videoUrl) || Boolean(bunnyVideoId)),
    );
    const submitDisabled = $derived(
        isSubmitting || !uploadCompleted || isProcessing || !data.uploader,
    );


    $effect(() => {
        if (browser) {
            worker = new Worker(
                new URL(
                    "$lib/workers/videoMetadata.worker.ts",
                    import.meta.url,
                ),
                { type: "module" },
            );
            worker.onmessage = (e) => {
                const { type, metadata, error } = e.data;
                if (type === "metadata-result") {
                    if (metadata.date) {
                        try {
                            const date = new Date(metadata.date);
                            uploadDate = date.toISOString().split("T")[0];
                        } catch {
                            uploadDate = new Date().toISOString().split("T")[0];
                        }
                    } else {
                        uploadDate = new Date().toISOString().split("T")[0];
                    }
                    if (metadata.latitude && metadata.longitude) {
                        latitude = metadata.latitude;
                        longitude = metadata.longitude;
                        locationStatus = "found";
                    } else {
                        locationStatus = "not-found";
                    }
                } else if (type === "error") {
                    console.error("Worker error:", error);
                    isProcessing = false;
                    processingStatus = "Error processing video";
                    locationStatus = "not-found";
                }
            };
    // When on /account/new, check for a preset file (from drag on /account)
            if ((window as any).__rushesUploadFile) {
                const presetFile = (window as any).__rushesUploadFile as File;
                delete (window as any).__rushesUploadFile;
                // Show preview and analyze file automatically
                (async () => {
                    await resetTusUpload({ terminate: true, clearVideoUrl: true });
                    videoFile = presetFile;
                    if (videoPreviewUrl?.startsWith("blob:")) {
                        URL.revokeObjectURL(videoPreviewUrl);
                    }
                    videoPreviewUrl = URL.createObjectURL(videoFile);
                    isProcessing = true;
                    processingStatus = "Analyzing video...";
                    locationStatus = "detecting";
                    const buffer = await videoFile.arrayBuffer();
                    worker?.postMessage({
                        type: "extract-metadata",
                        buffer,
                        lastModified: videoFile.lastModified,
                    });
                    await extractVideoDurationAndThumbnails(videoFile);
                    if (!title) {
                        title = videoFile.name.replace(/\.[^/.]+$/, "").replace(/[_-]/g, " ");
                    }
                    videoUrl = "";
                })();
            }
            return () => {
                worker?.terminate();
            };
        }
    });

    async function extractVideoDurationAndThumbnails(file: File) {
        try {
            const videoUrl = URL.createObjectURL(file);
            const video = document.createElement("video");
            video.preload = "metadata";
            video.muted = true;
            video.playsInline = true;
            video.src = videoUrl;

            await new Promise<void>((resolve, reject) => {
                video.onloadedmetadata = () => resolve();
                video.onerror = () => reject(new Error("Failed to load video"));
            });

            duration = Math.round(video.duration);

            // Generate thumbnails
            processingStatus = "Generating thumbnails...";
            const videoDuration = video.duration;
            const canvas = document.createElement("canvas");
            const ctx = canvas.getContext("2d");

            if (ctx) {
                const aspectRatio = video.videoHeight / video.videoWidth;
                canvas.width = 320;
                canvas.height = Math.round(320 * aspectRatio);

                const thumbCount = 5;
                const generatedThumbs: string[] = [];

                for (let i = 0; i < thumbCount; i++) {
                    const timestamp =
                        (videoDuration / (thumbCount + 1)) * (i + 1);
                    video.currentTime = timestamp;

                    await new Promise<void>((resolve) => {
                        video.onseeked = () => resolve();
                    });

                    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                    const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
                    generatedThumbs.push(dataUrl);
                }

                thumbnails = generatedThumbs;
                if (thumbnails.length > 0) {
                    selectedThumbnail = thumbnails[0];
                }
            }

            URL.revokeObjectURL(videoUrl);
            isProcessing = false;
            processingStatus = "";
        } catch (error) {
            console.error("Error extracting video data:", error);
            isProcessing = false;
            processingStatus = "Error processing video";
        }
    }

    async function handleFileSelect(event: Event) {
        const input = event.target as HTMLInputElement;
        const file = input.files?.[0];

        if (file) {
            await resetTusUpload({ terminate: true, clearVideoUrl: true });

            if (videoPreviewUrl?.startsWith("blob:")) {
                URL.revokeObjectURL(videoPreviewUrl);
            }

            videoFile = file;
            videoPreviewUrl = URL.createObjectURL(file);

            // Extract metadata from video
            isProcessing = true;
            processingStatus = "Analyzing video...";
            locationStatus = "detecting";

            // Send buffer to worker for location extraction
            const buffer = await file.arrayBuffer();
            worker?.postMessage({
                type: "extract-metadata",
                buffer,
                lastModified: file.lastModified,
            });

            // Extract duration and thumbnails in main thread
            await extractVideoDurationAndThumbnails(file);

            // Set default title from filename
            if (!title) {
                title = file.name
                    .replace(/\.[^/.]+$/, "")
                    .replace(/[_-]/g, " ");
            }

            // Reset stream URL until upload completes
            totalBytes = file.size;
            bytesUploaded = 0;
            videoUrl = "";
            uploadStatus = "idle";
            uploadError = null;
            uploadProgress = 0;
        }
    }

    function handleLocationChange(lat: number, lon: number) {
        latitude = lat;
        longitude = lon;
    }

    function selectThumbnail(thumb: string) {
        selectedThumbnail = thumb;
    }

    function updateWordCount() {
        const words = description.trim().split(/\s+/).filter(Boolean);
        wordCount = words.length;
    }

    $effect(() => {
        updateWordCount();
    });

    function handleSubmit() {
        if (!uploadCompleted) {
            uploadError =
                uploadStatus === "error"
                    ? uploadError
                    : "Please finish uploading the video before saving.";
        }
        if (!data.uploader) {
            uploadError = "Your account isn't linked to a creator profile yet.";
            return async () => {};
        }
        isSubmitting = true;
        return async ({ result, update }: any) => {
            isSubmitting = false;

            if (result.type === "success" && result.data?.success) {
                // Redirect to the video page or library
                goto(`/account?uploaded=${result.data.videoId}`).catch(() => {
                    goto("/account");
                });
            } else {
                await update();
            }
        };
    }

    onDestroy(() => {
        if (browser && videoPreviewUrl?.startsWith("blob:")) {
            URL.revokeObjectURL(videoPreviewUrl);
        }
        resetTusUpload({ terminate: true, clearVideoUrl: false }).catch(() => {});
    });
</script>

<svelte:head>
    <title>Upload Video</title>
</svelte:head>

<div class="page">
    <BreadcrumbBar items={[{
        "label": "My Account",
        "href": "/account"
    }, {
        "label": "New Upload"
    }]} />
    <form
        method="POST"
        action="?/upload"
        class="card"
        use:enhance={handleSubmit}
        enctype="multipart/form-data"
    >
        <header>
            <h1>Upload Video</h1>
            <p>Share your video with the world. Fill in the details below.</p>
        </header>

        {#if form?.error}
            <div class="error-banner">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <path
                        d="M10 18C14.4183 18 18 14.4183 18 10C18 5.58172 14.4183 2 10 2C5.58172 2 2 5.58172 2 10C2 14.4183 5.58172 18 10 18Z"
                        stroke="currentColor"
                        stroke-width="2"
                    />
                    <path
                        d="M10 6V10"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                    />
                    <circle cx="10" cy="13" r="1" fill="currentColor" />
                </svg>
                <span>{form.error}</span>
            </div>
        {/if}

        <!-- Video File Picker -->
        <div class="form-group">
            <label for="video-file" class="label">Video File *</label>
            <div class="file-input-wrapper">
                <label class="file-picker" class:has-file={videoFile}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                        <path
                            d="M21 15V19C21 19.5304 20.7893 20.0391 20.4142 20.4142C20.0391 20.7893 19.5304 21 19 21H5C4.46957 21 3.96086 20.7893 3.58579 20.4142C3.21071 20.0391 3 19.5304 3 19V15"
                            stroke="currentColor"
                            stroke-width="2"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                        />
                        <path
                            d="M17 8L12 3L7 8"
                            stroke="currentColor"
                            stroke-width="2"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                        />
                        <path
                            d="M12 3V15"
                            stroke="currentColor"
                            stroke-width="2"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                        />
                    </svg>
                    <span
                        >{videoFile
                            ? videoFile.name
                            : "Choose a video file"}</span
                    >
                    <input
                        id="video-file"
                        type="file"
                        accept="video/*"
                        onchange={handleFileSelect}
                        name="localVideoFile"
                    />
                </label>
                {#if videoFile}
                    <div class="file-info">
                        <span class="file-size"
                            >{(videoFile.size / 1024 / 1024).toFixed(2)} MB</span
                        >
                        {#if duration > 0}
                            <span class="file-duration"
                                >{Math.floor(duration / 60)}:{(duration % 60)
                                    .toString()
                                    .padStart(2, "0")}</span
                            >
                        {/if}
                    </div>
                    <div class="upload-panel">
                        <div class="upload-actions">
                            {#if uploadStatus === "idle"}
                                <button
                                    type="button"
                                    class="upload-btn"
                                    onclick={startTusUpload}
                                    disabled={!data.uploader}
                                >
                                    Start Upload
                                </button>
                                <span class="upload-hint"
                                    >Uploads are resumable — you can pause and continue later.</span
                                >
                            {:else if uploadStatus === "creating"}
                                <div class="upload-status in-progress">
                                    <div class="spinner-small"></div>
                                    <span>Preparing secure upload...</span>
                                </div>
                            {:else if uploadStatus === "uploading"}
                                <button type="button" class="upload-btn" onclick={pauseTusUpload}>
                                    Pause
                                </button>
                                <span class="upload-hint">Uploading… {uploadProgress}%</span>
                            {:else if uploadStatus === "paused"}
                                <button type="button" class="upload-btn" onclick={resumeTusUpload}>
                                    Resume Upload
                                </button>
                                <span class="upload-hint">Upload paused at {uploadProgress}%.</span>
                            {:else if uploadStatus === "success"}
                                <span class="upload-hint success"
                                    >Upload complete. You can now save this video.</span
                                >
                            {:else if uploadStatus === "error"}
                                <span class="upload-hint error">Upload failed.</span>
                                <button type="button" class="upload-btn" onclick={startTusUpload}>
                                    Retry Upload
                                </button>
                            {/if}
                        </div>
                        {#if uploadStatus !== "idle" || uploadProgress > 0}
                            <div
                                class="upload-progress-bar"
                                role="progressbar"
                                aria-valuemin="0"
                                aria-valuemax="100"
                                aria-valuenow={Math.min(100, uploadProgress)}
                            >
                                <div
                                    class="upload-progress-fill"
                                    style={`width: ${Math.min(100, uploadProgress)}%`}
                                ></div>
                            </div>
                            <div class="upload-progress-meta">
                                <span>{uploadProgress}%</span>
                                <span>{formatBytes(bytesUploaded)} / {formatBytes(totalBytes)}</span>
                            </div>
                        {/if}
                        {#if uploadStatus === "error" && uploadError}
                            <p class="upload-error">{uploadError}</p>
                        {/if}
                    </div>
                {/if}
            </div>
            {#if isProcessing}
                <div class="processing-status">
                    <div class="spinner"></div>
                    <span>{processingStatus}</span>
                </div>
            {/if}
        </div>

        <!-- Video Preview -->
        {#if videoPreviewUrl && !isProcessing}
            <div class="form-group">
                <label class="label" for="video-preview">Preview</label>
                <video id="video-preview" class="video-preview" src={videoPreviewUrl} controls>
                    <track kind="captions" label="No captions" />
                </video>
            </div>
        {/if}

        <!-- Title -->
        <div class="form-group">
            <label for="title" class="label">Title *</label>
            <input
                id="title"
                name="title"
                type="text"
                class="input"
                bind:value={title}
                placeholder="Enter video title"
                required
                maxlength="200"
            />
        </div>

        <!-- Uploader -->
        <div class="form-group">
            <label class="label" for="uploader-pill">Uploading as</label>
            <div id="uploader-pill" class="uploader-pill">
                <span class="uploader-avatar">{uploaderDisplayName.slice(0, 1).toUpperCase()}</span>
                <div class="uploader-details">
                    <span class="uploader-name">{uploaderDisplayName}</span>
                    {#if data.sessionUser?.email}
                        <span class="uploader-email">{data.sessionUser.email}</span>
                    {/if}
                </div>
            </div>
            {#if !data.uploader}
                <p class="warning">
                    We couldn&apos;t link your account to a creator profile. Please contact support before uploading.
                </p>
            {/if}
        </div>

        <!-- Upload Date -->
        <div class="form-group">
            <label for="uploadDate" class="label">Upload Date</label>
            <input
                id="uploadDate"
                name="uploadedAt"
                type="date"
                class="input"
                bind:value={uploadDate}
            />
            <p class="hint">
                Automatically detected from video metadata when available
            </p>
        </div>

        <!-- Location Status -->
        {#if locationStatus}
            <div class="form-group">
                {#if locationStatus === "detecting"}
                    <div class="location-status detecting">
                        <div class="spinner-small"></div>
                        <span>Detecting location from video metadata...</span>
                    </div>
                {:else if locationStatus === "found"}
                    <div class="location-status found">
                        <svg
                            width="20"
                            height="20"
                            viewBox="0 0 20 20"
                            fill="none"
                        >
                            <path
                                d="M10 2C7.24 2 5 4.24 5 7c0 3.75 5 11 5 11s5-7.25 5-11c0-2.76-2.24-5-5-5zm0 7c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z"
                                fill="currentColor"
                            />
                        </svg>
                        <span
                            >Location found: {latitude?.toFixed(6)}, {longitude?.toFixed(
                                6,
                            )}</span
                        >
                    </div>
                {:else if locationStatus === "not-found"}
                    <div class="location-status not-found">
                        <svg
                            width="20"
                            height="20"
                            viewBox="0 0 20 20"
                            fill="none"
                        >
                            <circle
                                cx="10"
                                cy="10"
                                r="8"
                                stroke="currentColor"
                                stroke-width="2"
                            />
                            <path
                                d="M10 6v4M10 14h.01"
                                stroke="currentColor"
                                stroke-width="2"
                                stroke-linecap="round"
                            />
                        </svg>
                        <span
                            >No location found in video metadata. You can set it
                            manually below.</span
                        >
                    </div>
                {/if}
            </div>
        {/if}

        <!-- Description -->
        <div class="form-group">
            <label for="description" class="label">
                Description *
                <span class="word-counter" class:over-limit={wordCount > 300}>
                    {wordCount} / 300 words
                </span>
            </label>
            <textarea
                id="description"
                name="description"
                class="textarea"
                bind:value={description}
                placeholder="Describe your video... (max 300 words)"
                required
                rows="6"
            ></textarea>
        </div>

        <!-- Thumbnail Picker -->
        {#if thumbnails.length > 0}
            <div class="form-group">
                <fieldset>
                    <legend class="label">Select Thumbnail</legend>
                    <div class="thumbnail-grid">
                        {#each thumbnails as thumb, i}
                            <button
                                type="button"
                                class="thumbnail-option"
                                class:selected={selectedThumbnail === thumb}
                                onclick={() => selectThumbnail(thumb)}
                                aria-label={`Select Thumbnail ${i+1}`}
                            >
                                <img src={thumb} alt="Thumbnail {i + 1}" />
                                {#if selectedThumbnail === thumb}
                                    <div class="selected-indicator">
                                        <svg
                                            width="24"
                                            height="24"
                                            viewBox="0 0 24 24"
                                            fill="none"
                                        >
                                            <circle
                                                cx="12"
                                                cy="12"
                                                r="10"
                                                fill="currentColor"
                                            />
                                            <path
                                                d="M8 12L11 15L16 9"
                                                stroke="white"
                                                stroke-width="2"
                                                stroke-linecap="round"
                                                stroke-linejoin="round"
                                            />
                                        </svg>
                                    </div>
                                {/if}
                            </button>
                        {/each}
                    </div>
                </fieldset>
            </div>
        {/if}

        <!-- Location Picker -->
        <div class="form-group">
            <label class="label" for="location-map">
                Location
                {#if latitude && longitude}
                    <span class="location-detected">📍 Location set</span>
                {/if}
            </label>
            <p class="hint">
                Click on the map to set the video location. Use the geolocation
                button to use your current location.
            </p>
            <LocationPicker
                {latitude}
                {longitude}
                onLocationChange={handleLocationChange}
            />
        </div>

        <!-- Hidden fields for submission -->
        <input type="hidden" name="latitude" value={latitude ?? ""} />
        <input type="hidden" name="longitude" value={longitude ?? ""} />
        <input type="hidden" name="videoUrl" value={videoUrl} />
        <input type="hidden" name="thumbnailUrl" value={selectedThumbnail} />
        <input type="hidden" name="duration" value={duration} />
        <input type="hidden" name="bunnyVideoId" value={bunnyVideoId} />

        <!-- Submit Button -->
        <div class="form-actions">
            <button type="submit" class="submit-btn" disabled={submitDisabled}>
                {#if isSubmitting}
                    <div class="spinner"></div>
                    <span>Uploading...</span>
                {:else if isProcessing}
                    <span>Processing video...</span>
                {:else if !uploadCompleted}
                    <span>Finish Video Upload</span>
                {:else}
                    <span>Save Video</span>
                {/if}
            </button>
        </div>
    </form>
</div>

<style>
    .page {
        height: 100vh;
        padding: 1.5rem 5rem;
       
      
    }

    .card {
        width: 100%;
        background: rgba(15, 23, 42, 0.9);
        border: 1px solid rgba(148, 163, 184, 0.2);
        border-radius: 20px;
        padding: 2.5rem;
        box-shadow: 0 40px 120px -60px rgba(15, 118, 226, 0.45);
        display: grid;
        gap: 2rem;
        color: #e2e8f0;
        margin-bottom: 4rem;
    }

    header h1 {
        font-size: 1.8rem;
        margin: 0;
        color: #f8fafc;
    }

    header p {
        margin: 0.6rem 0 0;
        color: rgba(226, 232, 240, 0.8);
        font-size: 0.95rem;
        line-height: 1.4;
    }

    .error-banner {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        padding: 1rem 1.25rem;
        background: rgba(239, 68, 68, 0.1);
        border: 1px solid rgba(239, 68, 68, 0.3);
        border-radius: 12px;
        color: #fca5a5;
        font-size: 0.9rem;
    }

    .error-banner svg {
        flex-shrink: 0;
    }

    .form-group {
        display: grid;
        gap: 0.75rem;
    }

    .label {
        font-size: 0.9rem;
        font-weight: 500;
        color: #f8fafc;
        display: flex;
        justify-content: space-between;
        align-items: center;
    }

    .hint {
        font-size: 0.85rem;
        color: rgba(226, 232, 240, 0.6);
        margin: -0.25rem 0 0;
    }

    .file-input-wrapper {
        display: grid;
        gap: 0.75rem;
    }

    .file-picker {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 0.75rem;
        padding: 1.5rem 1.75rem;
        border-radius: 12px;
        border: 2px dashed rgba(94, 234, 212, 0.3);
        background: rgba(94, 234, 212, 0.05);
        color: #5eead4;
        font-size: 0.95rem;
        font-weight: 500;
        cursor: pointer;
        transition:
            border-color 0.2s ease,
            background 0.2s ease,
            transform 0.2s ease;
        width: 100%;
    }

    .file-picker:hover {
        border-color: rgba(94, 234, 212, 0.5);
        background: rgba(94, 234, 212, 0.1);
        transform: translateY(-1px);
    }

    .file-picker.has-file {
        border-color: rgba(94, 234, 212, 0.5);
        background: rgba(94, 234, 212, 0.12);
    }

    .file-picker input {
        display: none;
    }

    .file-info {
        display: flex;
        gap: 1rem;
        font-size: 0.85rem;
        color: rgba(226, 232, 240, 0.7);
    }

    .file-size,
    .file-duration {
        padding: 0.25rem 0.75rem;
        background: rgba(30, 41, 59, 0.6);
        border-radius: 6px;
        font-variant-numeric: tabular-nums;
    }

    .upload-panel {
        display: grid;
        gap: 0.75rem;
        margin-top: 1rem;
        padding: 1rem 1.25rem;
        border-radius: 12px;
        background: rgba(37, 99, 235, 0.12);
        border: 1px solid rgba(59, 130, 246, 0.2);
    }

    .upload-actions {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 0.75rem;
    }

    .upload-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 0.55rem 1.2rem;
        border-radius: 999px;
        background: rgba(59, 130, 246, 0.25);
        border: 1px solid rgba(59, 130, 246, 0.4);
        color: #bfdbfe;
        font-size: 0.85rem;
        font-weight: 500;
        transition:
            background 0.2s ease,
            border-color 0.2s ease,
            transform 0.2s ease;
        cursor: pointer;
    }

    .upload-btn:hover {
        background: rgba(59, 130, 246, 0.35);
        border-color: rgba(59, 130, 246, 0.55);
        transform: translateY(-1px);
    }

    .upload-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
        transform: none;
    }

    .upload-hint {
        font-size: 0.85rem;
        color: rgba(226, 232, 240, 0.7);
    }

    .upload-hint.success {
        color: #5eead4;
    }

    .upload-hint.error {
        color: #fca5a5;
    }

    .upload-progress-bar {
        position: relative;
        height: 0.5rem;
        border-radius: 999px;
        background: rgba(148, 163, 184, 0.2);
        overflow: hidden;
    }

    .upload-progress-fill {
        position: absolute;
        inset: 0;
        width: 0%;
        background: linear-gradient(90deg, #60a5fa, #38bdf8);
        transition: width 0.2s ease;
    }

    .upload-progress-meta {
        display: flex;
        flex-wrap: wrap;
        justify-content: space-between;
        gap: 0.75rem;
        font-size: 0.8rem;
        color: rgba(226, 232, 240, 0.7);
    }

    .upload-error {
        margin: 0;
        font-size: 0.85rem;
        color: #fca5a5;
    }

    .upload-status {
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
        font-size: 0.85rem;
    }

    .upload-status.in-progress {
        color: #93c5fd;
    }

    .uploader-pill {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        padding: 0.75rem 1rem;
        border-radius: 12px;
        border: 1px solid rgba(94, 234, 212, 0.25);
        background: rgba(94, 234, 212, 0.08);
    }

    .uploader-avatar {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 2.5rem;
        height: 2.5rem;
        border-radius: 999px;
        background: rgba(94, 234, 212, 0.2);
        color: #5eead4;
        font-weight: 600;
        font-size: 1rem;
    }

    .uploader-details {
        display: flex;
        flex-direction: column;
        gap: 0.15rem;
    }

    .uploader-name {
        font-size: 0.95rem;
        font-weight: 600;
        color: #f8fafc;
    }

    .uploader-email {
        font-size: 0.8rem;
        color: rgba(226, 232, 240, 0.6);
    }

    .warning {
        margin: 0.4rem 0 0;
        font-size: 0.8rem;
        color: #fca5a5;
    }

    .processing-status {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        padding: 0.75rem 1rem;
        background: rgba(59, 130, 246, 0.1);
        border: 1px solid rgba(59, 130, 246, 0.3);
        border-radius: 8px;
        color: #93c5fd;
        font-size: 0.875rem;
    }

    .spinner {
        width: 1rem;
        height: 1rem;
        border: 2px solid rgba(94, 234, 212, 0.3);
        border-top-color: #5eead4;
        border-radius: 50%;
        animation: spin 0.8s linear infinite;
    }

    .spinner-small {
        width: 0.875rem;
        height: 0.875rem;
        border: 2px solid rgba(94, 234, 212, 0.3);
        border-top-color: #5eead4;
        border-radius: 50%;
        animation: spin 0.8s linear infinite;
        flex-shrink: 0;
    }

    @keyframes spin {
        to {
            transform: rotate(360deg);
        }
    }

    .location-status {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        padding: 0.75rem 1rem;
        border-radius: 8px;
        font-size: 0.875rem;
    }

    .location-status.detecting {
        background: rgba(59, 130, 246, 0.1);
        border: 1px solid rgba(59, 130, 246, 0.3);
        color: #93c5fd;
    }

    .location-status.found {
        background: rgba(94, 234, 212, 0.1);
        border: 1px solid rgba(94, 234, 212, 0.3);
        color: #5eead4;
    }

    .location-status.not-found {
        background: rgba(251, 191, 36, 0.1);
        border: 1px solid rgba(251, 191, 36, 0.3);
        color: #fbbf24;
    }

    .location-status svg {
        flex-shrink: 0;
    }

    .video-preview {
        width: 100%;
        max-height: 400px;
        border-radius: 12px;
        background: rgba(0, 0, 0, 0.5);
    }

    .input,
    .textarea {
        width: 100%;
        padding: 0.75rem 1rem;
        background: rgba(30, 41, 59, 0.6);
        border: 1px solid rgba(148, 163, 184, 0.2);
        border-radius: 8px;
        color: #f8fafc;
        font-size: 0.95rem;
        font-family: inherit;
        transition:
            border-color 0.2s ease,
            background 0.2s ease;
    }

    .input:focus,
    .textarea:focus {
        outline: none;
        border-color: rgba(94, 234, 212, 0.5);
        background: rgba(30, 41, 59, 0.8);
    }

    .textarea {
        resize: vertical;
        min-height: 120px;
        line-height: 1.5;
    }

    select.input {
        cursor: pointer;
    }

    .word-counter {
        font-size: 0.85rem;
        color: rgba(226, 232, 240, 0.6);
        font-weight: 400;
    }

    .word-counter.over-limit {
        color: #fca5a5;
    }

    .thumbnail-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
        gap: 1rem;
    }

    .thumbnail-option {
        position: relative;
        aspect-ratio: 16 / 9;
        border-radius: 8px;
        overflow: hidden;
        border: 2px solid rgba(148, 163, 184, 0.2);
        background: rgba(30, 41, 59, 0.6);
        cursor: pointer;
        transition:
            border-color 0.2s ease,
            transform 0.2s ease;
        padding: 0;
    }

    .thumbnail-option:hover {
        border-color: rgba(94, 234, 212, 0.5);
        transform: scale(1.05);
    }

    .thumbnail-option.selected {
        border-color: #5eead4;
    }

    .thumbnail-option img {
        width: 100%;
        height: 100%;
        object-fit: cover;
    }

    .selected-indicator {
        position: absolute;
        top: 0.5rem;
        right: 0.5rem;
        color: #5eead4;
        background: rgba(15, 23, 42, 0.9);
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .location-detected {
        font-size: 0.85rem;
        color: #5eead4;
        font-weight: 400;
    }

    .form-actions {
        display: flex;
        justify-content: flex-end;
        padding-top: 1rem;
        border-top: 1px solid rgba(148, 163, 184, 0.2);
    }

    .submit-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 0.75rem;
        padding: 0.875rem 2rem;
        background: linear-gradient(135deg, #5eead4, #3b82f6);
        border: none;
        border-radius: 9999px;
        color: #0f172a;
        font-size: 1rem;
        font-weight: 600;
        cursor: pointer;
        transition:
            transform 0.2s ease,
            box-shadow 0.2s ease;
        min-width: 200px;
    }

    .submit-btn:hover:not(:disabled) {
        transform: translateY(-2px);
        box-shadow: 0 10px 30px -10px rgba(94, 234, 212, 0.5);
    }

    .submit-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }

    @media (max-width: 640px) {
        .page {
            padding: 2rem 1rem;
        }

        .card {
            padding: 1.5rem;
            gap: 1.5rem;
        }

        header h1 {
            font-size: 1.5rem;
        }

        .thumbnail-grid {
            grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
            gap: 0.75rem;
        }

        .form-actions {
            justify-content: stretch;
        }

        .submit-btn {
            width: 100%;
        }
    }
</style>
