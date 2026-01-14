// =====================================================
// APPLICATION MOBILE-FIRST
// =====================================================

let currentWeekOffset = 0 // 0 = current week, -1 = last week, +1 = next week
let currentDayIndex = 0
let audioRecordings = []
let orphanRecordings = []
let audioPlayer = null
let currentRecording = null
let refreshInterval = null



// =====================================================
// INITIALISATION
// =====================================================

document.addEventListener("DOMContentLoaded", async () => {
  audioPlayer = document.getElementById("audio-player")

  // Initialize Supabase if configured
  if (SUPABASE_CONFIG.url && SUPABASE_CONFIG.apiKey) {
    try {
      supabase = window.supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.apiKey)
      await loadAudioRecordings()

      refreshInterval = setInterval(loadAudioRecordings, 10000)
    } catch (error) {
      console.error("Erreur Supabase:", error)
      loadDemoData()
    }
  } else {
    loadDemoData()
  }

  // Set current day
  const today = new Date().getDay()
  currentDayIndex = today === 0 ? 0 : today === 6 ? 4 : today - 1

  updateDisplay()
  setupEventListeners()

  document.getElementById("loader").classList.add("hidden")
})

// =====================================================
// WEEK CALCULATION
// =====================================================

function getCurrentWeekInfo() {
  const now = new Date()
  const offsetDate = new Date(now)
  offsetDate.setDate(now.getDate() + currentWeekOffset * 7)

  // Calculate week number from reference
  const diffTime = offsetDate - WEEK_A_START
  const diffWeeks = Math.floor(diffTime / (1000 * 60 * 60 * 24 * 7))
  const isWeekA = diffWeeks % 2 === 0

  // Get Monday of the week
  const monday = new Date(offsetDate)
  const day = monday.getDay()
  const diff = monday.getDate() - day + (day === 0 ? -6 : 1)
  monday.setDate(diff)

  // Get week dates
  const dates = []
  for (let i = 0; i < 5; i++) {
    const date = new Date(monday)
    date.setDate(monday.getDate() + i)
    dates.push(date)
  }

  return {
    type: isWeekA ? "semaine_A" : "semaine_B",
    label: isWeekA ? "Semaine A" : "Semaine B",
    dates,
    monday,
  }
}

// =====================================================
// DISPLAY
// =====================================================

function generateResponsiveTimetable(weekInfo) {
  if (window.innerWidth < 768) {
    // Mobile : cartes jour par jour
    generateDailyCards(weekInfo)
  } else {
    // PC : tableau global
    generateTableView(weekInfo)
  }
}

// =====================================================
// MOBILE - CARTES JOUR PAR JOUR
// =====================================================

function generateDailyCards(weekInfo) {
  const container = document.getElementById("timetable-container")
  container.innerHTML = ""

  const weekData = TIMETABLE_DATA[weekInfo.type]

  DAYS.forEach((day, dayIndex) => {
    const dayCard = document.createElement("div")
    dayCard.className = "day-card"
    if (dayIndex === currentDayIndex) dayCard.classList.add("active")

    // Date
    const dateEl = document.createElement("div")
    dateEl.className = "day-date"
    dateEl.textContent = weekInfo.dates[dayIndex].toLocaleDateString("fr-FR", {
      weekday: "long",
      day: "numeric",
      month: "long",
    })
    dayCard.appendChild(dateEl)

    const courses = weekData[day] || []
    TIME_SLOTS.forEach(slot => {
      const course = courses.find(c => c.debut === slot.debut)
      const row = document.createElement("div")
      row.className = "time-row"

      const timeLabel = document.createElement("div")
      timeLabel.className = "time-label"
      timeLabel.textContent = slot.debut
      row.appendChild(timeLabel)

      if (course) {
        const recordings = getRecordingsForCourse(course.cours, day, weekInfo.dates[dayIndex])
        const card = createCourseCard(course, day, weekInfo.dates[dayIndex], recordings)
        row.appendChild(card)
      } else {
        const empty = document.createElement("div")
        empty.className = "course-card empty-slot"
        row.appendChild(empty)
      }

      dayCard.appendChild(row)
    })

    container.appendChild(dayCard)
  })
}


