/* LocalPDF sentence scorer: TFIDF + keyword + position + title + paragraph + length */
(function(){
  function scoreSentences(sents, opts){
    // sents: [{text,tokens,pageNumber,paraIndex,globalIndex,heading}]
    // opts: {tfidfVectors, textRankScores, titleTokens, paraImportance, lang}
    var n = sents.length;
    var kwFreq = {};
    sents.forEach(function(s){ s.tokens.forEach(function(t){ kwFreq[t]=(kwFreq[t]||0)+1; }); });
    var maxF = 1; Object.keys(kwFreq).forEach(function(k){ if(kwFreq[k]>maxF) maxF=kwFreq[k]; });
    var titleSet = {}; (opts.titleTokens||[]).forEach(function(t){ titleSet[t]=1; });

    return sents.map(function(s, i){
      var vec = opts.tfidfVectors[i] || {};
      var tfidfScore = 0, k; for(k in vec) tfidfScore += vec[k];
      tfidfScore = tfidfScore / Math.max(1, Math.sqrt(s.tokens.length)); // length-norm

      var kw = 0; s.tokens.forEach(function(t){ kw += (kwFreq[t]||0)/maxF; });
      var keywordScore = s.tokens.length ? kw / s.tokens.length : 0;

      // position: first & last sentences of doc/paragraph get boost
      var relPos = n<=1 ? 0 : i/(n-1);
      var positionScore = 0;
      if(relPos < 0.1) positionScore = 1 - relPos*5;       // intro boost
      else if(relPos > 0.9) positionScore = (relPos-0.9)*5*0.7; // conclusion boost
      else positionScore = 0.15;
      if(s.isParaFirst) positionScore += 0.25;
      if(s.isParaLast) positionScore += 0.1;

      var overlap = 0;
      s.tokens.forEach(function(t){ if(titleSet[t]) overlap++; });
      var titleSim = s.tokens.length ? overlap/Math.sqrt(s.tokens.length) : 0;

      var paraScore = (opts.paraImportance && opts.paraImportance[s.paraKey]!=null)
        ? opts.paraImportance[s.paraKey] : 0.5;

      // length penalty: too short or too long is bad
      var wc = s.wordCount || s.tokens.length || 1;
      var lengthScore = 1;
      if(wc < 6) lengthScore = wc/6*0.5;
      else if(wc > 40) lengthScore = Math.max(0.4, 40/wc);

      // number-heavy / quote sentences slight boost (facts)
      var factBoost = /[0-9]{2,}|%|€|\$|₺/.test(s.text) ? 0.08 : 0;

      var tr = (opts.textRankScores && opts.textRankScores[i]!=null) ? opts.textRankScores[i] : 0;

      var score = (tfidfScore*1.6) + (keywordScore*1.0) + (positionScore*0.8)
                + (titleSim*1.2) + (paraScore*0.6) + (tr*1.8);
      score = score * lengthScore + factBoost;

      return { index:i, score:score,
        parts:{tfidf:tfidfScore,kw:keywordScore,pos:positionScore,title:titleSim,para:paraScore,tr:tr} };
    });
  }

  // Jaccard-based duplicate suppression
  function dedupe(sortedIdx, sents, thresh){
    thresh = thresh||0.72;
    var kept=[], sets=sortedIdx.map(function(ix){
      var s={}; sents[ix].tokens.forEach(function(t){s[t]=1;}); return s;
    });
    sortedIdx.forEach(function(ix,k){
      var Bremain=true;
      for(var j=0;j<kept.length;j++){
        var A=sets[k], Bp=kept[j].set, inter=0, uni=0, t;
        for(t in A){ if(Bp[t]) inter++; uni++; }
        for(t in Bp){ if(!A[t]) uni++; }
        if(uni>0 && inter/uni >= thresh){ Bremain=false; break; }
      }
      if(Bremain) kept.push({ix:ix,set:sets[k]});
    });
    return kept.map(function(o){return o.ix;});
  }

  window.LocalPDF = window.LocalPDF || {};
  window.LocalPDF.scorer = { scoreSentences: scoreSentences, dedupe: dedupe };
})();
