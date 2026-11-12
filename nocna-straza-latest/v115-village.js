/* Noćna Straža V115 optional village lobby. V114 game logic and save schema remain unchanged.
 * This peaceful scene is only a presentation of existing lobby/upgrade/chat/shop systems.
 * Multiplayer position packets are bounded, non-authoritative cosmetic movement only. */
(function(){
 'use strict';
 if(window.NS109_VILLAGE)return;
 // The original game is a private IIFE; consume only its explicit read/write bridge.
 const {NET,G,NSX,NS91,NS97_POST,NS76CHAT,CoopVoice,renderCoopForge,renderPreRun,
  currentLobbyRoster,currentProfileLevel,getActiveAccount,coopVoiceUpdatePreference,
  unlockSound,voiceLine,toast,meta,heroStyle,drawVillageHero,getVillageHeroLook,
 NS103_PARTY,NS96_INVITES,SOCIAL,startSocial,socialCheckFriends,showFriends,ensureSocialIdentity,safePlayerName,sendSocialStatus,NS92_DIR}=window.__NS110_BRIDGE||{};
 if(!NET||!G||!NS91||!NS97_POST){console.error('Village: game API not ready');return}
 const $=id=>document.getElementById(id);
 const tr=(en,sr)=>window.__gameLanguage?.value==='sr'?sr:en;
 const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
 const buildings=[
  {id:'shop',x:184,y:164,w:150,h:114,label:'SHOP',sr:'PRODAVNICA',roof:'#8d5651',wall:'#c0a481',icon:'🛒'},
  {id:'guardian',x:454,y:156,w:226,h:126,label:'GUARDIAN BASE',sr:'TRAJNA UNAPREĐENJA',roof:'#525b78',wall:'#ada9a0',icon:'✦'},
  {id:'armory',x:679,y:167,w:130,h:119,label:'ARMORY',sr:'ORUŽARNICA',roof:'#72594a',wall:'#c0ac87',icon:'⚒'},
  {id:'invite',x:851,y:167,w:136,h:110,label:'INVITE HALL',sr:'KUĆA POZIVA',roof:'#456a70',wall:'#b9c4ad',icon:'✉'},
  {id:'academy',x:107,y:391,w:156,h:106,label:'HERO ACADEMY',sr:'AKADEMIJA',roof:'#485b70',wall:'#b7b6a6',icon:'⚔'},
  {id:'hall',x:338,y:393,w:174,h:106,label:'HALL OF FAME',sr:'DOSTIGNUĆA',roof:'#605a7d',wall:'#aaa8b8',icon:'🏆'},
  {id:'chat',x:563,y:391,w:174,h:110,label:'TAVERN / CHAT',sr:'KRČMA / ČET',roof:'#967255',wall:'#d0b385',icon:'💬'},
  {id:'ready',x:790,y:398,w:135,h:105,label:'READY GATE',sr:'KAPIJA STARTA',roof:'#386d61',wall:'#b8ac84',icon:'✓'}
 ];
 const avatars=new Map(),smoothAvatars=new Map(),limits=new Map(),emotes=new Map(),NPCS=Array.from({length:4},(_,i)=>({x:50+i*250,y:280+i%2*185}));
 let opened=false,soloPreview=false,focused=null,focusNode=null,returnPlace=null,walkTo=null,thenEnter=null,lastSent=0,frameAt=0,lastBroadcast=0,lastLeaderboard=0,lastLeaderRequest=0,leaderCache=null,leaderBusy=false;
 let originalShowLobby=null,originalStartMatch=null,originalSettle=null,originalAward=null,originalOnKill=null,musicCtx=null,musicTimer=null,musicOn=false;
 // V118 profiling is local-only: no network packets or account writes.
 let villageLastTick=0,villageFrameCredit=0,sceneLayer=null,sceneLayerLang='';let route=[],routeIndex=0,doorLatch=null,doorLabel='';
 const houseLayers=new Map();let lastDepthOrder=[];let pendingAutoRoom='',pendingAutoUntil=0,lastInviteUiAt=0;
 // One shared rAF with the game's update loop; avoid a second timer and frame pacing drift.
 const VILLAGE_TARGET_MS=1000/60;
 let fpsStart=0,fpsFrames=0,drawMsSum=0,drawMsMax=0,lastStatsAt=0;
 const PERF={frames:0,staticBuilds:0,blockedMoves:0,paths:0,fps:0,averageDrawMs:0,maxDrawMs:0,targetFps:60};
 const SHOW_PERF=new URLSearchParams(location.search).has('village-fps');
 let fpsBadge=null;
 if(SHOW_PERF){
  fpsBadge=document.createElement('div');fpsBadge.id='ns119Fps';
  fpsBadge.setAttribute('role','status');
  fpsBadge.style.cssText='position:absolute;z-index:5;right:9px;top:6px;min-width:78px;padding:4px 7px;border-radius:8px;border:1px solid #739b87;background:#071d20db;color:#d0f8d8;font:700 11px monospace;pointer-events:none;text-align:right';
  fpsBadge.textContent='FPS --';
 }
 const stick={id:null,x:0,y:0,vx:0,vy:0,drag:false},keys=Object.create(null);let stepFrame=0,side=1,walking=false,dodgeUntil=0,dodgeReady=0;
 const my={x:492,y:285};
 const root=document.createElement('section');root.id='ns109Village';root.className='ns109Hidden';root.setAttribute('aria-label','Village lobby');
 root.innerHTML=
  '<div id="ns109Top"><strong>🏡 NIGHT WATCH · VILLAGE</strong><span id="ns109Info">No enemies · No timer · No pauses</span>'+
  '<button id="ns109Sound" type="button">♫</button><button id="ns109Classic" type="button">☷ CLASSIC LOBBY</button></div>'+
  '<div id="ns109Stage"><canvas id="ns109Scene" width="960" height="540" aria-label="Village with interactive buildings"></canvas><div id="ns117Stick" class="ns109Hidden" aria-hidden="true"><span id="ns117Knob"></span></div><button id="ns117Dodge" type="button" aria-label="Dodge / Izbegni">↝<small>DODGE</small></button><button id="ns120Door" type="button" class="ns109Hidden" aria-label="Enter building / Uđi u kućicu">↳ ENTER</button>'+
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
  '#ns109Scene{width:100%;height:100%;display:block;touch-action:none}',
  '#ns117Stick{position:absolute;z-index:4;pointer-events:none;width:112px;height:112px;border-radius:50%;border:2px solid #bddbcb98;background:radial-gradient(circle,#a7cab02b,#122a3699);box-shadow:0 4px 20px #020e1699;transform:translate(-50%,-50%)}',
  '#ns117Knob{position:absolute;width:48px;height:48px;left:30px;top:30px;border-radius:50%;border:2px solid #d0e8da98;background:linear-gradient(130deg,#8caf9b,#355f62);box-shadow:0 4px 8px #0018}',
  '#ns117Dodge{position:absolute;z-index:4;left:12px;bottom:58px;width:76px;height:76px;display:grid;place-content:center;border-radius:50%!important;border:2px solid #b7d9d0;background:#21474bde;color:#f6f0d7;font-size:22px!important;touch-action:manipulation}',
  '#ns117Dodge small{font-size:9px;letter-spacing:.04em}',
  '#ns117Dodge:disabled{opacity:.5;filter:grayscale(.7)}',
  '#ns120Door{position:absolute;z-index:6;right:12px;bottom:56px;padding:10px 12px!important;border-radius:12px!important;background:#23534de8;border:1.5px solid #efcc8d;color:#ffedbf;font:bold 12px system-ui!important;max-width:min(210px,58vw);white-space:normal!important;box-shadow:0 4px 18px #06181699;touch-action:manipulation}',
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
  '.ns122Actions{display:flex;flex-wrap:wrap;gap:7px;margin:9px 0}',
  '.ns122Actions button{flex:1;min-width:110px;white-space:normal!important}',
  '.ns122Friends{max-height:40dvh;overflow-y:auto;display:grid;gap:7px;margin:10px 0;overscroll-behavior:contain}',
  '.ns122Friend{display:flex;align-items:center;justify-content:space-between;gap:9px;padding:9px;border:1px solid #78968165;border-radius:10px;background:#1a3533}',
  '.ns122Friend span{flex:1;min-width:0;overflow-wrap:anywhere}',
  '.ns122Friend button{min-width:83px;white-space:normal!important}',
  '#ns122Presence{font-weight:700;color:#c8e9d8}',
  '#ns122InviteAll{width:100%;white-space:normal!important}',
  'body.ns109External #nsShopPanel:not(.hidden),body.ns109External #nsArmoryPanel:not(.hidden),body.ns109External #nsGuidePanel:not(.hidden){z-index:150!important}',
  '@media(max-width:560px){#ns109Top{gap:5px}#ns109Info{display:none}#ns109Bottom{gap:4px}#ns109Bottom button{min-height:35px;padding:6px}}'
 ].join('');
 document.head.append(css);document.body.append(root);if(fpsBadge)root.append(fpsBadge);
 const canvas=$('ns109Scene');let g=canvas.getContext('2d',{alpha:false});const pane=$('ns109Pane'),area=$('ns109PaneContent');
 const destinations=document.createElement('select');destinations.id='ns109Destinations';destinations.setAttribute('aria-label','Choose a village building');
 const first=document.createElement('option');first.value='';first.textContent=tr('🏠 HOUSES','🏠 KUĆICE');destinations.append(first);
 for(const b of buildings){const opt=document.createElement('option');opt.value=b.id;opt.textContent=tr(b.label,b.sr);destinations.append(opt)}
 destinations.onchange=()=>{const b=buildings.find(x=>x.id===destinations.value);destinations.value='';if(b)startVillageTravel(b.x,b.y+b.h/2+26,b.id)};
 $('ns109Top').insertBefore(destinations,$('ns109Classic'));
 function view(){
  const r=canvas.getBoundingClientRect(),portrait=r.height>r.width*1.28;
  // Height-only zoom on tall phones showed just a narrow sliver of the Village.
  const scale=portrait?Math.min(r.height/540,r.width/320):Math.min(r.width/960,r.height/540);
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
  const el=$(id);if(!el){panel(title);const msg=document.createElement('p');msg.textContent=tr('This menu opens inside the full game.','Ovaj meni se otvara u glavnoj igri.');area.append(msg);return;}
  panel(title);focusNode=el;returnPlace=el.parentElement;area.appendChild(el);el.classList.remove('hidden');
 }
 function openOutside(panelId,triggerId,closeId){
  const trigger=$(triggerId),target=$(panelId);
  if(!trigger||!target){panel(tr('Village building preview','Prikaz seoske kućice'));const msg=document.createElement('p');msg.textContent=tr('Walk up to this building in the full game to use its menu.','Priđi ovoj kućici u glavnoj igri da otvoriš njen meni.');area.append(msg);return;}
  closePane();root.classList.add('ns109Hidden');document.body.classList.add('ns109External');trigger.click();
  let restored=false;const onClose=()=>{if(restored)return;restored=true;setTimeout(()=>{document.body.classList.remove('ns109External');if((isLobby()||soloPreview)&&opened){$('home')?.classList.add('hidden');root.classList.remove('ns109Hidden');}},20)};
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
  if(id==='invite'){showInviteHouse();return}
  if(id==='ready'){
   if(soloPreview){closeVillage();$('coopBtn')?.click();return}
   if(NS97_POST.active){if(!NET.ns97Results?.votes?.[NET.localId])NS97_POST.vote('yes');else NS97_POST.vote('no')}
   else if(!NET.localReady)$('lobbyReadyBtn')?.click();
   else $('lobbyReadyBtn')?.click();
   $('ns109Hint').textContent=NET.localReady||NET.ns97Results?.votes?.[NET.localId]==='yes'?tr('Ready! Waiting for others.','Spreman! Čekamo ostale.'):tr('Not ready.','Nisi spreman.');return;
  }
 }

 function inviteRosterText(){
  if(!isLobby())return tr('SOLO VILLAGE · Room starts when you invite an online friend','SOLO SELO · Online soba se pokreće kada pozoveš prijatelja');
  const roster=getPlayers();
  return tr('ONLINE ROOM ','ONLINE SOBA ')+NET.code+' · '+roster.length+'/'+NS92_DIR.maxPlayers()+
   tr(' PLAYERS',' IGRAČA')+' · '+roster.map(p=>safePlayerName(p.name)).join(', ');
 }
 function inviteRoomLink(){
  const room=String(NET.code||'');
  return /^[A-HJ-NP-Z2-9]{6}$/.test(room)&&isLobby()?
   location.origin+location.pathname+'?join='+encodeURIComponent(room):'';
 }
 async function copyVillageText(value){
  try{if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(value);toast(tr('Copied','Kopirano'));return}}
  catch{}
  // Clipboard is blocked on some embedded Android browsers; show the value so
  // the player can still pass the code without creating a second room.
  toast(value);
 }
 function startVillageInvites(ids){
  const online=[...new Set(ids)].filter(id=>SOCIAL?.db?.friends?.[id]&&SOCIAL.conns.get(id)?.open).slice(0,5);
  if(!online.length){toast(tr('No online friends selected','Nema izabranih online prijatelja'));return false}
  if(NET.phase==='lobby'&&NET.role){
   if(getPlayers().length>=NS92_DIR.maxPlayers()){toast(tr('Room is full','Soba je puna'));return false}
   let sent=0;for(const id of online)if(NS96_INVITES?.invite(id))sent++;
   if(sent){lastInviteUiAt=0;showInviteHouse()}return sent>0;
  }
  if(NET.role||NET.phase!=='idle'){
   toast(tr('Connecting to a room already.','Već se povezuješ sa sobom.'));return false;
  }
  if(pendingAutoRoom==='HOST'&&Date.now()<pendingAutoUntil){
   toast(tr('Online room creation is already in progress','Pravljenje online sobe je već u toku'));return false;
  }
  if(!NS103_PARTY?.start){toast(tr('Online invitations unavailable','Online pozivi nisu dostupni'));return false}
  // Reuse the existing host/relay creation exactly once. Auto-return to Village
  // only AFTER the original lobby is confirmed online.
  pendingAutoRoom='HOST';pendingAutoUntil=Date.now()+45000;
  const started=NS103_PARTY.start(online);
  if(!started){pendingAutoRoom='';pendingAutoUntil=0;return false}
  closePane();
  toast(tr('Creating online room and sending invitations…','Pravim online sobu i šaljem pozive…'));
  return true;
 }
 function showInviteHouse(){
  panel(tr('INVITATION HALL · ONLINE PARTY','KUĆA POZIVA · ONLINE DRUŠTVO'));
  focused='invite';
  const headline=document.createElement('p');headline.id='ns122Presence';headline.textContent=inviteRosterText();
  area.append(headline);
  const intro=document.createElement('p');intro.textContent=tr(
   'Invite up to five online friends. Accepting joins THIS room, then opens Village. Start the match with the normal Ready/Start controls.',
   'Pozovi do pet online prijatelja. Prihvatanjem ulaze u ISTU sobu i Village. Partija se pokreće preko postojećih Ready/Start komandi.');
  area.append(intro);
  const actions=document.createElement('div');actions.className='ns122Actions';
  const refresh=document.createElement('button');refresh.type='button';refresh.textContent=tr('↻ REFRESH','↻ OSVEŽI');
  refresh.onclick=()=>{if(SOCIAL?.connected)socialCheckFriends?.();else startSocial?.();showInviteHouse()};
  actions.append(refresh);
  const friendBtn=document.createElement('button');friendBtn.type='button';friendBtn.textContent=tr('＋ ADD FRIEND','＋ DODAJ PRIJATELJA');
  friendBtn.onclick=()=>{closeVillage();showFriends?.()};actions.append(friendBtn);
  if(isLobby()){
   const code=document.createElement('button');code.type='button';code.id='ns122RoomCode';
   code.textContent=tr('COPY ROOM CODE: ','KOPIRAJ KOD SOBE: ')+NET.code;
   code.onclick=()=>copyVillageText(NET.code);actions.append(code);
   const share=document.createElement('button');share.type='button';share.id='ns122ShareLink';
   share.textContent=tr('COPY JOIN LINK','KOPIRAJ LINK ZA ULAZ');
   share.onclick=()=>copyVillageText(inviteRoomLink());actions.append(share);
  }
  area.append(actions);
  const ids=Object.keys(SOCIAL?.db?.friends||{}).sort((a,b)=>(!!SOCIAL.conns.get(b)?.open)-(!!SOCIAL.conns.get(a)?.open)||
   String(SOCIAL.db.friends[a].name).localeCompare(String(SOCIAL.db.friends[b].name)));
  const list=document.createElement('div');list.id='ns122Friends';list.className='ns122Friends';
  const inRoom=new Set(getPlayers().map(p=>p.friendId));
  const full=isLobby()&&getPlayers().length>=NS92_DIR.maxPlayers();
  let onlineCount=0;const selected=[];
  for(const id of ids){
   const f=SOCIAL.db.friends[id],online=!!SOCIAL.conns.get(id)?.open,joined=inRoom.has(id);
   if(online&&!joined)onlineCount++;
   const row=document.createElement('div');row.className='ns122Friend';
   const text=document.createElement('span');text.textContent=safePlayerName(f.name)+(joined?tr(' · ✓ HERE',' · ✓ OVDE'):online?' · ● ONLINE':' · ○ OFFLINE');
   const btn=document.createElement('button');btn.type='button';btn.dataset.friendId=id;
   btn.disabled=!online||joined||full||(!isLobby()&&NET.phase!=='idle');
   btn.textContent=joined?tr('IN ROOM','U SOBI'):!online?'OFFLINE':full?tr('FULL','PUNO'):tr('INVITE','POZOVI');
   btn.onclick=()=>startVillageInvites([id]);row.append(text,btn);list.append(row);
   if(online&&!joined)selected.push(id);
  }
  if(!ids.length){
   const hint=document.createElement('p');hint.textContent=tr('No friends yet. Add them by their in-game Friend ID.',
    'Još nema prijatelja. Dodaj ih preko ID-a prijatelja iz igre.');list.append(hint);
  }
  area.append(list);
  if(onlineCount>1){
   const all=document.createElement('button');all.id='ns122InviteAll';all.type='button';
   all.textContent=tr('✉ INVITE ONLINE FRIENDS','✉ POZOVI ONLINE PRIJATELJE')+' ('+Math.min(5,selected.length)+')';
   all.disabled=full;all.onclick=()=>startVillageInvites(selected.slice(0,5));area.append(all);
  }
  if(isLobby()){
   const controls=document.createElement('div');controls.className='ns122Actions';
   const ready=document.createElement('button');ready.id='ns122Ready';ready.type='button';
   ready.textContent=tr('✓ READY / UNREADY','✓ SPREMAN / NISAM SPREMAN');
   ready.onclick=()=>{$('lobbyReadyBtn')?.click();headline.textContent=inviteRosterText()};controls.append(ready);
   if(NET.role==='host'){
    const start=document.createElement('button');start.id='ns122Start';start.type='button';
    start.textContent=tr('▶ START MATCH','▶ POKRENI PARTIJU');
    start.onclick=()=>{
     if(!getPlayers().length||getPlayers().length<2){toast(tr('At least two players needed','Potrebna su bar dva igrača'));return}
     // Original start handler enforces READY, world loading and host authority.
     $('lobbyStartBtn')?.click();
    };
    controls.append(start);
   }
   area.append(controls);
  }else if(NET.phase==='idle'){
   const guide=document.createElement('small');guide.textContent=tr('An online room is created only when you send an invite. No duplicate server is opened.',
    'Online soba se kreira tek kad pošalješ poziv. Ne pravi se dupli server.');
   area.append(guide);
  }
  lastInviteUiAt=performance.now();
  if(!SOCIAL?.peer&&!SOCIAL?.starting)startSocial?.();
 }
 function onVillageLobbyReady(){
  const expected=pendingAutoRoom;
  if(expected&&Date.now()>pendingAutoUntil){pendingAutoRoom='';pendingAutoUntil=0}
  if(pendingAutoRoom&&isLobby()&&(pendingAutoRoom==='HOST'?NET.role==='host':NET.code===pendingAutoRoom)){
   pendingAutoRoom='';pendingAutoUntil=0;
   if(!opened)showVillage();
   else if(root.classList.contains('ns109Hidden'))root.classList.remove('ns109Hidden');
   toast(tr('Connected! Welcome to the online Village.','Povezano! Dobro došli u online selo.'));
   return;
  }
  scheduleAutoVillage();
 }
 function expectVillageJoin(room){
  if(!/^[A-HJ-NP-Z2-9]{6}$/.test(String(room||'')))return false;
  pendingAutoRoom=room;pendingAutoUntil=Date.now()+45000;return true;
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
  // Pastoral landmarks placed outside the main roads and cottage entrances.
  for(const [x,y,r] of [[40,58,26],[932,64,30],[35,480,29],[923,496,30],[327,73,22],[838,77,21]]){
   g.fillStyle='#10251c77';g.beginPath();g.ellipse(x+6,y+8,r,r*.4,0,0,7);g.fill();
   g.fillStyle='#745738';g.fillRect(x-4,y-14,8,29);
   g.fillStyle='#376044';g.beginPath();g.arc(x,y-21,r,0,7);g.fill();
   g.fillStyle='#497852';g.beginPath();g.arc(x-12,y-18,r*.63,0,7);g.arc(x+12,y-23,r*.65,0,7);g.fill();
  }
  g.fillStyle='#266976';g.beginPath();g.ellipse(890,301,54,28,-.12,0,7);g.fill();
  g.strokeStyle='#98b5a8';g.lineWidth=2;for(let i=1;i<4;i++){g.beginPath();g.ellipse(890,300,i*12,i*6,-.12,0,7);g.stroke()}
  for(const [x,y] of [[51,218],[911,211],[278,479],[688,479]]){
   g.strokeStyle='#76573d';g.lineWidth=6;g.beginPath();g.moveTo(x-18,y);g.lineTo(x+18,y);g.moveTo(x-18,y+8);g.lineTo(x+18,y+8);g.stroke();
  }
  for(let i=0;i<35;i++){const x=(i*137+51)%952,y=(i*199+24)%525;if(Math.abs(x-488)<74||Math.abs(y-298)<53)continue;
   g.fillStyle=i%3===0?'#f0bb7e':i%3===1?'#ddabdb':'#f2dba6';
   for(let k=0;k<4;k++){g.beginPath();g.arc(x+Math.cos(k*Math.PI/2)*3,y+Math.sin(k*Math.PI/2)*3,2,0,7);g.fill()}
  }
 };
 function house(b){
  g.save();g.translate(b.x,b.y);g.fillStyle='#14211d88';g.fillRect(-b.w/2+7,-b.h/2+11,b.w,b.h);
  g.fillStyle=b.wall;g.fillRect(-b.w/2,-b.h/2+16,b.w,b.h-20);
  g.fillStyle=b.roof;g.beginPath();g.moveTo(-b.w/2-12,-b.h/2+20);g.lineTo(0,-b.h/2-31);g.lineTo(b.w/2+12,-b.h/2+20);g.closePath();g.fill();
  g.fillStyle='#483d35';g.fillRect(-14,b.h/2-37,28,34);
  // Distinct cottage front: solid timber framing, glowing windows, entrance and roof tiles.
  g.strokeStyle='#7b5739';g.lineWidth=3;g.strokeRect(-b.w/2+6,-b.h/2+21,b.w-12,b.h-25);
  g.fillStyle='#f3c977';g.fillRect(-b.w/2+18,-7,25,21);g.fillRect(b.w/2-43,-7,25,21);
  g.strokeStyle='#553f32';g.lineWidth=2;
  for(const wx of [-b.w/2+18,b.w/2-43]){g.strokeRect(wx,-7,25,21);g.beginPath();g.moveTo(wx+12,-7);g.lineTo(wx+12,14);g.moveTo(wx,3);g.lineTo(wx+25,3);g.stroke()}
  g.fillStyle='#594134';g.fillRect(-14,b.h/2-38,28,35);
  g.fillStyle='#eccb8a';g.beginPath();g.arc(9,b.h/2-20,2.6,0,7);g.fill();
  g.fillStyle='#6d5240';g.fillRect(b.w/2-32,-b.h/2-41,13,27);
  g.strokeStyle='#d0ae83';g.lineWidth=1.4;
  for(let x=-b.w/2+11;x<b.w/2-6;x+=20){g.beginPath();g.moveTo(x,-b.h/2+12);g.lineTo(x+11,-b.h/2+23);g.stroke()}
  g.fillStyle='#233b37db';g.fillRect(-b.w/2+6,-b.h/2+24,b.w-12,24);
  g.font='bold 15px system-ui';g.textAlign='center';g.fillStyle='#f7e5a9';g.shadowColor='#071414';g.shadowBlur=3;
  g.fillText(b.icon+' '+tr(b.label,b.sr),0,-b.h/2+41,b.w-18);
  g.shadowBlur=0;g.restore();
 }
 // V121: depth ordering. The road/landscape is cached separately from the houses.
 // Each cottage has a small cached transparent sprite which is placed in the same
 // y-sorted drawing queue as player characters. When behind a cottage, the roof
 // and wall cover the hero; when in front of the doorway, the hero stays visible.
 function villageHouseSprite(b){
  if(houseLayers.has(b.id))return houseLayers.get(b.id);
  const left=Math.floor(b.x-b.w/2-17),top=Math.floor(b.y-b.h/2-51);
  const right=Math.ceil(b.x+b.w/2+17),bottom=Math.ceil(b.y+b.h/2+20);
  const img=document.createElement('canvas');
  img.width=right-left;img.height=bottom-top;
  const off=img.getContext('2d',{alpha:true});
  if(!off)return null;
  off.setTransform(1,0,0,1,-left,-top);
  const prev=g;
  try{g=off;house(b)}finally{g=prev}
  const sprite={img,left,top};
  houseLayers.set(b.id,sprite);
  return sprite;
 }
 function drawDepthHouse(b){
  const sprite=villageHouseSprite(b);
  if(sprite)g.drawImage(sprite.img,sprite.left,sprite.top);else house(b);
 }
 function villageStaticLayer(){
  const lang=window.__gameLanguage?.value||'en';
  if(sceneLayer&&sceneLayerLang===lang)return sceneLayer;
  const img=document.createElement('canvas');img.width=960;img.height=540;
  const off=img.getContext('2d',{alpha:false});if(!off)return null;
  const prev=g;
  try{
   g=off;background();
   g.fillStyle='#467d55';g.beginPath();g.arc(790,465,37,0,7);g.fill();
   g.strokeStyle='#c5c38b';g.lineWidth=5;g.stroke();
   g.font='bold 13px system-ui';g.textAlign='center';g.fillStyle='#f5e5a4';g.fillText('READY',790,475);
  }finally{g=prev}
  houseLayers.clear();
  sceneLayer=img;sceneLayerLang=lang;PERF.staticBuilds++;
  return sceneLayer;
 }
 function sheep(time){
  // Four atmospheric woolly sheep: local-only animation, zero multiplayer packets.
  for(const [i,o] of NPCS.entries()){
   const t=time/2300+i*1.7,x=o.x+Math.sin(t)*18,y=o.y+Math.cos(t*.78)*11;
   g.save();g.translate(x,y+Math.sin(t*4)*1.4);
   g.fillStyle='#0b251e88';g.beginPath();g.ellipse(0,14,20,5,0,0,7);g.fill();
   g.strokeStyle='#766456';g.lineWidth=4;g.lineCap='round';
   for(const lx of [-12,-5,7,14]){g.beginPath();g.moveTo(lx,3);g.lineTo(lx+Math.sin(t*3+lx)*2,17);g.stroke()}
   g.fillStyle='#f4f0df';for(const [wx,wy,r] of [[-10,1,9],[-2,-5,10],[8,-4,10],[14,3,8],[-2,8,9]]){g.beginPath();g.arc(wx,wy,r,0,7);g.fill()}
   g.fillStyle='#bea795';g.beginPath();g.ellipse(20,-2,9,8,.2,0,7);g.fill();
   g.beginPath();g.ellipse(16,-10,5,2,-.6,0,7);g.ellipse(25,-9,5,2,.6,0,7);g.fill();
   g.fillStyle='#332e28';g.fillRect(24,-6,2.4,2.4);g.restore();
  }
 }
 function avatar(id,x,y,name,ready,sparta,animation={}){
  if(typeof drawVillageHero==='function'){
   const look=typeof getVillageHeroLook==='function'?getVillageHeroLook(id):heroStyle;
   drawVillageHero(g,x,y,{id,look,frame:animation.frame||0,walking:!!animation.walking,visualSide:animation.side||1});
   g.save();g.textAlign='center';g.font='bold 12px system-ui';g.lineWidth=3;g.strokeStyle='#0b191d';
   g.strokeText(name,x,y-74);g.fillStyle=ready?'#a4efbd':'#f2d29c';g.fillText(name,x,y-74);
   if(ready){g.font='bold 14px system-ui';g.fillStyle='#c2ffc5';g.fillText('✓',x+27,y-60)}
   const emote=emotes.get(id);if(emote&&Date.now()<emote.until){g.font='22px system-ui';g.fillText(emote.text,x+30,y-75)}
   g.restore();return;
  }
  g.save();g.translate(x,y);g.textAlign='center';g.font='bold 12px system-ui';g.strokeStyle='#0b191d';g.lineWidth=3;g.strokeText(name,0,-36);g.fillStyle=ready?'#a4efbd':'#f2d29c';g.fillText(name,0,-36);
  g.fillStyle='#061a21a1';g.beginPath();g.ellipse(0,15,15,5,0,0,7);g.fill();
  g.fillStyle=sparta?'#d8ac4f':id===NET.localId?'#8abfba':'#9ba8cc';g.fillRect(-11,-18,22,29);
  g.fillStyle='#e3b58e';g.beginPath();g.arc(0,-24,9,0,7);g.fill();
  g.fillStyle=sparta?'#f7d778':'#304a4d';g.fillRect(-10,-34,20,6);
  g.fillStyle='#303c3d';g.fillRect(-11,10,8,15);g.fillRect(3,10,8,15);
  if(ready){g.font='bold 18px system-ui';g.fillStyle='#c2ffc5';g.fillText('✓',18,-22)}
  g.restore();
 }
 // V118: physics shared by joystick, dash and tap-to-walk.
 const COLLISION_PAD=12;
 function blockedVillage(x,y,margin=0){
  if(x<29||x>931||y<62||y>505)return true;
  return buildings.some(b=>x>b.x-b.w/2-COLLISION_PAD-margin&&x<b.x+b.w/2+COLLISION_PAD+margin&&
   y>b.y-b.h/2-COLLISION_PAD-margin&&y<b.y+b.h/2+COLLISION_PAD+margin);
 }
 function moveVillage(dx,dy){
  // Sweep in short segments, so dropped frames cannot tunnel through houses.
  const n=Math.max(1,Math.ceil(Math.hypot(dx,dy)/6)),sx=dx/n,sy=dy/n;
  let moved=false;
  for(let i=0;i<n;i++){
   if(!blockedVillage(my.x+sx,my.y)){my.x+=sx;moved=true}
   else if(Math.abs(sx)>.02)PERF.blockedMoves++;
   if(!blockedVillage(my.x,my.y+sy)){my.y+=sy;moved=true}
   else if(Math.abs(sy)>.02)PERF.blockedMoves++;
  }
  return moved;
 }
 const PATH_CELL=12,PATH_COLS=81,PATH_ROWS=46;
 const tile=(x,y)=>({x:Math.max(0,Math.min(PATH_COLS-1,Math.round(x/PATH_CELL))),
                    y:Math.max(0,Math.min(PATH_ROWS-1,Math.round(y/PATH_CELL)))});
 const pathIdx=(x,y)=>y*PATH_COLS+x;
 // Navigation uses extra clearance so floating-point edge contact cannot trap the hero.
 const validTile=(x,y)=>!blockedVillage(x*PATH_CELL,y*PATH_CELL,5);
 function findVillagePath(from,to){
  PERF.paths++;
  const start=tile(from.x,from.y),end=tile(to.x,to.y);
  const source=pathIdx(start.x,start.y),target=pathIdx(end.x,end.y);
  const prev=new Int32Array(PATH_COLS*PATH_ROWS);prev.fill(-1);
  const queue=new Int32Array(PATH_COLS*PATH_ROWS);
  let head=0,tail=0;queue[tail++]=source;prev[source]=source;
  for(;head<tail&&prev[target]<0;){
   const id=queue[head++],x=id%PATH_COLS,y=Math.floor(id/PATH_COLS);
   for(const [dx,dy] of [[0,1],[1,0],[-1,0],[0,-1]]){
    const nx=x+dx,ny=y+dy;if(nx<0||ny<0||nx>=PATH_COLS||ny>=PATH_ROWS)continue;
    const ni=pathIdx(nx,ny);if(prev[ni]>=0||!validTile(nx,ny))continue;
    prev[ni]=id;queue[tail++]=ni;
   }
  }
  if(prev[target]<0)return null;
  const points=[];
  for(let id=target;id!==source;id=prev[id])points.push({x:id%PATH_COLS*PATH_CELL,y:Math.floor(id/PATH_COLS)*PATH_CELL});
  points.reverse();
  const compact=[];
  for(let i=0;i<points.length;i++){
   const a=points[i],b=points[i+1],c=points[i+2];
   if(b&&c&&(b.x-a.x)*(c.y-b.y)===(b.y-a.y)*(c.x-b.x))continue;
   compact.push(a);
  }
  if(!blockedVillage(to.x,to.y))compact.push(to);
  return compact;
 }
 // V120: physical door interaction shared by manual movement and tap-to-visit.
 const doorPoint=b=>({x:b.x,y:b.y+b.h/2+26});
 function closestDoor(){
  let best=null,dist=Infinity;
  for(const b of buildings){
   const p=doorPoint(b),d=Math.hypot(my.x-p.x,my.y-p.y);
   if(d<dist){dist=d;best=b}
  }
  return dist<=45?best:null;
 }
 function updateDoorInteraction(manual){
  const b=closestDoor(),btn=$('ns120Door');
  const active=opened&&pane.classList.contains('ns109Hidden')&&!root.classList.contains('ns109Hidden');
  if(doorLatch){
   const previous=buildings.find(x=>x.id===doorLatch);
   if(!previous||Math.hypot(my.x-doorPoint(previous).x,my.y-doorPoint(previous).y)>65)doorLatch=null;
  }
  btn.classList.toggle('ns109Hidden',!active||!b);
  const label=b?tr('↳ ENTER ','↳ UĐI U ')+tr(b.label,b.sr):'';
  if(b&&doorLabel!==label){btn.textContent=label;doorLabel=label}
  if(!active||!b||doorLatch===b.id)return;
  if(manual||(thenEnter===b.id&&!walkTo)){
   doorLatch=b.id;walkTo=null;route=[];thenEnter=null;enter(b.id);
  }
 }
 $('ns120Door').onclick=()=>{
  const b=closestDoor();if(!b||!opened||!pane.classList.contains('ns109Hidden'))return;
  doorLatch=b.id;walkTo=null;route=[];thenEnter=null;enter(b.id);
 };
 function startVillageTravel(x,y,entry=null){
  const p=ground(x,y);if(blockedVillage(p.x,p.y))return false;
  const path=findVillagePath(my,p);if(!path)return false;
  route=path;routeIndex=0;walkTo=route[0]||null;thenEnter=entry;
  if(!walkTo&&entry){doorLatch=entry;thenEnter=null;enter(entry)}
  return true;
 }
 function updateVillageTravel(dt){
  if(!walkTo)return;
  let remaining=150*dt,loops=0;
  while(remaining>.01&&walkTo&&loops++<16){
   const dx=walkTo.x-my.x,dy=walkTo.y-my.y,d=Math.hypot(dx,dy);
   if(d<=2.5){routeIndex++;walkTo=route[routeIndex]||null;
    if(!walkTo){const entry=thenEnter;thenEnter=null;route=[];if(entry){doorLatch=entry;enter(entry)}}
    continue;
   }
   const distance=Math.min(d,remaining),oldX=my.x,oldY=my.y;
   moveVillage(dx/d*distance,dy/d*distance);
   const actual=Math.hypot(my.x-oldX,my.y-oldY);
   if(actual<.03){walkTo=null;route=[];thenEnter=null;return}
   remaining-=actual;
   if(d-actual<=2.5){routeIndex++;walkTo=route[routeIndex]||null;
    if(!walkTo){const entry=thenEnter;thenEnter=null;route=[];if(entry){doorLatch=entry;enter(entry)}}
   }
  }
 }
 function resetStick(){stick.id=null;stick.vx=0;stick.vy=0;stick.drag=false;$('ns117Stick').classList.add('ns109Hidden');$('ns117Knob').style.transform='translate(0,0)'}
 function moveStick(e){
  if(e.pointerId!==stick.id)return;
  const dx=e.clientX-stick.x,dy=e.clientY-stick.y,d=Math.hypot(dx,dy);
  if(d>11)stick.drag=true;if(!stick.drag)return;
  const power=clamp((d-11)/57,0,1);stick.vx=d?dx/d*power:0;stick.vy=d?dy/d*power:0;
  $('ns117Knob').style.transform='translate('+clamp(dx,-28,28)+'px,'+clamp(dy,-28,28)+'px)';
 }
 canvas.addEventListener('pointerdown',e=>{
  if(!opened||!canVisit()||!pane.classList.contains('ns109Hidden')||stick.id!==null)return;
  if(e.pointerType==='mouse'&&e.button!==0)return;e.preventDefault();
  stick.id=e.pointerId;stick.x=e.clientX;stick.y=e.clientY;stick.drag=false;
  const b=$('ns109Stage').getBoundingClientRect(),el=$('ns117Stick');
  el.style.left=(e.clientX-b.left)+'px';el.style.top=(e.clientY-b.top)+'px';el.classList.remove('ns109Hidden');
  try{canvas.setPointerCapture(e.pointerId)}catch{}
 });
 canvas.addEventListener('pointermove',e=>{if(e.pointerId===stick.id){e.preventDefault();moveStick(e)}});
 for(const type of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(type,e=>{
  if(e.pointerId!==stick.id)return;
  const tapOnly=type==='pointerup'&&!stick.drag;resetStick();if(tapOnly)tap(e);
 });
 for(const kind of ['keydown','keyup'])window.addEventListener(kind,e=>{
  if(!opened||/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName||''))return;
  const k=e.key.length===1?e.key.toLowerCase():e.key;
  if(k===' '||k==='Spacebar'){e.preventDefault();if(kind==='keydown'&&!e.repeat&&!pane.classList.contains('ns109Hidden'))return;if(kind==='keydown'&&!e.repeat)$('ns117Dodge')?.click();return;}
  keys[k]=kind==='keydown';
  if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','w','a','s','d'].includes(k))e.preventDefault();
 });
 window.addEventListener('blur',()=>{for(const k of Object.keys(keys))delete keys[k];resetStick()});
 $('ns117Dodge').onclick=()=>{const now=performance.now();if(!opened||now<dodgeReady)return;dodgeUntil=now+260;dodgeReady=now+2800};
 function step(time){
  if(!opened||!canVisit()){if(opened)closeVillage();return}
  if(document.hidden)return;
  const dt=clamp((time-frameAt)/1000,0,.14);frameAt=time;
  if(focused==='invite'&&time-lastInviteUiAt>=1600){lastInviteUiAt=time;const status=$('ns122Presence');if(status)status.textContent=inviteRosterText()}
  const roster=getPlayers();
  const stateText=isLobby()?
   tr('● ONLINE ROOM ','● ONLINE SOBA ')+NET.code+' · '+roster.length+'/'+NS92_DIR.maxPlayers():
   tr('◇ SOLO VILLAGE','◇ SOLO SELO');
  if($('ns109Info').textContent!==stateText)$('ns109Info').textContent=stateText;
  const oldX=my.x,oldY=my.y;
  const keyX=(keys.ArrowRight||keys.d?1:0)-(keys.ArrowLeft||keys.a?1:0);
  const keyY=(keys.ArrowDown||keys.s?1:0)-(keys.ArrowUp||keys.w?1:0);
  const vx=stick.vx+keyX,vy=stick.vy+keyY,magnitude=Math.hypot(vx,vy);
  if(magnitude>.05){
   walkTo=null;thenEnter=null;route=[];
   const speed=150*(time<dodgeUntil?2.25:1)*dt;
   moveVillage(vx/Math.max(1,magnitude)*speed,vy/Math.max(1,magnitude)*speed);
  }else if(walkTo){updateVillageTravel(dt)}
  walking=Math.hypot(my.x-oldX,my.y-oldY)>.15;
  if(walking){stepFrame+=dt*8;if(my.x<oldX-.1)side=-1;if(my.x>oldX+.1)side=1}
  updateDoorInteraction(magnitude>.05&&walking);
  $('ns117Dodge').disabled=time<dodgeReady;
  if(NET.phase==='lobby'&&NET.role==='guest'&&NET.conn?.open&&time-lastSent>110){
   lastSent=time;try{NET.conn.send({t:'ns109Move',x:Math.round(my.x),y:Math.round(my.y)})}catch{}
  }
  if(NET.role==='host'&&time-lastBroadcast>125){
   lastBroadcast=time;const players=[...avatars.entries()].filter(([id])=>getPlayers().some(p=>p.id===id)).slice(0,6).map(([id,a])=>({id,x:Math.round(a.x),y:Math.round(a.y),walking:!!a.walking&&time-a.lastMoveAt<360,side:a.side||1}));
   players.push({id:NET.localId,x:Math.round(my.x),y:Math.round(my.y),walking,side});
   const packet={t:'ns109State',players};for(const c of NET.clients.values())if(c?.open)try{c.send(packet)}catch{}
  }
  const screen=view(),ratio=Math.min(1.5,window.devicePixelRatio||1),w=Math.max(1,Math.round(screen.rect.width*ratio)),h=Math.max(1,Math.round(screen.rect.height*ratio));
  if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h}
  g.setTransform(ratio,0,0,ratio,0,0);g.fillStyle='#1d342d';g.fillRect(0,0,screen.rect.width,screen.rect.height);
  g.setTransform(ratio*screen.scale,0,0,ratio*screen.scale,ratio*screen.ox,ratio*screen.oy);
  const layer=villageStaticLayer();if(layer)g.drawImage(layer,0,0);else background();
  sheep(time);PERF.frames++;
  const depthItems=buildings.map(b=>({y:b.y+b.h/2,kind:'house',id:b.id,paint:()=>drawDepthHouse(b)}));
  for(const p of roster){
   if(p.id===NET.localId)continue;
   const dest=avatars.get(p.id)||{x:460+Number(p.id?.slice(1)||2)*27,y:279};
   let a=smoothAvatars.get(p.id);
   if(!a){a={x:dest.x,y:dest.y};smoothAvatars.set(p.id,a)}
   const t=Math.min(1,dt*10);a.x+=(dest.x-a.x)*t;a.y+=(dest.y-a.y)*t;
   const moving=Math.hypot(a.x-dest.x,a.y-dest.y)>1;
   depthItems.push({y:a.y,kind:'hero',id:p.id,paint:()=>avatar(p.id,a.x,a.y,String(p.name||'GUARDIAN').slice(0,14),p.ready,false,{walking:moving||!!dest.walking,frame:time/145,side:dest.side||1})});
  }
  const me=roster.find(p=>p.id===NET.localId);
  depthItems.push({y:my.y,kind:'hero',id:NET.localId,paint:()=>avatar(NET.localId,my.x,my.y,ownName(),!!me?.ready||NET.ns97Results?.votes?.[NET.localId]==='yes',spartaEquipped(),{walking,frame:stepFrame,side})});
  depthItems.sort((a,b)=>a.y-b.y||(a.kind===b.kind?0:(a.kind==='house'?-1:1)));
  lastDepthOrder=depthItems.map(item=>item.kind+':'+item.id);
  for(const item of depthItems)item.paint();
  if(opened&&!pane.classList.contains('ns109Hidden')&&focused==='leaderboard')return;
 }
 function onMessage(data,assigned){
  if(!data||!['ns109Move','ns109State','ns109Emote'].includes(data.t))return false;
  if(!isLobby())return true;
  if(NET.role==='host'){
   if(!/^p[2-6]$/.test(String(assigned||''))||!NET.clients.get(assigned)?.open)return true;
   if(data.t==='ns109State')return true;
   const now=performance.now(),prev=limits.get(assigned)||{at:0,x:450,y:285,emote:0};
   if(now-prev.at<85)return true;
   if(data.t==='ns109Emote'){
    if(now-prev.emote>5000&&['👋','⚔','🍻'].includes(data.emote)){prev.emote=now;emotes.set(assigned,{text:data.emote,until:Date.now()+2500});
      for(const c of NET.clients.values())if(c?.open)try{c.send({t:'ns109Emote',id:assigned,emote:data.emote})}catch{}}
    limits.set(assigned,prev);return true;
   }
   if(Number.isFinite(data.x)&&Number.isFinite(data.y)){
    const p=ground(data.x,data.y);const dt=clamp((now-prev.at)/1000,.16,1.5),max=155*dt+16;
    const d=Math.hypot(p.x-prev.x,p.y-prev.y),t=d>max?max/d:1;
    prev.x+=((p.x-prev.x)*t);prev.y+=((p.y-prev.y)*t);prev.at=now;
    const old=avatars.get(assigned);avatars.set(assigned,{x:prev.x,y:prev.y,walking:d>2,side:d>2?(p.x<prev.x?-1:1):(old?.side||1),lastMoveAt:d>2?now:(old?.lastMoveAt||0)});limits.set(assigned,prev);
    if(!opened&&now-lastBroadcast>750){
     lastBroadcast=now;const peers=[...avatars.entries()].filter(([id])=>getPlayers().some(p=>p.id===id)).slice(0,6).map(([id,a])=>({id,x:Math.round(a.x),y:Math.round(a.y)}));
     for(const c of NET.clients.values())if(c?.open)try{c.send({t:'ns109State',players:peers})}catch{}
    }
   }
   return true;
  }
  if(data.t==='ns109State'){
   if(!Array.isArray(data.players)||data.players.length>8)return true;
   for(const p of data.players)if(/^p[1-6]$/.test(String(p?.id||''))&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.id!==NET.localId)avatars.set(p.id,{...ground(p.x,p.y),walking:!!p.walking,side:p.side===-1?-1:1});
   return true;
  }
  if(data.t==='ns109Emote'&&/^p[1-6]$/.test(String(data.id||''))&&['👋','⚔','🍻'].includes(data.emote))emotes.set(data.id,{text:data.emote,until:Date.now()+2500});
  return true;
 }
 function tap(e){
  if(!opened||!canVisit()||!pane.classList.contains('ns109Hidden'))return;
  const p=ctxPoint(e);if(p.x<0||p.y<0||p.x>960||p.y>540)return;
  const b=buildings.find(x=>Math.abs(p.x-x.x)<x.w/2+25&&Math.abs(p.y-x.y)<x.h/2+30);
  if(b){if(!startVillageTravel(b.x,b.y+b.h/2+26,b.id))toast(tr('Path blocked. Walk closer.','Put je blokiran. Priđi bliže.'));}
  else if(Math.hypot(p.x-790,p.y-465)<44){startVillageTravel(790,465,'ready');}
  else{startVillageTravel(p.x,p.y)}
 }
 function showVillage(){
  if(!canVisit()){toast(tr('Open the village from the main menu or multiplayer lobby.','Otvori selo iz glavnog menija ili multiplayer lobija.'));return false;}
  soloPreview=!isLobby();
  if(!soloPreview){$('coopPanel')?.classList.remove('hidden');$('lobbyArea')?.classList.remove('hidden')}
  opened=true;walkTo=null;thenEnter=null;route=[];doorLatch=null;doorLabel='';resetStick();stepFrame=0;walking=false;closePane();my.x=490;my.y=284;
  frameAt=performance.now();villageLastTick=0;villageFrameCredit=VILLAGE_TARGET_MS;
  fpsStart=0;fpsFrames=0;drawMsSum=0;drawMsMax=0;PERF.fps=0;
  root.classList.remove('ns109Hidden');$('home')?.classList.add('hidden');
  $('ns109Hint').textContent=tr('Walk to a doorway to enter · tap a house to visit','Priđi vratima za ulaz · dodirni kućicu da priđeš');
  return true;
 }
 function closeVillage(){const wasSolo=soloPreview;resetStick();opened=false;villageLastTick=0;villageFrameCredit=0;soloPreview=false;walkTo=null;route=[];doorLatch=null;thenEnter=null;closePane();root.classList.add('ns109Hidden');smoothAvatars.clear();avatars.clear();limits.clear();stopMusic();document.body.classList.remove('ns109External');if(wasSolo&&NET.role===''&&G.mode==='menu')$('home')?.classList.remove('hidden')}
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
 $('ns109Classic').onclick=()=>{pendingAutoRoom='';pendingAutoUntil=0;localStorage.setItem('ns109_village_pref','classic');closeVillage()};
 $('ns109Sound').onclick=playMusic;
 $('ns109Results').onclick=()=>{closeVillage();$('ns97Results')?.scrollIntoView({block:'start'})};
 $('ns109Global').onclick=()=>{focused='leaderboard';showRankings()};
 $('ns109Sparta').onclick=showSparta;
 $('ns109Voices').onclick=showVoice;
 $('ns109Chat').onclick=()=>enter('chat');
 // V117 pointer handlers above distinguish tap-to-enter from drag-to-move.
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
 // V119: share the main game's rAF clock and target 60 displayed frames/second.
 // Fractional credit yields ~60 at 90/120Hz instead of skipping down to 45/30.
 function villageFrame(now){
  if(!opened)return;
  if(!canVisit()){closeVillage();return}
  if(document.hidden||root.classList.contains('ns109Hidden')){
   villageLastTick=0;villageFrameCredit=0;frameAt=now;return;
  }
  if(!villageLastTick){
   villageLastTick=now;villageFrameCredit=VILLAGE_TARGET_MS;
  }else{
   villageFrameCredit=Math.min(VILLAGE_TARGET_MS*2,villageFrameCredit+Math.max(0,Math.min(70,now-villageLastTick)));
   villageLastTick=now;
  }
  if(villageFrameCredit+0.35<VILLAGE_TARGET_MS)return;
  villageFrameCredit=Math.max(0,villageFrameCredit-VILLAGE_TARGET_MS);
  const started=performance.now();
  step(now);
  const spent=performance.now()-started;
  fpsFrames++;drawMsSum+=spent;drawMsMax=Math.max(drawMsMax,spent);
  if(!fpsStart)fpsStart=now;
  if(now-fpsStart>=1050){
   const duration=now-fpsStart;
   PERF.fps=Math.round(fpsFrames*1000/duration);
   PERF.averageDrawMs=Math.round(drawMsSum/fpsFrames*100)/100;
   PERF.maxDrawMs=Math.round(drawMsMax*100)/100;
   fpsFrames=0;drawMsSum=0;drawMsMax=0;fpsStart=now;
   if(fpsBadge)fpsBadge.textContent=PERF.fps+' FPS · '+PERF.averageDrawMs.toFixed(1)+'ms';
  }
 }
 window.NS109_VILLAGE={open:showVillage,close:closeVillage,frame:villageFrame,onMessage,enter,onLobbyUI:onVillageLobbyReady,expectJoin:expectVillageJoin,openInvites:()=>{if(!opened&&canVisit())showVillage();if(!opened)return false;showInviteHouse();return true},
 onSoloResult:run=>{if(run&&NET.role===''&&G.runType==='default'&&!G.debugRun)spartaClaim(run.kills)},
 onMPAward:packet=>{if(packet&&Number.isFinite(packet.kills)&&!G.debugRun){spartaClaim(packet.kills);recordPersonalMP(packet)}},
 get opened(){return opened},test:{spartaClaim,spartaOwned,spartaEquipped,spartaKey,buildings,ground,readRankings,personalStats,recordPersonalMP,get soloPreview(){return soloPreview},get sheepCount(){return NPCS.length},get position(){return {x:my.x,y:my.y}},get scene(){return root},get debug(){return {...PERF,routeLength:route.length,routeIndex,coords:{...my},nearDoor:closestDoor()?.id||null,doorLatch,depthOrder:lastDepthOrder.slice(),cachedHouses:houseLayers.size,pendingAutoRoom}},blocked:blockedVillage,route:(x,y)=>findVillagePath(my,ground(x,y)),go:(x,y)=>opened&&startVillageTravel(x,y),visit:(id)=>{const b=buildings.find(x=>x.id===id);return opened&&!!b&&startVillageTravel(doorPoint(b).x,doorPoint(b).y,b.id)},testMove:(x,y)=>{if(!new URLSearchParams(location.search).has('village-test')||!opened)return false;const p=ground(x,y);if(blockedVillage(p.x,p.y))return false;my.x=p.x;my.y=p.y;return true}}};
 window.NS109_SPARTA={appearance:decorate,owned:spartaOwned,equipped:spartaEquipped,claim:spartaClaim};
 // Real engine preview: preserve the current selected character and input.
 if(new URLSearchParams(location.search).get('village-test')==='1'){
  const launch=()=>{
   const ok=showVillage();
   window.__VILLAGE_PREVIEW_STATUS={open:ok,buildings:buildings.length,sheep:NPCS.length,authenticHero:typeof drawVillageHero==='function'};
   if(ok&&!$('return')){
    const link=document.createElement('a');link.id='return';link.href='./';link.textContent=tr('← FULL GAME','← IGRA');
    link.style.cssText='position:absolute;z-index:3;right:9px;bottom:calc(78px + env(safe-area-inset-bottom));padding:8px;border-radius:9px;background:#123832;border:1px solid #9fc3ad;color:#f6e4b8;text-decoration:none;font:bold 11px system-ui';
    root.append(link);
   }
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',launch,{once:true});else launch();
 }

})();
