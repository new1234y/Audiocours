async function fetchJson(url){
  const res = await fetch(url);
  if(!res.ok) throw new Error(`${url} -> ${res.status}`);
  return res.json();
}

function isoWeekNumber(dt){
  // returns ISO week number for a Date
  const date = new Date(Date.UTC(dt.getFullYear(), dt.getMonth(), dt.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(),0,1));
  const weekNo = Math.ceil((((date - yearStart) / 86400000) + 1)/7);
  return weekNo;
}

function weekKeyFromDate(isoDateStr){
  // parse ISO date and decide semaine_A or semaine_B by week parity
  const d = new Date(isoDateStr);
  if (isNaN(d)) return null;
  const wk = isoWeekNumber(d);
  return (wk % 2 === 1) ? 'semaine_A' : 'semaine_B';
}

function renderTimetable(timetable, weekKey){
  const grid = document.getElementById('grid');
  const daysHeader = document.getElementById('daysHeader');
  grid.innerHTML = '';
  daysHeader.innerHTML = '';
  const days = ['lundi','mardi','mercredi','jeudi','vendredi'];
  days.forEach(d => { const h = document.createElement('h4'); h.textContent = d[0].toUpperCase()+d.slice(1); daysHeader.appendChild(h) });
  const week = timetable[weekKey] || {};
  days.forEach(day => {
    const cell = document.createElement('div'); cell.className='grid-cell';
    const lessons = week[day] || [];
    if(lessons.length===0){ const p = document.createElement('div'); p.className='small'; p.textContent='—'; cell.appendChild(p) }
    lessons.forEach(ls => {
      const slot = document.createElement('div'); slot.className='slot';
      slot.innerHTML = `<div class="time">${ls.debut} — ${ls.fin}</div><div class="small">${ls.cours}</div>`;
      slot.dataset.info = JSON.stringify(ls);
      cell.appendChild(slot);
    })
    grid.appendChild(cell);
  })
}

function renderRecordings(registry){
  const list = document.getElementById('recordingList');
  const loading = document.getElementById('loading');
  loading.style.display = 'none';
  list.innerHTML = '';
  // registry expected to be array of entries with created_at
  // build map of weekKey -> list of entries
  const weeksMap = new Map();
  registry.forEach(entry => {
    const wk = weekKeyFromDate(entry.created_at || entry.updated_at || entry.date || entry.created_at || '');
    if(!weeksMap.has(wk)) weeksMap.set(wk, []);
    weeksMap.get(wk).push(entry);
  })
  // store for navigation
  window._registry = registry;
  window._weeksMap = weeksMap;
  // render simple list
  registry.slice().reverse().forEach(entry => {
    const li = document.createElement('li');
    const title = document.createElement('div'); title.textContent = entry.audio_source || entry.id || '—';
    const meta = document.createElement('div'); meta.className='meta';
    meta.textContent = entry.created_at || '';
    li.appendChild(title); li.appendChild(meta);
    list.appendChild(li);
    li.addEventListener('click', ()=> selectEntry(entry));
  })
}

function selectEntry(entry){
  const wk = weekKeyFromDate(entry.created_at || entry.updated_at || entry.date || '');
  document.getElementById('weekLabel').textContent = wk || 'inconnue';
  // load timetable and render
  fetchJson('timetable.json').then(t=> renderTimetable(t, wk || 'semaine_A'))
    .catch(e=>{ document.getElementById('grid').textContent = 'Erreur chargement emploi du temps' })
  // show summary/transcription panel
  openPanelForEntry(entry);
}

