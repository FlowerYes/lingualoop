export interface ScanWord {
  text: string;
  confidence: number;
  bbox: { x0: number; y0: number; x1: number; y1: number };
}

export interface ScanResult {
  text: string;
  words: ScanWord[];
}

export interface ScanProgress {
  status: string;
  progress: number;
}

/** The owning worker also owns Tesseract's child worker, so abort stops initialization too. */
export function scanFrame(
  image: string,
  signal: AbortSignal,
  onProgress: (progress: ScanProgress) => void,
): Promise<ScanResult> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException('Scan cancelled', 'AbortError'));
      return;
    }
    // Only a captured in-memory frame is accepted; an OCR request cannot fetch an arbitrary URL.
    if (!/^data:image\/(?:jpeg|png|webp);base64,/.test(image) || image.length > 16_000_000) {
      reject(new Error('This frame could not be read. Return to the video and try another frame.'));
      return;
    }
    const worker = new Worker('/ocr/scan-worker.js');
    const finish = () => {
      clearTimeout(timeout);
      signal.removeEventListener('abort', abort);
      worker.terminate();
    };
    const abort = () => {
      finish();
      reject(new DOMException('Scan cancelled', 'AbortError'));
    };
    const timeout = setTimeout(() => {
      finish();
      reject(new Error('Scanning took too long. Please try again.'));
    }, 90_000);
    signal.addEventListener('abort', abort, { once: true });
    worker.onmessage = ({ data }) => {
      if (data.type === 'progress') onProgress(data.progress);
      else if (data.type === 'result') {
        finish();
        resolve(data.result as ScanResult);
      } else if (data.type === 'error') {
        finish();
        reject(new Error('Text scanning could not start. Check your connection and try again.'));
      }
    };
    worker.onerror = () => {
      finish();
      reject(new Error('Text scanning could not start. Please try again.'));
    };
    worker.postMessage({ image });
  });
}
