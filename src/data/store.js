/**
 * OdiePt Reactive Store
 * ---------------------
 * Proxy tabanlı state yönetimi. Veri kaynakları öncelik sırasıyla:
 *   1. Supabase Realtime (n8n'den gelen güncellemeler)
 *   2. localStorage cache (offline veya Supabase yoksa)
 *   3. mock-state.js (Supabase bağlantısı yoksa)
 *   4. profile.js (başlangıç seed verisi)
 */

import { profile as seedProfile } from './profile.js'
import { MOCK_STATE, XP_BASE, XP_BONUS, STREAK_TIERS } from './mock-state.js'
import {
  supabase, isMockMode,
  fetchProfile, fetchWorkouts, updateProfile, insertWorkout,
  subscribeToProfile, subscribeToWorkouts,
  fetchLatestCoachNote,
} from './supabase-client.js'
import { recalculate } from './engine.js'
import { computeStreak } from './streak-engine.js'
import { checkBadges } from './badge-engine.js'
import { computeClass, classXpMult } from './class-engine.js'
import { applySurvival } from './survival-engine.js'
import { computeVolumeTier, computeGeographyTier, estimateKm } from './epic-volume-engine.js'

const LS_KEY = 'odiept-state-v4'
const CURRENT_VERSION = 4

// ── İç state ────────────────────────────────────────────────────────────────

let _state = null
const _subscribers = new Map()  // path → Set<fn>
let _unsubSupabase = []

// ── Subscriber yönetimi ──────────────────────────────────────────────────────

function _notify(path) {
  const parts = path.split('.')
  _subscribers.forEach((fns, key) => {
    if (key === path || key === '*' || path.startsWith(key + '.')) {
      fns.forEach(fn => {
        try { fn(_get(_state, path)) } catch (e) { console.error('[store] subscriber error:', e) }
      })
    }
  })
}

function _get(obj, path) {
  return path.split('.').reduce((cur, k) => (cur != null ? cur[k] : undefined), obj)
}

function _set(obj, path, val) {
  const keys = path.split('.')
  const last = keys.pop()
  const target = keys.reduce((cur, k) => {
    if (cur[k] == null || typeof cur[k] !== 'object') cur[k] = {}
    return cur[k]
  }, obj)
  target[last] = val
}

// ── Public API ───────────────────────────────────────────────────────────────

