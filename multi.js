// ============ CoastlineGuessr Multiplayer ============
const sb = window.CLG_SB;
const { MODES, PLAYER_COLORS, distKm, pin, addImagery, streetLayer, multiToken } = window.CLG;

let me = "";              // my player name
let roomCode = "";        // current room
let isHost = false;
let mode = "Easy";
let roundNum = 0;
let channel = null;       // realtime channel
let mysteryMap, guessMap, revealMap, guessMarker;
let timerId = null, timeLeft = 0, roundLimit = 0, hasGuessed = false, roundStart = 0;
let players = [];         // [{name, score, ready}]
let colorByName = {};

// ---------- screen routing ----------
function show(id){
  document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
  document.getElementById('screen-'+id).classList.add('active');
}
function toast(msg){
  const t=document.getElementById('toast'); t.textContent=msg; t.classList.add('show');
  clearTimeout(t._t); t._t=setTimeout(()=>t.classList.remove('show'), 2600);
}
function err(msg){ document.getElementById('homeErr').textContent=msg||''; }

function colorFor(name){
  if(!colorByName[name]){
    const idx = Object.keys(colorByName).length % PLAYER_COLORS.length;
    colorByName[name] = PLAYER_COLORS[idx];
  }
  return colorByName[name];
}

// ---------- maps ----------
function initMaps(){
  if(!mysteryMap){
    mysteryMap = L.map('mystery', { zoomControl:false, attributionControl:false, dragging:false, scrollWheelZoom:false, doubleClickZoom:false, boxZoom:false, keyboard:false, touchZoom:false });
    addImagery(mysteryMap);
  }
  if(!guessMap){
    guessMap = L.map('guessmap', { zoomControl:true, worldCopyJump:true, minZoom:1 }).setView([20,0],2);
    streetLayer(guessMap);
    guessMap.on('click', e=>{ if(!hasGuessed) placeGuess(e.latlng.lat, e.latlng.lng); });
  }
}
function placeGuess(lat,lng){
  if(guessMarker) guessMap.removeLayer(guessMarker);
  guessMarker = L.marker([lat,lng], { icon:pin(colorFor(me)) }).addTo(guessMap);
  document.getElementById('lockBtn').disabled=false;
  document.getElementById('playHint').textContent='Adjust or lock it in.';
}

// ---------- timer ----------
function stopTimer(){ if(timerId){ clearInterval(timerId); timerId=null; } }
function startTimer(serverStartMs){
  stopTimer();
  roundLimit = MODES[mode].time;
  const tick=100;
  timerId=setInterval(()=>{
    const elapsed = (Date.now() - serverStartMs)/1000;
    timeLeft = Math.max(0, roundLimit - elapsed);
    const el=document.getElementById('timer'), num=document.getElementById('timerNum');
    num.textContent=Math.ceil(timeLeft);
    if(timeLeft<=5) el.classList.add('warn'); else el.classList.remove('warn');
    if(timeLeft<=0){ stopTimer(); onTimeout(); }
  }, tick);
}
function onTimeout(){
  if(hasGuessed) return;
  lockGuess(true);
}

// ---------- RPC helpers ----------
async function rpc(fn, args){
  const { data, error } = await sb.rpc(fn, args);
  if(error){ console.warn(fn, error.message); throw error; }
  return data;
}

// ---------- HOME: create / join ----------
document.getElementById('createBtn').addEventListener('click', async ()=>{
  me = (document.getElementById('nameInput').value||'').trim().slice(0,18);
  if(!me){ err('Enter your name first.'); return; }
  mode = document.getElementById('modeSelect').value;
  if(!sb){ err('No connection to server.'); return; }
  try {
    const h = await multiToken();
    roomCode = await rpc('create_room', { p_host: me, p_mode: mode, p_h: h });
    isHost = true;
    enterLobby();
  } catch(e){ err('Could not create lobby.'); }
});
document.getElementById('joinBtn').addEventListener('click', async ()=>{
  me = (document.getElementById('nameInput').value||'').trim().slice(0,18);
  const code = (document.getElementById('codeInput').value||'').trim().toUpperCase();
  if(!me){ err('Enter your name first.'); return; }
  if(code.length!==4){ err('Enter the 4-letter code.'); return; }
  try {
    const h = await multiToken();
    await rpc('join_room', { p_code: code, p_name: me, p_h: h });
    roomCode = code; isHost = false;
    const { data } = await sb.from('rooms').select('mode').eq('code', code).single();
    mode = data ? data.mode : 'Easy';
    enterLobby();
  } catch(e){ err('Could not join — check the code.'); }
});

