/* Noćna Straža V109 optional village lobby. V108 game logic and save schema remain unchanged.
 * This peaceful scene is only a presentation of existing lobby/upgrade/chat/shop systems.
 * Multiplayer position packets are bounded, non-authoritative cosmetic movement only. */
(function(){
 'use strict';
 if(window.NS109_VILLAGE)return;
 // The original game is a private IIFE; consume only its explicit read/write bridge.
 const {NET,G,NSX,NS91,NS97_POST,NS76CHAT,CoopVoice,renderCoopForge,renderPreRun,
  currentLobbyRoster,currentProfileLevel,getActiveAccount,coopVoiceUpdatePreference,
  unlockSound,voiceLine,toast,meta,heroStyle}=window.__NS110_BRIDGE||{};
 if(!NET||!G||!NS91||!NS97_POST){console.error('Village: game API not ready');return}
 const $=id=>document.getElementById(id);
 const tr=(en,sr)=>window.__gameLanguage?.value==='sr'?sr:en;
 const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
 const buildings=[
  {id:'shop',x:184,y:164,w:150,h:114,label:'SHOP',sr:'PRODAVNICA',roof:'#8d5651',wall:'#c0a481',icon:'🛒'},
  {id:'guardian',x:454,y:156,w:226,h:126,label:'GUARDIAN BASE',sr:'TRAJNA UNAPREĐENJA',roof:'#525b78',wall:'#ada9a0',icon:'✦'},
  {id:'armory',x:755,y:167,w:155,h:119,label:'ARMORY',sr:'ORUŽARNICA',roof:'#72594a',wall:'#c0ac87',icon:'⚒'},
  {id:'academy',x:107,y:391,w:156,h:106,label:'HERO ACADEMY',sr:'AKADEMIJA',roof:'#485b70',wall:'#b7b6a6',icon:'⚔'},
  {id:'hall',x:338,y:393,w:174,h:106,label:'HALL OF FAME',sr:'DOSTIGNUĆA',roof:'#605a7d',wall:'#aaa8b8',icon:'🏆'},
  {id:'chat',x:563,y:391,w:174,h:110,label:'TAVERN / CHAT',sr:'KRČMA / ČET',roof:'#967255',wall:'#d0b385',icon:'💬'},
  {id:'ready',x:790,y:398,w:135,h:105,label:'READY GATE',sr:'KAPIJA STARTA',roof:'#386d61',wall:'#b8ac84',icon:'✓'}
 ];
 const avatars=new Map(),limits=new Map(),emotes=new Map(),NPCS=Array.from({length:4},(_,i)=>({x:50+i*250,y:280+i%2*185}));
 let opened=false,soloPreview=false,focused=null,focusNode=null,returnPlace=null,walkTo=null,thenEnter=null,lastSent=0,frameAt=0,lastBroadcast=0,lastLeaderboard=0,lastLeaderRequest=0,leaderCache=null,leaderBusy=false;
 let originalShowLobby=null,originalStartMatch=null,originalSettle=null,originalAward=null,originalOnKill=null,musicCtx=null,musicTimer=null,musicOn=false;
 const my={x:492,y:285};
 const root=document.createElement('section');root.id='ns109Village';root.className='ns109Hidden';root.setAttribute('aria-label','Village lobby');
 root.innerHTML=
  '<div id="ns109Top"><strong>🏡 NIGHT WATCH · VILLAGE</strong><span id="ns109Info">No enemies · No timer · No pauses</span>'+
  '<button id="ns109Sound" type="button">♫</button><button id="ns109Classic" type="button">☷ CLASSIC LOBBY</button></div>'+
  '<div id="ns109Stage"><canvas id="ns109Scene" width="960" height="540" aria-label="Village with interactive buildings"></canvas>'+
  '<div id="ns109Hint">Tap the ground to move, or a house to walk there. Enter the green gate when ready.</div></div>'+
  '<div id="ns109Bottom"><button id="ns109Results" type="button">🏆 RESULTS</button>'+
  '<button id="ns109Global" type="button">🌍 GLOBAL RANKINGS</button>'+
  '<button id="ns109Sparta" type="button">🛡 SPARTA</button>'+
  '<button id="ns109Voices" type="button">🎙 VOICE</button>'+
  '<button id="ns109Chat" type="button">💬 CHAT</button></div>'+
  '<div id="ns109Pane" class="ns109Hidden" role="dialog" aria-modal="false"><div class="ns109PaneBox"><div id="ns109PaneHead"><strong id="ns109PaneTitle"></strong><button id="ns109PaneBack" type="button">✕</button></div><div id="ns109PaneContent"></div></div></div>';
 const css=document.createElement('style');css.textContent=[
  '#ns109Village{position:fixed;inset:0;z-index:110;background:#101d24;color:#f3e7cc;display:flex;flex-direction:column;font-family:system-ui,sans-serif;overflow:hidden;touch-action:manipulation}',
  '.ns109Hidden{display:none!important}',
  '#ns109Village button{font-size:clamp(10px,2.5vw,13px);padding:8px 10px;border-radius:9px;white-space:nowrap;min-height:36px}',
  '#ns109Top{display:flex;gap:7px;align-items:center;flex-wrap:wrap;padding:calc(6px + env(safe-area-inset-top)) 8px 7px;background:#17292b;z-index:1}',
  '#ns109Top strong{font-size:clamp(12px,3vw,16px);color:#efc786;margin-right:auto}',
  '#ns109Destinations{max-width:125px;min-height:36px;font-size:11px;padding:5px;background:#233c3c;color:#f5d9a1}',
  '#ns109Info{font-size:10px;color:#a9c1b2}',
  '#ns109Stage{flex:1;min-height:0;position:relative;overflow:hidden;background:#1c3932}',
  '#ns109Scene{width:100%;height:100%;display:block;touch-action:manipulation}',
  '#ns109Hint{position:absolute;bottom:9px;left:50%;transform:translateX(-50%);text-align:center;max-width:96%;padding:5px 11px;border:1px solid #d3c18b64;border-radius:12px;background:#122522c8;font-size:clamp(9px,2.6vw,12px);pointer-events:none}',
  '#ns109Bottom{display:flex;align-items:center;justify-content:center;flex-wrap:wrap;gap:6px;padding:8px 6px calc(9px + env(safe-area-inset-bottom));background:#172b2a}',
  '#ns109Pane{position:absolute;inset:0;z-index:2;display:grid;place-items:center;padding:14px;background:#061016b5}',
  '.ns109PaneBox{width:min(540px,100%);max-height:85dvh;overflow-y:auto;overscroll-behavior:contain;background:linear-gradient(155deg,#1d3233,#122026);border:1px solid #b5a37891;border-radius:18px;padding:14px}',
  '#ns109PaneHead{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:14px;color:#edcb8d}',
  '#ns109PaneContent{font-size:13px;line-height:1.5}',
  '#ns109PaneContent>button{display:block;margin:8px auto}',
  '#ns109PaneContent .ns76Chat{margin:0!important;max-height:54dvh;overflow:auto}',
  '#ns109PaneContent .coopForge{display:block!important;margin:0!important}',
  '#ns109PaneContent .coopForge button{white-space:normal;width:100%}',
  'body.ns109External #nsShopPanel:not(.hidden),body.ns109External #nsArmoryPanel:not(.hidden),body.ns109External #nsGuidePanel:not(.hidden){z-index:150!important}',
  '@media(max-width:560px){#ns109Top{gap:5px}#ns109Info{display:none}#ns109Bottom{gap:4px}#ns109Bottom button{min-height:35px;padding:6px}}'
 ].join('');
 document.head.append(css);document.body.append(root);
 const canvas=$('ns109Scene'),g=canvas.getContext('2d',{alpha:false}),pane=$('ns109Pane'),area=$('ns109PaneContent');
 const destinations=document.createElement('select');destinations.id='ns109Destinations';destinations.setAttribute('aria-label','Choose a village building');
 const first=document.createElement('option');first.value='';first.textContent=tr('🏠 HOUSES','🏠 KUĆICE');destinations.append(first);
 for(const b of buildings){const opt=document.createElement('option');opt.value=b.id;opt.textContent=tr(b.label,b.sr);destinations.append(opt)}
 destinations.onchange=()=>{const b=buildings.find(x=>x.id===destinations.value);destinations.value='';if(b){thenEnter=b.id;walkTo=ground(b.x,b.y+Math.max(55,b.h/2+20))}};
 $('ns109Top').insertBefore(destinations,$('ns109Classic'));
 function view(){
  const r=canvas.getBoundingClientRect(),portrait=r.height>r.width*1.28;
  const scale=portrait?r.height/540:Math.min(r.width/960,r.height/540);
  const visibleW=r.width/Math.max(.1,scale),left=portrait?clamp(my.x-visibleW/2,0,Math.max(0,960-visibleW)):0;
  return{rect:r,scale,ox:portrait?-left*scale:(r.width-960*scale)/2,oy:(r.height-540*scale)/2};
 }
 const ctxPoint=e=>{const {rect,scale,ox,oy}=view();return{x:(e.clientX-rect.left-ox)/scale,y:(e.clientY-rect.top-oy)/scale}};
 const ground=(x,y)=>({x:clamp(x,29,931),y:clamp(y,62,505)});
 const isLobby=()=>NET.phase==='lobby'&&!!NET.role;
 const canVisit=()=>isLobby()||(NET.role===''&&G.mode==='menu');
 const ownName=()=>{try{return String(getActiveAccount()?.name||'GUARDIAN').slice(0,20)}catch{return 'GUARDIAN'}};
 const getPlayers=()=>{try{return currentLobbyRoster()}catch{return []}};
 function closePane(){
  if(focusNode&&returnPlace){returnPlace.appendChild(focusNode);if(focusNode.id==='coopForge')focusNode.classList.add('hidden')}
  focusNode=null;returnPlace=null;focused=null;pane.classList.add('ns109Hidden');area.replaceChildren();
 }
 function panel(name){closePane();$('ns109PaneTitle').textContent=name;pane.classList.remove('ns109Hidden');}
 function putExisting(id,title){
  const el=$(id);if(!el)return;
  panel(title);focusNode=el;returnPlace=el.parentElement;area.appendChild(el);el.classList.remove('hidden');
 }
 function openOutside(panelId,triggerId,closeId){
  const trigger=$(triggerId),target=$(panelId);
  if(!trigger||!target)return;
  closePane();root.classList.add('ns109Hidden');document.body.classList.add('ns109External');trigger.click();
  const onClose=()=>{setTimeout(()=>{document.body.classList.remove('ns109External');$('home')?.classList.add('hidden');if((isLobby()||soloPreview)&&opened){root.classList.remove('ns109Hidden');}},20)};
  const btn=$(closeId);if(btn)btn.addEventListener('click',onClose,{once:true});
  const watcher=new MutationObserver(()=>{if(target.classList.contains('hidden')){watcher.disconnect();onClose()}});
  watcher.observe(target,{attributes:true,attributeFilter:['class']});
 }
 function enter(id){
  if(!opened||!canVisit())return;thenEnter=null;
  if(id==='shop'){openOutside('nsShopPanel','nsOpenShop','nsShopClose');return}
  if(id==='armory'){openOutside('nsArmoryPanel','nsArmoryBtn','nsArmoryClose');return}
  if(id==='academy'){renderPreRun();putExisting('preHeroUpgrades',tr('HERO ACADEMY · PERSONAL UPGRADES','AKADEMIJA HEROJA · LIČNA UNAPREĐENJA'));return}
  if(id==='guardian'){renderCoopForge();putExisting('coopForge',tr('GUARDIAN BASE · PERMANENT UPGRADES','BAZA STRAŽE · TRAJNE NADOGRADNJE'));return}
  if(id==='chat'){
   if(soloPreview){panel(tr('VILLAGE TAVERN','SEOSKA KRČMA'));const note=document.createElement('p');note.textContent=tr('Join a multiplayer room to chat with your friends.','Pridruži se multiplayer sobi da bi se dopisivao sa društvom.');area.append(note);const join=document.createElement('button');join.textContent=tr('MULTIPLAYER','MULTIPLAYER');join.onclick=()=>{closeVillage();$('coopBtn')?.click()};area.append(join);return}
   putExisting('ns76Chat',tr('VILLAGE TAVERN · CHAT','SEOSKA KRČMA · ČET'));return
  }
  if(id==='hall'){showAchievements();return}
  if(id==='ready'){
   if(soloPreview){closeVillage();$('coopBtn')?.click();return}
   if(NS97_POST.active){if(!NET.ns97Results?.votes?.[NET.localId])NS97_POST.vote('yes');else NS97_POST.vote('no')}
   else if(!NET.localReady)$('lobbyReadyBtn')?.click();
   else $('lobbyReadyBtn')?.click();
   $('ns109Hint').textContent=NET.localReady||NET.ns97Results?.votes?.[NET.localId]==='yes'?tr('Ready! Waiting for others.','Spreman! Čekamo ostale.'):tr('Not ready.','Nisi spreman.');return;
  }
 }
 function showAchievements(){
  panel(tr('HALL OF FAME','DOM SLAVE'));const p=document.createElement('p');
  p.textContent=tr('Your existing achievements and the new cosmetic Sparta prize.','Postojeća dostignuća i nova kozmetička nagrada Sparta.');area.append(p);
  const item=document.createElement('p');item.textContent=spartaOwned()?tr('🏆 SPARTA UNLOCKED · golden armor (visual only).','🏆 SPARTA OSVOJENA · zlatni oklop (samo izgled).'):tr('◇ SPARTA · 300 personal kills in one qualifying run.','◇ SPARTA · 300 ličnih ubistava u jednoj pravoj partiji.');area.append(item);
  const btn=document.createElement('button');btn.textContent=tr('ALL ACHIEVEMENTS','SVA DOSTIGNUĆA');btn.onclick=()=>openOutside('nsGuidePanel','nsAchievementsBtn','nsGuideClose');area.append(btn);
 }
 function showVoice(){
  panel(tr('RECORDED VOICE BUTTONS','DUGMAD ZA SNIMLJEN GLAS'));const p=document.createElement('p');
  p.textContent=tr('Only your saved recordings are shared when voice sharing is enabled. Never a live microphone. Limit: one clip per 5.4 seconds.','Šalju se samo prethodno snimljene replike ako je deljenje uključeno, nikada mikrofon uživo. Najviše jedna replika na 5,4 s.');area.append(p);
  const toggle=document.createElement('label');toggle.textContent=tr('Share recorded voice','Deli snimljeni glas')+' ';
  const input=document.createElement('input');input.type='checkbox';input.checked=CoopVoice.share;input.onchange=()=>coopVoiceUpdatePreference('share',input.checked);toggle.append(input);area.append(toggle);
  const level=currentProfileLevel();
  for(const [kind,en,sr,minLevel] of [['start','Ready!','Spreman!',1],['victory','Well played!','Odigrano!',5],['wave','Here they come!','Stižu!',10]]){
   const btn=document.createElement('button');btn.textContent='🎙 '+tr(en,sr)+(minLevel>1?' · LV '+minLevel:'');btn.disabled=level<minLevel;
   btn.title=level<minLevel?tr('Unlock at permanent account level ','Otključava se na trajnom nivou ')+minLevel:'';
   btn.onclick=()=>{if(currentProfileLevel()<minLevel)return;unlockSound();voiceLine(kind,true)};area.append(btn);
  }
 }
 function personalKey(){return 'ns109_local_rank_'+String(getActiveAccount()?.id||'default').replace(/[^a-zA-Z0-9_-]/g,'').slice(0,80)}
 function personalStats(){try{const v=JSON.parse(localStorage.getItem(personalKey())||'{}');return {kills:Math.max(0,Number(v.kills)||0),wave:Math.max(0,Number(v.wave)||0)}}catch{return {kills:0,wave:0}}}
 function recordPersonalMP(packet){
  if(!packet||!Number.isInteger(packet.round)||!Number.isFinite(packet.kills)||packet.kills<0||packet.kills>1000000)return;
  const id=String(packet.session||'').slice(0,90)+'_'+packet.round;if(!packet.session)return;
  const key=personalKey();let old;try{old=JSON.parse(localStorage.getItem(key)||'{}')}catch{old={}}
  const seen=Array.isArray(old.seen)?old.seen:[];if(seen.includes(id))return;
  const record={kills:Math.max(0,Number(old.kills)||0)+Math.floor(packet.kills),wave:Math.max(0,Number(old.wave)||0,Math.floor(Number(packet.wave)||0)),seen:[...seen.slice(-149),id]};
  try{localStorage.setItem(key,JSON.stringify(record))}catch{}
 }
 function showRankings(force=false){
  panel(tr('GLOBAL RANKINGS','GLOBALNA RANG-LISTA'));
  const personal=personalStats(),self=document.createElement('p');
  const solo=typeof meta==='object'&&meta?meta:{};
  self.textContent=tr('YOUR STORED RECORD (local / cloud, not verified): ','TVOJA SAČUVANA STATISTIKA (lokalno / cloud, nije verifikovana): ')+ownName()+' · '+(Math.max(0,Number(solo.totalKills)||0)+personal.kills)+' '+tr('kills','ubistava')+' · LV '+currentProfileLevel()+' · '+tr('best wave ','najbolji talas ')+Math.max(Number(solo.bestWave)||0,personal.wave);
  area.append(self);
  const heading=document.createElement('p');heading.textContent=tr('Kills, permanent account level and best wave. Only verified data will count.','Ubistva, trajni nivo profila i najbolji talas. Samo provereni rezultati će se računati.');area.append(heading);
  const display=document.createElement('div');area.append(display);
  const refresh=document.createElement('button');refresh.textContent=tr('↻ REFRESH (once per minute)','↻ OSVEŽI (jednom u minutu)');refresh.onclick=()=>readRankings(display,true);area.append(refresh);
  readRankings(display,force);
 }
 async function readRankings(display,force){
  const now=Date.now();
  if(leaderCache&&now-lastLeaderboard<300000&&!force){paintRanking(display,leaderCache);return}
  if(leaderBusy){display.textContent=tr('Loading…','Učitavanje…');return}
  if(force&&now-lastLeaderRequest<60000){display.textContent=tr('Try refreshing in a minute.','Pokušaj osvežavanje za minut.');return}
  lastLeaderRequest=now;leaderBusy=true;display.textContent=tr('Checking rankings…','Proveravam rang-listu…');
  try{
   const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),4500);
   let resp;try{resp=await fetch('https://nocna-straza-relay.stefanstevic1996.workers.dev/api/leaderboard?period=all',{signal:ctrl.signal,cache:'no-store'})}finally{clearTimeout(timer)}
   if(!resp.ok)throw Error('Ranking verification service not available');
   const payload=await resp.json();if(!payload||payload.verified!==true||!Array.isArray(payload.players))throw Error('Unverified ranking');
   leaderCache=payload.players.slice(0,50).filter(x=>typeof x.name==='string'&&Number.isSafeInteger(x.kills)&&x.kills>=0&&Number.isSafeInteger(x.level)&&x.level>=1);lastLeaderboard=Date.now();
   paintRanking(display,leaderCache);
  }catch{
   display.textContent=tr('The verified global leaderboard is not online yet. No invented scores or insecure uploads will be shown. Existing match results still work.','Proverena globalna rang-lista još nije aktivna. Ne prikazujemo lažne rezultate i ne prihvatamo nezaštićene uplate skorova. Statistika partije i dalje radi.');
  }finally{leaderBusy=false}
 }
 function paintRanking(node,data){
  node.replaceChildren();if(!data.length){node.textContent=tr('No verified scores yet.','Još nema proverenih rezultata.');return}
  for(const [i,p] of data.entries()){const row=document.createElement('p');row.textContent=(i+1)+'. '+p.name.slice(0,24)+' · '+p.kills+' '+tr('kills','ubistava')+' · LV '+p.level;node.append(row)}
 }
 function spartaKey(){return 'ns109_sparta_'+String(getActiveAccount()?.id||'default').replace(/[^a-zA-Z0-9_-]/g,'').slice(0,80)}
 function spartaOwned(){try{return JSON.parse(localStorage.getItem(spartaKey())||'null')?.owned===true}catch{return false}}
 function spartaEquipped(){try{const v=JSON.parse(localStorage.getItem(spartaKey())||'null');return v?.owned===true&&v?.equipped!==false}catch{return false}}
 function spartaSave(owned,equipped){try{localStorage.setItem(spartaKey(),JSON.stringify({owned:!!owned,equipped:!!equipped}))}catch{}}
 function spartaClaim(kills){
  if(!Number.isFinite(kills)||kills<300||spartaOwned())return false;
  spartaSave(true,true);toast(tr('🏆 SPARTA UNLOCKED! Gold armor is cosmetic only.','🏆 SPARTA OTKLJUČANA! Zlatni oklop je samo kozmetika.'));return true;
 }
 function showSparta(){
  panel(tr('SPARTA ACHIEVEMENT','DOSTIGNUĆE SPARTA'));const text=document.createElement('p');text.textContent=spartaOwned()?tr('🏆 Won: golden Spartan-style helmet and armor. No HP, damage or speed advantage.','🏆 Osvojeno: zlatni šlem i oklop spartanskog stila. Bez dodatnog HP-a, štete ili brzine.'):tr('Get 300 personal kills in one real match. Test/editor runs do not count.','Napravi 300 ličnih ubistava tokom jedne stvarne partije. Test i editor se ne računaju.');area.append(text);
  const btn=document.createElement('button');btn.textContent=spartaEquipped()?tr('✓ WEARING · REMOVE','✓ OBUČENO · SKINI'):tr('WEAR GOLD ARMOR','OBUCI ZLATNI OKLOP');btn.disabled=!spartaOwned();btn.onclick=()=>{spartaSave(true,!spartaEquipped());showSparta()};area.append(btn);
 }
 function decorate(look,e){
  if(!look||typeof look!=='object')return look;
  const isMine=!e||!NET.role||e.id===NET.localId||e.id==='p1'&&NET.role!=='guest';
  if(!look.ns109Sparta&&!(isMine&&spartaEquipped()))return look;
  return {...look,accent:'#e4c16a',gear:'armor',wardrobe:{...look.wardrobe,top:'armor',bottom:'armored',hat:'plume',topColor:'#e0ad4c',hatColor:'#e7cb76',torso:'#b98b36',glovesColor:'#bd984d',bottomColor:'#705b43',shoesColor:'#8d7953'}};
 }
 function networkAppearance(style){
  if(!style)return style;
  if(style.ns109Sparta)return style;
  if(style===heroStyle&&spartaEquipped())return {...style,ns109Sparta:true};
  return style;
 }
 const background=()=>{
  g.fillStyle='#294941';g.fillRect(0,0,960,540);
  g.fillStyle='#38584a';for(let i=0;i<18;i++){let x=(i*271)%975,y=(i*191)%550;g.beginPath();g.arc(x,y,22+(i%5)*12,0,Math.PI*2);g.fill()}
  g.strokeStyle='#95846a';g.lineWidth=76;g.lineCap='round';g.beginPath();g.moveTo(0,298);g.lineTo(960,298);g.stroke();g.beginPath();g.moveTo(488,0);g.lineTo(488,540);g.stroke();
  g.strokeStyle='#bb9b73';g.lineWidth=61;g.beginPath();g.moveTo(0,298);g.lineTo(960,298);g.stroke();g.beginPath();g.moveTo(488,0);g.lineTo(488,540);g.stroke();
  for(let i=0;i<32;i++){const x=(i*163)%955,y=(i*111)%540;g.fillStyle=i%2?'#8db87b':'#a4c88c';g.fillRect(x,y,3,5)}
 };
 function house(b){
  g.save();g.translate(b.x,b.y);g.fillStyle='#14211d88';g.fillRect(-b.w/2+7,-b.h/2+11,b.w,b.h);
  g.fillStyle=b.wall;g.fillRect(-b.w/2,-b.h/2+16,b.w,b.h-20);
  g.fillStyle=b.roof;g.beginPath();g.moveTo(-b.w/2-12,-b.h/2+20);g.lineTo(0,-b.h/2-31);g.lineTo(b.w/2+12,-b.h/2+20);g.closePath();g.fill();
  g.fillStyle='#483d35';g.fillRect(-14,b.h/2-37,28,34);
  g.fillStyle='#2f524f';g.fillRect(-b.w/2+16,-7,24,20);g.fillRect(b.w/2-40,-7,24,20);
  g.font='bold 15px system-ui';g.textAlign='center';g.fillStyle='#f7e5a9';g.shadowColor='#071414';g.shadowBlur=3;
  g.fillText(b.icon+' '+tr(b.label,b.sr),0,-b.h/2+43,b.w+12);
  g.shadowBlur=0;g.restore();
 }
 function sheep(time){
  for(const [i,s] of NPCS.entries()){const x=s.x+Math.sin(time/2200+i*1.6)*13,y=s.y+Math.cos(time/3100+i)*6;g.save();g.translate(x,y);g.fillStyle='#e9e6d4';g.beginPath();g.ellipse(0,0,17,11,0,0,7);g.fill();g.fillStyle='#66584d';g.fillRect(-11,7,4,8);g.fillRect(9,7,4,8);g.fillStyle='#c3ad93';g.beginPath();g.arc(14,1,7,0,7);g.fill();g.fillStyle='#352e2c';g.fillRect(17,-1,2,2);g.restore();}
 }
 function avatar(id,x,y,name,ready,sparta){
  g.save();g.translate(x,y);g.textAlign='center';g.font='bold 12px system-ui';g.strokeStyle='#0b191d';g.lineWidth=3;g.strokeText(name,-0,-36);g.fillStyle=ready?'#a4efbd':'#f2d29c';g.fillText(name,0,-36);
  g.fillStyle='#061a21a1';g.beginPath();g.ellipse(0,15,15,5,0,0,7);g.fill();
  g.fillStyle=sparta?'#d8ac4f':id===NET.localId?'#8abfba':'#9ba8cc';g.fillRect(-11,-18,22,29);
  g.fillStyle='#e3b58e';g.beginPath();g.arc(0,-24,9,0,7);g.fill();
  g.fillStyle=sparta?'#f7d778':'#304a4d';g.fillRect(-10,-34,20,6);
  g.fillStyle='#303c3d';g.fillRect(-11,10,8,15);g.fillRect(3,10,8,15);
  if(ready){g.font='bold 18px system-ui';g.fillStyle='#c2ffc5';g.fillText('✓',18,-22)}
  const emote=emotes.get(id);if(emote&&Date.now()<emote.until){g.fillStyle='#fff4ce';g.font='22px system-ui';g.fillText(emote.text,0,-58)}
  g.restore();
 }
 function step(time){
  if(!opened||!canVisit()){if(opened)closeVillage();return}
  if(document.hidden)return;
  const dt=clamp((time-frameAt)/1000,0,.14);frameAt=time;
  if(walkTo){
   const dx=walkTo.x-my.x,dy=walkTo.y-my.y,d=Math.hypot(dx,dy);
   if(d<4){my.x=walkTo.x;my.y=walkTo.y;walkTo=null;if(thenEnter){const id=thenEnter;thenEnter=null;enter(id)}}
   else{const t=Math.min(d,150*dt);my.x+=dx/d*t;my.y+=dy/d*t}
  }
  if(NET.phase==='lobby'&&NET.role==='guest'&&NET.conn?.open&&time-lastSent>450){
   lastSent=time;try{NET.conn.send({t:'ns109Move',x:Math.round(my.x),y:Math.round(my.y)})}catch{}
  }
  if(NET.role==='host'&&time-lastBroadcast>750){
   lastBroadcast=time;const players=[...avatars.entries()].filter(([id])=>getPlayers().some(p=>p.id===id)).slice(0,6).map(([id,a])=>({id,x:Math.round(a.x),y:Math.round(a.y)}));
   players.push({id:NET.localId,x:Math.round(my.x),y:Math.round(my.y)});
   const packet={t:'ns109State',players};for(const c of NET.clients.values())if(c?.open)try{c.send(packet)}catch{}
  }
  const screen=view(),ratio=Math.min(2,window.devicePixelRatio||1),w=Math.max(1,Math.round(screen.rect.width*ratio)),h=Math.max(1,Math.round(screen.rect.height*ratio));
  if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h}
  g.setTransform(ratio,0,0,ratio,0,0);g.fillStyle='#1d342d';g.fillRect(0,0,screen.rect.width,screen.rect.height);
  g.setTransform(ratio*screen.scale,0,0,ratio*screen.scale,ratio*screen.ox,ratio*screen.oy);
  background();const tt=performance.now();sheep(tt);
  buildings.forEach(house);
  g.fillStyle='#467d55';g.beginPath();g.arc(790,465,37,0,7);g.fill();
  g.strokeStyle='#c5c38b';g.lineWidth=5;g.stroke();g.font='bold 13px system-ui';g.textAlign='center';g.fillStyle='#f5e5a4';g.fillText('READY',790,475);
  for(const p of getPlayers()){if(p.id===NET.localId)continue;const a=avatars.get(p.id)||{x:460+Number(p.id?.slice(1)||2)*27,y:279};avatar(p.id,a.x,a.y,String(p.name||'GUARDIAN').slice(0,14),p.ready,false)}
  const me=getPlayers().find(p=>p.id===NET.localId);avatar(NET.localId,my.x,my.y,ownName(),!!me?.ready||NET.ns97Results?.votes?.[NET.localId]==='yes',spartaEquipped());
  if(opened&&!pane.classList.contains('ns109Hidden')&&focused==='leaderboard')return;
 }
 function onMessage(data,assigned){
  if(!data||!['ns109Move','ns109State','ns109Emote'].includes(data.t))return false;
  if(!isLobby())return true;
  if(NET.role==='host'){
   if(!/^p[2-6]$/.test(String(assigned||''))||!NET.clients.get(assigned)?.open)return true;
   if(data.t==='ns109State')return true;
   const now=performance.now(),prev=limits.get(assigned)||{at:0,x:450,y:285,emote:0};
   if(now-prev.at<160)return true;
   if(data.t==='ns109Emote'){
    if(now-prev.emote>5000&&['👋','⚔','🍻'].includes(data.emote)){prev.emote=now;emotes.set(assigned,{text:data.emote,until:Date.now()+2500});
      for(const c of NET.clients.values())if(c?.open)try{c.send({t:'ns109Emote',id:assigned,emote:data.emote})}catch{}}
    limits.set(assigned,prev);return true;
   }
   if(Number.isFinite(data.x)&&Number.isFinite(data.y)){
    const p=ground(data.x,data.y);const dt=clamp((now-prev.at)/1000,.16,1.5),max=155*dt+16;
    const d=Math.hypot(p.x-prev.x,p.y-prev.y),t=d>max?max/d:1;
    prev.x+=((p.x-prev.x)*t);prev.y+=((p.y-prev.y)*t);prev.at=now;
    avatars.set(assigned,{x:prev.x,y:prev.y});limits.set(assigned,prev);
    if(!opened&&now-lastBroadcast>750){
     lastBroadcast=now;const peers=[...avatars.entries()].filter(([id])=>getPlayers().some(p=>p.id===id)).slice(0,6).map(([id,a])=>({id,x:Math.round(a.x),y:Math.round(a.y)}));
     for(const c of NET.clients.values())if(c?.open)try{c.send({t:'ns109State',players:peers})}catch{}
    }
   }
   return true;
  }
  if(data.t==='ns109State'){
   if(!Array.isArray(data.players)||data.players.length>8)return true;
   for(const p of data.players)if(/^p[1-6]$/.test(String(p?.id||''))&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.id!==NET.localId)avatars.set(p.id,ground(p.x,p.y));
   return true;
  }
  if(data.t==='ns109Emote'&&/^p[1-6]$/.test(String(data.id||''))&&['👋','⚔','🍻'].includes(data.emote))emotes.set(data.id,{text:data.emote,until:Date.now()+2500});
  return true;
 }
 function tap(e){
  if(!opened||!isLobby()||!pane.classList.contains('ns109Hidden'))return;
  const p=ctxPoint(e);if(p.x<0||p.y<0||p.x>960||p.y>540)return;
  const b=buildings.find(x=>Math.abs(p.x-x.x)<x.w/2+25&&Math.abs(p.y-x.y)<x.h/2+30);
  if(b){thenEnter=b.id;walkTo=ground(b.x,b.y+Math.max(55,b.h/2+20));}
  else if(Math.hypot(p.x-790,p.y-465)<44){thenEnter='ready';walkTo=ground(790,455);}
  else{thenEnter=null;walkTo=ground(p.x,p.y)}
 }
 function showVillage(){
  if(!canVisit())return false;
  soloPreview=!isLobby();
  if(!soloPreview){$('coopPanel')?.classList.remove('hidden');$('lobbyArea')?.classList.remove('hidden')}
  opened=true;walkTo=null;thenEnter=null;closePane();my.x=490;my.y=284;
  frameAt=performance.now();root.classList.remove('ns109Hidden');$('home')?.classList.add('hidden');
  $('ns109Hint').textContent=tr('Tap a house to walk there, or tap ground to move. No one is paused.','Dodirni kućicu da priđeš ili zemlju da se krećeš. Niko nije pauziran.');
  return true;
 }
 function closeVillage(){const wasSolo=soloPreview;opened=false;soloPreview=false;walkTo=null;thenEnter=null;closePane();root.classList.add('ns109Hidden');stopMusic();document.body.classList.remove('ns109External');if(wasSolo&&NET.role===''&&G.mode==='menu')$('home')?.classList.remove('hidden')}
 function playMusic(){
  if(musicOn){stopMusic();return}
  try{
   const C=window.AudioContext||window.webkitAudioContext;if(!C)return;musicCtx=new C();musicOn=true;$('ns109Sound').textContent='♫ ON';
   const pattern=[262,330,392,330,294,349,440,349,262,294,330,294];let n=0;
   musicTimer=setInterval(()=>{if(!musicOn||!opened||document.hidden||musicCtx?.state!=='running')return;
    const at=musicCtx.currentTime,osc=musicCtx.createOscillator(),amp=musicCtx.createGain();
    osc.type='sine';osc.frequency.value=pattern[n++%pattern.length];amp.gain.setValueAtTime(.0001,at);amp.gain.exponentialRampToValueAtTime(.018,at+.06);amp.gain.exponentialRampToValueAtTime(.0001,at+.46);
    osc.connect(amp);amp.connect(musicCtx.destination);osc.start(at);osc.stop(at+.48);
   },540);
  }catch{stopMusic()}
 }
 function stopMusic(){musicOn=false;clearInterval(musicTimer);musicTimer=null;const c=musicCtx;musicCtx=null;try{c?.close()}catch{}if($('ns109Sound'))$('ns109Sound').textContent='♫'}
 function scheduleAutoVillage(){
  if(!isLobby()||NET.round<1||localStorage.getItem('ns109_village_pref')==='classic')return;
  setTimeout(()=>{if(isLobby()&&NET.round>=1&&!opened&&!document.hidden&&pane.classList.contains('ns109Hidden'))showVillage()},3800);
 }
 $('ns109PaneBack').onclick=closePane;
 $('ns109Classic').onclick=()=>{localStorage.setItem('ns109_village_pref','classic');closeVillage()};
 $('ns109Sound').onclick=playMusic;
 $('ns109Results').onclick=()=>{closeVillage();$('ns97Results')?.scrollIntoView({block:'start'})};
 $('ns109Global').onclick=()=>{focused='leaderboard';showRankings()};
 $('ns109Sparta').onclick=showSparta;
 $('ns109Voices').onclick=showVoice;
 $('ns109Chat').onclick=()=>enter('chat');
 canvas.addEventListener('pointerdown',tap);
 document.addEventListener('keydown',e=>{if(!opened||!canVisit())return;if(e.key==='Escape'&&!pane.classList.contains('ns109Hidden')){e.stopImmediatePropagation();closePane()}else if(e.key==='Escape'){e.stopImmediatePropagation();closeVillage()}},true);
 const homeVillage=document.createElement('button');homeVillage.id='ns110VillageHome';homeVillage.type='button';homeVillage.textContent='🏡 '+tr('EXPLORE VILLAGE · CHILL HUB','ISTRAŽI SELO · CHILL LOBI');homeVillage.onclick=()=>{if(G.mode!=='menu'){toast(tr('Village is available between runs.','Selo je dostupno između partija.'));return}localStorage.setItem('ns109_village_pref','village');showVillage()};($('ns50MenuPlay')||$('coopBtn'))?.insertAdjacentElement('beforebegin',homeVillage);
 const enterButton=document.createElement('button');enterButton.id='ns109Visit';enterButton.type='button';enterButton.textContent='🏡 '+tr('ENTER VILLAGE','UĐI U SELO');enterButton.onclick=()=>{localStorage.setItem('ns109_village_pref','village');showVillage()};
 $('lobbyArea')?.insertBefore(enterButton,$('roomCode'));
 const postButton=document.createElement('button');postButton.id='ns109PostButton';postButton.type='button';postButton.textContent='🏡 '+tr('VISIT VILLAGE','POSĒTI SELO');postButton.onclick=enterButton.onclick;
 $('ns97Results')?.append(postButton);
 // Rematch/lobby hooks run inside the original game scope, not a disconnected wrapper.
 // Match-start hook is provided by the original engine.
 // Solo completion hook is provided by the original engine.
 // Host-attested co-op reward hook is provided by the original engine.
 if(typeof NS91?.onKill==='function'){
  originalOnKill=NS91.onKill;NS91.onKill=function(){const result=originalOnKill.apply(this,arguments);
   if(!G.debugRun&&G.mode==='play'&&(G.runType==='default'||G.runType==='network')&&NET.role!=='guest'){
    const count=NET.role==='host'?(G.players.find(p=>p.id===NET.localId)?.runKills||0):(G.kills||0);spartaClaim(count);
   }return result;
  };
 }
 // Cosmetic looks are now transported by the original engine's networkHeroStyle.
 // Lifecycle: detached village only; classic lobby and legacy game engine continue unchanged.
 const heartbeat=setInterval(()=>{if(opened&&!canVisit())closeVillage();if(opened&&canVisit()&&!document.hidden&&!root.classList.contains('ns109Hidden'))step(performance.now())},75);
 window.NS109_VILLAGE={open:showVillage,close:closeVillage,onMessage,enter,onLobbyUI:()=>{if(isLobby())scheduleAutoVillage()},
 onSoloResult:run=>{if(run&&NET.role===''&&G.runType==='default'&&!G.debugRun)spartaClaim(run.kills)},
 onMPAward:packet=>{if(packet&&Number.isFinite(packet.kills)&&!G.debugRun){spartaClaim(packet.kills);recordPersonalMP(packet)}},
 get opened(){return opened},test:{spartaClaim,spartaOwned,spartaEquipped,spartaKey,buildings,ground,readRankings,personalStats,recordPersonalMP}};
 window.NS109_SPARTA={appearance:decorate,owned:spartaOwned,equipped:spartaEquipped,claim:spartaClaim};
})();
