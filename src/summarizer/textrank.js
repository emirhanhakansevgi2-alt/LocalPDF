/* LocalPDF TextRank (PageRank over sentence similarity graph) */
(function(){
  function textRank(simMatrix, d, maxIter, tol){
    d = (d==null)?0.85:d; maxIter=maxIter||60; tol=tol||1e-4;
    var n = simMatrix.length;
    if(n===0) return [];
    if(n===1) return [1];
    var scores = new Array(n).fill(1/n), i, j, iter;
    // out-weight per node
    var outW = simMatrix.map(function(row){ var s=0,k; for(k=0;k<row.length;k++) s+=row[k]; return s||1; });
    for(iter=0;iter<maxIter;iter++){
      var next = new Array(n).fill((1-d)/n), diff=0;
      for(i=0;i<n;i++){
        for(j=0;j<n;j++){
          if(i===j) continue;
          if(simMatrix[j][i] > 0) next[i] += d * (simMatrix[j][i]/outW[j]) * scores[j];
        }
        diff += Math.abs(next[i]-scores[i]);
      }
      scores = next;
      if(diff < tol) break;
    }
    // normalize 0..1
    var mx = Math.max.apply(null,scores), mn = Math.min.apply(null,scores), rg=(mx-mn)||1;
    return scores.map(function(s){return (s-mn)/rg;});
  }
  window.LocalPDF = window.LocalPDF || {};
  window.LocalPDF.textRank = textRank;
})();
