/* LocalPDF TF-IDF — classic, no AI */
(function(){
  function termFreq(tokens){
    var m = {}, i, t;
    for(i=0;i<tokens.length;i++){ t=tokens[i]; m[t]=(m[t]||0)+1; }
    var len = Math.max(1,tokens.length), out = {};
    for(t in m) out[t]=m[t]/len;
    return out;
  }
  // sentences: [{tokens:[...]}] -> {tfidf:[{term:score}], idf:{}}
  function computeTFIDF(sentences){
    var N = Math.max(1, sentences.length), df = {}, i, t, seen;
    sentences.forEach(function(s){
      seen = {};
      s.tokens.forEach(function(tok){ if(!seen[tok]){ seen[tok]=1; df[tok]=(df[tok]||0)+1; } });
    });
    var idf = {};
    for(t in df) idf[t] = Math.log((N+1)/(df[t]+1)) + 1; // smoothed
    var tfidf = sentences.map(function(s){
      var tf = termFreq(s.tokens), vec = {}, sum=0;
      for(t in tf){ vec[t]=tf[t]*idf[t]; sum+=vec[t]*vec[t]; }
      var norm = Math.sqrt(sum)||1;
      for(t in vec) vec[t]/=norm;
      return vec;
    });
    return { tfidf: tfidf, idf: idf, df: df };
  }
  function cosine(a,b){
    var dot=0, t;
    // iterate smaller
    for(t in a){ if(b[t]) dot += a[t]*b[t]; }
    return dot; // vectors pre-normalized
  }
  window.LocalPDF = window.LocalPDF || {};
  window.LocalPDF.tfidf = { computeTFIDF: computeTFIDF, cosine: cosine };
})();
