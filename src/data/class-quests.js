import { buildSemanticProfile } from './semantic-profile.js'
import { getLocalDateString, normalizeDateString, normalizeSession } from './rules.js'

export const CLASS_QUEST_PACKS = {
  cekirdek_alevi: [
    { id: 'cf_hollow', icon: '🔥', name: 'Hollow 30sn', kind: 'feat', source: 'hollowMaxSec', target: 30, reward: '+30 XP', desc: 'Hafta icinde 30sn hollow body netle.' },
    { id: 'cf_core4', icon: '🔥', name: 'Core blok x4', kind: 'count', source: 'core', target: 4, reward: '+30 XP', desc: 'Direkt core sinyali 4 seans.' },
    { id: 'cf_lsit', icon: '🔥', name: 'L-Sit 10sn', kind: 'feat', source: 'lSitMaxSec', target: 10, reward: '+25 XP', desc: 'L-Sit dayanagi 10sn.' },
  ],
  ayi_pencesi: [
    { id: 'ap_push3', icon: '🐻', name: 'Push gunu x3', kind: 'count', source: 'push', target: 3, reward: '+30 XP', desc: '3 ayri push odakli seans.' },
    { id: 'ap_bench', icon: '🐻', name: 'Bench peak', kind: 'featTarget', source: 'benchMaxKg', target: 65, reward: '+50 XP', desc: 'Bu hafta 65kg bench dokun.' },
    { id: 'ap_pull2', icon: '🐻', name: 'Pull gunu x2', kind: 'count', source: 'pull', target: 2, reward: '+25 XP', desc: 'Push ile dengeli kalmak icin 2 pull seansi.' },
  ],
  ruzgar_kosucusu: [
    { id: 'rk_outdoor4', icon: '🌬️', name: 'Outdoor x4', kind: 'count', source: 'outdoor', target: 4, reward: '+30 XP', desc: '4 ayri outdoor seans.' },
    { id: 'rk_dist20', icon: '🌬️', name: '20km mesafe', kind: 'distance', target: 20, reward: '+40 XP', desc: 'Haftalik kumulatif 20km.' },
    { id: 'rk_locomo3', icon: '🌬️', name: 'Lokomotion x3', kind: 'count', source: 'locomotion', target: 3, reward: '+25 XP', desc: 'Yuruyus/bisiklet/kosu/ski ucu en az 3 seans.' },
  ],
  mermer_heykel: [
    { id: 'mh_mob3', icon: '🗿', name: 'Mobilite x3', kind: 'count', source: 'mobility', target: 3, reward: '+30 XP', desc: '3 mobilite/stretching seansi.' },
    { id: 'mh_rec2', icon: '🗿', name: 'Recovery gunu x2', kind: 'count', source: 'recovery', target: 2, reward: '+25 XP', desc: '2 planli recovery gunu.' },
    { id: 'mh_disc', icon: '🗿', name: 'Recovery disiplini', kind: 'recoveryDiscipline', target: 70, reward: '+30 XP', desc: 'Uyku/su/adim disiplini %70 ustunde.' },
  ],
  golge_akrobat: [
    { id: 'ga_depth', icon: '🥷', name: 'Cesitlilik 3 dal', kind: 'depthCategory', target: 3, reward: '+35 XP', desc: 'Strength + movement + endurance/recovery birlikte.' },
    { id: 'ga_mu', icon: '🥷', name: 'Muscle-Up 3 rep', kind: 'feat', source: 'muscleUpMaxReps', target: 3, reward: '+40 XP', desc: 'Tek setteki en iyi MU 3 rep olsun.' },
    { id: 'ga_var', icon: '🥷', name: '6 farkli sinyal', kind: 'variety', target: 6, reward: '+25 XP', desc: '6 ayri tag/tip kombinasyonu.' },
  ],
  gok_kartali: [
    { id: 'gk_movement4', icon: '🦅', name: 'Movement x4', kind: 'count', source: 'movement', target: 4, reward: '+35 XP', desc: 'Movement primary kategori 4 seans.' },
    { id: 'gk_acro2', icon: '🦅', name: 'Akrobasi x2', kind: 'count', source: 'acrobatics', target: 2, reward: '+30 XP', desc: '2 akrobasi seansi.' },
    { id: 'gk_aerial', icon: '🦅', name: 'Aerial control', kind: 'chain', source: 'aerialControl', target: 4, reward: '+30 XP', desc: 'Aerial zincir yuku 4 ustunde.' },
  ],
  duvar_orucu: [
    { id: 'do_acro3', icon: '🕷️', name: 'Akrobasi x3', kind: 'count', source: 'acrobatics', target: 3, reward: '+30 XP', desc: '3 ayri akrobasi seansi.' },
    { id: 'do_landing', icon: '🕷️', name: 'Landing zinciri', kind: 'chain', source: 'landingControl', target: 4, reward: '+30 XP', desc: 'Landing kontrol sinyali 4.' },
    { id: 'do_round', icon: '🕷️', name: 'Round off / barani', kind: 'feat', source: 'roundOffSeen', target: 1, reward: '+25 XP', desc: 'Round off veya barani izi.' },
  ],
  vinc_gezgini: [
    { id: 'vg_park4', icon: '🦉', name: 'Parkour x4', kind: 'count', source: 'parkour', target: 4, reward: '+35 XP', desc: '4 parkour seansi.' },
    { id: 'vg_terrain', icon: '🦉', name: 'Terrain x2', kind: 'feat', source: 'terrainSessions', target: 2, reward: '+25 XP', desc: '2 terrain/zemin odakli seans.' },
    { id: 'vg_lower', icon: '🦉', name: 'Lower power 4', kind: 'chain', source: 'lowerPower', target: 4, reward: '+25 XP', desc: 'Bacak + parkour + explosive zinciri 4.' },
  ],
  celik_omurga: [
    { id: 'co_legs3', icon: '⛓️', name: 'Bacak x3', kind: 'count', source: 'legs', target: 3, reward: '+30 XP', desc: '3 bacak/alt vucut seansi.' },
    { id: 'co_endur', icon: '⛓️', name: 'Endurance x2', kind: 'count', source: 'endurance', target: 2, reward: '+25 XP', desc: '2 endurance primary seans.' },
    { id: 'co_carry', icon: '⛓️', name: 'Carry x1', kind: 'count', source: 'carry', target: 1, reward: '+20 XP', desc: 'Bir tasima/carry blogu.' },
  ],
  golge_gezgini: [
    { id: 'gg_night3', icon: '🌙', name: 'Gece seansi x3', kind: 'night', target: 3, reward: '+35 XP', desc: '22:00 sonrasi veya 06:00 oncesi 3 seans.' },
    { id: 'gg_var', icon: '🌙', name: '5 farkli sinyal', kind: 'variety', target: 5, reward: '+25 XP', desc: '5 ayri tag/tip kombinasyonu.' },
  ],
  merakli_ruh: [
    { id: 'mr_var8', icon: '🔮', name: '8 farkli sinyal', kind: 'variety', target: 8, reward: '+30 XP', desc: '8 ayri tag/tip kombinasyonu.' },
    { id: 'mr_depth', icon: '🔮', name: '4 dal kapsami', kind: 'depthCategory', target: 4, reward: '+35 XP', desc: 'Strength/movement/endurance/recovery dordu.' },
  ],
}

