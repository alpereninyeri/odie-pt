import { getLocalDateString, normalizeDateString } from './rules.js'

const DEFAULT_READINESS = 62
const WINDOW_14 = 14
const WINDOW_30 = 30

function clamp(value, min = 0, max = 100) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return min
  return Math.max(min, Math.min(max, numeric))
}

function sortWorkoutsDesc(workouts = []) {
  return [...(workouts || [])].sort((left, right) => {
    const leftDate = normalizeDateString(left.date, '')
    const rightDate = normalizeDateString(right.date, '')
    if (leftDate !== rightDate) return rightDate.localeCompare(leftDate)
    return String(right.startedAt || right.createdAt || '').localeCompare(String(left.startedAt || left.createdAt || ''))
  })
}

function workoutsSince(workouts = [], days = WINDOW_30, todayStr = getLocalDateString()) {
  const today = new Date(`${normalizeDateString(todayStr)}T00:00:00`).getTime()
  const cutoff = today - (days * 86400000)
  return sortWorkoutsDesc(workouts).filter(workout => {
    const ts = new Date(`${normalizeDateString(workout.date, '')}T00:00:00`).getTime()
    return Number.isFinite(ts) && ts >= cutoff
  })
}

function firstFinite(...values) {
  for (const value of values) {
    const numeric = Number(value)
    if (Number.isFinite(numeric)) return numeric
  }
  return null
}

function hoursSinceWorkout(workout = null, now = new Date()) {
  if (!workout) return null
  const raw = workout.startedAt || workout.started_at || workout.createdAt || workout.created_at || workout.date
  const ts = raw && String(raw).length <= 10
    ? new Date(`${normalizeDateString(raw)}T12:00:00`).getTime()
    : new Date(raw).getTime()
  if (!Number.isFinite(ts)) return null
  return Math.max(0, Math.round((now.getTime() - ts) / 3600000))
}

function hasTag(workout = {}, tag) {
  return (workout.tags || []).map(item => String(item).toLowerCase()).includes(tag)
}

function buildBalance(workouts = []) {
  const totals = {
    push: { key: 'push', label: 'Push', sets: 0 },
    pull: { key: 'pull', label: 'Pull', sets: 0 },
    legs: { key: 'legs', label: 'Bacak', sets: 0 },
    core: { key: 'core', label: 'Core', sets: 0 },
  }

  for (const workout of workouts) {
    const type = String(workout.type || '').toLowerCase()
    const sets = Math.max(1, Number(workout.sets) || 1)
    const blocks = workout.blocks || []
    if (type.includes('push') || hasTag(workout, 'push')) totals.push.sets += sets
    if (type.includes('pull') || hasTag(workout, 'pull')) totals.pull.sets += sets
    if (type.includes('bacak') || type.includes('leg') || hasTag(workout, 'legs')) totals.legs.sets += sets

    const coreSets = blocks
      .filter(block => block.kind === 'core')
      .reduce((sum, block) => sum + (Number(block.sets) || 0), 0)
    if (coreSets || hasTag(workout, 'core')) totals.core.sets += coreSets || Math.max(1, Math.round(sets * 0.35))
  }

  const values = Object.values(totals)
  const max = Math.max(1, ...values.map(item => item.sets))
  const items = values.map(item => ({
    ...item,
    pct: Math.round((item.sets / max) * 100),
  }))
  return {
    items,
    lowest: [...items].sort((left, right) => left.sets - right.sets)[0] || null,
    highest: [...items].sort((left, right) => right.sets - left.sets)[0] || null,
  }
}

function recentPrSignal(workout = null) {
  if (!workout) return false
  if (workout.hasPr || workout.has_pr) return true
  const text = `${workout.highlight || ''} ${workout.notes || ''}`.toLowerCase()
  return /\bpr\b|personal record|rekor/.test(text)
}

function buildSourceHealth(workouts = [], profile = {}) {
  const recent = sortWorkoutsDesc(workouts).slice(0, 30)
  const hevy = recent.filter(workout => String(workout.source || '').toLowerCase() === 'hevy')
  const latestHevy = hevy[0] || null
  const latest = recent[0] || null
  const lastSync = profile.lastUpdated || profile.last_updated || latest?.createdAt || latest?.created_at || null

  return {
    hevyCount: hevy.length,
    totalRecent: recent.length,
    latestHevyDate: latestHevy?.date || null,
    latestSource: latest?.source || 'manual',
    lastSync,
    label: hevy.length ? `Hevy ${hevy.length}/${recent.length || hevy.length}` : 'Hevy bekliyor',
  }
}

function buildBlock(kind, label, target, reason, intensity = 'moderate') {
  return { kind, label, target, reason, intensity }
}

