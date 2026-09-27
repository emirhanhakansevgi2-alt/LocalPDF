# Kendi Yapay Zekâna Bağla: Token Düşürme Rehberi

Bu doküman şunu anlatır: **LocalPDF'yi kendi yapay zekâna nasıl bağlarsın ve
token harcamanı nasıl ~%90-97 düşürürsün?** Kod örnekleri, maliyet tablosu,
hazır komut şablonları ve sık sorulan sorular dahildir.

---

## 1. Bu sistem tam olarak nedir?

LocalPDF, belgeyi **yapay zekâ kullanmadan** özetleyen bir **ön filtre motorudur**.
İçinde model dosyası, API anahtarı, dış servis, veri seti yoktur. Sadece klasik
matematik çalışır:

| Parça | Ne yapar |
|---|---|
| **TF-IDF** | Hangi kelime bu belgede gerçekten önemli, onu bulur ("ve", "bir" gibi boş kelimeleri eleyerek) |
| **TextRank** | Hangi cümle belgenin geri kalanıyla en bağlantılı, onu bulur (sayfa sıralaması algoritması) |
| **Cümle puanı** | TF-IDF + anahtar kelime + cümle konumu + başlık benzerliği + paragraf önemini toplar |
| **Tekrar eleme** | Birbirinin aynısı cümleleri tekler |
| **Sayfa referansı** | Seçilen her cümlenin hangi sayfadan geldiğini kaydeder |

Sonuç: **belgeden birebir seçilmiş, uydurulmamış cümleler + sayfa numaraları.**
Yeni cümle kurulmaz, bilgi uydurulmaz. Maliyeti sıfırdır (0 token), kotası yoktur,
internetsiz çalışır.

Yapay zekâlı düzendeki yeri şudur:

```
Belge → [LocalPDF: bedava ön eleme, 0 token] → [Yapay zekâ: sadece son dokunuş] → Cevap
```

Yapay zekâ pahalı ve kota sınırlı bir kaynaktır. LocalPDF **akıllı huni** görevi
görür: 10.000 tokenlik belgeyi 250 tokene indirir, yapay zekâ sadece küçük,
temizlenmiş parçayla uğraşır.

---

## 2. Yapay zekâ nasıl bağlanır?

### Yöntem A — Sitedeki hazır panel (en kolayı, kod yok)

1. Belgeyi yükle, özetin oluşmasını bekle.
2. Sayfadaki **"Kendi Yapay Zekâna Bağla"** kartına in.
3. `Yapay zekâ cilası` kutusunu işaretle, adres + model + API anahtarını yaz.
4. **K** sayısını seç (öneri: 8), **"Yapay zekâ ile cilala"** düğmesine bas.
5. Panel önce token tahminini gösterir (`~250 token gönderilir`), sonra cilalı özeti yazar.

Varsayılan kapalıdır; düğmeye basmadan hiçbir ağ isteği yapılmaz.

### Yöntem B — Kendi sitene/uygulamana göm (JavaScript)

LocalPDF çekirdeği sayfanda yüklüyse 3 satırda bağlanırsın:

```js
// 1. Belgeyi yerelde özetle (0 token)
const doc = await window.LocalPDF.extractor.extract(dosya, ilerlemeGoster);
const sonuc = window.LocalPDF.summarize(doc.pages, { mode: "short" });

// 2. En iyi K cümleyi al
const K = 8;
const baglam = sonuc.picked.slice(0, K)
  .map((c, i) => `${i + 1}. ${c.text}`).join("\n");

// 3. Yapay zekâya SADECE bu bağlamı gönder
const yanit = await fetch(SENIN_ADRESIN, {
  method: "POST",
  headers: { "Content-Type": "application/json", "Authorization": "Bearer " + ANAHTAR },
  body: JSON.stringify({
    model: "gpt-4o-mini",
    temperature: 0.2,
    max_tokens: 500,
    messages: [
      { role: "system", content: "Sadece verilen cümleleri kullan, yeni bilgi uydurma, sayfa numaralarını koru, en fazla 200 kelimeyle yanıtla." },
      { role: "user", content: "Bu cümlelere göre soruyu yanıtla:\n" + baglam + "\n\nSoru: " + kullaniciSorusu }
    ]
  })
}).then(r => r.json());
```

Sitedeki `js/ai.js` dosyası bu akışın hazır halidir — `buildMessages()` bağlamı
kurar, `refine()` isteği atar, `estimateTokens()` maliyeti önceden hesaplar.
Dosyayı kendi projenine kopyalayabilirsin.

### Yöntem C — Kendi sunucundan sor (Python)

Özet tarayıcıda çıkar, sunucuna sadece `baglam` metni gider:

```python
import requests

SISTEM = ("Sadece verilen cümleleri kullan, bilgi uydurma, "
          "sayfa numaralarını koru, en fazla 200 kelimeyle yanıtla.")

def yapay_zekaya_sor(baglam, soru, anahtar_kelimeler=()):
    ek = f"Anahtar kavramlar: {', '.join(anahtar_kelimeler)}\n\n" if anahtar_kelimeler else ""
    r = requests.post(
        "https://api.openai.com/v1/chat/completions",
        headers={"Authorization": f"Bearer {API_ANAHTARI}"},
        json={"model": "gpt-4o-mini", "temperature": 0.2, "max_tokens": 500,
              "messages": [{"role": "system", "content": SISTEM},
                           {"role": "user",
                            "content": f"{ek}{baglam}\n\nSoru: {soru}"}]},
        timeout=60)
    return r.json()["choices"][0]["message"]["content"]
```

`anahtar_kelimeler` (`result.keywords`, ~20 token) neredeyse bedava ek bağlamdır.

