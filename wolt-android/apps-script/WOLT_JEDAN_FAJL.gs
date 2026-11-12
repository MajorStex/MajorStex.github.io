/**
 * WOLT Kandidati — private Google Sheets backend / live dashboard
 * Google Apps Script, bound to or standalone from the WOLT AUTO spreadsheet.
 * IMPORTANT: deploy as "Execute as me" AND "Who has access: Only myself".
 * Never set Anyone; this project holds candidates' personal data.
 * Does NOT send WhatsApp messages or update the original Excel file.
 */
const WOLT_SHEET_ID = '1vpTbCSxkNtHtJNbJ_hlM-wPuK1N52h2j0v2OQFk06x8';
const SOURCE_TAB = 'META_ULAZ';
const STATUS_TAB = 'STATUSI';
const BLOCKED_TEST_IDS = new Set(['l:2327196261413284']);
const MAX_ROWS = 2000;

function doGet() {
  return HtmlService.createHtmlOutput(WOLT_INDEX_HTML)
    .setTitle('Wolt Kandidati — uživo')
    .addMetaTag('viewport','width=device-width, initial-scale=1, viewport-fit=cover');
}

function getOverview() {
  const book = SpreadsheetApp.openById(WOLT_SHEET_ID);
  const src = book.getSheetByName(SOURCE_TAB);
  const states = book.getSheetByName(STATUS_TAB);
  if (!src || !states) throw new Error('Nedostaje META_ULAZ ili STATUSI.');
  const last = src.getLastRow();
  const width = Math.min(18, src.getLastColumn());
  if (last < 2) return { candidates:[], stats:{total:0,new:0,contacted:0,test:0}, checkedAt:new Date().toISOString() };
  const block = src.getRange(1, 1, Math.min(last, MAX_ROWS+1), width).getDisplayValues();
  const header = block.shift().map(s=>String(s||'').toLowerCase().trim());
  const idx = (names,backup) => {
    for (const n of names) { const i=header.findIndex(h=>h===n); if (i>=0) return i; }
    return backup;
  };
  const iId = idx(['id','lead id','lead_id'],0);
  const iDate = idx(['created_time','timestamp'],1);
  const iName = idx(['full name','full_name','ime i prezime'],13);
  const iPhone = idx(['phone','phone_number','telefon'],14);
  const iEmail = idx(['email','e-mail'],15);
  const iCity = idx(['city','grad','mesto'],-1);
  const iStatus = idx(['lead_status'],17);
  const stateMap=new Map();
  if (states.getLastRow()>1) {
    const sv=states.getRange(2,1,Math.min(states.getLastRow()-1,MAX_ROWS),6).getDisplayValues();
    sv.forEach(r=>{if(r[0])stateMap.set(r[0],{status:r[1]||'',comment:r[2]||'',channel:r[3]||'',confirmedAt:r[4]||''});});
  }
  const dedup = new Set();
  const candidates=[];
  let tests=0, old=0, contacted=0, needsContact=0;
  // Latest first by source ordering when applicable; sorting by parsed date is below.
  for(const row of block) {
    const id=String(row[iId]||'').trim();
    const phone=String(row[iPhone]||'').trim();
    if(!id || !phone) continue;
    const normalized=phone.replace(/[^\d+]/g,'');
    const state=stateMap.get(id)||{};
    const test=BLOCKED_TEST_IDS.has(id) || /<test lead/i.test(row[iName]||'') || /<test lead/i.test(phone) || state.status==='TEST';
    if(test){tests++;continue;}
    if(dedup.has(normalized)){old++;continue;}
    dedup.add(normalized);
    const status=state.status||'NIJE POZVAN';
    if(status==='POZVAN')contacted++; else if(status==='NIJE POZVAN')needsContact++;
    candidates.push({
      id, date:String(row[iDate]||''),
      name:String(row[iName]||'').slice(0,140),
      phone:phone.slice(0,50),
      city:iCity>=0?String(row[iCity]||'').slice(0,100):'',
      email:String(row[iEmail]||'').slice(0,140),
      status, comment:(state.comment||'').slice(0,180),
      channel:state.channel||'', leadStatus:String(row[iStatus]||'')
    });
  }
  candidates.sort((a,b)=>(Date.parse(b.date)||0)-(Date.parse(a.date)||0));
  return {
    candidates:candidates.slice(0,500),
    stats:{total:candidates.length,new:needsContact,contacted,test:tests,duplicate:old},
    checkedAt:new Date().toISOString(),
    source:'WOLT AUTO / META_ULAZ',
    note:'Prikaz je uživo. Nijedna poruka se ne šalje; izvorni Excel se ne menja.'
  };
}


