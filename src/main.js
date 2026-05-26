import './styles/riftline.css'
import { store } from './data/store.js'
import { buildBodyMapState } from './data/body-map-engine.js'
import { BODY_REGION_OPTIONS } from './data/body-events.js'
import { buildNextSessionRecommendation } from './data/next-session-engine.js'
import { buildSemanticProfile } from './data/semantic-profile.js'
import { initTelegramMiniApp } from './data/telegram-webapp.js'
import { getLocalDateString, normalizeDateString } from './data/rules.js'

const TABS = [
  { key: 'route', label: 'Bugun', hint: 'Plan' },
  { key: 'map', label: 'Harita', hint: 'Vucut' },
  { key: 'log', label: 'Kayit', hint: 'Aktivite' },
  { key: 'signal', label: 'Odie', hint: 'Soru' },
]

const PRESETS = {
  Gym: { type: 'Gym', durationMin: 55, distanceKm: 0, label: 'Gym', note: 'ana blok + destek' },
  Parkour: { type: 'Parkour', durationMin: 75, distanceKm: 0, label: 'Parkur', note: 'flow, inis, teknik' },
  Walk: { type: 'Yuruyus', durationMin: 35, distanceKm: 3, label: 'Yuruyus', note: 'dusuk nabiz rota' },
  Recovery: { type: 'Stretching', durationMin: 20, distanceKm: 0, label: 'Recovery', note: 'mobilite, nefes, bakim' },
  Acro: { type: 'Akrobasi', durationMin: 45, distanceKm: 0, label: 'Akro', note: 'kontrollu gecis' },
}

const WORKOUT_TYPES = [
  'Gym',
  'Push',
  'Pull',
  'Shoulder',
  'Bacak',
  'Parkour',
  'Akrobasi',
  'Calisthenics',
  'Yuruyus',
  'Kosu',
  'Bisiklet',
  'Tirmanis',
  'Stretching',
  'Custom',
]

let activeTab = readInitialTab()
let selectedPreset = 'Gym'
let renderQueued = false
let lastMarkup = ''
let logNotice = ''
let signalNotice = ''
let syncBusy = false
let askState = {
  items: null,
  loading: false,
  submitting: false,
  error: '',
  result: null,
}

initRuntime()

async function initRuntime() {
  document.documentElement.setAttribute('data-theme', 'riftline')
  initTelegramMiniApp()

  bindGlobalEvents()
  renderApp()

  try {
    const initPromise = store.init()
    window.setTimeout(() => scheduleRender({ immediate: true }), 700)
    await initPromise
  } catch (error) {
    console.warn('[riftline] store init failed:', error?.message || error)
  }

  renderApp()
  window.setInterval(() => store.refreshRecovery(), 5 * 60 * 1000)
  store.subscribe('*', () => scheduleRender())
}

function readInitialTab() {
  const requested = new URLSearchParams(window.location.search).get('tab')
  if (TABS.some(tab => tab.key === requested)) return requested
  try {
    const stored = localStorage.getItem('riftline-tab')
    if (TABS.some(tab => tab.key === stored)) return stored
  } catch {}
  return 'route'
}

function bindGlobalEvents() {
  document.addEventListener('click', handleClick)
  document.addEventListener('submit', handleSubmit)
}

function scheduleRender({ immediate = false } = {}) {
  if (immediate) {
    renderQueued = false
    renderApp()
    return
  }
  if (renderQueued) return
  renderQueued = true
  window.requestAnimationFrame(() => {
    renderQueued = false
    renderApp()
  })
}

function renderApp() {
  const state = store.getState() || {}
  const profile = store.getProfile() || {}
  const model = buildRiftlineModel(state, profile)
  const markup = renderShell(model)

  if (markup !== lastMarkup) {
    const app = document.getElementById('app')
    if (app) app.innerHTML = markup
    lastMarkup = markup
  }

  if (activeTab === 'signal' && !askState.items && !askState.loading) {
    loadAskHistory()
  }
}

function buildRiftlineModel(state = {}, profile = {}) {
  const workouts = state.workouts || []
  const dailyLogs = state.dailyLogs || []
  const semantic = buildSemanticProfile(workouts, dailyLogs)
  const bodyMap = state.bodyMapState || buildBodyMapState({ state, profile, semantic })
  const healthSummary = state.healthDailySummary || state.healthStatus?.dailySummary || state.health?.vitalScores?.summary || null
  const nextSession = buildNextSessionRecommendation({
    profile: { ...(state.profile || {}), ...profile },
    workouts,
    dailyLogs,
    memoryFeedback: state.memoryFeedback || [],
    health: { ...(state.health || {}), dailySummary: healthSummary },
    bodyEvents: state.bodyEvents || [],
  })

  const latestWorkout = workouts[0] || null
  const todayLog = dailyLogs.find(log => normalizeDateString(log.date) === getLocalDateString()) || {}
  const stats = normalizeStats(profile.stats || [])
  const zones = buildZoneCards(workouts, bodyMap, nextSession)
  const sourceHealth = nextSession.sourceHealth || {}

  return {
    state,
    profile,
    workouts,
    dailyLogs,
    todayLog,
    healthSummary,
    latestWorkout,
    semantic,
    bodyMap,
    nextSession,
    stats,
    zones,
    sources: buildSources(sourceHealth, workouts, dailyLogs, healthSummary),
    timeline: buildTimeline(workouts, dailyLogs, state.bodyEvents || []),
    system: {
      readiness: nextSession.readiness || {},
      confidence: clamp(nextSession.confidence, 0, 100),
      tone: nextSession.tone || 'calm',
      sourceHealth,
    },
  }
}

