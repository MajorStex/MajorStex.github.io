/**
 * WOLT Kandidati — private Google Sheets backend / live dashboard
 * Google Apps Script, bound to or standalone from the WOLT AUTO spreadsheet.
 * IMPORTANT: deploy as "Execute as me" AND "Who has access: Only myself".
 * Never set Anyone; this project holds candidates' personal data.
 * Does NOT send WhatsApp messages or update the original Excel file.
 */
const WOLT_WEB_VERSION = '1.4.1';
const WOLT_SHEET_ID = '1vpTbCSxkNtHtJNbJ_hlM-wPuK1N52h2j0v2OQFk06x8';
const SOURCE_TAB = 'META_ULAZ';
const STATUS_TAB = 'STATUSI';
const ARCHIVE_TAB = 'ARHIVA_BROJEVA_KONTEKST';
const BLOCKED_TEST_IDS = new Set(['l:2327196261413284']);
const MAX_ROWS = 2000;

function normalizePhone_(raw) {
  let digits=String(raw||'').replace(/\D/g,'');
  if(digits.startsWith('00381'))digits=digits.slice(2);
  if(digits.startsWith('0')&&digits.length>=9)digits='381'+digits.slice(1);
  return digits;
}

/* One-time deployed Apps Script backend. The UI comes from an owner-controlled
 * GitHub repository. Only UI code is fetched; candidate data stays in private
 * Google Sheets and is returned only through authorized google.script.run calls.
 * Backend changes still require a versioned deployment update.
 */
const WOLT_UI_SOURCE = 'https://raw.githubusercontent.com/MajorStex/MajorStex.github.io/main/wolt-kandidati/live-panel.html';
function getWoltUiHtml_() {
  const cache = CacheService.getScriptCache();
  const cached = cache.get('wolt_live_ui_v1');
  if(cached && cached.includes('data-wolt-app="candidate-dashboard"')) return cached;
  try {
    const result = UrlFetchApp.fetch(WOLT_UI_SOURCE + '?minute=' + Math.floor(Date.now() / 60000), {
      followRedirects:true,
      muteHttpExceptions:true,
      headers:{'Accept':'text/html'}
    });
    if(result.getResponseCode() !== 200) throw new Error('UI HTTP '+result.getResponseCode());
    const html = result.getContentText('UTF-8');
    if(html.length > 120000 || !html.includes('data-wolt-app="candidate-dashboard"') ||
       !html.includes('google.script.run') || !html.includes('id="items"')) {
      throw new Error('Nepoznat ili neispravan UI.');
    }
    cache.put('wolt_live_ui_v1', html, 60);
    return html;
  } catch(e) {
    console.log('Live UI nije trenutno dostupan, koristim rezervni HTML: '+String(e));
    return WOLT_INDEX_HTML;
  }
}

function testAutoAzuriranja() {
  const html = getWoltUiHtml_();
  const auto = html.includes('UI auto-ažuriranje');
  const version = (html.match(/WEB v[0-9.]+/) || ['nepoznato'])[0];
  Logger.log('WOLT: '+version+' · '+(auto ? 'Google pristup i automatsko učitavanje rade.' : 'Rezervni prikaz: proveriti UrlFetch autorizaciju i GitHub dostupnost.'));
  return {version:version, uiAutomatski:auto};
}

