// =====================================================
// APPLICATION PRINCIPALE
// =====================================================

// État de l'application
let currentWeek = "semaine_A"
let audioRecordings = []
let orphanRecordings = []
let audioPlayer = null
let orphanAudioPlayer = null
let currentRecording = null
let currentOrphanRecording = null

function isSupabaseConfigured() {
  return SUPABASE_CONFIG.url && SUPABASE_CONFIG.apiKey
}

// =====================================================
// INITIALISATION
// =====================================================

document.addEventListener("DOMContentLoaded", async () => {
  // Initialiser les lecteurs audio
  audioPlayer = document.getElementById("audio-player")
  orphanAudioPlayer = document.getElementById("orphan-audio-player")

  // Initialiser Supabase si configuré
  if (isSupabaseConfigured()) {
    try {
      supabase = window.supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.apiKey)
      await loadAudioRecordings()
    } catch (error) {
      console.error("Erreur connexion Supabase:", error)
    }
  } else {
    loadDemoOrphanRecordings()
  }

  // Générer l'emploi du temps
  generateTimetable()
  populateMatiereFilter()
  displayOrphanRecordings()

  // Event listeners
  setupEventListeners()

  // Masquer le loader
  document.getElementById("loader").classList.add("hidden")
})

// =====================================================
// GESTION DE L'EMPLOI DU TEMPS
// =====================================================

function generateTimetable() {
  const timetableEl = document.getElementById("timetable")
  const weekData = TIMETABLE_DATA[currentWeek]

  // Vider le contenu
  timetableEl.innerHTML = ""

  // Créer l'en-tête
  timetableEl.innerHTML = `
        <div class="timetable-header">Heures</div>
        ${DAYS_DISPLAY.map((day) => `<div class="timetable-header">${day}</div>`).join("")}
    `

  // Créer les lignes pour chaque créneau horaire
  TIME_SLOTS.forEach((slot, rowIndex) => {
    // Cellule des heures
    const timeCell = document.createElement("div")
    timeCell.className = "time-slot"
    timeCell.innerHTML = `${slot.debut}<br>${slot.fin}`
    timetableEl.appendChild(timeCell)

    // Cellules pour chaque jour
    DAYS.forEach((day) => {
      const cell = document.createElement("div")
      cell.className = "course-cell"
      cell.dataset.day = day
      cell.dataset.slot = rowIndex

      // Trouver les cours qui commencent à ce créneau
      const dayCourses = weekData[day] || []
      const course = dayCourses.find((c) => c.debut === slot.debut)

      if (course) {
        const card = createCourseCard(course, day, rowIndex)
        cell.appendChild(card)
      }

      timetableEl.appendChild(cell)
    })
  })
}

function createCourseCard(course, day, slotIndex) {
  const card = document.createElement("div")
  card.className = "course-card"

  // Calculer la hauteur en fonction de la durée
  const duration = calculateDuration(course.debut, course.fin)
  const height = (duration / 60) * 60 - 4 // 60px par heure, moins les marges

  // Calculer la position top
  const slotStart = TIME_SLOTS[slotIndex]
  const offset = calculateDuration(slotStart.debut, course.debut)
  const top = (offset / 60) * 60

  card.style.top = `${top + 2}px`
  card.style.height = `${height}px`

  // Vérifier s'il y a des enregistrements pour ce cours
  const recordings = getRecordingsForCourse(course.cours, day)
  const status = recordings.length > 0 ? recordings[0].status : null

  if (status) {
    card.classList.add(`status-${status}`)
  }

  card.innerHTML = `
        <div class="course-name">${course.cours}</div>
        <div class="course-info">${course.salle}</div>
        ${recordings.length > 0 ? '<div class="course-indicator has-audio"></div>' : ""}
    `

  // Event click
  card.addEventListener("click", () => openCourseModal(course, day, recordings))

  return card
}

function calculateDuration(start, end) {
  const [startH, startM] = start.split(":").map(Number)
  const [endH, endM] = end.split(":").map(Number)
  return endH * 60 + endM - (startH * 60 + startM)
}

// =====================================================
// GESTION DES ENREGISTREMENTS SUPABASE
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

    // Rafraîchir l'affichage
    generateTimetable()
    displayOrphanRecordings()
  } catch (error) {
    console.error("Erreur chargement enregistrements:", error)
  }
}