function normalizeStats(stats = []) {
  return (stats || []).map(stat => ({
    key: stat.key || stat.label || '',
    label: stat.label || String(stat.key || '').toUpperCase(),
    name: cleanText(stat.name || stat.label || stat.key || 'Stat'),
    value: clamp(Number(stat.scaleScore ?? stat.val ?? stat.rawVal), 0, 100),
    rank: stat.rank || rankFromValue(stat.scaleScore ?? stat.val),
    rankLabel: stat.rankLabel || '',
    confidence: stat.confidence || 'seed',
    progress: clamp(Number(stat.progressToNext ?? stat.val), 0, 100),
  }))
}

function buildSources(sourceHealth = {}, workouts = [], dailyLogs = [], healthSummary = null) {
  const latest = workouts[0]
  return [
    {
      key: 'hevy',
      label: 'Hevy',
      lit: Number(sourceHealth.hevyCount) > 0,
      detail: sourceHealth.latestHevyDate || 'bekliyor',
    },
    {
      key: 'health',
      label: 'Saglik',
      lit: Boolean(sourceHealth.appleSleepLinked || sourceHealth.appleHeartLinked || healthSummary),
      detail: healthSummary?.day || sourceHealth.latestAppleHealthDate || 'bekliyor',
    },
    {
      key: 'log',
      label: 'Kayit',
      lit: workouts.length > 0 || dailyLogs.length > 0,
      detail: latest?.date || dailyLogs[0]?.date || 'bos',
    },
    {
      key: 'manual',
      label: 'Manuel',
      lit: workouts.some(workout => String(workout.source || '').toLowerCase() === 'manual'),
      detail: `${workouts.length} kayit`,
    },
  ]
}

function buildZoneCards(workouts = [], bodyMap = {}, nextSession = {}) {
  const recent = workouts.slice(0, 30)
  const count = predicate => recent.filter(predicate).length
  const priority = bodyMap.priority || {}
  const quest = bodyMap.dailyQuest || {}

  const zones = [
    {
      key: 'gym',
      title: 'Gym hatti',
      label: 'Gym',
      count: count(isStrengthSession),
      detail: nextSession.questImpact?.balance?.lowest?.label
        ? `${nextSession.questImpact.balance.lowest.label} one al`
        : 'kuvvet hatti',
      tone: 'steel',
    },
    {
      key: 'parkour',
      title: 'Parkur hatti',
      label: 'Parkur',
      count: count(isParkourSession),
      detail: priority.movement?.todayStep || 'flow / inis',
      tone: 'amber',
    },
    {
      key: 'walk',
      title: 'Yuruyus hatti',
      label: 'Yuruyus',
      count: count(isWalkSession),
      detail: 'dusuk nabiz rota',
      tone: 'green',
    },
    {
      key: 'recovery',
      title: 'Toparlanma',
      label: 'Recovery',
      count: count(isRecoverySession),
      detail: quest.safeMode ? 'risk kapisi aktif' : 'bakim hatti',
      tone: 'blue',
    },
    {
      key: 'acro',
      title: 'Akro hatti',
      label: 'Akro',
      count: count(isAcroSession),
      detail: priority.unlock?.name || 'gecis kilidi',
      tone: 'red',
    },
  ]

  return zones.map(zone => ({
    ...zone,
    heat: clamp((zone.count / Math.max(1, recent.length || 1)) * 100, 8, 100),
  }))
}

function buildTimeline(workouts = [], dailyLogs = [], bodyEvents = []) {
  const workoutItems = workouts.slice(0, 8).map(item => ({
    kind: String(item.source || 'manual').toLowerCase(),
    title: displayWorkoutType(item.type || 'Seans'),
    date: item.date,
    detail: [
      item.durationMin ? `${Math.round(item.durationMin)} dk` : '',
      item.distanceKm ? `${Number(item.distanceKm).toFixed(1)} km` : '',
      item.volumeKg ? `${formatNumber(item.volumeKg)} kg` : '',
    ].filter(Boolean).join(' / ') || cleanText(item.highlight || 'kayit'),
  }))
  const dailyItems = dailyLogs.slice(0, 4).map(item => ({
    kind: 'daily',
    title: 'Daily signal',
    date: item.date,
    detail: [
      item.sleepHours ? `${item.sleepHours}s uyku` : '',
      item.steps ? `${formatNumber(item.steps)} adim` : '',
      item.waterMl ? `${(Number(item.waterMl) / 1000).toFixed(1)}L su` : '',
    ].filter(Boolean).join(' / ') || 'gunluk not',
  }))
  const bodyItems = bodyEvents.slice(0, 3).map(item => ({
    kind: 'body',
    title: cleanText(item.label || item.region || 'Body event'),
    date: item.createdAt || item.expectedClearAt || getLocalDateString(),
    detail: cleanText(item.odieInterpretation?.command || item.note || 'temkin'),
  }))

  return [...workoutItems, ...dailyItems, ...bodyItems]
    .sort((left, right) => String(right.date || '').localeCompare(String(left.date || '')))
    .slice(0, 10)
}

