import fs from 'node:fs';
import path from 'node:path';
const base=path.resolve('../wolt-kandidati');
if (!fs.existsSync(path.join(base,'index.html'))) throw new Error('Nedostaje izvorni Wolt panel');
fs.mkdirSync('www',{recursive:true});
let html=fs.readFileSync(path.join(base,'index.html'),'utf8')
 .replaceAll('v0.2','v0.3')
 .replaceAll('v0.1','v0.3')
 .replace('Wolt Kandidati — kontrolni panel','Wolt Kandidati — Android panel');
html=html.replace(/if\('serviceWorker' in navigator\)navigator\.serviceWorker\.register\('\.\/sw\.js'\)\.catch\(function\(\)\{\}\);?/,'');
html=html.replace('</head>','<meta name="mobile-web-app-capable" content="yes"></head>');
html=html.replace(/<div class="warning">[\s\S]*?<\/div>/,
 '<div class="warning"><strong>LOKALNI ANDROID PANEL — SLANJE ISKLJUČENO</strong><br>Ova verzija čuva kandidate i naučene odgovore lokalno. Google Drive, Meta i WhatsApp još nisu povezani za automatski rad. Poruke se NE šalju same, a Excel se NE menja. Ne unosite posebne kategorije ličnih podataka.</div>');
fs.writeFileSync('www/index.html',html);
for(const f of ['icon.svg','manifest.json']) fs.copyFileSync(path.join(base,f),path.join('www',f));
console.log('Built local-only Android web assets: '+html.length+' bytes');
