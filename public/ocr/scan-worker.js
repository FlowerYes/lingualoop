/* global importScripts, Tesseract */
// This worker owns the OCR worker. Terminating it also terminates child workers,
// including when the model is still being initialized.
importScripts('/ocr/tesseract.min.js');

self.onmessage = async ({ data: { image } }) => {
  let worker;
  try {
    worker = await Tesseract.createWorker('spa', Tesseract.OEM.LSTM_ONLY, {
      workerPath: `${self.location.origin}/ocr/worker.min.js`,
      corePath: `${self.location.origin}/ocr`,
      langPath: `${self.location.origin}/ocr`,
      workerBlobURL: false,
      gzip: false,
      logger: ({ status, progress }) => self.postMessage({ type: 'progress', progress: { status, progress } }),
      errorHandler: () => self.postMessage({ type: 'error' }),
    });
    await worker.setParameters({ tessedit_pageseg_mode: Tesseract.PSM.SPARSE_TEXT });
    const { data } = await worker.recognize(image, {}, { text: true, blocks: true });
    const words = [];
    // Sparse-text OCR can mistake clothing and scenery for letters. Keep confident
    // lexical words, including accents, numbers and punctuation attached to them.
    const text = (data.blocks || []).flatMap((block) => block.paragraphs.flatMap((paragraph) =>
      paragraph.lines,
    )).map((line) => {
      const lineWords = line.words.filter((word) =>
        Number.isFinite(word.confidence) && word.confidence >= 60 && /[\p{L}\p{N}]/u.test(word.text),
      ).slice(0, 500 - words.length)
        .map(({ text, confidence, bbox }) => ({ text: text.trim(), confidence, bbox }));
      words.push(...lineWords);
      return lineWords.map((word) => word.text).join(' ');
    }).filter(Boolean).join('\n').slice(0, 12000);
    // Use the same retained words for copied text and overlay boxes.
    self.postMessage({ type: 'result', result: { text, words } });
  } catch {
    self.postMessage({ type: 'error' });
  } finally {
    await worker?.terminate();
  }
};
