/* LocalPDF - language detect + tokenize + sentence split (TR/EN) — zero AI, pure heuristics.
   FIX: eski sürümde "ve"/"bir" substring araması İngilizce'yi Türkçe sanıyordu (have, never...). Düzeltildi. */
(function(){
  // Türkçe karakterleri ORİJİNAL metinde ara (lowercase öncesi, İ/ı bozulmasın)
  function hasTrChars(text){ return /[çÇğĞıİöÖşŞüÜ]/.test(text||""); }

  var TR_WORDS = ["ve","bir","için","olan","gibi","değil","olarak","olduğu","olduğunu","veya","ancak","çünkü","kadar","daha","bunlar","şunlar","türkiye"];
  var EN_WORDS = ["the","and","of","to","in","is","are","was","were","with","for","on","that","this"];

  function countWords(sample, list){
    var n=0;
    list.forEach(function(w){
      var m = sample.match(new RegExp("\\b"+w.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")+"\\b","g"));
      if(m) n+=m.length;
    });
    return n;
  }

  // Geriye uyumlu: detectLanguage(text) + detaylı sürüm
  function detectLanguageDetail(text){
    if(!text || !text.trim()) return { lang:"en", reason:"empty", trHits:0, enHits:0 };
    var sample = String(text).slice(0, 6000);
    var low = sample.toLocaleLowerCase("tr");
    var trHits = countWords(low, TR_WORDS);
    var enHits = countWords(low, EN_WORDS);
    var score = 0, reasons = [];
    if(hasTrChars(sample)){ score+=4; reasons.push("tr-chars"); }
    score += Math.min(4, trHits) - Math.min(4, enHits);
    if(trHits>enHits) score+=1;
    return { lang: score>=2 ? "tr" : "en", reason: reasons.join(",")||"word-count", trHits:trHits, enHits:enHits, score:score };
  }
  function detectLanguage(text){ return detectLanguageDetail(text).lang; }

  function stopwords(lang){ return lang === "tr" ? window.LPDF_TR_STOPWORDS : window.LPDF_EN_STOPWORDS; }

  var ABBR = ["Prof","Dr","Mr","Mrs","Ms","Sr","Jr","vs","etc","e.g","i.e","No","St","Ave","\u00D6rn","\u00F6rn","bkz","Bkz","sf","syf","mad","md"];
  function splitSentences(text, lang){
    if(!text) return [];
    text = String(text).replace(/\r/g," ").replace(/\s+/g," ").trim();
    var PLACE = "￿";
    ABBR.forEach(function(a){
      var re = new RegExp("\\b"+a.replace(/\./g,"\\.")+"\\.","g");
      text = text.replace(re, a + PLACE);
    });
    var parts;
    try {
      // modern tarayıcı: lookbehind destekli, kısaltma + büyük harf kuralı
      parts = text.split(/(?<=[.!?…])\s+(?=[A-ZÇĞİÖŞÜ0-9"“'(\[])/);
    } catch(e){
      // Safari eski sürüm fallback: noktadan böl, kısaltmaları koru
      parts = text.split(/([.!?…])\s+/);
      var merged=[];
      for(var i=0;i<parts.length;i+=2){ merged.push((parts[i]||"")+(parts[i+1]||"")); }
      parts=merged;
    }
    var out = [];
    parts.forEach(function(p){
      p = p.split(PLACE).join(".").trim();
      if(p.length < 3) return;
      if(/^\d{1,4}$/.test(p)) return;
      if(/^(sayfa|page)\s*\d+/i.test(p) && p.length < 20) return;
      // tek başına "ve", "a", sayı kalmasın
      if(p.split(/\s+/).length < 3 && p.length < 15) return;
      out.push(p);
    });
    return out;
  }

  function tokenizeWords(text, lang){
    var sw = stopwords(lang);
    return String(text).toLocaleLowerCase(lang==="tr"?"tr":"en")
      .replace(/[^a-zçğıöşü0-9\s-]/gi," ")
      .split(/[\s_\/\\|]+/)
      .map(function(w){ return w.replace(/^-+|-+$/g,""); })
      .filter(function(w){ return w.length >= 2 && !sw.has(w) && !/^\d+$/.test(w); });
  }

  function splitParagraphs(pageText){
    return String(pageText||"").split(/\n{2,}|\r\n\r\n/).map(function(p){return p.trim();}).filter(Boolean);
  }

  window.LocalPDF = window.LocalPDF || {};
  window.LocalPDF.detectLanguage = detectLanguage;
  window.LocalPDF.detectLanguageDetail = detectLanguageDetail;
  window.LocalPDF.splitSentences = splitSentences;
  window.LocalPDF.tokenizeWords = tokenizeWords;
  window.LocalPDF.splitParagraphs = splitParagraphs;
  window.LocalPDF.stopwords = stopwords;
})();