function commandFor(goalKey, { fatigue, armor, latest, balance, readiness, hoursSinceLatest }) {
  const latestType = latest?.type || 'ana blok'
  if (goalKey === 'recovery') {
    return `Bugun agir yuk yok. 30 dk yuruyus + 10 dk mobilite yap; kalkan ${Math.round(armor)} ustune cikana kadar ritmi koru.`
  }
  if (goalKey === 'technical') {
    return `Bugun rekor kovalamiyoruz. ${latestType} icin 3 kontrollu set, 2 destek seti ve 8 dk core ile kapat.`
  }
  if (goalKey === 'pr-hold') {
    return `Rekor yeni; ${hoursSinceLatest ?? '--'} saat gecmis. ${latestType} ayni kiloda kalsin, sadece 1 temiz tekrar veya 1 kaliteli set ekle.`
  }
  if (goalKey === 'balance') {
    const low = balance.lowest?.label || 'Core'
    const target = balance.lowest?.key === 'core' ? '8-12 dk' : '3 net set'
    return `${low} geride kalmis. Ana isten once ${target} ${low.toLowerCase()} koy; sonra normale don.`
  }
  return `${latestType} acik. Tek kucuk artis yeter: +1 tekrar veya +2.5kg. Sonuna 8 dk core ekle.`
}