function renderShell(model) {
  return `
    <div class="rift-shell tone-${escapeAttr(model.system.tone)}">
      <header class="rift-topbar">
        <button class="rift-mark" type="button" data-tab="route" aria-label="Riftline route ekranina don">
          <span class="rift-mark-grid" aria-hidden="true"></span>
          <span>
            <b>Riftline</b>
            <small>${escapeHtml(cleanText(model.profile.handle || model.profile.nick || 'athlete'))}</small>
          </span>
        </button>
        <div class="source-rail" aria-label="Canli veri kaynaklari">
          ${model.sources.map(renderSourceDot).join('')}
        </div>
      </header>

      <main class="rift-main" aria-label="${escapeAttr(activeTab)}">
        ${renderActiveScreen(model)}
      </main>

      <nav class="rift-nav" aria-label="Riftline navigation">
        ${TABS.map(tab => renderNavTab(tab)).join('')}
      </nav>
    </div>
  `
}

function renderActiveScreen(model) {
  switch (activeTab) {
    case 'map':
      return renderMapScreen(model)
    case 'log':
      return renderLogScreen(model)
    case 'signal':
      return renderSignalScreen(model)
    case 'route':
    default:
      return renderRouteScreen(model)
  }
}

function renderRouteScreen(model) {
  const next = model.nextSession
  const ready = model.system.readiness
  const goal = next.primaryGoal || {}
  const xp = model.profile.xp || {}
  const xpPct = clamp(((Number(xp.current) || 0) / Math.max(1, Number(xp.max) || 1)) * 100, 0, 100)
  const latest = model.latestWorkout

  return `
    <section class="screen route-screen">
      <div class="route-hero">
        <div class="route-hero-copy">
          <span class="route-kicker">${escapeHtml(toneLabel(next.tone))} / ${escapeHtml(next.date || getLocalDateString())}</span>
          <h1>${escapeHtml(cleanText(goal.title || 'Bugunun rotasi'))}</h1>
          <p>${escapeHtml(cleanText(goal.subtitle || next.coachCommand || 'Hatti temiz kapat.'))}</p>
        </div>
        <div class="level-chip" style="--xp:${xpPct}%">
          <span>LVL</span>
          <b>${escapeHtml(String(model.profile.level || 1))}</b>
        </div>
      </div>

      <section class="route-canvas" aria-label="Bugunun rota hatti">
        <div class="city-grid" aria-hidden="true"></div>
        ${renderRouteNodes(next)}
        <div class="command-dock">
          <div>
            <span>Bugunun karari</span>
            <strong>${escapeHtml(cleanText(next.coachCommand || 'Bugun tek temiz adim yeter.'))}</strong>
          </div>
          <button class="primary-action" type="button" data-tab="log">Kayit gir</button>
        </div>
      </section>

      <section class="metric-strip" aria-label="Canli durum">
        ${renderMetric('Hazir', ready.score, 'ready')}
        ${renderMetric('Dayanim', ready.armor, 'armor')}
        ${renderMetric('Yuk', ready.fatigue, 'load', true)}
        ${renderMetric('Netlik', model.system.confidence, 'signal')}
      </section>

      <section class="split-grid">
        <article class="panel latest-panel">
          <div class="panel-head">
            <span>Son kayit</span>
            <button type="button" class="ghost-btn" data-refresh>${syncBusy ? 'Cekiliyor' : 'Sync'}</button>
          </div>
          ${latest ? `
            <strong>${escapeHtml(displayWorkoutType(latest.type || 'Seans'))}</strong>
            <p>${escapeHtml(cleanText(latest.highlight || latest.notes || 'Son kayit hatta.'))}</p>
            <div class="meta-row">
              <span>${escapeHtml(latest.date || '-')}</span>
              <span>${escapeHtml(String(latest.source || 'manual').toUpperCase())}</span>
              <span>${latest.durationMin ? `${Math.round(latest.durationMin)} dk` : 'sure yok'}</span>
            </div>
          ` : `
            <strong>Ilk hat bekliyor</strong>
            <p>Hevy, Telegram veya manuel Log ile Riftline canlanacak.</p>
          `}
        </article>

        <article class="panel">
          <div class="panel-head">
            <span>Statlar</span>
            <span>${escapeHtml(model.profile.class || 'profil')}</span>
          </div>
          <div class="stat-rack">
            ${model.stats.slice(0, 6).map(renderStatPill).join('')}
          </div>
        </article>
      </section>

      ${renderWarnings(next)}
    </section>
  `
}