function doGet() {
  return HtmlService.createHtmlOutput(getWoltUiHtml_())
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
  const start = Math.max(2, last - MAX_ROWS + 1);
  const header = src.getRange(1,1,1,width).getDisplayValues()[0].map(s=>String(s||'').toLowerCase().trim());
  const block = src.getRange(start,1,last-start+1,width).getDisplayValues();
  const idx = (names,backup) => {
    for (const n of names) { const i=header.findIndex(h=>h===n); if (i>=0) return i; }
    return backup;
  };
  const iId = idx(['id','lead id','lead_id'],0);
  const iDate = idx(['created_time','timestamp'],1);
  const iName = idx(['full name','full_name','ime i prezime'],13);
  const iPhone = idx(['phone','phone_number','telefon'],14);
  const iEmail = idx(['email','e-mail'],15);

  const iCity = idx(['city','grad','mesto','town','city/town'],-1);
  const iAddress = idx(['adresa','address','street address','full address','street_address'],-1);
  // In the current Meta Instant Form, the city is commonly submitted in custom answer column M.
  const iExtra = header.findIndex(h=>h.includes('ostavite nam vaš broj mobilnog telefona'));
  const iStatus = idx(['lead_status'],17);
  const stateMap=new Map();
  if (states.getLastRow()>1) {
    const statusStart=Math.max(2,states.getLastRow()-MAX_ROWS+1);
    const sv=states.getRange(statusStart,1,states.getLastRow()-statusStart+1,6).getDisplayValues();
    sv.forEach(r=>{if(r[0])stateMap.set(r[0],{status:r[1]||'',comment:r[2]||'',channel:r[3]||'',confirmedAt:r[4]||''});});
  }
  const archiveSheet = book.getSheetByName(ARCHIVE_TAB);
  // The archived phone list comes from the original Excel. That original file is never modified.
  const archived = new Set();
  if(archiveSheet && archiveSheet.getLastRow()>1) {
    archiveSheet.getRange(2,1,archiveSheet.getLastRow()-1,1).getDisplayValues()
      .forEach(r=>{const n=normalizePhone_(r[0]);if(n)archived.add(n)});
  }
  const dedup = new Set();
  const candidates=[];
  let tests=0, old=0, contacted=0, needsContact=0;
  // Latest first by source ordering when applicable; sorting by parsed date is below.
  for(const row of block) {
    const id=String(row[iId]||'').trim();
    const phone=String(row[iPhone]||'').trim();
    if(!id || !phone) continue;
    const normalized=normalizePhone_(phone);
    const state=stateMap.get(id)||{};
    const test=BLOCKED_TEST_IDS.has(id) || /<test lead/i.test(row[iName]||'') || /<test lead/i.test(phone) || state.status==='TEST';
    if(test){tests++;continue;}
    if(dedup.has(normalized)){old++;continue;}
    dedup.add(normalized);
    // A fresh Meta form submission is a new expression of interest even if the phone exists in the old Excel.
    // Prior contact is recorded as context, not an automatic block. Respect any explicit STOP / opt-out.
    const isReapplicant=archived.has(normalized);

    const status=state.status||'NIJE POZVAN';
    const extra=iExtra>=0?String(row[iExtra]||'').trim().slice(0,180):'';
    const emailFromExtra=/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(extra)?extra:'';
    const cityFromExtra=/^[a-zA-ZčćžđšČĆŽĐŠа-яА-Я\s.,-]{2,90}$/.test(extra) && !/<test lead/i.test(extra)?extra:'';
    const resolvedCity=iCity>=0?String(row[iCity]||'').trim():cityFromExtra;
    const resolvedEmail=String(row[iEmail]||'').trim()||emailFromExtra;
    const resolvedAddress=iAddress>=0?String(row[iAddress]||'').trim():'';
    if(status==='POZVAN')contacted++; else if(status==='NIJE POZVAN')needsContact++;
    candidates.push({
      id, date:String(row[iDate]||''),
      dateLabel: isNaN(Date.parse(row[iDate])) ? String(row[iDate]||'') : Utilities.formatDate(new Date(row[iDate]),'Europe/Belgrade','dd.MM.yyyy HH:mm'),
      name:String(row[iName]||'').slice(0,140),
      phone:phone.replace(/^p:/i,'').trim().slice(0,50),

      city:resolvedCity.slice(0,100),
      email:resolvedEmail.slice(0,140),
      address:resolvedAddress.slice(0,160),
      extraAnswer:extra,
      campaign:String(row[7]||'').slice(0,140),
      formName:String(row[9]||'').slice(0,140),
      status, reapplicant:isReapplicant, comment:(state.comment||'').slice(0,180),
      channel:state.channel||'', sentChannel:state.confirmedAt ? (state.channel||'') : '', sentAt:String(state.confirmedAt||''), leadStatus:String(row[iStatus]||'')
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



/** Private status/learning backend. All outbound message delivery remains disabled. */
function getAutomationSetup() {
  const ss=SpreadsheetApp.openById(WOLT_SHEET_ID);
  const p=ss.getSheetByName('PORUKE_PODESAVANJA');
  const k=ss.getSheetByName('NAUCENI_ODGOVORI');
  if(!p||!k) throw new Error('Nedostaju pomoćni listovi za poruke i odgovore.');
  const pv=p.getRange(2,1,Math.max(1,p.getLastRow()-1),5).getDisplayValues();
  const kv=k.getRange(2,1,Math.max(1,Math.min(200,k.getLastRow()-1)),7).getDisplayValues();
  return {
    messages:pv.filter(x=>x[0]).map(x=>({id:x[0],text:x[1],state:x[2],when:x[3]})),
    answers:kv.filter(x=>x[0]).map(x=>({question:x[0],keywords:x[1],answer:x[2],approved:x[3],source:x[4]})),
    sendingEnabled:false
  };
}

function saveCandidateStatus(input) {
  const id=String(input&&input.id||'').trim();
  const status=String(input&&input.status||'').trim().toUpperCase();
  const comment=String(input&&input.comment||'').trim();
  const channel=String(input&&input.channel||'').trim();
  const confirmed=Boolean(input&&input.confirmed);
  const allowed=['NIJE POZVAN','POZVAN','ODGOVORIO','ČEKA ODGOVOR','GREŠKA','ODUSTAO','STOP'];
  if(!id||id.length>130||!allowed.includes(status)) throw new Error('Neispravan kandidat ili status.');
  if(comment.length>700) throw new Error('Komentar je predugačak.');
  if(status==='POZVAN' && (!confirmed || !['WhatsApp','Viber','Telefon','Drugo'].includes(channel))){
    throw new Error('Za status POZVAN potreban je stvarno potvrđen kontakt i kanal.');
  }
  const lock=LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const ss=SpreadsheetApp.openById(WOLT_SHEET_ID);
    const leads=ss.getSheetByName(SOURCE_TAB);
    const statuses=ss.getSheetByName(STATUS_TAB);
    if(!leads||!statuses) throw new Error('Nedostaje evidencija.');
    const max=Math.min(leads.getLastRow()-1,10000);
    const leadIds=max>0?leads.getRange(2,1,max,1).getDisplayValues().map(r=>r[0]):[];
    if(BLOCKED_TEST_IDS.has(id) || !leadIds.includes(id)) throw new Error('Testni ili nepoznat kandidat.');
    const rows=Math.max(0,statuses.getLastRow()-1);
    const ids=rows?statuses.getRange(2,1,rows,1).getDisplayValues().map(r=>r[0]):[];
    const at=ids.indexOf(id);
    // Keep the original first manually confirmed send timestamp when editing notes or status.
    // A later explicitly confirmed send updates the timestamp; merely opening WA/Viber never does.
    const prior=at>=0 ? statuses.getRange(at+2,1,1,6).getDisplayValues()[0] : [];
    const newConfirmed=(status==='POZVAN' && confirmed);
    const timestamp=newConfirmed
      ? Utilities.formatDate(new Date(),'Europe/Belgrade','dd.MM.yyyy HH:mm:ss')
      : String(prior[4]||'');
    const contactChannel=channel || (timestamp ? String(prior[3]||'') : '');
    const record=[id,status,comment,contactChannel,timestamp,
      timestamp?'Ručno potvrđeno u privatnom panelu; nije potvrda WhatsApp/Viber provajdera.':'Nema potvrde o poslatoj poruci.'];
    if(at>=0) statuses.getRange(at+2,1,1,6).setValues([record]);
    else statuses.getRange(statuses.getLastRow()+1,1,1,6).setValues([record]);
    return {ok:true,status:status,sentAt:timestamp,sentChannel:contactChannel};
  } finally {lock.releaseLock();}
}

function addLearnedAnswer(input) {
  const question=String(input&&input.question||'').trim();
  const keywords=String(input&&input.keywords||'').trim();
  const answer=String(input&&input.answer||'').trim();
  if(question.length<4 || question.length>180 || answer.length<5 || answer.length>1500 || keywords.length>250) {
    throw new Error('Popuni pitanje (4–180 znakova) i odgovor (5–1500 znakova).');
  }
  const lock=LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const tab=SpreadsheetApp.openById(WOLT_SHEET_ID).getSheetByName('NAUCENI_ODGOVORI');
    if(!tab) throw new Error('Nedostaje baza odgovora.');
    tab.appendRow([question,keywords,answer,'NE — čeka povezivanje','Unos vlasnika',Utilities.formatDate(new Date(),'Europe/Belgrade','dd.MM.yyyy HH:mm:ss'),'Nije automatski poslato nijednom kandidatu.']);
    return {ok:true};
  } finally {lock.releaseLock();}
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
.appHeader{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}.versionPanel{display:flex;flex-direction:column;align-items:flex-end;gap:1px;background:#1b3648;border:1px solid #38556a;border-radius:10px;padding:7px 11px;white-space:nowrap}.versionPanel strong{font-size:13px;font-weight:800;color:#e9f9ff;letter-spacing:.2px}.versionPanel span{font-size:10px;color:#9fb9cb}@media(max-width:480px){.appHeader{flex-wrap:nowrap}.versionPanel{padding:6px 8px}.versionPanel span{font-size:9px}}
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

.panel{background:#122a3c;border:1px solid #345063;border-radius:14px;padding:14px;margin-top:14px}
.panel h2{font-size:17px;margin:0 0 11px}
.panel label{display:block;color:#b9d0dc;font-size:13px;margin-top:12px}
.panel textarea,.panel select,.panel input{display:block;width:100%;margin:6px 0 10px;background:#091c2c;color:#fff;border:1px solid #406174;border-radius:9px;padding:11px;font:inherit}
.panel textarea{min-height:90px;resize:vertical}
.secondary{background:#233d51;color:#ecf7ff}
.action{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:10px}
.action button{flex:1}
.note{color:#b4c9d6;font-size:12px;line-height:1.5}
</style>
</head>
<body>
<header class="appHeader"><div><h1>Wolt Kandidati — uživo</h1><small>Meta → WOLT AUTO · privatni Google panel</small></div><div class="versionPanel" aria-label="Verzija web aplikacije"><strong>WEB v1.3.0</strong><span>rezervni prikaz</span></div></header>
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
<section class="panel" id="configPanel">
<h2>Automatizacija poruka</h2>
<p class="note"><b>WhatsApp i Viber: slanje isključeno.</b> Povezivanje sa Metom preuzima prijave automatski. Tekstove poruka i naučene odgovore čuvamo, ali nijedan prvi kontakt se ne šalje bez podržanog servisa.</p>
<div id="msgTemplates" class="note">Učitavam predloge poruka…</div>
</section>
<section class="panel" id="knowledgePanel">
<h2>Nauči aplikaciju odgovor</h2>
<p class="note">Ovde unosiš primer pitanja i svoj odgovor. Čuva se u Google tabeli za buduću automatsku obradu kada povežemo podržani kanal.</p>
<label>Kako je kandidat pitao?<textarea id="teachQ" placeholder="Primer: Koliko mogu da zaradim?"></textarea></label>
<label>Slična pitanja / ključne reči<input id="teachKeywords" placeholder="plata, zarada, isplata"></label>
<label>Tvoj odgovor<textarea id="teachA" placeholder="Ovde napiši odgovor koji želiš da zapamtimo."></textarea></label>
<button onclick="learn()">Zapamti ovaj odgovor</button>
<div id="teachStatus" class="note"></div>
<div id="learned" class="note"></div>
</section>

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
  const date=document.createElement('div');date.className='meta';date.textContent=fmt(x.dateLabel||x.date)+(x.city?' · '+x.city:'');
  const status=document.createElement('span');status.className='badge';status.textContent=x.reapplicant ? x.status+' · PONOVNA PRIJAVA' : x.status;

  const toggle=document.createElement('button');toggle.className='secondary';toggle.textContent='Evidentiraj kontakt / komentar';
  toggle.style.marginTop='10px';
  const edit=document.createElement('div');edit.className='panel';edit.style.display='none';
  const choices=document.createElement('select');
  for(const v of ['NIJE POZVAN','POZVAN','ODGOVORIO','ČEKA ODGOVOR','ODUSTAO','STOP','GREŠKA']){
    const opt=document.createElement('option');opt.value=v;opt.textContent=v;choices.append(opt);
  }
  choices.value=['NIJE POZVAN','POZVAN','ODGOVORIO','ČEKA ODGOVOR','ODUSTAO','STOP','GREŠKA'].includes(x.status)?x.status:'NIJE POZVAN';
  const channel=document.createElement('select');channel.className='contactChannel';
  for(const v of ['','WhatsApp','Viber','Telefon','Drugo']){
    const opt=document.createElement('option');opt.value=v;opt.textContent=v||'Izaberi kanal';channel.append(opt);
  }
  channel.value=x.channel||'';
  const memo=document.createElement('textarea');memo.placeholder='Komentar (ako postoji)';memo.value=x.comment||'';
  const save=document.createElement('button');save.textContent='Sačuvaj evidenciju';save.onclick=()=>saveCardStatus(x,edit);
  const notice=document.createElement('div');notice.className='saveNotice note';
  edit.append(choices,channel,memo,save,notice);
  toggle.onclick=()=>{edit.style.display=edit.style.display==='none'?'block':'none'};
  box.append(name,phone,date,status,toggle,edit);list.append(box);
 }
}

let configLoaded=false;
function loadKnowledge() {
 google.script.run.withSuccessHandler(data=>{
  configLoaded=true;
  const list=document.getElementById('msgTemplates');
  list.replaceChildren();
  for(const msg of data.messages||[]){
   if(msg.id==='AUTO_SLANJE'||msg.id==='IZVOR')continue;
   const p=document.createElement('p');
   const b=document.createElement('b');b.textContent=msg.id+' — '+msg.state;
   const line=document.createElement('div');line.textContent=msg.text;
   p.append(b,line);list.append(p);
  }
  const learned=document.getElementById('learned');
  learned.replaceChildren();
  const title=document.createElement('p');
  title.textContent='Pitanja u bazi: '+(data.answers||[]).length;
  learned.append(title);
 }).withFailureHandler(e=>{document.getElementById('msgTemplates').textContent='Greška: '+String(e.message||e)}).getAutomationSetup();
}
function learn() {
 const q=document.getElementById('teachQ').value.trim();
 const keywords=document.getElementById('teachKeywords').value.trim();
 const answer=document.getElementById('teachA').value.trim();
 const output=document.getElementById('teachStatus');
 output.textContent='Upisujem u Google evidenciju…';
 google.script.run.withSuccessHandler(()=>{
  output.textContent='Sačuvano u bazi odgovora. Ovo NE šalje poruku kandidatu.';
  document.getElementById('teachQ').value='';
  document.getElementById('teachKeywords').value='';
  document.getElementById('teachA').value='';
  loadKnowledge();
 }).withFailureHandler(e=>{output.textContent='Greška: '+String(e.message||e)}).addLearnedAnswer({question:q,keywords,answer});
}
function saveCardStatus(x,card) {
 const status=card.querySelector('select').value;
 const comment=card.querySelector('textarea').value.trim();
 const channel=card.querySelector('.contactChannel').value;
 const notice=card.querySelector('.saveNotice');
 let confirmed=false;
 if(status==='POZVAN') {
   confirmed=window.confirm('Da li je kandidat ZAISTA kontaktiran? Status nije potvrda iz WhatsApp/Viber sistema.');
   if(!confirmed)return;
 }
 notice.textContent='Upisujem status…';
 google.script.run.withSuccessHandler(()=>{
   notice.textContent='Evidencija je sačuvana. Osvežavam…';refresh();
 }).withFailureHandler(e=>{notice.textContent='Greška: '+String(e.message||e)}).saveCandidateStatus({id:x.id,status,comment,channel,confirmed});
}

document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh()});
setInterval(()=>{if(!document.hidden)refresh()},60000);
refresh();loadKnowledge();
</script>
</body>
</html>`;