---

## 3. Nerelerde kullanılır?

- **Şirket içi asistanlar:** 500 sayfalık prosedürün tamamını her soruda göndermek yerine ilgili cümleleri seçip gönder. Soru başına maliyet kuruşlara düşer.
- **Müşteri destek botları:** Kılavuzdan ilgili bölümü yerelde bul, bota sadece orayı ver. Yanıt hızlanır, fatura küçülür.
- **Hukuk / mevzuat:** Sözleşmenin kritik maddeleri yerelde seçilir, yapay zekâ sadece "bu madde ne diyor" diye açıklar. Tam metin dışarı çıkmaz.
- **Akademik çalışma:** Makale yığınının özetini bedava çıkar, yapay zekâya sadece karşılaştırma sor.
- **Çağrı merkezi:** Görüşme dökümünü yerelde özetle, yapay zekâya sadece duygu/niyet analizi yaptır.
- **Haber / rapor takibi:** Günde 100 PDF'in özetini bedava çıkar, yapay zekâya sadece "bugünün 3 başlığı ne" diye sor.
- **E-ticaret:** Ürün dokümanlarından ilgili paragrafı seç, bota sadece onu ver.

Ortak desen hep aynıdır: **önce yerelde daralt, sonra yapay zekâya sor.**

---

## 4. Avantajları neler?

### Maliyet (8.000 kelimelik PDF örneği, token ≈ kelime × 1,3)

| Yöntem | Giden token | Oran |
|---|---|---|
| Belgenin tamamını göndermek | ~10.400 | %100 |
| Uzun özet filtresi (K≈15) | ~500 | ~%5 |
| **Kısa özet filtresi (K≈8, önerilen)** | **~250** | **~%2-3** |
| Sadece anahtar kelimeler | ~20 | ~%0,2 |

1.000 belge işleyen bir sistemde: 10.400.000 token yerine ~250.000 token.
Fatura aynı oranda küçülür.

### Diğer avantajlar

- **Hız:** küçük istekler daha hızlı döner, kullanıcı beklemez.
- **Kota dostu:** ücretsiz/ucuz planların günlük limitleri yetmeye başlar.
- **Daha az uydurma:** model koca belge yerine 8 kilitli cümleyle çalışır; kilitli komutla birleşince uydurma riski belirgin azalır.
- **Gizlilik:** belgenin tamamı dışarı çıkmaz; sadece seçili cümleler — o da sen istersen — gider.
- **Denetlenebilirlik:** her cümlenin sayfa numarası bellidir, cevap kaynağına kadar izlenebilir.
- **Model bağımsızlığı:** adres kutusu değişir, her sağlayıcıyla çalışır; yarın model değişse filtre aynı kalır.

---

## 5. K sayısı nasıl seçilir?

| Amaç | Önerilen K | Neden |
|---|---|---|
| Hızlı soru-cevap | 5-8 | En az token, en hızlı yanıt |
| Dengeli özet (önerilen) | 8 | Maliyet/kalite tatlı noktası |
| Detaylı rapor | 10-15 | Daha çok bağlam, biraz daha token |
| Sadece konu başlığı | keywords yeterli | ~20 token, neredeyse bedava |

Kural: **önce küçük başla, cevap yetersizse K'yı büyüt.** Panelde K kutusu
değişince token tahmini anında güncellenir.

---

## 6. Hazır komut şablonları

**Türkçe cilalama:**
> "Aşağıdaki cümleler dışına çıkma. Yeni bilgi uydurma. Sayfa numaralarını koru. En fazla 200 kelimeyle akıcı bir özet yaz."

**Soru-cevap:**
> "Sadece verilen cümlelere dayanarak yanıtla. Cevapta yoksa 'bu cümlelerde yok' de, uydurma. İlgili cümlenin sayfa numarasını ekle."

**Madde listesi:**
> "Verilen cümlelerdeki bilgileri en fazla 5 maddeye indir. Her maddenin sonuna sayfa numarasını yaz."

---

## 7. Güvenlik notları

1. API anahtarını asla koda gömme; paneldeki gibi kullanıcıdan al.
2. Üretimde isteği tarayıcıdan değil **kendi sunucundan** at (anahtar gizli kalır).
3. Kullanıcıya neyin gönderildiğini söyle: "seçili 8 cümle gönderildi".
4. "Anahtarı Unut" düğmesi gibi tek tıkla silme sun.
5. Hassas belgelerde K'yı küçük tut, tam metni asla gönderme.

---

## 8. Sık sorulan sorular

**Cevap yetersiz gelirse?** K'yı büyüt (8 → 12) veya modu Kısa'dan Orta'ya al.

**Hangi yapay zekâ ile çalışır?** OpenAI uyumlu adres kullanan hepsiyle; adres ve model kutusunu değiştirmen yeterli.

**Belgem yapay zekâya gider mi?** Varsayılanda hayır. Açarsan bile tamamı değil, seçili K cümle gider.

**İnternetsiz ne olur?** Özetleme çalışmaya devam eder; sadece yapay zekâ adımı internet ister.

**Neden önce filtre, direkt sormak varken?** Çünkü her soruda 10.000 token yerine 250 token ödersin, yanıt hızlanır, uydurma azalır, kota yeter.

---

## 9. Özet (kopyala-duvara-as)

1. `extract()` → metni al (yerel, 0 token)
2. `summarize({mode:"short"})` → en iyi cümleleri seç (yerel, 0 token)
3. İlk K cümle + anahtar kelimeler → yapay zekâya gönder (tek küçük istek)
4. Cevabı sayfa numaralarıyla göster