function renderRouteNodes(next = {}) {
  const blocks = next.blocks?.length ? next.blocks : [
    { kind: 'prep', label: 'Prep', target: '5 dk', intensity: 'easy' },
    { kind: 'main', label: 'Main', target: next.primaryGoal?.title || 'route', intensity: 'moderate' },
    { kind: 'exit', label: 'Exit', target: 'log', intensity: 'easy' },
  ]

  return `
    <div class="route-line" aria-hidden="true"></div>
    <div class="route-nodes">
      ${blocks.slice(0, 4).map((block, index) => `
        <article class="route-node intensity-${escapeAttr(block.intensity || 'moderate')}" style="--i:${index}">
          <span>${String(index + 1).padStart(2, '0')}</span>
          <b>${escapeHtml(cleanText(block.label || block.kind || 'Node'))}</b>
          <small>${escapeHtml(cleanText(block.target || block.reason || 'temiz tekrar'))}</small>
        </article>
      `).join('')}
    </div>
  `
}

function renderMapScreen(model) {
  const priority = model.bodyMap.priority || {}
  const quest = model.bodyMap.dailyQuest || {}
  const regions = [...(model.bodyMap.regions || [])]
    .sort((left, right) => (right.risk || 0) - (left.risk || 0))
    .slice(0, 10)
  const movementLines = [...(model.bodyMap.movementLines || [])]
    .sort((left, right) => (right.progress || right.score || 0) - (left.progress || left.score || 0))
    .slice(0, 5)

  return `
    <section class="screen map-screen">
      <div class="screen-title">
        <span>Harita</span>
        <h1>${escapeHtml(cleanText(priority.region?.label || 'Hat haritasi'))}</h1>
        <p>${escapeHtml(cleanText(quest.desc || priority.movement?.todayStep || 'Bugunun baski noktasi burada.'))}</p>
      </div>

      <section class="map-board">
        <div class="map-spine" aria-hidden="true"></div>
        ${model.zones.map(renderZoneCard).join('')}
      </section>

      <section class="split-grid">
        <article class="panel">
          <div class="panel-head">
            <span>Bolge riski</span>
            <span>${escapeHtml(cleanText(priority.region?.trend || 'tarama'))}</span>
          </div>
          <div class="region-list">
            ${regions.map(renderRegionRow).join('')}
          </div>
        </article>

        <article class="panel">
          <div class="panel-head">
            <span>Hareket hatlari</span>
            <span>${escapeHtml(cleanText(priority.unlock?.name || 'kilit'))}</span>
          </div>
          <div class="movement-list">
            ${movementLines.map(renderMovementLine).join('')}
          </div>
        </article>
      </section>
    </section>
  `
}

function renderLogScreen(model) {
  const preset = PRESETS[selectedPreset] || PRESETS.Gym
  const today = getLocalDateString()
  const log = model.todayLog || {}

  return `
    <section class="screen log-screen">
      <div class="screen-title compact">
        <span>Kayit</span>
        <h1>Aktivite kaydi</h1>
        <p>Seansi, yuruyusu veya parkouru tek formdan kaydet.</p>
      </div>

      ${logNotice ? `<div class="notice"><span>${escapeHtml(logNotice)}</span><button type="button" data-clear-notice>OK</button></div>` : ''}

      <div class="preset-rail" aria-label="Kayit presetleri">
        ${Object.entries(PRESETS).map(([key, item]) => `
          <button type="button" class="preset-btn ${selectedPreset === key ? 'active' : ''}" data-preset="${escapeAttr(key)}">
            <b>${escapeHtml(item.label)}</b>
            <span>${escapeHtml(item.note)}</span>
          </button>
        `).join('')}
      </div>

      <form class="panel log-form" id="route-log-form">
        <div class="form-grid">
          <label>
            <span>Tarih</span>
            <input name="date" type="date" value="${escapeAttr(today)}" required>
          </label>
          <label>
            <span>Tip</span>
            <select name="type">
              ${WORKOUT_TYPES.map(type => `<option value="${escapeAttr(type)}" ${type === preset.type ? 'selected' : ''}>${escapeHtml(displayWorkoutType(type))}</option>`).join('')}
            </select>
          </label>
          <label>
            <span>Sure dk</span>
            <input name="durationMin" type="number" min="1" max="720" value="${escapeAttr(preset.durationMin)}" required>
          </label>
          <label>
            <span>Mesafe km</span>
            <input name="distanceKm" type="number" min="0" step="0.1" value="${escapeAttr(preset.distanceKm)}">
          </label>
          <label>
            <span>Yukselti m</span>
            <input name="elevationM" type="number" min="0" step="1" value="0">
          </label>
        </div>
        <label>
          <span>Kisa not</span>
          <input name="highlight" type="text" maxlength="90" value="${escapeAttr(preset.note)}" placeholder="or: 8 dk core + 3 temiz set">
        </label>
        <label>
          <span>Detay</span>
          <textarea name="notes" rows="3" placeholder="zemin, yorgunluk, risk, teknik his..."></textarea>
        </label>
        <button class="primary-action full" type="submit">Kaydi tamamla</button>
      </form>

      <section class="split-grid">
        <article class="panel daily-panel">
          <div class="panel-head">
            <span>Gunluk durum</span>
            <span>${escapeHtml(today)}</span>
          </div>
          ${renderDailyControls(log)}
        </article>

        <form class="panel body-form" id="body-event-form">
          <div class="panel-head">
            <span>Vucut notu</span>
            <span>risk</span>
          </div>
          <label>
            <span>Bolge</span>
            <select name="region">
              ${BODY_REGION_OPTIONS.map(item => `<option value="${escapeAttr(item.id)}">${escapeHtml(item.label)}</option>`).join('')}
            </select>
          </label>
          <div class="form-grid two">
            <label>
              <span>Siddet</span>
              <input name="severity" type="number" min="1" max="5" value="3">
            </label>
            <label>
              <span>Toparlanma %</span>
              <input name="recoveryPercent" type="number" min="0" max="100" value="70">
            </label>
          </div>
          <label>
            <span>Not</span>
            <input name="note" type="text" maxlength="120" placeholder="or: bilek sert push istemiyor">
          </label>
          <button class="ghost-action full" type="submit">Vucut notu ekle</button>
        </form>
      </section>
    </section>
  `
}