// auto-join via ?room=CODE
const urlRoom = new URLSearchParams(location.search).get('room');
if(urlRoom){ document.getElementById('codeInput').value = urlRoom.toUpperCase(); }

// ---------- LOBBY ----------
function enterLobby(){
  show('lobby');
  document.getElementById('roomCode').textContent = roomCode;
  subscribeRoom();
  refreshPlayers();
  heartbeat();
  document.getElementById('startBtn').style.display = isHost ? '' : 'none';
}
document.getElementById('copyHint').addEventListener('click', ()=>{
  const link = location.origin + location.pathname + '?room=' + roomCode;
  navigator.clipboard?.writeText(link).then(()=>toast('Invite link copied!'));
});
document.getElementById('leaveBtn').addEventListener('click', leaveRoom);
document.getElementById('startBtn').addEventListener('click', async ()=>{
  try {
    const h = await multiToken();
    await rpc('start_room', { p_code: roomCode, p_host: me, p_h: h });
  } catch(e){ toast('Could not start.'); }
});

async function refreshPlayers(){
  const { data } = await sb.from('room_players').select('name,score,ready').eq('room_code', roomCode).order('joined_at');
  players = data || [];
  renderLobbyPlayers();
}
function renderLobbyPlayers(){
  const list=document.getElementById('lobbyPlayers'); list.innerHTML='';
  players.forEach(p=>{
    const div=document.createElement('div'); div.className='player-chip';
    div.innerHTML=`<span class="nm"><span class="dot" style="background:${colorFor(p.name)}"></span>${escapeHtml(p.name)}</span>`+
      (p.name===me?'<span class="tag">you</span>':'');
    list.appendChild(div);
  });
  const enough = players.length>=2;
  const sb_btn=document.getElementById('startBtn');
  if(isHost){ sb_btn.disabled=!enough; }
  document.getElementById('lobbyHint').textContent = enough ? (isHost?'Ready when you are.':'Waiting for host to start…') : 'Waiting for players… you need at least 2.';
}

// ---------- REALTIME ----------
function subscribeRoom(){
  if(channel) sb.removeChannel(channel);
  channel = sb.channel('room:'+roomCode)
    .on('postgres_changes', { event:'*', schema:'public', table:'room_players', filter:'room_code=eq.'+roomCode }, ()=>{ refreshPlayers(); onPlayersChanged(); })
    .on('postgres_changes', { event:'*', schema:'public', table:'rooms', filter:'code=eq.'+roomCode }, payload=>{ onRoomChange(payload.new); })
    .on('postgres_changes', { event:'*', schema:'public', table:'room_guesses', filter:'room_code=eq.'+roomCode }, ()=>{ onGuessUpdate(); })
    .subscribe();
}

async function onRoomChange(room){
  if(!room) return;
  mode = room.mode;
  if(room.status==='playing'){
    if(room.round_num !== roundNum || !document.getElementById('screen-play').classList.contains('active')){
      roundNum = room.round_num;
      startRound(room.round_started_at);
    }
  } else if(room.status==='reveal'){
    if(!document.getElementById('screen-reveal').classList.contains('active')) doReveal();
  } else if(room.status==='finished'){
    doFinal();
  }
}

function onPlayersChanged(){
  if(document.getElementById('screen-reveal').classList.contains('active')) renderRevealScoreboard();
}

