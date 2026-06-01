import { formatMonthShort, getLocalDateString, normalizeDateString } from './rules.js'
import { plainCopyText } from './ui-copy.js'
import { buildDataTruthMap } from './data-truth-engine.js'

function clamp(value, min = 0, max = 100) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return min
  return Math.max(min, Math.min(max, numeric))
}

function firstDefined(...values) {
  return values.find(value => value !== undefined && value !== null && value !== '')
}

function getHealthSummary(state = {}) {
  return state.healthDailySummary ||
    state.healthStatus?.dailySummary ||
    state.health?.vitalScores?.summary ||
    null
}

function getReadiness(state = {}, nextSession = {}) {
  const direct = Number(nextSession?.readiness?.score ?? state.health?.readiness?.score)
  if (Number.isFinite(direct)) return Math.round(clamp(direct))
  const summary = getHealthSummary(state)
  if (!summary) return null
  return Math.round(clamp(
    (Number(summary.recoveryScore) || 0) * 0.38 +
    (Number(summary.sleepScore) || 0) * 0.24 +
    (Number(summary.heartScore) || 0) * 0.22 +
    (100 - (Number(summary.strainScore) || 0)) * 0.16,
  ))
}

function daysSince(dateValue, today = getLocalDateString()) {
  const date = normalizeDateString(dateValue)
  if (!date) return null
  const left = new Date(`${date}T00:00:00`).getTime()
  const right = new Date(`${today}T00:00:00`).getTime()
  if (!Number.isFinite(left) || !Number.isFinite(right)) return null
  return Math.max(0, Math.round((right - left) / 86400000))
}

