async function fetchJson(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${url} -> ${res.status}`)
  return res.json()
}

function getEl(id) {
  const e = document.getElementById(id)
  if (!e) console.warn(`DOM element #${id} not found`)
  return e
}

function isoWeekNumber(dt) {
  const date = new Date(Date.UTC(dt.getFullYear(), dt.getMonth(), dt.getDate()))
  const dayNum = date.getUTCDay() || 7
  date.setUTCDate(date.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1))
  const weekNo = Math.ceil(((date - yearStart) / 86400000 + 1) / 7)
  return weekNo
}

function weekKeyFromDate(isoDateStr) {
  const d = new Date(isoDateStr)
  if (isNaN(d)) return null
  const wk = isoWeekNumber(d)
  return wk % 2 === 1 ? "semaine_A" : "semaine_B"
}

function timeToMinutes(timeStr) {
  const [h, m] = timeStr.split(":").map(Number)
  return h * 60 + m
}

// Ces créneaux sont les heures de début uniques triées
const FIXED_TIME_SLOTS = [
  { start: "08:10", end: "09:10", label: "8h10-9h10" },
  { start: "09:10", end: "10:10", label: "9h10-10h10" },
  { start: "10:20", end: "11:20", label: "10h20-11h20" },
  { start: "11:20", end: "12:20", label: "11h20-12h20" },
  { start: "12:30", end: "13:30", label: "12h30-13h30" },
  { start: "13:30", end: "14:30", label: "13h30-14h30" },
  { start: "14:30", end: "15:30", label: "14h30-15h30" },
  { start: "15:40", end: "16:40", label: "15h40-16h40" },
  { start: "16:40", end: "17:40", label: "16h40-17h40" },
]

function findSlotIndex(debut) {
  const debutMinutes = timeToMinutes(debut)
  for (let i = 0; i < FIXED_TIME_SLOTS.length; i++) {
    const slotStartMinutes = timeToMinutes(FIXED_TIME_SLOTS[i].start)
    // Tolérance de 15 minutes pour matcher les cours
    if (Math.abs(debutMinutes - slotStartMinutes) <= 15) {
      return i
    }
  }
  return -1
}

function findSlotIndexByTime(timeStr) {
  const minutes = timeToMinutes(timeStr)
  for (let i = FIXED_TIME_SLOTS.length - 1; i >= 0; i--) {
    const slotStart = timeToMinutes(FIXED_TIME_SLOTS[i].start)
    const slotEnd = timeToMinutes(FIXED_TIME_SLOTS[i].end)
    if (minutes >= slotStart && minutes < slotEnd) {
      return i
    }
  }
  // Si avant le premier créneau
  if (minutes < timeToMinutes(FIXED_TIME_SLOTS[0].start)) {
    return 0
  }
  // Si après le dernier créneau
  return FIXED_TIME_SLOTS.length - 1
}

function getTimeFromIsoDate(isoDateStr) {
  const d = new Date(isoDateStr)
  if (isNaN(d)) return null
  const h = d.getHours().toString().padStart(2, "0")
  const m = d.getMinutes().toString().padStart(2, "0")
  return `${h}:${m}`
}

function getSlotSpan(lesson) {
  const startIdx = findSlotIndex(lesson.debut)
  if (startIdx === -1) return 1

  const endMinutes = timeToMinutes(lesson.fin)
  let span = 1

  for (let i = startIdx + 1; i < FIXED_TIME_SLOTS.length; i++) {
    const nextSlotStart = timeToMinutes(FIXED_TIME_SLOTS[i].start)
    if (endMinutes > nextSlotStart + 10) {
      span++
    } else {
      break
    }
  }

  return span
}

