import { formatMonthShort, getLocalDateString, normalizeDateString } from './rules.js'

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
  return String(value || 'seans')
    .replace(/\btrunk control\b/gi, 'govde kontrolu')
    .replace(/\bbuild['’]?i\b/gi, 'rotasi')
    .replace(/\bbuild\w*\b/gi, 'rota')
    .replace(/\bPush\b/gi, 'Itis')
    .replace(/\bPull\b/gi, 'Cekis')
    .replace(/\bCore\b/gi, 'Govde')
    .replace(/\bWorkout\b/gi, 'Antrenman')
    .replace(/\bRecovery\b/gi, 'Toparlanma')
    .replace(/\bStrength\b/gi, 'Kuvvet')
    .replace(/\bMobility\b/gi, 'Mobilite')
    .replace(/\bGlobal\b/gi, 'Genel')
    .replace(/\bClass\b/gi, 'Sinif')
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
  const sources = state.healthStatus?.sources || {}
  return {
    hevy: sources.hevy || ((state.workouts || []).some(item => String(item.source || '').toLowerCase() === 'hevy') ? 'active' : 'waiting'),
    appleWorkout: sources.appleWorkout || 'waiting',
    appleSleep: sources.appleSleep || 'waiting',
    appleHeart: sources.appleHeart || 'waiting',
    manual: sources.manual || 'available',
    schemaReady: state.healthStatus?.schemaReady !== false && !state.healthStatus?.missing,
    readyCount: [
      sourceReady(sources, 'hevy'),
      sourceReady(sources, 'appleWorkout'),
      sourceReady(sources, 'appleSleep'),
      sourceReady(sources, 'appleHeart'),
      sources.manual === 'available',
    ].filter(Boolean).length,
  }
}

function activeInjury(state = {}, bodyMapState = {}) {
  const bodyInjury = bodyMapState?.injuries?.[0] || bodyMapState?.priority?.region?.injury || null
  if (bodyInjury) return bodyInjury
  const event = (state.bodyEvents || []).find(item => String(item.status || 'active') === 'active')
  if (!event) return null
  return {
    label: event.regionLabel || event.region || 'Beden kaydi',
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
      detail: summary.hrvSdnn ? `HRV ${Math.round(Number(summary.hrvSdnn))}` : summary.restingHeartRate ? `RHR ${Math.round(Number(summary.restingHeartRate))}` : 'nabiz bekliyor',
      tone: Number(summary.heartScore) < 45 ? 'danger' : 'calm',
    })
    signals.push({
      key: 'strain',
      label: 'Gun yuku',
      value: Number.isFinite(Number(summary.strainScore)) ? Math.round(Number(summary.strainScore)) : '--',
      detail: summary.steps ? `${Math.round(Number(summary.steps)).toLocaleString('tr-TR')} adim` : 'aktivite bekliyor',
      tone: Number(summary.strainScore) > 72 ? 'warn' : 'calm',
    })
  } else {
    signals.push({ key: 'sleep', label: 'Uyku', value: '--', detail: 'Apple bekliyor', tone: 'muted' })
    signals.push({ key: 'heart', label: 'Kalp', value: '--', detail: 'HRV bekliyor', tone: 'muted' })
  }

  signals.push({
    key: 'readiness',
    label: 'Hazirlik',
    value: readiness ?? '--',
    detail: latestWorkout ? formatMonthShort(latestWorkout.date) : `${state.workouts?.length || 0} seans`,
    tone: readiness != null && readiness < 45 ? 'danger' : readiness != null && readiness < 65 ? 'warn' : 'calm',
  })

  if (injury) {
    signals.push({
      key: 'injury',
      label: 'Temkin',
      value: injury.recoveryPct != null ? `%${Math.round(Number(injury.recoveryPct) || 0)}` : 'aktif',
      detail: injury.etaDays != null ? `${Math.round(Number(injury.etaDays) || 0)} gun` : 'sakatlik',
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
      return `${formatWorkout(latestWorkout)} kaydi yasam yukune yazildi; bunu sadece kardiyo diye gecmiyorum.`
    }
    if (age === 0) return `${formatWorkout(latestWorkout)} bugun geldi; karar motoru bunu canli okuyor.`
    if (age === 1) return `${formatWorkout(latestWorkout)} dun geldi; bugun etkisi hala masada.`
    return `${formatWorkout(latestWorkout)} ${age} gun onceydi; yeni veri gelene kadar temkinli okuyorum.`
  }
  if (summary?.steps || summary?.totalSleepHours) {
    return `Bugun ${Math.round(Number(summary.steps) || 0).toLocaleString('tr-TR')} adim ve ${Math.round((Number(summary.totalSleepHours) || Number(summary.sleepHours) || 0) * 10) / 10}s uyku var.`
  }
  if (!sources.schemaReady) return 'Health ledger hazir degil; migration acilinca Apple uyku, kalp ve hareket karar motoruna dusecek.'
  return 'Hevy, Apple ve manuel kayit bekleniyor; veri geldikce dilim de sertlesir.'
}

