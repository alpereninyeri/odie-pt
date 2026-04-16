/**
 * Hesaplama motoru — her yeni antrenman sonrası state'i yeniden hesaplar.
 * store.js tarafından çağrılır.
 */

// Egzersiz → kas grubu eşleme (muscleBalance güncellemesi için)
const EXERCISE_MUSCLES = {
  'Bench Press':     ['Göğüs', 'Triceps', 'Omuz'],
  'Incline Press':   ['Göğüs', 'Omuz'],
  'Dips':            ['Göğüs', 'Triceps'],
  'Push-Up':         ['Göğüs', 'Triceps'],
  'OHP':             ['Omuz', 'Triceps'],
  'Lateral Raise':   ['Omuz'],
  'Arnold Press':    ['Omuz'],
  'Face Pull':       ['Üst Sırt', 'Omuz'],
  'Pull-Up':         ['Lat', 'Biseps', 'Üst Sırt'],
  'Muscle-Up':       ['Lat', 'Biseps', 'Göğüs'],
  'Barbell Row':     ['Üst Sırt', 'Biseps', 'Lat'],
  'Cable Row':       ['Üst Sırt', 'Biseps'],
  'Dead Hang':       ['Lat', 'Biseps'],
  'Curl':            ['Biseps'],
  'Hammer Curl':     ['Biseps'],
  'Tricep Extension':['Triceps'],
  'Squat':           ['Bacak (Parkour)', 'Kalf'],
  'Jump Squat':      ['Bacak (Parkour)'],
  'Lunge':           ['Bacak (Parkour)'],
  'Calf Raise':      ['Kalf'],
  'Hollow Body':     ['Core'],
  'L-Sit':           ['Core'],
  'Plank':           ['Core'],
  'Dragon Flag':     ['Core'],
  'Ab Wheel':        ['Core'],
  'Leg Raise':       ['Core'],
}

/**
 * Ana hesaplama — yeni antrenman listesine göre tüm toplam değerleri güncelle.
 * state nesnesini doğrudan mutate eder (store.js zaten immutable değil).
 */
export function recalculate(state) {
  const workouts = state.workouts || []

  // Toplam istatistikler
  const totalSets    = workouts.reduce((s, w) => s + (w.sets || 0), 0)
  const totalVolumeKg = workouts.reduce((s, w) => s + (w.volumeKg || 0), 0)
  const totalMinutes  = workouts.reduce((s, w) => s + (w.durationMin || 0), 0)
  const sessions      = workouts.length

  state.profile.sessions     = sessions
  state.profile.totalSets    = totalSets
  state.profile.totalVolumeKg = totalVolumeKg
  state.profile.totalMinutes  = totalMinutes
  state.profile.totalVolume   = _formatVolume(totalVolumeKg)
  state.profile.totalTime     = _formatTime(totalMinutes)

  // XP: store.addWorkout() zaten `xp.current += xpEarned` ile doğru tutar.
  // Burada EZMEYİZ — sadece level ve max'ı güncelle.
  const xpPerLevel = 2000
  const levelBase  = 4
  const totalEarned = workouts.reduce((s, w) => s + (w.xpEarned || 0), 0)
  const newLevel = levelBase + Math.floor(totalEarned / xpPerLevel)
  state.profile.level = Math.max(state.profile.level || levelBase, newLevel)
  state.profile.xp.max = state.profile.level * xpPerLevel

  // Kas dengesi güncelle
  _updateMuscleBalance(state)

  // Stat güncellemesi (basit formüller)
  _updateStats(state)
}