function generateTableView(weekInfo) {
  const container = document.getElementById("timetable-container")
  container.innerHTML = ""

  const weekData = TIMETABLE_DATA[weekInfo.type]

  const table = document.createElement("table")
  table.className = "timetable-table"

  // Header
  const thead = document.createElement("thead")
  const headerRow = document.createElement("tr")
  headerRow.appendChild(document.createElement("th")) // colonne horaire vide
  weekInfo.dates.forEach(date => {
    const th = document.createElement("th")
    th.textContent = date.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric" })
    th.style.padding = "8px"
    headerRow.appendChild(th)
  })
  thead.appendChild(headerRow)
  table.appendChild(thead)

  // Body
  const tbody = document.createElement("tbody")
  TIME_SLOTS.forEach(slot => {
    const row = document.createElement("tr")

    // Horaire
    const timeCell = document.createElement("td")
    timeCell.textContent = slot.debut
    timeCell.style.fontWeight = "bold"
    timeCell.style.padding = "6px"
    row.appendChild(timeCell)

    weekInfo.dates.forEach((date, dayIndex) => {
      const cell = document.createElement("td")
      cell.style.padding = "4px"

      const courses = weekData[DAYS[dayIndex]] || []
      const course = courses.find(c => c.debut === slot.debut)
      if (course) {
        const recordings = getRecordingsForCourse(course.cours, DAYS[dayIndex], date)
        const latestRecording = recordings[0]

        const card = document.createElement("div")
        card.className = "course-card"
        if (latestRecording) {
          card.classList.add("has-audio")
          if (latestRecording.status) card.classList.add(`status-${latestRecording.status}`)
        }

        card.innerHTML = `
          <div class="course-name">${course.cours}</div>
          <div class="course-info">
            <span>📍 ${course.salle}</span>
            <span>${course.debut}-${course.fin}</span>
          </div>
          ${
            latestRecording && latestRecording.status !== "done"
              ? `<div class="course-badge processing">${getStatusLabel(latestRecording.status)}</div>`
              : ""
          }
        `

        card.addEventListener("click", () => openCourseModal(course, DAYS[dayIndex], date, recordings))
        cell.appendChild(card)
      } else {
        const empty = document.createElement("div")
        empty.className = "course-card empty-slot"
        cell.appendChild(empty)
      }

      row.appendChild(cell)
    })

    tbody.appendChild(row)
  })

  table.appendChild(tbody)
  container.appendChild(table)
}

const updateDisplay = () => {
  const weekInfo = getCurrentWeekInfo()
  document.getElementById("current-week-label").textContent = weekInfo.label
  const startDate = weekInfo.dates[0].toLocaleDateString("fr-FR", { day: "numeric", month: "short" })
  const endDate = weekInfo.dates[4].toLocaleDateString("fr-FR", { day: "numeric", month: "short" })
  document.getElementById("week-dates").textContent = `${startDate} - ${endDate}`

  updateDayNav(weekInfo)
  generateResponsiveTimetable(weekInfo)
  displayOrphanRecordings()
}


// Ajouter un listener pour redimensionnement
window.addEventListener("resize", () => {
  const weekInfo = getCurrentWeekInfo()
  generateResponsiveTimetable(weekInfo)
})

function updateDayNav(weekInfo) {
  const buttons = document.querySelectorAll(".day-btn")
  const labels = ["L", "M", "M", "J", "V"]

  buttons.forEach((btn, i) => {
    const date = weekInfo.dates[i]
    const dateStr = date.getDate()
    btn.textContent = `${labels[i]}\n${dateStr}`
    btn.style.lineHeight = "1.2"
    btn.classList.toggle("active", i === currentDayIndex)
  })
}

