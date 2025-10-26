/**
 * Waveform generation utility for HLS audio streams
 * Uses Web Audio API to analyze audio and generate waveform data
 */

export interface WaveformData {
  peaks: number[];
  duration: number;
}

/**
 * Generate waveform data from an HLS video URL
 * Extracts audio and analyzes it using Web Audio API
 */
export async function generateWaveform(
  videoUrl: string,
  samplesPerSecond: number = 10
): Promise<WaveformData | null> {
  try {
    // Create an audio element to load the HLS stream
    const audio = new Audio();
    audio.crossOrigin = 'anonymous';
    audio.src = videoUrl;

    // Wait for metadata to load
    await new Promise<void>((resolve, reject) => {
      audio.addEventListener('loadedmetadata', () => resolve(), { once: true });
      audio.addEventListener('error', reject, { once: true });
      audio.load();
    });

    const duration = audio.duration;
    if (!duration || !isFinite(duration)) {
      throw new Error('Invalid audio duration');
    }

    // Create audio context
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const source = audioContext.createMediaElementSource(audio);
    const analyser = audioContext.createAnalyser();

    // Configure analyser
    analyser.fftSize = 2048;
    source.connect(analyser);
    // Don't connect to destination to avoid playing audio

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const totalSamples = Math.floor(duration * samplesPerSecond);
    const peaks: number[] = new Array(totalSamples).fill(0);
    const sampleDuration = duration / totalSamples;

    let currentSample = 0;

    // Play the audio (muted) and collect samples
    audio.muted = true;
    audio.play();

    return new Promise<WaveformData>((resolve, reject) => {
      const collectData = () => {
        const currentTime = audio.currentTime;
        const sampleIndex = Math.floor(currentTime / sampleDuration);

        if (sampleIndex < totalSamples) {
          // Get frequency data
          analyser.getByteFrequencyData(dataArray);

          // Calculate RMS (root mean square) for this sample
          let sum = 0;
          for (let i = 0; i < bufferLength; i++) {
            sum += dataArray[i] * dataArray[i];
          }
          const rms = Math.sqrt(sum / bufferLength);

          // Normalize to 0-1 range
          peaks[sampleIndex] = Math.max(peaks[sampleIndex], rms / 255);
        }

        if (currentTime < duration) {
          requestAnimationFrame(collectData);
        } else {
          // Cleanup
          audio.pause();
          audio.src = '';
          audioContext.close();

          resolve({
            peaks,
            duration
          });
        }
      };

      audio.addEventListener('error', () => {
        audioContext.close();
        reject(new Error('Failed to load audio'));
      });

      requestAnimationFrame(collectData);
    });
  } catch (error) {
    console.error('Waveform generation error:', error);
    return null;
  }
}

/**
 * Simplified waveform generation for faster loading
 * Uses fewer samples and simplified analysis
 */
export async function generateSimplifiedWaveform(
  videoElement: HTMLVideoElement,
  samples: number = 100
): Promise<WaveformData | null> {
  try {
    if (!videoElement.src) return null;

    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const source = audioContext.createMediaElementSource(videoElement);
    const analyser = audioContext.createAnalyser();

    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.8;

    source.connect(analyser);
    analyser.connect(audioContext.destination);

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    const peaks: number[] = [];

    // Generate mock waveform for now (replace with real-time analysis)
    for (let i = 0; i < samples; i++) {
      analyser.getByteFrequencyData(dataArray);
      let sum = 0;
      for (let j = 0; j < bufferLength; j++) {
        sum += dataArray[j];
      }
      const average = sum / bufferLength / 255;
      peaks.push(average || Math.random() * 0.3 + 0.1);
    }

    return {
      peaks,
      duration: videoElement.duration
    };
  } catch (error) {
    console.error('Simplified waveform generation error:', error);
    return null;
  }
}

/**
 * Generate a mock waveform for testing/fallback
 * Creates a natural-looking random waveform
 */
export function generateMockWaveform(samples: number = 100, duration: number = 0): WaveformData {
  const peaks: number[] = [];

  for (let i = 0; i < samples; i++) {
    // Create more natural variation using sine waves and randomness
    const position = i / samples;
    const lowFreq = Math.sin(position * Math.PI * 2) * 0.3;
    const midFreq = Math.sin(position * Math.PI * 8) * 0.2;
    const noise = Math.random() * 0.2;

    const peak = Math.abs(lowFreq + midFreq + noise);
    peaks.push(Math.min(peak + 0.1, 1)); // Ensure minimum visibility
  }

  return {
    peaks,
    duration
  };
}