function renderSignalScreen(model) {
  const note = model.state.coachNote || {}
  const sections = Array.isArray(note.sections) ? note.sections : []
  const result = askState.result

  return `
    <section class="screen signal-screen">
      <div class="screen-title">
        <span>ODIE</span>
        <h1>ODIE hatti</h1>
        <p>${escapeHtml(cleanText(model.nextSession.coachCommand || 'Sinyal netlestikce bugunun rotasi sertlesir.'))}</p>
      </div>

      ${signalNotice ? `<div class="notice"><span>${escapeHtml(signalNotice)}</span><button type="button" data-clear-signal>OK</button></div>` : ''}

      <section class="split-grid signal-grid">
        <article class="panel signal-feed">
          <div class="panel-head">
            <span>Rota notu</span>
            <span>${escapeHtml(note.date || model.nextSession.date || '')}</span>
          </div>
          ${note.xpNote ? `<strong>${escapeHtml(cleanText(note.xpNote))}</strong>` : '<strong>Canli coach notu bekliyor</strong>'}
          ${sections.length ? sections.slice(0, 4).map(section => `
            <div class="signal-section">
              <b>${escapeHtml(cleanText(section.title || section.heading || 'Signal'))}</b>
              <p>${escapeHtml(cleanText(section.body || section.text || section.note || ''))}</p>
            </div>
          `).join('') : `<p>${escapeHtml(cleanText(model.nextSession.evidence?.[0] || 'Hevy, Saglik veya manuel kayit gelince burasi keskinlesir.'))}</p>`}
          <div class="feedback-row">
            <button type="button" data-feedback="correct">DOGRU</button>
            <button type="button" data-feedback="wrong">YANLIS</button>
            <button type="button" data-feedback="outdated">ESKI</button>
            <button type="button" data-feedback="tone_good">TONU IYI</button>
          </div>
        </article>

        <article class="panel ask-panel">
          <div class="panel-head">
            <span>Sinyal sor</span>
            <span>${askState.loading ? 'load' : 'ask'}</span>
          </div>
          <form id="ask-form" class="ask-form">
            <textarea name="question" rows="4" placeholder="Bugun parkour mu, recovery mi?"></textarea>
            <button class="primary-action full" type="submit" ${askState.submitting ? 'disabled' : ''}>${askState.submitting ? 'Sinyal aliniyor' : 'ODIE sinyali al'}</button>
          </form>
          ${askState.error ? `<p class="error-line">${escapeHtml(askState.error)}</p>` : ''}
          ${result ? renderAskResult(result) : renderAskHistory()}
        </article>
      </section>

      <section class="panel evidence-panel">
        <div class="panel-head">
          <span>Kanit</span>
          <span>${escapeHtml(String(model.system.confidence))}%</span>
        </div>
        <div class="evidence-list">
          ${(model.nextSession.evidence || []).slice(0, 6).map(item => `<span>${escapeHtml(cleanText(item))}</span>`).join('') || '<span>Veri bekliyor</span>'}
        </div>
      </section>
    </section>
  `
}

function renderDailyControls(log = {}) {
  const water = Number(log.waterMl) || 0
  const sleep = Number(log.sleepHours) || 0
  const steps = Number(log.steps) || 0
  const mood = Number(log.mood) || 0
  return `
    <div class="daily-grid">
      <div class="daily-line">
        <span>Su</span>
        <b>${(water / 1000).toFixed(1)}L</b>
        <button type="button" data-daily-action="water" data-amount="500">+0.5L</button>
      </div>
      <label class="daily-line">
        <span>Uyku</span>
        <input id="sleep-input" type="number" min="0" max="16" step="0.5" value="${escapeAttr(sleep || '')}" placeholder="7.5">
        <button type="button" data-daily-action="sleep">Kaydet</button>
      </label>
      <label class="daily-line">
        <span>Adim</span>
        <input id="steps-input" type="number" min="0" value="${escapeAttr(steps || '')}" placeholder="12000">
        <button type="button" data-daily-action="steps">Kaydet</button>
      </label>
      <div class="mood-row" aria-label="Mood">
        ${[1, 2, 3, 4, 5].map(value => `<button type="button" class="${mood === value ? 'active' : ''}" data-mood="${value}">${value}</button>`).join('')}
      </div>
    </div>
  `
}