function generateTimetable(weekInfo) {
  const container = document.getElementById("timetable-container")
  container.innerHTML = ""

  const weekData = TIMETABLE_DATA[weekInfo.type]

  // Créer un tableau unique
  const table = document.createElement("table")
  table.className = "timetable-table" // tu peux ajouter un peu de CSS si besoin

  // Header avec les jours
  const thead = document.createElement("thead")
  const headerRow = document.createElement("tr")
  headerRow.appendChild(document.createElement("th")) // colonne vide pour horaires
  weekInfo.dates.forEach((date) => {
    const th = document.createElement("th")
    th.textContent = date.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric" })
    th.style.padding = "8px"
    headerRow.appendChild(th)
  })
  thead.appendChild(headerRow)
  table.appendChild(thead)

  // Body
  const tbody = document.createElement("tbody")

  TIME_SLOTS.forEach((slot) => {
    const row = document.createElement("tr")

    // Colonne horaire
    const timeCell = document.createElement("td")
    timeCell.textContent = slot.debut
    timeCell.style.padding = "6px"
    timeCell.style.fontWeight = "bold"
    row.appendChild(timeCell)

    // Colonne pour chaque jour
    weekInfo.dates.forEach((date, dayIndex) => {
      const cell = document.createElement("td")
      cell.style.padding = "4px"

      const courses = weekData[DAYS[dayIndex]] || []
      const course = courses.find((c) => c.debut === slot.debut)
      if (course) {
        const recordings = getRecordingsForCourse(course.cours, DAYS[dayIndex], date)
        const latestRecording = recordings[0]

        // On reprend tes classes pour conserver le style
        const card = document.createElement("div")
        card.className = "course-card"
        if (latestRecording) {
          card.classList.add("has-audio")
          if (latestRecording.status) card.classList.add(`status-${latestRecording.status}`)
        }

        card.innerHTML = `
          <div class="course-name">${course.cours}</div>
          <div class="course-info">
            <span>📍 ${course.salle}</span>
            <span>${course.debut}-${course.fin}</span>
          </div>
          ${
            latestRecording && latestRecording.status !== "done"
              ? `<div class="course-badge processing">${getStatusLabel(latestRecording.status)}</div>`
              : ""
          }
        `

        card.addEventListener("click", () => openCourseModal(course, DAYS[dayIndex], date, recordings))
        cell.appendChild(card)
      } else {
        const empty = document.createElement("div")
        empty.className = "course-card empty-slot"
        empty.textContent = ""
        cell.appendChild(empty)
      }

      row.appendChild(cell)
    })

    tbody.appendChild(row)
  })

  table.appendChild(tbody)
  container.appendChild(table)
}

function createCourseCard(course, day, date, recordings) {
  const card = document.createElement("div")
  card.className = "course-card"

  const latestRecording = recordings[0]
  if (latestRecording) {
    card.classList.add("has-audio")
    if (latestRecording.status) card.classList.add(`status-${latestRecording.status}`)
  }

  card.innerHTML = `
    <div class="course-name">${course.cours}</div>
    <div class="course-info">
      <span>📍 ${course.salle}</span>
      <span>${course.debut}-${course.fin}</span>
    </div>
    ${
      latestRecording && latestRecording.status !== "done"
        ? `<div class="course-badge processing">${getStatusLabel(latestRecording.status)}</div>`
        : ""
    }
  `

  card.addEventListener("click", () => openCourseModal(course, day, date, recordings))
  return card
}

// =====================================================
// LISTENER POUR REDIMENSIONNEMENT
// =====================================================

window.addEventListener("resize", () => {
  const weekInfo = getCurrentWeekInfo()
  generateResponsiveTimetable(weekInfo)
})

// =====================================================
// RECORDINGS
// =====================================================

