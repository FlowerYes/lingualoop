import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { scanFrame, type ScanResult, type ScanWord } from '../lib/scan';

const frame = 'data:image/jpeg;base64,aGVsbG8=';

class FakeWorker {
  static instances: FakeWorker[] = [];
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onerror: (() => void) | null = null;
  postMessage = vi.fn();
  terminate = vi.fn();
  constructor() {
    FakeWorker.instances.push(this);
  }
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  FakeWorker.instances = [];
});

describe('local frame scanning lifecycle', () => {
  it('rejects external images without creating a worker', async () => {
    vi.stubGlobal('Worker', FakeWorker);
    await expect(
      scanFrame('https://example.com/frame.jpg', new AbortController().signal, vi.fn()),
    ).rejects.toThrow('could not be read');
    expect(FakeWorker.instances).toHaveLength(0);
  });

  it('terminates a worker immediately when cancelled during initialization', async () => {
    vi.stubGlobal('Worker', FakeWorker);
    const abort = new AbortController();
    const pending = scanFrame(frame, abort.signal, vi.fn());
    const outcome = expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    abort.abort();
    await outcome;
    expect(FakeWorker.instances[0].terminate).toHaveBeenCalledOnce();
  });

  it('forwards progress and bounding boxes, then releases the worker', async () => {
    vi.stubGlobal('Worker', FakeWorker);
    const progress = vi.fn();
    const abort = new AbortController();
    const pending = scanFrame(frame, abort.signal, progress);
    const worker = FakeWorker.instances[0];
    worker.onmessage?.({
      data: { type: 'progress', progress: { status: 'recognizing text', progress: 0.5 } },
    });
    expect(progress).toHaveBeenCalledWith({ status: 'recognizing text', progress: 0.5 });
    const result = {
      text: 'café',
      words: [{ text: 'café', confidence: 97, bbox: { x0: 1, y0: 2, x1: 30, y1: 40 } }],
    };
    worker.onmessage?.({ data: { type: 'result', result } });
    expect(await pending).toEqual(result);
    abort.abort();
    expect(worker.terminate).toHaveBeenCalledOnce();
  });

  it('releases a stalled worker and returns a retryable timeout', async () => {
    vi.stubGlobal('Worker', FakeWorker);
    vi.useFakeTimers();
    const pending = scanFrame(frame, new AbortController().signal, vi.fn());
    const outcome = expect(pending).rejects.toThrow('took too long');
    await vi.advanceTimersByTimeAsync(90_000);
    await outcome;
    expect(FakeWorker.instances[0].terminate).toHaveBeenCalledOnce();
  });
});

const scannerSource = readFileSync(
  new URL('../public/ocr/scan-worker.js', import.meta.url),
  'utf8',
);
const word = (text: string, confidence: number): ScanWord => ({
  text,
  confidence,
  bbox: { x0: 1, y0: 2, x1: 30, y1: 40 },
});

async function recognize(lines: ScanWord[][], text: string) {
  const ocrWorker = {
    setParameters: vi.fn(),
    recognize: vi.fn().mockResolvedValue({
      data: {
        text,
        blocks: [{ paragraphs: [{ lines: lines.map((words) => ({ words })) }] }],
      },
    }),
    terminate: vi.fn(),
  };
  const createWorker = vi.fn().mockResolvedValue(ocrWorker);
  const self = {
    location: { origin: 'http://localhost:3000' },
    postMessage: vi.fn(),
    onmessage: null as null | ((event: { data: { image: string } }) => Promise<void>),
  };
  const importScripts = vi.fn();
  runInNewContext(scannerSource, {
    self,
    importScripts,
    Tesseract: { createWorker, OEM: { LSTM_ONLY: 1 }, PSM: { SPARSE_TEXT: 11 } },
  });
  await self.onmessage!({ data: { image: frame } });
  const message = self.postMessage.mock.calls.find(([message]) => message.type === 'result')?.[0];
  expect(message).toBeDefined();
  expect(importScripts).toHaveBeenCalledWith('/ocr/tesseract.min.js');
  expect(createWorker).toHaveBeenCalledWith(
    'spa',
    1,
    expect.objectContaining({
      workerPath: 'http://localhost:3000/ocr/worker.min.js',
      corePath: 'http://localhost:3000/ocr',
      langPath: 'http://localhost:3000/ocr',
      workerBlobURL: false,
    }),
  );
  expect(ocrWorker.terminate).toHaveBeenCalledOnce();
  return message.result as ScanResult;
}

describe('OCR result quality', () => {
  it('returns no text or boxes for low-confidence frame noise', async () => {
    const result = await recognize(
      [
        [word('<Q', 22), word('ca', 43), word('.Y', 37), word('A?', 59), word('y', 18)],
        [word('...', 98), word('   ', 99)],
      ],
      '<Q ca .Y A? y\n...',
    );
    expect(result).toEqual({ text: '', words: [] });
  });

  it('rebuilds readable lines from confident words, preserving accents and attached punctuation', async () => {
    const kept = [
      word('¡Café!', 97),
      word('y', 60),
      word('té,', 89),
      word('2', 95),
      word('tazas.', 90),
    ];
    const result = await recognize(
      [[kept[0], word('<Q', 22), kept[1], kept[2]], [word('.Y', 37)], [kept[3], kept[4]]],
      '¡Café! <Q y té,\n.Y\n2 tazas.',
    );
    expect(result).toEqual({ text: '¡Café! y té,\n2 tazas.', words: kept });
  });
});
