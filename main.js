// Shared app logic: teams, logos, matches stored in localStorage
const STORAGE_TEAMS = 'cta_teams';
const STORAGE_MATCHES = 'cta_matches';
const STORAGE_PLAYOFFS = 'cta_playoffs';
const OVERS = 20;

let teams = [];
let matches = [];
let playoffs = null; // { matches: [...] }

function loadState(){
  teams = JSON.parse(localStorage.getItem(STORAGE_TEAMS) || '[]');
  matches = JSON.parse(localStorage.getItem(STORAGE_MATCHES) || '[]');
  try{ playoffs = JSON.parse(localStorage.getItem(STORAGE_PLAYOFFS) || 'null'); }catch(e){ playoffs = null }
}

function saveState(){
  localStorage.setItem(STORAGE_TEAMS, JSON.stringify(teams));
  localStorage.setItem(STORAGE_MATCHES, JSON.stringify(matches));
  localStorage.setItem(STORAGE_PLAYOFFS, JSON.stringify(playoffs));
}

function init(){
  loadState();
  setupThemeToggle();
  updateCounts();
  if(document.getElementById('teamForm')) bindHome();
  if(document.getElementById('generateBtn')) bindScheduling();
  if(document.getElementById('pointsBody')) renderPoints();
  if(document.getElementById('generatePlayoffsBtn')) bindGeneratePlayoffs();
  if(document.getElementById('playoffsTbody')) renderPlayoffs();
  renderHeaderCounts();
}

function bindGeneratePlayoffs(){
  const btn = document.getElementById('generatePlayoffsBtn');
  if(!btn) return;
  btn.addEventListener('click', ()=>{
    generatePlayoffs();
    // navigate to playoffs page
    window.location.href = 'playoffs.html';
  });
}

function generatePlayoffs(){
  const table = computePoints();
  const rows = Object.values(table).sort((a,b)=> b.pts - a.pts || b.nrr - a.nrr);
  if(rows.length < 4) return alert('Need at least 4 teams to generate playoffs');
  const top4 = rows.slice(0,4).map(r=>r.team);
  playoffs = { matches: [
    {a:top4[0], b:top4[3], venue:'', time:'', aScore:null, bScore:null, done:false, stage:'Semi 1'},
    {a:top4[1], b:top4[2], venue:'', time:'', aScore:null, bScore:null, done:false, stage:'Semi 2'},
    {a:null, b:null, venue:'', time:'', aScore:null, bScore:null, done:false, stage:'Final'}
  ]};
  saveState();
  alert('Playoffs generated (Top 4). Open Playoffs page to enter results.');
}