function renderAskResult(item = {}) {
  const data = item.responseJson || item.response_json || {}
  const evidence = data.evidence || []
  const steps = data.nextSteps || data.next_steps || []
  return `
    <div class="ask-result">
      <b>${escapeHtml(cleanText(data.title || item.question || 'ODIE'))}</b>
      <p>${escapeHtml(cleanText(item.answer || data.answer || ''))}</p>
      ${evidence.length ? `<div class="mini-stack">${evidence.slice(0, 3).map(line => `<span>${escapeHtml(cleanText(line))}</span>`).join('')}</div>` : ''}
      ${steps.length ? `<div class="next-stack">${steps.slice(0, 3).map(line => `<span>${escapeHtml(cleanText(line))}</span>`).join('')}</div>` : ''}
    </div>
  `
}

function renderAskHistory() {
  if (askState.loading) return '<div class="loading-line">Signal history cekiliyor.</div>'
  const items = askState.items || []
  if (!items.length) return '<div class="loading-line">Henuz soru yok. Ilk sinyali burada al.</div>'
  return `
    <div class="history-list">
      ${items.slice(0, 4).map(item => `
        <button type="button" class="history-item" data-history-id="${escapeAttr(item.id || '')}">
          <b>${escapeHtml(cleanText(item.question || 'Soru'))}</b>
          <span>${escapeHtml(cleanText(item.answer || ''))}</span>
        </button>
      `).join('')}
    </div>
  `
}

function renderWarnings(next = {}) {
  const warnings = next.warnings || []
  const caps = next.progressionCaps || []
  if (!warnings.length && !caps.length) return ''
  return `
    <section class="warning-stack">
      ${warnings.slice(0, 3).map(item => `<div class="warning-line">${escapeHtml(cleanText(item))}</div>`).join('')}
      ${caps.slice(0, 2).map(item => `<div class="cap-line">${escapeHtml(cleanText(item))}</div>`).join('')}
    </section>
  `
}

function renderMetric(label, value, key, reverse = false) {
  const numeric = clamp(Number(value), 0, 100)
  const display = Number.isFinite(Number(value)) ? Math.round(numeric) : '--'
  const bar = reverse ? 100 - numeric : numeric
  return `
    <article class="metric-card metric-${escapeAttr(key)}" style="--value:${bar}%">
      <span>${escapeHtml(label)}</span>
      <b>${escapeHtml(String(display))}</b>
      <i aria-hidden="true"></i>
    </article>
  `
}

function renderStatPill(stat = {}) {
  return `
    <div class="stat-pill stat-${escapeAttr(stat.key)}" style="--stat:${stat.progress}%">
      <span>${escapeHtml(stat.label)}</span>
      <b>${escapeHtml(stat.rank)}</b>
      <small>${escapeHtml(stat.confidence)}</small>
    </div>
  `
}

function renderZoneCard(zone = {}) {
  return `
    <article class="zone-card zone-${escapeAttr(zone.tone)}" style="--heat:${zone.heat}%">
      <span>${escapeHtml(zone.label)}</span>
      <b>${escapeHtml(zone.title)}</b>
      <p>${escapeHtml(cleanText(zone.detail))}</p>
      <i>${zone.count}</i>
    </article>
  `
}

function renderRegionRow(region = {}) {
  const risk = clamp(region.risk, 0, 100)
  return `
    <div class="region-row" style="--risk:${risk}%">
      <span>${escapeHtml(cleanText(region.label || region.id || 'Bolge'))}</span>
      <b>${Math.round(risk)}</b>
      <i></i>
    </div>
  `
}

function renderMovementLine(line = {}) {
  const progress = clamp(line.progress ?? line.score, 0, 100)
  return `
    <div class="movement-row" style="--line:${progress}%">
      <span>${escapeHtml(cleanText(line.label || line.id || 'Line'))}</span>
      <b>${Math.round(progress)}%</b>
      <small>${escapeHtml(cleanText(line.todayStep || 'mini blok'))}</small>
    </div>
  `
}

function renderSourceDot(source = {}) {
  return `
    <span class="source-dot ${source.lit ? 'lit' : ''}" title="${escapeAttr(source.label)}: ${escapeAttr(source.detail)}">
      <i aria-hidden="true"></i>${escapeHtml(source.label)}
    </span>
  `
}

function renderNavTab(tab) {
  const active = activeTab === tab.key
  return `
    <button type="button" class="nav-tab ${active ? 'active' : ''}" data-tab="${escapeAttr(tab.key)}" aria-current="${active ? 'page' : 'false'}">
      <span>${escapeHtml(tab.label)}</span>
      <small>${escapeHtml(tab.hint)}</small>
    </button>
  `
}