async function loadAudioRecordings() {
  if (!supabase) return

  try {
    const { data, error } = await supabase
      .from(SUPABASE_CONFIG.tableName)
      .select("*")
      .order("created_at", { ascending: false })

    if (error) throw error

    const allRecordings = data || []
    audioRecordings = allRecordings.filter((rec) => rec.course_name || (rec.metadata && rec.metadata.course))
    orphanRecordings = allRecordings.filter((rec) => !rec.course_name && !(rec.metadata && rec.metadata.course))

    updateDisplay()
  } catch (error) {
    console.error("Erreur chargement:", error)
  }
}

function loadDemoData() {
  orphanRecordings = [
    {
      id: 1,
      audio_url: "#",
      transcription_text: "Exemple de transcription pour un enregistrement non associé.",
      resume_text:
        "**Résumé principal**\n\n1. Premier point important\n2. Deuxième élément\n\n**Conclusion:**\nTexte de conclusion",
      status: "done",
      created_at: new Date().toISOString(),
    },
  ]
}

function getRecordingsForCourse(courseName, day, date) {
  return audioRecordings
    .filter((rec) => {
      const matchCourse = rec.course_name === courseName || (rec.metadata && rec.metadata.course === courseName)
      return matchCourse
    })
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
}

// =====================================================
// MODAL
// =====================================================

function openCourseModal(course, day, date, recordings) {
  const modal = document.getElementById("modal")

  document.getElementById("modal-title").textContent = course.cours
  document.getElementById("modal-time").textContent = `🕐 ${course.debut} - ${course.fin}`
  document.getElementById("modal-prof").textContent = `👨‍🏫 ${course.prof}`
  document.getElementById("modal-salle").textContent = `📍 ${course.salle}`

  if (recordings.length > 0) {
    loadRecording(recordings[0])

    if (recordings.length > 1) {
      displayRecordingsList(recordings)
    } else {
      document.getElementById("recordings-list").classList.add("hidden")
    }
  } else {
    clearModal()
  }

  modal.classList.add("active")
  document.body.style.overflow = "hidden"
}

function loadRecording(recording) {
  currentRecording = recording

  // Show progress or audio
  const progressSection = document.getElementById("progress-section")
  const audioSection = document.getElementById("audio-section")
  const searchBar = document.getElementById("search-bar")

  if (recording.status !== "done") {
    progressSection.classList.remove("hidden")
    audioSection.classList.add("hidden")
    searchBar.classList.add("hidden")

    const progress = getProgressPercentage(recording.status)
    document.getElementById("progress-fill").style.width = `${progress}%`
    document.getElementById("progress-label").textContent = getStatusLabel(recording.status)
  } else {
    progressSection.classList.add("hidden")
    audioSection.classList.remove("hidden")

    if (recording.audio_url) {
      audioPlayer.src = recording.audio_url
    }

    if (recording.transcription_text) {
      searchBar.classList.remove("hidden")
    } else {
      searchBar.classList.add("hidden")
    }
  }

  displayTranscription(recording.transcription_text, recording.transcription_segments)
  displayResume(recording.resume_text)
}

function displayTranscription(text, segments) {
  const container = document.getElementById("transcription-text")

  if (!text && currentRecording.resume_text) {
    container.innerHTML = '<p class="placeholder">Transcription indisponible</p>'
    return
  }

  if (!text) {
    container.innerHTML = '<p class="placeholder">Transcription en cours...</p>'
    return
  }

  if (segments && segments.length > 0) {
    container.innerHTML = ""
    segments.forEach((seg) => {
      const words = seg.text.split(" ")
      const duration = (seg.end - seg.start) / words.length

      words.forEach((word, i) => {
        const span = document.createElement("span")
        span.className = "word"
        span.dataset.start = seg.start + i * duration
        span.textContent = word
        span.addEventListener("click", () => {
          audioPlayer.currentTime = Number.parseFloat(span.dataset.start)
          audioPlayer.play()
          container.querySelectorAll(".word").forEach((w) => w.classList.remove("active"))
          span.classList.add("active")
        })
        container.appendChild(span)
        container.appendChild(document.createTextNode(" "))
      })
    })
  } else {
    container.textContent = text
  }
}