function loadDemoOrphanRecordings() {
  orphanRecordings = [
    {
      id: 1,
      audio_source: "demo_audio_1.mp3",
      transcription_text:
        "Ceci est un exemple de transcription pour un enregistrement qui n'est pas associé à un cours particulier. Il peut s'agir d'une réunion, d'une conférence ou d'un autre type d'événement audio que vous avez enregistré.",
      resume_text:
        "Résumé de l'enregistrement: discussion générale sur divers sujets académiques et organisation personnelle.",
      status: "done",
      created_at: "2025-01-10T14:30:00",
      timestamps: [
        { word: "Ceci", start: 0.0 },
        { word: "est", start: 0.3 },
        { word: "un", start: 0.5 },
        { word: "exemple", start: 0.7 },
        { word: "de", start: 1.1 },
        { word: "transcription", start: 1.3 },
      ],
    },
    {
      id: 2,
      audio_source: "demo_audio_2.mp3",
      transcription_text: "Deuxième enregistrement de démonstration avec une transcription plus courte.",
      resume_text: "Notes rapides prises lors d'une session d'étude.",
      status: "transcribing",
      created_at: "2025-01-12T09:15:00",
      timestamps: [],
    },
    {
      id: 3,
      audio_source: "demo_audio_3.mp3",
      transcription_text: null,
      resume_text: null,
      status: "detected",
      created_at: "2025-01-14T16:45:00",
      timestamps: [],
    },
    {
      id: 4,
      audio_source: "demo_audio_4.mp3",
      transcription_text:
        "Enregistrement d'une conférence externe sur les nouvelles technologies éducatives et leur impact sur l'apprentissage moderne. Les intervenants ont discuté de l'importance de l'intelligence artificielle dans l'éducation.",
      resume_text:
        "Conférence sur les technologies éducatives: IA, apprentissage adaptatif, et outils numériques pour l'enseignement.",
      status: "done",
      created_at: "2025-01-08T11:00:00",
      timestamps: [
        { word: "Enregistrement", start: 0.0 },
        { word: "d'une", start: 0.8 },
        { word: "conférence", start: 1.2 },
        { word: "externe", start: 1.9 },
      ],
    },
    {
      id: 5,
      audio_source: "demo_audio_5.mp3",
      transcription_text: "Erreur lors du traitement de cet enregistrement.",
      resume_text: null,
      status: "error",
      created_at: "2025-01-11T13:20:00",
      timestamps: [],
    },
  ]
}

function getRecordingsForCourse(courseName, day) {
  // Filtrer les enregistrements par nom de cours
  return audioRecordings.filter((rec) => {
    return rec.course_name === courseName || (rec.metadata && rec.metadata.course === courseName)
  })
}

async function getAudioUrl(audioSource) {
  if (!supabase || !audioSource) return null

  try {
    const { data } = supabase.storage.from(SUPABASE_CONFIG.storageBucket).getPublicUrl(audioSource)

    return data?.publicUrl
  } catch (error) {
    console.error("Erreur récupération URL audio:", error)
    return null
  }
}

// =====================================================
// ENREGISTREMENTS ORPHELINS (SANS COURS)
// =====================================================

function displayOrphanRecordings() {
  const grid = document.getElementById("orphan-recordings-grid")
  const filterStatus = document.getElementById("orphan-filter-status")?.value || ""

  let filteredRecordings = orphanRecordings
  if (filterStatus) {
    filteredRecordings = orphanRecordings.filter((rec) => rec.status === filterStatus)
  }

  if (filteredRecordings.length === 0) {
    grid.innerHTML = '<div class="orphan-empty"><p>Aucun enregistrement orphelin</p></div>'
    return
  }

  // Créer les cartes dynamiquement et ajouter directement les listeners
  grid.innerHTML = ""
  filteredRecordings.forEach((rec) => {
    const cardHtml = createOrphanCard(rec)
    const temp = document.createElement("div")
    temp.innerHTML = cardHtml
    const cardEl = temp.firstElementChild

    cardEl.addEventListener("click", () => openOrphanModal(rec))
    grid.appendChild(cardEl)
  })
}

