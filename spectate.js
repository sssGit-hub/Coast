// ============ CoastlineGuessr Spectator ============
const sb = window.CLG_SB;
const { PLAYER_COLORS, pin, streetLayer } = window.CLG;

let code = "", channel = null, specMap = null, lastRound = 0, colorByName = {};
function colorFor(n){ if(!colorByName[n]){ colorByName[n]=PLAYER_COLORS[Object.keys(colorByName).length%PLAYER_COLORS.length]; } return colorByName[n]; }
function escapeHtml(s){ return String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }

const urlRoom = new URLSearchParams(location.search).get('room');
if(urlRoom){ start(urlRoom.toUpperCase()); }
else { document.getElementById('spec-join').style.display='block'; }

document.getElementById('specWatch').addEventListener('click', ()=>{
  const c=(document.getElementById('specCode').value||'').trim().toUpperCase();
  if(c.length!==4){ document.getElementById('specErr').textContent='Enter the 4-letter code.'; return; }
  history.replaceState(null,'','?room='+c);
  start(c);
});

async function start(c){
  code=c;
  const { data:room } = await sb.from('rooms').select('*').eq('code',c).single();
  if(!room){ document.getElementById('spec-join').style.display='block'; document.getElementById('specErr').textContent='No such room.'; return; }
  document.getElementById('spec-join').style.display='none';
  document.getElementById('spec-main').style.display='block';
  if(!specMap){ specMap=L.map('specmap',{ worldCopyJump:true, minZoom:1 }).setView([20,0],2); streetLayer(specMap); }
  setTimeout(()=>specMap.invalidateSize(),80);
  subscribe();
  renderRoom(room);
  refreshBoard();
}

function subscribe(){
  if(channel) sb.removeChannel(channel);
  channel = sb.channel('spec:'+code)
    .on('postgres_changes',{event:'*',schema:'public',table:'rooms',filter:'code=eq.'+code}, p=>renderRoom(p.new))
    .on('postgres_changes',{event:'*',schema:'public',table:'room_players',filter:'room_code=eq.'+code}, ()=>refreshBoard())
    .on('postgres_changes',{event:'*',schema:'public',table:'room_guesses',filter:'room_code=eq.'+code}, ()=>{ refreshStatus(); })
    .subscribe();
}

async function renderRoom(room){
  if(!room) return;
  document.getElementById('specPill').textContent = room.status.toUpperCase();
  if(room.status==='lobby'){
    document.getElementById('specTitle').textContent='Waiting in the lobby…';
    document.getElementById('specBadge').textContent='lobby';
  } else if(room.status==='playing'){
    document.getElementById('specTitle').textContent=`Round ${room.round_num} / 5 — in progress`;
    document.getElementById('specBadge').textContent='live · guessing';
    refreshStatus();
  } else if(room.status==='reveal'){
    document.getElementById('specTitle').textContent=`Round ${room.round_num} — reveal`;
    showReveal(room.round_num);
  } else if(room.status==='finished'){
    document.getElementById('specTitle').textContent='Game over';
    document.getElementById('specBadge').textContent='finished';
  }
}

async function refreshStatus(){
  const { data:room } = await sb.from('rooms').select('round_num,status').eq('code',code).single();
  if(!room || room.status!=='playing') return;
  const { data:g } = await sb.from('room_guesses').select('player_name').eq('room_code',code).eq('round_num',room.round_num);
  const { data:p } = await sb.from('room_players').select('name').eq('room_code',code);
  document.getElementById('specStatus').textContent = `${g?g.length:0}/${p?p.length:0} have guessed`;
}

async function showReveal(rn){
  if(rn===lastRound) return; lastRound=rn;
  let rows=[];
  try { rows = await sb.rpc('reveal_round',{ p_code:code, p_round:rn }).then(r=>r.data||[]); } catch(e){}
  specMap.eachLayer(l=>{ if(l instanceof L.Marker||l instanceof L.Polyline) specMap.removeLayer(l); });
  const bounds=[];
  if(rows.length){
    const ans=rows[0];
    L.marker([ans.answer_lat,ans.answer_lon],{icon:pin('#0d1b2a')}).addTo(specMap).bindTooltip('Answer: '+ans.place_name);
    bounds.push([ans.answer_lat,ans.answer_lon]);
    document.getElementById('specTitle').textContent='It was '+ans.place_name;
    rows.forEach(r=>{
      if(r.guess_lat==null) return;
      const c=colorFor(r.player_name);
      L.marker([r.guess_lat,r.guess_lon],{icon:pin(c)}).addTo(specMap).bindTooltip(r.player_name+' · +'+r.points);
      L.polyline([[r.guess_lat,r.guess_lon],[ans.answer_lat,ans.answer_lon]],{color:c,weight:2,dashArray:'5 6'}).addTo(specMap);
      bounds.push([r.guess_lat,r.guess_lon]);
    });
  }
  if(bounds.length) specMap.fitBounds(bounds,{padding:[40,40]});
  document.getElementById('specBadge').textContent='reveal';
  refreshBoard();
}

async function refreshBoard(){
  const { data } = await sb.from('room_players').select('name,score').eq('room_code',code).order('score',{ascending:false});
  const board=document.getElementById('specBoard'); board.innerHTML='';
  (data||[]).forEach((p,i)=>{
    const row=document.createElement('div'); row.className='sb-row';
    row.innerHTML=`<span class="rk">${i+1}</span><span class="nm"><span class="dot" style="background:${colorFor(p.name)}"></span>${escapeHtml(p.name)}</span><span class="tot">${p.score.toLocaleString()}</span>`;
    board.appendChild(row);
  });
}