export const store = {
  /**
   * Başlatma — önce localStorage, sonra Supabase.
   * Supabase yoksa mock-state + profile.js seed kullanılır.
   */
  async init() {
    // Eski versiyon cache'leri temizle
    try {
      ['odiept-state-v1','odiept-state-v2','odiept-state-v3'].forEach(k => localStorage.removeItem(k))
    } catch {}

    // 1. localStorage'dan oku
    const cached = _loadFromLS()

    // 2. Seed verisini hazırla (profile.js + mock-state birleşimi)
    const seed = _buildSeed()

    if (cached && cached._version === CURRENT_VERSION) {
      // localStorage daha yeni mi yoksa Supabase'den mi gelelim kontrol et
      _state = cached
    } else {
      _state = seed
    }

    // Class + Epic + Survival — init sırasında derive et
    _deriveMetaFields(_state)

    // 3. Supabase varsa senkronize et
    if (!isMockMode) {
      try {
        await this.syncFromSupabase()
      } catch (e) {
        console.warn('[store] Supabase sync failed, using cache:', e.message)
      }
      // Realtime subscription başlat
      _unsubSupabase.push(subscribeToProfile(profileRow => {
        _applySupabaseProfile(profileRow)
        _deriveMetaFields(_state)
        _saveToLS()
        _notify('*')
      }))
      _unsubSupabase.push(subscribeToWorkouts(workoutRow => {
        _state.workouts.unshift(_normalizeWorkout(workoutRow))
        _deriveMetaFields(_state)
        recalculate(_state)
        _saveToLS()
        _notify('*')
      }))
    }

    _saveToLS()
    return _state
  },

  /** dot-notation path ile değer oku */
  get(path) {
    return _get(_state, path)
  },

  /** dot-notation ile değer yaz → subscriber'ları tetikle */
  set(path, val) {
    _set(_state, path, val)
    _saveToLS()
    _notify(path)
  },

  /** Tüm state'i döndür (read-only klon kullan, mutation önlemek için) */
  getState() {
    return _state
  },

  /** Panel'lerin kullandığı profil nesnesi — profile.js shape'e uyumlu */
  getProfile() {
    if (!_state) return seedProfile
    return _mergeToProfile(_state)
  },

  /** Subscriber ekle. path wildcard olabilir: '*', 'profile', 'profile.xp' */
  subscribe(path, fn) {
    if (!_subscribers.has(path)) _subscribers.set(path, new Set())
    _subscribers.get(path).add(fn)
    return () => this.unsubscribe(path, fn)
  },

  unsubscribe(path, fn) {
    _subscribers.get(path)?.delete(fn)
  },

  /**
   * Yeni antrenman ekle.
   * - streak güncelle
   * - XP + multiplier hesapla
   * - badge kontrol et
   * - Supabase'e yaz (mock modda sadece localStorage)
   */
  async addWorkout(session) {
    const streak = computeStreak(_state.workouts, session.date)
    const multiplier = _streakMultiplier(streak.current)

    // ── Survival hesapla (class buff'ını önceden al) ────────────────────────
    const currentClass = _state.profile.classObj || computeClass(_state.workouts)
    const survivalPrev = {
      armor: _state.profile.armor ?? 100,
      fatigue: _state.profile.fatigue ?? 0,
      consecutiveHeavy: _state.profile.consecutiveHeavy ?? 0,
      injuryUntil: _state.profile.injuryUntil || null,
    }
    const survival = applySurvival(survivalPrev, session, currentClass?.passive || {})

    // ── XP hesapla ──────────────────────────────────────────────────────────
    const baseXp = XP_BASE[session.type] || XP_BASE.Custom
    const classMult = classXpMult(currentClass, session.type)
    let xpEarned = Math.round(baseXp * multiplier * classMult * survival.xpMultiplier)

    // Flat bonuslar (injured değilse)
    if (survival.status !== 'injured') {
      if (session.hasPr)              xpEarned += XP_BONUS.newPr
      if (_hasCoreExercise(session))  xpEarned += XP_BONUS.coreAdded
      if (_isDoubleSession(_state.workouts, session.date)) xpEarned += XP_BONUS.doubleSession
    }

    const workout = {
      ...session,
      xpEarned,
      xpMultiplier: multiplier,
      classMult,
      survivalStatus: survival.status,
      id: `w${Date.now()}`,
    }

    // State güncelle
    _state.workouts.unshift(workout)
    _state.profile.streak = streak
    _state.profile.xp.current += xpEarned
    _state.profile.armor = survival.armor
    _state.profile.fatigue = survival.fatigue
    _state.profile.consecutiveHeavy = survival.consecutiveHeavy
    _state.profile.injuryUntil = survival.injuryUntil
    _state.profile.survivalStatus = survival.status
    _state.profile.survivalWarnings = survival.warnings

    // Class yeniden hesapla (son 10 antrenman değiştiği için)
    const newClass = computeClass(_state.workouts)
    if (newClass.id !== _state.profile.classId) {
      _state.profile.classId = newClass.id
      this.set('_classChanged', newClass)
    }
    _state.profile.classObj = newClass

    // Epic tier güncelle
    _state.profile.epicVolume = computeVolumeTier(_state.profile.totalVolumeKg || 0)
    _state.profile.totalKm = estimateKm(_state.workouts)
    _state.profile.epicGeography = computeGeographyTier(_state.profile.totalKm)

    recalculate(_state)

    // Badge kontrol
    const newBadges = checkBadges(_state)
    if (newBadges.length) {
      _state.badges = _state.badges.map(b =>
        newBadges.find(nb => nb.id === b.id)
          ? { ...b, earnedAt: new Date().toISOString(), locked: false }
          : b
      )
      this.set('_newBadges', newBadges)  // toast.js dinliyor
    }

    // Supabase'e yaz
    if (!isMockMode) {
      await insertWorkout(_toSupabaseWorkout(workout, _state))
      await updateProfile(_toSupabaseProfile(_state.profile))
    }

    _saveToLS()
    _notify('workouts')
    _notify('profile')
    return workout
  },

  /** Supabase'den tüm state'i çek ve güncelle */
  async syncFromSupabase() {
    const [profileRow, workoutRows, coachNoteRow] = await Promise.all([
      fetchProfile(),
      fetchWorkouts(),
      fetchLatestCoachNote(),
    ])
    if (profileRow) _applySupabaseProfile(profileRow)
    if (workoutRows?.length) {
      _state.workouts = workoutRows.map(_normalizeWorkout)
    }
    if (coachNoteRow?.sections?.length) {
      _state.coachNote = {
        date:     coachNoteRow.date,
        sections: coachNoteRow.sections,
        xpNote:   coachNoteRow.xp_note || '',
      }
      // Koçun önerdiği quest/warning/skill bilgilerini state'e yansıt ki paneller güncellesin
      if (Array.isArray(coachNoteRow.warnings)) {
        _state.profile.survivalWarnings = coachNoteRow.warnings
      }
      if (Array.isArray(coachNoteRow.quest_hints)) {
        _state.coachQuestHints = coachNoteRow.quest_hints
      }
      if (Array.isArray(coachNoteRow.skill_progress)) {
        _state.coachSkillProgress = coachNoteRow.skill_progress
      }
    }
    // Profil/workouts değişti → class, epic, geography, survival yeniden türet
    _deriveMetaFields(_state)
    recalculate(_state)
    _saveToLS()
    _notify('*')
  },

  /** Tüm state JSON olarak export */
  export() {
    return JSON.stringify(_state, null, 2)
  },

  /** JSON'dan import (cihaz değişikliği / yedek yükleme) */
  import(json) {
    try {
      const data = typeof json === 'string' ? JSON.parse(json) : json
      _state = { ...data, _version: CURRENT_VERSION }
      _saveToLS()
      _notify('*')
    } catch (e) {
      console.error('[store] import error:', e)
    }
  },

  /** Fabrika ayarlarına dön */
  reset() {
    localStorage.removeItem(LS_KEY)
    _state = _buildSeed()
    _notify('*')
  },

  /** Supabase Realtime bağlantılarını kapat */
  destroy() {
    _unsubSupabase.forEach(unsub => unsub())
    _unsubSupabase = []
  },
}

