<script lang="ts">
    import { browser } from "$app/environment";
    import { enhance } from "$app/forms";
    import type { PageData, ActionData } from "./$types";
    import LocationPicker from "$lib/components/LocationPicker.svelte";
    import { goto, invalidateAll } from "$app/navigation";
    import BreadcrumbBar from "$lib/components/BreadcrumbBar.svelte";

    interface Props {
        data: PageData;
        form: ActionData;
    }

    const { data, form }: Props = $props();

    // Form state - Initialize with existing video data
    let title = $state(data.data?.title ?? "");
    let description = $state(data.data?.description ?? "");
    let latitude = $state<number | undefined>(
        typeof data.data?.latitude === 'number' ? data.data.latitude : undefined
    );
    let longitude = $state<number | undefined>(
        typeof data.data?.longitude === 'number' ? data.data.longitude : undefined
    );
    let selectedThumbnail = $state<string>(data.data?.thumbnailUrl ?? "");
    let videoUrl = $state(data.data?.videoUrl ?? "");
    let duration = $state(data.data?.duration ?? 0);

    // UI state
    let wordCount = $state(0);
    let isSubmitting = $state(false);
    let thumbnails = $state<string[]>([]);
    let isGeneratingThumbnails = $state(false);
    let thumbnailError = $state<string | null>(null);

    function handleLocationChange(lat: number, lon: number) {
        latitude = lat;
        longitude = lon;
    }

    function updateWordCount() {
        const words = description.trim().split(/\s+/).filter(Boolean);
        wordCount = words.length;
    }

    function selectThumbnail(thumb: string) {
        selectedThumbnail = thumb;
    }

    async function generateThumbnailsFromVideo() {
        if (!browser || !videoUrl) {
            thumbnailError = "No video URL available";
            return;
        }

        console.log("Starting thumbnail generation for:", videoUrl);
        isGeneratingThumbnails = true;
        thumbnailError = null;

        try {
            const video = document.createElement("video");
            video.crossOrigin = "anonymous";
            video.preload = "metadata";
            video.muted = true;
            video.playsInline = true;

            // Check if video URL is an HLS stream
            const isHLS = videoUrl.includes('.m3u8');
            console.log("Is HLS stream:", isHLS);

            if (isHLS) {
                // For HLS streams, we need to use HLS.js
                if (typeof (window as any).Hls !== 'undefined') {
                    const Hls = (window as any).Hls;
                    console.log("HLS.js is available");

                    if (Hls.isSupported()) {
                        const hls = new Hls({
                            enableWorker: true,
                            lowLatencyMode: false,
                            debug: true,
                        });

                        console.log("Loading HLS source...");
                        hls.loadSource(videoUrl);
                        hls.attachMedia(video);

                        await new Promise<void>((resolve, reject) => {
                            const timeout = setTimeout(() => {
                                reject(new Error("HLS loading timeout"));
                            }, 30000); // 30 second timeout

                            hls.on(Hls.Events.MANIFEST_PARSED, () => {
                                console.log("HLS manifest parsed");
                                clearTimeout(timeout);
                                resolve();
                            });

                            hls.on(Hls.Events.ERROR, (event: any, data: any) => {
                                console.error("HLS error:", data);
                                if (data.fatal) {
                                    clearTimeout(timeout);
                                    reject(new Error(`HLS error: ${data.type} - ${data.details}`));
                                }
                            });
                        });

                        // Wait for video to be ready
                        await new Promise<void>((resolve, reject) => {
                            if (video.readyState >= 2) {
                                resolve();
                            } else {
                                video.onloadeddata = () => {
                                    console.log("Video data loaded");
                                    resolve();
                                };
                                video.onerror = () => reject(new Error("Video loading error"));
                                setTimeout(() => reject(new Error("Video ready timeout")), 10000);
                            }
                        });
                    } else {
                        throw new Error("HLS is not supported in this browser");
                    }
                } else {
                    // Fallback: Check if browser natively supports HLS (Safari)
                    console.log("HLS.js not available, trying native HLS support");
                    if (video.canPlayType('application/vnd.apple.mpegurl')) {
                        video.src = videoUrl;
                        await new Promise<void>((resolve, reject) => {
                            video.onloadedmetadata = () => {
                                console.log("Native HLS loaded");
                                resolve();
                            };
                            video.onerror = () => reject(new Error("Failed to load video"));
                            setTimeout(() => reject(new Error("Native HLS timeout")), 30000);
                        });
                    } else {
                        throw new Error("HLS not supported and HLS.js not available. Please wait for the page to fully load.");
                    }
                }
            } else {
                // Standard video formats
                console.log("Loading standard video format");
                video.src = videoUrl;
                await new Promise<void>((resolve, reject) => {
                    video.onloadedmetadata = () => {
                        console.log("Standard video loaded");
                        resolve();
                    };
                    video.onerror = () => reject(new Error("Failed to load video"));
                    setTimeout(() => reject(new Error("Video load timeout")), 30000);
                });
            }

            const videoDuration = video.duration;
            console.log("Video duration:", videoDuration);

            if (!videoDuration || videoDuration === 0 || !isFinite(videoDuration)) {
                throw new Error("Video duration is invalid");
            }

            const canvas = document.createElement("canvas");
            const ctx = canvas.getContext("2d");

            if (!ctx) {
                throw new Error("Could not get canvas context");
            }

            // Wait a bit for video to be fully ready
            await new Promise(resolve => setTimeout(resolve, 500));

            const aspectRatio = video.videoHeight / video.videoWidth;
            canvas.width = 320;
            canvas.height = Math.round(320 * aspectRatio);

            console.log("Canvas size:", canvas.width, "x", canvas.height);

            const thumbCount = 5;
            const generatedThumbs: string[] = [];

            for (let i = 0; i < thumbCount; i++) {
                const timestamp = (videoDuration / (thumbCount + 1)) * (i + 1);
                console.log(`Seeking to timestamp ${i + 1}/${thumbCount}:`, timestamp);

                video.currentTime = timestamp;

                await new Promise<void>((resolve, reject) => {
                    const timeout = setTimeout(() => reject(new Error("Seek timeout")), 5000);
                    video.onseeked = () => {
                        clearTimeout(timeout);
                        resolve();
                    };
                });

                // Additional delay to ensure frame is rendered
                await new Promise(resolve => setTimeout(resolve, 200));

                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
                generatedThumbs.push(dataUrl);
                console.log(`Generated thumbnail ${i + 1}/${thumbCount}`);
            }

            console.log("Successfully generated", generatedThumbs.length, "thumbnails");
            thumbnails = generatedThumbs;

            // Auto-select first thumbnail if none selected
            if (thumbnails.length > 0 && !selectedThumbnail) {
                selectedThumbnail = thumbnails[0];
            }

            thumbnailError = null;
        } catch (error) {
            console.error("Error generating thumbnails:", error);
            const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
            thumbnailError = `Failed to generate thumbnails: ${errorMessage}`;
        } finally {
            isGeneratingThumbnails = false;
        }
    }

    $effect(() => {
        updateWordCount();
    });

    function handleSubmit() {
        isSubmitting = true;
        return async ({ result, update }: any) => {
            isSubmitting = false;

            if (result.type === "success" && result.data?.success) {
                // Invalidate all data to refresh
                await invalidateAll();
                // Redirect back to uploads page
                goto("/account/uploads");
            } else {
                await update();
            }
        };
    }
