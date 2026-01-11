// ============== UTILITY FUNCTIONS ==============
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

function extractQuotedTitle(raw) {
  if (!raw) return null
  const m = raw.match(/"([^"]{3,80})"/)
  if (m) return m[1]
  return null
}

// Toast notification system
function showToast(message, type = "info") {
  const container = getEl("toastContainer")
  if (!container) return

  const toast = document.createElement("div")
  toast.className = `toast ${type}`
  toast.innerHTML = `
    <span>${type === "success" ? "✓" : type === "error" ? "✕" : "ℹ"}</span>
    <span>${message}</span>
  `
  container.appendChild(toast)

  setTimeout(() => {
    toast.style.opacity = "0"
    toast.style.transform = "translateX(100%)"
    setTimeout(() => toast.remove(), 300)
  }, 3000)
}

// Time slot definitions
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
  if (minutes < timeToMinutes(FIXED_TIME_SLOTS[0].start)) {
    return 0
  }
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

// ============== STATS FUNCTIONS ==============
function updateStats() {
  const registry = window._registry || []
  const timetable = window._timetable || {}
  const weekKey = weekKeyFromDate(window.currentIsoWeek || new Date().toISOString())
  const week = timetable[weekKey] || {}

  let totalCourses = 0
  let totalMinutes = 0

  Object.values(week).forEach((dayLessons) => {
    if (Array.isArray(dayLessons)) {
      totalCourses += dayLessons.length
      dayLessons.forEach((lesson) => {
        const start = timeToMinutes(lesson.debut)
        const end = timeToMinutes(lesson.fin)
        totalMinutes += end - start
      })
    }
  })

  const statCourses = getEl("statCourses")
  const statRecordings = getEl("statRecordings")
  const statHours = getEl("statHours")

  if (statCourses) statCourses.textContent = totalCourses
  if (statRecordings) statRecordings.textContent = registry.length
  if (statHours) statHours.textContent = `${Math.round(totalMinutes / 60)}h`
}

// ============== RENDER TIMETABLE ==============
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

  // Update week dates display
  const weekDates = getEl("weekDates")
  if (weekDates) {
    const sunday = new Date(monday)
    sunday.setDate(monday.getDate() + 6)
    weekDates.textContent = `${monday.getDate()}/${monday.getMonth() + 1} - ${sunday.getDate()}/${sunday.getMonth() + 1}`
  }

  const week = timetable[weekKey] || {}
  const registry = window._registry || []
  const today = new Date()

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

    const isToday = date.toDateString() === today.toDateString()

    const dayHeader = document.createElement("div")
    dayHeader.className = `day-name${isToday ? " today" : ""}`
    dayHeader.innerHTML = `${dayNames[dayIdx]}<span class="date">${date.getDate()}/${date.getMonth() + 1}</span>`
    dayCol.appendChild(dayHeader)

    const dayLessons = week[day] || []
    const isWeekend = dayIdx === 5 || dayIdx === 6

    const slotsContainer = document.createElement("div")
    slotsContainer.className = "slots-container"

    const dayDate = new Date(monday)
    dayDate.setDate(monday.getDate() + dayIdx)

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
            recCard.addEventListener("click", (e) => {
              e.stopPropagation()
              openPanelForEntry(rec)
            })
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
        const lesson = dayLessons.find((l) => findSlotIndex(l.debut) === slotIdx)

        if (lesson) {
          const span = getSlotSpan(lesson)

          for (let i = 1; i < span; i++) {
            occupiedSlots.add(slotIdx + i)
          }

          // Check if there's a recording for this course
          const hasRecording = registry.some((e) =>
            (e.resume_text || e.transcription_text || "").toLowerCase().includes(lesson.cours.toLowerCase()),
          )

          const card = document.createElement("div")
          card.className = `course-card${hasRecording ? " has-recording" : ""}`

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
          card.addEventListener("click", (e) => {
            e.stopPropagation()
            openSlotFromTimetable(lesson)
          })
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
          item.addEventListener("click", (e) => {
            e.stopPropagation()
            openPanelForEntry(rec)
          })
          othersContainer.appendChild(item)
        })
      } else {
        const empty = document.createElement("div")
        empty.className = "empty-others"
        empty.textContent = "—"
        othersContainer.appendChild(empty)
      }
    } else {
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
    // Set to today if it's in this week, otherwise Monday
    const todayIdx = today.getDay() === 0 ? 6 : today.getDay() - 1
    window.currentMobileDay = todayIdx
  }
  updateMobileDayView()
  updateStats()
}