function createOrphanCard(recording) {
  const preview = recording.transcription_text
    ? recording.transcription_text.substring(0, 150) + (recording.transcription_text.length > 150 ? "..." : "")
    : "Aucune transcription disponible"

  return `
    <div class="orphan-card status-${recording.status}" data-id="${recording.id}">
      <div class="orphan-card-header">
        <div class="orphan-card-icon">🎙️</div>
        <span class="orphan-card-status ${recording.status}">${getStatusLabel(recording.status)}</span>
      </div>
      <div class="orphan-card-title">Enregistrement #${recording.id}</div>
      <div class="orphan-card-date">${formatDate(recording.created_at)}</div>
      <div class="orphan-card-preview">${preview}</div>
      <div class="orphan-card-footer">
        <div class="orphan-card-meta">
          <span>🎵</span>
          <span>Audio disponible</span>
        </div>
        ${recording.resume_text ? '<div class="orphan-card-meta"><span>📝</span><span>Résumé</span></div>' : ""}
      </div>
    </div>
  `
}


async function openOrphanModal(recording) {
  currentOrphanRecording = recording

  const modal = document.getElementById("orphan-modal")
  modal.querySelector("#orphan-modal-title").textContent = `Enregistrement #${recording.id}`
  modal.querySelector("#orphan-modal-date").textContent = `📅 ${formatDate(recording.created_at)}`
  const statusEl = modal.querySelector("#orphan-audio-status")
  statusEl.textContent = getStatusLabel(recording.status)
  statusEl.className = `audio-status ${recording.status}`

  // Charger l'audio depuis la colonne audio_url
  orphanAudioPlayer.src = recording.audio_url || ""

  // Transcription cliquable
  const segments = recording.transcription_segments || []
  displayOrphanTranscription(recording.transcription_text, segments)

  // Afficher le résumé
  displayOrphanResume(recording.resume_text)

  modal.classList.add("active")
}

// Transcription cliquable
function displayOrphanTranscription(text, segments) {
  const container = document.getElementById("orphan-transcription-text")
  container.innerHTML = ""

  if (!text) {
    container.innerHTML = '<p class="placeholder">Aucune transcription disponible</p>'
    return
  }

  // Utiliser les segments pour le mapping start/end
  if (segments && segments.length > 0) {
    segments.forEach((seg) => {
      // On peut splitter le texte en mots
      const words = seg.text.split(" ")
      let offset = seg.start

      words.forEach((word) => {
        const span = document.createElement("span")
        span.className = "word"
        span.dataset.start = offset
        span.textContent = word
        span.addEventListener("click", () => {
          orphanAudioPlayer.currentTime = parseFloat(span.dataset.start)
          orphanAudioPlayer.play()

          // highlight
          container.querySelectorAll(".word").forEach((w) => w.classList.remove("active"))
          span.classList.add("active")
        })
        container.appendChild(span)
        container.appendChild(document.createTextNode(" "))

        // Estimation simple du temps pour chaque mot
        const wordDuration = (seg.end - seg.start) / words.length
        offset += wordDuration
      })
    })
  } else {
    container.textContent = text
  }
}

function displayOrphanResume(text) {
  const container = document.getElementById("orphan-resume-text")
  container.innerHTML = text ? `<p>${text}</p>` : '<p class="placeholder">Aucun résumé disponible</p>'
}
function closeOrphanModal() {
  document.getElementById("orphan-modal").classList.remove("active")
  if (orphanAudioPlayer) {
    orphanAudioPlayer.pause()
  }
}

// =====================================================
// MODAL ET DÉTAILS DU COURS
// =====================================================

async function openCourseModal(course, day, recordings) {
  const modal = document.getElementById("modal")
  const modalTitle = document.getElementById("modal-title")
  const modalProf = document.getElementById("modal-prof")
  const modalSalle = document.getElementById("modal-salle")
  const modalTime = document.getElementById("modal-time")

  // Mettre à jour les infos du modal
  modalTitle.textContent = course.cours
  modalProf.textContent = `👨‍🏫 ${course.prof}`
  modalSalle.textContent = `📍 ${course.salle}`
  modalTime.textContent = `🕐 ${course.debut} - ${course.fin}`

  // Afficher les enregistrements
  displayRecordings(recordings)

  // Si un enregistrement existe, le charger
  if (recordings.length > 0) {
    await loadRecording(recordings[0])
  } else {
    clearAudioSection()
  }

  // Afficher le modal
  modal.classList.add("active")
}

