async function fetchJson(url){
  const res = await fetch(url);
  if(!res.ok) throw new Error(`${url} -> ${res.status}`);
  return res.json();
}

function getEl(id){
  const e = document.getElementById(id);
  if(!e) console.warn(`DOM element #${id} not found`);
  return e;
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
  const grid = getEl('grid');
  const daysHeader = getEl('daysHeader');
  if(grid) grid.innerHTML = '';
  if(daysHeader) daysHeader.innerHTML = '';
  const days = ['lundi','mardi','mercredi','jeudi','vendredi','samedi','dimanche'];
  // compute Monday date for the reference weekKey using currentIsoWeek if set
  let refDate = new Date();
  if(window.currentIsoWeek) refDate = new Date(window.currentIsoWeek);
  // find monday of that week
  const dayOfWeek = refDate.getDay();
  const monday = new Date(refDate);
  monday.setDate(refDate.getDate() - ((dayOfWeek + 6) % 7));

  // add headers with date
  days.forEach((d, idx) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + idx);
    const h = document.createElement('h4');
    h.textContent = `${d[0].toUpperCase()+d.slice(1)} ${date.getDate()} ${date.toLocaleString('fr-FR',{month:'long'})}`;
    if(daysHeader) daysHeader.appendChild(h);
  });

  const week = timetable[weekKey] || {};
  // collect all unique time slots across the week and sort
  const timeSet = new Set();
  days.forEach(day => (week[day]||[]).forEach(ls => timeSet.add(ls.debut + '|' + ls.fin)));
  const times = Array.from(timeSet).sort((a,b)=>{ const [a1,a2]=a.split('|'); const [b1,b2]=b.split('|'); return a1.localeCompare(b1) || a2.localeCompare(b2) });

  // create grid columns for each day, rows for times
  if(grid) grid.style.gridTemplateRows = `repeat(${times.length || 1}, auto)`;
  // build cells per day but arranged by time
  // add a vacation row at top if any vacation info in timetable (optional)
  if(timetable.vacances){
    const vacRow = document.createElement('div'); vacRow.className='vacation'; vacRow.textContent = timetable.vacances;
    if(grid) grid.appendChild(vacRow);
  }

  for(const day of days){
    const dayLessons = week[day] || [];
    const mapByTime = new Map(dayLessons.map(ls=>[ls.debut+'|'+ls.fin, ls]));
  for(const t of (times.length?times:[''])){
      const cell = document.createElement('div'); cell.className='grid-cell';
      if(t === ''){ cell.innerHTML = '<div class="small">—</div>'; }
      else if(mapByTime.has(t)){
        const ls = mapByTime.get(t);
        const slot = document.createElement('div'); slot.className='slot';
        slot.innerHTML = `<div class="time">${ls.debut}</div><div class="title">${ls.cours} — ${ls.prof} — ${ls.salle}</div>`;
        slot.dataset.info = JSON.stringify(ls);
        slot.addEventListener('click', ()=> openSlotFromTimetable(ls));
        cell.appendChild(slot);
      } else {
        cell.innerHTML = '<div class="small">&nbsp;</div>';
      }
      if(grid) grid.appendChild(cell);
    }
  }

  // For each day, append an 'Autres' cell listing recordings that don't match any slot
  const registry = window._registry || [];
  for(const day of days){
    const otherCell = document.createElement('div'); otherCell.className='grid-cell';
    const dayDate = new Date(monday); dayDate.setDate(monday.getDate() + days.indexOf(day));
    const others = registry.filter(e=>{
      const eDate = new Date(e.created_at||e.updated_at||e.date||0);
      return eDate.getFullYear() && eDate.getDate()===dayDate.getDate() && eDate.getMonth()===dayDate.getMonth() && !( (week[day]||[]).some(ls => (e.transcription_text||e.resume_text||'').includes(ls.cours)) );
    });
    if(others.length>0){
      others.forEach(o=>{ const d = document.createElement('div'); d.className='small'; d.textContent = o.audio_source || o.id; d.addEventListener('click', ()=> openPanelForEntry(o)); otherCell.appendChild(d) })
    } else { otherCell.innerHTML = '<div class="small">&nbsp;</div>' }
    if(grid) grid.appendChild(otherCell);
  }
}

function openSlotFromTimetable(ls){
  // find matching entries in registry by course name or date
  const registry = window._registry || [];
  const match = registry.find(e => (e.resume_text||e.transcription_text||'').includes(ls.cours) || (e.audio_source||'').includes(ls.cours));
  if(match) openPanelForEntry(match);
  else {
    // open panel with basic info
    openPanelForEntry({audio_source: ls.cours, created_at: new Date().toISOString(), transcription_text: '', resume_text: ''});
  }
}