function chooseMood({ readiness, summary, injury, latestWorkout }) {
  if (injury) return { key: 'guard', label: 'temkin modu', tone: 'warn' }
  if (Number(summary?.sleepScore) > 0 && Number(summary.sleepScore) < 42) return { key: 'sleep', label: 'kalkan onarimi', tone: 'warn' }
  if (Number(summary?.heartScore) > 0 && Number(summary.heartScore) < 42) return { key: 'calm', label: 'sakin gun', tone: 'danger' }
  if (Number(summary?.strainScore) > 78) return { key: 'strain', label: 'gun yuku fazla', tone: 'warn' }
  if (readiness != null && readiness >= 78) return { key: 'ready', label: 'seans acilir', tone: 'fire' }
  if (readiness != null && readiness >= 58) return { key: 'steady', label: 'kontrollu tempo', tone: 'calm' }
  if (latestWorkout) return { key: 'read', label: 'baglam okunuyor', tone: 'calm' }
  return { key: 'listening', label: 'veri bekliyor', tone: 'muted' }
}

function buildTalk({ mood, readiness, summary, latestWorkout, injury, nextSession, bodyMapState }) {
  const goalTitle = nextSession?.primaryGoal?.title || bodyMapState?.dailyQuest?.name || 'Temiz Gun'
  if (injury) {
    const recovery = injury.recoveryPct != null ? `%${Math.round(Number(injury.recoveryPct) || 0)} toparlandi` : 'temkin aktif'
    const days = injury.etaDays != null ? `, ${Math.round(Number(injury.etaDays) || 0)} gun daha` : ''
    return `Bilek/bolge kaydi ${recovery}${days}. Bugun agir grip ve ego setini kilitliyorum; puan guvenli secimden gelir.`
  }
  if (mood.key === 'sleep') {
    return `Uyku kalkanin ince. Bugun buyuk kahramanlik degil; 25-35 dk hafif hareket, mobilite ve erken kapanis daha akilli.`
  }
  if (mood.key === 'calm') {
    return `Kalp sinyali sakin gun diyor. Nabiz/HRV tarafini zorlamadan teknik tekrar, yuruyus ve nefes isini onde tutuyoruz.`
  }
  if (mood.key === 'strain') {
    return `Gunluk hareket yuku yuksek. ${latestWorkout ? formatWorkout(latestWorkout) : 'Aktivite'} ustune agir PR koymak yerine kalf, ayak bilegi ve core bakimi daha iyi.`
  }
  if (readiness != null && readiness >= 78) {
    return `Hazirlik ${readiness}. ${goalTitle} acilir ama yine de son seti temiz formda birakiyoruz; bugun akilli artis gunu.`
  }
  if (readiness != null && readiness >= 58) {
    return `Hazirlik ${readiness}. Seans var, ama ben bunu kontrollu tempo diye okuyorum; once form, sonra kilo.`
  }
  if (summary) {
    return `Apple verisi iceri giriyor: uyku ${Math.round(Number(summary.sleepScore) || 0)}, kalp ${Math.round(Number(summary.heartScore) || 0)}, yuk ${Math.round(Number(summary.strainScore) || 0)}. Simdi ODIE sadece Hevy'ye bakmiyor.`
  }
  return 'Seni tanimaya devam ediyorum. Hevy, Apple ve manuel notlar geldikce cevaplar daha az panel, daha cok yaninda konusan koc gibi olacak.'
}

function buildMemoryCards(state = {}) {
  const memories = (state.athleteMemory || [])
    .filter(item => item?.active !== false)
    .slice(0, 3)
    .map(item => ({
      label: cozyTrainingLabel(item.scope || 'hafiza'),
      value: cozyTrainingLabel(item.summary || item.key || 'kalici not'),
      tone: String(item.scope || '').includes('recovery') ? 'warn' : String(item.scope || '').includes('parkour') ? 'fire' : 'calm',
    }))
  const wrong = (state.memoryFeedback || []).filter(item => ['wrong', 'outdated'].includes(item.feedbackType || item.feedback_type)).length
  if (wrong) {
    memories.unshift({
      label: 'duzeltme',
      value: `${wrong} eski yorum isaretli; ayni hatayi tekrar etmiyorum.`,
      tone: 'warn',
    })
  }
  return memories.slice(0, 3)
}

function buildQuickPrompts({ summary, latestWorkout, injury, bodyMapState }) {
  const prompts = []
  if (injury) prompts.push('Bilek temkiniyle bugun hangi hareketleri kesiyoruz?')
  if (summary?.totalSleepHours || summary?.sleepScore) prompts.push('Uyku ve HRV bugunku seansi nasil degistiriyor?')
  if (latestWorkout?.source === 'apple_health') prompts.push('Bu yuruyus bugunku yorgunluk ve XP hesabina nasil giriyor?')
  if (bodyMapState?.dailyQuest?.name) prompts.push(`${bodyMapState.dailyQuest.name} gorevi hangi acilima yaklastirir?`)
  prompts.push('Bu hafta beni en hizli ne gelistirir, neyi abartmayalim?')
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
  const sourceLine = [
    sources.hevy === 'configured' || sources.hevy === 'active' ? 'Hevy aktif' : 'Hevy bekliyor',
    sources.appleWorkout === 'ready' || sources.appleWorkout === 'active' ? 'Antrenman geldi' : 'Antrenman bekliyor',
    sources.appleSleep === 'ready' || sources.appleSleep === 'active' ? 'Uyku geldi' : 'Uyku bekliyor',
    sources.appleHeart === 'ready' || sources.appleHeart === 'active' ? 'Kalp geldi' : 'Kalp bekliyor',
  ].join(' / ')

  return {
    mood: mood.key,
    tone: mood.tone,
    moodLabel: mood.label,
    headline: mood.key === 'ready'
      ? 'ODIE seansi aciyor'
      : mood.key === 'guard'
        ? 'ODIE frene basti'
        : mood.key === 'listening'
          ? 'ODIE veri bekliyor'
          : 'ODIE izleri okuyor',
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