</script>

<svelte:head>
    <title>Edit Video - {title}</title>
    <script src="https://cdn.jsdelivr.net/npm/hls.js@latest"></script>
</svelte:head>

<div class="page">
    <BreadcrumbBar items={[
        { label: "My Account", href: "/account" },
        { label: "My Uploads", href: "/account/uploads" },
        { label: "Edit Video" }
    ]} />

    <form
        method="POST"
        action="?/update"
        class="card"
        use:enhance={handleSubmit}
    >
        <header>
            <h1>Edit Video</h1>
            <p>Update your video details below.</p>
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

        {#if form?.success}
            <div class="success-banner">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <path
                        d="M10 18C14.4183 18 18 14.4183 18 10C18 5.58172 14.4183 2 10 2C5.58172 2 2 5.58172 2 10C2 14.4183 5.58172 18 10 18Z"
                        stroke="currentColor"
                        stroke-width="2"
                    />
                    <path
                        d="M6 10L9 13L14 8"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                    />
                </svg>
                <span>Video updated successfully!</span>
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
        <div class="form-group">
            <label class="label">Thumbnail</label>

            {#if thumbnailError}
                <div class="error-status">
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                        <circle cx="10" cy="10" r="8" stroke="currentColor" stroke-width="2" />
                        <path d="M10 6v4M10 14h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
                    </svg>
                    <span>{thumbnailError}</span>
                </div>
            {/if}

            {#if isGeneratingThumbnails}
                <div class="processing-status">
                    <div class="spinner-small"></div>
                    <span>Generating thumbnails...</span>
                </div>
            {:else if thumbnails.length > 0}
                <fieldset>
                    <legend class="label-inner">
                        Select a thumbnail
                        {#if selectedThumbnail && thumbnails.includes(selectedThumbnail)}
                            <span class="thumbnail-selected">✓ Selected</span>
                        {/if}
                    </legend>
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
                    <button
                        type="button"
                        class="regenerate-btn"
                        onclick={generateThumbnailsFromVideo}
                        disabled={isGeneratingThumbnails}
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                            <path
                                d="M1 4V10H7"
                                stroke="currentColor"
                                stroke-width="2"
                                stroke-linecap="round"
                                stroke-linejoin="round"
                            />
                            <path
                                d="M23 20V14H17"
                                stroke="currentColor"
                                stroke-width="2"
                                stroke-linecap="round"
                                stroke-linejoin="round"
                            />
                            <path
                                d="M20.49 9C19.9828 7.56678 19.1209 6.28536 17.9845 5.27541C16.8482 4.26546 15.4745 3.55974 13.9917 3.22426C12.5089 2.88878 10.9652 2.93434 9.50481 3.35677C8.04437 3.77921 6.71475 4.56471 5.64 5.64L1 10M23 14L18.36 18.36C17.2853 19.4353 15.9556 20.2208 14.4952 20.6432C13.0348 21.0657 11.4911 21.1112 10.0083 20.7757C8.52547 20.4403 7.1518 19.7345 6.01547 18.7246C4.87913 17.7146 4.01717 16.4332 3.51 15"
                                stroke="currentColor"
                                stroke-width="2"
                                stroke-linecap="round"
                                stroke-linejoin="round"
                            />
                        </svg>
                        Regenerate Thumbnails
                    </button>
                </fieldset>
            {:else if selectedThumbnail}
                <div class="current-thumbnail">
                    <img src={selectedThumbnail} alt="Current thumbnail" />
                </div>
                <p class="hint">This is your current thumbnail. Generate new options below to change it.</p>
            {:else}
                <p class="hint">No thumbnail set. Generate thumbnails from your video to select one.</p>
            {/if}

            {#if videoUrl && !isGeneratingThumbnails}
                <button
                    type="button"
                    class="regenerate-btn"
                    onclick={generateThumbnailsFromVideo}
                >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                        <path
                            d="M1 4V10H7"
                            stroke="currentColor"
                            stroke-width="2"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                        />
                        <path
                            d="M23 20V14H17"
                            stroke="currentColor"
                            stroke-width="2"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                        />
                        <path
                            d="M20.49 9C19.9828 7.56678 19.1209 6.28536 17.9845 5.27541C16.8482 4.26546 15.4745 3.55974 13.9917 3.22426C12.5089 2.88878 10.9652 2.93434 9.50481 3.35677C8.04437 3.77921 6.71475 4.56471 5.64 5.64L1 10M23 14L18.36 18.36C17.2853 19.4353 15.9556 20.2208 14.4952 20.6432C13.0348 21.0657 11.4911 21.1112 10.0083 20.7757C8.52547 20.4403 7.1518 19.7345 6.01547 18.7246C4.87913 17.7146 4.01717 16.4332 3.51 15"
                            stroke="currentColor"
                            stroke-width="2"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                        />
                    </svg>
                    {thumbnails.length > 0 ? 'Regenerate Thumbnails' : 'Generate Thumbnails'}
                </button>
            {/if}
        </div>

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
        <input type="hidden" name="thumbnailUrl" value={selectedThumbnail} />

        <!-- Submit Button -->
        <div class="form-actions">
            <a href="/account/uploads" class="cancel-btn">Cancel</a>
            <button type="submit" class="submit-btn" disabled={isSubmitting}>
                {#if isSubmitting}
                    <div class="spinner"></div>
                    <span>Saving...</span>
                {:else}
                    <span>Save Changes</span>
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

    .success-banner {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        padding: 1rem 1.25rem;
        background: rgba(94, 234, 212, 0.1);
        border: 1px solid rgba(94, 234, 212, 0.3);
        border-radius: 12px;
        color: #5eead4;
        font-size: 0.9rem;
    }

    .success-banner svg {
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

    .label-inner {
        font-size: 0.85rem;
        font-weight: 500;
        color: #f8fafc;
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 0.75rem;
    }

    .hint {
        font-size: 0.85rem;
        color: rgba(226, 232, 240, 0.6);
        margin: -0.25rem 0 0;
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

    .word-counter {
        font-size: 0.85rem;
        color: rgba(226, 232, 240, 0.6);
        font-weight: 400;
    }

    .word-counter.over-limit {
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

    .error-status {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        padding: 0.75rem 1rem;
        background: rgba(239, 68, 68, 0.1);
        border: 1px solid rgba(239, 68, 68, 0.3);
        border-radius: 8px;
        color: #fca5a5;
        font-size: 0.875rem;
        margin-bottom: 0.75rem;
    }

    .error-status svg {
        flex-shrink: 0;
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

    .thumbnail-selected {
        font-size: 0.85rem;
        color: #5eead4;
        font-weight: 400;
    }

    .current-thumbnail {
        max-width: 320px;
        border-radius: 8px;
        overflow: hidden;
        border: 2px solid rgba(94, 234, 212, 0.3);
    }

    .current-thumbnail img {
        width: 100%;
        height: auto;
        display: block;
    }

    .regenerate-btn {
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.625rem 1rem;
        margin-top: 0.5rem;
        background: rgba(59, 130, 246, 0.15);
        border: 1px solid rgba(59, 130, 246, 0.3);
        border-radius: 8px;
        color: #93c5fd;
        font-size: 0.875rem;
        font-weight: 500;
        cursor: pointer;
        transition:
            background 0.2s ease,
            border-color 0.2s ease,
            transform 0.2s ease;
    }

    .regenerate-btn:hover:not(:disabled) {
        background: rgba(59, 130, 246, 0.25);
        border-color: rgba(59, 130, 246, 0.45);
        transform: translateY(-1px);
    }

    .regenerate-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }

    .regenerate-btn svg {
        flex-shrink: 0;
    }

    .location-detected {
        font-size: 0.85rem;
        color: #5eead4;
        font-weight: 400;
    }

    .form-actions {
        display: flex;
        justify-content: flex-end;
        gap: 1rem;
        padding-top: 1rem;
        border-top: 1px solid rgba(148, 163, 184, 0.2);
    }

    .cancel-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 0.875rem 2rem;
        background: rgba(148, 163, 184, 0.1);
        border: 1px solid rgba(148, 163, 184, 0.3);
        border-radius: 9999px;
        color: #e2e8f0;
        font-size: 1rem;
        font-weight: 600;
        cursor: pointer;
        transition:
            transform 0.2s ease,
            background 0.2s ease;
        text-decoration: none;
    }

    .cancel-btn:hover {
        background: rgba(148, 163, 184, 0.2);
        transform: translateY(-1px);
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

    .spinner {
        width: 1rem;
        height: 1rem;
        border: 2px solid rgba(15, 23, 42, 0.3);
        border-top-color: #0f172a;
        border-radius: 50%;
        animation: spin 0.8s linear infinite;
    }

    @keyframes spin {
        to {
            transform: rotate(360deg);
        }
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
            flex-direction: column-reverse;
        }

        .submit-btn,
        .cancel-btn {
            width: 100%;
        }
    }
</style>