// ── Derive helpers ──────────────────────────────────────────────────────────

function _deriveMetaFields(state) {
  if (!state || !state.profile) return
  // Class
  const cls = computeClass(state.workouts || [])
  state.profile.classId = cls.id
  state.profile.classObj = cls
  // Survival default
  if (state.profile.armor == null)   state.profile.armor = 100
  if (state.profile.fatigue == null) state.profile.fatigue = 0
  if (state.profile.consecutiveHeavy == null) state.profile.consecutiveHeavy = 0
  state.profile.survivalStatus = state.profile.survivalStatus || 'healthy'
  // Epic
  state.profile.epicVolume = computeVolumeTier(state.profile.totalVolumeKg || 0)
  state.profile.totalKm = estimateKm(state.workouts || [])
  state.profile.epicGeography = computeGeographyTier(state.profile.totalKm)
}

// ── Yardımcı fonksiyonlar ────────────────────────────────────────────────────

function _loadFromLS() {
  try {
    const raw = localStorage.getItem(LS_KEY)
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

function _saveToLS() {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify({ ..._state, _version: CURRENT_VERSION }))
  } catch (e) {
    console.warn('[store] localStorage write error:', e)
  }
}

function _buildSeed() {
  // profile.js seed + mock-state'in yeni alanlarını birleştir
  return {
    _version: CURRENT_VERSION,
    profile: {
      nick:       seedProfile.nick,
      handle:     seedProfile.handle,
      rank:       seedProfile.rank,
      rankIcon:   seedProfile.rankIcon,
      class:      seedProfile.class,
      subClass:   seedProfile.subClass,
      avatar:     seedProfile.avatar,
      level:      seedProfile.level,
      xp:         { ...seedProfile.xp },
      sessions:   seedProfile.sessions,
      totalVolumeKg: 213000,
      totalSets:  seedProfile.totalSets,
      totalMinutes: 2678,
      totalVolume: seedProfile.totalVolume,
      totalTime:  seedProfile.totalTime,
      stats:      { str: 78, agi: 77, end: 73, dex: 68, con: 12, sta: 63 },
      streak:     MOCK_STATE.profile.streak,
      lastUpdated: MOCK_STATE.profile.lastUpdated,
    },
    workouts:   MOCK_STATE.workouts,
    dailyLogs:  MOCK_STATE.dailyLogs,
    prs:        MOCK_STATE.prs,
    badges:     MOCK_STATE.badges,
    // Statik alanlar — mevcut panel'ler bunları kullanır
    globalStats:   seedProfile.globalStats,
    stats:         seedProfile.stats,
    performance:   seedProfile.performance,
    debuffs:       seedProfile.debuffs,
    muscleBalance: seedProfile.muscleBalance,
    muscles:       seedProfile.muscles,
    skills:        seedProfile.skills,
    health:        seedProfile.health,
    quests:        seedProfile.quests,
    achievements:  seedProfile.achievements,
    workoutLog:    seedProfile.workoutLog,
    coachNote:     seedProfile.coachNote,
  }
}

