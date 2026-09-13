# Local OCR runtime

Tesseract.js 7.0.0 and tesseract.js-core 7.0.0 from their official npm packages.
Spanish LSTM model: https://raw.githubusercontent.com/tesseract-ocr/tessdata_fast/4.1.0/spa.traineddata

The three LSTM core variants support standard, SIMD, and relaxed SIMD devices. Each `.wasm.js` embeds its WASM binary. Only the selected variant is requested. No legacy recognition core is used. All assets are served from this app; scanning makes no external service request. The outer scan worker owns Tesseract's child worker and is terminated on close, timeout, error, or completion.

The approximately 14 MB checked-in payload is lazy loaded only on the first scan. A device loads one core (approximately 3.9 MB), the Spanish model (approximately 2.3 MB), and approximately 175 KB of worker/API JavaScript. Tesseract caches the Spanish model locally in IndexedDB.

Licenses are included alongside the runtime. To upgrade, update the npm dependency and replace the copied distribution, core, and license files together. The model is pinned separately.

SHA-256 of bundled upstream assets:

```
cfc7749b96f63bd31c3c42b5c471bf756814053e847c10f3eb003417bc523d30  TESSDATA-LICENSE.txt
c6596eb7be8581c18be736c846fb9173b69eccf6ef94c5135893ec56bd92ba08  TESSERACT-CORE-LICENSE.txt
b40930bbcf80744c86c46a12bc9da056641d722716c378f5659b9e555ef833e1  TESSERACT-JS-LICENSE.txt
6f2e04d02774a18f01bed44b1111f2cd7f3ba7ac9dc4373cd3f898a40ea6b464  spa.traineddata
eef5f8b2f8e20e150680b20adaec4a60babafee3adbe8a94583c81fee46e8680  tesseract-core-lstm.wasm.js
861a536cf9ef8e63cb644d57bab39c388f37f7d6b6f60024b741c5f6b39a59b3  tesseract-core-relaxedsimd-lstm.wasm.js
c58b46a4c796c0b8afccf77591d5b875b6896b45d402bbce8caa6f5362447b38  tesseract-core-simd-lstm.wasm.js
000c27d9cd0def655f77b36c72a389c0ab13793aa31cb4d7aab56d09c0afbc7e  tesseract.min.js
cdf963ced7d25a0f98901a547647b4d6e2dbe0197fd78c87a059a87b0e542fe2  tesseract.min.js.LICENSE.txt
576b7df7e3393e137e51849357c9adb53fe7ac1bb69bfa06cf3d61520f182c6d  worker.min.js
45f54171aeaa1d10c0c1a66f374b7bba1f02472b1487fbe892eec04f840002ac  worker.min.js.LICENSE.txt
```
