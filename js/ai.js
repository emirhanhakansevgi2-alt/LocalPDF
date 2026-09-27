/* LocalPDF — OPTIONAL AI refinement (varsayılan KAPALI, %100 opt-in BYOK).
   Mantık: tüm PDF AI'a gönderilmez. Önce yerel extractive özet (TF-IDF+TextRank)
   en önemli K cümleyi seçer (~200-400 token). AI'a SADECE bu cümleler gider.
   Örn: 8000 kelimelik PDF (~10.400 token) yerine 8 cümle (~250 token) → ~%97 tasarruf.
   Anahtar tarayıcıdan çıkmaz; sadece kullanıcı "Refine"e basarsa seçtiği endpoint'e gider. */
(function(){
  function words(s){ return String(s||"").trim().split(/\s+/).filter(Boolean).length; }
  function estimateTokens(text){ return Math.ceil(words(text)*1.3); } // ~EN/TR ortalaması

  function cfg(){
    var g=function(id){var el=document.getElementById(id);return el?el.value.trim():"";};
    var remember=document.getElementById("aiRemember")&&document.getElementById("aiRemember").checked;
    // key önceliği: input > session > local(remember ise)
    var key=g("aiKey")||sessionStorage.getItem("lpdf-ai-key")||localStorage.getItem("lpdf-ai-key")||"";
    return { enabled:document.getElementById("aiToggle")&&document.getElementById("aiToggle").checked,
      endpoint:g("aiEndpoint")||"https://api.openai.com/v1/chat/completions",
      model:g("aiModel")||"gpt-4o-mini", key:key, remember:remember,
      k:parseInt((document.getElementById("aiK")||{}).value||"8",10)||8 };
  }
  function persistKey(key,remember){
    try{
      if(remember){ localStorage.setItem("lpdf-ai-key",key); sessionStorage.removeItem("lpdf-ai-key"); }
      else { sessionStorage.setItem("lpdf-ai-key",key); localStorage.removeItem("lpdf-ai-key"); }
    }catch(e){}
  }
  function forgetKey(){ try{localStorage.removeItem("lpdf-ai-key");sessionStorage.removeItem("lpdf-ai-key");}catch(e){} var el=document.getElementById("aiKey"); if(el)el.value=""; }

  function buildMessages(analysis,k){
    var dil=analysis.lang==="tr"?"Türkçe":"İngilizce";
    var top=analysis.summary.slice(0,k).map(function(s,i){return (i+1)+". "+s.text;}).join("\n");
    var sys="Dikkatli bir editörsün. Verilen cümleleri akıcı bir "+dil+" özet olarak yeniden yaz. Kurallar: SADECE verilen bilgileri kullan, yeni bilgi uydurma, sayfa numaralarını koru, en fazla 200 kelimeyle yanıtla.";
    return { system:sys, user:"Düzenlenecek cümleler (bilgi uydurma):\n"+top, shortText:top };
  }

  function refine(analysis,onStep){
    return new Promise(function(resolve,reject){
      var c=cfg();
      if(!c.enabled) return reject({msg:"Yapay zekâ kapalı. Önce 'yapay zekâ cilası'nı açın."});
      if(!c.key) return reject({msg:"API anahtarı yok. Kendi anahtarınızı girin."});
      if(!analysis||!analysis.summary.length) return reject({msg:"Önce belge özetlenmeli."});
      persistKey(c.key,c.remember);
      var m=buildMessages(analysis,Math.min(c.k,analysis.summary.length));
      var ctrl=new AbortController(); var to=setTimeout(function(){ctrl.abort();},60000);
      onStep&&onStep("Yapay zekâya gönderiliyor: ~"+estimateTokens(m.user)+" token (belgenin tamamı ~"+estimateTokens(analysis.fullText||m.user)+"+ yerine)…");
      fetch(c.endpoint,{method:"POST",signal:ctrl.signal,
        headers:{"Content-Type":"application/json","Authorization":"Bearer "+c.key},
        body:JSON.stringify({model:c.model,messages:[{role:"system",content:m.system},{role:"user",content:m.user}],temperature:0.2,max_tokens:500})
      }).then(function(r){
        clearTimeout(to);
        if(!r.ok) throw {msg:"Yapay zekâ hatası HTTP "+r.status+". Adres/model/anahtarı kontrol edin."};
        return r.json();
      }).then(function(j){
        var txt=j&&j.choices&&j.choices[0]&&j.choices[0].message&&j.choices[0].message.content;
        if(!txt) throw {msg:"Yapay zekâ boş yanıt döndü."};
        resolve({text:txt.trim(), sentTokens:estimateTokens(m.user), model:c.model});
      }).catch(function(e){
        clearTimeout(to);
        if(e&&e.name==="AbortError") reject({msg:"Zaman aşımı (60 sn). Adrese erişilemiyor olabilir."});
        else reject(e&&e.msg?e:{msg:"Bağlantı hatası: "+((e&&e.message)||e)});
      });
    });
  }

  window.LocalPDF=window.LocalPDF||{};
  window.LocalPDF.ai={estimateTokens:estimateTokens,refine:refine,config:cfg,forget:forgetKey,buildMessages:buildMessages};
})();