function _updateMuscleBalance(state) {
  // Başlangıç değerleri (profile.js seed)
  const baseBalance = {
    'Omuz':           198.5,
    'Göğüs':          169.5,
    'Triceps':        163.5,
    'Biseps':         156,
    'Üst Sırt':       128.5,
    'Lat':            108.5,
    'Bacak (Parkour)': 45,
    'Kalf':            36,
    'Core':             0,
  }

  // Yeni antrenmanlardan gelen set sayıları.
  // ID 'w' + timestamp formatı = store.addWorkout() ile eklenen.
  // Supabase sync'te de aynı format kullanılıyor (_normalizeWorkout'a bak).
  // baseBalance = seed/tarihsel değerler; delta = uygulama üzerinden eklenenler.
  const newWorkouts = state.workouts.filter(w => {
    if (!w.id) return false
    const idStr = String(w.id)
    // 'w123' formatı (mock) veya 'w1744...' formatı (yeni)
    if (idStr.startsWith('w') && !isNaN(idStr.slice(1))) return true
    // Supabase UUID'leri için: exercises var ama tarihsel seed'de değil
    // Bunları da dahil et (delta biraz yüksek olabilir ama 0'dan iyidir)
    return false
  })
  const delta = {}
  newWorkouts.forEach(w => {
    ;(w.exercises || []).forEach(ex => {
      const muscles = _findMuscles(ex.name)
      const exSets = (ex.sets || []).length
      muscles.forEach(m => { delta[m] = (delta[m] || 0) + exSets })
    })
  })

  // muscleBalance array'ini güncelle
  if (state.muscleBalance) {
    state.muscleBalance = state.muscleBalance.map(m => ({
      ...m,
      sets: (baseBalance[m.label] || 0) + (delta[m.label] || 0),
    }))
  }
}

function _updateStats(state) {
  if (!state.stats || !state.workouts) return
  const workouts = state.workouts

  // Core egzersizleri olan seans sayısı
  const coreSessions = workouts.filter(w =>
    (w.exercises || []).some(e => _findMuscles(e.name).includes('Core'))
  ).length

  // Parkour + Akrobasi seans sayısı
  const parkourSessions = workouts.filter(w =>
    w.type === 'Parkour' || w.type === 'Akrobasi'
  ).length

  // Push seans sayısı
  const pushSessions = workouts.filter(w => w.type === 'Push').length

  // Ortalama seans süresi
  const avgDuration = workouts.length > 0
    ? workouts.reduce((s, w) => s + (w.durationMin || 0), 0) / workouts.length
    : 0

  // Stat'ları seed değerlerinden başlatıp deltayı ekle
  const seed = { str: 78, agi: 77, end: 73, dex: 68, con: 12, sta: 63 }
  const newPushBeyondSeed  = Math.max(0, pushSessions - 50)
  const newParkourBeyondSeed = Math.max(0, parkourSessions - 5)
  const newCoreBeyondSeed  = Math.max(0, coreSessions - 0)

  state.stats = state.stats.map(s => {
    let newVal = seed[s.key]
    switch (s.key) {
      case 'str': newVal = seed.str + Math.floor(newPushBeyondSeed  * 0.5); break
      case 'agi': newVal = seed.agi + Math.floor(newParkourBeyondSeed * 2); break
      case 'con': newVal = seed.con + Math.min(40, newCoreBeyondSeed * 4);  break
      case 'end': newVal = seed.end + Math.floor(Math.max(0, avgDuration - 64) * 0.1); break
    }
    return { ...s, val: Math.min(100, newVal) }
  })
}

function _findMuscles(exerciseName) {
  const lower = exerciseName.toLowerCase()
  for (const [key, muscles] of Object.entries(EXERCISE_MUSCLES)) {
    if (lower.includes(key.toLowerCase())) return muscles
  }
  // Tip bazlı fallback
  if (lower.includes('squat') || lower.includes('leg')) return ['Bacak (Parkour)']
  if (lower.includes('core') || lower.includes('ab') || lower.includes('hollow')) return ['Core']
  return []
}

function _formatVolume(kg) {
  if (kg >= 1000) return `${Math.round(kg / 1000)}k kg`
  return `${kg} kg`
}

function _formatTime(minutes) {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${h}h ${m}min`
}