function renderRecordings(registry){
  const list = getEl('recordingList');
  const othersList = getEl('othersList');
  const loading = getEl('loading');
  if(loading) loading.style.display = 'none';
  if(list) list.innerHTML = '';
  if(othersList) othersList.innerHTML = '';
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
  // display recordings: if their text contains a course name from timetable, show in list, otherwise in others
  const timetable = window._timetable || {};
  const allCourseNames = new Set();
  Object.values(timetable).forEach(week => Object.values(week).forEach(day => day.forEach(ls => allCourseNames.add(ls.cours))));

  registry.slice().reverse().forEach(entry => {
    const text = (entry.resume_text||entry.transcription_text||'').toLowerCase();
    const matched = [...allCourseNames].some(c => text.includes(c.toLowerCase()));
    const li = document.createElement('li');
    const title = document.createElement('div'); title.textContent = entry.audio_source || entry.id || '—';
    const meta = document.createElement('div'); meta.className='meta';
    meta.textContent = entry.created_at || '';
    li.appendChild(title); li.appendChild(meta);
    li.addEventListener('click', ()=> selectEntry(entry));
    if(matched){ if(list) list.appendChild(li) } else { if(othersList) othersList.appendChild(li) }
  })
}

function selectEntry(entry){
  const wk = weekKeyFromDate(entry.created_at || entry.updated_at || entry.date || '');
  const weekLabel = getEl('weekLabel'); if(weekLabel) weekLabel.textContent = wk || 'inconnue';
  // load timetable and render
  fetchJson('timetable.json').then(t=> renderTimetable(t, wk || 'semaine_A'))
    .catch(e=>{ document.getElementById('grid').textContent = 'Erreur chargement emploi du temps' })
  // show summary/transcription panel
  openPanelForEntry(entry);
}

function openPanelForEntry(entry){
  const modal = getEl('modal');
  const content = getEl('modalBody');
  if(modal) modal.classList.remove('hidden');
  // build content
  if(!content) return;
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
  // add copy/export and audio controls
  const controls = document.createElement('div'); controls.className='controls-row';
  const copyBtn = document.createElement('button'); copyBtn.className='btn-small copyBtn'; copyBtn.textContent='Copier résumé';
  const exportBtn = document.createElement('button'); exportBtn.className='btn-small exportBtn'; exportBtn.textContent='Exporter transcription';
  const playBtn = document.createElement('button'); playBtn.className='btn-small'; playBtn.textContent='▶ Écouter résumé';
  controls.appendChild(playBtn); controls.appendChild(copyBtn); controls.appendChild(exportBtn);
  content.appendChild(controls);

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
  // copy/export/play handlers
  copyBtn.addEventListener('click', ()=>{ const txt = (entry.resume_text||entry.transcription_text||''); navigator.clipboard.writeText(txt); alert('Copié dans le presse-papier'); })
  exportBtn.addEventListener('click', ()=>{
    const blob = new Blob([entry.transcription_text||entry.resume_text||''], {type:'text/plain;charset=utf-8'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `${(entry.audio_source||entry.id||'transcription')}.txt`; a.click(); URL.revokeObjectURL(url);
  })
  playBtn.addEventListener('click', ()=>{
    const text = entry.resume_text || entry.transcription_text || '';
    if(!text) return alert('Aucun texte à lire');
    if('speechSynthesis' in window){
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'fr-FR';
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(u);
    } else alert('Synthèse vocale non supportée');
  })
}

const closeBtn = getEl('closeModal'); if(closeBtn) closeBtn.addEventListener('click', ()=>{ const p = getEl('modal'); if(p) p.classList.add('hidden') })

// week navigation: allow moving back/forward through weeks until bounds determined by registry dates
function setupWeekNavigation(){
  const prev = getEl('prevWeek');
  const next = getEl('nextWeek');
  if(prev) prev.addEventListener('click', ()=> changeWeek(-1));
  if(next) next.addEventListener('click', ()=> changeWeek(1));
}

function changeWeek(delta){
  const label = getEl('weekLabel');
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
  const wl = getEl('weekLabel'); if(wl) wl.textContent = wkKey || 'semaine_A';
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
      const wl = getEl('weekLabel'); if(wl) wl.textContent = wk || 'semaine_A';
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