function cozyTrainingLabel(value = '') {
  const localized = String(value || 'seans')
    .replace(/\btrunk control\b/gi, 'gövde kontrolü')
    .replace(/\bbuild['’]?i\b/gi, 'rotası')
    .replace(/\bbuild\w*\b/gi, 'rota')
    .replace(/\bPush\b/gi, 'İtiş')
    .replace(/\bPull\b/gi, 'Çekiş')
    .replace(/\bCore\b/gi, 'Gövde')
    .replace(/\bWorkout\b/gi, 'Antrenman')
    .replace(/\bRecovery\b/gi, 'Toparlanma')
    .replace(/\bStrength\b/gi, 'Kuvvet')
    .replace(/\bMobility\b/gi, 'Mobilite')
    .replace(/\bGlobal\b/gi, 'Genel')
    .replace(/\bClass\b/gi, 'Sınıf')
  return plainCopyText(localized)
}

function formatWorkout(workout = null) {
  if (!workout) return 'son seans bekleniyor'
  const pieces = [
    cozyTrainingLabel(workout.type || workout.primaryCategory || 'seans'),
    workout.durationMin ? `${Math.round(Number(workout.durationMin))} dk` : null,
    workout.distanceKm ? `${Math.round(Number(workout.distanceKm) * 10) / 10} km` : null,
    workout.volumeKg ? `${Math.round(Number(workout.volumeKg)).toLocaleString('tr-TR')} kg` : null,
  ].filter(Boolean)
  return pieces.join(' / ')
}

function sourceReady(sources = {}, key) {
  return ['ready', 'active', 'configured', 'synced'].includes(String(sources[key] || '').toLowerCase())
}

function sourceStatus(state = {}) {
  const truthMap = buildDataTruthMap({ state })
  const byKey = truthMap.byKey || {}
  return {
    hevy: byKey.hevy?.state || 'waiting',
    telegram: byKey.telegram?.state || 'waiting',
    appleWorkout: byKey.apple?.state === 'active' ? 'active' : byKey.apple?.state || 'waiting',
    appleSleep: byKey.apple?.state === 'active' ? 'active' : byKey.apple?.state || 'waiting',
    appleHeart: byKey.apple?.state === 'active' ? 'active' : byKey.apple?.state || 'waiting',
    odie: byKey.odie?.state || 'waiting',
    manual: byKey.manual?.state || 'available',
    schemaReady: truthMap.schemaReady,
    appleDisabled: truthMap.appleDisabled,
    readyCount: truthMap.readyCount,
    items: truthMap.items || [],
  }
}

function activeInjury(state = {}, bodyMapState = {}) {
  const bodyInjury = bodyMapState?.injuries?.[0] || bodyMapState?.priority?.region?.injury || null
  if (bodyInjury) return bodyInjury
  const event = (state.bodyEvents || []).find(item => String(item.status || 'active') === 'active')
  if (!event) return null
  return {
    label: event.regionLabel || event.region || 'Beden kaydı',
    recoveryPct: Number(event.recoveryPercent ?? event.recovery_percent) || 0,
    etaDays: (event.expectedClearAt || event.expected_clear_at)
      ? daysSince(getLocalDateString(), event.expectedClearAt || event.expected_clear_at)
      : null,
    note: event.note || '',
  }
}

function buildSignals({ state, summary, readiness, latestWorkout, injury }) {
  const signals = []
  const sleepHours = Number(summary?.totalSleepHours ?? summary?.sleepHours)
  if (summary) {
    signals.push({
      key: 'sleep',
      label: 'Uyku',
      value: Number.isFinite(Number(summary.sleepScore)) ? Math.round(Number(summary.sleepScore)) : '--',
      detail: Number.isFinite(sleepHours) && sleepHours > 0 ? `${Math.round(sleepHours * 10) / 10}s` : 'izin bekliyor',
      tone: Number(summary.sleepScore) < 45 ? 'warn' : 'calm',
    })
    signals.push({
      key: 'heart',
      label: 'Kalp',
      value: Number.isFinite(Number(summary.heartScore)) ? Math.round(Number(summary.heartScore)) : '--',
      detail: summary.hrvSdnn ? `HRV ${Math.round(Number(summary.hrvSdnn))}` : summary.restingHeartRate ? `RHR ${Math.round(Number(summary.restingHeartRate))}` : 'nabız bekliyor',
      tone: Number(summary.heartScore) < 45 ? 'danger' : 'calm',
    })
    signals.push({
      key: 'strain',
      label: 'Gün yükü',
      value: Number.isFinite(Number(summary.strainScore)) ? Math.round(Number(summary.strainScore)) : '--',
      detail: summary.steps ? `${Math.round(Number(summary.steps)).toLocaleString('tr-TR')} adım` : 'aktivite bekliyor',
      tone: Number(summary.strainScore) > 72 ? 'warn' : 'calm',
    })
  } else {
    const appleOff = state.healthStatus?.schemaReady === false || state.healthStatus?.missing || state.healthStatus?.appleStatus === 'apple_disabled'
    signals.push({ key: 'sleep', label: 'Uyku', value: '--', detail: appleOff ? 'Apple kapalı' : 'Apple bekliyor', tone: 'muted' })
    signals.push({ key: 'heart', label: 'Kalp', value: '--', detail: appleOff ? 'Apple kapalı' : 'HRV bekliyor', tone: 'muted' })
  }

  signals.push({
    key: 'readiness',
    label: 'Hazırlık',
    value: readiness ?? '--',
    detail: latestWorkout ? formatMonthShort(latestWorkout.date) : `${state.workouts?.length || 0} seans`,
    tone: readiness != null && readiness < 45 ? 'danger' : readiness != null && readiness < 65 ? 'warn' : 'calm',
  })

  if (injury) {
    signals.push({
      key: 'injury',
      label: 'Temkin',
      value: injury.recoveryPct != null ? `%${Math.round(Number(injury.recoveryPct) || 0)}` : 'aktif',
      detail: injury.etaDays != null ? `${Math.round(Number(injury.etaDays) || 0)} gün` : 'sakatlık',
      tone: 'warn',
    })
  }

  return signals.slice(0, 5)
}

function routineLine({ latestWorkout, summary, today, sources }) {
  if (latestWorkout) {
    const age = daysSince(latestWorkout.date, today)
    const source = String(latestWorkout.source || '').toLowerCase()
    if (source === 'apple_health') {
      return `${formatWorkout(latestWorkout)} kaydı günlük yüke eklendi.`
    }
    if (age === 0) return `${formatWorkout(latestWorkout)} bugün geldi.`
    if (age === 1) return `${formatWorkout(latestWorkout)} dün geldi; bugün etkisi var.`
    return `${formatWorkout(latestWorkout)} ${age} gün önceydi; yeni kayıt gelene kadar sakin gidiyoruz.`
  }
  if (summary?.steps || summary?.totalSleepHours) {
    return `Bugün ${Math.round(Number(summary.steps) || 0).toLocaleString('tr-TR')} adım ve ${Math.round((Number(summary.totalSleepHours) || Number(summary.sleepHours) || 0) * 10) / 10}s uyku var.`
  }
  if (!sources.schemaReady) return 'Sağlık kapısı kapalı; ODIE uyku, kalp ve hareket yok diye okuyor.'
  return 'Hevy, Apple veya manuel kayıt bekleniyor.'
}

function chooseMood({ readiness, summary, injury, latestWorkout }) {
  if (injury) return { key: 'guard', label: 'dikkat', tone: 'warn' }
  if (Number(summary?.sleepScore) > 0 && Number(summary.sleepScore) < 42) return { key: 'sleep', label: 'uyku zayıf', tone: 'warn' }
  if (Number(summary?.heartScore) > 0 && Number(summary.heartScore) < 42) return { key: 'calm', label: 'sakin gün', tone: 'danger' }
  if (Number(summary?.strainScore) > 78) return { key: 'strain', label: 'gün yükü fazla', tone: 'warn' }
  if (readiness != null && readiness >= 78) return { key: 'ready', label: 'seans hazır', tone: 'fire' }
  if (readiness != null && readiness >= 58) return { key: 'steady', label: 'normal tempo', tone: 'calm' }
  if (latestWorkout) return { key: 'read', label: 'kayıt geldi', tone: 'calm' }
  return { key: 'listening', label: 'kayıt bekliyor', tone: 'muted' }
}

function buildTalk({ mood, readiness, summary, latestWorkout, injury, nextSession, bodyMapState }) {
  const goalTitle = nextSession?.primaryGoal?.title || bodyMapState?.dailyQuest?.name || 'Temiz Gün'
  if (injury) {
    const recovery = injury.recoveryPct != null ? `%${Math.round(Number(injury.recoveryPct) || 0)} toparlandı` : 'temkin aktif'
    const days = injury.etaDays != null ? `, ${Math.round(Number(injury.etaDays) || 0)} gün daha` : ''
    return `Bilek/bölge ${recovery}${days}. Bugün ağır grip yok; güvenli hareket yeter.`
  }
  if (mood.key === 'sleep') {
    return `Uyku zayıf. Bugün 25-35 dk hafif hareket, mobilite ve erken kapanış daha iyi.`
  }
  if (mood.key === 'calm') {
    return `Kalp düşük. Nabzı zorlamadan teknik tekrar, yürüyüş ve nefes önde.`
  }
  if (mood.key === 'strain') {
    return `Günlük hareket yüksek. ${latestWorkout ? formatWorkout(latestWorkout) : 'Aktivite'} üstüne ağır PR yerine kalf, ayak bileği ve core bakımı daha iyi.`
  }
  if (readiness != null && readiness >= 78) {
    return `Hazırlık ${readiness}. ${goalTitle} açılır; son set temiz kalsın.`
  }
  if (readiness != null && readiness >= 58) {
    return `Hazırlık ${readiness}. Seans var; önce form, sonra kilo.`
  }
  if (summary) {
    return `Apple kaydı geldi: uyku ${Math.round(Number(summary.sleepScore) || 0)}, kalp ${Math.round(Number(summary.heartScore) || 0)}, yük ${Math.round(Number(summary.strainScore) || 0)}.`
  }
  return 'Kayıt geldikçe cevaplar daha net olacak.'
}

function buildMemoryCards(state = {}) {
  const memories = (state.athleteMemory || [])
    .filter(item => item?.active !== false)
    .slice(0, 3)
    .map(item => ({
      label: cozyTrainingLabel(item.scope || 'hafıza'),
      value: cozyTrainingLabel(item.summary || item.key || 'kalıcı not'),
      tone: String(item.scope || '').includes('recovery') ? 'warn' : String(item.scope || '').includes('parkour') ? 'fire' : 'calm',
    }))
  const wrong = (state.memoryFeedback || []).filter(item => ['wrong', 'outdated'].includes(item.feedbackType || item.feedback_type)).length
  if (wrong) {
    memories.unshift({
      label: 'düzeltme',
      value: `${wrong} eski yorum işaretli; aynı hatayı tekrar etmiyorum.`,
      tone: 'warn',
    })
  }
  return memories.slice(0, 3)
}

function buildQuickPrompts({ summary, latestWorkout, injury, bodyMapState }) {
  const prompts = []
  if (injury) prompts.push('Bilek temkiniyle bugün hangi hareketleri kesiyoruz?')
  if (summary?.totalSleepHours || summary?.sleepScore) prompts.push('Uyku ve HRV bugünkü seansı nasıl değiştiriyor?')
  if (latestWorkout?.source === 'apple_health') prompts.push('Bu yürüyüş bugünkü yorgunluk ve XP hesabına nasıl giriyor?')
  if (bodyMapState?.dailyQuest?.name) prompts.push(`${bodyMapState.dailyQuest.name} görevi neye yaklaştırır?`)
  prompts.push('Bu hafta beni en hızlı ne geliştirir, neyi abartmayalım?')
  return [...new Set(prompts)].slice(0, 4)
}

export function buildOdiePresence({
  state = {},
  profile = {},
  nextSession = {},
  bodyMapState = {},
  today = getLocalDateString(),
} = {}) {
  const latestWorkout = (state.workouts || [])[0] || null
  const summary = getHealthSummary(state)
  const readiness = getReadiness(state, nextSession)
  const sources = sourceStatus(state)
  const injury = activeInjury(state, bodyMapState)
  const mood = chooseMood({ readiness, summary, injury, latestWorkout })
  const signals = buildSignals({ state, summary, readiness, latestWorkout, injury })
  const routine = routineLine({ latestWorkout, summary, today, sources })
  const talk = buildTalk({ mood, readiness, summary, latestWorkout, injury, nextSession, bodyMapState })
  const command = firstDefined(nextSession?.coachCommand, bodyMapState?.dailyQuest?.safeMode, talk)
  const memoryCards = buildMemoryCards(state)
  const dataConfidence = Math.round(clamp(firstDefined(
    nextSession?.confidence,
    summary?.dataConfidence,
    state.health?.vitalScores?.dataConfidence,
    sources.readyCount * 18,
  )))
  const sourceLine = (sources.items || []).slice(0, 4).map(item => (
    item.lit
      ? `${item.label} aktif`
      : ['blocked', 'disabled'].includes(String(item.state || '').toLowerCase())
        ? `${item.label} kapalı`
        : `${item.label} bekliyor`
  )).join(' / ')

  return {
    mood: mood.key,
    tone: mood.tone,
    moodLabel: mood.label,
    headline: mood.key === 'ready'
      ? 'Seans hazır'
      : mood.key === 'guard'
        ? 'Dikkat'
        : mood.key === 'listening'
          ? 'Kayıt bekliyor'
          : 'Durum hazır',
    hudLine: talk,
    chatLine: talk,
    routineLine: routine,
    command,
    dataConfidence,
    sourceLine,
    signals,
    memoryCards,
    quickPrompts: buildQuickPrompts({ summary, latestWorkout, injury, bodyMapState }),
    latestWorkout: latestWorkout ? {
      date: latestWorkout.date,
      label: formatWorkout(latestWorkout),
      source: latestWorkout.source || 'manual',
    } : null,
    healthSummary: summary,
    athleteName: profile.nick || state.profile?.nick || 'Sen',
  }
}
