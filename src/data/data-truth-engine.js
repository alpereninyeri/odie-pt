function statusValue(value = '') {
  return String(value || '').toLowerCase()
}

function firstDefined(...values) {
  return values.find(value => value !== undefined && value !== null && value !== '')
}

function sourceReady(value = '') {
  return ['active', 'ready', 'configured', 'linked', 'protected', 'available', 'synced'].includes(statusValue(value))
}

function sourceBlocked(value = '') {
  return ['blocked', 'disabled', 'missing', 'unauthorized'].includes(statusValue(value))
}

function latestDateFrom(workouts = [], source = '') {
  const needle = statusValue(source)
  const row = (workouts || []).find(workout => statusValue(workout.source) === needle)
  return row?.date || row?.createdAt || row?.created_at || null
}

function countSource(workouts = [], source = '') {
  const needle = statusValue(source)
  return (workouts || []).filter(workout => statusValue(workout.source) === needle).length
}

function appleMode(healthStatus = {}, summary = null, workouts = []) {
  if (healthStatus?.schemaReady === false || healthStatus?.missing || healthStatus?.appleStatus === 'apple_disabled') {
    return {
      state: 'disabled',
      label: 'Apple',
      lit: false,
      detail: 'Apple kapali. Uyku, kalp ve hareket yok diye okunuyor.',
    }
  }

  if (summary?.day) {
    return {
      state: 'active',
      label: 'Apple',
      lit: true,
      detail: `${summary.day}: uyku/kalp/hareket ritme katildi.`,
    }
  }

  const appleWorkoutDate = latestDateFrom(workouts, 'apple_health') || healthStatus?.lastAppleWorkout?.date
  if (appleWorkoutDate) {
    return {
      state: 'active',
      label: 'Apple',
      lit: true,
      detail: `${appleWorkoutDate}: Apple antrenmani gunluk yuke katildi.`,
    }
  }

  if (healthStatus?.authConfigured === false) {
    return {
      state: 'blocked',
      label: 'Apple',
      lit: false,
      detail: 'Apple kapisi hazir degil. ODIE bunu bos okuyor.',
    }
  }

  return {
    state: 'waiting',
    label: 'Apple',
    lit: false,
    detail: 'Apple kapisi acik, ilk uyku/kalp/hareket kaydi bekleniyor.',
  }
}

export function selectTrustedHealthSummary(state = {}) {
  const status = state.healthStatus || null
  if (status && (status.schemaReady === false || status.missing || status.appleStatus === 'apple_disabled')) {
    return null
  }
  return state.healthDailySummary ||
    status?.dailySummary ||
    state.health?.vitalScores?.summary ||
    null
}

export function buildDataTruthMap({
  state = {},
  healthStatus = state.healthStatus || {},
  workouts = state.workouts || [],
  dailyLogs = state.dailyLogs || [],
} = {}) {
  const sources = healthStatus?.sources || {}
  const summary = selectTrustedHealthSummary({ ...state, healthStatus })
  const hevyCount = countSource(workouts, 'hevy')
  const telegramCount = countSource(workouts, 'telegram')
  const webOdieCount = countSource(workouts, 'web_odie')
  const manualCount = countSource(workouts, 'manual')
  const dailyLogCount = (dailyLogs || []).length
  const apple = appleMode(healthStatus || {}, summary, workouts)
  const telegramState = firstDefined(sources.telegram, telegramCount ? 'active' : '')
  const odieState = firstDefined(sources.odieIntake, healthStatus?.privateConfigured === true ? 'protected' : 'blocked')
  const hevyState = firstDefined(sources.hevy, hevyCount ? 'active' : 'waiting')
  const manualState = firstDefined(sources.manual, manualCount || dailyLogCount ? 'active' : 'available')

  const items = [
    {
      key: 'hevy',
      label: 'Hevy',
      state: hevyCount ? 'active' : statusValue(hevyState || 'waiting'),
      lit: hevyCount > 0,
      detail: hevyCount
        ? `${hevyCount} kuvvet kaydi ritme bagli.`
        : sourceReady(hevyState)
          ? 'Hevy kapisi hazir; yeni seans bekleniyor.'
          : 'Hevy kapisi bekliyor.',
      count: hevyCount,
      latestAt: latestDateFrom(workouts, 'hevy'),
    },
    {
      key: 'telegram',
      label: 'Telegram',
      state: telegramCount ? 'active' : statusValue(telegramState || 'waiting'),
      lit: telegramCount > 0 || sourceReady(telegramState),
      detail: telegramCount
        ? `${telegramCount} Telegram kaydi ritme bagli.`
        : sourceReady(telegramState)
          ? 'Telegram komutu hazir; mesaj bekleniyor.'
          : 'Telegram kapisi bekliyor.',
      count: telegramCount,
      latestAt: latestDateFrom(workouts, 'telegram'),
    },
    {
      ...apple,
      key: 'apple',
      count: countSource(workouts, 'apple_health'),
      latestAt: latestDateFrom(workouts, 'apple_health') || healthStatus?.lastSyncAt || null,
    },
    {
      key: 'odie',
      label: 'ODIE',
      state: sourceBlocked(odieState) ? 'blocked' : statusValue(odieState || 'waiting'),
      lit: sourceReady(odieState),
      detail: sourceReady(odieState)
        ? `${webOdieCount || 0} ODIE kaydi; onayli kartlar yazilabilir.`
        : 'ODIE kayit kapisi kapali. Netlestirir ama yazmaz.',
      count: webOdieCount,
      latestAt: latestDateFrom(workouts, 'web_odie'),
    },
    {
      key: 'manual',
      label: 'Yerel',
      state: statusValue(manualState || 'available'),
      lit: manualCount > 0 || dailyLogCount > 0,
      detail: manualCount || dailyLogCount
        ? `${manualCount + dailyLogCount} yerel bakim izi var.`
        : 'Yerel kayit yedek hat olarak duruyor.',
      count: manualCount + dailyLogCount,
      latestAt: latestDateFrom(workouts, 'manual') || dailyLogs?.[0]?.date || null,
    },
  ]

  const readyCount = items.filter(item => item.lit).length

  return {
    schemaReady: healthStatus?.schemaReady === true && !healthStatus?.missing,
    appleStatus: healthStatus?.appleStatus || apple.state,
    appleDisabled: apple.state === 'disabled',
    healthImportConfigured: healthStatus?.authConfigured === true,
    privateConfigured: healthStatus?.privateConfigured === true,
    readyCount,
    totalCount: items.length,
    summary,
    items,
    byKey: items.reduce((acc, item) => {
      acc[item.key] = item
      return acc
    }, {}),
  }
}
