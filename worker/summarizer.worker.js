/* LocalPDF Web Worker — TF-IDF/TextRank off main thread. Falls back to main thread if Workers unavailable. */
self.onmessage = function(e){
  try{
    var d = e.data;
    if(d.type !== "summarize") return;
    // worker has no access to window.* libs, so re-implement minimal scoring inline:
    var sents = d.sentences; // [{text,tokens,pageNumber,paraKey,isParaFirst,isParaLast,wordCount}]
    var N = Math.max(1, sents.length), df = {}, i, t;
    sents.forEach(function(s){ var seen={}; s.tokens.forEach(function(tk){ if(!seen[tk]){seen[tk]=1; df[tk]=(df[tk]||0)+1;} }); });
    var idf={}; for(t in df) idf[t]=Math.log((N+1)/(df[t]+1))+1;
    function tfidfVec(toks){ var m={},k; toks.forEach(function(x){m[x]=(m[x]||0)+1;}); var v={},s=0; for(k in m){v[k]=(m[k]/toks.length)*idf[k]; s+=v[k]*v[k];} var n=Math.sqrt(s)||1; for(k in v)v[k]/=n; return v; }
    var vecs = sents.map(function(s){return tfidfVec(s.tokens);});
    function cos(a,b){var d2=0,k; for(k in a) if(b[k]) d2+=a[k]*b[k]; return d2;}
    var idx = sents.map(function(_,k){return k;});
    if(idx.length>400){ var ni=[],st=idx.length/400; for(var k=0;k<400;k++) ni.push(Math.floor(k*st)); idx=ni; }
    var sub=idx.map(function(ix){return vecs[ix];});
    var sim=sub.map(function(a,i){return sub.map(function(b,j){return i===j?0:cos(a,b);});});
    sim.forEach(function(row){ var o=row.map(function(v,k){return [v,k];}).sort(function(x,y){return y[0]-x[0];}); o.slice(8).forEach(function(p){row[p[1]]=0;}); });
    // pagerank
    var n=sim.length, dmp=0.85, scores=new Array(n).fill(1/Math.max(1,n));
    var outW=sim.map(function(r){var s=0;for(var k=0;k<r.length;k++)s+=r[k];return s||1;});
    for(var it=0;it<60;it++){ var nx=new Array(n).fill(0.15/Math.max(1,n)),df2=0; for(var a=0;a<n;a++)for(var b=0;b<n;b++){if(a!==b&&sim[b][a]>0)nx[a]+=dmp*(sim[b][a]/outW[b])*scores[b];} for(var a2=0;a2<n;a2++)df2+=Math.abs(nx[a2]-scores[a2]); scores=nx; if(df2<1e-4)break; }
    var mx=Math.max.apply(null,scores.concat([0])),mn=Math.min.apply(null,scores.concat([0])),rg=(mx-mn)||1;
    var trN=scores.map(function(s){return (s-mn)/rg;});
    var trFull=new Array(sents.length).fill(0); idx.forEach(function(ix,k){trFull[ix]=trN[k];});
    self.postMessage({type:"done", vecs:vecs, tr:trFull, idf:idf, df:df});
  }catch(err){ self.postMessage({type:"error", message:String((err&&err.message)||err)}); }
};