async function handleClick(event) {
  const tabButton = event.target.closest('[data-tab]')
  if (tabButton) {
    setActiveTab(tabButton.dataset.tab)
    return
  }

  const presetButton = event.target.closest('[data-preset]')
  if (presetButton) {
    selectedPreset = presetButton.dataset.preset
    logNotice = ''
    scheduleRender()
    return
  }

  const dailyButton = event.target.closest('[data-daily-action]')
  if (dailyButton) {
    await saveDailySignal(dailyButton.dataset.dailyAction, dailyButton)
    return
  }

  const moodButton = event.target.closest('[data-mood]')
  if (moodButton) {
    await saveDailySignal('mood', moodButton)
    return
  }

  const feedbackButton = event.target.closest('[data-feedback]')
  if (feedbackButton) {
    await saveFeedback(feedbackButton.dataset.feedback)
    return
  }

  if (event.target.closest('[data-refresh]')) {
    await syncNow()
    return
  }

  if (event.target.closest('[data-clear-notice]')) {
    logNotice = ''
    scheduleRender()
    return
  }

  if (event.target.closest('[data-clear-signal]')) {
    signalNotice = ''
    scheduleRender()
  }
}

async function handleSubmit(event) {
  if (event.target.id === 'route-log-form') {
    event.preventDefault()
    await saveRouteLog(event.target)
  }

  if (event.target.id === 'body-event-form') {
    event.preventDefault()
    await saveBodyGate(event.target)
  }

  if (event.target.id === 'ask-form') {
    event.preventDefault()
    await askOdie(event.target)
  }
}

function setActiveTab(tab) {
  if (!TABS.some(item => item.key === tab)) return
  activeTab = tab
  try { localStorage.setItem('riftline-tab', tab) } catch {}
  scheduleRender()
}

async function saveRouteLog(form) {
  const submit = form.querySelector('button[type="submit"]')
  const data = new FormData(form)
  const session = {
    date: String(data.get('date') || getLocalDateString()),
    type: String(data.get('type') || 'Custom'),
    durationMin: Number(data.get('durationMin')) || 0,
    distanceKm: Number(data.get('distanceKm')) || 0,
    elevationM: Number(data.get('elevationM')) || 0,
    highlight: String(data.get('highlight') || '').trim(),
    notes: String(data.get('notes') || '').trim(),
    source: 'manual',
    exercises: [],
    volumeKg: 0,
    sets: 0,
  }

  if (!session.durationMin) {
    logNotice = 'Sure olmadan rota kapanmaz.'
    scheduleRender()
    return
  }

  try {
    if (submit) submit.disabled = true
    const workout = await store.addWorkout(session)
    logNotice = `${displayWorkoutType(session.type)} kayda girdi. +${workout?.xpEarned || 0} XP`
    activeTab = 'route'
  } catch (error) {
    console.error('[riftline] route log failed:', error)
    logNotice = `Kayit takildi: ${error?.message || error}`
  } finally {
    if (submit) submit.disabled = false
    scheduleRender()
  }
}

async function saveDailySignal(action, button) {
  const state = store.getState() || {}
  const today = getLocalDateString()
  const existing = (state.dailyLogs || []).find(item => normalizeDateString(item.date) === today) || {
    date: today,
    waterMl: 0,
    sleepHours: 0,
    steps: 0,
    mood: 0,
  }
  const next = { ...existing, date: today }

  if (action === 'water') next.waterMl = Math.min(5000, (Number(next.waterMl) || 0) + (Number(button.dataset.amount) || 500))
  if (action === 'sleep') next.sleepHours = Number(document.getElementById('sleep-input')?.value) || 0
  if (action === 'steps') next.steps = Number(document.getElementById('steps-input')?.value) || 0
  if (action === 'mood') next.mood = Math.max(1, Math.min(5, Number(button.dataset.mood) || 0))

  await store.saveDailyLog(next)
  logNotice = 'Daily signal guncellendi.'
  scheduleRender()
}

async function saveBodyGate(form) {
  const data = new FormData(form)
  try {
    await store.addBodyEvent({
      kind: 'injury',
      region: String(data.get('region') || 'core'),
      severity: Number(data.get('severity')) || 3,
      recoveryPercent: Number(data.get('recoveryPercent')) || 70,
      etaDays: 3,
      status: 'active',
      note: String(data.get('note') || '').trim(),
      source: 'manual',
    })
    logNotice = 'Body gate haritaya eklendi.'
    activeTab = 'map'
  } catch (error) {
    console.error('[riftline] body gate failed:', error)
    logNotice = `Body gate takildi: ${error?.message || error}`
  }
  scheduleRender()
}

async function saveFeedback(type) {
  try {
    await store.addMemoryFeedback({ feedbackType: type, note: `Riftline feedback: ${type}` })
    signalNotice = 'Feedback hafizaya gitti.'
  } catch (error) {
    signalNotice = `Feedback takildi: ${error?.message || error}`
  }
  scheduleRender()
}