function _readSource(weekProfile, quest) {
  const { kind, source } = quest
  switch (kind) {
    case 'count':
      return Number(weekProfile?.counts?.[source]) || 0
    case 'feat':
      return Number(weekProfile?.feats?.[source]) || (weekProfile?.feats?.[source] ? 1 : 0)
    case 'featTarget':
      return Number(weekProfile?.feats?.[source]) || 0
    case 'chain':
      return Number(weekProfile?.chains?.[source]) || 0
    case 'distance':
      return Math.round((weekProfile?.workouts || []).reduce((sum, workout) => sum + (Number(workout.distanceKm) || 0), 0))
    case 'depthCategory':
      return ['strength', 'movement', 'endurance', 'recovery']
        .filter(key => (weekProfile?.shares?.[key] || 0) >= 0.15).length
    case 'variety':
      return Number(weekProfile?.variety) || 0
    case 'night':
      return Number(weekProfile?.nightSessions) || 0
    case 'recoveryDiscipline':
      return Math.round((Number(weekProfile?.recoveryDiscipline) || 0) * 100)
    default:
      return 0
  }
}

export function buildClassQuests(classId, weekProfile) {
  const pack = CLASS_QUEST_PACKS[classId] || []
  if (!pack.length) return []
  return pack.map(quest => {
    const raw = _readSource(weekProfile, quest)
    const total = Number(quest.target) || 1
    const progress = Math.min(total, raw)
    return {
      icon: quest.icon || '*',
      name: quest.name,
      desc: quest.desc || 'Class hedefi - bu hafta',
      reward: quest.reward || '+25 XP',
      progress,
      total,
      done: progress >= total,
      fromClass: true,
      classId,
    }
  })
}

export function appendClassQuests(quests, classId, workouts = [], dailyLogs = [], today = getLocalDateString()) {
  const baseWeekly = (quests?.weekly || []).filter(quest => !quest.fromClass)
  if (!classId || !CLASS_QUEST_PACKS[classId]) return { ...quests, weekly: baseWeekly }
  const cutoff = new Date(`${normalizeDateString(today)}T00:00:00`).getTime() - (7 * 86400000)
  const weekWorkouts = (workouts || [])
    .map(workout => normalizeSession(workout))
    .filter(workout => new Date(`${normalizeDateString(workout.date)}T00:00:00`).getTime() >= cutoff)
  const weekProfile = buildSemanticProfile(weekWorkouts, dailyLogs)
  const newQuests = buildClassQuests(classId, weekProfile)
  return {
    ...quests,
    weekly: [...baseWeekly, ...newQuests],
  }
}
