import fs from 'node:fs';
import path from 'node:path';
const base=path.resolve('../wolt-kandidati');
if (!fs.existsSync(path.join(base,'index.html'))) throw new Error('Nedostaje izvorni Wolt panel');
fs.mkdirSync('www',{recursive:true});
let html=fs.readFileSync(path.join(base,'index.html'),'utf8')
 .replaceAll('v0.2','v0.4')
 .replaceAll('v0.1','v0.4')
 .replace('Wolt Kandidati — kontrolni panel','Wolt Kandidati — Android panel');
html=html.replace(/if\('serviceWorker' in navigator\)navigator\.serviceWorker\.register\('\.\/sw\.js'\)\.catch\(function\(\)\{\}\);?/,'');
html=html.replace('<\/head>', '<meta name="mobile-web-app-capable" content="yes"><\/head>');
html=html.replace(/<div class="warning">[\s\S]*?<\/div>/,
 '<div class="warning"><strong>META → GOOGLE SHEETS: POVEZANO</strong><br>Nove prijave stižu u tvoju privatnu tabelu. Za prikaz unutar Wolt aplikacije potrebno je još jednom dozvoliti Google pristup kroz privatni live panel. WhatsApp automatsko slanje nije aktivno.</div>');

const liveCard = '<div class="card"><h2>Prijave uživo — bez ručnog uvoza</h2>'
 +'<p><b>Meta automatski popunjava WOLT AUTO.</b> Testna prijava je uspešno stigla. Da bi aplikacija prikazivala privatne podatke, potrebno je odobreno Google povezivanje.</p>'
 +'<p>Niko neće biti automatski kontaktiran dok ne proverimo slanje i zaštitu od duplih poruka.</p>'
 +'<div class="inline"><button onclick="openLivePanel()">Otvori privatni pregled</button><button class="secondary" onclick="showTab(\'settings\')">Poveži Google</button></div>'
 +'<p id="last-import" style="display:none"></p><input id="file" type="file" style="display:none" aria-hidden="true"></div>';
const importCard = /<div class="card"><h2>Uvoz kandidata<\/h2>[\s\S]*?(?=<div class="card"><h2>Šta radi besplatno\?<\/h2>)/;
if(!importCard.test(html)) throw Error('Card selector no longer matches original HTML');
html=html.replace(importCard,liveCard);

const newSettings='<div class="card"><h2>Prijave uživo — privatni Google panel</h2>'
 +'<p>Originalni Excel ostaje netaknut. Nakon jednokratnog Google odobrenja, ovaj link otvara prijave direktno iz META_ULAZ bez izvoza i ručnog uvoza.</p>'
 +'<label>Link od privatnog Google Apps Script panela (posle odobrenja)<input id="liveUrl" type="url" placeholder="https://script.google.com/macros/s/.../exec" autocomplete="off"></label>'
 +'<input id="sheet" type="hidden" value="https://docs.google.com/spreadsheets/d/1vpTbCSxkNtHtJNbJ_hlM-wPuK1N52h2j0v2OQFk06x8/edit">'
 +'<div class="inline" style="margin-top:12px"><button onclick="saveSettings()">Sačuvaj</button><button class="secondary" onclick="openLivePanel()">Otvori privatni pregled</button></div>'
 +'<p>Još nije automatski povezan dok Google odobrenje nije završeno. Ne deli podatke javno niti stavljaj „Anyone with the link“.</p></div>';
const settingsCard=/<div class="card"><h2>Izvor kandidata<\/h2>[\s\S]*?(?=<div class="card"><h2>Link da kandidat prvi piše<\/h2>)/;
if(!settingsCard.test(html)) throw Error('Settings selector no longer matches original HTML');
html=html.replace(settingsCard,newSettings);
html=html.replace("settings:{sheet:'',businessNumber:''}", "settings:{sheet:'',businessNumber:'',liveUrl:''}");
html=html.replace("S.settings.businessNumber=document.getElementById('businessNumber').value.trim();", "S.settings.businessNumber=document.getElementById('businessNumber').value.trim();S.settings.liveUrl=document.getElementById('liveUrl').value.trim();");
html=html.replace("document.getElementById('businessNumber').value=S.settings.businessNumber;render();", "document.getElementById('businessNumber').value=S.settings.businessNumber;document.getElementById('liveUrl').value=S.settings.liveUrl||'';render();");
const liveFns = String.raw`
function openLivePanel(){
  var field=document.getElementById('liveUrl');
  var url=(field.value||S.settings.liveUrl||'').trim();
  var parsed;
  try{parsed=new URL(url)}catch(_){parsed=null}
  if(!parsed||parsed.protocol!=='https:'||parsed.hostname!=='script.google.com'||!parsed.pathname.startsWith('/macros/s/')||!parsed.pathname.endsWith('/exec')){
    toast('Prvo poveži privatni Google panel kroz Podešavanja.');
    showTab('settings');
    return;
  }
  S.settings.liveUrl=url;persist();
  var browser=window.Capacitor&&window.Capacitor.Plugins&&window.Capacitor.Plugins.Browser;
  if(browser&&browser.open){browser.open({url:url}).catch(function(){window.open(url,'_blank')})}
  else window.open(url,'_blank');
}
`;
html=html.replace("function saveSettings(){",liveFns+"\nfunction saveSettings(){");
html=html.replace('<script src="https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"></script>','');
if(!html.includes('function openLivePanel()')) throw Error('Live panel handler missing');
fs.writeFileSync('www/index.html',html);
for(const f of ['icon.svg','manifest.json'])fs.copyFileSync(path.join(base,f),path.join('www',f));
console.log('Built Android v0.4 private live-panel launcher: '+html.length+' bytes');