async function syncNow() {
  if (syncBusy) return
  syncBusy = true
  scheduleRender()
  try {
    await store.syncFromSupabase()
    logNotice = 'Canli veri yenilendi.'
  } catch (error) {
    logNotice = `Sync takildi: ${error?.message || error}`
  } finally {
    syncBusy = false
    scheduleRender()
  }
}

async function loadAskHistory() {
  askState.loading = true
  askState.error = ''
  scheduleRender()
  try {
    const response = await fetch('/api/ask')
    const data = await response.json()
    if (!response.ok || !data.ok) throw new Error(data.error || 'Ask history alinamadi')
    askState.items = data.items || []
  } catch (error) {
    askState.items = []
    askState.error = error?.message || 'Ask history alinamadi'
  } finally {
    askState.loading = false
    scheduleRender()
  }
}

async function askOdie(form) {
  const question = String(new FormData(form).get('question') || '').trim()
  if (!question) {
    askState.error = 'Soru bos olamaz.'
    scheduleRender()
    return
  }

  askState.submitting = true
  askState.error = ''
  askState.result = null
  scheduleRender()

  try {
    const response = await fetch('/api/ask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question }),
    })
    const data = await response.json()
    if (!response.ok || !data.ok) throw new Error(data.error || 'ODIE sinyali donmedi')
    askState.result = data.item
    askState.items = [data.item, ...(askState.items || [])]
  } catch (error) {
    askState.error = error?.message || 'ODIE sinyali takildi'
  } finally {
    askState.submitting = false
    scheduleRender()
  }
}

function isStrengthSession(workout = {}) {
  const type = String(workout.type || '').toLowerCase()
  return /gym|push|pull|bacak|shoulder|bench|strength/.test(type)
    || workout.primaryCategory === 'strength'
    || (workout.blocks || []).some(block => block.kind === 'strength')
}

function isParkourSession(workout = {}) {
  const text = `${workout.type || ''} ${(workout.tags || []).join(' ')}`.toLowerCase()
  return /parkour|vault|flow/.test(text)
}

function isWalkSession(workout = {}) {
  const type = String(workout.type || '').toLowerCase()
  return /yuruyus|walk|kosu|run|bisiklet|bike|hike/.test(type) || Number(workout.distanceKm) > 0
}

function isRecoverySession(workout = {}) {
  const text = `${workout.type || ''} ${(workout.tags || []).join(' ')} ${(workout.blocks || []).map(block => block.kind).join(' ')}`.toLowerCase()
  return /stretch|recovery|mobility|mobilite|breath|nefes/.test(text)
}

function isAcroSession(workout = {}) {
  const text = `${workout.type || ''} ${(workout.tags || []).join(' ')}`.toLowerCase()
  return /akrobasi|acro|flip|barani|handstand|calisthenics/.test(text)
}

function displayWorkoutType(type = '') {
  const map = {
    Yuruyus: 'Yuruyus',
    Yürüyüş: 'Yuruyus',
    Kosu: 'Kosu',
    Bacak: 'Bacak',
    Akrobasi: 'Acro',
    Tirmanis: 'Tirmanis',
    Stretching: 'Recovery',
  }
  return map[type] || type || 'Seans'
}

function toneLabel(tone = '') {
  return {
    danger: 'Riskli',
    warn: 'Dikkat',
    go: 'Hazir',
    calm: 'Plan',
    fire: 'Tempo',
  }[tone] || 'Plan'
}

function rankFromValue(value = 0) {
  const numeric = Number(value) || 0
  if (numeric >= 88) return 'S'
  if (numeric >= 72) return 'A'
  if (numeric >= 55) return 'B'
  if (numeric >= 40) return 'C'
  if (numeric >= 25) return 'D'
  return 'F'
}

function cleanText(value = '') {
  return String(value || '')
    .replace(/\bkarakteri\b/gi, "Riftline'i")
    .replace(/\bkarakter\b/gi, 'profil')
    .replace(/\bkaraktere\b/gi, 'profile')
    .replace(/\bgorevler\b/gi, 'hatlar')
    .replace(/\bgörevler\b/gi, 'hatlar')
    .replace(/\bgorevi\b/gi, 'hatti')
    .replace(/\bgörevi\b/gi, 'hatti')
    .replace(/\bgorev\b/gi, 'hat')
    .replace(/\bgörev\b/gi, 'hat')
    .replace(/\bpano\b/gi, 'map')
    .replace(/\bkoy\b/gi, 'sehir')
    .replace(/\bköy\b/gi, 'sehir')
    .replace(/\s+/g, ' ')
    .replace(/[^\S\r\n]+/g, ' ')
    .trim()
}

function formatNumber(value = 0) {
  return Math.round(Number(value) || 0).toLocaleString('tr-TR')
}

function clamp(value, min = 0, max = 100) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return min
  return Math.max(min, Math.min(max, numeric))
}

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function escapeAttr(value = '') {
  return escapeHtml(value)
}
