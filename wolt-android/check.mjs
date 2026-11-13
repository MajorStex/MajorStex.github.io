import fs from 'node:fs';
import vm from 'node:vm';
const h=fs.readFileSync('www/index.html','utf8');
const scripts=[...h.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(x=>x[1]);
if(scripts.length!==1)throw Error('Expected one client app script');
for(const s of scripts)new vm.Script(s);
for(const expected of ['APK v0.5.0','Otvori Wolt Kandidati uživo','/exec','id="auto"','id="status"','./bridge.js']){
 if(!h.includes(expected))throw Error('Missing: '+expected);
}
if(h.includes('id="file"')||h.includes('Uvoz kandidata'))throw Error('Manual import must not appear');
if(!fs.existsSync('www/bridge.js'))throw Error('Browser bridge missing');
console.log('Wolt Android APK v0.5: launch URL embedded, JS verified, no import, ready.');