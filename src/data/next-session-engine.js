import { getLocalDateString, normalizeDateString } from './rules.js'
import { bodyEventToInjury, getActiveBodyEvents } from './body-events.js'

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
    push: { key: 'push', label: 'Göğüs', sets: 0 },
    pull: { key: 'pull', label: 'Sırt', sets: 0 },
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

function buildSourceHealth(workouts = [], profile = {}, health = {}) {
  const recent = sortWorkoutsDesc(workouts).slice(0, 30)
  const hevy = recent.filter(workout => String(workout.source || '').toLowerCase() === 'hevy')
  const appleHealth = recent.filter(workout => String(workout.source || '').toLowerCase() === 'apple_health')
  const latestHevy = hevy[0] || null
  const latestAppleHealth = appleHealth[0] || null
  const latest = recent[0] || null
  const vital = health?.vitalScores || {}
  const dailySummary = vital.summary || health?.dailySummary || null
  const appleSleepLinked = Boolean(dailySummary?.totalSleepHours || dailySummary?.sleepScore)
  const appleHeartLinked = Boolean(dailySummary?.restingHeartRate || dailySummary?.hrvSdnn || dailySummary?.heartScore)
  const appleActivityLinked = Boolean(dailySummary?.steps || dailySummary?.movementScore || dailySummary?.strainScore)
  const lastSync = profile.lastUpdated || profile.last_updated || latest?.createdAt || latest?.created_at || null

  return {
    hevyCount: hevy.length,
    appleHealthCount: appleHealth.length,
    appleSleepLinked,
    appleHeartLinked,
    appleActivityLinked,
    dataConfidence: Number(vital.dataConfidence ?? dailySummary?.dataConfidence) || 0,
    totalRecent: recent.length,
    latestHevyDate: latestHevy?.date || null,
    latestAppleHealthDate: latestAppleHealth?.date || null,
    latestSource: latest?.source || 'manual',
    lastSync,
    label: hevy.length || appleHealth.length || appleSleepLinked || appleHeartLinked
      ? `Hevy ${hevy.length} / Apple workout ${appleHealth.length} / uyku ${appleSleepLinked ? 'var' : 'yok'} / kalp ${appleHeartLinked ? 'var' : 'yok'}`
      : 'Kayıt bekliyor',
  }
}

function buildBlock(kind, label, target, reason, intensity = 'moderate') {
  return { kind, label, target, reason, intensity }
}

function appleHealthLine(latest = null) {
  if (String(latest?.source || '').toLowerCase() !== 'apple_health') return ''
  const distance = Number(latest.distanceKm ?? latest.distance_km)
  const distanceText = distance > 0 ? `${Math.round(distance * 10) / 10} km ` : ''
  const terrain = (latest.tags || []).includes('terrain') ? 'arazi ' : ''
  return `${distanceText}${terrain}${latest.type || 'hareket'} kayda girdi.`
}

function injuryPrefix(injury = null) {
  if (!injury) return ''
  const eta = Number(injury.etaDays) ? `${Math.round(injury.etaDays)} gün ` : ''
  const command = injury.odieInterpretation?.command || injury.note || `${injury.label || 'Sakatlık'} temkinde.`
  return `${eta}${command}`
}

function commandFor(goalKey, { fatigue, armor, latest, balance, readiness, hoursSinceLatest, injury }) {
  const latestType = latest?.type || 'ana blok'
  const appleLine = appleHealthLine(latest)
  const injuryLine = injuryPrefix(injury)
  const prefix = [appleLine, injuryLine].filter(Boolean).join(' ')
  if (goalKey === 'recovery') {
    return `${prefix ? `${prefix} ` : ''}Bugün ağır yük yok. 30 dk yürüyüş + 10 dk mobilite yap; can ${Math.round(armor)} üstüne çıkana kadar sakin git.`
  }
  if (goalKey === 'sleep-recovery') {
    return `${prefix ? `${prefix} ` : ''}Uyku zayıf. Bugün rekor yok; 25 dk rahat yürüyüş, 10 dk mobilite ve erken kapanış.`
  }
  if (goalKey === 'heart-calm') {
    return `${prefix ? `${prefix} ` : ''}Kalp/HRV düşük. Nabzı yormadan hareket et: 20-30 dk kolay tempo, 8 dk nefes ve mobilite.`
  }
  if (goalKey === 'strain-drain') {
    return `${prefix ? `${prefix} ` : ''}Gün içi yük zaten dolu. Bacakta ağır PR yok; ayak bileği, kalf ve kalça bakımını temiz kapat.`
  }
  if (goalKey === 'technical') {
    return `${prefix ? `${prefix} ` : ''}Bugün rekor kovalamıyoruz. ${latestType} için 3 kontrollü set, 2 destek seti ve 8 dk core ile kapat.`
  }
  if (goalKey === 'pr-hold') {
    return `${prefix ? `${prefix} ` : ''}Rekor yeni; ${hoursSinceLatest ?? '--'} saat geçmiş. ${latestType} aynı kiloda kalsın, sadece 1 temiz tekrar veya güvenli destek seti ekle.`
  }
  if (goalKey === 'balance') {
    const low = balance.lowest?.label || 'Core'
    const target = balance.lowest?.key === 'core' ? '8-12 dk' : '3 net set'
    return `${prefix ? `${prefix} ` : ''}${low} geride kalmış. Ana işten önce ${target} ${low.toLocaleLowerCase('tr-TR')} koy; sonra normale dön.`
  }
  return `${prefix ? `${prefix} ` : ''}${latestType} açık. Tek küçük artış yeter: +1 tekrar veya +2.5kg. Sonuna 8 dk core ekle.`
}

