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
const ARCHIVE_TAB = 'ARHIVA_BROJEVA';
const BLOCKED_TEST_IDS = new Set(['l:2327196261413284']);
const MAX_ROWS = 2000;

function normalizePhone_(raw) {
  let digits=String(raw||'').replace(/\D/g,'');
  if(digits.startsWith('00381'))digits=digits.slice(2);
  if(digits.startsWith('0')&&digits.length>=9)digits='381'+digits.slice(1);
  return digits;
}

function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
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
  const iCity = idx(['city','grad','mesto'],-1);
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
    if(status==='POZVAN')contacted++; else if(status==='NIJE POZVAN')needsContact++;
    candidates.push({
      id, date:String(row[iDate]||''),
      dateLabel: isNaN(Date.parse(row[iDate])) ? String(row[iDate]||'') : Utilities.formatDate(new Date(row[iDate]),'Europe/Belgrade','dd.MM.yyyy HH:mm'),
      name:String(row[iName]||'').slice(0,140),
      phone:phone.replace(/^p:/i,'').trim().slice(0,50),
      city:iCity>=0?String(row[iCity]||'').slice(0,100):'',
      email:String(row[iEmail]||'').slice(0,140),
      status, reapplicant:isReapplicant, comment:(state.comment||'').slice(0,180),
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