const WOLT_INDEX_HTML = `<!doctype html>
<html lang="sr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>Wolt Kandidati — uživo</title>
<style>
:root{color-scheme:dark;font-family:system-ui,-apple-system,Roboto,sans-serif;background:#091525;color:#e9f9ff}
*{box-sizing:border-box}body{margin:0;background:#091525;padding:0 0 30px}
header{position:sticky;top:0;background:#102638eF;padding:15px 16px;border-bottom:1px solid #314a5b;z-index:1}
h1{margin:0;font-size:20px}small,p{color:#98b5c8}small{display:block;margin-top:4px}
main{padding:15px;max-width:800px;margin:auto}.status{margin-bottom:12px;padding:12px;background:#233424;border-radius:12px;color:#dff3d4;font-size:13px}
.stats{display:grid;grid-template-columns:repeat(3,1fr);gap:9px}.stat{padding:13px 8px;text-align:center;background:#173448;border:1px solid #2b5060;border-radius:14px}
.num{font-size:28px;font-weight:bold}.tag{color:#b7cad6;font-size:12px}
.row{margin-top:12px;display:flex;gap:9px}.row>*{flex:1}
button,input{font:inherit;border-radius:11px;min-height:43px}
button{border:0;background:#03c4a6;color:#052927;font-weight:700;padding:9px 16px}
input{border:1px solid #406174;background:#102438;color:#fff;padding:12px;width:100%;margin:14px 0}
.item{background:#122a3c;border:1px solid #2b4a5d;border-radius:13px;padding:13px;margin:8px 0}
.name{font-weight:750;font-size:16px}.meta{font-size:12px;color:#9fbece;margin-top:5px;word-break:break-word}
.badge{display:inline-block;border-radius:10px;background:#184a45;color:#b2f4df;padding:4px 7px;margin-top:7px;font-size:11px}
.error{background:#59262b;color:#ffdddd}
footer{font-size:12px;color:#9ab2c2;padding:15px;line-height:1.4}
</style>
</head>
<body>
<header><h1>Wolt Kandidati — uživo</h1><small>Meta → WOLT AUTO · privatni Google panel</small></header>
<main>
<div id="status" class="status">Povezujem sa Google tabelom…</div>
<div class="stats">
 <div class="stat"><div class="num" id="total">–</div><div class="tag">Kandidati</div></div>
 <div class="stat"><div class="num" id="new">–</div><div class="tag">Nije pozvan</div></div>
 <div class="stat"><div class="num" id="contacted">–</div><div class="tag">Pozvan</div></div>
</div>
<div class="row"><button onclick="refresh()">Osveži sada</button></div>
<input id="filter" type="search" placeholder="Pretraži ime, telefon ili grad" oninput="draw()">
<section id="items"></section>
<footer>Bezbednost: pristup samo ovlašćenom Google nalogu. Testni kandidati su izuzeti. Nema automatskog slanja WhatsApp poruka niti upisa u originalni Excel. Automatsko osvežavanje ekrana na 60 sekundi dok je otvoren.</footer>
</main>
<script>
let all=[], loading=false,hasLoaded=false;
const fmt=v=>String(v||'');
const txt=(id,v)=>{document.getElementById(id).textContent=v;};
function refresh(){
 if(loading || document.hidden)return;
 loading=true;
 txt('status','Proveravam novu prijavu…');
 google.script.run.withSuccessHandler(data=>{
  loading=false;hasLoaded=true;all=data.candidates||[];
  txt('total',data.stats.total);txt('new',data.stats.new);
  txt('contacted',data.stats.contacted);
  txt('status','Povezano · provereno '+new Date().toLocaleTimeString('sr-RS')+' · test '+data.stats.test+' izuzet');
  document.getElementById('status').className='status';draw();
 }).withFailureHandler(e=>{
  loading=false;txt('status','Greška u povezivanju: '+fmt(e.message||e));
  document.getElementById('status').className='status error';
 }).getOverview();
}
function draw(){
 const list=document.getElementById('items');
 list.replaceChildren();
 const q=document.getElementById('filter').value.trim().toLowerCase();
 const filtered=all.filter(x=>(x.name+' '+x.phone+' '+x.city).toLowerCase().includes(q));
 if(!filtered.length){let el=document.createElement('p');el.textContent=hasLoaded?'Nema prijava za ovaj filter.':'Učitavanje…';list.append(el);return}
 for(const x of filtered){
  const box=document.createElement('article');box.className='item';
  const name=document.createElement('div');name.className='name';name.textContent=x.name||'Bez imena';
  const phone=document.createElement('div');phone.className='meta';phone.textContent=x.phone;
  const date=document.createElement('div');date.className='meta';date.textContent=fmt(x.date)+(x.city?' · '+x.city:'');
  const status=document.createElement('span');status.className='badge';status.textContent=x.status;
  box.append(name,phone,date,status);list.append(box);
 }
}
document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh()});
setInterval(()=>{if(!document.hidden)refresh()},60000);
refresh();
</script>
</body>
</html>`;
