import fs from 'node:fs';
import vm from 'node:vm';
const h=fs.readFileSync('www/index.html','utf8');
const scriptRe=/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g;
const scripts=[...h.matchAll(scriptRe)].map(m=>m[1]);
if (!scripts.length) throw Error('Missing inline client JS');
for(const s of scripts) new vm.Script(s);
for (const expected of ['id="file"','id="last-import"','id="liveUrl"','openLivePanel','Prijave uživo']) {
 if(!h.includes(expected)) throw Error('Missing UI element: '+expected);
}
if(!fs.existsSync('www/bridge.js')) throw Error('Missing native browser bridge');
console.log('Checked '+scripts.length+' client script(s); privacy-safe live-panel shell ready.');