// ---------- PLAY ----------
async function startRound(serverStartedAt){
  show('play'); initMaps();
  hasGuessed=false; if(guessMarker){ guessMap.removeLayer(guessMarker); guessMarker=null; }
  document.getElementById('lockBtn').disabled=true;
  document.getElementById('playHint').textContent='Tap the map to place your pin.';
  document.getElementById('playPill').textContent=mode.toUpperCase();
  document.getElementById('roundTitle').textContent=`Round ${roundNum} / 5`;
  document.getElementById('timer').classList.remove('warn');
  guessMap.setView([20,0],2);

  const view = await rpc('get_view', { p_code: roomCode, p_round: roundNum });
  const v = Array.isArray(view)?view[0]:view;
  const serverStartMs = new Date(serverStartedAt || v.round_started_at).getTime();
  roundStart = serverStartMs;
  setTimeout(()=>{
    mysteryMap.invalidateSize(); guessMap.invalidateSize();
    mysteryMap.setView([v.view_lat, v.view_lon], v.zoom, { animate:false });
    startTimer(serverStartMs);
  }, 80);
  updateGuessStatus();
}

document.getElementById('lockBtn').addEventListener('click', ()=>lockGuess(false));
async function lockGuess(timedOut){
  if(hasGuessed) return;
  hasGuessed=true; stopTimer();
  document.getElementById('lockBtn').disabled=true;
  const elapsed = Math.min(roundLimit, (Date.now()-roundStart)/1000);
  let lat=null, lon=null;
  if(guessMarker && !timedOut){ const g=guessMarker.getLatLng(); lat=g.lat; lon=g.lng; }
  else if(guessMarker && timedOut){ const g=guessMarker.getLatLng(); lat=g.lat; lon=g.lng; }
  try {
    const h = await multiToken();
    const pts = await rpc('submit_guess', { p_code:roomCode, p_round:roundNum, p_name:me, p_lat:lat, p_lon:lon, p_time: timedOut?9999:elapsed, p_h:h });
    document.getElementById('playHint').textContent = `Locked in — +${pts} pts. Waiting for others…`;
  } catch(e){ document.getElementById('playHint').textContent='Guess submitted.'; }
  checkAllGuessed();
}

async function updateGuessStatus(){
  const { data:g } = await sb.from('room_guesses').select('player_name').eq('room_code',roomCode).eq('round_num',roundNum);
  const guessed = g?g.length:0;
  document.getElementById('guessStatus').textContent = `${guessed}/${players.length} guessed`;
}
async function onGuessUpdate(){
  await updateGuessStatus();
  checkAllGuessed();
}
async function checkAllGuessed(){
  const { data:g } = await sb.from('room_guesses').select('player_name').eq('room_code',roomCode).eq('round_num',roundNum);
  if(g && players.length>0 && g.length>=players.length){
    // everyone guessed → first client to notice triggers reveal
    try { await rpc('reveal_round', { p_code:roomCode, p_round:roundNum }); } catch(e){}
  }
}

// ---------- REVEAL ----------
async function doReveal(){
  stopTimer();
  if(!hasGuessed){ await lockGuess(true); }   // ensure my guess recorded
  show('reveal');
  document.getElementById('revealPill').textContent='ROUND '+roundNum;
  if(!revealMap){
    revealMap = L.map('revealmap', { worldCopyJump:true, minZoom:1 }).setView([20,0],2);
    streetLayer(revealMap);
  }
  setTimeout(()=>revealMap.invalidateSize(),80);

  const rows = await rpc('reveal_round', { p_code:roomCode, p_round:roundNum });
  const list = Array.isArray(rows)?rows:[];
  if(!list.length) return;
  const ans = list[0];
  document.getElementById('revealTitle').textContent = 'It was '+ans.place_name;
  document.getElementById('revealPlace').textContent = ans.place_name;

  // clear old layers
  revealMap.eachLayer(l=>{ if(l instanceof L.Marker || l instanceof L.Polyline) revealMap.removeLayer(l); });
  const bounds=[];
  // truth marker
  L.marker([ans.answer_lat, ans.answer_lon], { icon:pin('#0d1b2a') }).addTo(revealMap).bindTooltip('Answer',{permanent:false});
  bounds.push([ans.answer_lat, ans.answer_lon]);
  const legend=document.getElementById('revealLegend'); legend.innerHTML='';
  list.forEach(r=>{
    if(r.guess_lat==null) return;
    const c=colorFor(r.player_name);
    L.marker([r.guess_lat, r.guess_lon], { icon:pin(c) }).addTo(revealMap).bindTooltip(r.player_name,{permanent:false});
    L.polyline([[r.guess_lat,r.guess_lon],[ans.answer_lat,ans.answer_lon]],{ color:c, weight:2, dashArray:'5 6' }).addTo(revealMap);
    bounds.push([r.guess_lat, r.guess_lon]);
    const item=document.createElement('div'); item.className='item';
    item.innerHTML=`<span class="dot" style="background:${c}"></span>${escapeHtml(r.player_name)} · ${r.dist_km==null?'—':Math.round(r.dist_km).toLocaleString()+' km'} · +${r.points}`;
    legend.appendChild(item);
  });
  if(bounds.length>1) revealMap.fitBounds(bounds, { padding:[40,40] });
  renderRevealScoreboard();

  document.getElementById('nextBtn').textContent = roundNum>=5 ? 'See final standings →' : 'Ready — next round →';
}

