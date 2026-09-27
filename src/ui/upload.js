/* upload.js — drag&drop + file input wiring */
(function(){
  function initUpload(opts){
    var dz = document.getElementById("dropzone"), fi = document.getElementById("fileInput");
    ["dragenter","dragover"].forEach(function(ev){ dz.addEventListener(ev,function(e){e.preventDefault();dz.classList.add("drag");}); });
    ["dragleave","drop"].forEach(function(ev){ dz.addEventListener(ev,function(e){e.preventDefault();dz.classList.remove("drag");}); });
    dz.addEventListener("drop",function(e){
      var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if(!f && e.dataTransfer && e.dataTransfer.items){ /* folder drop guard */ opts.onError({code:"folder",msg:"Klasör/ZIP sürüklenemez. Tek bir PDF/DOCX/TXT/MD/HTML dosyası bırakın."}); return; }
      if(f) opts.onFile(f);
    });
    dz.addEventListener("click",function(e){ if(e.target.closest("button")) return; fi.click(); });
    fi.addEventListener("change",function(){ if(fi.files[0]) opts.onFile(fi.files[0]); });
  }
  window.LocalPDF=window.LocalPDF||{};window.LocalPDF.upload={init:initUpload};
})();
