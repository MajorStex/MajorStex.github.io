import fs from 'node:fs';
import * as esbuild from 'esbuild';
const LIVE_URL = 'https://script.google.com/macros/s/AKfycbyVnZybBteMaRBCoeRZ2j5mmsR1VoTpxGkYPg8RilRjCRVZgb2Ny5sbl_4xFdFWDkdD/exec';
const VERSION = '0.5.0';
fs.mkdirSync('www',{recursive:true});
const html = `<!doctype html>
<html lang="sr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#0b1927">
<title>Wolt Kandidati AUTO</title>
<style>
:root{color-scheme:dark;font-family:system-ui,Roboto,Arial,sans-serif;background:#081726;color:#edf7ff}
*{box-sizing:border-box}body{margin:0;min-height:100vh;background:linear-gradient(160deg,#0e2a3d,#091827 50%);padding:env(safe-area-inset-top) 0 env(safe-area-inset-bottom)}
header{padding:20px 18px;display:flex;align-items:center;justify-content:space-between;gap:10px;border-bottom:1px solid #2e485c;background:#0d2132}
.brand{display:flex;align-items:center;gap:12px}.logo{border-radius:14px;background:#00c9aa;color:#053c37;width:47px;height:47px;display:grid;place-items:center;font-size:25px;font-weight:900}
h1{font-size:18px;margin:0 0 3px}small{color:#94b2c4}header .version{font-size:11px;color:#c4dce7;background:#1a3a4d;border:1px solid #395c70;padding:7px;border-radius:9px;white-space:nowrap}
main{max-width:680px;margin:0 auto;padding:18px 16px}section{background:#102c3f;border:1px solid #284b60;border-radius:17px;padding:17px;margin-bottom:13px}
h2{font-size:17px;margin:0 0 12px}p{font-size:14px;line-height:1.55;color:#b6cfdd}
.stats{display:grid;grid-template-columns:repeat(2,1fr);gap:10px}
.stat{background:#163b4e;padding:13px;border-radius:12px}.stat b{display:block;font-size:15px}.stat small{font-size:12px}
button{width:100%;border:0;border-radius:12px;padding:15px 12px;font-size:16px;font-weight:750;cursor:pointer;background:#00cda9;color:#062e2c}
button.secondary{background:#244557;color:#effaff;margin-top:10px}
.note{font-size:12px;color:#9eb6c4;margin:13px 0 0}.switch{display:flex;align-items:center;gap:12px;margin:15px 0;font-size:14px;color:#d6e8f2}
.switch input{width:22px;height:22px;accent-color:#00cda9}
#status{border-radius:12px;background:#1c3d35;color:#c5ffe7;padding:12px;font-size:13px;line-height:1.5;margin-bottom:13px}
#status.warning{background:#43361f;color:#ffe1a3}
footer{text-align:center;color:#91afc1;font-size:12px;padding:15px;line-height:1.55}
a{color:#94ebec}
</style>
</head>
<body>
<header><div class="brand"><div class="logo">W</div><div><h1>Wolt Kandidati AUTO</h1><small>Meta → Google Sheets → privatni panel</small></div></div><span class="version">APK v${VERSION}</span></header>
<main>
<div id="status">Prijave se čuvaju u privatnoj Google tabeli. Otvaram povezani Wolt panel…</div>
<section>
<h2>Kandidati uživo</h2>
<p>Ova aplikacija direktno otvara tvoj već povezani Google Wolt panel, bez ručnog uvoza, kopiranja linka ili podešavanja. Prijavi se na svoj Google nalog ako Chrome to zatraži.</p>
<button id="open" type="button">Otvori Wolt Kandidati uživo</button>
<button id="retry" class="secondary" type="button">Ponovo otvori panel</button>
<p class="note">Prikaz, evidencija poziva i naučeni odgovori ažuriraju se preko postojećeg web panela. Podaci kandidata se ne čuvaju lokalno u ovoj APK.</p>
</section>
<section>
<h2>Stanje povezivanja</h2>
<div class="stats">
<div class="stat"><b>Meta → Sheets</b><small>Prethodno testirano</small></div>
<div class="stat"><b>Google → web</b><small>Privatni panel aktiviran</small></div>
<div class="stat"><b>WhatsApp slanje</b><small>Nije povezano</small></div>
<div class="stat"><b>Troškovi APK</b><small>0 € pretplate</small></div>
</div>
<label class="switch"><input type="checkbox" id="auto"> Automatski otvori kandidате pri pokretanju</label>
<p class="note">Radi kada je računar ugašen. Za pristup podacima potreban je internet na telefonu. Google prijavljivanje obavlja bezbedni sistemski pregledač, ne ugrađeni WebView.</p>
</section>
<section>
<h2>Automatizacija poruka</h2>
<p>Tekstovi poruka i odgovori čuvaju se u Wolt panelu. APK još ne šalje prve WhatsApp poruke automatski i ne označava ih kao poslate bez potvrde.</p>
</section>
<footer>Stalna adresa je ugrađena u APK. Nije potrebno instalirati novu APK za promene web izgleda i prikaza. Pristup Google panelu i dalje je ograničen nalogom vlasnika.</footer>
</main>
<script>
(function(){
  const url=${JSON.stringify(LIVE_URL)};
  const button=document.getElementById('open');
  const retry=document.getElementById('retry');
  const status=document.getElementById('status');
  const cb=document.getElementById('auto');
  const key='wolt_kandidati_autolaunch_v05';
  let opening=false;
  let auto=localStorage.getItem(key)!=='off';
  cb.checked=auto;
  cb.addEventListener('change',()=>{auto=cb.checked;localStorage.setItem(key,auto?'on':'off')});
  function show(message,error){status.textContent=message;status.className=error?'warning':''}
  function openPanel(){
    if(opening)return;
    opening=true;
    show('Otvaram privatni Google panel…');
    const doFallback=()=>{show('Panel se otvara u Chrome-u. Ako se nije otvorio, klikni ponovo.',true);window.open(url,'_blank','noopener')};
    if(typeof window.woltOpenUrl==='function'){
      Promise.resolve(window.woltOpenUrl(url)).then(()=>{
        show('Google panel je otvoren. Kada ga zatvoriš, vraćaš se u APK.');
      }).catch(doFallback).finally(()=>{opening=false});
    }else{
      doFallback();opening=false;
    }
  }
  button.addEventListener('click',openPanel);
  retry.addEventListener('click',openPanel);
  window.addEventListener('load',()=>{if(auto) setTimeout(openPanel,650);else show('Spremno. Dodirni „Otvori Wolt Kandidati uživo“.')});
})();
</script>
<script src="./bridge.js"></script>
</body></html>`;
fs.writeFileSync('www/index.html',html);
await esbuild.build({entryPoints:['bridge.js'],bundle:true,platform:'browser',format:'iife',outfile:'www/bridge.js'});
console.log('Wolt Kandidati AUTO Android v'+VERSION+' ready; private Google link embedded; no outbound messages.');