function displayResume(text) {
  const container = document.getElementById("resume-text")

  if (!text && currentRecording.transcription_text) {
    container.innerHTML = '<p class="placeholder">Résumé en cours...</p>'
    return
  }

  if (!text) {
    container.innerHTML = '<p class="placeholder">Aucun résumé disponible</p>'
    return
  }

  const formatted = text
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*\*(.+?):\*\*/g, "<strong>$1:</strong><br>")
    .replace(/(\d+)\./g, "<br>$1.")
    .replace(/^<br>/, "")

  container.innerHTML = formatted
}

function displayRecordingsList(recordings) {
  const list = document.getElementById("recordings-list")
  list.classList.remove("hidden")

  list.innerHTML =
    "<h4>Autres enregistrements</h4>" +
    recordings
      .map(
        (rec, i) => `
      <div class="recording-item ${i === 0 ? "active" : ""}" data-id="${rec.id}">
        <div class="recording-icon">🎙️</div>
        <div class="recording-info">
          <div class="recording-date">${formatDate(rec.created_at)}</div>
          <div class="recording-status">${getStatusLabel(rec.status)}</div>
        </div>
      </div>
    `,
      )
      .join("")

  list.querySelectorAll(".recording-item").forEach((item) => {
    item.addEventListener("click", () => {
      const rec = recordings.find((r) => r.id == item.dataset.id)
      if (rec) {
        list.querySelectorAll(".recording-item").forEach((i) => i.classList.remove("active"))
        item.classList.add("active")
        loadRecording(rec)
      }
    })
  })
}

function clearModal() {
  document.getElementById("progress-section").classList.add("hidden")
  document.getElementById("audio-section").classList.add("hidden")
  document.getElementById("search-bar").classList.add("hidden")
  document.getElementById("recordings-list").classList.add("hidden")
  document.getElementById("transcription-text").innerHTML = '<p class="placeholder">Aucun enregistrement</p>'
  document.getElementById("resume-text").innerHTML = '<p class="placeholder">Aucun enregistrement</p>'
}

function closeModal() {
  document.getElementById("modal").classList.remove("active")
  document.body.style.overflow = ""
  if (audioPlayer) audioPlayer.pause()
  clearSearch()
}

// =====================================================
// SEARCH
// =====================================================

function setupSearch() {
  const input = document.getElementById("search-input")
  const clear = document.getElementById("search-clear")

  input.addEventListener("input", (e) => {
    const query = e.target.value.toLowerCase()
    searchInTranscription(query)
  })

  clear.addEventListener("click", clearSearch)
}

function searchInTranscription(query) {
  const words = document.querySelectorAll("#transcription-text .word")

  words.forEach((word) => {
    word.classList.remove("highlight")
    if (query && word.textContent.toLowerCase().includes(query)) {
      word.classList.add("highlight")
    }
  })
}

function clearSearch() {
  document.getElementById("search-input").value = ""
  document.querySelectorAll(".word").forEach((w) => w.classList.remove("highlight"))
}

// =====================================================
// ORPHAN RECORDINGS
// =====================================================

function displayOrphanRecordings() {
  const grid = document.getElementById("orphan-grid")

  if (orphanRecordings.length === 0) {
    grid.innerHTML = '<p class="placeholder">Aucun enregistrement</p>'
    return
  }

  grid.innerHTML = orphanRecordings
    .map(
      (rec) => `
    <div class="orphan-card status-${rec.status}" data-id="${rec.id}">
      <div class="orphan-header">
        <div class="orphan-title">🎙️ Enregistrement #${rec.id}</div>
        <div class="orphan-status ${rec.status}">${getStatusLabel(rec.status)}</div>
      </div>
      <div class="orphan-date">${formatDate(rec.created_at)}</div>
      <div class="orphan-preview">${rec.transcription_text || "En traitement..."}</div>
    </div>
  `,
    )
    .join("")

  grid.querySelectorAll(".orphan-card").forEach((card) => {
    card.addEventListener("click", () => {
      const rec = orphanRecordings.find((r) => r.id == card.dataset.id)
      if (rec) openOrphanModal(rec)
    })
  })
}