function renderPlayoffs(){
  const tbody = document.getElementById('playoffsTbody');
  if(!tbody) return;
  tbody.innerHTML = '';
  if(!playoffs || !Array.isArray(playoffs.matches)) return;
  // show champion if decided
  const champEl = document.getElementById('championBadge');
  if(champEl){
    if(playoffs.champion){
      champEl.innerHTML = `<div class="badge-3d" style="display:inline-flex;gap:12px;align-items:center;padding:10px 14px;background:linear-gradient(90deg,var(--accent),var(--accent-2));color:white;border-radius:12px"><span style="width:40px;height:40px;border-radius:8px;overflow:hidden;display:inline-block">${renderLogoForRow(playoffs.champion)}</span><strong>Champion: ${playoffs.champion}</strong></div>`;
    } else { champEl.innerHTML = ''; }
  }
  playoffs.matches.forEach((m,i)=>{
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td style="width:110px">${m.stage}</td>
      <td style="text-align:left;display:flex;gap:10px;align-items:center">
        <span style="width:36px;height:36px;border-radius:6px;overflow:hidden;background:#111;display:inline-block">${renderLogoForRow(m.a)}</span>
        <strong>${m.a||'TBD'}</strong>
        <span style="opacity:0.6">vs</span>
        <span style="width:36px;height:36px;border-radius:6px;overflow:hidden;background:#111;display:inline-block">${renderLogoForRow(m.b)}</span>
        <strong>${m.b||'TBD'}</strong>
      </td>
      <td><input type="text" id="pvenue${i}" value="${m.venue||''}" placeholder="Venue"></td>
      <td><input type="time" id="ptime${i}" value="${m.time||''}"></td>
      <td><input type="number" id="pa${i}" value="${m.aScore!=null?m.aScore:''}" placeholder="A runs"></td>
      <td><input type="number" id="pb${i}" value="${m.bScore!=null?m.bScore:''}" placeholder="B runs"></td>
      <td><button onclick="savePlayoff(${i})">Save</button></td>
    `;
    tbody.appendChild(tr);
  });
}

function savePlayoff(i){
  if(!playoffs || !playoffs.matches) return;
  const m = playoffs.matches[i];
  const aVal = document.getElementById('pa'+i).value;
  const bVal = document.getElementById('pb'+i).value;
  const venue = document.getElementById('pvenue'+i).value;
  const time = document.getElementById('ptime'+i).value;
  if(aVal === '' || bVal === ''){
    m.venue = venue; m.time = time; saveState(); renderPlayoffs(); return;
  }
  const aNum = +aVal; const bNum = +bVal;
  if(isNaN(aNum) || isNaN(bNum)) return alert('Enter valid numeric scores');
  m.venue = venue; m.time = time; m.aScore = aNum; m.bScore = bNum; m.done = true;
  saveState();
  // if both semis done, set final participants
  if(playoffs.matches[0].done && playoffs.matches[1].done){
    const s1 = playoffs.matches[0]; const s2 = playoffs.matches[1];
    const w1 = s1.aScore > s1.bScore ? s1.a : s1.b;
    const w2 = s2.aScore > s2.bScore ? s2.a : s2.b;
    playoffs.matches[2].a = w1; playoffs.matches[2].b = w2;
    saveState();
  }
  // if final was just saved, compute champion
  if(m.stage === 'Final'){
    if(m.aScore != null && m.bScore != null){
      const champ = m.aScore > m.bScore ? m.a : m.b;
      playoffs.champion = champ;
      saveState();
      alert(`Champion: ${champ}`);
    }
  }
  renderPlayoffs();
}

function setupThemeToggle(){
  const t = document.getElementById('themeToggle');
  if(!t) return;
  t.addEventListener('change', function(){
    document.body.setAttribute('data-theme', this.checked ? 'light' : 'dark');
  });
}

function bindHome(){
  renderHomeTeams();
  const form = document.getElementById('teamForm');
  const logoInput = document.getElementById('teamLogo');
  const logoDrop = document.getElementById('logoDrop');
  const logoPreview = document.getElementById('logoPreview');
  const logoPlaceholder = document.getElementById('logoPlaceholder');
  const addBtn = document.getElementById('addTeamBtn');

  // file selection and preview
  const showPreview = (file)=>{
    if(!file) { logoPreview.style.display='none'; logoPlaceholder.style.display='flex'; return; }
    const reader = new FileReader();
    reader.onload = ()=>{ logoPreview.src = reader.result; logoPreview.style.display='block'; logoPlaceholder.style.display='none'; };
    reader.readAsDataURL(file);
  };

  logoInput.addEventListener('change', ()=> showPreview(logoInput.files[0]));

  // drag & drop
  ['dragenter','dragover'].forEach(ev=>logoDrop.addEventListener(ev, e=>{ e.preventDefault(); e.stopPropagation(); logoDrop.classList.add('dragover'); }));
  ['dragleave','drop'].forEach(ev=>logoDrop.addEventListener(ev, e=>{ e.preventDefault(); e.stopPropagation(); logoDrop.classList.remove('dragover'); }));
  logoDrop.addEventListener('drop', e=>{
    const f = e.dataTransfer.files && e.dataTransfer.files[0];
    if(f && f.type.startsWith('image/')){ logoInput.files = e.dataTransfer.files; showPreview(f); }
  });
  logoDrop.addEventListener('click', ()=> logoInput.click());

  // add team
  const submitTeam = ()=>{
    const name = document.getElementById('teamName').value.trim();
    const file = logoInput.files[0];
    if(!name) return alert('Enter team name');
    if(teams.find(t=>t.name.toLowerCase()===name.toLowerCase())) return alert('Team exists');
    if(file){
      const reader = new FileReader();
      reader.onload = () => { addTeam(name, reader.result); logoInput.value=''; showPreview(null); document.getElementById('teamName').value=''; };
      reader.readAsDataURL(file);
    } else {
      addTeam(name, null);
      document.getElementById('teamName').value='';
    }
  };

  form.addEventListener('submit', function(e){ e.preventDefault(); submitTeam(); });
  addBtn.addEventListener('click', submitTeam);
}

function addTeam(name, logo){
  teams.push({name, logo});
  saveState();
  renderHomeTeams();
  updateCounts();
}

function removeTeam(idx){
  const t = teams[idx];
  if(!confirm(`Remove team ${t.name}?`)) return;
  teams.splice(idx,1);
  // Remove matches involving team
  matches = matches.filter(m => m.a !== t.name && m.b !== t.name);
  saveState();
  renderHomeTeams();
  renderMatches();
  updateCounts();
}

function renderHomeTeams(){
  const list = document.getElementById('teamsList');
  if(!list) return;
  list.innerHTML='';
  teams.forEach((t,i)=>{
    const div = document.createElement('div');
    div.className='card';
    div.style.alignItems='center';
    div.innerHTML = `
      <div style="display:flex;gap:12px;align-items:center;width:100%">
        <div style="width:48px;height:48px;border-radius:8px;overflow:hidden;background:#111;display:flex;align-items:center;justify-content:center">${t.logo?`<img src="${t.logo}" style="width:100%;height:100%;object-fit:cover">`:'🏏'}</div>
        <div style="flex:1">
          <strong>${t.name}</strong>
        </div>
        <div style="width:90px;text-align:right"><button onclick="removeTeam(${i})">Remove</button></div>
      </div>`;
    list.appendChild(div);
  });
}

function updateCounts(){
  if(document.getElementById('teamsCount')) document.getElementById('teamsCount').innerText = teams.length;
  if(document.getElementById('matchesCount')) document.getElementById('matchesCount').innerText = matches.length;
  if(document.getElementById('completedCount')) document.getElementById('completedCount').innerText = matches.filter(m=>m.done).length;
  if(document.getElementById('upcomingCount')) document.getElementById('upcomingCount').innerText = matches.filter(m=>!m.done).length;
}

function renderHeaderCounts(){ updateCounts(); }

// SCHEDULING
function bindScheduling(){
  document.getElementById('generateBtn').addEventListener('click', function(){
    if(teams.length<2) return alert('Add at least 2 teams');
    if(!confirm('Generate round-robin schedule? This will overwrite existing schedule.')) return;
    generateRoundRobin();
    renderMatches();
    updateCounts();
  });
  renderMatches();
}

function generateRoundRobin(){
  matches = [];
  for(let i=0;i<teams.length;i++){
    for(let j=i+1;j<teams.length;j++){
      matches.push({a:teams[i].name, b:teams[j].name, venue:'', time:'', aScore:null, bScore:null, done:false});
    }
  }
  saveState();
}

function renderMatches(){
  // If scheduling table exists, render as table rows
  const tbody = document.getElementById('matchesTbody');
  if(tbody){
    tbody.innerHTML = '';
    matches.forEach((m,i)=>{
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td style="width:36px">${i+1}</td>
        <td style="text-align:left;display:flex;gap:10px;align-items:center">
          <span style="width:40px;height:40px;border-radius:8px;overflow:hidden;background:#111;display:inline-block">${renderLogoForRow(m.a)}</span>
          <strong>${m.a}</strong>
          <span style="opacity:0.6">vs</span>
          <span style="width:40px;height:40px;border-radius:8px;overflow:hidden;background:#111;display:inline-block">${renderLogoForRow(m.b)}</span>
          <strong>${m.b}</strong>
        </td>
        <td><input type="text" placeholder="Venue" id="venue${i}" value="${m.venue || ''}"></td>
        <td><input type="time" id="time${i}" value="${m.time || ''}"></td>
        <td><input type="number" placeholder="${m.a} runs" id="a${i}" value="${m.aScore!=null?m.aScore:''}"></td>
        <td><input type="number" placeholder="${m.b} runs" id="b${i}" value="${m.bScore!=null?m.bScore:''}"></td>
        <td><button onclick="saveMatch(${i})">Save</button></td>
      `;
      tbody.appendChild(tr);
    });
    return;
  }

  // fallback: render old match-row blocks if table not present
  const container = document.getElementById('matches');
  if(!container) return;
  container.innerHTML='';
  matches.forEach((m,i)=>{
    const div = document.createElement('div');
    div.className='match-row';
    div.innerHTML = `
      <div style="flex:1">${m.a} <strong>vs</strong> ${m.b}</div>
      <input type="text" placeholder="Venue" id="venue${i}" value="${m.venue || ''}">
      <input type="time" id="time${i}" value="${m.time || ''}">
      <input type="number" placeholder="${m.a} runs" id="a${i}" value="${m.aScore!=null?m.aScore:''}">
      <input type="number" placeholder="${m.b} runs" id="b${i}" value="${m.bScore!=null?m.bScore:''}">
      <button onclick="saveMatch(${i})">Save</button>
    `;
    container.appendChild(div);
  });
}