export function buildNextSessionRecommendation({
  profile = {},
  workouts = [],
  dailyLogs = [],
  memoryFeedback = [],
  health = {},
  today = getLocalDateString(),
  now = new Date(),
} = {}) {
  const ordered = sortWorkoutsDesc(workouts)
  const latest = ordered[0] || null
  const recent14 = workoutsSince(ordered, WINDOW_14, today)
  const recent30 = workoutsSince(ordered, WINDOW_30, today)
  const balance = buildBalance(recent30)
  const sourceHealth = buildSourceHealth(ordered, profile)
  const fatigue = clamp(firstFinite(profile.fatigue, profile.fatigue_current), 0, 100)
  const armor = clamp(firstFinite(profile.armor, profile.armor_current, 100), 0, 100)
  const readiness = clamp(firstFinite(health?.readiness?.score, profile.readiness, (armor * 0.45) + ((100 - fatigue) * 0.55), DEFAULT_READINESS), 0, 100)
  const hours = hoursSinceWorkout(latest, now)
  const hasRecentPr = recentPrSignal(latest) && (hours == null || hours < 96)
  const activeFeedbackRisk = (memoryFeedback || []).some(item => ['wrong', 'outdated'].includes(item.feedbackType || item.feedback_type))
  const evidence = []

  if (latest) evidence.push(`Son seans: ${String(latest.source || '').toLowerCase() === 'hevy' ? 'Hevy' : latest.source || 'Manual'} / ${latest.type || 'seans'} / ${latest.durationMin || latest.duration_min || 0} dk`)
  evidence.push(`Ritim: 14 gunde ${recent14.length} seans, 30 gunde ${recent30.length} seans`)
  evidence.push(`Hazir ${Math.round(readiness)}, kalkan ${Math.round(armor)}, yorgunluk ${Math.round(fatigue)}`)
  if (balance.lowest) evidence.push(`Geride kalan hat: ${balance.lowest.label} (${Math.round(balance.lowest.sets)} set)`)
  if (sourceHealth.latestHevyDate) evidence.push(`Son Hevy: ${sourceHealth.latestHevyDate}`)

  let goalKey = 'progress'
  let tone = 'go'
  let title = 'Kucuk Artis Gunu'
  let subtitle = 'Ana hareketi koru, sadece ufak bir artis yap.'
  let blocks = [
    buildBlock('strength', latest?.type || 'Ana hamle', '+1 rep veya +2.5kg tavan', 'Son veri bugun kucuk artisa izin veriyor.', 'moderate'),
    buildBlock('core', 'Core kilidi', '8 dk', 'Karakter dengesi core olmadan eksik kaliyor.', 'easy'),
  ]
  const progressionCaps = []
  const warnings = []

  if (!latest) {
    goalKey = 'onboarding'
    tone = 'calm'
    title = 'Ilk Temiz Kayit'
    subtitle = 'Hevy veya Telegram kaydi ile karakteri canlandir.'
    blocks = [
      buildBlock('strength', 'Ana hamle', '3 set', 'Ilk guclu kayit icin net hareket yeter.', 'moderate'),
      buildBlock('mobility', 'Kapanis', '8 dk', 'Ilk gunu temiz veriyle kapat.', 'easy'),
    ]
    progressionCaps.push('Ilk kayitta rekor kovalamiyoruz.')
  } else if (fatigue >= 75 || profile.survivalStatus === 'cns_overloaded' || profile.survival_status === 'cns_overloaded') {
    goalKey = 'recovery'
    tone = 'danger'
    title = 'Toparlanma Gunu'
    subtitle = 'Bugun agir yuk degil, vucudu yeniden kur.'
    blocks = [
      buildBlock('locomotion', 'Hafif yuruyus', '25-35 dk', 'Yorgunluk yuksek; kan dolasimi yeter.', 'easy'),
      buildBlock('mobility', 'Mobilite + nefes', '10 dk', 'Kalkan toparlanmadan agir yuk riskli.', 'easy'),
    ]
    progressionCaps.push('Agirlik artisi yok, PR denemesi yok.')
    warnings.push(`Yorgunluk ${Math.round(fatigue)}; agir seans bugun kilitli.`)
  } else if (armor < 55 || readiness < 45) {
    goalKey = 'technical'
    tone = 'warn'
    title = 'Form Gunu'
    subtitle = 'Kalite seti var, ego seti yok.'
    blocks = [
      buildBlock('skill', latest.type || 'Form blogu', '3 kontrollu set', 'Hazirlik dusuk; hareket kalitesi once.', 'easy'),
      buildBlock('core', 'Core aktivasyon', '8 dk', 'Dusuk hazirlik gununde en guvenli ilerleme.', 'easy'),
    ]
    progressionCaps.push('Yuk artisi yok; form notu gir.')
  } else if (hasRecentPr) {
    goalKey = 'pr-hold'
    tone = 'warn'
    title = 'Rekor Sonrasi Temkin'
    subtitle = 'Yeni rekoru sindir, ayni hatta kalite ekle.'
    blocks = [
      buildBlock('strength', latest.type || 'Rekor hatti', 'Ayni kg / +1 rep tavan', 'Rekor sonrasi agresif artis riski buyutur.', 'moderate'),
      buildBlock('accessory', 'Destek blogu', '2 set', 'Ana yuku artirmadan hareketi koru.', 'easy'),
    ]
    progressionCaps.push('Rekor sonrasi 96 saat icinde +kg yok.')
  } else if (balance.lowest && ['push', 'pull', 'legs', 'core'].includes(balance.lowest.key)) {
    goalKey = 'balance'
    tone = 'warn'
    title = `${balance.lowest.label} Hattini Kapat`
    subtitle = 'Karakterde en geri kalan hat bugun once gelir.'
    const isLegs = balance.lowest.key === 'legs'
    const isCore = balance.lowest.key === 'core'
    const blockKind = isCore ? 'core' : 'strength'
    const blockLabel = isLegs ? 'Arka zincir' : isCore ? 'Core kilidi' : `${balance.lowest.label} destek`
    const blockTarget = isCore ? '8-12 dk' : '3-4 set'
    blocks = [
      buildBlock(blockKind, blockLabel, blockTarget, `${balance.lowest.label} son 30 gunde geride.`, 'moderate'),
      buildBlock('mobility', isLegs ? 'Kalca/hamstring' : isCore ? 'Govde kontrolu' : 'Eklem hazirligi', '6-8 dk', 'Denge blogunu temiz kapat.', 'easy'),
    ]
    progressionCaps.push(`${balance.lowest.label} kapanmadan ana yuke ekstra set yok.`)
  }

  if (activeFeedbackRisk) warnings.push('Bazi eski ODIE yorumlari isaretlenmis; bugun daha temkinli okuyorum.')
  if (!sourceHealth.hevyCount) warnings.push('Son kayitlarda Hevy yok; sync hattini kontrol etmek iyi olur.')

  const confidence = clamp(
    42
    + Math.min(22, recent14.length * 4)
    + Math.min(16, sourceHealth.hevyCount * 2)
    + (latest?.blocks?.length ? 10 : 0)
    + (dailyLogs?.length ? 5 : 0)
    - (warnings.length * 5),
    20,
    95,
  )

  return {
    date: today,
    tone,
    primaryGoal: { key: goalKey, title, subtitle },
    readiness: {
      score: Math.round(readiness),
      armor: Math.round(armor),
      fatigue: Math.round(fatigue),
      hoursSinceLatest: hours,
    },
    blocks,
    progressionCaps,
    warnings,
    questImpact: {
      pressure: balance.lowest ? `${balance.lowest.label} hattini one almak mantikli.` : 'Gorev baskisi dengeli.',
      balance,
    },
    coachCommand: commandFor(goalKey, { fatigue, armor, latest, balance, readiness, hoursSinceLatest: hours }),
    sourceHealth,
    confidence: Math.round(confidence),
    evidence: evidence.slice(0, 6),
  }
}
