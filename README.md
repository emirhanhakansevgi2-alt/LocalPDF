# LocalPDF

AI-free, private and local PDF summarization.

**"Your PDF never leaves your computer."**

PDF → Local Processing → Classical NLP (TF-IDF + TextRank) → Summary.
Hiçbir aşamada AI/LLM/API çağrısı **yoktur**. Kodda `fetch("https://api.openai...")` gibi hiçbir çağrı bulamazsın.

## Features

* AI-free summarization (extractive — cümle uydurmaz)
* Local processing (PDF.js + vanilla JS, Web Worker destekli)
* Turkish support + English support (otomatik dil algılama, genişletilebilir mimari)
* TF-IDF, TextRank, cosine similarity, sentence scoring, keyword frequency, position, title similarity, paragraph importance, duplicate detection
* Short / Medium / Long + Bullet Points
* Section summaries, Keywords, Page references `[Page N]`
* Statistics: pages, words, characters, paragraphs, sentences, reading time, compression
* Export: TXT, Markdown, JSON, PDF (print)
* Copy: summary / keywords / full analysis
* Dark mode (localStorage)
* Drag & drop, responsive, keyboard shortcuts

## Desteklenen formatlar

✅ `.pdf` `.docx` `.txt` `.md` `.html` (UTF-8; diğer kodlamalar tarayıcı decodera emanet)
❌ `.zip` / klasör — güvenlik + kapsam gereği **okunmaz**, anlaşılır hata verilir.

## Çalıştırma

Kurulum gerekmez (statik site, GitHub Pages uyumlu).

* Kolay: `calistir.bat` → `index.html` açılır.
* Önerilen: `sunucu.bat` → http://localhost:8000 (Worker/DOCX daha sağlıklı).
* Manuel: `python -m http.server 8000` sonra tarayıcıda `http://localhost:8000`.
* GitHub Pages: bu repo'yu pushla → Settings → Pages → Deploy from branch.

## Test

`test/test-summarizer.js` klasik motoru Node ile doğrular:

```
node test/test-summarizer.js
```

## Dil

Site tek dillidir: **Türkçe**. Dil seçici kaldırıldı, tüm arayüz, hata mesajları,
istatistikler ve dışa aktarma çıktıları Türkçedir. (Belge özetleme motoru Türkçe
ağırlıklı çalışır; İngilizce belgeler de okunur, sonuç ekranında dil rozeti gösterilir.)

Eski sürümdeki algılama hatası da düzeltildi: `ve`/`bir` artık kelime sınırlı
(`\bve\b`) aranıyor — İngilizce `have`, `never`, `level` içindeki "ve" yüzünden
yanlış dil algılama bitti. Belge dili istenirse elle de seçilebiliyor.

## 🤖 Kendi AI'ına Bağla: Token Düşürme Rehberi

Eğer bu sistemi **kendi yapay zekânda token harcamasını düşürmek için** kullanmak
istiyorsan, LocalPDF'yi AI'ına **ön filtre** olarak entegre et:

1. Belgeyi yerelde özetle → **0 token** (`extractor.extract` + `summarize(pages, {mode:"short"})`)
2. En iyi **K cümleyi** al (öneri: K=5-8; 8.000 kelime → ~250 token)
3. AI'a **sadece bu cümleleri** gönder, prompt'u kilitle ("sadece bunları kullan, uydurma")
4. Cevabı sayfa numaralarıyla göster, keywords'i bedava bağlam olarak ekle

Sonuç: tüm PDF (~10.400 token) yerine ~250 token → **~%97 tasarruf**.
Tam adımlar, JS + Python kod örnekleri, token tablosu ve prompt şablonu:
**`docs/AI-ENTEGRASYON.md`**. Sitedeki AI kartı bu akışın canlı demosudur
(K seçer, token tahminini gösterir, tek tıkla senin endpoint'ine gönderir —
varsayılan kapalı, Refine'e basmadan ağ çağrısı yok).

Mimari ileride OCR (Tesseract.js) eklenebilecek şekilde hazırdır (`src/pdf/parser.js`).

## Demo

[Live Demo] — GitHub Pages URL'ini buraya yapıştır.

## License

MIT
