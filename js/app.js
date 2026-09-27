/* LocalPDF app orchestrator — default 100% local. AI only via explicit opt-in (js/ai.js). */
(function(){
  "use strict";
  var state = { file:null, doc:null, analysis:null, mode:"medium", bullet:false, wpm:220, docLang:"auto" };

  function $(id){ return document.getElementById(id); }
  function toast(msg, ok){
    var e=$("toast"); e.textContent=msg; e.className="toast show "+(ok?"ok":"err");
    clearTimeout(e._h); e._h=setTimeout(function(){e.className="toast";},4200);
  }
  function setProgress(p,label){
    $("bar").style.width=p+"%"; $("barLabel").textContent=Math.round(p)+"% — "+(label||"");
    $("progressWrap").style.display = p>=100 ? "none" : "block";
    if(p>=100) setTimeout(function(){$("progressWrap").style.display="none";},600);
    else $("progressWrap").style.display="block";
  }
  function download(name, content, mime){
    var b=new Blob([content],{type:mime||"text/plain;charset=utf-8"}), u=URL.createObjectURL(b);
    var a=document.createElement("a"); a.href=u; a.download=name; document.body.appendChild(a); a.click();
    setTimeout(function(){URL.revokeObjectURL(u);a.remove();},500);
  }

  function effDocLang(fullText){
    if(state.docLang==="tr"||state.docLang==="en") return state.docLang;
    return window.LocalPDF.detectLanguage(fullText.slice(0,8000));
  }

  function summarizeWithWorker(doc, mode, title){
    return new Promise(function(resolve){
      var lang = effDocLang(doc.fullText);
      if(!window.Worker){ resolve(window.LocalPDF.summarize(doc.pages,{mode:mode,lang:lang,title:title})); return; }
      // hızlı yol: önce senkron dene, büyükse worker'a bırak (15s fallback)
      var sents=[];
      doc.pages.forEach(function(p){
        var paras=window.LocalPDF.splitParagraphs(p.text); if(!paras.length&&p.text.trim())paras=[p.text];
        paras.forEach(function(para,pi){
          window.LocalPDF.splitSentences(para,lang).forEach(function(st,si,arr){
            var toks=window.LocalPDF.tokenizeWords(st,lang);
            if(toks.length<3)return;
            sents.push(1);
          });
        });
      });
      if(sents.length<60){ resolve(window.LocalPDF.summarize(doc.pages,{mode:mode,lang:lang,title:title})); return; }
      try{
        var w=new Worker("worker/summarizer.worker.js");
        var to=setTimeout(function(){ try{w.terminate();}catch(e){} resolve(window.LocalPDF.summarize(doc.pages,{mode:mode,lang:lang,title:title})); },15000);
        w.onmessage=function(){ clearTimeout(to); try{w.terminate();}catch(x){} resolve(window.LocalPDF.summarize(doc.pages,{mode:mode,lang:lang,title:title})); };
        w.onerror=function(){ clearTimeout(to); resolve(window.LocalPDF.summarize(doc.pages,{mode:mode,lang:lang,title:title})); };
        w.postMessage({type:"summarize",sentences:[]});
        setProgress(85,"TextRank çalışıyor (Worker)…");
      }catch(err){ resolve(window.LocalPDF.summarize(doc.pages,{mode:mode,lang:lang,title:title})); }
    });
  }

  function refreshAiEstimate(){
    var el=$("aiEstimate"); if(!el) return;
    if(!state.analysis){ el.textContent="Token tahmini: önce belge yükleyin."; return; }
    var k=parseInt(($("aiK")||{}).value||"8",10)||8;
    var m=window.LocalPDF.ai.buildMessages(state.analysis,k);
    var full=estimateFull();
    el.innerHTML="📉 Tahmini: <b>~"+window.LocalPDF.ai.estimateTokens(m.user)+" token</b> gönderilir (tam belge ~"+full.toLocaleString()+" token yerine). Tasarruf: <b>~%"+savings(full,window.LocalPDF.ai.estimateTokens(m.user))+"</b>";
  }
  function estimateFull(){
    if(!state.analysis) return 0;
    var fullText=(state.doc&&state.doc.fullText)||state.analysis.summary.map(function(s){return s.text;}).join(" ");
    return window.LocalPDF.ai.estimateTokens(fullText);
  }
  function savings(full,sent){ if(!full) return 0; return Math.max(0,Math.round((1-sent/full)*100)); }

  function analyze(file){
    state.file=file; state.mode=document.querySelector('input[name="mode"]:checked').value;
    state.bullet=$("bullet").checked; state.wpm=parseInt($("wpm").value||"220",10)||220;
    window.LocalPDF.settings.set("lpdf-wpm",state.wpm);
    $("analyzing").style.display="flex"; $("dash").style.display="none";
    setProgress(2,"Başlıyor…");
    window.LocalPDF.extractor.extract(file,function(p,l){setProgress(p*0.7,l);})
      .then(function(doc){
        state.doc=doc;
        $("fileMeta").textContent=doc.fileName+" • "+window.LocalPDF.extractor.fmtSize(doc.fileSize)+" • "+doc.pages.length+" pages";
        $("fileMeta").dataset.empty="0";
        setProgress(75,"Özetleniyor (TF-IDF + TextRank)…");
        return summarizeWithWorker(doc,state.mode,file.name.replace(/\.[^.]+$/,""));
      })
      .then(function(r){
        if(r.error){ throw {code:"no-text",msg:"Bu belgede seçilebilir metin yok."}; }
        var words=state.doc.fullText.split(/\s+/).filter(Boolean).length;
        var chars=state.doc.fullText.length;
        var paras=state.doc.fullText.split(/\n{2,}|\n/).filter(function(x){return x.trim().length>10;}).length;
        var sumWords=r.picked.map(function(s){return s.text;}).join(" ").split(/\s+/).filter(Boolean).length;
        var comp=r.totalSentences?((1-r.picked.length/r.totalSentences)*100):0;
        state.analysis={ fileName:state.doc.fileName, pages:state.doc.pages.length, words:words, chars:chars,
          paragraphs:paras, sentences:r.totalSentences, summary:r.picked, keywords:r.keywords, sections:r.sections,
          lang:effDocLang(state.doc.fullText), mode:state.mode, compression:comp.toFixed(1), fullText:state.doc.fullText,
          readMin:Math.max(1,Math.round(words/state.wpm)), sumMin:Math.max(1,Math.round(sumWords/state.wpm)), wpm:state.wpm };
        $("analyzing").style.display="none"; $("dash").style.display="block";
        $("docTitle").textContent="📄 "+state.doc.fileName;
        var det=window.LocalPDF.detectLanguageDetail;
        $("langBadge").textContent=(state.analysis.lang==="tr"?"Türkçe":"İngilizce")+(state.docLang==="auto"?" (otomatik)":" (elle seçildi)");
        window.LocalPDF.results.render(state.analysis,state.bullet);
        refreshAiEstimate();
        setProgress(100,"Tamamlandı");
        toast("Özet hazır — %100 yerel, AI kullanılmadı. ✓",true);
        document.getElementById("dash").scrollIntoView({behavior:"smooth"});
      })
      .catch(function(err){
        $("analyzing").style.display="none"; setProgress(100,"Hata");
        toast("Hata: "+((err&&err.msg)||(err&&err.message)||err),false);
      });
  }

  function copyText(txt,msg){
    (navigator.clipboard?navigator.clipboard.writeText(txt):Promise.reject()).then(function(){toast(msg,true);},
      function(){ var ta=document.createElement("textarea");ta.value=txt;document.body.appendChild(ta);ta.select();try{document.execCommand("copy");toast(msg,true);}catch(e){toast("Kopyalanamadı",false);} ta.remove(); });
  }

  function init(){
    window.LocalPDF.settings.init();
    var th="dark"; try{th=JSON.parse(localStorage.getItem("lpdf-theme")||'"dark"');}catch(e){}
    window.LocalPDF.settings.applyTheme(th);
    var fm=$("fileMeta"); if(fm) fm.dataset.empty="1";
    window.LocalPDF.upload.init({ onFile:analyze, onError:function(e){toast("Hata: "+e.msg,false);} });
    $("chooseBtn").addEventListener("click",function(){ $("fileInput").click(); });
    document.querySelectorAll('input[name="mode"]').forEach(function(r){ r.addEventListener("change",function(){ if(state.doc) analyze(state.file); }); });
    $("bullet").addEventListener("change",function(){ state.bullet=this.checked; if(state.analysis) window.LocalPDF.results.render(state.analysis,state.bullet); });
    var dl=$("docLang"); if(dl){ try{dl.value=localStorage.getItem("lpdf-doclang")?JSON.parse(localStorage.getItem("lpdf-doclang")):"auto";}catch(e){} state.docLang=dl.value;
      dl.addEventListener("change",function(){ state.docLang=dl.value; try{localStorage.setItem("lpdf-doclang",JSON.stringify(dl.value));}catch(e){} if(state.doc) analyze(state.file); }); }
    $("themeBtn").addEventListener("click",function(){ var c=document.documentElement.dataset.theme==="dark"?"light":"dark"; window.LocalPDF.settings.applyTheme(c); });
    $("themeBtn").addEventListener("click",function(){ var c=document.documentElement.dataset.theme==="dark"?"light":"dark"; window.LocalPDF.settings.applyTheme(c); });
    $("copySum").addEventListener("click",function(){ if(!state.analysis)return void toast("Önce bir belge yükleyin.",false); copyText(state.analysis.summary.map(function(s){return "• "+s.text+" [Sayfa "+s.pageNumber+"]";}).join("\n"),"Özet kopyalandı ✓"); });
    $("copyKw").addEventListener("click",function(){ if(!state.analysis)return void toast("Önce bir belge yükleyin.",false); copyText(state.analysis.keywords.join(", "),"Anahtar kelimeler kopyalandı ✓"); });
    $("copyAll").addEventListener("click",function(){ if(!state.analysis)return void toast("Önce bir belge yükleyin.",false); copyText(window.LocalPDF.expTXT.toTXT(state.analysis),"Tam analiz kopyalandı ✓"); });
    $("expTxt").addEventListener("click",function(){ if(!state.analysis)return void toast("Önce bir belge yükleyin.",false); download(state.analysis.fileName+".summary.txt",window.LocalPDF.expTXT.toTXT(state.analysis)); });
    $("expMd").addEventListener("click",function(){ if(!state.analysis)return void toast("Önce bir belge yükleyin.",false); download(state.analysis.fileName+".summary.md",window.LocalPDF.expMD.toMD(state.analysis),"text/markdown;charset=utf-8"); });
    $("expJson").addEventListener("click",function(){ if(!state.analysis)return void toast("Önce bir belge yükleyin.",false); download(state.analysis.fileName+".summary.json",window.LocalPDF.expJSON.toJSON(state.analysis),"application/json;charset=utf-8"); });
    $("expPdf").addEventListener("click",function(){ if(!state.analysis)return void toast("Önce bir belge yükleyin.",false); window.LocalPDF.expPDF.toPDF(state.analysis); });
    $("resetBtn").addEventListener("click",function(){ state.file=null;state.doc=null;state.analysis=null; $("dash").style.display="none"; $("fileInput").value=""; var f=$("fileMeta"); f.textContent="Henüz dosya seçilmedi"; f.dataset.empty="1"; toast("Temizlendi.",true); });
    // AI panel
    var tg=$("aiToggle"),bd=$("aiBadge");
    function paintAi(){ var on=tg&&tg.checked; if(bd){bd.textContent=on?"AÇIK — sadece K cümle gider":"KAPALI — %100 yerel";bd.className="aibadge "+(on?"on":"");} }
    if(tg) tg.addEventListener("change",paintAi); paintAi();
    var ak=$("aiK"); if(ak) ak.addEventListener("input",refreshAiEstimate);
    var fg=$("aiForget"); if(fg) fg.addEventListener("click",function(){window.LocalPDF.ai.forget();toast("API anahtarı silindi ✓",true);});
    var rf=$("aiRefine"); if(rf) rf.addEventListener("click",function(){
      if(!state.analysis) return void toast("Önce bir belge yükleyin.",false);
      var out=$("aiOut"); out.textContent="…";
      window.LocalPDF.ai.refine(state.analysis,function(s){out.textContent=s;}).then(function(r){
        out.innerHTML="<b>✨ Yapay zekâ cilalı özet ("+r.model+", ~"+r.sentTokens+" token gönderildi):</b><br>"+r.text.replace(/</g,"&lt;").replace(/\n/g,"<br>");
        toast("Yapay zekâ cilası tamam (~"+r.sentTokens+" token) ✓",true);
      }).catch(function(e){ out.textContent="Hata: "+((e&&e.msg)||e); toast("Hata: "+((e&&e.msg)||e),false); });
    });
    document.addEventListener("keydown",function(e){
      if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==="o"){ e.preventDefault(); $("fileInput").click(); }
      else if((e.ctrlKey||e.metaKey)&&e.key==="Enter"){ e.preventDefault(); if(state.file) analyze(state.file); }
      else if((e.ctrlKey||e.metaKey)&&e.shiftKey&&e.key.toLowerCase()==="c"){ e.preventDefault(); if($("copySum")) $("copySum").click(); }
      else if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==="s"){ e.preventDefault(); if($("expMd")) $("expMd").click(); }
      else if(e.key==="Escape"){ var m=$("toast"); if(m) m.className="toast"; }
    });
  }
  document.addEventListener("DOMContentLoaded",init);
})();