function openPanelForEntry(entry){
  const panel = document.getElementById('panel');
  const content = document.getElementById('panelContent');
  panel.classList.remove('hidden');
  // build content
  content.innerHTML = '';
  const h = document.createElement('h3'); h.textContent = entry.audio_source || entry.id;
  const date = document.createElement('div'); date.className='meta'; date.textContent = entry.created_at || '';
  content.appendChild(h); content.appendChild(date);
  const summary = document.createElement('div'); summary.id='summary'; summary.innerHTML = `<h4>Résumé</h4><div>${(entry.resume_text||entry.transcription_text||'(vide)').slice(0,800)}</div>`;
  content.appendChild(summary);
  const more = document.createElement('div'); more.className='showMore'; more.textContent='Afficher plus';
  content.appendChild(more);
  const full = document.createElement('div'); full.id='fullText'; full.style.display='none';
  const searchBox = document.createElement('div'); searchBox.className='searchBox';
  const inp = document.createElement('input'); inp.placeholder='Rechercher dans la transcription...';
  const btn = document.createElement('button'); btn.textContent='Rechercher'; btn.style.background='#444';
  searchBox.appendChild(inp); searchBox.appendChild(btn);
  full.appendChild(searchBox);
  const pre = document.createElement('pre'); pre.style.whiteSpace='pre-wrap'; pre.textContent = entry.transcription_text || entry.resume_text || '';
  full.appendChild(pre);
  content.appendChild(full);

  more.addEventListener('click', ()=>{ full.style.display = full.style.display==='none' ? 'block' : 'none'; more.textContent = full.style.display==='none' ? 'Afficher plus' : 'Masquer'; })
  btn.addEventListener('click', ()=>{
    const q = inp.value.trim();
    if(!q) return; const re = new RegExp(q,'ig');
    const txt = pre.textContent; const matches = [...txt.matchAll(re)];
    if(matches.length===0){ alert('Aucune occurrence') } else {
      // highlight occurrences
      const highlighted = txt.replace(re, m=>`<<${m}>>`);
      pre.innerHTML = highlighted.replace(/<<(.+?)>>/g, '<mark>$1</mark>');
    }
  })
}

document.getElementById('closePanel').addEventListener('click', ()=>{ document.getElementById('panel').classList.add('hidden') })

// week navigation: allow moving back/forward through weeks until bounds determined by registry dates
function setupWeekNavigation(){
  const prev = document.getElementById('prevWeek');
  const next = document.getElementById('nextWeek');
  prev.addEventListener('click', ()=> changeWeek(-1));
  next.addEventListener('click', ()=> changeWeek(1));
}

function changeWeek(delta){
  const label = document.getElementById('weekLabel');
  // label currently 'semaine_A' or 'semaine_B' or ISO week number? we store as 'semaine_A'/'semaine_B'
  const cur = label.textContent || 'semaine_A';
  // to move week-by-week we need a reference ISO week number; we'll store currentIsoWeek on window
  if(!window.currentIsoWeek){
    // set to today iso week
    window.currentIsoWeek = (new Date()).toISOString().slice(0,10);
  }
  // compute new date by adding 7*delta days
  const base = new Date(window.currentIsoWeek);
  base.setDate(base.getDate() + 7*delta);
  window.currentIsoWeek = base.toISOString().slice(0,10);
  const wkKey = weekKeyFromDate(window.currentIsoWeek);
  document.getElementById('weekLabel').textContent = wkKey || 'semaine_A';
  fetchJson('timetable.json').then(t=> renderTimetable(t, wkKey||'semaine_A'))
}

async function main(){
  try{
    const registry = await fetchJson('registry.json');
    renderRecordings(registry);
    setupWeekNavigation();
    // default: show latest entry's week timetable
    if(registry.length>0){
      const latest = registry[registry.length-1];
      const wk = weekKeyFromDate(latest.created_at || latest.updated_at || latest.date || '');
      document.getElementById('weekLabel').textContent = wk || 'semaine_A';
      window.currentIsoWeek = (latest.created_at||new Date().toISOString()).slice(0,10);
      fetchJson('timetable.json').then(t=> renderTimetable(t, wk||'semaine_A'))
    }else{
      fetchJson('timetable.json').then(t=> renderTimetable(t,'semaine_A'))
    }
  }catch(e){
    document.getElementById('loading').textContent = 'Impossible de charger registry.json — vérifier URL ou hébergement';
    console.error(e);
  }
}

main();