export function buildNextSessionRecommendation({
  profile = {},
  workouts = [],
  dailyLogs = [],
  memoryFeedback = [],
  health = {},
  bodyEvents = [],
  today = getLocalDateString(),
  now = new Date(),
} = {}) {
  const ordered = sortWorkoutsDesc(workouts)
  const latest = ordered[0] || null
  const recent14 = workoutsSince(ordered, WINDOW_14, today)
  const recent30 = workoutsSince(ordered, WINDOW_30, today)
  const balance = buildBalance(recent30)
  const sourceHealth = buildSourceHealth(ordered, profile, health)
  const vital = health?.vitalScores || {}
  const dailySummary = vital.summary || health?.dailySummary || null
  const fatigue = clamp(firstFinite(profile.fatigue, profile.fatigue_current), 0, 100)
  const armor = clamp(firstFinite(profile.armor, profile.armor_current, 100), 0, 100)
  const readiness = clamp(firstFinite(health?.readiness?.score, profile.readiness, (armor * 0.45) + ((100 - fatigue) * 0.55), DEFAULT_READINESS), 0, 100)
  const sleepScoreRaw = firstFinite(vital.sleep, dailySummary?.sleepScore)
  const heartScoreRaw = firstFinite(vital.heart, dailySummary?.heartScore)
  const strainScoreRaw = firstFinite(vital.strain, dailySummary?.strainScore)
  const systemFatigueRaw = firstFinite(vital.systemFatigue)
  const sleepScore = sleepScoreRaw == null ? null : clamp(sleepScoreRaw)
  const heartScore = heartScoreRaw == null ? null : clamp(heartScoreRaw)
  const strainScore = strainScoreRaw == null ? null : clamp(strainScoreRaw)
  const systemFatigue = systemFatigueRaw == null ? null : clamp(systemFatigueRaw)
  const effectiveFatigue = Math.max(fatigue, systemFatigue ?? 0)
  const hours = hoursSinceWorkout(latest, now)
  const hasRecentPr = recentPrSignal(latest) && (hours == null || hours < 96)
  const activeFeedbackRisk = (memoryFeedback || []).some(item => ['wrong', 'outdated'].includes(item.feedbackType || item.feedback_type))
  const activeInjury = getActiveBodyEvents(bodyEvents, today).map(event => bodyEventToInjury(event)).filter(Boolean)[0]
    || (Array.isArray(profile.injuries) ? profile.injuries.find(item => item.active !== false) : null)
  const evidence = []

  if (latest) evidence.push(`Son seans: ${String(latest.source || '').toLowerCase() === 'hevy' ? 'Hevy' : latest.source || 'Manual'} / ${latest.type || 'seans'} / ${latest.durationMin || latest.duration_min || 0} dk`)
  evidence.push(`Ritim: 14 günde ${recent14.length} seans, 30 günde ${recent30.length} seans`)
  evidence.push(`Hazır ${Math.round(readiness)}, can ${Math.round(armor)}, kas yorgunluğu ${Math.round(fatigue)}${systemFatigue != null ? `, genel yorgunluk ${Math.round(systemFatigue)}` : ''}`)
  if (sleepScore != null) evidence.push(`Uyku: skor ${Math.round(sleepScore)} / ${Number(dailySummary?.totalSleepHours || 0).toFixed(1)}s`)
  if (heartScore != null) evidence.push(`Kalp: skor ${Math.round(heartScore)} / HRV ${Math.round(Number(dailySummary?.hrvSdnn) || 0)} / RHR ${Math.round(Number(dailySummary?.restingHeartRate) || 0)}`)
  if (strainScore != null) evidence.push(`Gün yükü: ${Math.round(strainScore)} / adım ${Math.round(Number(dailySummary?.steps) || 0)}`)
  if (balance.lowest) evidence.push(`Geride kalan hat: ${balance.lowest.label} (${Math.round(balance.lowest.sets)} set)`)
  if (sourceHealth.latestHevyDate) evidence.push(`Son Hevy: ${sourceHealth.latestHevyDate}`)
  if (sourceHealth.latestAppleHealthDate) evidence.push(`Son Apple Health: ${sourceHealth.latestAppleHealthDate}`)
  if (activeInjury) evidence.push(`Aktif temkin: ${activeInjury.label || activeInjury.regionId}`)

  let goalKey = 'progress'
  let tone = 'go'
  let title = 'Küçük Artış Günü'
  let subtitle = 'Ana hareketi koru, sadece ufak bir artış yap.'
  let blocks = [
    buildBlock('strength', latest?.type || 'Ana hamle', '+1 rep veya +2.5kg tavan', 'Son veri bugün küçük artışa izin veriyor.', 'moderate'),
    buildBlock('core', 'Core kilidi', '8 dk', 'Karakter dengesi core olmadan eksik kalıyor.', 'easy'),
  ]
  const progressionCaps = []
  const warnings = []

  if (!latest) {
    goalKey = 'onboarding'
    tone = 'calm'
    title = 'İlk Temiz Kayıt'
    subtitle = 'Hevy veya Telegram kaydı ile karakteri canlandır.'
    blocks = [
      buildBlock('strength', 'Ana hamle', '3 set', 'İlk güçlü kayıt için net hareket yeter.', 'moderate'),
      buildBlock('mobility', 'Kapanış', '8 dk', 'İlk günü temiz veriyle kapat.', 'easy'),
    ]
    progressionCaps.push('İlk kayıtta rekor kovalamıyoruz.')
  } else if (sleepScore != null && sleepScore < 45) {
    goalKey = 'sleep-recovery'
    tone = 'warn'
    title = 'Can topla'
    subtitle = 'Uyku az; bugün tavan düşük.'
    blocks = [
      buildBlock('locomotion', 'Kolay hareket', '20-30 dk', 'Uyku düşükken hafif hareket yeter.', 'easy'),
      buildBlock('mobility', 'Erken kapanış', '10 dk', 'Bugün sistemi yormuyoruz.', 'easy'),
    ]
    progressionCaps.push('Uyku toparlanmadan PR yok.')
    warnings.push(`Uyku skoru ${Math.round(sleepScore)}; ağır yük bugün dikkat.`)
  } else if (heartScore != null && heartScore < 45) {
    goalKey = 'heart-calm'
    tone = 'warn'
    title = 'Sakin Gün'
    subtitle = 'Kalp/HRV bugün tempoyu kısıyor.'
    blocks = [
      buildBlock('locomotion', 'Düşük nabız hareket', '20-30 dk', 'HRV/RHR temkinli; nabız kovalamıyoruz.', 'easy'),
      buildBlock('breath', 'Nefes + mobilite', '8-10 dk', 'Yorgunluğu azaltan en temiz yol.', 'easy'),
    ]
    progressionCaps.push('Nabız toparlanana kadar ağır interval ve PR yok.')
    warnings.push(`Kalp skoru ${Math.round(heartScore)}; sinir sistemi temkinli okunuyor.`)
  } else if (strainScore != null && strainScore >= 72) {
    goalKey = 'strain-drain'
    tone = 'warn'
    title = 'Gün Yükünü Boşalt'
    subtitle = 'Apple hareket yükü zaten dolmuş; seansı bakıma çevir.'
    blocks = [
      buildBlock('mobility', 'Ayak bileği + kalf', '10 dk', 'Yürüyüş/hiking sonrası alt hat bakımı XP getirir.', 'easy'),
      buildBlock('core', 'Core kilidi', '6-8 dk', 'Yüksek gün yükünde en temiz ilerleme düşük riskli kontroldür.', 'easy'),
    ]
    progressionCaps.push('Bacakta ağır PR yok; toparlanma XP sayılıyor.')
    warnings.push(`Gün yükü ${Math.round(strainScore)}; ekstra ağır bacak bugün risk.`)
  } else if (effectiveFatigue >= 75 || profile.survivalStatus === 'cns_overloaded' || profile.survival_status === 'cns_overloaded') {
    goalKey = 'recovery'
    tone = 'danger'
    title = 'Toparlanma Günü'
    subtitle = 'Bugün ağır yük değil, toparlanma.'
    blocks = [
      buildBlock('locomotion', 'Hafif yürüyüş', '25-35 dk', 'Yorgunluk yüksek; kan dolaşımı yeter.', 'easy'),
      buildBlock('mobility', 'Mobilite + nefes', '10 dk', 'Can düşükken ağır yük riskli.', 'easy'),
    ]
    progressionCaps.push('Ağırlık artışı yok, PR denemesi yok.')
    warnings.push(`Yorgunluk ${Math.round(effectiveFatigue)}; ağır seans bugün kilitli.`)
  } else if (armor < 55 || readiness < 45) {
    goalKey = 'technical'
    tone = 'warn'
    title = 'Form Günü'
    subtitle = 'Form kilidi var, ego seti yok.'
    blocks = [
      buildBlock('skill', latest.type || 'Form bloğu', '3 kontrollü set', 'Hazırlık düşük; hareket temizliği önce.', 'easy'),
      buildBlock('core', 'Core aktivasyon', '8 dk', 'Düşük hazırlık gününde en güvenli ilerleme.', 'easy'),
    ]
    progressionCaps.push('Yük artışı yok; form notu gir.')
  } else if (hasRecentPr) {
    goalKey = 'pr-hold'
    tone = 'warn'
    title = 'Rekor Sonrası Temkin'
    subtitle = 'Yeni rekoru sindir, aynı hatta kontrollü tekrar ekle.'
    blocks = [
      buildBlock('strength', latest.type || 'Rekor hattı', 'Aynı kg / +1 rep tavan', 'Rekor sonrası agresif artış riski büyütür.', 'moderate'),
      buildBlock('accessory', 'Destek bloğu', '2 set', 'Ana yükü artırmadan hareketi koru.', 'easy'),
    ]
    progressionCaps.push('Rekor sonrası 96 saat içinde +kg yok.')
  } else if (balance.lowest && ['push', 'pull', 'legs', 'core'].includes(balance.lowest.key)) {
    goalKey = 'balance'
    tone = 'warn'
    title = `${balance.lowest.label} Hattını Kapat`
    subtitle = 'Karakterde en geri kalan hat bugün önce gelir.'
    const isLegs = balance.lowest.key === 'legs'
    const isCore = balance.lowest.key === 'core'
    const blockKind = isCore ? 'core' : 'strength'
    const blockLabel = isLegs ? 'Arka zincir' : isCore ? 'Core kilidi' : `${balance.lowest.label} destek`
    const blockTarget = isCore ? '8-12 dk' : '3-4 set'
    blocks = [
      buildBlock(blockKind, blockLabel, blockTarget, `${balance.lowest.label} son 30 günde geride.`, 'moderate'),
      buildBlock('mobility', isLegs ? 'Kalça/hamstring' : isCore ? 'Gövde kontrolü' : 'Eklem hazırlığı', '6-8 dk', 'Denge bloğunu temiz kapat.', 'easy'),
    ]
    progressionCaps.push(`${balance.lowest.label} kapanmadan ana yüke ekstra set yok.`)
  }

  if (activeFeedbackRisk) warnings.push('Bazı eski ODIE yorumları işaretlenmiş; bugün daha temkinli okuyorum.')
  if (activeInjury) warnings.unshift(activeInjury.odieInterpretation?.command || activeInjury.note || `${activeInjury.label || 'Sakatlık'} temkinde.`)
  if (!sourceHealth.hevyCount) warnings.push('Son kayıtlarda Hevy yok; eşlemeyi kontrol etmek iyi olur.')

  const confidence = clamp(
    42
    + Math.min(22, recent14.length * 4)
    + Math.min(16, sourceHealth.hevyCount * 2)
    + Math.min(14, sourceHealth.dataConfidence / 7)
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
      fatigue: Math.round(effectiveFatigue),
      muscleFatigue: Math.round(fatigue),
      systemFatigue: systemFatigue == null ? null : Math.round(systemFatigue),
      hoursSinceLatest: hours,
    },
    blocks,
    progressionCaps,
    warnings,
    questImpact: {
      pressure: balance.lowest ? `${balance.lowest.label} hattını öne almak mantıklı.` : 'Görev baskısı dengeli.',
      balance,
    },
    coachCommand: commandFor(goalKey, { fatigue, armor, latest, balance, readiness, hoursSinceLatest: hours, injury: activeInjury }),
    sourceHealth,
    confidence: Math.round(confidence),
    evidence: evidence.slice(0, 7),
  }
}
