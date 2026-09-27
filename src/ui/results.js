/* results.js — render dashboard */
(function(){
  function esc(s){return String(s).replace(/[&<>"]/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c];});}
  function render(a, bullet){
    var sumEl=document.getElementById("summaryList"), kp=document.getElementById("keyPoints"),
        kw=document.getElementById("kwList"), st=document.getElementById("statsGrid"), sec=document.getElementById("sections");
    sumEl.innerHTML=a.summary.map(function(s,i){
      var body = bullet ? "• "+esc(s.text) : "<b>"+(i+1)+".</b> "+esc(s.text);
      return "<div class='sent'>"+body+" <span class='pg'>[Sayfa "+s.pageNumber+"]</span></div>";
    }).join("") || "<p class='muted'>Özet üretilemedi.</p>";
    kp.innerHTML=a.summary.slice(0,5).map(function(s){return "<li>"+esc(s.text)+"</li>";}).join("");
    kw.innerHTML=a.keywords.map(function(k){return "<button class='chip' data-k='"+esc(k)+"'>"+esc(k)+"</button>";}).join("");
    st.innerHTML="<div><b>"+a.pages+"</b><span>Sayfa</span></div><div><b>"+a.words.toLocaleString("tr-TR")+"</b><span>Kelime</span></div><div><b>"+a.chars.toLocaleString("tr-TR")+"</b><span>Karakter</span></div><div><b>"+a.paragraphs+"</b><span>Paragraf</span></div><div><b>"+a.sentences+"</b><span>Cümle</span></div><div><b>"+a.readMin+" dk</b><span>Okuma ("+a.wpm+" kd/dk)</span></div><div><b>"+a.sumMin+" dk</b><span>Özet okuma</span></div><div><b>%"+a.compression+"</b><span>Sıkıştırma</span></div>";
    sec.innerHTML=(a.sections||[]).map(function(c){
      return "<div class='sec'><h4>"+esc(c.title)+"</h4>"+c.sentences.map(function(s){return "<p>• "+esc(s.text)+" <span class='pg'>[s."+s.pageNumber+"]</span></p>";}).join("")+"</div>";
    }).join("");
  }
  window.LocalPDF=window.LocalPDF||{};window.LocalPDF.results={render:render,esc:esc};
})();
