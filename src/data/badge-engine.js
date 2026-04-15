/**
 * Badge Engine
 * Her antrenman sonrası tüm badge koşullarını kontrol eder.
 * Yeni kazanılan badge'leri döndürür.
 */

const BADGE_CHECKS = [
  {
    id: 'first_blood',
    check: (state) => state.profile.sessions >= 1,
  },
  {
    id: 'streak_3',
    check: (state) => state.profile.streak?.current >= 3,
  },
  {
    id: 'streak_7',
    check: (state) => state.profile.streak?.current >= 7,
  },
  {
    id: 'streak_14',
    check: (state) => state.profile.streak?.current >= 14,
  },
  {
    id: 'streak_30',
    check: (state) => state.profile.streak?.current >= 30,
  },
  {
    id: 'iron_week',
    check: (state) => _hasConsecutiveDays(state.workouts, 7),
  },
  {
    id: 'parkour_initiate',
    check: (state) => state.workouts.some(w => w.type === 'Parkour'),
  },
  {
    id: 'acrobat',
    check: (state) => state.workouts.filter(w => w.type === 'Akrobasi').length >= 10,
  },
  {
    id: 'pr_hunter',
    check: (state) => Object.keys(state.prs || {}).length >= 5,
  },
  {
    id: 'muscle_up',
    check: (state) => state.workouts.some(w =>
      (w.exercises || []).some(e => e.name.toLowerCase().includes('muscle-up') || e.name.toLowerCase().includes('muscle up'))
    ),
  },
  {
    id: 'core_awakening',
    check: (state) => _getStat(state, 'con') >= 25,
  },
  {
    id: 'bench_60',
    check: (state) => (state.prs?.['Bench Press']?.weightKg || 0) >= 60,
  },
  {
    id: 'bench_70',
    check: (state) => (state.prs?.['Bench Press']?.weightKg || 0) >= 70,
  },
  {
    id: 'centurion',
    check: (state) => state.profile.sessions >= 100,
  },
  {
    id: 'volume_250k',
    check: (state) => state.profile.totalVolumeKg >= 250000,
  },
  {
    id: 'consistency_king',
    check: (state) => _sessionsInDays(state.workouts, 30) >= 20,
  },
  {
    id: 'hidden_early_bird',
    check: (state) => state.workouts.some(w => {
      if (!w.startedAt) return false
      const hour = new Date(w.startedAt).getHours()
      return hour < 7
    }),
  },
  {
    id: 'hidden_midnight',
    check: (state) => state.workouts.some(w => {
      if (!w.startedAt) return false
      const hour = new Date(w.startedAt).getHours()
      return hour >= 23 || hour < 2
    }),
  },
]

/**
 * State'i kontrol ederek yeni kazanılan badge'leri döndür.
 * Zaten kazanılmışları (earnedAt != null, locked != true) atlar.
 */
export function checkBadges(state) {
  const newlyEarned = []
  if (!state.badges) return newlyEarned

  BADGE_CHECKS.forEach(({ id, check }) => {
    const badge = state.badges.find(b => b.id === id)
    if (!badge || badge.earnedAt || !badge.locked) return  // zaten kazanılmış veya yoksa atla
    if (check(state)) {
      newlyEarned.push({ ...badge, earnedAt: new Date().toISOString(), locked: false })
    }
  })

  return newlyEarned
}

// ── Yardımcılar ──────────────────────────────────────────────────────────────

function _getStat(state, key) {
  const stat = (state.stats || []).find(s => s.key === key)
  return stat ? stat.val : (state.profile?.stats?.[key] || 0)
}

/** Son N gün içinde kaç antrenman yapıldı */
function _sessionsInDays(workouts, days) {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - days)
  return workouts.filter(w => new Date(w.date) >= cutoff).length
}

/** N gün üst üste (her gün en az 1 antrenman) var mı */
function _hasConsecutiveDays(workouts, n) {
  const days = [...new Set(workouts.map(w => w.date))].sort()
  if (days.length < n) return false
  // Son N günde ardışık n gün var mı kontrol et
  for (let i = days.length - 1; i >= n - 1; i--) {
    let consecutive = 1
    for (let j = i - 1; j >= 0 && consecutive < n; j--) {
      const diff = _dayDiff(days[j], days[j + 1])
      if (diff === 1) consecutive++
      else break
    }
    if (consecutive >= n) return true
  }
  return false
}

function _dayDiff(a, b) {
  return Math.round((new Date(b) - new Date(a)) / (1000 * 60 * 60 * 24))
}
