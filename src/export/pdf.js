/* PDF dışa aktarma — tarayıcı yazdırma ekranını kullanır (tamamen yerel, ek kütüphane yok). */
(function(){
  function toPDF(a){
    var w = window.open("", "_blank");
    if(!w){ alert("Açılır pencere engellendi. PDF için açılır pencereye izin verin."); return; }
    var rows = a.summary.map(function(s,i){return "<p><b>"+(i+1)+".</b> "+escapeHtml(s.text)+" <span style='color:#888'>(s."+s.pageNumber+")</span></p>";}).join("");
    w.document.write("<html lang='tr'><head><meta charset='utf-8'><title>LocalPDF - "+escapeHtml(a.fileName)+"</title><style>body{font-family:Arial,sans-serif;max-width:700px;margin:40px auto;color:#111}h1{font-size:22px}h2{margin-top:28px}</style></head><body><h1>LocalPDF Özeti — "+escapeHtml(a.fileName)+"</h1><p>Sayfa: "+a.pages+" | Kelime: "+a.words+" | Dil: "+a.lang+" | Mod: "+a.mode+"</p><h2>Özet</h2>"+rows+"<h2>Anahtar Kelimeler</h2><p>"+escapeHtml(a.keywords.join(", "))+"</p><script>onload=function(){print();}<\/script></body></html>");
    w.document.close();
  }
  function escapeHtml(s){return String(s).replace(/[&<>"]/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c];});}
  window.LocalPDF=window.LocalPDF||{};window.LocalPDF.expPDF={toPDF:toPDF};
})();
