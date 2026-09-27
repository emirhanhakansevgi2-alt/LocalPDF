/* Node smoke-test: TR/EN + i18n + low-token AI payload. Core AI-free, js/ai.js opt-in. */
const fs = require("fs"), vm = require("vm"), path = require("path");
const root = path.join(__dirname, "..");
global.window = {}; global.document = { getElementById:()=>null, querySelectorAll:()=>[], documentElement:{} };
global.localStorage = { getItem:()=>null, setItem:()=>{}, removeItem:()=>{} };
global.sessionStorage = { getItem:()=>null, setItem:()=>{}, removeItem:()=>{} };
function load(p){ vm.runInThisContext(fs.readFileSync(path.join(root,p),"utf8"), {filename:p}); }
["src/language/turkish.js","src/language/english.js","src/language/detector.js",
 "src/summarizer/tfidf.js","src/summarizer/textrank.js",
 "src/summarizer/scorer.js","src/summarizer/summarizer.js","js/ai.js"].forEach(load);
const L = window.LocalPDF;
let fail = 0;
function check(name, cond, extra){ console.log((cond?"PASS":"FAIL")+" - "+name+(extra?" | "+extra:"")); if(!cond) fail++; }
function pagesOf(text){ return [{pageNumber:1,rawLines:text.split("\n"),lines:text.split("\n"),text:L.cleanText(text)}]; }

// 1) Eski bug: "have/never/level" içeren İngilizce Türkçe sanılıyordu
check("EN 'have/never' bug düzeltildi", L.detectLanguage("I have never seen this level of detail in the report.")==="en");
check("TR algılama", L.detectLanguage("Fotosentez için klorofil ve ışık gereklidir. Bu süreçte glikoz oluşur.")==="tr");
check("TR chars (ç,ğ,ş) güçlü sinyal", L.detectLanguageDetail("Çalışma şeffaf bir şekilde görüşüldü.").lang==="tr");
check("boş metin güvenli", L.detectLanguage("")==="en");

// 2) Özetler
const trText = `Fotosentez bitkilerin ışık enerjisini kullanarak karbondioksit ve sudan glikoz ürettiği süreçtir. Klorofil bu süreçte ışığı yakalar. Oksijen yan ürün olarak açığa çıkar. Bitkiler gece fotosentez yapamaz çünkü ışık yoktur. Glikoz bitkinin büyümesi için enerji sağlar. Sonuç olarak fotosentez yaşamın temelidir.`;
const enText = `Photosynthesis converts light energy into chemical energy. Chlorophyll captures sunlight in leaves. Carbon dioxide and water produce glucose and oxygen. Plants cannot photosynthesize at night. Glucose fuels growth and respiration. In conclusion photosynthesis sustains life on Earth.`;
let r1 = L.summarize(pagesOf(trText), {mode:"short"});
check("TR özet", r1.lang==="tr" && r1.picked.length>=2);
check("TR uydurma yok", r1.picked.every(s=>trText.includes(s.text.slice(0,20))));
let r2 = L.summarize(pagesOf(enText), {mode:"long"});
check("EN özet", r2.lang==="en" && r2.picked.length>=2);
check("stopword TR", L.tokenizeWords("ve bir için fotosentez","tr").indexOf("ve")===-1);

// 3) Site tek dilli Türkçe (seçici ve i18n dosyası kaldırıldı)
check("i18n dosyası yok (tek dil)", !fs.existsSync(path.join(root,"src","language","i18n.js")));
check("sitede dil seçici yok", !/uiLang/.test(fs.readFileSync(path.join(root,"index.html"),"utf8")));

// 4) AI modülü: sadece K cümle gider, token tasarrufu
var fake={lang:"tr",summary:r1.picked,fullText:trText};
var m=L.ai.buildMessages(fake,3);
check("AI payload kısa (tam metinden küçük)", m.user.length < trText.length, m.user.length+"/"+trText.length);
check("AI token tahmini", L.ai.estimateTokens(m.user) < L.ai.estimateTokens(trText));

// 5) Çekirdek AI-free (ai.js hariç — o dosya bilerek opt-in)
var core=fs.readFileSync(path.join(root,"js/app.js"),"utf8")+fs.readFileSync(path.join(root,"src/summarizer/summarizer.js"),"utf8");
check("çekirdekte gömülü AI endpoint yok", !/api\.openai|api\.anthropic|generativelanguage/i.test(core));
var aiSrc=fs.readFileSync(path.join(root,"js/ai.js"),"utf8");
check("AI modülü opt-in (varsayılan kapalı mantığı)", /enabled/.test(aiSrc) && /Bearer/.test(aiSrc));

// 6) Entegrasyon dokümanı + site bağlantısı mevcut
check("AI entegrasyon dokümanı", fs.existsSync(path.join(root,"docs","AI-ENTEGRASYON.md")));
check("sitede rehber bölümü", /Kendi Yapay/.test(fs.readFileSync(path.join(root,"index.html"),"utf8")));

console.log(fail? `\n${fail} test BAŞARISIZ` : "\nTüm testler geçti ✓");
process.exit(fail?1:0);
