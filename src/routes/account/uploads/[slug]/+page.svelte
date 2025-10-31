<script lang="ts">
    import { browser } from "$app/environment";
    import { enhance } from "$app/forms";
    import type { PageData, ActionData } from "./$types";
    import LocationPicker from "$lib/components/LocationPicker.svelte";
    import { goto, invalidateAll } from "$app/navigation";
    import BreadcrumbBar from "$lib/components/BreadcrumbBar.svelte";
    import { onDestroy } from "svelte";
    import { Upload } from "tus-js-client";

    interface Props {
        data: PageData;
        form: ActionData;
    }

    const { data, form }: Props = $props();
    const videoId = data.data?.id ?? "";

    let title = $state(data.data?.title ?? "");
    let description = $state(data.data?.description ?? "");
    let latitude = $state<number | undefined>(
        typeof data.data?.latitude === 'number' ? data.data.latitude : undefined
    );
    let longitude = $state<number | undefined>(
        typeof data.data?.longitude === 'number' ? data.data.longitude : undefined
    );
    let selectedThumbnail = $state<string>(data.data?.thumbnailUrl ?? (data.data?.availableThumbnails?.[0] ?? ""));
    let videoUrl = $state(data.data?.videoUrl ?? "");
    let duration = $state(data.data?.duration ?? 0);
    let uploadedAtRaw = $state(data.data?.uploadedAt ?? "");
    let createdAtRaw = $state(data.data?.createdAt ?? "");
    
    // For the date input field (only date part)
    let uploadDate = $derived(uploadedAtRaw ? new Date(uploadedAtRaw).toISOString().split('T')[0] : "");
    
    function formatDateTime(isoString: string): string {
        if (!isoString) return 'Not set';
        try {
            const date = new Date(isoString);
            const dateStr = date.toLocaleString('en-US', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                hour12: false
            });
            const timezone = date.toLocaleTimeString('en-US', {
                timeZoneName: 'short'
            }).split(' ').pop() || '';
            return `${dateStr} ${timezone}`;
        } catch {
            return isoString;
        }
    }
    
    function handleUploadDateChange(event: Event) {
        const target = event.target as HTMLInputElement;
        if (target.value) {
            // Convert date input (YYYY-MM-DD) to ISO string with current time
            const dateOnly = new Date(target.value + 'T00:00:00');
            uploadedAtRaw = dateOnly.toISOString();
        } else {
            uploadedAtRaw = "";
        }
    }
    let keywords = $state<string[]>(data.data?.tags ?? []);
    let keywordInput = $state("");
    let streamId = $state((data.data?.streamId ?? "").trim());
    const initialFormat = (data.data?.format ?? "").trim();
    let format = $state(initialFormat ? initialFormat.toUpperCase() : "");
    let aspectRatio = $state((data.data?.aspectRatio ?? "").trim());

    let wordCount = $state(0);
    let isSubmitting = $state(false);
    let activeTab = $state<'metadata' | 'assets' | 'settings' | 'analysis'>('metadata');
    let isEditingTitle = $state(false);
    let thumbnails = $state<string[]>(data.data?.availableThumbnails ?? []);
    let isUpdatingThumbnail = $state(false);
    let thumbnailError = $state<string | null>(null);
    let visibility = $state<'public' | 'unlisted' | 'private'>('private');
    let allowDownloads = $state(true);
    let allowEmbedding = $state(true);
    let shareUrl = $state('');
    let copyFeedback = $state<'idle' | 'copied' | 'error'>('idle');
    let copyFeedbackTimeout: number | undefined;
    let replaceFileInput: HTMLInputElement | null = null;
    type ReplaceStatus = 'idle' | 'creating' | 'uploading' | 'success' | 'error';
    let replaceUpload: Upload | null = null;
    let replaceStatus = $state<ReplaceStatus>('idle');
    let replaceError = $state<string | null>(null);
    let replaceProgress = $state(0);
    let replaceBytesUploaded = $state(0);
    let replaceBytesTotal = $state(0);
    let replaceStreamId = $state('');
    let replaceCdnHost = $state('');
    let replaceDuration = $state<number | null>(null);
    let replaceFormat = $state<string | null>(null);
    let replaceAspectRatio = $state<string | null>(null);
    let downloadUrl = $state(data.data?.downloadUrl ?? '');
    
    // Build preview animation URL
    function buildPreviewUrl(): string | null {
        if (!streamId) return null;
        // Extract CDN hostname from videoUrl or downloadUrl
        const url = videoUrl || downloadUrl || '';
        const match = url.match(/https?:\/\/([^\/]+)/);
        if (match && match[1]) {
            const cdnHost = match[1];
            // Build preview URL: https://cdn-host/streamId/preview.webp?v=timestamp
            const timestamp = Date.now();
            return `https://${cdnHost}/${streamId}/preview.webp?v=${timestamp}`;
        }
        return null;
    }
    
    let previewUrl = $derived(buildPreviewUrl());

    function handleLocationChange(lat: number, lon: number) {
        latitude = lat;
        longitude = lon;
    }

    function startEditingTitle() {
        isEditingTitle = true;
    }

    async function finishEditingTitle() {
        isEditingTitle = false;
        if (!title.trim()) {
            title = data.data?.title ?? "";
            return;
        }
        
        // Auto-save title when editing finishes
        if (title.trim() !== (data.data?.title ?? "")) {
            try {
                const formData = new FormData();
                formData.append('title', title.trim());
                formData.append('description', description);
                formData.append('latitude', latitude?.toString() ?? '');
                formData.append('longitude', longitude?.toString() ?? '');
                formData.append('keywords', JSON.stringify(keywords));
                
                const response = await fetch(`/account/uploads/${videoId}?/update`, {
                    method: 'POST',
                    body: formData
                });
                
                if (response.ok) {
                    await invalidateAll();
                }
            } catch (err) {
                console.error('Error auto-saving title:', err);
            }
        }
    }

    function handleTitleKeydown(e: KeyboardEvent) {
        if (e.key === 'Enter') {
            e.preventDefault();
            finishEditingTitle();
        } else if (e.key === 'Escape') {
            title = data.data?.title ?? "";
            finishEditingTitle();
        }
    }

    function updateWordCount() {
        const words = description.trim().split(/\s+/).filter(Boolean);
        wordCount = words.length;
    }

    function addKeyword() {
        const trimmed = keywordInput.trim();
        if (trimmed && !keywords.includes(trimmed)) {
            keywords = [...keywords, trimmed];
            keywordInput = "";
        }
    }

    function removeKeyword(keyword: string) {
        keywords = keywords.filter(k => k !== keyword);
    }

    function handleKeywordKeydown(e: KeyboardEvent) {
        if (e.key === 'Enter') {
            e.preventDefault();
            addKeyword();
        }
    }

    function deriveFormatFromFile(file: File): string {
        const name = file.name ?? '';
        const ext = name.includes('.') ? name.split('.').pop() ?? '' : '';
        if (ext) {
            return ext.toUpperCase();
        }
        if (file.type) {
            const parts = file.type.split('/');
            const subtype = parts.pop();
            if (subtype) {
                return subtype.toUpperCase();
            }
            return file.type.toUpperCase();
        }
        return '';
    }

    function formatAspectRatio(width: number | null, height: number | null): string {
        if (!width || !height) return '';
        const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
        const divisor = gcd(width, height);
        const ratioWidth = Math.round(width / divisor);
        const ratioHeight = Math.round(height / divisor);
        return `${ratioWidth}:${ratioHeight}`;
    }

    async function getFileMetadata(file: File): Promise<{ duration: number | null; width: number | null; height: number | null }> {
        return new Promise((resolve) => {
            const video = document.createElement("video");
            const objectUrl = URL.createObjectURL(file);
            video.preload = "metadata";
            video.src = objectUrl;
            video.onloadedmetadata = () => {
                const metadata = {
                    duration: Number.isFinite(video.duration) ? Math.round(video.duration) : null,
                    width: Number.isFinite(video.videoWidth) ? video.videoWidth : null,
                    height: Number.isFinite(video.videoHeight) ? video.videoHeight : null
                };
                URL.revokeObjectURL(objectUrl);
                resolve(metadata);
            };
            video.onerror = () => {
                URL.revokeObjectURL(objectUrl);
                resolve({ duration: null, width: null, height: null });
            };
        });
    }

    $effect(() => {
        updateWordCount();
    });

    $effect(() => {
        if (browser && videoUrl) {
            const videoElement = document.getElementById('video-player') as HTMLVideoElement;
            if (!videoElement) return;

            const isHLS = videoUrl.includes('.m3u8');

            if (isHLS && typeof (window as any).Hls !== 'undefined') {
                const Hls = (window as any).Hls;
                if (Hls.isSupported()) {
                    const hls = new Hls();
                    hls.loadSource(videoUrl);
                    hls.attachMedia(videoElement);

                    return () => {
                        hls.destroy();
                    };
                }
            } else if (isHLS && videoElement.canPlayType('application/vnd.apple.mpegurl')) {
                videoElement.src = videoUrl;
            }
        }
    });

    $effect(() => {
        const id = data.data?.id;
        if (!id) {
            shareUrl = '';
            return;
        }

        if (browser) {
            shareUrl = new URL(`/videos/${id}`, window.location.origin).toString();
        } else {
            shareUrl = `/videos/${id}`;
        }
    });

    $effect(() => {
        if (!downloadUrl && videoUrl) {
            downloadUrl = deriveDownloadUrlFromStreamUrl(videoUrl);
        }
    });

    $effect(() => {
        if (!selectedThumbnail && videoUrl) {
            selectedThumbnail = deriveThumbnailUrlFromStreamUrl(videoUrl);
        }
    });
    async function selectThumbnail(thumbnailUrl: string) {
        if (!browser || !videoId || selectedThumbnail === thumbnailUrl) return;
        
        isUpdatingThumbnail = true;
        thumbnailError = null;
        
        try {
            const response = await fetch(`/account/uploads/${videoId}/thumbnail`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    thumbnailUrl: thumbnailUrl
                })
            });

            const result = await response.json().catch(() => null);
            
            if (!response.ok) {
                const errorMessage = result?.error ?? `Failed to update thumbnail (${response.status})`;
                throw new Error(errorMessage);
            }

            if (result?.success) {
                selectedThumbnail = thumbnailUrl;
                await invalidateAll();
            } else {
                throw new Error(result?.error ?? 'Failed to update thumbnail');
            }
        } catch (err) {
            console.error('Thumbnail update error:', err);
            thumbnailError = err instanceof Error ? err.message : 'Failed to update thumbnail';
        } finally {
            isUpdatingThumbnail = false;
        }
    }

    function copyShareLink() {
        if (!browser || !shareUrl) {
            return;
        }

        if (copyFeedbackTimeout) {
            window.clearTimeout(copyFeedbackTimeout);
            copyFeedbackTimeout = undefined;
        }

        if (!navigator?.clipboard) {
            copyFeedback = 'error';
            copyFeedbackTimeout = window.setTimeout(() => {
                copyFeedback = 'idle';
                copyFeedbackTimeout = undefined;
            }, 2000);
            return;
        }

        navigator.clipboard
            .writeText(shareUrl)
            .then(() => {
                copyFeedback = 'copied';
            })
            .catch(() => {
                copyFeedback = 'error';
            })
            .finally(() => {
                copyFeedbackTimeout = window.setTimeout(() => {
                    copyFeedback = 'idle';
                    copyFeedbackTimeout = undefined;
                }, 2000);
            });
    }

    function buildStreamUrl(host: string, videoId: string) {
        const cleanedHost = host?.replace(/^https?:\/\//, "").replace(/\/+$/, "");
        if (!cleanedHost || !videoId) return "";
        return `https://${cleanedHost}/${videoId}/playlist.m3u8`;
    }

    function formatBytes(bytes: number) {
        if (!Number.isFinite(bytes) || bytes <= 0) return "0 MB";
        return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
    }

function deriveDownloadUrlFromStreamUrl(streamUrl: string): string {
    if (!streamUrl) return '';
    const trimmed = streamUrl.replace(/\/playlist\.m3u8(?:\?.*)?$/, '');
    return `${trimmed}/original`;
}

function deriveThumbnailUrlFromStreamUrl(streamUrl: string): string {
    if (!streamUrl) return '';
    const trimmed = streamUrl.replace(/\/playlist\.m3u8(?:\?.*)?$/, '');
    return `${trimmed}/thumbnail.jpg`;
}

    async function resetReplaceUpload(options: { terminate?: boolean } = {}) {
        const { terminate = false } = options;
        if (replaceUpload) {
            try {
                await replaceUpload.abort(terminate);
            } catch (err) {
                console.warn("Failed to abort replace upload", err);
            }
            replaceUpload = null;
        }

        replaceStatus = 'idle';
        replaceError = null;
        replaceProgress = 0;
        replaceBytesUploaded = 0;
        replaceBytesTotal = 0;
        replaceStreamId = '';
        replaceCdnHost = '';
        replaceDuration = null;
        replaceFormat = null;
        replaceAspectRatio = null;
    }

    function triggerReplaceFileDialog() {
        if (replaceStatus === 'uploading' || replaceStatus === 'creating') {
            return;
        }
        replaceFileInput?.click();
    }

    async function handleReplaceFileChange(event: Event) {
        const input = event.currentTarget as HTMLInputElement | null;
        const file = input?.files?.[0];
        if (input) {
            input.value = "";
        }
        if (!file) {
            return;
        }
        await startReplaceUpload(file);
    }

    async function startReplaceUpload(file: File) {
        if (!browser) return;

        await resetReplaceUpload({ terminate: true });

        replaceStatus = 'creating';
        replaceBytesTotal = file.size;
        replaceError = null;

        replaceFormat = deriveFormatFromFile(file);

        const metadata = await getFileMetadata(file).catch(() => ({
            duration: null,
            width: null,
            height: null
        }));

        replaceDuration = metadata.duration;
        replaceAspectRatio =
            metadata.width && metadata.height ? formatAspectRatio(metadata.width, metadata.height) : null;

        const inferredTitle = title?.trim().length
            ? title.trim()
            : file.name.replace(/\.[^/.]+$/, "").replace(/[_-]/g, " ");

        try {
            const response = await fetch("/account/new/tus", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    title: inferredTitle,
                    thumbnailTime: Math.max(
                        0,
                        Math.round(((replaceDuration ?? duration) || 0) * 1000)
                    )
                })
            });

            if (!response.ok) {
                const errorPayload = await response.json().catch(() => null);
                throw new Error(errorPayload?.message ?? "Unable to initialise upload.");
            }

            const payload: {
                videoId: string;
                expires: number;
                signature: string;
                libraryId: string | number;
                uploadUrl: string;
                cdnHost?: string | null;
            } = await response.json();

            replaceStreamId = payload.videoId;
            replaceCdnHost = payload.cdnHost ?? '';
            replaceBytesTotal = file.size;

            replaceUpload = new Upload(file, {
                endpoint: payload.uploadUrl,
                retryDelays: [0, 3000, 5000, 10000, 20000, 60000],
                metadata: {
                    filetype: file.type ?? "video/mp4",
                    title: inferredTitle
                },
                headers: {
                    AuthorizationSignature: payload.signature,
                    AuthorizationExpire: String(payload.expires),
                    LibraryId: String(payload.libraryId),
                    VideoId: payload.videoId
                },
                onError: (err) => {
                    replaceStatus = 'error';
                    replaceError = err?.message ?? "Upload failed. Please try again.";
                },
                onProgress: (uploadedBytes, total) => {
                    replaceBytesUploaded = uploadedBytes;
                    replaceBytesTotal = total;
                    if (total > 0) {
                        replaceProgress = Math.max(
                            0,
                            Math.min(100, Math.round((uploadedBytes / total) * 100))
                        );
                    }
                },
                onSuccess: () => {
                    const newVideoUrl = buildStreamUrl(replaceCdnHost, replaceStreamId);
                    if (!newVideoUrl) {
                        replaceStatus = 'error';
                        replaceError = "Unable to resolve new stream URL.";
                        return;
                    }

                    void (async () => {
                        try {
                            if (!videoId) {
                                throw new Error("Missing video identifier.");
                            }

                            const response = await fetch(`/account/uploads/${videoId}/replace`, {
                                method: "POST",
                                headers: {
                                    "Content-Type": "application/json"
                                },
                                body: JSON.stringify({
                                    videoUrl: newVideoUrl,
                                    duration: typeof replaceDuration === 'number' ? replaceDuration : undefined,
                                    streamId: replaceStreamId || undefined,
                                    format: replaceFormat ?? undefined,
                                    aspectRatio: replaceAspectRatio ?? undefined
                                })
                            });

                            const payload = await response.json().catch(() => null);

                            if (!response.ok) {
                                const errorMessage =
                                    (payload && typeof payload === 'object' && typeof (payload as any).error === 'string')
                                        ? (payload as any).error
                                        : "Failed to save new stream URL.";
                                throw new Error(errorMessage);
                            }

                            if (payload && typeof payload === 'object' && typeof (payload as any).videoUrl === 'string') {
                                videoUrl = (payload as any).videoUrl;
                            } else {
                                videoUrl = newVideoUrl;
                            }

                            downloadUrl = deriveDownloadUrlFromStreamUrl(videoUrl);

                            if (
                                typeof replaceDuration === 'number' &&
                                payload &&
                                typeof payload === 'object' &&
                                typeof (payload as any).duration === 'number'
                            ) {
                                duration = (payload as any).duration;
                            } else if (typeof replaceDuration === 'number') {
                                duration = replaceDuration;
                            }

                            const serverStreamId = payload && typeof payload === 'object' ? (payload as any).streamId : undefined;
                            const serverFormat = payload && typeof payload === 'object' ? (payload as any).format : undefined;
                            const serverAspectRatio = payload && typeof payload === 'object' ? (payload as any).aspectRatio : undefined;

                            if (typeof serverStreamId === 'string' && serverStreamId.length > 0) {
                                streamId = serverStreamId;
                            } else if (replaceStreamId) {
                                streamId = replaceStreamId;
                            }

                            if (typeof serverFormat === 'string' && serverFormat.length > 0) {
                                format = serverFormat.toUpperCase();
                            } else if (replaceFormat) {
                                format = replaceFormat.trim().toUpperCase();
                            }

                            if (typeof serverAspectRatio === 'string' && serverAspectRatio.length > 0) {
                                aspectRatio = serverAspectRatio;
                            } else if (replaceAspectRatio) {
                                aspectRatio = replaceAspectRatio.trim();
                            }

                            replaceFormat = null;
                            replaceAspectRatio = null;
                            replaceStreamId = '';

                            replaceStatus = 'success';
                            replaceError = null;
                            replaceProgress = 100;
                            replaceBytesUploaded = replaceBytesTotal;
                            downloadUrl = deriveDownloadUrlFromStreamUrl(videoUrl);
                            selectedThumbnail = deriveThumbnailUrlFromStreamUrl(videoUrl);
                            thumbnails = [];
                            await invalidateAll();
                        } catch (err) {
                            replaceStatus = 'error';
                            replaceError = err instanceof Error ? err.message : "Failed to save new stream URL.";
                        } finally {
                            replaceUpload = null;
                        }
                    })();
                }
            });

            if (!replaceUpload) {
                throw new Error("Failed to initialise upload.");
            }

            replaceUpload.start();
            replaceStatus = 'uploading';
        } catch (err) {
            replaceStatus = 'error';
            replaceError = err instanceof Error ? err.message : "Upload failed. Please try again.";
            replaceUpload = null;
        }
    }

    onDestroy(() => {
        if (copyFeedbackTimeout) {
            window.clearTimeout(copyFeedbackTimeout);
            copyFeedbackTimeout = undefined;
        }

        const uploadToAbort = replaceUpload;
        replaceUpload = null;
        if (uploadToAbort) {
            void uploadToAbort.abort(true).catch(() => undefined);
        }
    });

    function handleSubmit() {
        isSubmitting = true;
        return async ({ result, update }: any) => {
            isSubmitting = false;

            if (result.type === "success" && result.data?.success) {
                await invalidateAll();
                goto("/account/uploads");
            } else {
                await update();
            }
        };
    }
