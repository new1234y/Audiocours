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
  const wrap = document.getElementById('tableWrap');
  wrap.innerHTML = '';
  const week = timetable[weekKey];
  if(!week){ wrap.textContent = 'Pas d\'emploi du temps pour ' + weekKey; return }
  for(const day of ['lundi','mardi','mercredi','jeudi','vendredi']){
    const dayDiv = document.createElement('div');
    dayDiv.className = 'timetable-day';
    const h = document.createElement('h3'); h.textContent = day[0].toUpperCase() + day.slice(1);
    dayDiv.appendChild(h);
    const lessons = week[day] || [];
    if(lessons.length===0){ const p = document.createElement('div'); p.className='small'; p.textContent='Aucun cours'; dayDiv.appendChild(p) }
    lessons.forEach(ls => {
      const el = document.createElement('div'); el.className='lesson';
      el.innerHTML = `<div class="time">${ls.debut} — ${ls.fin}</div><div class="small">${ls.cours} — ${ls.prof} — ${ls.salle}</div>`;
      dayDiv.appendChild(el);
    })
    wrap.appendChild(dayDiv);
  }
}

function renderRecordings(registry){
  const list = document.getElementById('recordingList');
  const loading = document.getElementById('loading');
  loading.style.display = 'none';
  list.innerHTML = '';
  // registry expected to be array of entries with created_at
  registry.slice().reverse().forEach(entry => {
    const li = document.createElement('li');
    const title = document.createElement('div'); title.textContent = entry.audio_source || entry.id || '—';
    const meta = document.createElement('div'); meta.className='meta';
    meta.textContent = entry.created_at || '';
    li.appendChild(title); li.appendChild(meta);
    list.appendChild(li);
    li.addEventListener('click', ()=>{
      const wk = weekKeyFromDate(entry.created_at || entry.updated_at || entry.date || '');
      document.getElementById('weekInfo').textContent = `Enregistrement: ${entry.audio_source || entry.id} — semaine calculée: ${wk || 'inconnue'}`;
      fetchJson('timetable.json').then(t=> renderTimetable(t, wk)).catch(e=>{document.getElementById('tableWrap').textContent = 'Erreur chargement emploi du temps'})
    })
  })
}

async function main(){
  try{
    const registry = await fetchJson('registry.json');
    renderRecordings(registry);
  }catch(e){
    document.getElementById('loading').textContent = 'Impossible de charger registry.json — vérifier URL ou hébergement';
    console.error(e);
  }
}

main();
