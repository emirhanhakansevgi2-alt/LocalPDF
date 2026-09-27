/* LocalPDF extractor: PDF (pdf.js) + DOCX (mammoth) + TXT/MD/HTML. Rejects ZIP/folders. UTF-8 safe. */
(function(){
  var MAX_BYTES = 60 * 1024 * 1024; // 60MB
  var OK_EXT = ["pdf","docx","txt","md","markdown","html","htm","text"];

  function extOf(name){ var m=/\.([a-z0-9]+)$/i.exec(name||""); return m?m[1].toLowerCase():""; }

  function validateFile(file){
    if(!file) return {ok:false, code:"no-file", msg:"Dosya seçilmedi. Lütfen bir dosya seçin."};
    var ext = extOf(file.name);
    if(file.name && /\.zip$/i.test(file.name)) return {ok:false, code:"zip", msg:"ZIP/klasör okunmaz. Lütfen sadece PDF, DOCX, TXT, MD veya HTML yükleyin."};
    if(OK_EXT.indexOf(ext)===-1) return {ok:false, code:"bad-type", msg:"Desteklenmeyen format (."+ext+"). Desteklenenler: PDF, DOCX, TXT, MD, HTML."};
    if(file.size > MAX_BYTES) return {ok:false, code:"too-big", msg:"Dosya çok büyük ("+fmtSize(file.size)+"). Lütfen 60MB altında bir dosya seçin."};
    if(file.size === 0) return {ok:false, code:"empty", msg:"Dosya boş görünüyor."};
    return {ok:true, ext:ext};
  }

  function fmtSize(b){
    if(b<1024) return b+" B";
    if(b<1048576) return (b/1024).toFixed(1)+" KB";
    return (b/1048576).toFixed(1)+" MB";
  }

  function extract(file, onProgress){
    var v = validateFile(file);
    if(!v.ok) return Promise.reject(v);
    progress(onProgress, 5, "Dosya okunuyor…");
    if(v.ext==="pdf") return extractPDF(file, onProgress);
    if(v.ext==="docx") return extractDOCX(file, onProgress);
    return extractText(file, onProgress, v.ext);
  }

  function progress(cb,p,label){ try{ cb&&cb(p,label); }catch(e){} }

  function extractPDF(file, onProgress){
    return file.arrayBuffer().then(function(buf){
      progress(onProgress,15,"PDF açılıyor…");
      if(!window.pdfjsLib) throw {code:"no-pdfjs", msg:"PDF kütüphanesi yüklenemedi (internet gerekli ilk yüklemede). Sayfayı yenileyin."};
      return window.pdfjsLib.getDocument({data:buf}).promise.then(function(pdf){
        if(pdf.numPages > 1500) throw {code:"too-long", msg:"PDF çok uzun ("+pdf.numPages+" sayfa). Lütfen daha küçük bir bölüm deneyin."};
        var pages=[], chain=Promise.resolve();
        for(var i=1;i<=pdf.numPages;i++){
          (function(pn){
            chain = chain.then(function(){
              progress(onProgress, 15+Math.round(55*pn/pdf.numPages), "Sayfa "+pn+"/"+pdf.numPages+" okunuyor…");
              return pdf.getPage(pn).then(function(page){
                return page.getTextContent().then(function(tc){
                  var lines={}, rawLines=[];
                  tc.items.forEach(function(it){
                    var y=Math.round(it.transform[5]);
                    (lines[y]=lines[y]||[]).push({x:it.transform[4], s:it.str});
                  });
                  Object.keys(lines).sort(function(a,b){return b-a;}).forEach(function(y){
                    var row=lines[y].sort(function(a,b){return a.x-b.x;}).map(function(o){return o.s;}).join(" ");
                    if(row.trim()) rawLines.push(row);
                  });
                  pages.push({pageNumber:pn, rawLines:rawLines, lines:[], text:""});
                });
              });
            });
          })(i);
        }
        return chain.then(function(){
          window.LocalPDF.stripHeadersFooters(pages);
          var full = pages.map(function(p){return p.text;}).join("\n");
          if(full.replace(/\s/g,"").length < 100){
            throw {code:"scanned", msg:"Bu PDF'de seçilebilir metin yok. (Taranmış görüntüden oluşuyor olabilir. OCR ileride eklenecek.)"};
          }
          progress(onProgress,75,"Metin temizlendi.");
          return {kind:"pdf", fileName:file.name, fileSize:file.size, pages:pages, fullText:full};
        });
      }, function(err){
        if(err && err.name==="PasswordException") throw {code:"encrypted", msg:"PDF şifreli. Lütfen şifresiz bir kopya yükleyin."};
        throw {code:"corrupt", msg:"PDF bozuk veya okunamadı. ("+((err&&err.message)||err)+")"};
      });
    });
  }

  function extractDOCX(file, onProgress){
    return file.arrayBuffer().then(function(buf){
      progress(onProgress,25,"Word belgesi okunuyor…");
      if(!window.mammoth) throw {code:"no-docx", msg:"DOCX kütüphanesi yüklenemedi. İnternete bağlıyken tekrar deneyin."};
      return window.mammoth.extractRawText({arrayBuffer:buf}).then(function(r){
        var text=String(r.value||"");
        if(text.replace(/\s/g,"").length<20) throw {code:"no-text", msg:"DOCX içinde okunabilir metin bulunamadı."};
        var pages=chunkToPages(text);
        progress(onProgress,70,"Metin hazır.");
        return {kind:"docx", fileName:file.name, fileSize:file.size, pages:pages, fullText:text};
      });
    });
  }

  function extractText(file, onProgress, ext){
    return new Promise(function(res,rej){
      var r=new FileReader();
      r.onload=function(){
        try{
          var text=String(r.result||"");
          if(ext==="html"||ext==="htm") text=htmlToText(text);
          if(text.replace(/\s/g,"").length<10) rej({code:"no-text", msg:"Dosyada okunabilir metin yok."});
          else { var pages=chunkToPages(text); progress(onProgress,70,"Metin hazır."); res({kind:"text", fileName:file.name, fileSize:file.size, pages:pages, fullText:text}); }
        }catch(e){ rej({code:"extract-fail", msg:"Metin çıkarılamadı: "+e.message}); }
      };
      r.onerror=function(){ rej({code:"extract-fail", msg:"Dosya okunamadı (metin çıkarma başarısız)."}); };
      r.readAsText(file,"UTF-8"); // UTF-8 öncelikli; tarayıcı BOM/charset'i yönetir
    });
  }

  function htmlToText(html){
    var d=document.createElement("div"); d.innerHTML=html;
    d.querySelectorAll("script,style,nav,footer").forEach(function(n){n.remove();});
    return d.innerText||d.textContent||"";
  }
  function chunkToPages(text){
    var paras=text.split(/\n{2,}|\r\n\r\n/), pages=[], cur={pageNumber:1,rawLines:[],lines:[],text:""}, count=0;
    paras.forEach(function(p){
      cur.rawLines.push(p); count+=p.length;
      if(count>3000){ cur.lines=cur.rawLines.slice(); cur.text=window.LocalPDF.cleanText(cur.lines.join("\n")); pages.push(cur); cur={pageNumber:pages.length+1,rawLines:[],lines:[],text:""}; count=0; }
    });
    if(cur.rawLines.length){ cur.lines=cur.rawLines.slice(); cur.text=window.LocalPDF.cleanText(cur.lines.join("\n")); pages.push(cur); }
    return pages;
  }

  window.LocalPDF = window.LocalPDF || {};
  window.LocalPDF.extractor = { extract:extract, validateFile:validateFile, fmtSize:fmtSize };
})();