</script>

<svelte:head>
    <title>Edit - {title}</title>
    <script src="https://cdn.jsdelivr.net/npm/hls.js@latest"></script>
</svelte:head>

<div class="page" style={previewUrl ? `--preview-bg-url: url('${previewUrl}')` : ''}>
    <BreadcrumbBar items={[
        { label: "My Account", href: "/account" },
        { label: "My Uploads", href: "/account/uploads" },
        { label: "Edit" }
    ]} />

<div class="container px-12">
    <div class="header">
        <div class="title-container">
            {#if isEditingTitle}
                <input
                    type="text"
                    class="title-input"
                    bind:value={title}
                    onblur={finishEditingTitle}
                    onkeydown={handleTitleKeydown}
                    maxlength="200"
                    autofocus
                />
            {:else}
                <h1>{title || 'Edit Video'}</h1>
                <button type="button" class="edit-title-btn" onclick={startEditingTitle} aria-label="Edit title">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                </button>
            {/if}
        </div>
        <a href="/account/uploads" class="btn btn-secondary">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M19 12H5M12 19l-7-7 7-7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            Back
        </a>
    </div>

    {#if form?.error}
        <div class="alert alert-error">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <circle cx="10" cy="10" r="8" stroke="currentColor" stroke-width="2" />
                <path d="M10 6v4M10 14h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
            </svg>
            <span>{form.error}</span>
        </div>
    {/if}

    {#if form?.success}
        <div class="alert alert-success">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <circle cx="10" cy="10" r="8" stroke="currentColor" stroke-width="2" />
                <path d="M6 10l3 3 5-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            <span>Video updated!</span>
        </div>
    {/if}

    <div class="tabs">
        <button
            class="tab"
            class:active={activeTab === 'metadata'}
            onclick={() => activeTab = 'metadata'}
        >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke="currentColor" stroke-width="2"/>
                <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" stroke="currentColor" stroke-width="2"/>
            </svg>
            Metadata
        </button>
        <button
            class="tab"
            class:active={activeTab === 'assets'}
            onclick={() => activeTab = 'assets'}
        >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" stroke-width="2"/>
                <circle cx="8.5" cy="8.5" r="1.5" fill="currentColor"/>
                <path d="M21 15l-5-5L5 21" stroke="currentColor" stroke-width="2"/>
            </svg>
            Assets
        </button>
        <button
            class="tab"
            class:active={activeTab === 'settings'}
            onclick={() => activeTab = 'settings'}
        >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
            Settings
        </button>
        <button
            class="tab"
            class:active={activeTab === 'analysis'}
            onclick={() => activeTab = 'analysis'}
        >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M21 21l-6-6m2-5a7 7 0 1 1-14 0 7 7 0 0 1 14 0z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M10 7v3m0 3h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            Analysis
        </button>
    </div>

    <form method="POST" action="?/update" class="content " use:enhance={handleSubmit}>
        {#if activeTab === 'metadata'}
            <div class="section">

                <div class="form-group">
                    <label for="description" class="label">
                        Description *
                        <span class="meta" class:error={wordCount > 300}>
                            {wordCount} / 300 words
                        </span>
                    </label>
                    <textarea
                        id="description"
                        name="description"
                        class="textarea"
                        bind:value={description}
                        placeholder="Describe your video..."
                        required
                        rows="5"
                    ></textarea>
                </div>

                <div class="form-group">
                    <label for="uploadDate" class="label">Upload Date</label>
                    <input
                        id="uploadDate"
                        name="uploadedAt"
                        type="date"
                        class="input"
                        value={uploadDate}
                        onchange={handleUploadDateChange}
                    />
                    <p class="hint">Set the date when this video was originally filmed or uploaded</p>
                </div>

                <div class="form-group">
                    <label for="keywords" class="label">Keywords</label>
                    <div class="keywords-input-container">
                        <div class="keywords-pills-input">
                            {#each keywords as keyword}
                                <span class="keyword-pill">
                                    {keyword}
                                    <button type="button" class="remove-pill" onclick={() => removeKeyword(keyword)}>×</button>
                                </span>
                            {/each}
                            <input
                                id="keywords"
                                type="text"
                                class="keywords-text-input"
                                bind:value={keywordInput}
                                onkeydown={handleKeywordKeydown}
                                placeholder={keywords.length === 0 ? "Add keyword and press Enter" : ""}
                            />
                        </div>
                    </div>
                    <p class="hint">Add keywords to help people discover your video</p>
                </div>

                <div class="form-group">
                    <label for="description" class="label">
                        Location *
                        <span class="meta" class:error={wordCount > 300}>
                            {wordCount} / 300 words
                        </span>
                    </label>

                <LocationPicker {latitude} {longitude} onLocationChange={handleLocationChange} />
                
                {#if latitude && longitude}
                    <div class="location-info">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" stroke="currentColor" stroke-width="2"/>
                            <circle cx="12" cy="10" r="3" stroke="currentColor" stroke-width="2"/>
                        </svg>
                        <span>{latitude.toFixed(4)}, {longitude.toFixed(4)}</span>
                    </div>
                {/if}

                </div>

            </div>

            <input type="hidden" name="title" value={title || ""} />
            <input type="hidden" name="latitude" value={latitude ?? ""} />
            <input type="hidden" name="longitude" value={longitude ?? ""} />
            <input type="hidden" name="keywords" value={JSON.stringify(keywords)} />

            <div class="form-actions">
                <button type="submit" class="btn btn-primary" disabled={isSubmitting}>
                    {#if isSubmitting}
                        <div class="spinner"></div>
                        <span>Saving...</span>
                    {:else}
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" stroke="currentColor" stroke-width="2"/>
                            <path d="M17 21v-8H7v8M7 3v5h8" stroke="currentColor" stroke-width="2"/>
                        </svg>
                        <span>Save Changes</span>
                    {/if}
                </button>
                <button 
                    type="button" 
                    class="btn btn-danger" 
                    style="background: rgba(239, 68, 68, 0.1); border-color: rgba(239, 68, 68, 0.3); color: rgb(252, 165, 165);"
                    onclick={async () => {
                        if (!confirm('Are you sure you want to delete this video? This cannot be undone.')) {
                            return;
                        }
                        try {
                            const formData = new FormData();
                            const response = await fetch(`/account/uploads/${videoId}?/deleteVideo`, {
                                method: 'POST',
                                body: formData
                            });
                            if (response.ok) {
                                await invalidateAll();
                                goto('/account/uploads');
                            }
                        } catch (err) {
                            console.error('Error deleting video:', err);
                        }
                    }}
                >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                        <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                    Delete video
                </button>
            </div>
        {:else if activeTab === 'assets'}
            <div class="section">
                <h2 class="section-title">Video Preview</h2>
                <p class="section-description">Preview and technical information.</p>

                {#if videoUrl}
                    <div class="video-metadata-container">
                        <div class="video-preview-wrapper">
                            <video id="video-player" class="video-preview-compact" controls>
                                <source src={videoUrl} type="application/x-mpegURL" />
                                <track kind="captions" />
                            </video>
                            {#if downloadUrl}
                                <a href={downloadUrl} target="_blank" rel="noopener noreferrer" class="btn btn-secondary" style="margin-top: 1rem; display: inline-flex; align-items: center; gap: 0.5rem;">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                    </svg>
                                    Download original file
                                </a>
                            {/if}
                        </div>
                        <div class="video-metadata">
                            <div class="metadata-item">
                                <span class="metadata-label">Duration</span>
                                <span class="metadata-value">{Math.floor(duration / 60)}:{String(duration % 60).padStart(2, '0')}</span>
                            </div>
                            <div class="metadata-item">
                                <span class="metadata-label">Aspect Ratio</span>
                                <span class="metadata-value">{aspectRatio || 'Unknown'}</span>
                            </div>
                            <div class="metadata-item">
                                <span class="metadata-label">Format</span>
                                <span class="metadata-value">{format ? format.toUpperCase() : 'Unknown'}</span>
                            </div>
                            <div class="metadata-item">
                                <span class="metadata-label">Created</span>
                                <span class="metadata-value">{formatDateTime(createdAtRaw)}</span>
                            </div>
                            <div class="metadata-item">
                                <span class="metadata-label">Uploaded</span>
                                <span class="metadata-value">{formatDateTime(uploadedAtRaw)}</span>
                            </div>
                        </div>
                    </div>
                {/if}

                <div class="replace-video-card">
                    <div class="replace-video-header">
                        <div>
                            <h3 class="replace-video-title">Replace source file</h3>
                            <p class="replace-video-description">Upload a new master file to swap the stream on Bunny.</p>
                        </div>
                        <button
                            type="button"
                            class="btn btn-secondary replace-video-button"
                            onclick={triggerReplaceFileDialog}
                            disabled={replaceStatus === 'uploading' || replaceStatus === 'creating'}
                        >
                            {#if replaceStatus === 'uploading'}
                                <div class="spinner"></div>
                                <span>Uploading...</span>
                            {:else if replaceStatus === 'creating'}
                                <div class="spinner"></div>
                                <span>Preparing...</span>
                            {:else}
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                                    <path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                                </svg>
                                <span>Replace video</span>
                            {/if}
                        </button>
                        <input
                            type="file"
                            accept="video/*"
                            class="replace-video-input"
                            bind:this={replaceFileInput}
                            onchange={handleReplaceFileChange}
                        />
                    </div>

                    {#if replaceStatus === 'uploading' || replaceStatus === 'creating'}
                        <div class="replace-progress">
                            <div
                                class="replace-progress-bar"
                                style={`width: ${replaceProgress}%`}
                            ></div>
                        </div>
                        <div class="replace-progress-meta">
                            <span>{replaceProgress}%</span>
                            <span>{formatBytes(replaceBytesUploaded)} / {formatBytes(replaceBytesTotal)}</span>
                        </div>
                    {/if}

                    {#if replaceStatus === 'success'}
                        <p class="replace-status success">New stream URL saved. Regenerate thumbnails to match the replacement.</p>
                    {:else if replaceStatus === 'error' && replaceError}
                        <p class="replace-status error">{replaceError}</p>
                    {/if}
                </div>
            </div>

            <div class="section">
                <h2 class="section-title">Thumbnail</h2>
                <p class="section-description">Select or generate a thumbnail for your video.</p>

                <div class="thumbnail-section">
                    <!-- <div class="current-thumbnail-container">
                        <p class="thumbnail-label">Current Thumbnail</p>
                        {#if selectedThumbnail}
                            <img src={selectedThumbnail} alt="Current Thumbnail" class="current-thumbnail" />
                        {:else}
                            <div class="thumbnail-placeholder">
                                <p>No thumbnail selected</p>
                            </div>
                        {/if}
                    </div> -->
<!-- 
                    {#if thumbnailError}
                        <div class="thumbnail-error">
                            <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
                                <circle cx="10" cy="10" r="8" stroke="currentColor" stroke-width="2" />
                                <path d="M10 6v4M10 14h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
                            </svg>
                            <span>{thumbnailError}</span>
                        </div>
                    {/if} -->

                    {#if thumbnails.length > 0}
                        <div class="thumbnail-grid">
                            <p class="thumbnail-label">Select a Thumbnail</p>
                            <div class="thumbnail-options">
                                {#each thumbnails as thumb}
                                    <button
                                        type="button"
                                        class="thumbnail-option"
                                        class:selected={selectedThumbnail === thumb}
                                        class:updating={isUpdatingThumbnail && selectedThumbnail === thumb}
                                        onclick={() => selectThumbnail(thumb)}
                                        disabled={isUpdatingThumbnail}
                                    >
                                        <img src={thumb} alt="Thumbnail option" />
                                        {#if isUpdatingThumbnail && selectedThumbnail === thumb}
                                            <div class="thumbnail-loading">
                                                <div class="spinner"></div>
                                            </div>
                                        {:else if selectedThumbnail === thumb}
                                            <div class="thumbnail-checkmark">
                                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                                                    <circle cx="12" cy="12" r="10" fill="#5eead4"/>
                                                    <path d="M8 12l3 3 5-6" stroke="#0a0a0a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                                </svg>
                                            </div>
                                        {/if}
                                    </button>
                                {/each}
                            </div>
                        </div>
                    {:else}
                        <p class="empty-text">Thumbnails will be available after video processing is complete.</p>
                    {/if}
                </div>
            </div>
        {:else if activeTab === 'settings'}
            <div class="section">
                <h2 class="section-title">File Visibility</h2>
                <p class="section-description">Choose who can discover and watch this upload.</p>

                <div class="radio-group">
                    <label class="radio-option">
                        <input
                            type="radio"
                            class="radio-input"
                            value="public"
                            bind:group={visibility}
                        />
                        <div class="radio-content">
                            <span class="radio-title">Public</span>
                            <span class="radio-description">Listed everywhere. Anyone can watch and share.</span>
                        </div>
                    </label>
                    <label class="radio-option">
                        <input
                            type="radio"
                            class="radio-input"
                            value="unlisted"
                            bind:group={visibility}
                        />
                        <div class="radio-content">
                            <span class="radio-title">Unlisted</span>
                            <span class="radio-description">Hidden from browse pages. Only people with the link can watch.</span>
                        </div>
                    </label>
                    <label class="radio-option">
                        <input
                            type="radio"
                            class="radio-input"
                            value="private"
                            bind:group={visibility}
                        />
                        <div class="radio-content">
                            <span class="radio-title">Private</span>
                            <span class="radio-description">Visible only to you. Keep work-in-progress edits locked down.</span>
                        </div>
                    </label>
                </div>
            </div>

            <div class="section">
                <h2 class="section-title">Share Links</h2>
                <p class="section-description">Send collaborators straight to the viewing page.</p>

                <div class="share-link">
                    <input
                        type="text"
                        class="input share-link-input"
                        readonly
                        value={shareUrl}
                        aria-label="Direct share link"
                    />
                    <button
                        type="button"
                        class="btn btn-secondary share-link-action"
                        onclick={copyShareLink}
                        disabled={!shareUrl}
                    >
                        {#if copyFeedback === 'copied'}
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                                <path d="M20 6L9 17l-5-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                            </svg>
                            <span>Copied</span>
                        {:else if copyFeedback === 'error'}
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                                <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2" />
                                <path d="M12 8v4m0 4h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                            </svg>
                            <span>Copy failed</span>
                        {:else}
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                                <path d="M8 17a3 3 0 0 1 0-6h1" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                                <path d="M16 7a3 3 0 0 1 0 6h-1" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                                <path d="M9 11h6M15 13h-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                            </svg>
                            <span>Copy link</span>
                        {/if}
                    </button>
                </div>
                <p
                    class="share-link-feedback"
                    class:success={copyFeedback === 'copied'}
                    class:error={copyFeedback === 'error'}
                    aria-live="polite"
                >
                    {#if copyFeedback === 'copied'}
                        Link copied! Send it to anyone who should review.
                    {:else if copyFeedback === 'error'}
                        Unable to copy automatically. Highlight the link and copy it manually.
                    {:else if !shareUrl}
                        Share link becomes available once the video finishes processing.
                    {/if}
                </p>
            </div>

            <div class="section">
                <h2 class="section-title">Viewer Permissions</h2>
                <p class="section-description">Fine-tune collaboration options without leaving the editor.</p>

                <div class="settings-toggle-list">
                    <label class="settings-toggle">
                        <input type="checkbox" bind:checked={allowDownloads} />
                        <span class="toggle-indicator" aria-hidden="true"></span>
                        <span class="toggle-copy">
                            <span class="toggle-title">Allow downloads</span>
                            <span class="toggle-description">Let viewers grab the source file for offline edits.</span>
                        </span>
                    </label>
                    <label class="settings-toggle">
                        <input type="checkbox" bind:checked={allowEmbedding} />
                        <span class="toggle-indicator" aria-hidden="true"></span>
                        <span class="toggle-copy">
                            <span class="toggle-title">Allow embedding</span>
                            <span class="toggle-description">Permit this video to appear on shared playlists and external sites.</span>
                        </span>
                    </label>
                </div>
            </div>
        {:else if activeTab === 'analysis'}
            <div class="section">
                <h2 class="section-title">AI Analysis</h2>
                <p class="section-description">Automated analysis of video content.</p>

                <div class="analysis-item">
                    <h3 class="analysis-label">Transcript</h3>
                    <div class="analysis-content">
                        <p class="analysis-text">Transcript not available yet.</p>
                    </div>
                </div>

                <div class="analysis-item">
                    <h3 class="analysis-label">Content Summary</h3>
                    <div class="analysis-content">
                        <p class="analysis-text">Summary will be generated after processing.</p>
                    </div>
                </div>

                <div class="analysis-item">
                    <h3 class="analysis-label">Detected Objects</h3>
                    <div class="analysis-content">
                        <p class="analysis-text">Object detection pending.</p>
                    </div>
                </div>
            </div>

            <div class="section">
                <h2 class="section-title">Embedding</h2>
                <p class="section-description">Vector embedding for similarity search.</p>

                <div class="analysis-item">
                    <h3 class="analysis-label">Embedding Status</h3>
                    <div class="analysis-content">
                        <p class="analysis-text">Embedding vector not yet generated.</p>
                    </div>
                </div>

                <div class="analysis-item">
                    <h3 class="analysis-label">Embedding Dimensions</h3>
                    <div class="analysis-content">
                        <p class="analysis-text">—</p>
                    </div>
                </div>
            </div>
        {/if}
    </form>
    
</div>
</div>

<style>
    .page {
        min-height: 100vh;
        background: rgba(0, 0, 0, 0.9);
        padding: 2rem;
        position: relative;
        overflow: hidden;
    }
    
    .page::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        width: 100%;
        height: 500px;
        background-image: var(--preview-bg-url, none);
        background-size: 100%;
        background-position: top;
        background-repeat: no-repeat;
        opacity: 0.1;
        z-index: 0;
        pointer-events: none;
        mask-image: linear-gradient(to bottom, black 0%, black 60%, transparent 100%);
        -webkit-mask-image: linear-gradient(to bottom, black 0%, black 60%, transparent 100%);
    }
    
    .page > * {
        position: relative;
        z-index: 1;
    }

    .header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 2rem;
    }

    .title-container {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        flex: 1;
    }

    .header h1 {
        font-size: 2rem;
        font-weight: 700;
        color: #fff;
        margin: 0;
    }

    .edit-title-btn {
        background: transparent;
        border: none;
        color: rgba(255, 255, 255, 0.4);
        cursor: pointer;
        padding: 0.5rem;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: color 0.2s;
    }

    .edit-title-btn:hover {
        color: #5eead4;
    }

    .title-input {
        flex: 1;
        font-size: 2rem;
        font-weight: 700;
        color: #fff;
        background: rgba(0, 0, 0, 0.6);
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
        border: 1px solid rgba(94, 234, 212, 0.3);
        padding: 0.5rem 0.75rem;
        font-family: inherit;
    }

    .title-input:focus {
        outline: none;
        border-color: rgba(94, 234, 212, 0.5);
        background: rgba(0, 0, 0, 0.7);
    }

    .alert {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        padding: 1rem;
        border: 1px solid;
        margin-bottom: 1.5rem;
        font-size: 0.875rem;
    }

    .alert-error {
        background: rgba(239, 68, 68, 0.1);
        border-color: rgba(239, 68, 68, 0.3);
        color: #fca5a5;
    }

    .alert-success {
        background: rgba(34, 197, 94, 0.1);
        border-color: rgba(34, 197, 94, 0.3);
        color: #86efac;
    }

    .tabs {
        display: flex;
        gap: 0.5rem;
        margin-bottom: 2rem;
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    }

    .tab {
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.75rem 1.5rem;
        background: transparent;
        border: none;
        border-bottom: 2px solid transparent;
        color: rgba(255, 255, 255, 0.5);
        font-size: 0.875rem;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s;
    }

    .tab:hover {
        color: rgba(255, 255, 255, 0.8);
    }

    .tab.active {
        color: #5eead4;
        border-bottom-color: #5eead4;
    }

    .content {
        max-width: 1000px;
    }

    .section {
        background: rgba(0, 0, 0, 0.6);
        backdrop-filter: blur(30px);
        -webkit-backdrop-filter: blur(30px);
        border: 1px solid rgba(255, 255, 255, 0.08);
        padding: 2rem;
        margin-bottom: 1.5rem;
        border-radius: 8px;
    }

    .section-title {
        font-size: 1.25rem;
        font-weight: 600;
        color: #fff;
        margin: 0 0 0.5rem 0;
    }

    .section-description {
        font-size: 0.875rem;
        color: rgba(255, 255, 255, 0.5);
        margin: 0 0 1.5rem 0;
    }

    .form-group {
        margin-bottom: 1.5rem;
    }

    .label {
        display: flex;
        justify-content: space-between;
        font-size: 0.875rem;
        font-weight: 500;
        color: #fff;
        margin-bottom: 0.5rem;
    }

    .meta {
        font-size: 0.8125rem;
        color: rgba(255, 255, 255, 0.4);
        font-weight: 400;
    }

    .meta.error {
        color: #fca5a5;
    }

    .input,
    .textarea {
        width: 100%;
        padding: 0.75rem;
        background: rgba(0, 0, 0, 0.6);
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
        border: 1px solid rgba(255, 255, 255, 0.1);
        color: #fff;
        font-size: 0.9375rem;
        font-family: inherit;
        transition: border-color 0.2s;
        outline: none;
    }

    .input:focus,
    .textarea:focus {
        border-color: rgba(94, 234, 212, 0.5);
    }

    .textarea {
        resize: vertical;
        line-height: 1.6;
    }

    .location-info {
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.5rem 0.875rem;
        background: rgba(94, 234, 212, 0.1);
        border: 1px solid rgba(94, 234, 212, 0.2);
        color: #5eead4;
        font-size: 0.8125rem;
        font-weight: 500;
        margin-top: 1rem;
    }

    .video-metadata-container {
        display: flex;
        gap: 2rem;
        align-items: flex-start;
    }

    .video-preview-wrapper {
        flex-shrink: 0;
    }

    .video-preview-compact {
        height: auto;
        width: 100%;
        background: #000;
        border: 1px solid rgba(255, 255, 255, 0.1);
    }

    .video-metadata {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 1rem;
        padding-top: 0.5rem;
    }

    .metadata-item {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
        padding: 0.75rem 0;
        border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    }

    .metadata-item:last-child {
        border-bottom: none;
    }

    .metadata-label {
        font-size: 0.875rem;
        font-weight: 600;
        color: rgba(255, 255, 255, 0.5);
        text-transform: uppercase;
        letter-spacing: 0.05em;
    }

    .metadata-value {
        font-size: 0.9375rem;
        color: rgba(255, 255, 255, 0.9);
        font-weight: 500;
        text-align: right;
    }

    .metadata-url {
        font-family: monospace;
        font-size: 0.8125rem;
        color: rgba(94, 234, 212, 0.8);
    }

    .metadata-link {
        color: #5eead4;
        font-size: 0.875rem;
        text-decoration: underline;
        text-decoration-color: rgba(94, 234, 212, 0.6);
        text-underline-offset: 0.2em;
    }

    .metadata-link:hover {
        color: #2dd4bf;
    }

    .thumbnail-section {
        display: flex;
        flex-direction: column;
        gap: 1.5rem;
    }

    .current-thumbnail-container {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
    }

    .thumbnail-label {
        font-size: 0.875rem;
        font-weight: 600;
        color: rgba(255, 255, 255, 0.7);
        margin: 0;
        text-transform: uppercase;
        letter-spacing: 0.05em;
    }

    .current-thumbnail {
        max-width: 320px;
        border: 2px solid rgba(94, 234, 212, 0.2);
    }

    .thumbnail-placeholder {
        max-width: 320px;
        height: 180px;
        background: rgba(0, 0, 0, 0.3);
        border: 1px solid rgba(255, 255, 255, 0.1);
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .thumbnail-placeholder p {
        color: rgba(255, 255, 255, 0.4);
        font-size: 0.875rem;
        margin: 0;
    }

    .thumbnail-actions {
        display: flex;
        gap: 0.75rem;
    }

    .thumbnail-error {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.75rem;
        background: rgba(239, 68, 68, 0.1);
        border: 1px solid rgba(239, 68, 68, 0.3);
        color: #fca5a5;
        font-size: 0.875rem;
    }

    .thumbnail-grid {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
    }

    .thumbnail-options {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
        gap: 1rem;
    }

    .thumbnail-option {
        position: relative;
        cursor: pointer;
        background: rgba(0, 0, 0, 0.3);
        border: 2px solid rgba(255, 255, 255, 0.1);
        padding: 0;
        overflow: hidden;
        transition: all 0.2s;
    }

    .thumbnail-option:hover {
        border-color: rgba(94, 234, 212, 0.4);
    }

    .thumbnail-option.selected {
        border-color: #5eead4;
        box-shadow: 0 0 0 2px rgba(94, 234, 212, 0.2);
    }

    .thumbnail-option img {
        width: 100%;
        height: auto;
        display: block;
    }

    .thumbnail-checkmark {
        position: absolute;
        top: 0.5rem;
        right: 0.5rem;
    }

    .thumbnail-loading {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: rgba(0, 0, 0, 0.8);
        padding: 0.5rem;
        border-radius: 50%;
    }

    .thumbnail-option:disabled {
        opacity: 0.6;
        cursor: not-allowed;
    }

    .thumbnail-option.updating {
        opacity: 0.7;
    }

    .empty-text {
        color: rgba(255, 255, 255, 0.5);
        font-size: 0.875rem;
    }

    .analysis-item {
        margin-bottom: 1.5rem;
    }

    .analysis-item:last-child {
        margin-bottom: 0;
    }

    .analysis-label {
        font-size: 0.875rem;
        font-weight: 600;
        color: rgba(255, 255, 255, 0.7);
        margin: 0 0 0.5rem 0;
        text-transform: uppercase;
        letter-spacing: 0.05em;
    }

    .analysis-content {
        background: rgba(0, 0, 0, 0.3);
        border: 1px solid rgba(255, 255, 255, 0.08);
        padding: 1rem;
    }

    .analysis-text {
        color: rgba(255, 255, 255, 0.8);
        font-size: 0.9375rem;
        line-height: 1.6;
        margin: 0;
    }

    .hint {
        font-size: 0.8125rem;
        color: rgba(255, 255, 255, 0.4);
        margin-top: 0.5rem;
    }

    .keywords-input-container {
        width: 100%;
    }

    .keywords-pills-input {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 0.5rem;
        width: 100%;
        min-height: 44px;
        padding: 0.5rem 0.75rem;
        background: rgba(0, 0, 0, 0.6);
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
        border: 1px solid rgba(255, 255, 255, 0.1);
        transition: border-color 0.2s;
        border-radius: 8px;
    }

    .keywords-pills-input:focus-within {
        border-color: rgba(94, 234, 212, 0.5);
    }

    .keyword-pill {
        display: inline-flex;
        align-items: center;
        gap: 0.25rem;
        padding: 0.375rem 0.625rem;
        background: rgba(94, 234, 212, 0.15);
        border: 1px solid rgba(94, 234, 212, 0.3);
        color: #5eead4;
        font-size: 0.8125rem;
        font-weight: 500;
        border-radius: 12px;
        white-space: nowrap;
    }

    .remove-pill {
        background: none;
        border: none;
        color: inherit;
        font-size: 1.125rem;
        line-height: 1;
        cursor: pointer;
        padding: 0;
        margin-left: 0.125rem;
        opacity: 0.7;
        transition: opacity 0.2s;
    }

    .remove-pill:hover {
        opacity: 1;
    }

    .keywords-text-input {
        flex: 1;
        min-width: 120px;
        background: transparent;
        border: none;
        color: #fff;
        font-size: 0.9375rem;
        font-family: inherit;
        padding: 0;
        outline: none !important;
        box-shadow: none !important;
        -webkit-appearance: none;
        -moz-appearance: none;
        appearance: none;
    }

    .keywords-text-input:focus {
        outline: none !important;
        box-shadow: none !important;
        border: none !important;
        -webkit-tap-highlight-color: transparent;
    }

    .keywords-text-input::placeholder {
        color: rgba(255, 255, 255, 0.3);
    }

    .radio-group {
        display: flex;
        flex-direction: column;
        gap: 1rem;
    }

    .radio-option {
        display: flex;
        align-items: flex-start;
        gap: 1rem;
        padding: 1rem 1.25rem;
        background: rgba(0, 0, 0, 0.5);
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
        border: 1px solid rgba(255, 255, 255, 0.08);
        cursor: pointer;
        transition: border-color 0.2s, background 0.2s;
        border-radius: 6px;
    }

    .radio-option:hover {
        border-color: rgba(94, 234, 212, 0.4);
        background: rgba(0, 0, 0, 0.65);
    }

    .radio-input {
        margin-top: 0.25rem;
        accent-color: #5eead4;
    }

    .radio-content {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
    }

    .radio-title {
        font-size: 0.9375rem;
        font-weight: 600;
        color: #fff;
    }

    .radio-description {
        font-size: 0.875rem;
        color: rgba(255, 255, 255, 0.6);
        line-height: 1.4;
    }

    .share-link {
        display: flex;
        align-items: center;
        gap: 0.75rem;
    }

    .share-link-input {
        flex: 1;
        min-width: 0;
    }

    .share-link-action {
        white-space: nowrap;
    }

    .share-link-feedback {
        font-size: 0.8125rem;
        color: rgba(255, 255, 255, 0.5);
        margin-top: 0.75rem;
        min-height: 1.25rem;
    }

    .share-link-feedback.success {
        color: #86efac;
    }

    .share-link-feedback.error {
        color: #fca5a5;
    }

    .replace-video-input {
        position: absolute;
        width: 1px;
        height: 1px;
        padding: 0;
        margin: -1px;
        overflow: hidden;
        clip: rect(0, 0, 0, 0);
        white-space: nowrap;
        border: 0;
    }

    .replace-video-card {
        margin-top: 1.5rem;
        background: rgba(0, 0, 0, 0.25);
        border: 1px solid rgba(255, 255, 255, 0.08);
        padding: 1.5rem;
        display: flex;
        flex-direction: column;
        gap: 1rem;
    }

    .replace-video-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
        flex-wrap: wrap;
    }

    .replace-video-title {
        margin: 0;
        font-size: 1rem;
        font-weight: 600;
        color: #fff;
    }

    .replace-video-description {
        margin: 0.25rem 0 0 0;
        font-size: 0.875rem;
        color: rgba(255, 255, 255, 0.6);
    }

    .replace-video-button {
        flex-shrink: 0;
    }

    .replace-progress {
        position: relative;
        width: 100%;
        height: 8px;
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.08);
        overflow: hidden;
    }

    .replace-progress-bar {
        position: absolute;
        top: 0;
        left: 0;
        bottom: 0;
        background: #5eead4;
        transition: width 0.2s ease;
    }

    .replace-progress-meta {
        display: flex;
        justify-content: space-between;
        font-size: 0.8125rem;
        color: rgba(255, 255, 255, 0.5);
    }

    .replace-status {
        font-size: 0.85rem;
    }

    .replace-status.success {
        color: #86efac;
    }

    .replace-status.error {
        color: #fca5a5;
    }

    .settings-toggle-list {
        display: flex;
        flex-direction: column;
        gap: 1rem;
    }

    .settings-toggle {
        position: relative;
        display: flex;
        align-items: center;
        gap: 1rem;
        padding: 1rem 1.25rem;
        background: rgba(0, 0, 0, 0.25);
        border: 1px solid rgba(255, 255, 255, 0.08);
        cursor: pointer;
        transition: border-color 0.2s, background 0.2s;
    }

    .settings-toggle:hover {
        border-color: rgba(94, 234, 212, 0.4);
        background: rgba(94, 234, 212, 0.08);
    }

    .settings-toggle input {
        position: absolute;
        opacity: 0;
        pointer-events: none;
    }

    .toggle-indicator {
        position: relative;
        width: 46px;
        height: 24px;
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.12);
        border: 1px solid rgba(255, 255, 255, 0.22);
        transition: background 0.2s, border-color 0.2s;
        flex-shrink: 0;
    }

    .toggle-indicator::after {
        content: '';
        position: absolute;
        top: 50%;
        left: 4px;
        width: 16px;
        height: 16px;
        border-radius: 999px;
        background: #fff;
        transform: translate(0, -50%);
        transition: transform 0.2s ease;
    }

    .settings-toggle input:checked + .toggle-indicator {
        background: rgba(94, 234, 212, 0.25);
        border-color: rgba(94, 234, 212, 0.6);
    }

    .settings-toggle input:checked + .toggle-indicator::after {
        transform: translate(18px, -50%);
        background: #5eead4;
    }

    .settings-toggle input:focus-visible + .toggle-indicator {
        box-shadow: 0 0 0 3px rgba(94, 234, 212, 0.45);
    }

    .toggle-copy {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
    }

    .toggle-title {
        font-size: 0.9375rem;
        font-weight: 600;
        color: #fff;
    }

    .toggle-description {
        font-size: 0.875rem;
        color: rgba(255, 255, 255, 0.6);
        line-height: 1.4;
    }

    .form-actions {
        display: flex;
        justify-content: flex-end;
        gap: 1rem;
        align-items: center;
        padding-top: 0rem;
    }

    .btn {
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.75rem 1.5rem;
        border: 1px solid;
        font-size: 0.875rem;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s;
        text-decoration: none;
    }

    .btn-primary {
        background: #5eead4;
        border-color: #5eead4;
        color: #0a0a0a;
    }

    .btn-primary:hover:not(:disabled) {
        background: #2dd4bf;
    }

    .btn-primary:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }

    .btn-secondary {
        background: transparent;
        border-color: rgba(255, 255, 255, 0.2);
        color: rgba(255, 255, 255, 0.8);
    }

    .btn-secondary:hover {
        background: rgba(255, 255, 255, 0.05);
    }

    .spinner {
        width: 1rem;
        height: 1rem;
        border: 2px solid rgba(255, 255, 255, 0.2);
        border-top-color: currentColor;
        border-radius: 50%;
        animation: spin 0.8s linear infinite;
    }

    @keyframes spin {
        to { transform: rotate(360deg); }
    }

    @media (max-width: 768px) {
        .page { padding: 1rem; }
        .header { flex-direction: column; align-items: flex-start; gap: 1rem; }
        .section { padding: 1.5rem; }
        .btn { width: 100%; }
        .video-metadata-container { flex-direction: column; }
        .video-preview-compact { width: 100%; height: auto; }
    }
</style>
