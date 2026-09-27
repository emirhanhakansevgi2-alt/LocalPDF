/* LocalPDF main summarizer — extractive only, never invents sentences. */
(function(){
  var RATIOS = { short: 0.08, medium: 0.20, long: 0.35 };

  function cleanText(t){
    return String(t||"")
      .replace(/\r/g,"\n")
      .replace(/[ \t]+\n/g,"\n")
      .replace(/\n{3,}/g,"\n\n")
      .replace(/([a-zçğıöşü])-\n([a-zçğıöşü])/gi,"$1$2") // hyphen line-break
      .replace(/([^\n])\n([^\n])/g,"$1 $2")              // single newline -> space
      .replace(/[ \t]{2,}/g," ")
      .trim();
  }
  function stripHeadersFooters(pages){
    // remove lines repeated on >=40% of pages (running headers/footers) + bare page numbers
    var lineCount = {}, i, lines;
    pages.forEach(function(p){
      var seen = {};
      p.rawLines.forEach(function(l){
        l=l.trim(); if(l.length<2||l.length>120) return;
        if(/^\d{1,4}$/.test(l)) return;
        if(!seen[l]){ seen[l]=1; lineCount[l]=(lineCount[l]||0)+1; }
      });
    });
    var n = Math.max(1,pages.length), banned={};
    Object.keys(lineCount).forEach(function(l){ if(lineCount[l] >= Math.ceil(n*0.4) && n>2) banned[l]=1; });
    pages.forEach(function(p){
      p.lines = p.rawLines.filter(function(l){
        var t=l.trim();
        if(banned[t]) return false;
        if(/^\d{1,4}$/.test(t)) return false;
        if(/^(sayfa|page)\s*\d+(\s*\/\s*\d+)?$/i.test(t)) return false;
        return true;
      });
      p.text = cleanText(p.lines.join("\n"));
    });
    return pages;
  }

  function detectHeadings(fullText){
    // numbered headings, ALL-CAPS short lines, markdown # headings
    var out=[], lines = String(fullText||"").split("\n");
    lines.forEach(function(l){
      var t=l.trim(); if(!t||t.length>120) return;
      if(/^#{1,4}\s+\S/.test(t)) out.push(t.replace(/^#+\s*/,""));
      else if(/^\d{1,2}(\.\d{1,2})*\s+[A-ZÇĞİÖŞÜA-Za-zçğıöşü].{2,}$/.test(t)) out.push(t);
      else if(/^[A-ZÇĞİÖŞÜ][A-ZÇĞİÖŞÜ\s:\-–—]{4,60}$/.test(t) && t.split(" ").length<=9) out.push(t.charAt(0)+t.slice(1).toLowerCase());
    });
    return out.slice(0,40);
  }

  function summarize(pages, options){
    options = options||{};
    var mode = options.mode||"medium";
    var ratio = RATIOS[mode]||RATIOS.medium;
    var lang = options.lang || window.LocalPDF.detectLanguage(pages.map(function(p){return p.text;}).join("\n").slice(0,8000));

    var sents=[], pi=0;
    pages.forEach(function(p){
      var paras = window.LocalPDF.splitParagraphs(p.text);
      if(!paras.length && p.text.trim()) paras=[p.text];
      paras.forEach(function(para, paraIdx){
        var arr = window.LocalPDF.splitSentences(para, lang);
        arr.forEach(function(sText, si){
          var tokens = window.LocalPDF.tokenizeWords(sText, lang);
          if(tokens.length < 3) return; // skip noise
          sents.push({
            text:sText.trim(), tokens:tokens, pageNumber:p.pageNumber,
            paraKey:p.pageNumber+":"+paraIdx, paraIndex:pi,
            isParaFirst: si===0, isParaLast: si===arr.length-1,
            globalIndex:sents.length, wordCount:sText.trim().split(/\s+/).length
          });
        });
        pi++;
      });
    });

    if(!sents.length) return { error:"no-text", lang:lang, sentences:[] };

    var tf = window.LocalPDF.tfidf.computeTFIDF(sents);
    // similarity matrix (cap at 400 sentences for perf; sample evenly if bigger)
    var useIdx = sents.map(function(_,i){return i;});
    if(useIdx.length > 400){
      var step = useIdx.length/400; useIdx=[];
      for(var k=0;k<400;k++) useIdx.push(Math.floor(k*step));
    }
    var sub = useIdx.map(function(ix){return tf.tfidf[ix];});
    var sim = sub.map(function(a,i){ return sub.map(function(b,j){ return i===j?0:window.LocalPDF.tfidf.cosine(a,b); }); });
    // sparsify: keep top-8 edges per node
    sim.forEach(function(row){
      var idx = row.map(function(v,i){return [v,i];}).sort(function(x,y){return y[0]-x[0];});
      idx.slice(8).forEach(function(p){ row[p[1]]=0; });
    });
    var subTR = window.LocalPDF.textRank(sim);
    var trFull = new Array(sents.length).fill(0);
    useIdx.forEach(function(ix,k){ trFull[ix]=subTR[k]; });

    // paragraph importance = mean tfidf mass
    var paraScore={}, paraN={};
    sents.forEach(function(s,i){
      var m=0,t,vec=tf.tfidf[i]; for(t in vec) m+=vec[t];
      paraScore[s.paraKey]=(paraScore[s.paraKey]||0)+m; paraN[s.paraKey]=(paraN[s.paraKey]||0)+1;
    });
    Object.keys(paraScore).forEach(function(k){ paraScore[k]=paraScore[k]/paraN[k]; });
    var pmx=0; Object.keys(paraScore).forEach(function(k){ if(paraScore[k]>pmx) pmx=paraScore[k]; });
    if(pmx>0) Object.keys(paraScore).forEach(function(k){ paraScore[k]/=pmx; });

    var titleTokens = window.LocalPDF.tokenizeWords((options.title||"")+" "+sents.slice(0,3).map(function(s){return s.text;}).join(" "), lang);

    var scored = window.LocalPDF.scorer.scoreSentences(sents, {
      tfidfVectors: tf.tfidf, textRankScores: trFull, titleTokens: titleTokens, paraImportance: paraScore, lang: lang
    });
    scored.sort(function(a,b){return b.score-a.score;});
    var takeN = Math.max(3, Math.round(sents.length*ratio));
    takeN = Math.min(takeN, sents.length);
    var picked = window.LocalPDF.scorer.dedupe(scored.slice(0, takeN*2).map(function(o){return o.index;}), sents).slice(0, takeN);
    picked.sort(function(a,b){return sents[a].globalIndex - sents[b].globalIndex;}); // keep reading order

    // keywords: top TF-IDF mass + heading bonus
    var headings = detectHeadings(pages.map(function(p){return p.text;}).join("\n"));
    var headSet={}; headings.forEach(function(h){ window.LocalPDF.tokenizeWords(h,lang).forEach(function(t){headSet[t]=1;}); });
    var agg={}; sents.forEach(function(s,i){
      var vec=tf.tfidf[i], t;
      for(t in vec){ agg[t]=(agg[t]||0)+vec[t]*(headSet[t]?1.6:1); }
    });
    var keywords = Object.keys(agg).filter(function(w){return w.length>2;})
      .sort(function(a,b){return agg[b]-agg[a];}).slice(0,15);

    // sections: assign picked sentences to nearest preceding heading page-chunk
    var sections = buildSections(pages, sents, picked, headings, lang);

    return { lang:lang, mode:mode, sentences:sents, picked:picked.map(function(ix){return Object.assign({score:scored.filter(function(o){return o.index===ix;})[0].score}, sents[ix]);}),
      keywords:keywords, headings:headings, sections:sections, totalSentences:sents.length };
  }

  function buildSections(pages, sents, pickedIdx, headings, lang){
    if(!headings.length) return [];
    // naive: split doc into N chunks by headings order of appearance
    var full = pages.map(function(p){return p.text;}).join("\n");
    var chunks=[], cursor=0;
    headings.slice(0,12).forEach(function(h,hi){
      var pos = full.indexOf(h, cursor);
      if(pos===-1) return;
      var nextPos = hi+1<headings.length ? full.indexOf(headings[hi+1], pos+h.length) : full.length;
      if(nextPos===-1) nextPos=full.length;
      chunks.push({title:h, text:full.slice(pos, nextPos)});
      cursor = nextPos;
    });
    var pickedSet={}; pickedIdx.forEach(function(i){pickedSet[i]=1;});
    return chunks.map(function(c){
      var cSents=[];
      sents.forEach(function(s,i){ if(pickedSet[i] && c.text.indexOf(s.text.slice(0,40))!==-1) cSents.push(s); });
      return { title:c.title, sentences:cSents.slice(0,6) };
    }).filter(function(c){return c.sentences.length;}).slice(0,10);
  }

  window.LocalPDF = window.LocalPDF || {};
  window.LocalPDF.cleanText = cleanText;
  window.LocalPDF.stripHeadersFooters = stripHeadersFooters;
  window.LocalPDF.summarize = summarize;
})();