function renderTimetable(timetable, weekKey) {
  const gridWrap = getEl("gridWrap")
  if (!gridWrap) return

  gridWrap.innerHTML = ""

  const days = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"]
  const dayNames = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"]

  let refDate = new Date()
  if (window.currentIsoWeek) refDate = new Date(window.currentIsoWeek)
  const dayOfWeek = refDate.getDay()
  const monday = new Date(refDate)
  monday.setDate(refDate.getDate() - ((dayOfWeek + 6) % 7))

  const week = timetable[weekKey] || {}

  const wrapper = document.createElement("div")
  wrapper.className = "grid-wrapper"

  const timesCol = document.createElement("div")
  timesCol.className = "times-column"

  const timeHeader = document.createElement("div")
  timeHeader.className = "time-header"
  timeHeader.textContent = "Heure"
  timesCol.appendChild(timeHeader)

  const timeSlotsContainer = document.createElement("div")
  timeSlotsContainer.className = "slots-container"

  FIXED_TIME_SLOTS.forEach((slot) => {
    const timeLabel = document.createElement("div")
    timeLabel.className = "time-slot-label"
    timeLabel.textContent = slot.label
    timeSlotsContainer.appendChild(timeLabel)
  })

  timesCol.appendChild(timeSlotsContainer)

  const othersTimeLabel = document.createElement("div")
  othersTimeLabel.className = "time-slot-label others-time-label"
  othersTimeLabel.textContent = "Autres"
  timesCol.appendChild(othersTimeLabel)

  wrapper.appendChild(timesCol)

  days.forEach((day, dayIdx) => {
    const date = new Date(monday)
    date.setDate(monday.getDate() + dayIdx)

    const dayCol = document.createElement("div")
    dayCol.className = "day-column"
    dayCol.dataset.dayIndex = dayIdx

    const dayHeader = document.createElement("div")
    dayHeader.className = "day-name"
    dayHeader.innerHTML = `${dayNames[dayIdx]}<span class="date">${date.getDate()}/${date.getMonth() + 1}</span>`
    dayCol.appendChild(dayHeader)

    const dayLessons = week[day] || []
    const isWeekend = dayIdx === 5 || dayIdx === 6

    const slotsContainer = document.createElement("div")
    slotsContainer.className = "slots-container"

    const dayDate = new Date(monday)
    dayDate.setDate(monday.getDate() + dayIdx)

    const registry = window._registry || []
    const dayRecordings = registry.filter((e) => {
      const eDate = new Date(e.created_at || e.updated_at || e.date || 0)
      if (!eDate.getFullYear()) return false
      return eDate.getDate() === dayDate.getDate() && eDate.getMonth() === dayDate.getMonth()
    })

    const recordingsBySlot = {}
    if (isWeekend) {
      dayRecordings.forEach((rec) => {
        const time = getTimeFromIsoDate(rec.created_at || rec.updated_at || rec.date)
        if (time) {
          const slotIdx = findSlotIndexByTime(time)
          if (!recordingsBySlot[slotIdx]) {
            recordingsBySlot[slotIdx] = []
          }
          recordingsBySlot[slotIdx].push(rec)
        }
      })
    }

    const occupiedSlots = new Set()

    FIXED_TIME_SLOTS.forEach((slot, slotIdx) => {
      const timeCell = document.createElement("div")
      timeCell.className = "time-cell"

      if (occupiedSlots.has(slotIdx)) {
        timeCell.style.display = "none"
        slotsContainer.appendChild(timeCell)
        return
      }

      if (isWeekend) {
        const slotRecordings = recordingsBySlot[slotIdx] || []

        if (slotRecordings.length > 0) {
          const recordingsWrapper = document.createElement("div")
          recordingsWrapper.className = "weekend-recordings"

          slotRecordings.forEach((rec) => {
            const recCard = document.createElement("div")
            recCard.className = "recording-card"
            const recTime = getTimeFromIsoDate(rec.created_at || rec.updated_at || rec.date)
            recCard.innerHTML = `
              <div class="rec-header">
                <span class="rec-icon">🎙</span>
                <span class="rec-time">${recTime || ""}</span>
              </div>
              <div class="rec-name">${rec.audio_source || rec.id || "Enregistrement"}</div>
            `
            recCard.addEventListener("click", () => openPanelForEntry(rec))
            recordingsWrapper.appendChild(recCard)
          })

          timeCell.appendChild(recordingsWrapper)
        } else {
          const emptyDiv = document.createElement("div")
          emptyDiv.className = "empty-cell weekend-empty"
          emptyDiv.textContent = "—"
          timeCell.appendChild(emptyDiv)
        }
      } else {
        // Logique normale pour les jours de semaine
        const lesson = dayLessons.find((l) => findSlotIndex(l.debut) === slotIdx)

        if (lesson) {
          const span = getSlotSpan(lesson)

          for (let i = 1; i < span; i++) {
            occupiedSlots.add(slotIdx + i)
          }

          const card = document.createElement("div")
          card.className = "course-card"

          if (span > 1) {
            card.style.flex = span
            card.classList.add("multi-slot")
            timeCell.style.flex = span
          }

          if (span >= 2) {
            card.style.background = "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)"
          }

          card.innerHTML = `
            <div class="course-title">${lesson.cours}</div>
            <div class="course-meta">
              <span class="teacher">${lesson.prof}</span>
              <span class="room">${lesson.salle}</span>
            </div>
            <div class="course-time">${lesson.debut} - ${lesson.fin}</div>
          `
          card.dataset.info = JSON.stringify(lesson)
          card.addEventListener("click", () => openSlotFromTimetable(lesson))
          timeCell.appendChild(card)
        } else {
          const emptyDiv = document.createElement("div")
          emptyDiv.className = "empty-cell"
          emptyDiv.textContent = "—"
          timeCell.appendChild(emptyDiv)
        }
      }

      slotsContainer.appendChild(timeCell)
    })

    dayCol.appendChild(slotsContainer)

    const othersContainer = document.createElement("div")
    othersContainer.className = "others-container"

    if (!isWeekend) {
      // Pour les jours de semaine, afficher les enregistrements hors-cours
      const unmatchedRecordings = dayRecordings.filter((e) => {
        const matchesCourse = dayLessons.some((ls) =>
          (e.transcription_text || e.resume_text || "").toLowerCase().includes(ls.cours.toLowerCase()),
        )
        return !matchesCourse
      })

      if (unmatchedRecordings.length > 0) {
        unmatchedRecordings.forEach((rec) => {
          const item = document.createElement("div")
          item.className = "recording-item"
          item.innerHTML = `
            <span class="rec-icon">🎙</span>
            <span class="rec-name">${rec.audio_source || rec.id || "Enreg."}</span>
          `
          item.addEventListener("click", () => openPanelForEntry(rec))
          othersContainer.appendChild(item)
        })
      } else {
        const empty = document.createElement("div")
        empty.className = "empty-others"
        empty.textContent = "—"
        othersContainer.appendChild(empty)
      }
    } else {
      // Pour le weekend, section vide ou message
      const empty = document.createElement("div")
      empty.className = "empty-others weekend-others"
      empty.textContent = "Weekend"
      othersContainer.appendChild(empty)
    }

    dayCol.appendChild(othersContainer)
    wrapper.appendChild(dayCol)
  })

  gridWrap.appendChild(wrapper)

  setupDaySelector()

  if (window.currentMobileDay === undefined) {
    window.currentMobileDay = 0
  }
  updateMobileDayView()
}

