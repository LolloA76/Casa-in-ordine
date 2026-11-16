# Componenti locali

- PDF.js / pdfjs-dist 4.10.38: Apache-2.0. Copia locale dei moduli, worker, CMap e font standard; licenze nei rispettivi percorsi.
- Tesseract.js 6.0.1: Apache-2.0. Worker e build ESM locali, avvisi di terze parti inclusi.
- tesseract.js-core: versione installata nel lockfile di sviluppo riportata sotto; Apache-2.0. Build LSTM con e senza SIMD.
- Modelli ita, deu, fra, eng: tesseract-ocr/tessdata_fast, Apache-2.0; copie locali scaricate da raw.githubusercontent.com/tesseract-ocr/tessdata_fast/main/. Le impronte dei file sono registrate in SHA256SUMS.

Nessuna richiesta a CDN o servizi OCR remoti è necessaria durante l’elaborazione. Gli URL upstream nei sorgenti delle librerie non sono destinazioni di upload dei documenti.

Versione tesseract.js-core vendorizzata: 6.1.2