async function renderRevealScoreboard(){
  const { data } = await sb.from('room_players').select('name,score').eq('room_code',roomCode).order('score',{ascending:false});
  const board=document.getElementById('revealScoreboard'); board.innerHTML='';
  (data||[]).forEach((p,i)=>{
    const row=document.createElement('div'); row.className='sb-row';
    row.innerHTML=`<span class="rk">${i+1}</span><span class="nm"><span class="dot" style="width:11px;height:11px;border-radius:50%;background:${colorFor(p.name)}"></span>${escapeHtml(p.name)}</span><span class="delta"></span><span class="tot">${p.score.toLocaleString()}</span>`;
    board.appendChild(row);
  });
}

document.getElementById('nextBtn').addEventListener('click', async ()=>{
  document.getElementById('nextBtn').disabled=true;
  document.getElementById('revealHint').textContent='Advancing…';
  try { await rpc('next_round', { p_code:roomCode }); } catch(e){}
  setTimeout(()=>{ document.getElementById('nextBtn').disabled=false; document.getElementById('revealHint').textContent=''; }, 1500);
});

// ---------- FINAL ----------
async function doFinal(){
  stopTimer(); show('final');
  const { data } = await sb.from('room_players').select('name,score').eq('room_code',roomCode).order('score',{ascending:false});
  const list=data||[];
  if(list.length){
    document.getElementById('winnerName').innerHTML = `${escapeHtml(list[0].name)} <em style="color:var(--coral);font-style:italic;">wins</em>`;
  }
  const board=document.getElementById('finalScoreboard'); board.innerHTML='';
  list.forEach((p,i)=>{
    const row=document.createElement('div'); row.className='sb-row';
    const medal = i===0?'🥇':i===1?'🥈':i===2?'🥉':'';
    row.innerHTML=`<span class="rk">${medal||(i+1)}</span><span class="nm"><span class="dot" style="width:11px;height:11px;border-radius:50%;background:${colorFor(p.name)}"></span>${escapeHtml(p.name)}</span><span class="delta"></span><span class="tot">${p.score.toLocaleString()}</span>`;
    board.appendChild(row);
  });
}
document.getElementById('rematchBtn').addEventListener('click', async ()=>{
  // host creates a fresh room with same players is complex; simplest: go home
  leaveRoom();
});

// ---------- housekeeping ----------
async function heartbeat(){
  if(!roomCode) return;
  try { await sb.from('room_players').update({ last_seen:new Date().toISOString() }).eq('room_code',roomCode).eq('name',me); } catch(e){}
  setTimeout(heartbeat, 15000);
}
function leaveRoom(){
  if(channel) sb.removeChannel(channel);
  if(roomCode){ sb.from('room_players').delete().eq('room_code',roomCode).eq('name',me).then(()=>{}); }
  roomCode=''; isHost=false; roundNum=0; channel=null;
  show('home');
}
function escapeHtml(s){ return String(s).replace(/[&<>"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }

window.addEventListener('beforeunload', ()=>{
  if(roomCode){ navigator.sendBeacon && sb.from('room_players').delete().eq('room_code',roomCode).eq('name',me); }
});
