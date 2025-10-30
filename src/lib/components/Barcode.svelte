<script lang="ts">
    let videoElement: HTMLVideoElement | null = null;
    let barcodeCanvas: HTMLCanvasElement | null = null;

    let isProcessing = false;
    let progress = 0;
    let barcodeDataUrl: string | null = null; // This will hold the final image data

    // These dimensions control the final barcode image
    const BARCODE_WIDTH = 1200; // The number of "slices" to take
    const BARCODE_HEIGHT = 200; // The height of the final image

    async function handleFileSelect(event: Event) {
        const input = event.currentTarget as HTMLInputElement | null;
        const file = input?.files?.[0];
        if (!file) return;

        isProcessing = true;
        progress = 0;
        barcodeDataUrl = null;

        // Clean up any previous object URL
        if (videoElement?.src) {
            URL.revokeObjectURL(videoElement.src);
        }

        // Load the video file into the hidden <video> element
        const fileURL = URL.createObjectURL(file);
        if (videoElement) {
            videoElement.src = fileURL;
        }

        // The 'loadedmetadata' event will fire, triggering generateBarcode()
    }

    /**
     * Helper function to wait for the video to seek to a new time.
     * We wrap this in a Promise to use it with async/await.
     */
    function seekVideo(time: number) {
        const element = videoElement;
        if (!element) return Promise.reject(new Error('Video element not ready'));
        return new Promise((resolve, reject) => {
            // Set up event listeners *before* changing currentTime
            element.onseeked = () => resolve(true);
            element.onerror = (e) => reject(e);

            element.currentTime = time;
        });
    }

    /**
     * This function runs once the video's duration and dimensions are known.
     */
    async function generateBarcode() {
        const element = videoElement;
        const canvas = barcodeCanvas;
        if (!element || !canvas) return;
        console.log("Video metadata loaded. Starting barcode generation...");

        const duration = element.duration;
        const videoWidth = element.videoWidth;
        const videoHeight = element.videoHeight;

        // 1. Set up the final canvas
        canvas.width = BARCODE_WIDTH;
        canvas.height = BARCODE_HEIGHT;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
            console.error('Unable to get barcode canvas context');
            isProcessing = false;
            return;
        }

        // 2. Create a hidden, in-memory canvas to draw full frames
        const tempCanvas = document.createElement("canvas");
        tempCanvas.width = videoWidth;
        tempCanvas.height = videoHeight;
        const tempCtx = tempCanvas.getContext("2d");
        if (!tempCtx) {
            console.error('Unable to get temp canvas context');
            isProcessing = false;
            return;
        }

        const interval = duration / BARCODE_WIDTH;

        // 3. Loop through, seeking and sampling
        for (let i = 0; i < BARCODE_WIDTH; i++) {
            const time = i * interval;

            try {
                await seekVideo(time);

                // Draw the full video frame onto the temporary canvas
                tempCtx.drawImage(element, 0, 0, videoWidth, videoHeight);

                // Draw a 1px slice from the *center* of the temp canvas
                // onto the final barcode canvas.
                // We stretch the slice's height to fit our barcode height.
                ctx.drawImage(
                    tempCanvas, // Source canvas
                    videoWidth / 2,
                    0, // Source (x, y) - from center
                    1,
                    videoHeight, // Source (width, height) - 1px wide slice
                    i,
                    0, // Destination (x, y) - at column 'i'
                    1,
                    BARCODE_HEIGHT, // Destination (width, height) - 1px wide, stretched
                );
            } catch (error) {
                console.error("Error seeking or drawing frame:", error);
                // Continue to the next frame
            }

            // Update progress
            progress = (i / BARCODE_WIDTH) * 100;
        }

        // 4. Done. Export the final canvas to an image.
        console.log("Barcode generation complete.");
        isProcessing = false;
        progress = 100;
        barcodeDataUrl = canvas.toDataURL("image/png");

        // Clean up the object URL to free memory
        if (element.src) {
            URL.revokeObjectURL(element.src);
            element.src = "";
        }
    }
</script>

<div class="barcode-generator">
    <h2>Movie Barcode Generator (In-Browser)</h2>
    <p>Select a video file. Processing happens entirely on your computer.</p>

    <input
        type="file"
        accept="video/mp4,video/webm,video/ogg"
        on:change={handleFileSelect}
        disabled={isProcessing}
    />

    {#if isProcessing}
        <div class="progress-bar">
            <p>Processing... {Math.round(progress)}%</p>
            <progress value={progress} max="100"></progress>
        </div>
    {/if}

    {#if barcodeDataUrl}
        <div class="result">
            <h3>Your Barcode:</h3>
            <img src={barcodeDataUrl} alt="Movie Barcode" />
            <a
                href={barcodeDataUrl}
                download="movie-barcode.png"
                class="download-btn"
            >
                Download Barcode
            </a>
        </div>
    {/if}
</div>

<video
    bind:this={videoElement}
    on:loadedmetadata={generateBarcode}
    style="display: none;"
    muted
    preload="auto"
></video>

<canvas bind:this={barcodeCanvas} style="display: none;"></canvas>

<style>
    .barcode-generator {
        font-family: sans-serif;
        max-width: 800px;
        margin: 2em auto;
        padding: 1em;
        border: 1px solid #ccc;
        border-radius: 8px;
    }
    input[type="file"] {
        margin-bottom: 1em;
    }
    .progress-bar {
        margin: 1em 0;
    }
    progress {
        width: 100%;
    }
    .result img {
        width: 100%;
        height: auto;
        border: 1px solid #eee;
        margin-top: 1em;
    }
    .download-btn {
        display: inline-block;
        margin-top: 1em;
        padding: 0.8em 1.2em;
        background-color: #007bff;
        color: white;
        text-decoration: none;
        border-radius: 4px;
        font-weight: bold;
    }
    .download-btn:hover {
        background-color: #0056b3;
    }
</style>