function saveMatch(i){
  const venue = document.getElementById('venue'+i).value;
  const time = document.getElementById('time'+i).value;
  const a = document.getElementById('a'+i).value;
  const b = document.getElementById('b'+i).value;
  if(a === '' || b === ''){
    // allow saving just venue/time
    matches[i].venue = venue; matches[i].time = time; saveState(); renderMatches(); updateCounts(); return;
  }
  const aNum = +a; const bNum = +b;
  if(isNaN(aNum) || isNaN(bNum)) return alert('Enter valid numeric scores');
  matches[i].venue = venue; matches[i].time = time; matches[i].aScore = aNum; matches[i].bScore = bNum; matches[i].done = true;
  saveState(); renderMatches(); updateCounts();
  if(document.getElementById('pointsBody')) renderPoints();
}

// POINTS
function computePoints(){
  const table = {};
  teams.forEach(t => table[t.name] = {team:t.name,p:0,w:0,l:0,tie:0,rf:0,ra:0,nrr:0,pts:0});
  matches.forEach(m =>{
    if(m.aScore==null || m.bScore==null) return;
    const A = table[m.a]; const B = table[m.b];
    A.p++; B.p++; A.rf += m.aScore; A.ra += m.bScore; B.rf += m.bScore; B.ra += m.aScore;
    if(m.aScore>m.bScore){ A.w++; A.pts+=2; B.l++; }
    else if(m.bScore>m.aScore){ B.w++; B.pts+=2; A.l++; }
    else { A.tie++; B.tie++; A.pts+=1; B.pts+=1; }
  });
  Object.values(table).forEach(r=>{
    if(r.p>0) r.nrr = ((r.rf/(r.p*OVERS)) - (r.ra/(r.p*OVERS))).toFixed(3);
    else r.nrr = (0).toFixed(3);
  });
  return table;
}

