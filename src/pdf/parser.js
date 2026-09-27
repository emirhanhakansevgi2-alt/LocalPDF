/* parser.js — PDF.js wrapper entry (ayrıştırma extractor.js'tedir, mimari OCR/tab­lo genişlemesine hazır) */
(function(){
  // Gelecek: OCR (Tesseract.js), tablo algılama, grafik/metin ayrıştırma buraya eklenecek.
  // Şimdilik extractor.js bu modülü kullanır; dosya modülerlik kuralı için korunur.
  window.LocalPDF = window.LocalPDF || {};
  window.LocalPDF.parser = { version: "1.0-ai-free", ocrReady: false };
})();