// ============== DAY SELECTOR ==============
function setupDaySelector() {
  const selector = getEl("daySelector")
  if (!selector) return

  const days = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"]
  const today = new Date()
  const todayIdx = today.getDay() === 0 ? 6 : today.getDay() - 1

  selector.innerHTML = ""
  selector.classList.remove("hidden")

  days.forEach((day, idx) => {
    const btn = document.createElement("button")
    btn.textContent = day
    btn.dataset.dayIndex = idx
    btn.className = "btn"
    if (idx === todayIdx) {
      btn.classList.add("today")
    }
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

// ============== ENTRY PANEL ==============
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
      resume_text:
        "Aucun enregistrement trouvé pour ce cours.\n\nProfesseur: " +
        ls.prof +
        "\nSalle: " +
        ls.salle +
        "\nHoraire: " +
        ls.debut +
        " - " +
        ls.fin,
    })
  }
}

function openPanelForEntry(entry) {
  const isMobile = window.innerWidth <= 900

  function transformText(raw) {
    if (!raw) return ""
    let t = raw
    t = t.replace(/\*\*(.+?)\*\*/g, (m, p1) => `<strong>${p1}</strong>`)
    t = t.replace(/\*\*/g, "")

    const lines = t.split(/\r?\n/)
    const out = []
    let inList = false
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim()
      const m = line.match(/^\s*(\d+)\s*\.\s*(.*)$/)
      if (m) {
        if (!inList) {
          out.push("<ol>")
          inList = true
        }
        out.push(`<li>${m[2]}</li>`)
      } else {
        if (inList) {
          out.push("</ol>")
          inList = false
        }
        if (line === "") {
          out.push("<p></p>")
        } else if (line.startsWith("##")) {
          out.push(`<h4>${line.replace(/^#+\s*/, "")}</h4>`)
        } else {
          out.push(`<p>${line}</p>`)
        }
      }
    }
    if (inList) out.push("</ol>")
    return out.join("")
  }

  const speechRate = Number.parseFloat(localStorage.getItem("speechRate") || "1")

  // Mobile full-page view
  if (isMobile) {
    const existing = document.querySelector(".entry-page")
    if (existing) existing.remove()

    const page = document.createElement("div")
    page.className = "entry-page"

    const header = document.createElement("div")
    header.className = "entry-header"
    const back = document.createElement("button")
    back.className = "back-btn"
    back.textContent = "← Retour"
    back.addEventListener("click", () => {
      if (window.speechSynthesis) window.speechSynthesis.cancel()
      page.style.transform = "translateX(100%)"
      setTimeout(() => page.remove(), 300)
    })

    const title = document.createElement("div")
    title.className = "entry-title"
    const raw = entry.resume_text || entry.transcription_text || ""
    const quoted = extractQuotedTitle(raw)
    title.textContent = quoted || entry.audio_source || entry.id
    header.appendChild(back)
    header.appendChild(title)
    page.appendChild(header)

    const meta = document.createElement("div")
    meta.className = "entry-meta"
    const d = new Date(entry.created_at || "")
    meta.textContent = d.getFullYear()
      ? d.toLocaleDateString("fr-FR", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })
      : ""
    page.appendChild(meta)

    const controls = document.createElement("div")
    controls.className = "controls-row"

    let isPlaying = false
    const playBtn = document.createElement("button")
    playBtn.className = "btn-small playBtn"
    playBtn.innerHTML = "▶ Écouter"
    playBtn.addEventListener("click", () => {
      const text = entry.resume_text || entry.transcription_text || ""
      if (!text) return
      if ("speechSynthesis" in window) {
        if (isPlaying) {
          window.speechSynthesis.cancel()
          playBtn.innerHTML = "▶ Écouter"
          playBtn.classList.remove("playing")
          isPlaying = false
        } else {
          const u = new SpeechSynthesisUtterance(text)
          u.lang = "fr-FR"
          u.rate = speechRate
          u.onend = () => {
            playBtn.innerHTML = "▶ Écouter"
            playBtn.classList.remove("playing")
            isPlaying = false
          }
          window.speechSynthesis.cancel()
          window.speechSynthesis.speak(u)
          playBtn.innerHTML = "⏹ Stop"
          playBtn.classList.add("playing")
          isPlaying = true
        }
      }
    })

    const copyBtn = document.createElement("button")
    copyBtn.className = "btn-small copyBtn"
    copyBtn.innerHTML = "📋 Copier"
    copyBtn.addEventListener("click", () => {
      const txt = entry.resume_text || entry.transcription_text || ""
      navigator.clipboard.writeText(txt).then(() => {
        showToast("Copié dans le presse-papier", "success")
      })
    })

    const exportBtn = document.createElement("button")
    exportBtn.className = "btn-small exportBtn"
    exportBtn.innerHTML = "📥 Exporter"
    exportBtn.addEventListener("click", () => {
      const blob = new Blob([entry.transcription_text || entry.resume_text || ""], { type: "text/plain;charset=utf-8" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `${entry.audio_source || entry.id || "transcription"}.txt`
      a.click()
      URL.revokeObjectURL(url)
      showToast("Fichier exporté", "success")
    })

    controls.appendChild(playBtn)
    controls.appendChild(copyBtn)
    controls.appendChild(exportBtn)
    page.appendChild(controls)

    const content = document.createElement("div")
    content.className = "entry-content"
    content.innerHTML = transformText(entry.resume_text || entry.transcription_text || "")
    page.appendChild(content)

    document.body.appendChild(page)
    return
  }

  // Desktop modal view
  const modal = getEl("modal")
  const content = getEl("modalBody")
  if (!content) return
  if (modal) modal.classList.remove("hidden")
  content.innerHTML = ""

  const h = document.createElement("h3")
  const quoted = extractQuotedTitle(entry.resume_text || entry.transcription_text || "")
  h.textContent = quoted || entry.audio_source || entry.id

  const date = document.createElement("div")
  date.className = "meta"
  const d = new Date(entry.created_at || "")
  date.textContent = d.getFullYear()
    ? d.toLocaleDateString("fr-FR", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : ""

  content.appendChild(h)
  content.appendChild(date)

  const html = transformText(entry.resume_text || entry.transcription_text || "")
  const summary = document.createElement("div")
  summary.id = "summary"
  summary.innerHTML = `<h4>📝 Résumé</h4>${html}`
  content.appendChild(summary)

  const controls = document.createElement("div")
  controls.className = "controls-row"

  let isPlaying = false
  const playBtn = document.createElement("button")
  playBtn.className = "btn-small playBtn"
  playBtn.innerHTML = "▶ Écouter"
  playBtn.addEventListener("click", () => {
    const text = entry.resume_text || entry.transcription_text || ""
    if (!text) return
    if ("speechSynthesis" in window) {
      if (isPlaying) {
        window.speechSynthesis.cancel()
        playBtn.innerHTML = "▶ Écouter"
        playBtn.classList.remove("playing")
        isPlaying = false
      } else {
        const u = new SpeechSynthesisUtterance(text)
        u.lang = "fr-FR"
        u.rate = speechRate
        u.onend = () => {
          playBtn.innerHTML = "▶ Écouter"
          playBtn.classList.remove("playing")
          isPlaying = false
        }
        window.speechSynthesis.cancel()
        window.speechSynthesis.speak(u)
        playBtn.innerHTML = "⏹ Stop"
        playBtn.classList.add("playing")
        isPlaying = true
      }
    }
  })

  const copyBtn = document.createElement("button")
  copyBtn.className = "btn-small copyBtn"
  copyBtn.innerHTML = "📋 Copier"
  copyBtn.addEventListener("click", () => {
    const txt = entry.resume_text || entry.transcription_text || ""
    navigator.clipboard.writeText(txt).then(() => {
      showToast("Copié dans le presse-papier", "success")
    })
  })

  const exportBtn = document.createElement("button")
  exportBtn.className = "btn-small exportBtn"
  exportBtn.innerHTML = "📥 Exporter"
  exportBtn.addEventListener("click", () => {
    const blob = new Blob([entry.transcription_text || entry.resume_text || ""], { type: "text/plain;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${entry.audio_source || entry.id || "transcription"}.txt`
    a.click()
    URL.revokeObjectURL(url)
    showToast("Fichier exporté", "success")
  })

  controls.appendChild(playBtn)
  controls.appendChild(copyBtn)
  controls.appendChild(exportBtn)
  content.appendChild(controls)

  const more = document.createElement("button")
  more.className = "showMore"
  more.textContent = "📄 Afficher la transcription complète"
  content.appendChild(more)

  const full = document.createElement("div")
  full.id = "fullText"
  full.style.display = "none"
  const pre = document.createElement("pre")
  pre.style.whiteSpace = "pre-wrap"
  pre.textContent = ""
  full.appendChild(pre)
  content.appendChild(full)

  more.addEventListener("click", () => {
    const raw = entry.transcription_text || entry.resume_text || ""
    pre.textContent = raw
    full.style.display = "block"
    more.style.display = "none"
  })
}

// ============== MODAL HANDLING ==============
const closeBtn = getEl("closeModal")
if (closeBtn) {
  closeBtn.addEventListener("click", () => {
    const modal = getEl("modal")
    if (modal) modal.classList.add("hidden")
    if (window.speechSynthesis) window.speechSynthesis.cancel()
  })
}

// Close modal on backdrop click
document.addEventListener("click", (e) => {
  if (e.target.classList.contains("modal-backdrop")) {
    const modal = e.target.closest(".modal")
    if (modal) {
      modal.classList.add("hidden")
      if (window.speechSynthesis) window.speechSynthesis.cancel()
    }
  }
})

// ============== WEEK NAVIGATION ==============
function setupWeekNavigation() {
  const prev = getEl("prevWeek")
  const next = getEl("nextWeek")
  const today = getEl("todayBtn")

  if (prev) prev.addEventListener("click", () => changeWeek(-1))
  if (next) next.addEventListener("click", () => changeWeek(1))
  if (today) today.addEventListener("click", goToToday)
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
  if (wl) wl.textContent = wkKey === "semaine_A" ? "Semaine A" : "Semaine B"

  fetchJson("timetable.json").then((t) => {
    window._timetable = t
    renderTimetable(t, wkKey || "semaine_A")
  })
}

function goToToday() {
  const today = new Date()
  window.currentIsoWeek = today.toISOString().slice(0, 10)
  window.currentMobileDay = today.getDay() === 0 ? 6 : today.getDay() - 1
  const wkKey = weekKeyFromDate(window.currentIsoWeek)
  const wl = getEl("weekLabel")
  if (wl) wl.textContent = wkKey === "semaine_A" ? "Semaine A" : "Semaine B"

  fetchJson("timetable.json").then((t) => {
    window._timetable = t
    renderTimetable(t, wkKey || "semaine_A")
  })
  showToast("Retour à aujourd'hui", "info")
}

// ============== SEARCH FUNCTIONALITY ==============
function setupSearch() {
  const searchToggle = getEl("searchToggle")
  const searchBar = getEl("searchBar")
  const searchInput = getEl("searchInput")
  const searchClear = getEl("searchClear")

  if (searchToggle && searchBar) {
    searchToggle.addEventListener("click", () => {
      searchBar.classList.toggle("hidden")
      if (!searchBar.classList.contains("hidden") && searchInput) {
        searchInput.focus()
      }
    })
  }

  if (searchClear && searchInput) {
    searchClear.addEventListener("click", () => {
      searchInput.value = ""
      clearSearchHighlights()
    })
  }

  if (searchInput) {
    let debounce
    searchInput.addEventListener("input", () => {
      clearTimeout(debounce)
      debounce = setTimeout(() => {
        performSearch(searchInput.value)
      }, 300)
    })
  }
}

function performSearch(query) {
  clearSearchHighlights()
  if (!query || query.length < 2) return

  const q = query.toLowerCase()
  const courseCards = document.querySelectorAll(".course-card")
  const recordingCards = document.querySelectorAll(".recording-card, .recording-item")

  let found = 0

  courseCards.forEach((card) => {
    const info = JSON.parse(card.dataset.info || "{}")
    const text = `${info.cours || ""} ${info.prof || ""} ${info.salle || ""}`.toLowerCase()
    if (text.includes(q)) {
      card.classList.add("search-highlight")
      found++
    }
  })

  recordingCards.forEach((card) => {
    const text = card.textContent.toLowerCase()
    if (text.includes(q)) {
      card.classList.add("search-highlight")
      found++
    }
  })

  if (found > 0) {
    showToast(`${found} résultat(s) trouvé(s)`, "success")
  } else {
    showToast("Aucun résultat", "info")
  }
}

function clearSearchHighlights() {
  document.querySelectorAll(".search-highlight").forEach((el) => {
    el.classList.remove("search-highlight")
  })
}

// ============== STATS PANEL ==============
function setupStats() {
  const statsToggle = getEl("statsToggle")
  const statsPanel = getEl("statsPanel")

  if (statsToggle && statsPanel) {
    statsToggle.addEventListener("click", () => {
      statsPanel.classList.toggle("hidden")
    })
  }
}

// ============== THEME TOGGLE ==============
function setupTheme() {
  const themeToggle = getEl("themeToggle")
  const darkModeCheck = getEl("darkModeCheck")

  const savedTheme = localStorage.getItem("theme")
  if (savedTheme === "dark") {
    document.documentElement.setAttribute("data-theme", "dark")
    if (darkModeCheck) darkModeCheck.checked = true
    if (themeToggle) themeToggle.textContent = "☀️"
  }

  if (themeToggle) {
    themeToggle.addEventListener("click", () => {
      toggleTheme()
    })
  }

  if (darkModeCheck) {
    darkModeCheck.addEventListener("change", () => {
      toggleTheme()
    })
  }
}

function toggleTheme() {
  const themeToggle = getEl("themeToggle")
  const darkModeCheck = getEl("darkModeCheck")

  const isDark = document.documentElement.getAttribute("data-theme") === "dark"

  if (isDark) {
    document.documentElement.removeAttribute("data-theme")
    localStorage.setItem("theme", "light")
    if (themeToggle) themeToggle.textContent = "🌙"
    if (darkModeCheck) darkModeCheck.checked = false
  } else {
    document.documentElement.setAttribute("data-theme", "dark")
    localStorage.setItem("theme", "dark")
    if (themeToggle) themeToggle.textContent = "☀️"
    if (darkModeCheck) darkModeCheck.checked = true
  }
}

// ============== SETTINGS ==============
function setupSettings() {
  const settingsToggle = getEl("settingsToggle")
  const settingsModal = getEl("settingsModal")
  const closeSettings = getEl("closeSettings")
  const compactCheck = getEl("compactCheck")
  const speechRate = getEl("speechRate")
  const exportAll = getEl("exportAll")
  const clearCache = getEl("clearCache")

  if (settingsToggle && settingsModal) {
    settingsToggle.addEventListener("click", () => {
      settingsModal.classList.remove("hidden")
    })
  }

  if (closeSettings && settingsModal) {
    closeSettings.addEventListener("click", () => {
      settingsModal.classList.add("hidden")
    })
  }

  // Load saved settings
  if (compactCheck) {
    compactCheck.checked = localStorage.getItem("compact") === "true"
    if (compactCheck.checked) {
      document.querySelector(".container")?.classList.add("compact")
    }
    compactCheck.addEventListener("change", () => {
      localStorage.setItem("compact", compactCheck.checked)
      document.querySelector(".container")?.classList.toggle("compact", compactCheck.checked)
    })
  }

  if (speechRate) {
    speechRate.value = localStorage.getItem("speechRate") || "1"
    speechRate.addEventListener("change", () => {
      localStorage.setItem("speechRate", speechRate.value)
    })
  }

  if (exportAll) {
    exportAll.addEventListener("click", () => {
      const registry = window._registry || []
      const blob = new Blob([JSON.stringify(registry, null, 2)], { type: "application/json" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = "audiocours-export.json"
      a.click()
      URL.revokeObjectURL(url)
      showToast("Données exportées", "success")
    })
  }

  if (clearCache) {
    clearCache.addEventListener("click", () => {
      localStorage.clear()
      showToast("Cache vidé", "success")
      setTimeout(() => location.reload(), 1000)
    })
  }
}

// ============== MAIN ==============
async function main() {
  try {
    const registry = await fetchJson("registry.json")
    const timetable = await fetchJson("timetable.json")

    window._registry = registry
    window._timetable = timetable

    setupWeekNavigation()
    setupSearch()
    setupStats()
    setupTheme()
    setupSettings()

    const loading = getEl("loading")
    if (loading) loading.style.display = "none"

    if (registry.length > 0) {
      const latest = registry[registry.length - 1]
      const wk = weekKeyFromDate(latest.created_at || latest.updated_at || latest.date || "")
      const wl = getEl("weekLabel")
      if (wl) wl.textContent = wk === "semaine_A" ? "Semaine A" : "Semaine B"
      window.currentIsoWeek = (latest.created_at || new Date().toISOString()).slice(0, 10)
      renderTimetable(timetable, wk || "semaine_A")
    } else {
      const wl = getEl("weekLabel")
      if (wl) wl.textContent = "Semaine A"
      renderTimetable(timetable, "semaine_A")
    }

    window.addEventListener("resize", () => {
      updateMobileDayView()
    })

    // Keyboard shortcuts
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        const modal = getEl("modal")
        const settingsModal = getEl("settingsModal")
        const entryPage = document.querySelector(".entry-page")

        if (modal && !modal.classList.contains("hidden")) {
          modal.classList.add("hidden")
          if (window.speechSynthesis) window.speechSynthesis.cancel()
        }
        if (settingsModal && !settingsModal.classList.contains("hidden")) {
          settingsModal.classList.add("hidden")
        }
        if (entryPage) {
          entryPage.remove()
          if (window.speechSynthesis) window.speechSynthesis.cancel()
        }
      }

      if (e.ctrlKey && e.key === "f") {
        e.preventDefault()
        const searchBar = getEl("searchBar")
        const searchInput = getEl("searchInput")
        if (searchBar) {
          searchBar.classList.remove("hidden")
          if (searchInput) searchInput.focus()
        }
      }
    })
  } catch (e) {
    const loading = getEl("loading")
    if (loading) {
      loading.textContent = "Erreur de chargement"
      loading.classList.remove("hidden")
    }
    console.error(e)
    showToast("Erreur de chargement", "error")
  }
}

main()