function renderPoints(){
  const tbody = document.getElementById('pointsBody');
  if(!tbody) return;
  const table = computePoints();
  const rows = Object.values(table).sort((a,b)=> b.pts - a.pts || b.nrr - a.nrr);
  tbody.innerHTML = '';
  rows.forEach(r=>{
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td style="display:flex;gap:8px;align-items:center"><span style="width:28px;height:28px;border-radius:6px;overflow:hidden;background:#111;display:inline-block">${renderLogoForRow(r.team)}</span><span>${r.team}</span></td>
      <td>${r.p}</td>
      <td>${r.w}</td>
      <td>${r.l}</td>
      <td>${r.tie}</td>
      <td>${r.nrr}</td>
      <td>${r.pts}</td>
    `;
    tbody.appendChild(tr);
  });
}

function renderLogoForRow(teamName){
  const t = teams.find(x=>x.name===teamName);
  return t && t.logo ? `<img src="${t.logo}" style="width:100%;height:100%;object-fit:cover">` : '🏏';
}

// utility to clear all data (for dev)
function resetAll(){
  if(!confirm('Clear all teams and matches?')) return;
  teams = []; matches = []; saveState(); renderHomeTeams(); renderMatches(); renderPoints(); updateCounts();
}

document.addEventListener('DOMContentLoaded', init);