function setupDaySelector() {
  const selector = getEl("daySelector")
  if (!selector) return

  const days = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"]
  selector.innerHTML = ""
  selector.classList.remove("hidden")

  days.forEach((day, idx) => {
    const btn = document.createElement("button")
    btn.textContent = day
    btn.dataset.dayIndex = idx
    btn.className = "btn"
    btn.addEventListener("click", () => {
      window.currentMobileDay = idx
      updateMobileDayView()
    })
    selector.appendChild(btn)
  })
}

function updateMobileDayView() {
  if (window.innerWidth > 900) return

  const dayIdx = window.currentMobileDay || 0

  const selector = getEl("daySelector")
  if (selector) {
    const buttons = selector.querySelectorAll("button")
    buttons.forEach((btn, idx) => {
      if (idx === dayIdx) {
        btn.classList.add("active")
      } else {
        btn.classList.remove("active")
      }
    })
  }

  const dayColumns = document.querySelectorAll(".day-column")
  dayColumns.forEach((col, idx) => {
    if (idx === dayIdx) {
      col.style.display = "flex"
      col.classList.add("active-day")
    } else {
      col.style.display = "none"
      col.classList.remove("active-day")
    }
  })
}

function openSlotFromTimetable(ls) {
  const registry = window._registry || []
  const match = registry.find((e) =>
    (e.resume_text || e.transcription_text || "").toLowerCase().includes(ls.cours.toLowerCase()),
  )
  if (match) {
    openPanelForEntry(match)
  } else {
    openPanelForEntry({
      audio_source: ls.cours,
      created_at: new Date().toISOString(),
      transcription_text: "",
      resume_text: "Aucun enregistrement trouvé pour ce cours",
    })
  }
}