function displayRecordings(recordings) {
  const container = document.getElementById("recordings-container")

  if (recordings.length === 0) {
    container.innerHTML = '<p class="placeholder">Aucun enregistrement pour ce cours</p>'
    return
  }

  container.innerHTML = recordings
    .map(
      (rec, index) => `
        <div class="recording-item ${index === 0 ? "active" : ""}" data-id="${rec.id}">
            <div class="recording-icon">🎙️</div>
            <div class="recording-details">
                <div class="recording-date">${formatDate(rec.created_at)}</div>
                <div class="recording-status">${getStatusLabel(rec.status)}</div>
            </div>
        </div>
    `,
    )
    .join("")

  // Event listeners pour les enregistrements
  container.querySelectorAll(".recording-item").forEach((item) => {
    item.addEventListener("click", async () => {
      const rec = recordings.find((r) => r.id == item.dataset.id)
      if (rec) {
        container.querySelectorAll(".recording-item").forEach((i) => i.classList.remove("active"))
        item.classList.add("active")
        await loadRecording(rec)
      }
    })
  })
}

async function loadRecording(recording) {
  currentRecording = recording

  // Mettre à jour le statut
  const statusEl = document.getElementById("audio-status")
  statusEl.textContent = getStatusLabel(recording.status)
  statusEl.className = `audio-status ${recording.status}`

  // Charger l'audio
  if (recording.audio_source) {
    const audioUrl = await getAudioUrl(recording.audio_source)
    if (audioUrl) {
      audioPlayer.src = audioUrl
    }
  }

  // Afficher la transcription
  displayTranscription(recording.transcription_text, recording.timestamps)

  // Afficher le résumé
  displayResume(recording.resume_text)
}

function displayTranscription(text, timestamps) {
  const container = document.getElementById("transcription-text")

  if (!text) {
    container.innerHTML = '<p class="placeholder">Aucune transcription disponible</p>'
    return
  }

  // Si on a des timestamps, rendre les mots cliquables
  if (timestamps && Array.isArray(timestamps)) {
    const wordsHtml = timestamps
      .map((item, index) => {
        const word = item.word || item.text || ""
        const start = item.start || item.timestamp || 0
        return `<span class="word" data-start="${start}" data-index="${index}">${word}</span>`
      })
      .join(" ")

    container.innerHTML = wordsHtml

    // Event listeners pour les mots
    container.querySelectorAll(".word").forEach((wordEl) => {
      wordEl.addEventListener("click", () => {
        const startTime = Number.parseFloat(wordEl.dataset.start)
        if (audioPlayer && !isNaN(startTime)) {
          audioPlayer.currentTime = startTime
          audioPlayer.play()

          // Highlight le mot actif
          container.querySelectorAll(".word").forEach((w) => w.classList.remove("active"))
          wordEl.classList.add("active")
        }
      })
    })
  } else {
    container.innerHTML = `<p>${text}</p>`
  }
}

function displayResume(text) {
  const container = document.getElementById("resume-text")

  if (!text) {
    container.innerHTML = '<p class="placeholder">Aucun résumé disponible</p>'
    return
  }

  container.innerHTML = `<p>${text}</p>`
}

function clearAudioSection() {
  document.getElementById("audio-status").textContent = ""
  document.getElementById("audio-status").className = "audio-status"
  audioPlayer.src = ""
  document.getElementById("transcription-text").innerHTML = '<p class="placeholder">Aucune transcription disponible</p>'
  document.getElementById("resume-text").innerHTML = '<p class="placeholder">Aucun résumé disponible</p>'
}

// =====================================================
// EVENT LISTENERS
// =====================================================

function setupEventListeners() {
  // Toggle semaine A/B
  document.getElementById("btn-semaine-a").addEventListener("click", () => {
    currentWeek = "semaine_A"
    updateWeekButtons()
    generateTimetable()
  })

  document.getElementById("btn-semaine-b").addEventListener("click", () => {
    currentWeek = "semaine_B"
    updateWeekButtons()
    generateTimetable()
  })

  // Fermer le modal cours
  document.getElementById("modal-close").addEventListener("click", closeModal)
  document.getElementById("modal").addEventListener("click", (e) => {
    if (e.target.id === "modal") closeModal()
  })

  document.getElementById("orphan-modal-close").addEventListener("click", closeOrphanModal)
  document.getElementById("orphan-modal").addEventListener("click", (e) => {
    if (e.target.id === "orphan-modal") closeOrphanModal()
  })

  // Tabs modal cours
  document.querySelectorAll("#modal .tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const tabId = btn.dataset.tab

      document.querySelectorAll("#modal .tab-btn").forEach((b) => b.classList.remove("active"))
      document.querySelectorAll("#modal .tab-pane").forEach((p) => p.classList.remove("active"))

      btn.classList.add("active")
      document.getElementById(`tab-${tabId}`).classList.add("active")
    })
  })

  document.querySelectorAll("#orphan-modal .tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const tabId = btn.dataset.tab

      document.querySelectorAll("#orphan-modal .tab-btn").forEach((b) => b.classList.remove("active"))
      document.querySelectorAll("#orphan-modal .tab-pane").forEach((p) => p.classList.remove("active"))

      btn.classList.add("active")
      document.getElementById(`tab-${tabId}`).classList.add("active")
    })
  })

  // Filtres emploi du temps
  document.getElementById("filter-matiere").addEventListener("change", applyFilters)
  document.getElementById("filter-status").addEventListener("change", applyFilters)

  document.getElementById("orphan-filter-status").addEventListener("change", displayOrphanRecordings)

  // Mise à jour du mot actif pendant la lecture
  if (audioPlayer) {
    audioPlayer.addEventListener("timeupdate", updateActiveWord)
  }

  if (orphanAudioPlayer) {
    orphanAudioPlayer.addEventListener("timeupdate", updateOrphanActiveWord)
  }
}