function openOrphanModal(recording) {
  // Reuse course modal for orphans
  const modal = document.getElementById("modal")

  document.getElementById("modal-title").textContent = `Enregistrement #${recording.id}`
  document.getElementById("modal-time").textContent = ""
  document.getElementById("modal-prof").textContent = formatDate(recording.created_at)
  document.getElementById("modal-salle").textContent = ""

  loadRecording(recording)
  document.getElementById("recordings-list").classList.add("hidden")

  modal.classList.add("active")
  document.body.style.overflow = "hidden"
}

// =====================================================
// EVENT LISTENERS
// =====================================================

function setupEventListeners() {
  // Week navigation
  document.getElementById("prev-week").addEventListener("click", () => {
    currentWeekOffset--
    updateDisplay()
  })

  document.getElementById("next-week").addEventListener("click", () => {
    currentWeekOffset++
    updateDisplay()
  })

  // Day navigation
  document.querySelectorAll(".day-btn").forEach((btn, i) => {
    btn.addEventListener("click", () => {
      currentDayIndex = i
      document.querySelectorAll(".day-btn").forEach((b) => b.classList.remove("active"))
      btn.classList.add("active")

      document.querySelectorAll(".day-card").forEach((card, j) => {
        card.classList.toggle("active", j === i)
      })
    })
  })

  // Modal close
  document.getElementById("modal-close").addEventListener("click", closeModal)
  document.getElementById("modal").addEventListener("click", (e) => {
    if (e.target.id === "modal") closeModal()
  })

  // Tabs
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const tab = btn.dataset.tab
      document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"))
      document.querySelectorAll(".tab-pane").forEach((p) => p.classList.remove("active"))
      btn.classList.add("active")
      document.getElementById(`tab-${tab}`).classList.add("active")
    })
  })

  setupSearch()

  // Audio timeupdate for active word
  if (audioPlayer) {
    audioPlayer.addEventListener("timeupdate", updateActiveWord)
  }
}

function updateActiveWord() {
  if (!audioPlayer || !currentRecording?.transcription_segments) return

  const currentTime = audioPlayer.currentTime
  const words = document.querySelectorAll("#transcription-text .word")

  words.forEach((word) => {
    const start = Number.parseFloat(word.dataset.start)
    const next = word.nextElementSibling
    const end = next && next.classList.contains("word") ? Number.parseFloat(next.dataset.start) : start + 1

    if (currentTime >= start && currentTime < end) {
      words.forEach((w) => w.classList.remove("active"))
      word.classList.add("active")
      word.scrollIntoView({ behavior: "smooth", block: "center" })
    }
  })
}

// =====================================================
// UTILITIES
// =====================================================

function getStatusLabel(status) {
  const labels = {
    detected: "Détecté",
    transcribing: "Transcription...",
    summarizing: "Résumé...",
    done: "Terminé",
    error: "Erreur",
  }
  return labels[status] || status
}

function getProgressPercentage(status) {
  const progress = {
    detected: 25,
    transcribing: 50,
    summarizing: 75,
    done: 100,
    error: 0,
  }
  return progress[status] || 0
}

function formatDate(dateString) {
  if (!dateString) return "Date inconnue"
  const date = new Date(dateString)
  return date.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  })
}

// Cleanup on page unload
window.addEventListener("beforeunload", () => {
  if (refreshInterval) clearInterval(refreshInterval)
})
