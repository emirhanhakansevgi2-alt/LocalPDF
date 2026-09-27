/* settings.js — tema + okuma hızı localStorage'da saklanır */
(function(){
  function get(k,d){ try{var v=localStorage.getItem(k);return v==null?d:JSON.parse(v);}catch(e){return d;} }
  function set(k,v){ try{localStorage.setItem(k,JSON.stringify(v));}catch(e){} }
  function applyTheme(t){ document.documentElement.dataset.theme=t; set("lpdf-theme",t); var b=document.getElementById("themeBtn"); if(b) b.textContent = t==="dark"?"☀️":"🌙"; }
  function initSettings(){
    applyTheme(get("lpdf-theme","dark"));
    var w=document.getElementById("wpm"); if(w) w.value=get("lpdf-wpm",220);
  }
  window.LocalPDF=window.LocalPDF||{};window.LocalPDF.settings={get:get,set:set,applyTheme:applyTheme,init:initSettings};
})();