/** Store state → mevcut panel'lerin beklediği profile.js shape */
function _mergeToProfile(state) {
  const p = state.profile
  return {
    ...seedProfile,           // statik alanlar (stats detail, skills, muscles vb.)
    nick:        p.nick,
    handle:      p.handle,
    rank:        p.rank,
    rankIcon:    p.rankIcon,
    class:       p.class,
    subClass:    p.subClass,
    avatar:      p.avatar,
    level:       p.level,
    xp:          p.xp,
    sessions:    p.sessions,
    totalVolume: p.totalVolume || `${Math.round(p.totalVolumeKg / 1000)}k kg`,
    totalSets:   p.totalSets,
    totalTime:   p.totalTime,
    streak:      p.streak,
    globalStats: state.globalStats,
    stats:       state.stats,
    performance: state.performance,
    debuffs:     state.debuffs,
    muscleBalance: state.muscleBalance,
    muscles:     state.muscles,
    skills:      state.skills,
    health:      state.health,
    quests:      state.quests,
    achievements: state.achievements,
    workoutLog:  state.workouts.slice(0, 20).map(w => ({
      date:      w.date,
      type:      w.type,
      duration:  `${w.durationMin}dk`,
      volume:    w.volumeKg ? `${w.volumeKg.toLocaleString('tr-TR')} kg` : '—',
      sets:      w.sets,
      highlight: w.highlight,
    })),
    coachNote:   state.coachNote,
  }
}

function _applySupabaseProfile(row) {
  if (!_state) return
  Object.assign(_state.profile, {
    nick:         row.nick,
    handle:       row.handle,
    rank:         row.rank,
    level:        row.level,
    xp:           { current: row.xp_current, max: row.xp_max },
    sessions:     row.sessions,
    totalVolumeKg: row.total_volume_kg,
    totalSets:    row.total_sets,
    totalMinutes: row.total_minutes,
    stats:        row.stats,
    streak: {
      current:  row.streak_current,
      max:      row.streak_max,
      lastWorkoutDate: row.last_workout_date,
      multiplier: _streakMultiplier(row.streak_current),
      label:    _streakLabel(row.streak_current),
    },
    lastUpdated: row.last_updated,
  })
}

function _normalizeWorkout(row) {
  if (row.durationMin != null) return row  // zaten normalize edilmiş
  return {
    id:           row.id,
    date:         row.date,
    type:         row.type,
    durationMin:  row.duration_min,
    volumeKg:     row.volume_kg,
    sets:         row.sets,
    highlight:    row.highlight,
    exercises:    row.exercises || [],
    xpEarned:     row.xp_earned,
    xpMultiplier: row.xp_multiplier,
    hasPr:        row.has_pr || false,
  }
}

function _toSupabaseWorkout(w, state) {
  return {
    profile_id:   null,  // Supabase RLS ile doldurulur
    date:         w.date,
    type:         w.type,
    duration_min: w.durationMin,
    volume_kg:    w.volumeKg,
    sets:         w.sets,
    highlight:    w.highlight,
    exercises:    w.exercises,
    xp_earned:    w.xpEarned,
    xp_multiplier: w.xpMultiplier,
    has_pr:       w.hasPr,
  }
}

function _toSupabaseProfile(p) {
  return {
    xp_current:       p.xp.current,
    xp_max:           p.xp.max,
    level:            p.level,
    sessions:         p.sessions,
    total_volume_kg:  p.totalVolumeKg,
    total_sets:       p.totalSets,
    total_minutes:    p.totalMinutes,
    stats:            p.stats,
    streak_current:   p.streak.current,
    streak_max:       p.streak.max,
    last_workout_date: p.streak.lastWorkoutDate,
  }
}

function _streakMultiplier(days) {
  // Inline — import döngüsünü önlemek için streak-engine.js'i kullanmıyoruz
  if (days >= 30) return 2.0
  if (days >= 14) return 1.5
  if (days >= 7)  return 1.25
  if (days >= 3)  return 1.1
  return 1.0
}

function _streakLabel(days) {
  if (days >= 30) return '⚡ Efsane'
  if (days >= 14) return '💀 Durdurulamaz'
  if (days >= 7)  return '🔥🔥 Yanıyor'
  if (days >= 3)  return '🔥 Ateşlendi'
  return ''
}

function _hasCoreExercise(session) {
  const coreKeywords = ['hollow', 'l-sit', 'lsit', 'plank', 'dragon', 'core', 'ab wheel', 'crunch']
  return (session.exercises || []).some(e =>
    coreKeywords.some(kw => e.name.toLowerCase().includes(kw))
  )
}

function _isDoubleSession(workouts, date) {
  return workouts.filter(w => w.date === date).length >= 1
}