function openPanelForEntry(entry) {
  const modal = getEl("modal")
  const content = getEl("modalBody")
  if (modal) modal.classList.remove("hidden")
  if (!content) return

  content.innerHTML = ""
  const h = document.createElement("h3")
  h.textContent = entry.audio_source || entry.id
  const date = document.createElement("div")
  date.className = "meta"
  date.textContent = entry.created_at || ""
  content.appendChild(h)
  content.appendChild(date)

  const summary = document.createElement("div")
  summary.id = "summary"
  summary.innerHTML = `<h4>Résumé</h4><div>${(entry.resume_text || entry.transcription_text || "(vide)").slice(0, 800)}</div>`
  content.appendChild(summary)

  const more = document.createElement("div")
  more.className = "showMore"
  more.textContent = "Afficher plus"
  content.appendChild(more)

  const full = document.createElement("div")
  full.id = "fullText"
  full.style.display = "none"

  const searchBox = document.createElement("div")
  searchBox.className = "searchBox"
  const inp = document.createElement("input")
  inp.placeholder = "Rechercher..."
  const btn = document.createElement("button")
  btn.textContent = "Rechercher"
  btn.className = "btn-small"

  const controls = document.createElement("div")
  controls.className = "controls-row"
  const copyBtn = document.createElement("button")
  copyBtn.className = "btn-small copyBtn"
  copyBtn.textContent = "Copier"
  const exportBtn = document.createElement("button")
  exportBtn.className = "btn-small exportBtn"
  exportBtn.textContent = "Exporter"
  const playBtn = document.createElement("button")
  playBtn.className = "btn-small"
  playBtn.textContent = "▶ Écouter"
  controls.appendChild(playBtn)
  controls.appendChild(copyBtn)
  controls.appendChild(exportBtn)
  content.appendChild(controls)

  searchBox.appendChild(inp)
  searchBox.appendChild(btn)
  full.appendChild(searchBox)

  const pre = document.createElement("pre")
  pre.textContent = entry.transcription_text || entry.resume_text || ""
  full.appendChild(pre)
  content.appendChild(full)

  more.addEventListener("click", () => {
    full.style.display = full.style.display === "none" ? "block" : "none"
    more.textContent = full.style.display === "none" ? "Afficher plus" : "Masquer"
  })

  btn.addEventListener("click", () => {
    const q = inp.value.trim()
    if (!q) return
    const re = new RegExp(q, "ig")
    const txt = entry.transcription_text || entry.resume_text || ""
    const matches = [...txt.matchAll(re)]
    if (matches.length === 0) {
      alert("Aucune occurrence")
    } else {
      const highlighted = txt.replace(re, (m) => `<<${m}>>`)
      pre.innerHTML = highlighted.replace(/<<(.+?)>>/g, "<mark>$1</mark>")
    }
  })

  copyBtn.addEventListener("click", () => {
    const txt = entry.resume_text || entry.transcription_text || ""
    navigator.clipboard.writeText(txt)
    alert("Copié!")
  })

  exportBtn.addEventListener("click", () => {
    const blob = new Blob([entry.transcription_text || entry.resume_text || ""], {
      type: "text/plain;charset=utf-8",
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${entry.audio_source || entry.id || "transcription"}.txt`
    a.click()
    URL.revokeObjectURL(url)
  })

  playBtn.addEventListener("click", () => {
    const text = entry.resume_text || entry.transcription_text || ""
    if (!text) return alert("Aucun texte")
    if ("speechSynthesis" in window) {
      const u = new SpeechSynthesisUtterance(text)
      u.lang = "fr-FR"
      window.speechSynthesis.cancel()
      window.speechSynthesis.speak(u)
    } else {
      alert("Non supporté")
    }
  })
}

const closeBtn = getEl("closeModal")
if (closeBtn) {
  closeBtn.addEventListener("click", () => {
    const modal = getEl("modal")
    if (modal) modal.classList.add("hidden")
  })
}

function setupWeekNavigation() {
  const prev = getEl("prevWeek")
  const next = getEl("nextWeek")
  if (prev) prev.addEventListener("click", () => changeWeek(-1))
  if (next) next.addEventListener("click", () => changeWeek(1))
}

function changeWeek(delta) {
  if (!window.currentIsoWeek) {
    window.currentIsoWeek = new Date().toISOString().slice(0, 10)
  }
  const base = new Date(window.currentIsoWeek)
  base.setDate(base.getDate() + 7 * delta)
  window.currentIsoWeek = base.toISOString().slice(0, 10)
  const wkKey = weekKeyFromDate(window.currentIsoWeek)
  const wl = getEl("weekLabel")
  if (wl) wl.textContent = wkKey || "semaine_A"
  fetchJson("timetable.json").then((t) => {
    window._timetable = t
    renderTimetable(t, wkKey || "semaine_A")
  })
}

async function main() {
  try {
    const registry = await fetchJson("registry.json")
    const timetable = await fetchJson("timetable.json")

    window._registry = registry
    window._timetable = timetable

    setupWeekNavigation()

    const loading = getEl("loading")
    if (loading) loading.style.display = "none"

    if (registry.length > 0) {
      const latest = registry[registry.length - 1]
      const wk = weekKeyFromDate(latest.created_at || latest.updated_at || latest.date || "")
      const wl = getEl("weekLabel")
      if (wl) wl.textContent = wk || "semaine_A"
      window.currentIsoWeek = (latest.created_at || new Date().toISOString()).slice(0, 10)
      renderTimetable(timetable, wk || "semaine_A")
    } else {
      renderTimetable(timetable, "semaine_A")
    }

    window.addEventListener("resize", () => {
      updateMobileDayView()
    })
  } catch (e) {
    const loading = getEl("loading")
    if (loading) {
      loading.textContent = "Erreur de chargement"
    }
    console.error(e)
  }
}

main()