function updateWeekButtons() {
  document.getElementById("btn-semaine-a").classList.toggle("active", currentWeek === "semaine_A")
  document.getElementById("btn-semaine-b").classList.toggle("active", currentWeek === "semaine_B")
}

function closeModal() {
  document.getElementById("modal").classList.remove("active")
  if (audioPlayer) {
    audioPlayer.pause()
  }
}

function updateActiveWord() {
  if (!audioPlayer || !currentRecording?.timestamps) return

  const currentTime = audioPlayer.currentTime
  const words = document.querySelectorAll("#transcription-text .word")

  words.forEach((word) => {
    const start = Number.parseFloat(word.dataset.start)
    const nextWord = word.nextElementSibling
    const end = nextWord ? Number.parseFloat(nextWord.dataset.start) : start + 1

    if (currentTime >= start && currentTime < end) {
      words.forEach((w) => w.classList.remove("active"))
      word.classList.add("active")
      word.scrollIntoView({ behavior: "smooth", block: "center" })
    }
  })
}

// Mettre à jour le mot actif pour les orphelins
function updateOrphanActiveWord() {
  if (!orphanAudioPlayer || !currentOrphanRecording?.timestamps) return

  const currentTime = orphanAudioPlayer.currentTime
  const words = document.querySelectorAll("#orphan-transcription-text .word")

  words.forEach((word, i) => {
    const start = Number.parseFloat(word.dataset.start)
    const end = currentOrphanRecording.timestamps[i + 1]?.start || start + 1

    if (currentTime >= start && currentTime < end) {
      words.forEach((w) => w.classList.remove("active"))
      word.classList.add("active")
      word.scrollIntoView({ behavior: "smooth", block: "center" })
    }
  })
}

// =====================================================
// FILTRES
// =====================================================

function populateMatiereFilter() {
  const select = document.getElementById("filter-matiere")
  const matieres = new Set()

  // Collecter toutes les matières
  Object.values(TIMETABLE_DATA).forEach((week) => {
    Object.values(week).forEach((day) => {
      day.forEach((course) => matieres.add(course.cours))
    })
  })

  // Ajouter les options
  Array.from(matieres)
    .sort()
    .forEach((matiere) => {
      const option = document.createElement("option")
      option.value = matiere
      option.textContent = matiere
      select.appendChild(option)
    })
}

function applyFilters() {
  const matiereFilter = document.getElementById("filter-matiere").value
  const statusFilter = document.getElementById("filter-status").value

  const cards = document.querySelectorAll(".course-card")

  cards.forEach((card) => {
    const courseName = card.querySelector(".course-name").textContent
    const hasStatusClass = statusFilter ? card.classList.contains(`status-${statusFilter}`) : true
    const matchesMatiere = matiereFilter ? courseName === matiereFilter : true

    if (matchesMatiere && hasStatusClass) {
      card.style.opacity = "1"
      card.style.pointerEvents = "auto"
    } else {
      card.style.opacity = "0.3"
      card.style.pointerEvents = "none"
    }
  })
}

// =====================================================
// UTILITAIRES
// =====================================================

function getStatusLabel(status) {
  const labels = {
    waiting: "En attente...",
    detected: "Détecté",
    transcribing: "Transcription en cours...",
    summarizing: "Résumé en cours...",
    done: "Terminé",
    error: "Erreur",
  }
  return labels[status] || status || "Inconnu"
}

function formatDate(dateString) {
  if (!dateString) return "Date inconnue"

  const date = new Date(dateString)
  return date.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}
