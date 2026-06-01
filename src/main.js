import './styles/cozy-reforge.css'
import { store } from './data/store.js'
import { buildBodyMapState } from './data/body-map-engine.js'
import { BODY_REGION_OPTIONS } from './data/body-events.js'
import { buildMissionLoop, buildRewardRecap, snapshotMissionState } from './data/mission-loop.js'
import { buildNextSessionRecommendation } from './data/next-session-engine.js'
import { buildSemanticProfile } from './data/semantic-profile.js'
import { buildWorldMapModel } from './data/world-map-engine.js'
import { buildBountyBoard } from './data/bounty-board.js'
import { cleanGameText, displayWorkoutType } from './data/game-copy.js'
import { GAME_ASSETS, STAT_AXES } from './data/game-assets.js'
import { initTelegramMiniApp } from './data/telegram-webapp.js'
import { getLocalDateString, normalizeDateString } from './data/rules.js'
import { plainCopyText } from './data/ui-copy.js'
import { buildDataTruthMap, selectTrustedHealthSummary } from './data/data-truth-engine.js'

const TABS = [
  { key: 'route', label: 'Komuta', icon: GAME_ASSETS.nav.command },
  { key: 'map', label: 'Harita', icon: GAME_ASSETS.nav.map },
  { key: 'signal', label: 'ODIE', icon: GAME_ASSETS.nav.odie },
]

const APP_ACCESS_TOKEN = import.meta.env.VITE_ODIE_APP_ACCESS_TOKEN || ''

const PRESETS = {
  Gym: { type: 'Gym', durationMin: 55, distanceKm: 0, label: 'Gym', note: 'ana blok + destek' },
  Parkour: { type: 'Parkour', durationMin: 75, distanceKm: 0, label: 'Parkur', note: 'flow, iniş, teknik' },
  Walk: { type: 'Yuruyus', durationMin: 35, distanceKm: 3, label: 'Yürüyüş', note: 'düşük nabız rota' },
  Recovery: { type: 'Stretching', durationMin: 20, distanceKm: 0, label: 'Toparlanma', note: 'mobilite, nefes, bakım' },
  Acro: { type: 'Akrobasi', durationMin: 45, distanceKm: 0, label: 'Akro', note: 'kontrollü geçiş' },
}

const WORKOUT_TYPES = [
  'Gym', 'Push', 'Pull', 'Shoulder', 'Bacak', 'Parkour', 'Akrobasi',
  'Calisthenics', 'Yuruyus', 'Kosu', 'Bisiklet', 'Tirmanis', 'Stretching', 'Custom',
]

const ASSETS = GAME_ASSETS

const HEAT_COLORS = ['#efdcbb', '#d8e2c6', '#aecb9a', '#84ad73', '#5b8a4f']

let activeTab = readInitialTab()
let selectedPreset = 'Gym'
let renderQueued = false
let lastMarkup = ''
let logNotice = ''
let signalNotice = ''
let syncBusy = false
let routeSubmitBusy = false
let bodySubmitBusy = false
let detailSheet = null
let rewardRecap = null
let askState = {
  items: null,
  loading: false,
  submitting: false,
  confirming: false,
  draft: '',
  error: '',
  result: null,
  intakePreview: null,
  intakeResult: null,
}

initRuntime()

async function initRuntime() {
  document.documentElement.setAttribute('data-theme', 'cozy')
  initTelegramMiniApp()

  bindGlobalEvents()
  renderApp()

  try {
    const initPromise = store.init()
    window.setTimeout(() => scheduleRender({ immediate: true }), 700)
    await initPromise
  } catch (error) {
    console.warn('[odiept] store init failed:', error?.message || error)
  }

  renderApp()
  window.setInterval(() => store.refreshRecovery(), 5 * 60 * 1000)
  store.subscribe('*', () => scheduleRender())
}

function readInitialTab() {
  const requested = new URLSearchParams(window.location.search).get('tab')
  if (requested === 'log') return 'signal'
  if (TABS.some(tab => tab.key === requested)) return requested
  try {
    const stored = localStorage.getItem('odiept-tab')
    if (stored === 'log') return 'signal'
    if (TABS.some(tab => tab.key === stored)) return stored
  } catch {}
  return 'route'
}

function bindGlobalEvents() {
  document.addEventListener('click', handleClick)
  document.addEventListener('input', handleInput)
  document.addEventListener('submit', handleSubmit)
  document.addEventListener('keydown', handleKeydown)
}

function handleInput(event) {
  if (event.target?.id === 'ask-textarea') askState.draft = String(event.target.value || '')
}

function handleKeydown(event) {
  if (event.key !== 'Escape') return
  if (!detailSheet && !rewardRecap) return
  detailSheet = null
  rewardRecap = null
  scheduleRender()
}

function appHeaders(extra = {}) {
  return APP_ACCESS_TOKEN
    ? { ...extra, Authorization: `Bearer ${APP_ACCESS_TOKEN}` }
    : extra
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
  const model = buildModel(state, profile)
  const markup = renderShell(model)
  updateDocumentTitle()

  if (markup !== lastMarkup) {
    const app = document.getElementById('app')
    if (app) app.innerHTML = markup
    lastMarkup = markup
  }

  if (activeTab === 'signal' && !askState.items && !askState.loading) {
    loadAskHistory()
  }
}

/* ============================================================
   MODEL
   ============================================================ */
function buildModel(state = {}, profile = {}) {
  const workouts = state.workouts || []
  const dailyLogs = state.dailyLogs || []
  const semantic = buildSemanticProfile(workouts, dailyLogs)
  const bodyMap = state.bodyMapState || buildBodyMapState({ state, profile, semantic })
  const healthSummary = selectTrustedHealthSummary(state)
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
  const truthMap = buildDataTruthMap({
    state,
    workouts,
    dailyLogs,
  })
  const progressSnapshot = buildProgressSnapshot(workouts, stats)
  const bountyBoard = buildBountyBoard({
    state,
    profile,
    bodyMap,
    nextSession,
    semantic,
  })
  const missionLoop = buildMissionLoop({
    profile,
    bodyMap,
    nextSession,
    stats,
    bountyBoard,
  })
  const worldMap = buildWorldMapModel({
    bodyMap,
    missionLoop,
    nextSession,
    zones,
    profile,
    bountyBoard,
  })

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
    progressSnapshot,
    missionLoop,
    bountyBoard,
    worldMap,
    truthMap,
    sources: buildSources(truthMap, sourceHealth, workouts, dailyLogs, healthSummary),
    system: {
      readiness: nextSession.readiness || {},
      tone: nextSession.tone || 'calm',
      sourceHealth,
    },
  }
}

function normalizeStats(stats = []) {
  return (stats || []).map(stat => ({
    key: String(stat.key || stat.label || '').toLowerCase(),
    label: stat.label || String(stat.key || '').toUpperCase(),
    name: cleanText(stat.name || stat.label || stat.key || 'Stat'),
    value: clamp(Number(stat.scaleScore ?? stat.val ?? stat.rawVal), 0, 100),
    rank: stat.rank || rankFromValue(stat.scaleScore ?? stat.val),
    progress: clamp(Number(stat.progressToNext ?? stat.val), 0, 100),
  }))
}

function buildSources(truthMap = {}, sourceHealth = {}, workouts = [], dailyLogs = [], healthSummary = null) {
  if (Array.isArray(truthMap.items) && truthMap.items.length) {
    return truthMap.items.slice(0, 4).map(item => ({
      key: item.key,
      label: item.label,
      lit: item.lit,
      detail: item.detail,
    }))
  }

  const latest = workouts[0]
  const recent = workouts.slice(0, 14)
  const movementDays = new Set(recent.map(workout => normalizeDateString(workout.date)).filter(Boolean)).size
  const recoveryLit = Boolean(healthSummary || dailyLogs.some(log => Number(log.sleepHours) || Number(log.waterMl) || Number(log.steps)))
  return [
    { key: 'trail', label: 'Rota', lit: workouts.length > 0, detail: latest?.date || 'ilk kayıt' },
    { key: 'rhythm', label: 'Ritim', lit: movementDays >= 3, detail: `${movementDays} aktif gün` },
    { key: 'recovery', label: 'Can', lit: recoveryLit, detail: healthSummary?.day || dailyLogs[0]?.date || 'bakım bekliyor' },
    { key: 'quest', label: 'Görev', lit: workouts.length > 0 || Number(sourceHealth.totalRecent) > 0, detail: `${workouts.length} kayıt` },
  ]
}

function buildProgressSnapshot(workouts = [], stats = []) {
  const sorted = [...(workouts || [])]
    .filter(workout => normalizeDateString(workout.date))
    .sort((a, b) => normalizeDateString(a.date).localeCompare(normalizeDateString(b.date)))
  if (!sorted.length) {
    return { empty: true, metrics: [], trend: [], statLeaders: [] }
  }

  const windowSize = Math.min(6, Math.max(1, Math.floor(sorted.length / 2) || 1))
  const oldWindow = sorted.slice(0, windowSize)
  const nowWindow = sorted.slice(-windowSize)
  const oldSummary = summarizeWorkoutWindow(oldWindow)
  const nowSummary = summarizeWorkoutWindow(nowWindow)
  const useVolume = oldSummary.volumeKg > 0 || nowSummary.volumeKg > 0

  const metrics = [
    {
      key: 'load',
      label: useVolume ? 'Yük' : 'Süre',
      oldValue: useVolume ? oldSummary.volumeKg : oldSummary.durationMin,
      nowValue: useVolume ? nowSummary.volumeKg : nowSummary.durationMin,
      unit: useVolume ? 'kg' : 'dk',
    },
    {
      key: 'sets',
      label: 'Set',
      oldValue: oldSummary.sets,
      nowValue: nowSummary.sets,
      unit: 'set',
    },
    {
      key: 'days',
      label: 'Aktif gun',
      oldValue: oldSummary.activeDays,
      nowValue: nowSummary.activeDays,
      unit: 'gun',
    },
  ].map(metric => ({
    ...metric,
    delta: metric.nowValue - metric.oldValue,
    deltaPct: metric.oldValue > 0 ? ((metric.nowValue - metric.oldValue) / metric.oldValue) * 100 : (metric.nowValue > 0 ? 100 : 0),
  }))

  return {
    empty: false,
    count: sorted.length,
    windowSize,
    oldSummary,
    nowSummary,
    useVolume,
    metrics,
    trend: sorted.slice(-12).map(workout => ({
      date: normalizeDateString(workout.date),
      value: useVolume ? (Number(workout.volumeKg) || 0) : (Number(workout.durationMin) || 0),
    })),
    statLeaders: [...stats]
      .sort((a, b) => Number(b.value || 0) - Number(a.value || 0))
      .slice(0, 3)
      .map(stat => ({
        label: stat.short || stat.label || stat.name || stat.key,
        rank: stat.rank || rankFromValue(stat.value),
        value: clamp(Number(stat.value), 0, 100),
      })),
  }
}

function summarizeWorkoutWindow(list = []) {
  const activeDays = new Set(list.map(workout => normalizeDateString(workout.date)).filter(Boolean)).size
  return {
    sessions: list.length,
    activeDays,
    volumeKg: Math.round(list.reduce((sum, workout) => sum + (Number(workout.volumeKg) || 0), 0)),
    durationMin: Math.round(list.reduce((sum, workout) => sum + (Number(workout.durationMin) || 0), 0)),
    sets: Math.round(list.reduce((sum, workout) => sum + (Number(workout.sets) || 0), 0)),
  }
}

function buildZoneCards(workouts = [], bodyMap = {}, nextSession = {}) {
  const recent = workouts.slice(0, 30)
  const count = predicate => recent.filter(predicate).length
  const priority = bodyMap.priority || {}
  const quest = bodyMap.dailyQuest || {}

  const zones = [
    { key: 'gym', name: 'Gym evi', emoji: '\u{1F3CB}️', count: count(isStrengthSession), detail: nextSession.questImpact?.balance?.lowest?.label ? `${nextSession.questImpact.balance.lowest.label} one al` : 'kuvvet hatti', tone: 'steel' },
    { key: 'parkour', name: 'Parkur alani', emoji: '\u{1F9D7}', count: count(isParkourSession), detail: priority.movement?.todayStep || 'flow / inis', tone: 'amber' },
    { key: 'walk', name: 'Yürüyüş yolu', emoji: '\u{1F6B6}', count: count(isWalkSession), detail: 'düşük nabız rota', tone: 'green' },
    { key: 'recovery', name: 'Dinlenme evi', emoji: '\u{1F9D8}', count: count(isRecoverySession), detail: quest.safeMode ? 'dikkat kapısı açık' : 'bakım hattı', tone: 'blue' },
    { key: 'acro', name: 'Akro sahasi', emoji: '\u{1F938}', count: count(isAcroSession), detail: priority.unlock?.name || 'gecis kilidi', tone: 'red' },
  ]

  return zones.map(zone => ({
    ...zone,
    heat: clamp((zone.count / Math.max(1, recent.length || 1)) * 100, 10, 100),
  }))
}

/* ============================================================
   SHELL + NAV
   ============================================================ */
function renderShell(model) {
  return `
    <div class="cozy-app tone-${escapeAttr(model.system.tone)}">
      <header class="cozy-top">
        <button class="cozy-brand" type="button" data-tab="route" aria-label="Komuta ekranına dön">
          <span class="crest" aria-hidden="true"><img src="${ASSETS.routeMarker}" alt=""></span>
          <span>
            <b>OdiePt</b>
            <small>${escapeHtml(cleanText(model.profile.handle || model.profile.nick || 'gezgin'))}</small>
          </span>
        </button>
        <div class="village-pips" aria-label="Durum isiklari">
          ${model.sources.map(renderPip).join('')}
        </div>
      </header>

      <main class="cozy-main" aria-label="${escapeAttr(activeTabLabel())}">
        ${renderActiveScreen(model)}
      </main>

      <nav class="cozy-nav" aria-label="Gezinme">
        ${TABS.map(renderNavItem).join('')}
      </nav>
      ${renderDetailSheet()}
      ${renderRewardRecap()}
    </div>
  `
}

function activeTabLabel() {
  return TABS.find(tab => tab.key === activeTab)?.label || 'Komuta'
}

function renderActiveScreen(model) {
  switch (activeTab) {
    case 'map': return renderMapScreen(model)
    case 'signal': return renderSignalScreen(model)
    case 'route':
    default: return renderMissionRouteScreen(model)
  }
}

function updateDocumentTitle() {
  const label = activeTabLabel()
  const nextTitle = `OdiePt - ${label}`
  if (document.title !== nextTitle) document.title = nextTitle
}

function renderNavItem(tab) {
  const active = activeTab === tab.key
  return `
    <button type="button" class="nav-item ${active ? 'active' : ''}" data-tab="${escapeAttr(tab.key)}" aria-current="${active ? 'page' : 'false'}">
      <span class="n-ico" aria-hidden="true"><img src="${tab.icon}" alt=""></span>
      <span class="n-label">${escapeHtml(tab.label)}</span>
    </button>
  `
}

function responsiveAsset(className, sources = {}, alt = '') {
  const desktop = sources.desktop || sources.mobile || ''
  const mobile = sources.mobile || sources.desktop || ''
  return `<img class="${escapeAttr(className)}" src="${desktop}" srcset="${mobile} 720w, ${desktop} 1280w" sizes="(max-width: 559px) 100vw, 1280px" alt="${escapeAttr(alt)}" aria-hidden="${alt ? 'false' : 'true'}">`
}

function renderPip(source = {}) {
  return `
    <button type="button" class="pip ${source.lit ? 'lit' : ''}" ${detailAttrs(source.label, source.detail || 'Yeni kayıt bekliyor.')}>
      <i aria-hidden="true"></i><b>${escapeHtml(source.label)}</b>
    </button>
  `
}

function detailAttrs(title = 'Detay', body = '') {
  return `data-detail-title="${escapeAttr(cleanText(title))}" data-detail-body="${escapeAttr(cleanText(body))}"`
}

function renderDetailSheet() {
  if (!detailSheet) return ''
  return `
    <div class="detail-backdrop" data-detail-backdrop>
      <section class="detail-sheet" role="dialog" aria-modal="true" aria-label="${escapeAttr(detailSheet.title)}">
        <div class="detail-head">
          <b>${escapeHtml(cleanText(detailSheet.title))}</b>
          <button type="button" class="icon-close" data-close-detail aria-label="Kapat">×</button>
        </div>
        <p>${escapeHtml(cleanText(detailSheet.body || 'Bu parça yeni kayıtlarla netleşir.'))}</p>
      </section>
    </div>
  `
}

function renderRewardRecap() {
  if (!rewardRecap) return ''
  return `
    <div class="reward-recap-backdrop" data-recap-backdrop>
      <section class="reward-recap ${rewardRecap.levelUp ? 'is-level-up' : ''}" role="dialog" aria-modal="true" aria-label="${escapeAttr(rewardRecap.title)}">
        <div class="recap-head">
          <span class="recap-kick">${rewardRecap.questClosed ? 'Görev kapandı' : 'Kayıt tamam'}</span>
          <button type="button" class="icon-close" data-close-recap aria-label="Kapat">x</button>
        </div>
        <b>${escapeHtml(cleanText(rewardRecap.title))}</b>
        <p>${escapeHtml(cleanText(rewardRecap.body))}</p>
        <div class="recap-chips">
          ${(rewardRecap.chips || []).map(chip => `<span>${escapeHtml(cleanText(chip))}</span>`).join('')}
        </div>
        <button type="button" class="btn-primary full" data-close-recap>Komuta’ya dön</button>
      </section>
    </div>
  `
}

/* ============================================================
   ROUTE / KOY
   ============================================================ */
function renderMissionRouteScreen(model) {
  const next = model.nextSession
  const loop = model.missionLoop || {}
  const profile = model.profile || {}
  const command = shortCommand(next.coachCommand || loop.questBody, 112)

  return `
    <section class="screen route-screen">
      <div class="route-grid">
        <div class="col-a">
          <div class="mission-hud mission-loop-hud">
            ${responsiveAsset('hero-bg', ASSETS.backgrounds.command)}
            <div class="mission-top">
              <span class="kick">${escapeHtml(timeGreeting())} · ${escapeHtml(next.date || getLocalDateString())}</span>
              <span class="mission-tone">${escapeHtml(loop.levelLine || `Seviye ${profile.level || 1}`)}</span>
            </div>
            <div class="mission-body">
              <div class="mission-copy">
                <h1>${escapeHtml(loop.title || 'Görev Döngüsü')}</h1>
                <p>${escapeHtml(command)}</p>
              </div>
              <button type="button" class="mission-avatar" ${detailAttrs(model.profile.nick || 'Profil', `Seviye ${model.profile.level || 1}. Seri ${model.profile.streak?.current || 0} gün. XP ${formatNumber(model.profile.xp?.current || 0)} / ${formatNumber(model.profile.xp?.max || 0)}.`)}>
                <img src="${ASSETS.avatarAthlete}" alt="" aria-hidden="true">
              </button>
            </div>
            ${renderMissionQuest(loop, model)}
            ${renderEnergyStrip(model.system.readiness)}
            ${renderStatBelt(model.stats)}
          </div>

          ${renderProgressCard(model.progressSnapshot, 'mobile-progress', loop)}
          ${renderCharCard(model)}
          ${renderBountyBoard(model.bountyBoard, model.profile.quests)}
        </div>

        <div class="col-b">
          ${renderProgressCard(model.progressSnapshot, 'desktop-progress', loop)}
          ${renderHeatmapCard(model.workouts)}
          ${renderVolumeCard(model.workouts)}
          ${renderAchievementShelf(model.profile.achievements)}
          ${renderLastCard(model.latestWorkout)}
          ${renderWarnings(next)}
        </div>
      </div>
    </section>
  `
}

function renderMissionQuest(loop = {}, model = {}) {
  const title = cleanText(loop.questTitle || 'Bugünün ana hamlesi')
  const body = cleanText(loop.questBody || 'Tek temiz adım bugünü kazandırır.')
  const detail = `${body} ${loop.questWhy || ''}`.trim()
  return `
    <article class="mission-quest">
      <div class="quest-top">
        <span class="quest-scroll" aria-hidden="true"><img src="${ASSETS.routeMarker}" alt=""></span>
        <div>
          <div class="q-kick">${escapeHtml(cleanText(loop.eyebrow || 'Sıradaki hamle'))}</div>
          <h2>${escapeHtml(title)}</h2>
        </div>
      </div>
      <p class="q-body">${escapeHtml(shortCommand(body, 118))}</p>
      <div class="reward-strip">
        ${renderRewardChips(loop.rewardChips)}
      </div>
      <div class="quest-row">
        <button class="btn-primary" type="button" data-tab="signal">${escapeHtml(loop.ctaLabel || 'ODIE’ye söyle')}</button>
        <button class="btn-ghost" type="button" ${detailAttrs(title, detail)}>Detay</button>
      </div>
    </article>
  `
}

function renderRewardChips(chips = []) {
  const list = Array.isArray(chips) && chips.length
    ? chips
    : [{ key: 'xp', label: 'XP ritmi', detail: 'Kayıt geldikçe ödül döngüsü açılır.', tone: 'xp' }]
  return list.map(chip => `
    <button type="button" class="reward-chip tone-${escapeAttr(chip.tone || chip.key || 'xp')}" ${detailAttrs(chip.label || 'Ödül', chip.detail || 'Bu parça kayıtla netleşir.')}>
      <img src="${rewardIcon(chip)}" alt="" aria-hidden="true">
      ${escapeHtml(cleanText(chip.label || 'Ödül'))}
    </button>
  `).join('')
}

function rewardIcon(chip = {}) {
  const key = `${chip.key || ''} ${chip.tone || ''} ${chip.label || ''}`.toLowerCase()
  if (/streak|seri/.test(key)) return ASSETS.reward.streak
  if (/unlock|kilit/.test(key)) return ASSETS.reward.unlock
  if (/ready|shield|kalkan/.test(key)) return ASSETS.reward.shield
  if (/recovery|toparlan|onar/.test(key)) return ASSETS.reward.recovery
  if (/pr|rekor/.test(key)) return ASSETS.reward.pr
  if (/xp/.test(key)) return ASSETS.reward.xp
  return ASSETS.reward.gift
}

function renderRouteScreen(model) {
  const next = model.nextSession
  const goal = next.primaryGoal || {}
  const quest = model.bodyMap.dailyQuest || {}
  const greeting = timeGreeting()

  const questTitle = cleanText(quest.title || goal.title || 'Bugünün görevi')
  const questBody = cleanText(quest.desc || goal.subtitle || next.coachCommand || 'Tek temiz adım bugünü kazandırır.')

  return `
    <section class="screen route-screen">
      <div class="route-grid">
        <div class="col-a">
          <div class="village-hero">
            ${responsiveAsset('hero-bg', ASSETS.backgrounds.command)}
            <img class="hero-runner" src="${ASSETS.avatarAthlete}" alt="" aria-hidden="true">
            <div class="hero-overlay">
              <span class="kick">${escapeHtml(greeting)} · ${escapeHtml(next.date || getLocalDateString())}</span>
              <h1>Bugünün rotası</h1>
              <p>${escapeHtml(shortCommand(next.coachCommand || goal.subtitle || 'Tek temiz hamle bugünü kazandırır.'))}</p>
            </div>
          </div>

          ${renderCharCard(model)}
          ${renderStatBelt(model.stats)}

          <div class="quest-card">
            <div class="quest-top">
              <span class="quest-scroll" aria-hidden="true"><img src="${ASSETS.routeMarker}" alt=""></span>
              <div>
                <div class="q-kick">Sıradaki hamle</div>
                <h3>${escapeHtml(questTitle)}</h3>
              </div>
            </div>
            <p class="q-body">${escapeHtml(questBody)}</p>
            <div class="quest-row">
              <span class="card-tag">${escapeHtml(toneLabel(next.tone))}</span>
              <button class="btn-primary" type="button" data-tab="signal">ODIE’ye söyle</button>
            </div>
          </div>

          ${renderBountyBoard(model.bountyBoard, model.profile.quests)}
          ${renderEnergyStrip(model.system.readiness)}
        </div>

        <div class="col-b">
          ${renderHeatmapCard(model.workouts)}
          ${renderVolumeCard(model.workouts)}
          ${renderAchievementShelf(model.profile.achievements)}
          ${renderLastCard(model.latestWorkout)}
          ${renderWarnings(next)}
        </div>
      </div>
    </section>
  `
}

function renderStatBelt(stats = []) {
  const byKey = {}
  stats.forEach(s => { byKey[s.key] = s })
  const axes = STAT_AXES.map(axis => {
    const s = byKey[axis.key] || {}
    return { ...axis, value: clamp(Number(s.value), 0, 100), rank: s.rank || 'F' }
  })

  return `
    <article class="stat-belt" aria-label="Karakter stat kemeri">
      ${axes.map(axis => `
        <button type="button" class="stat-stone" ${detailAttrs(`${axis.short} ${axis.rank}`, `Skor ${Math.round(axis.value)}. Bu stat son kayıtlara göre hareket eder.`)}>
          <img src="${axis.icon}" alt="" aria-hidden="true">
          <span>${escapeHtml(axis.short)}</span>
          <b>${escapeHtml(axis.rank)}</b>
        </button>
      `).join('')}
    </article>
  `
}

function renderBountyBoard(bountyBoard = {}, quests = {}) {
  const featured = bountyBoard?.featured || null
  const bounties = [...(bountyBoard?.daily || []), ...(bountyBoard?.weekly || [])]
  if (!featured && !bounties.length) return renderQuestBoard(quests)
  const open = bounties.filter(item => !item.done)
  const sideList = (open.length ? open : bounties).slice(0, 4)
  const doneCount = [featured, ...bounties].filter(item => item?.done).length
  const totalCount = [featured, ...bounties].filter(Boolean).length

  return `
    <article class="card bounty-board">
      <div class="card-head">
        <span class="card-title with-icon"><img src="${ASSETS.badge.bounty || ASSETS.badge.quest}" alt="" aria-hidden="true">Av Panosu</span>
        <span class="card-tag">${doneCount}/${totalCount} kapı</span>
      </div>
      ${featured ? renderFeaturedBounty(featured) : ''}
      <div class="bounty-list">
        ${sideList.map(renderBountyRow).join('')}
      </div>
    </article>
  `
}

function renderFeaturedBounty(bounty = {}) {
  const progress = clamp((Number(bounty.progress) || 0) / Math.max(1, Number(bounty.total) || 1) * 100, 0, 100)
  return `
    <button type="button" class="bounty-feature ${bounty.done ? 'is-done' : ''}" ${detailAttrs(bounty.title || 'Av görevi', `${bounty.body || ''} ${bounty.detail || ''} +${bounty.xp || 0} XP`)}>
      <span class="bf-icon asset-icon" aria-hidden="true"><img src="${bountyIcon(bounty)}" alt=""></span>
      <span class="bf-copy">
        <i>${escapeHtml(cleanText(bounty.done ? 'kapandı' : 'öne çıkan'))}</i>
        <b>${escapeHtml(cleanText(bounty.title || 'Bugünün avı'))}</b>
        <em>${escapeHtml(cleanText(bounty.requirement || bounty.body || '1 temiz hamle'))}</em>
      </span>
      <span class="bf-xp">+${Math.round(Number(bounty.xp) || 0)} XP</span>
      <span class="bf-track" aria-hidden="true"><i style="--v:${progress}%"></i></span>
    </button>
  `
}

function renderBountyRow(bounty = {}) {
  const total = Math.max(1, Number(bounty.total) || 1)
  const progress = clamp((Number(bounty.progress) || 0) / total * 100, 0, 100)
  return `
    <button type="button" class="bounty-item tone-${escapeAttr(bounty.tone || 'bounty')} ${bounty.done ? 'is-done' : ''}" ${detailAttrs(bounty.title || 'Av görevi', `${bounty.body || ''} ${bounty.detail || ''} +${bounty.xp || 0} XP`)}>
      <span class="bi-icon asset-icon" aria-hidden="true"><img src="${bountyIcon(bounty)}" alt=""></span>
      <span class="bi-body">
        <span><b>${escapeHtml(cleanText(bounty.title || 'Av görevi'))}</b><i>+${Math.round(Number(bounty.xp) || 0)} XP</i></span>
        <em>${escapeHtml(cleanText(bounty.requirement || bounty.body || '1/1'))}</em>
        <span class="bi-track"><i style="--v:${progress}%"></i></span>
      </span>
      <strong>${bounty.done ? '✓' : `${Math.min(total, Math.round(Number(bounty.progress) || 0))}/${total}`}</strong>
    </button>
  `
}

function bountyIcon(bounty = {}) {
  const key = String(bounty.iconKey || bounty.tone || '').toLowerCase()
  if (key.includes('combo')) return ASSETS.info.comboChain || ASSETS.info.unlock
  if (key.includes('unlock')) return ASSETS.reward.unlock
  if (key.includes('streak')) return ASSETS.reward.streak
  if (key.includes('shield') || key.includes('recovery')) return ASSETS.reward.shield
  if (key.includes('gift')) return ASSETS.reward.bounty || ASSETS.reward.gift
  return ASSETS.badge.bounty || ASSETS.badge.quest
}

function renderQuestBoard(quests = {}) {
  const daily = Array.isArray(quests?.daily) ? quests.daily : []
  const weekly = Array.isArray(quests?.weekly) ? quests.weekly : []
  if (!daily.length && !weekly.length) return ''
  const pool = [...daily.map(q => ({ ...q, span: 'gün' })), ...weekly.map(q => ({ ...q, span: 'hafta' }))]
  const open = pool.filter(q => !q.done)
  const list = (open.length ? open : pool).slice(0, 5)
  const doneCount = pool.filter(q => q.done).length

  return `
    <article class="card quest-board">
      <div class="card-head">
        <span class="card-title">Görev tahtası</span>
        <span class="card-tag">${doneCount}/${pool.length} ✓</span>
      </div>
      <div class="quest-list">
        ${list.map(renderQuestRow).join('')}
      </div>
    </article>
  `
}

function renderQuestRow(quest = {}) {
  const total = Math.max(1, Number(quest.total) || 1)
  const progress = clamp((Number(quest.progress) || 0) / total * 100, 0, 100)
  return `
    <button type="button" class="quest-item ${quest.done ? 'is-done' : ''}" ${detailAttrs(quest.name || 'Görev', `${quest.desc || ''} ${quest.reward || ''}`)}>
      <span class="qi-icon asset-icon" aria-hidden="true"><img src="${ASSETS.badge.quest}" alt=""></span>
      <div class="qi-body">
        <div class="qi-top">
          <b>${escapeHtml(cleanText(quest.name || 'Görev'))}</b>
          <span class="qi-reward">${escapeHtml(cleanText(quest.reward || ''))}</span>
        </div>
        <p>${escapeHtml(cleanText(quest.desc || ''))}</p>
        <div class="qi-track"><i style="--v:${progress}%"></i></div>
      </div>
      <span class="qi-count">${quest.done ? '✓' : `${Number(quest.progress) || 0}/${total}`}</span>
    </button>
  `
}

function renderAchievementShelf(achievements = []) {
  const list = Array.isArray(achievements) ? achievements : []
  if (!list.length) return ''
  const unlocked = list.filter(a => a.unlocked)
  const locked = list.filter(a => !a.unlocked)
  const ordered = [...unlocked, ...locked].slice(0, 12)

  return `
    <article class="card achievement-shelf">
      <div class="card-head">
        <span class="card-title">Başarımlar</span>
        <span class="card-tag">${unlocked.length}/${list.length}</span>
      </div>
      <div class="badge-grid">
        ${ordered.map(a => `
          <button type="button" class="badge ${a.unlocked ? 'lit' : 'locked'}" ${detailAttrs(a.name || 'Basarim', a.desc || a.req || '')}>
            <span class="b-icon" aria-hidden="true"><img src="${achievementIcon(a)}" alt=""></span>
            <span class="b-name">${escapeHtml(cleanText(a.name || ''))}</span>
            <span class="b-sub">${escapeHtml(cleanText(a.unlocked ? (a.date || 'açık') : (a.req || 'kilitli')))}</span>
          </button>
        `).join('')}
      </div>
    </article>
  `
}

function achievementIcon(achievement = {}) {
  if (!achievement.unlocked) return ASSETS.badge.locked
  const text = `${achievement.name || ''} ${achievement.desc || ''} ${achievement.req || ''}`.toLowerCase()
  if (/pr|rekor/.test(text)) return ASSETS.badge.pr
  if (/seri|streak/.test(text)) return ASSETS.badge.streak
  if (/seviye|level/.test(text)) return ASSETS.badge.level
  return ASSETS.badge.quest
}

function renderCharCard(model) {
  const p = model.profile
  const xp = p.xp || {}
  const xpPct = clamp(((Number(xp.current) || 0) / Math.max(1, Number(xp.max) || 1)) * 100, 0, 100)
  const streak = p.streak || {}

  return `
    <div class="char-card">
      <div class="char-avatar" aria-hidden="true"><img src="${ASSETS.avatarAthlete}" alt=""></div>
      <div class="char-meta">
        <div class="char-line">
          <span class="char-name">${escapeHtml(cleanText(p.nick || 'Gezgin'))}</span>
          <span class="char-class">${escapeHtml(cleanText(p.class || 'profil'))}</span>
          <span class="lvl-badge"><img src="${ASSETS.badge.level}" alt="" aria-hidden="true">Seviye ${escapeHtml(String(p.level || 1))}</span>
        </div>
        <button type="button" class="xp-track" ${detailAttrs('XP yolu', `${formatNumber(xp.current || 0)} / ${formatNumber(xp.max || 0)} XP. Kayıt ve görevler bu çubuğu doldurur.`)}><span class="xp-fill" style="--xp:${xpPct}%"></span></button>
        <div class="xp-label">
          <span>${escapeHtml(formatNumber(xp.current || 0))} / ${escapeHtml(formatNumber(xp.max || 0))} XP</span>
          <span class="streak-fire"><span class="flame asset-icon" aria-hidden="true"><img src="${ASSETS.reward.streak}" alt=""></span><b>${escapeHtml(String(streak.current || 0))}</b><small>gün seri</small></span>
        </div>
      </div>
    </div>
  `
}

function renderEnergyStrip(ready = {}) {
  return `
    <section class="energy-strip" aria-label="Bugünün enerjisi">
      ${energyCell('ready', ASSETS.reward.recovery, 'Enerji', ready.score)}
      ${energyCell('armor', ASSETS.reward.shield, 'Dayanıklılık', ready.armor)}
      ${energyCell('load', ASSETS.info.bodyPressure, 'Yorgunluk', ready.fatigue)}
    </section>
  `
}

function energyCell(kind, icon, name, value) {
  const v = clamp(Number(value), 0, 100)
  const display = Number.isFinite(Number(value)) ? Math.round(v) : '--'
  return `
    <button type="button" class="energy-cell is-${escapeAttr(kind)}" ${detailAttrs(name, `${display}/100`)}>
      <div class="e-top"><span class="e-ico asset-icon" aria-hidden="true"><img src="${icon}" alt=""></span><span class="e-name">${escapeHtml(name)}</span></div>
      <b>${escapeHtml(String(display))}</b>
      <div class="energy-bar"><i style="--v:${v}%"></i></div>
    </button>
  `
}

function renderLastCard(latest) {
  return `
    <article class="card last-card">
      <div class="card-head">
        <span class="card-title">Son kayıt</span>
        <button type="button" class="card-tag" data-refresh>${syncBusy ? 'Çekiliyor' : 'Yenile'}</button>
      </div>
      ${latest ? `
        <div class="l-type">${escapeHtml(displayWorkoutType(latest.type || 'Seans'))}</div>
        <p class="soft">${escapeHtml(cleanText(latest.highlight || latest.notes || 'Son kayıt işlendi.'))}</p>
        <div class="meta-row">
          <span>${escapeHtml(latest.date || '-')}</span>
          <span>${latest.durationMin ? `${Math.round(latest.durationMin)} dk` : 'süre yok'}</span>
          ${latest.volumeKg ? `<span>${escapeHtml(formatNumber(latest.volumeKg))} kg</span>` : ''}
        </div>
      ` : `
        <div class="l-type">İlk kayıt bekliyor</div>
        <p class="soft">İlk kaydı ODIE’ye söyle, Komuta canlansın.</p>
      `}
    </article>
  `
}

/* ============================================================
   MAP / HARITA
   ============================================================ */
function renderMapScreen(model) {
  const priority = model.bodyMap.priority || {}
  const quest = model.bodyMap.dailyQuest || {}
  const regions = [...(model.bodyMap.regions || [])]
    .sort((a, b) => (b.risk || 0) - (a.risk || 0)).slice(0, 8)
  const moves = [...(model.bodyMap.movementLines || [])]
    .sort((a, b) => (b.progress || b.score || 0) - (a.progress || a.score || 0)).slice(0, 5)

  return `
    <section class="screen map-screen">
      <div class="screen-head">
        <span class="kick">Harita</span>
        <h1>${escapeHtml(cleanText(model.worldMap?.title || 'Dünya Haritası'))}</h1>
        <p>${escapeHtml(cleanText(model.worldMap?.subtitle || quest.desc || priority.movement?.todayStep || 'Bugünün baskı noktası burada.'))}</p>
      </div>

      ${renderWorldMapBoard(model.worldMap)}
      <div class="split-3 info-row">
        ${renderXpBreakdown(model.bodyMap.xpPreview)}
        ${renderBodyPressure(model.bodyMap)}
        ${renderUnlockLadder(model.bodyMap)}
        ${renderRecoveryGate(model.system.readiness, model.healthSummary, model.truthMap)}
        ${renderPrGate(model.profile.performance, model.nextSession)}
      </div>

      ${renderStatCard(model.stats)}
      ${renderPrShowcase(model.profile.performance)}

      <section class="zone-grid">
        ${model.zones.map(renderZoneTile).join('')}
      </section>

      ${renderSkillTrees(model.profile.skills)}
      ${renderMuscleMap(model.profile.muscles)}
      ${renderDebuffs(model.profile.debuffs)}

      <div class="split-2">
        <article class="card">
          <div class="card-head">
            <span class="card-title">Bölge bakımı</span>
            <span class="card-tag">${escapeHtml(cleanText(priority.region?.trend || 'tarama'))}</span>
          </div>
          <div class="row-list">
            ${regions.length ? regions.map(renderRegionRow).join('') : '<p class="soft">Yeni kayıt geldikçe bölgeler burada belirir.</p>'}
          </div>
        </article>

        <article class="card">
          <div class="card-head">
            <span class="card-title">Hareket kilitleri</span>
            <span class="card-tag">${escapeHtml(cleanText(priority.unlock?.name || 'kilit'))}</span>
          </div>
          <div class="row-list">
            ${moves.length ? moves.map(renderMoveRow).join('') : '<p class="soft">Hareket hatları yeni seanslarla açılır.</p>'}
          </div>
        </article>
      </div>
    </section>
  `
}

function renderWorldMapBoard(worldMap = {}) {
  const zones = Array.isArray(worldMap.zones) ? worldMap.zones : []
  const nodes = Array.isArray(worldMap.nodes) ? worldMap.nodes : []
  if (!zones.length) return ''
  const nodeType = node => String(node?.type || '').toLowerCase()
  const preferredNodes = [
    nodes.find(node => nodeType(node) === 'activequestnode'),
    nodes.find(node => nodeType(node) === 'unlockgatenode'),
    nodes.find(node => nodeType(node) === 'bountynode' && node.kind === 'weak_line'),
    nodes.find(node => nodeType(node) === 'rewardnode'),
  ].filter(Boolean)
  const preferredKeys = new Set(preferredNodes.map(node => node.key))
  const deckNodes = [
    ...preferredNodes,
    ...nodes.filter(node => !preferredKeys.has(node.key)),
  ]
  const nodeByZone = new Map()
  nodes.forEach(node => {
    if (!nodeByZone.has(node.zone)) nodeByZone.set(node.zone, [])
    nodeByZone.get(node.zone).push(node)
  })
  return `
    <article class="world-map-board">
      ${responsiveAsset('world-map-bg', ASSETS.backgrounds.worldMap)}
      <img class="world-board-layer" src="${ASSETS.ui.boardLayer}" alt="" aria-hidden="true">
      <div class="world-route" aria-hidden="true"></div>
      ${zones.map(zone => {
        const zoneNodes = nodeByZone.get(zone.key) || []
        const active = zone.state === 'active' || zone.key === worldMap.activeZoneKey
        const detail = worldZoneDetail(zone, zoneNodes)
        const zoneIcon = ASSETS.zone[zone.key] || ASSETS.routeMarker
        return `
          <button type="button" class="world-node is-${escapeAttr(zone.state || 'idle')} ${active ? 'active-quest-node' : ''}"
            style="--x:${clamp(zone.x, 0, 100)}%;--y:${clamp(zone.y, 0, 100)}%;--p:${clamp(zone.progress, 0, 100)}%"
            ${detailAttrs(zone.name, detail || 'Bu bölge yeni kayıtlarla ilerler.')}>
            <span class="wn-icon" aria-hidden="true"><img src="${zoneIcon}" alt=""></span>
            <span class="wn-name">${escapeHtml(cleanText(zone.short || zone.name))}</span>
            <i aria-hidden="true"></i>
          </button>
        `
      }).join('')}
      <div class="world-callout">
        <span>${escapeHtml(cleanText(nodes[0]?.title || 'Bugünün görevi'))}</span>
        <b>${escapeHtml(cleanText(nodes[0]?.reward || '+XP'))}</b>
      </div>
      <div class="world-node-deck">
        ${deckNodes.map(node => `
          <button type="button" class="world-mini-node type-${escapeAttr(node.type || 'node')}" ${detailAttrs(node.title || 'Harita notu', `${node.body || ''} ${node.reward ? `Ödül: ${node.reward}` : ''}`)}>
            <span aria-hidden="true"><img src="${worldNodeIcon(node)}" alt=""></span>
            <b>${escapeHtml(cleanText(node.title || 'Not'))}</b>
          </button>
        `).join('')}
      </div>
    </article>
  `
}

function worldZoneDetail(zone = {}, nodes = []) {
  const stateLabel = {
    active: 'Aktif görev bölgesi.',
    ready: 'Hazır bölge.',
    blocked: 'Dikkat kapısı.',
    idle: 'Bekleyen bölge.',
  }[zone.state || 'idle'] || 'Harita bölgesi.'
  const nodeText = nodes.map(node => `${node.title}: ${node.body}${node.reward ? ` Ödül ${node.reward}.` : ''}`).join(' ')
  return [stateLabel, zone.detail, nodeText].filter(Boolean).join(' ')
}

function worldNodeIcon(node = {}) {
  const type = String(node.type || '').toLowerCase()
  if (type.includes('bounty')) return ASSETS.reward.bounty || ASSETS.badge.bounty || ASSETS.badge.quest
  if (type.includes('unlock')) return ASSETS.reward.unlock
  if (type.includes('risk')) return ASSETS.info.bodyPressure
  if (type.includes('movement')) return ASSETS.zone.parkour
  if (type.includes('reward')) return ASSETS.reward.gift
  return ASSETS.badge.quest
}

function renderXpBreakdown(xpPreview = {}) {
  const parts = Array.isArray(xpPreview.parts) ? xpPreview.parts.filter(part => Number(part.value) > 0).slice(0, 5) : []
  const total = Number(xpPreview.total) || parts.reduce((sum, part) => sum + (Number(part.value) || 0), 0)
  return `
    <article class="card info-card xp-breakdown" ${detailAttrs('XP kırılımı', cleanText(xpPreview.text || 'Bugünkü hamle XP havuzunu açar.'))}>
      <div class="card-head">
        <span class="card-title with-icon"><img src="${ASSETS.info.xp}" alt="" aria-hidden="true">XP kırılımı</span>
        <span class="card-tag">+${escapeHtml(formatNumber(total))}</span>
      </div>
      <div class="xp-stack">
        ${parts.map(part => `<span style="--v:${clamp((Number(part.value) / Math.max(1, total)) * 100, 6, 100)}%"><b>${escapeHtml(cleanText(part.label || 'XP'))}</b><i>+${escapeHtml(formatNumber(part.value || 0))}</i></span>`).join('') || '<p class="soft">Kayıt gelince ödül kırılımı burada açılır.</p>'}
      </div>
    </article>
  `
}

function renderBodyPressure(bodyMap = {}) {
  const region = bodyMap.priority?.region || {}
  const top = [...(bodyMap.regions || [])].sort((a, b) => (b.risk || 0) - (a.risk || 0)).slice(0, 4)
  return `
    <article class="card info-card body-pressure" ${detailAttrs('Vücut baskısı', region.label ? `${region.label} hattı bugün öncelikte.` : 'Bölge baskısı yeni kayıtlarla netleşir.')}>
      <div class="card-head">
        <span class="card-title with-icon"><img src="${ASSETS.info.bodyPressure}" alt="" aria-hidden="true">Vücut baskısı</span>
        <span class="card-tag">${escapeHtml(cleanText(region.label || 'tarama'))}</span>
      </div>
      <div class="pressure-list">
        ${top.map(item => `
          <button type="button" class="pressure-row" ${detailAttrs(item.label || 'Bölge', `${item.trend || 'takip'} · ${Math.round(item.risk || 0)} baskı. ${item.tip || item.detail || ''}`)}>
            <span>${escapeHtml(cleanText(item.label || item.id || 'Bölge'))}</span>
            <i style="--v:${clamp(item.risk, 0, 100)}%"></i>
            <b>${Math.round(clamp(item.risk, 0, 100))}</b>
          </button>
        `).join('') || '<p class="soft">Bölge kaydı bekleniyor.</p>'}
      </div>
    </article>
  `
}

function renderUnlockLadder(bodyMap = {}) {
  const list = [...(bodyMap.unlockTargets || []), ...(bodyMap.movementLines || [])]
    .filter(item => Number(item.progress ?? item.score) > 0)
    .sort((a, b) => Number(b.progress ?? b.score) - Number(a.progress ?? a.score))
    .slice(0, 5)
  return `
    <article class="card info-card unlock-ladder" ${detailAttrs('Kilit merdiveni', 'Yakın açılımlar ve hareket hatları burada izlenir.')}>
      <div class="card-head">
        <span class="card-title with-icon"><img src="${ASSETS.info.unlock}" alt="" aria-hidden="true">Kilit merdiveni</span>
        <span class="card-tag">${list.length ? 'yolda' : 'bekliyor'}</span>
      </div>
      <div class="ladder-list">
        ${list.map(item => {
          const progress = clamp(item.progress ?? item.score, 0, 100)
          return `
            <button type="button" class="ladder-step" ${detailAttrs(item.name || item.label || 'Kilit', item.todayStep || item.missing || 'Mini blok ilerletir.')}>
              <span>${escapeHtml(cleanText(item.name || item.label || 'Kilit'))}</span>
              <i style="--v:${progress}%"></i>
              <b>${Math.round(progress)}%</b>
            </button>
          `
        }).join('') || '<p class="soft">İlk kilit yeni seanslarla görünür.</p>'}
      </div>
    </article>
  `
}

function renderRecoveryGate(readiness = {}, healthSummary = null, truthMap = {}) {
  const score = Math.round(clamp(readiness.score ?? readiness.armor ?? 0))
  const fatigue = Math.round(clamp(readiness.fatigue ?? 0))
  const label = healthSummary?.day ? 'Apple izi' : truthMap.appleDisabled ? 'Apple kapalı' : 'can kapısı'
  const detail = healthSummary?.day
    ? `Enerji ${score}/100. Yorgunluk ${fatigue}/100. Sağlık özeti ritme katılıyor.`
    : truthMap.appleDisabled
      ? `Enerji ${score}/100. Yorgunluk ${fatigue}/100. Apple kapalı; ODIE uyku ve kalbi yok diye okur.`
      : `Enerji ${score}/100. Yorgunluk ${fatigue}/100. Apple bekliyorsa ODIE son seanslardan tahmin eder.`
  return `
    <article class="card info-card recovery-gate" ${detailAttrs('Toparlanma kapısı', detail)}>
      <div class="card-head">
        <span class="card-title with-icon"><img src="${ASSETS.info.recoveryGate}" alt="" aria-hidden="true">Toparlanma kapısı</span>
        <span class="card-tag">${escapeHtml(cleanText(label))}</span>
      </div>
      <div class="gate-meter">
        <span><b>Enerji</b><i>${score}</i></span>
        <em style="--v:${score}%"></em>
        <span><b>Yorgunluk</b><i>${fatigue}</i></span>
      </div>
    </article>
  `
}

function renderPrGate(performance = [], nextSession = {}) {
  const list = Array.isArray(performance) ? performance : []
  const latest = list[0] || {}
  const ready = !['danger', 'warn'].includes(nextSession.tone)
  return `
    <article class="card info-card pr-gate" ${detailAttrs('PR kapısı', latest.name ? `${latest.name}: ${latest.val || latest.trend || ''}. ${ready ? 'Temiz form varsa denenebilir.' : 'Bugün önce kontrol.'}` : 'Rekor kapısı yeni seanslarla açılır.')}>
      <div class="card-head">
        <span class="card-title with-icon"><img src="${ASSETS.info.prGate}" alt="" aria-hidden="true">PR kapısı</span>
        <span class="card-tag">${ready ? 'hazir' : 'kontrol'}</span>
      </div>
      <div class="gate-meter is-pr">
        <span><b>${escapeHtml(cleanText(latest.name || 'Rekor'))}</b><i>${escapeHtml(cleanText(latest.val || latest.trend || '+XP'))}</i></span>
        <em style="--v:${ready ? 72 : 34}%"></em>
        <span><b>Komut</b><i>${ready ? 'temiz dene' : 'zorlamadan'}</i></span>
      </div>
    </article>
  `
}

function renderPrShowcase(performance = []) {
  const list = Array.isArray(performance) ? performance.slice(0, 6) : []
  if (!list.length) return ''
  return `
    <article class="card pr-showcase">
      <div class="card-head">
        <span class="card-title">PR vitrini</span>
        <span class="card-tag">rekorlar</span>
      </div>
      <div class="pr-grid">
        ${list.map(pr => `
          <button type="button" class="pr-card" ${detailAttrs(pr.name || 'PR', pr.tip || pr.note || pr.trend || '')}>
            <span class="pr-icon asset-icon" aria-hidden="true"><img src="${ASSETS.reward.pr}" alt=""></span>
            <div class="pr-meta">
              <span class="pr-name">${escapeHtml(cleanText(pr.name || 'PR'))}</span>
              <b class="pr-val">${escapeHtml(cleanText(pr.val || ''))}</b>
              <span class="pr-trend">${escapeHtml(cleanText(pr.trend || pr.note || ''))}</span>
            </div>
          </button>
        `).join('')}
      </div>
    </article>
  `
}

function renderSkillTrees(skills = []) {
  const trees = Array.isArray(skills) ? skills : []
  if (!trees.length) return ''
  return `
    <article class="card skill-trees">
      <div class="card-head">
        <span class="card-title">Yetenek ağacı</span>
        <span class="card-tag">kilit / açık</span>
      </div>
      <div class="tree-grid">
        ${trees.map(renderSkillBranch).join('')}
      </div>
    </article>
  `
}

function renderSkillBranch(branch = {}) {
  const items = Array.isArray(branch.items) ? branch.items : []
  const done = items.filter(i => i.status === 'done').length
  return `
    <div class="skill-branch ${branch.warning ? 'is-warn' : ''}">
      <div class="sb-head">
        <span class="sb-name">${escapeHtml(cleanText(branch.branch || 'Ağaç'))}</span>
        <span class="sb-count">${done}/${items.length}</span>
      </div>
      <div class="sb-items">
        ${items.map(item => `
          <button type="button" class="skill-node st-${escapeAttr(item.status || 'lock')}" ${detailAttrs(item.name || 'Kilit', item.desc || item.req || '')}>
            <span class="sn-dot asset-icon" aria-hidden="true"><img src="${skillNodeIcon(item)}" alt=""></span>
            <span class="sn-name">${escapeHtml(cleanText(item.name || ''))}</span>
            <span class="sn-req">${escapeHtml(cleanText(item.status === 'lock' ? (item.req || 'kilitli') : item.status === 'prog' ? 'çalışılıyor' : 'açık'))}</span>
          </button>
        `).join('')}
      </div>
    </div>
  `
}

function renderMuscleMap(muscles = []) {
  const list = Array.isArray(muscles) ? muscles : []
  if (!list.length) return ''
  return `
    <article class="card muscle-map">
      <div class="card-head">
        <span class="card-title">Kas haritası</span>
        <span class="card-tag">denge</span>
      </div>
      <div class="muscle-grid">
        ${list.map(renderMuscleCard).join('')}
      </div>
    </article>
  `
}

function renderMuscleCard(muscle = {}) {
  const rank = String(muscle.rank || 'F').trim()
  return `
    <button type="button" class="muscle-card" ${detailAttrs(muscle.name || 'Bölge', muscle.tip || muscle.detail || '')}>
      <div class="mc-top">
        <span class="mc-icon asset-icon" aria-hidden="true"><img src="${ASSETS.info.statRank}" alt=""></span>
        <span class="mc-name">${escapeHtml(cleanText(muscle.name || 'Kas'))}</span>
        <span class="mc-rank r-${escapeAttr(rank.charAt(0).toLowerCase())}">${escapeHtml(rank)}</span>
      </div>
      <div class="mc-tag">${escapeHtml(cleanText(muscle.tag || ''))}</div>
      <p class="mc-detail">${escapeHtml(cleanText(muscle.detail || ''))}</p>
    </button>
  `
}

function renderDebuffs(debuffs = []) {
  const list = Array.isArray(debuffs) ? debuffs : []
  if (!list.length) return ''
  return `
    <article class="card debuff-card">
      <div class="card-head">
        <span class="card-title">Zayıf halkalar</span>
        <span class="card-tag">odak</span>
      </div>
      <div class="debuff-list">
        ${list.map(d => `
          <button type="button" class="debuff-row lv-${escapeAttr(d.level || 'blu')}" ${detailAttrs(d.name || 'Dikkat', d.desc || 'Bu halka yeni kayıtlarla temizlenir.')}>
            <span class="d-icon asset-icon" aria-hidden="true"><img src="${ASSETS.info.recoveryGate}" alt=""></span>
            <div>
              <b>${escapeHtml(cleanText(d.name || ''))}</b>
              <p>${escapeHtml(cleanText(d.desc || ''))}</p>
            </div>
          </button>
        `).join('')}
      </div>
    </article>
  `
}

function renderStatCard(stats = []) {
  const byKey = {}
  stats.forEach(s => { byKey[s.key] = s })
  const axes = STAT_AXES.map(axis => {
    const s = byKey[axis.key] || {}
    return { short: axis.short, icon: axis.icon, value: clamp(Number(s.value), 0, 100), rank: s.rank || 'F' }
  })

  return `
    <article class="card">
      <div class="card-head">
        <span class="card-title with-icon"><img src="${ASSETS.info.statRank}" alt="" aria-hidden="true">Karakter statları</span>
        <span class="card-tag">RPG</span>
      </div>
      <button type="button" class="radar-button" ${detailAttrs('Stat radarı', 'Altı stat son kayıtların etkisine göre şekillenir. Güç, çeviklik, dayanıklılık, beceri, gövde ve stamina birlikte okunur.')}>
        ${statRadar(axes)}
      </button>
      <div class="stat-legend">
        ${axes.map(a => `
          <button type="button" class="stat-chip" ${detailAttrs(`${a.short} ${a.rank}`, `Skor ${Math.round(a.value)}. Bir sonraki rütbe için ilgili hareket hattını besle.`)}>
            <img src="${a.icon}" alt="" aria-hidden="true">
            <span class="s-name">${escapeHtml(a.short)}</span>
            <b>${escapeHtml(a.rank)}</b>
            <span class="s-rank">${Math.round(a.value)}</span>
          </button>
        `).join('')}
      </div>
    </article>
  `
}

function renderZoneTile(zone = {}) {
  return `
    <button type="button" class="zone-tile t-${escapeAttr(zone.tone)}" style="--heat:${zone.heat}%" ${detailAttrs(zone.name, zone.detail)}>
      <span class="z-emoji asset-icon" aria-hidden="true"><img src="${zoneTileIcon(zone)}" alt=""></span>
      <span class="z-name">${escapeHtml(zone.name)}</span>
      <p class="z-detail">${escapeHtml(cleanText(zone.detail))}</p>
      <span class="z-count">${zone.count}</span>
    </button>
  `
}

function zoneTileIcon(zone = {}) {
  const key = String(zone.key || '').toLowerCase()
  if (key === 'gym') return ASSETS.zone.forge
  if (key === 'parkour' || key === 'acro') return ASSETS.zone.parkour
  if (key === 'walk') return ASSETS.zone.endurance
  if (key === 'recovery') return ASSETS.zone.recovery
  return ASSETS.routeMarker
}

function renderRegionRow(region = {}) {
  const risk = clamp(region.risk, 0, 100)
  return `
    <button type="button" class="bar-row" ${detailAttrs(region.label || 'Bölge', `${region.trend || 'takip'} · ${Math.round(risk)} baskı. ${region.tip || region.detail || ''}`)}>
      <span class="r-name">${escapeHtml(cleanText(region.label || region.id || 'Bölge'))}</span>
      <b>${Math.round(risk)}</b>
      <span class="track"><i style="--v:${risk}%"></i></span>
    </button>
  `
}

function renderMoveRow(line = {}) {
  const progress = clamp(line.progress ?? line.score, 0, 100)
  return `
    <button type="button" class="bar-row is-move" ${detailAttrs(line.label || 'Hat', line.todayStep || 'Mini blok ilerletir.')}>
      <span class="r-name">${escapeHtml(cleanText(line.label || line.id || 'Hat'))}</span>
      <b>${Math.round(progress)}%</b>
      <span class="track"><i style="--v:${progress}%"></i></span>
      <small>${escapeHtml(cleanText(line.todayStep || 'mini blok'))}</small>
    </button>
  `
}

/* ============================================================
   LOG / GUNLUK
   ============================================================ */
function renderLogScreen(model) {
  const preset = PRESETS[selectedPreset] || PRESETS.Gym
  const today = getLocalDateString()
  const log = model.todayLog || {}

  return `
    <section class="screen log-screen">
      <div class="screen-head">
        <span class="kick">Günlük</span>
        <h1>Kaydi tamamla</h1>
        <p>Seansi, yuruyusu veya parkuru tek defterden gir.</p>
      </div>

      ${logNotice ? `<div class="notice"><span>${escapeHtml(logNotice)}</span><button type="button" data-clear-notice>Tamam</button></div>` : ''}

      <div class="preset-rail" aria-label="Kayıt presetleri">
        ${Object.entries(PRESETS).map(([key, item]) => `
          <button type="button" class="preset ${selectedPreset === key ? 'active' : ''}" data-preset="${escapeAttr(key)}">
            <b>${escapeHtml(item.label)}</b>
            <span>${escapeHtml(item.note)}</span>
          </button>
        `).join('')}
      </div>

      <form class="card" id="route-log-form">
        <div class="field-grid">
          <label class="field"><span>Tarih</span><input name="date" type="date" value="${escapeAttr(today)}" required></label>
          <label class="field"><span>Tip</span>
            <select name="type">
              ${WORKOUT_TYPES.map(type => `<option value="${escapeAttr(type)}" ${type === preset.type ? 'selected' : ''}>${escapeHtml(displayWorkoutType(type))}</option>`).join('')}
            </select>
          </label>
          <label class="field"><span>Süre dk</span><input name="durationMin" type="number" min="1" max="720" value="${escapeAttr(preset.durationMin)}" required></label>
          <label class="field"><span>Mesafe km</span><input name="distanceKm" type="number" min="0" step="0.1" value="${escapeAttr(preset.distanceKm)}"></label>
          <label class="field"><span>Yükselti m</span><input name="elevationM" type="number" min="0" step="1" value="0"></label>
        </div>
        <div class="exercise-editor" aria-label="Egzersiz satirlari">
          <div class="exercise-head">
            <span>Egzersiz</span><span>Set</span><span>Tekrar</span><span>Kg</span>
          </div>
          ${[0, 1, 2].map(index => `
            <div class="exercise-row">
              <input name="exerciseName" type="text" maxlength="48" placeholder="${index === 0 ? 'bench press' : 'opsiyonel'}">
              <input name="exerciseSets" type="number" min="0" max="20" step="1" placeholder="3">
              <input name="exerciseReps" type="number" min="0" max="100" step="1" placeholder="8">
              <input name="exerciseKg" type="number" min="0" max="500" step="0.5" placeholder="60">
            </div>
          `).join('')}
        </div>
        <label class="field"><span>Kisa not</span><input name="highlight" type="text" maxlength="90" value="${escapeAttr(preset.note)}" placeholder="or: 8 dk core + 3 temiz set"></label>
        <label class="field"><span>Detay</span><textarea name="notes" rows="3" placeholder="zemin, yorgunluk, risk, teknik his..."></textarea></label>
        <button class="btn-primary full" type="submit" ${routeSubmitBusy ? 'disabled' : ''}>${routeSubmitBusy ? 'Kayıt işleniyor' : 'Kaydı tamamla'}</button>
      </form>

      <div class="split-2">
        <article class="card">
          <div class="card-head">
            <span class="card-title">Günlük durum</span>
            <span class="card-tag">${escapeHtml(today)}</span>
          </div>
          ${renderDailyControls(log)}
        </article>

        <form class="card" id="body-event-form">
          <div class="card-head">
            <span class="card-title">Vücut notu</span>
            <span class="card-tag">risk</span>
          </div>
          <label class="field"><span>Bölge</span>
            <select name="region">
              ${BODY_REGION_OPTIONS.map(item => `<option value="${escapeAttr(item.id)}">${escapeHtml(item.label)}</option>`).join('')}
            </select>
          </label>
          <div class="field-grid two">
            <label class="field"><span>Şiddet</span><input name="severity" type="number" min="1" max="5" value="3"></label>
            <label class="field"><span>Toparlanma %</span><input name="recoveryPercent" type="number" min="0" max="100" value="70"></label>
          </div>
          <label class="field"><span>Not</span><input name="note" type="text" maxlength="120" placeholder="ör: bilek sert push istemiyor"></label>
          <button class="btn-ghost full" type="submit" ${bodySubmitBusy ? 'disabled' : ''}>${bodySubmitBusy ? 'Ekleniyor' : 'Vücut notu ekle'}</button>
        </form>
      </div>
    </section>
  `
}

function renderDailyControls(log = {}) {
  const water = Number(log.waterMl) || 0
  const sleep = Number(log.sleepHours) || 0
  const steps = Number(log.steps) || 0
  const mood = Number(log.mood) || 0
  return `
    <div class="daily-list">
      <div class="daily-row">
        <span>Su</span>
        <b>${(water / 1000).toFixed(1)}L</b>
        <button type="button" class="btn-ghost" data-daily-action="water" data-amount="500">+0.5L</button>
      </div>
      <label class="daily-row">
        <span>Uyku</span>
        <input id="sleep-input" type="number" min="0" max="16" step="0.5" value="${escapeAttr(sleep || '')}" placeholder="7.5">
        <button type="button" class="btn-ghost" data-daily-action="sleep">Kaydet</button>
      </label>
      <label class="daily-row">
        <span>Adim</span>
        <input id="steps-input" type="number" min="0" value="${escapeAttr(steps || '')}" placeholder="12000">
        <button type="button" class="btn-ghost" data-daily-action="steps">Kaydet</button>
      </label>
      <div class="mood-pick" aria-label="Mod">
        ${[1, 2, 3, 4, 5].map(value => `<button type="button" class="${mood === value ? 'active' : ''}" data-mood="${value}">${value}</button>`).join('')}
      </div>
    </div>
  `
}

/* ============================================================
   SIGNAL / ODIE
   ============================================================ */
function renderSignalScreen(model) {
  const note = model.state.coachNote || {}
  const sections = Array.isArray(note.sections) ? note.sections : []
  const result = askState.result
  const command = cleanText(model.nextSession.coachCommand || 'Yeni kayıt geldikçe bugünün rotası netleşir.')

  return `
    <section class="screen signal-screen">
      <div class="odie-hero">
        ${responsiveAsset('odie-room-bg', ASSETS.backgrounds.odieRoom)}
        <div class="odie-face" aria-hidden="true"><img src="${odieStateAsset()}" alt=""></div>
        <div>
          <div class="o-kick">ODIE komut odasi</div>
          <p>${escapeHtml(command)}</p>
        </div>
      </div>

      ${signalNotice ? `<div class="notice"><span>${escapeHtml(signalNotice)}</span><button type="button" data-clear-signal>Tamam</button></div>` : ''}

      <div class="split-2 signal-grid">
        <article class="card odie-composer-card">
          <div class="card-head">
            <span class="card-title with-icon"><img src="${ASSETS.odie.portrait}" alt="" aria-hidden="true">ODIE’ye söyle</span>
            <span class="card-tag">${askState.loading ? 'yükleniyor' : 'giriş'}</span>
          </div>
          <form id="ask-form" class="ask-form">
            <textarea id="ask-textarea" name="question" rows="4" placeholder="Örn: dün bench 65kg 3x5 yaptım. / 7 saat uyudum 9000 adım. / omuz ağrıyor. / Bugün ne yapayım?">${escapeHtml(askState.draft || '')}</textarea>
            <button class="btn-primary full" type="submit" ${askState.submitting ? 'disabled' : ''}>${askState.submitting ? 'ODIE okuyor' : 'ODIE’ye söyle'}</button>
          </form>
          ${askState.error ? `<p class="warn-line">${escapeHtml(shortCommand(askState.error, 96))}</p>` : ''}
          ${askState.intakePreview ? renderIntakePreview(askState.intakePreview) : ''}
          ${askState.intakeResult ? renderIntakeResult(askState.intakeResult) : ''}
          ${result ? renderAskResult(result) : renderAskHistory()}
        </article>

        <article class="card odie-brief-card">
          <div class="card-head">
            <span class="card-title">Bugünün özeti</span>
            <span class="card-tag">${escapeHtml(note.date || model.nextSession.date || '')}</span>
          </div>
          ${renderOdieBrief(note, command, model)}
          <div class="feedback-row">
            <button type="button" data-feedback="correct">Doğru</button>
            <button type="button" data-feedback="wrong">Yanlış</button>
            <button type="button" data-feedback="outdated">Eski</button>
            <button type="button" data-feedback="tone_good">Tonu iyi</button>
          </div>
        </article>
      </div>
    </section>
  `
}

function skillNodeIcon(item = {}) {
  if (item.status === 'done') return ASSETS.badge.quest
  if (item.status === 'prog') return ASSETS.reward.unlock
  return ASSETS.badge.locked
}

function odieStateAsset() {
  if (askState.error) return ASSETS.odie.warning
  if (askState.intakePreview || askState.intakeResult) return ASSETS.odie.confirm
  if (askState.submitting || askState.loading || askState.confirming) return ASSETS.odie.listening
  return ASSETS.odie.idle
}

function renderCoachSection(section = {}) {
  const rawLines = Array.isArray(section.lines)
    ? section.lines
    : [section.body, section.text, section.note, section.summary]
  const lines = rawLines
    .map(line => cleanText(String(line || '').replace(/^>\s*/, '').replace(/\*\*/g, '')))
    .filter(Boolean)
    .slice(0, 3)
  const title = cleanText(section.title || section.heading || 'Sıradaki hamle')
  return `
    <div class="coach-sec">
      <b>${escapeHtml(title)}</b>
      ${lines.length ? lines.map(line => `<p>${escapeHtml(line)}</p>`).join('') : '<p>Tek temiz komut bekleniyor.</p>'}
    </div>
  `
}

function renderOdieBrief(note = {}, command = '', model = {}) {
  const sections = Array.isArray(note.sections) ? note.sections : []
  const lines = sections.flatMap(section => {
    const raw = Array.isArray(section.lines)
      ? section.lines
      : [section.body, section.text, section.note, section.summary]
    return raw.map(line => cleanText(String(line || '').replace(/^>\s*/, '').replace(/\*\*/g, ''))).filter(Boolean)
  })
  const observation = cleanText(note.xpNote || lines[0] || model.latestWorkout?.highlight || 'Yeni kayıt bekleniyor.')
  const reason = cleanText(lines[1] || model.nextSession.primaryGoal?.subtitle || 'Bugünkü seçim son ritme göre ayarlanır.')
  const action = cleanText(command || lines[2] || 'Tek temiz hamle yeter.')
  return `
    <div class="odie-brief">
      <div><span>Gözlem</span><p>${escapeHtml(shortCommand(observation, 110))}</p></div>
      <div><span>Sebep</span><p>${escapeHtml(shortCommand(reason, 110))}</p></div>
      <div><span>Komut</span><p>${escapeHtml(shortCommand(action, 110))}</p></div>
      ${lines.length > 3 ? `<button type="button" class="btn-ghost full" ${detailAttrs('ODIE detayı', lines.join(' '))}>Tam notu aç</button>` : ''}
    </div>
  `
}

function intakeKindLabel(kind = '') {
  return {
    workout: 'Seans kaydı',
    daily_log: 'Can kaydı',
    body_event: 'Vücut notu',
    body_metric: 'Ölçüm',
    question: 'Soru',
    needs_clarification: 'Netleştirme',
  }[kind] || 'Kayıt'
}

function renderIntakePreview(preview = {}) {
  const ready = preview.kind && !['question', 'needs_clarification'].includes(preview.kind)
  return `
    <div class="intake-preview ${ready ? 'is-ready' : 'is-ask'}">
      <div class="ip-head">
        <span>${escapeHtml(intakeKindLabel(preview.kind))}</span>
        <b>${escapeHtml(cleanText(preview.title || preview.question || 'ODIE kartı'))}</b>
      </div>
      <p>${escapeHtml(cleanText(preview.summary || preview.reason || preview.question || 'Kayıt kartı hazır değil.'))}</p>
      ${preview.restEstimate ? `<div class="ip-rest"><span>Dinlenme</span><b>${escapeHtml(cleanText(preview.restEstimate))}</b></div>` : ''}
      <div class="ip-actions">
        ${ready ? `<button type="button" class="btn-primary" data-intake-confirm ${askState.confirming ? 'disabled' : ''}>${askState.confirming ? 'Yazılıyor' : 'Onayla ve yaz'}</button>` : ''}
        <button type="button" class="btn-ghost" data-intake-clear>Vazgeç</button>
      </div>
    </div>
  `
}

function renderIntakeResult(result = {}) {
  return `
    <div class="ask-result intake-result">
      <b>${escapeHtml(intakeKindLabel(result.kind))} yazıldı</b>
      <p>${escapeHtml(cleanText(result.preview?.summary || 'Sistem güncellendi.'))}</p>
      ${result.result?.reward?.chips?.length ? `<div class="chip-stack">${result.result.reward.chips.map(chip => `<span>${escapeHtml(cleanText(chip))}</span>`).join('')}</div>` : ''}
    </div>
  `
}

function renderAskResult(item = {}) {
  const data = item.responseJson || item.response_json || {}
  const steps = data.nextSteps || data.next_steps || []
  return `
    <div class="ask-result">
      <b>${escapeHtml(cleanText(data.title || item.question || 'ODIE'))}</b>
      <p>${escapeHtml(cleanText(item.answer || data.answer || ''))}</p>
      ${steps.length ? `<div class="chip-stack">${steps.slice(0, 3).map(line => `<span>${escapeHtml(cleanText(line))}</span>`).join('')}</div>` : ''}
    </div>
  `
}

function renderAskHistory() {
  if (askState.loading) return '<p class="loading-line">Geçmiş sohbetler çekiliyor.</p>'
  const items = askState.items || []
  if (!items.length) return '<p class="loading-line">Henüz soru yok. İlk sohbeti burada başlat.</p>'
  return `
    <div class="ask-history is-compact">
      ${items.slice(0, 2).map(item => `
        <button type="button" class="history-item" data-history-id="${escapeAttr(item.id || '')}">
          <b>${escapeHtml(shortCommand(cleanText(item.question || 'Soru'), 48))}</b>
          <span>${escapeHtml(shortCommand(cleanText(item.answer || ''), 64))}</span>
        </button>
      `).join('')}
    </div>
  `
}

function renderWarnings(next = {}) {
  const warnings = visibleWarnings(next.warnings || [])
  const caps = visibleWarnings(next.progressionCaps || [])
  if (!warnings.length && !caps.length) return ''
  return `
    <section class="warn-stack">
      ${warnings.slice(0, 3).map(item => `<button type="button" class="warn-line" ${detailAttrs('Dikkat', item)}>${escapeHtml(item)}</button>`).join('')}
      ${caps.slice(0, 2).map(item => `<button type="button" class="cap-line" ${detailAttrs('Sinir', item)}>${escapeHtml(item)}</button>`).join('')}
    </section>
  `
}

/* ============================================================
   INFOGRAPHICS (pure SVG)
   ============================================================ */
function renderProgressCard(snapshot = {}, extraClass = '', loop = {}) {
  const classes = `card progress-card ${extraClass}`.trim()
  if (snapshot.empty) {
    return `
      <article class="${escapeAttr(classes)}">
        <div class="card-head">
          <span class="card-title">Gelişim pano</span>
          <span class="card-tag">eski → şimdi</span>
        </div>
        <p class="soft">İlk seans gelsin, burası başlangıç ve şimdi halini yan yana çizecek.</p>
        ${renderMapProgress(loop.mapProgress)}
      </article>
    `
  }

  const lead = snapshot.metrics?.[0] || {}
  const oldLabel = formatMetricValue(lead.oldValue, lead.unit)
  const nowLabel = formatMetricValue(lead.nowValue, lead.unit)
  return `
    <article class="${escapeAttr(classes)}">
      <div class="card-head">
        <span class="card-title">Gelişim pano</span>
        <span class="card-tag">eski → şimdi</span>
      </div>
      <div class="era-compare">
        <button type="button" class="era-tile is-old" ${detailAttrs(`İlk ${snapshot.windowSize} seans`, `Başlangıç penceresi: ${oldLabel}. Toplam ${snapshot.oldSummary.sessions} seans.`)}>
          <span>İlk ${escapeHtml(String(snapshot.windowSize))}</span>
          <b>${escapeHtml(oldLabel)}</b>
          <small>baslangic</small>
        </button>
        <div class="era-arrow" aria-hidden="true">-></div>
        <button type="button" class="era-tile is-now" ${detailAttrs(`Son ${snapshot.windowSize} seans`, `Simdi penceresi: ${nowLabel}. Toplam ${snapshot.nowSummary.sessions} seans.`)}>
          <span>Son ${escapeHtml(String(snapshot.windowSize))}</span>
          <b>${escapeHtml(nowLabel)}</b>
          <small>şimdi</small>
        </button>
      </div>
      ${progressTrendSvg(snapshot.trend, lead.unit)}
      <div class="progress-lanes">
        ${(snapshot.metrics || []).map(renderProgressLane).join('')}
      </div>
      ${renderStatSparkline(snapshot.statLeaders)}
      ${renderMapProgress(loop.mapProgress)}
    </article>
  `
}

function renderMapProgress(items = []) {
  const list = Array.isArray(items) ? items.slice(0, 4) : []
  if (!list.length) return ''
  return `
    <div class="map-progress" aria-label="Haftalik harita ilerlemesi">
      ${list.map(item => `
        <button type="button" class="map-progress-node tone-${escapeAttr(item.tone || 'build')}" ${detailAttrs(item.label || 'Hat', item.detail || 'Bir temiz blok ilerletir.')}>
          <span><b>${escapeHtml(cleanText(item.label || 'Hat'))}</b><i>${Math.round(clamp(item.progress, 0, 100))}%</i></span>
          <em style="--v:${clamp(item.progress, 0, 100)}%"></em>
        </button>
      `).join('')}
    </div>
  `
}

function renderProgressLane(metric = {}) {
  const max = Math.max(1, Number(metric.oldValue) || 0, Number(metric.nowValue) || 0)
  const oldPct = clamp(((Number(metric.oldValue) || 0) / max) * 100, 0, 100)
  const nowPct = clamp(((Number(metric.nowValue) || 0) / max) * 100, 0, 100)
  const deltaClass = metric.delta > 0 ? 'up' : metric.delta < 0 ? 'down' : 'flat'
  const deltaLabel = formatSignedMetric(metric.delta, metric.unit)
  return `
    <button type="button" class="progress-lane is-${escapeAttr(deltaClass)}" ${detailAttrs(metric.label, `Eski ${formatMetricValue(metric.oldValue, metric.unit)}. Simdi ${formatMetricValue(metric.nowValue, metric.unit)}. Fark ${deltaLabel}.`)}>
      <span class="pl-head"><b>${escapeHtml(metric.label)}</b><i>${escapeHtml(deltaLabel)}</i></span>
      <span class="pl-bars" aria-hidden="true">
        <span class="pl-track old"><i style="--v:${oldPct}%"></i></span>
        <span class="pl-track now"><i style="--v:${nowPct}%"></i></span>
      </span>
      <span class="pl-foot"><small>eski</small><small>şimdi</small></span>
    </button>
  `
}

function renderStatSparkline(stats = []) {
  if (!stats.length) return ''
  return `
    <div class="stat-sparks" aria-label="En guclu statlar">
      ${stats.map(stat => `
        <button type="button" class="stat-spark" ${detailAttrs(`${stat.label} ${stat.rank}`, `Skor ${Math.round(stat.value)}. Simdiki karakter gucu.`)}>
          <span><img src="${ASSETS.info.statRank}" alt="" aria-hidden="true">${escapeHtml(stat.label)}</span>
          <b>${escapeHtml(stat.rank)}</b>
          <i style="--v:${clamp(stat.value, 0, 100)}%"></i>
        </button>
      `).join('')}
    </div>
  `
}

function progressTrendSvg(points = [], unit = '') {
  const values = points.map(point => Number(point.value) || 0)
  if (!values.length) return ''
  const W = 320, H = 92, padX = 12, padY = 12
  const max = Math.max(1, ...values)
  const step = values.length > 1 ? (W - padX * 2) / (values.length - 1) : 0
  const coords = values.map((value, index) => {
    const x = padX + index * step
    const y = H - padY - (value / max) * (H - padY * 2)
    return [x, y]
  })
  const line = coords.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
  const area = `${padX},${H - padY} ${line} ${W - padX},${H - padY}`
  const first = coords[0]
  const last = coords[coords.length - 1]
  return `
    <svg class="progress-sparkline" viewBox="0 0 ${W} ${H}" role="img" aria-label="Eski seanslardan şimdiye ${unit || 'yük'} trendi">
      <polygon points="${area}" fill="var(--leaf)" opacity="0.72"/>
      <polyline points="${line}" fill="none" stroke="var(--moss)" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="${first[0].toFixed(1)}" cy="${first[1].toFixed(1)}" r="5" fill="var(--clay)"/>
      <circle cx="${last[0].toFixed(1)}" cy="${last[1].toFixed(1)}" r="6" fill="var(--moss)"/>
      <text x="${padX}" y="${H - 2}" font-size="10" fill="var(--clay)">eski</text>
      <text x="${W - padX}" y="${H - 2}" font-size="10" fill="var(--moss)" text-anchor="end">şimdi</text>
    </svg>
  `
}

function formatMetricValue(value = 0, unit = '') {
  const n = Math.round(Number(value) || 0)
  return `${formatNumber(n)} ${unit}`.trim()
}

function formatSignedMetric(value = 0, unit = '') {
  const n = Math.round(Number(value) || 0)
  const sign = n > 0 ? '+' : ''
  return `${sign}${formatNumber(n)} ${unit}`.trim()
}

function renderHeatmapCard(workouts = []) {
  return `
    <article class="card">
      <div class="card-head">
        <span class="card-title">Son 28 gun</span>
        <span class="card-tag">ritim</span>
      </div>
      ${activityHeatmap(workouts)}
      <div class="heatmap-legend">
        <span>az</span>
        ${HEAT_COLORS.map(c => `<span class="sw" style="background:${c}"></span>`).join('')}
        <span>cok</span>
      </div>
    </article>
  `
}

function activityHeatmap(workouts = []) {
  const cols = 7
  const rows = 4
  const total = cols * rows
  const today = new Date()
  const byDate = {}
  for (const w of workouts) {
    const d = normalizeDateString(w.date)
    if (!d) continue
    const load = Number(w.volumeKg) ? Number(w.volumeKg) / 800 : Number(w.durationMin) ? Number(w.durationMin) / 30 : 1
    byDate[d] = (byDate[d] || 0) + Math.max(0.6, load)
  }

  const cell = 38, gap = 7, pad = 4
  const w = cols * cell + (cols - 1) * gap + pad * 2
  const h = rows * cell + (rows - 1) * gap + pad * 2
  let rects = ''
  for (let i = 0; i < total; i += 1) {
    const daysAgo = total - 1 - i
    const d = new Date(today)
    d.setDate(today.getDate() - daysAgo)
    const key = isoDate(d)
    const score = byDate[key] || 0
    const level = score <= 0 ? 0 : score < 1.2 ? 1 : score < 2.4 ? 2 : score < 4 ? 3 : 4
    const col = i % cols
    const row = Math.floor(i / cols)
    const x = pad + col * (cell + gap)
    const y = pad + row * (cell + gap)
    rects += `<rect x="${x}" y="${y}" width="${cell}" height="${cell}" rx="9" fill="${HEAT_COLORS[level]}"><title>${key}</title></rect>`
  }
  return `<svg class="chart-frame" viewBox="0 0 ${w} ${h}" role="img" aria-label="Son 28 gun aktivite isi haritasi">${rects}</svg>`
}

function renderVolumeCard(workouts = []) {
  return `
    <article class="card">
      <div class="card-head">
        <span class="card-title">Son seanslar</span>
        <span class="card-tag">hacim</span>
      </div>
      ${volumeTrend(workouts)}
      <div class="chart-foot"><span>soldan saga: eski → yeni</span></div>
    </article>
  `
}

function volumeTrend(workouts = []) {
  const recent = workouts.slice(0, 12).reverse()
  if (!recent.length) {
    return '<p class="soft">Henüz seans yok. İlk kaydı gir, grafik büyümeye başlasın.</p>'
  }
  const useVolume = recent.some(w => Number(w.volumeKg) > 0)
  const values = recent.map(w => useVolume ? (Number(w.volumeKg) || 0) : (Number(w.durationMin) || 0))
  const max = Math.max(1, ...values)

  const W = 320, H = 132, padX = 10, padB = 18, padT = 8
  const n = values.length
  const slot = (W - padX * 2) / n
  const bw = Math.min(26, slot * 0.62)
  let bars = ''
  values.forEach((v, i) => {
    const bh = Math.max(3, (v / max) * (H - padB - padT))
    const x = padX + i * slot + (slot - bw) / 2
    const y = H - padB - bh
    bars += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${bw.toFixed(1)}" height="${bh.toFixed(1)}" rx="5" fill="url(#volgrad)"><title>${useVolume ? Math.round(v) + ' kg' : Math.round(v) + ' dk'}</title></rect>`
  })
  return `
    <svg class="chart-frame" viewBox="0 0 ${W} ${H}" role="img" aria-label="Son seanslarin ${useVolume ? 'hacim' : 'sure'} trendi">
      <defs>
        <linearGradient id="volgrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#e89a63"/>
          <stop offset="1" stop-color="#e3b455"/>
        </linearGradient>
      </defs>
      <line x1="${padX}" y1="${H - padB}" x2="${W - padX}" y2="${H - padB}" stroke="rgba(111,74,55,0.18)" stroke-width="2"/>
      ${bars}
    </svg>
  `
}

function statRadar(axes = []) {
  const cx = 120, cy = 104, R = 78
  const n = axes.length || 6
  const pt = (idx, radius) => {
    const ang = -Math.PI / 2 + (idx * 2 * Math.PI) / n
    return [cx + radius * Math.cos(ang), cy + radius * Math.sin(ang)]
  }
  // rings
  let rings = ''
  for (const frac of [0.34, 0.67, 1]) {
    const poly = axes.map((_, i) => pt(i, R * frac).map(v => v.toFixed(1)).join(',')).join(' ')
    rings += `<polygon points="${poly}" fill="none" stroke="rgba(111,74,55,0.16)" stroke-width="1.5"/>`
  }
  // spokes + labels
  let spokes = ''
  let labels = ''
  axes.forEach((a, i) => {
    const [ex, ey] = pt(i, R)
    spokes += `<line x1="${cx}" y1="${cy}" x2="${ex.toFixed(1)}" y2="${ey.toFixed(1)}" stroke="rgba(111,74,55,0.14)" stroke-width="1.5"/>`
    const [lx, ly] = pt(i, R + 16)
    labels += `<text x="${lx.toFixed(1)}" y="${(ly + 4).toFixed(1)}" font-size="11" font-family="Silkscreen, monospace" fill="#6f4a37" text-anchor="middle">${escapeHtml(a.short)}</text>`
  })
  // data polygon
  const dataPoly = axes.map((a, i) => pt(i, R * (clamp(a.value, 0, 100) / 100)).map(v => v.toFixed(1)).join(',')).join(' ')
  const dots = axes.map((a, i) => {
    const [px, py] = pt(i, R * (clamp(a.value, 0, 100) / 100))
    return `<circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="3.2" fill="#4d6b4a"/>`
  }).join('')

  return `
    <svg class="chart-frame" viewBox="0 0 240 208" role="img" aria-label="Karakter stat radari">
      ${rings}
      ${spokes}
      <polygon points="${dataPoly}" fill="rgba(111,141,101,0.34)" stroke="#6f8d65" stroke-width="2.5" stroke-linejoin="round"/>
      ${dots}
      ${labels}
    </svg>
  `
}

/* ============================================================
   EVENTS  (store contracts preserved verbatim)
   ============================================================ */
async function handleClick(event) {
  const target = event.target

  if (rewardRecap && target.closest('.reward-recap') && !target.closest('[data-close-recap]')) {
    return
  }

  if (target.closest('[data-close-recap]') || target.dataset?.recapBackdrop !== undefined) {
    rewardRecap = null
    scheduleRender()
    return
  }

  if (detailSheet && target.closest('.detail-sheet') && !target.closest('[data-close-detail]')) {
    return
  }

  if (target.closest('[data-close-detail]') || target.dataset?.detailBackdrop !== undefined) {
    detailSheet = null
    scheduleRender()
    return
  }

  const detailButton = target.closest('[data-detail-title]')
  if (detailButton) {
    detailSheet = {
      title: detailButton.dataset.detailTitle || 'Detay',
      body: detailButton.dataset.detailBody || '',
    }
    scheduleRender()
    return
  }

  const historyButton = target.closest('[data-history-id]')
  if (historyButton) {
    const id = historyButton.dataset.historyId
    askState.result = (askState.items || []).find(item => String(item.id || '') === String(id)) || null
    scheduleRender()
    return
  }

  const tabButton = event.target.closest('[data-tab]')
  if (tabButton) {
    detailSheet = null
    rewardRecap = null
    setActiveTab(tabButton.dataset.tab)
    return
  }

  if (target.closest('[data-intake-clear]')) {
    askState.intakePreview = null
    askState.intakeResult = null
    askState.error = ''
    askState.draft = ''
    scheduleRender()
    return
  }

  if (target.closest('[data-intake-confirm]')) {
    await confirmOdieIntake()
    return
  }

  const presetButton = event.target.closest('[data-preset]')
  if (presetButton) { selectedPreset = presetButton.dataset.preset; logNotice = ''; scheduleRender(); return }

  const dailyButton = event.target.closest('[data-daily-action]')
  if (dailyButton) { await saveDailySignal(dailyButton.dataset.dailyAction, dailyButton); return }

  const moodButton = event.target.closest('[data-mood]')
  if (moodButton) { await saveDailySignal('mood', moodButton); return }

  const feedbackButton = event.target.closest('[data-feedback]')
  if (feedbackButton) { await saveFeedback(feedbackButton.dataset.feedback); return }

  if (event.target.closest('[data-refresh]')) { await syncNow(); return }
  if (event.target.closest('[data-clear-notice]')) { logNotice = ''; scheduleRender(); return }
  if (event.target.closest('[data-clear-signal]')) { signalNotice = ''; scheduleRender() }
}

async function handleSubmit(event) {
  if (event.target.id === 'route-log-form') { event.preventDefault(); await saveRouteLog(event.target) }
  if (event.target.id === 'body-event-form') { event.preventDefault(); await saveBodyGate(event.target) }
  if (event.target.id === 'ask-form') { event.preventDefault(); await askOdie(event.target) }
}

function setActiveTab(tab) {
  if (!TABS.some(item => item.key === tab)) return
  detailSheet = null
  activeTab = tab
  try { localStorage.setItem('odiept-tab', tab) } catch {}
  scheduleRender()
}

async function saveRouteLog(form) {
  if (routeSubmitBusy) return
  const submit = form.querySelector('button[type="submit"]')
  const data = new FormData(form)
  const exercises = parseExerciseRows(data)
  const sets = exercises.reduce((sum, exercise) => sum + exercise.sets.reduce((setSum, set) => setSum + (Number(set.count) || 1), 0), 0)
  const volumeKg = Math.round(exercises.reduce((sum, exercise) =>
    sum + exercise.sets.reduce((setSum, set) => setSum + ((Number(set.kg) || 0) * (Number(set.reps) || 0) * (Number(set.count) || 1)), 0)
  , 0))
  const session = {
    date: String(data.get('date') || getLocalDateString()),
    type: String(data.get('type') || 'Custom'),
    durationMin: Number(data.get('durationMin')) || 0,
    distanceKm: Number(data.get('distanceKm')) || 0,
    elevationM: Number(data.get('elevationM')) || 0,
    highlight: String(data.get('highlight') || '').trim(),
    notes: String(data.get('notes') || '').trim(),
    source: 'manual',
    exercises,
    volumeKg,
    sets,
  }

  if (!session.durationMin) {
    logNotice = 'Süre olmadan kayıt kapanmaz.'
    scheduleRender()
    return
  }

  if (isStrengthSession(session) && (!session.exercises.length || !session.sets || !session.volumeKg)) {
    logNotice = 'Gym kaydı için en az bir egzersiz, set, tekrar ve kg gir.'
    scheduleRender()
    return
  }

  try {
    routeSubmitBusy = true
    if (submit) submit.disabled = true
    const beforeState = snapshotMissionState(store.getState() || {})
    const workout = await store.addWorkout(session)
    const afterState = snapshotMissionState(store.getState() || {})
    const recap = buildRewardRecap({ workout, beforeState, afterState })
    rewardRecap = recap
    logNotice = `${displayWorkoutType(session.type)} deftere girdi. +${workout?.xpEarned || 0} XP${workout?.syncStatus === 'local' ? ' · cihazda tutuldu' : ''}`
    setActiveTab('route')
    window.setTimeout(() => {
      if (rewardRecap?.id === recap.id) {
        rewardRecap = null
        scheduleRender()
      }
    }, 7200)
  } catch (error) {
    console.error('[odiept] route log failed:', error)
    logNotice = `Kayıt takıldı: ${error?.message || error}`
  } finally {
    routeSubmitBusy = false
    if (submit) submit.disabled = false
    scheduleRender()
  }
}

function parseExerciseRows(data) {
  const names = data.getAll('exerciseName')
  const sets = data.getAll('exerciseSets')
  const reps = data.getAll('exerciseReps')
  const kgs = data.getAll('exerciseKg')
  return names.map((name, index) => {
    const cleanName = String(name || '').trim()
    const count = Math.max(0, Math.round(Number(sets[index]) || 0))
    const rep = Math.max(0, Math.round(Number(reps[index]) || 0))
    const kg = Math.max(0, Number(kgs[index]) || 0)
    if (!cleanName || !count || !rep) return null
    return {
      name: cleanName,
      sets: Array.from({ length: count }, () => ({ reps: rep, kg })),
    }
  }).filter(Boolean)
}

async function saveDailySignal(action, button) {
  const state = store.getState() || {}
  const today = getLocalDateString()
  const existing = (state.dailyLogs || []).find(item => normalizeDateString(item.date) === today) || {
    date: today, waterMl: 0, sleepHours: 0, steps: 0, mood: 0,
  }
  const next = { ...existing, date: today }

  if (action === 'water') next.waterMl = Math.min(5000, (Number(next.waterMl) || 0) + (Number(button.dataset.amount) || 500))
  if (action === 'sleep') next.sleepHours = Number(document.getElementById('sleep-input')?.value) || 0
  if (action === 'steps') next.steps = Number(document.getElementById('steps-input')?.value) || 0
  if (action === 'mood') next.mood = Math.max(1, Math.min(5, Number(button.dataset.mood) || 0))

  try {
    await store.saveDailyLog(next)
    logNotice = 'Günlük durum güncellendi.'
  } catch (error) {
    logNotice = `Günlük cihazda kaldı: ${error?.message || error}`
  }
  scheduleRender()
}

async function saveBodyGate(form) {
  if (bodySubmitBusy) return
  const data = new FormData(form)
  const region = String(data.get('region') || 'core')
  const activeSameRegion = (store.getState()?.bodyEvents || [])
    .some(event => String(event.region || event.regionId || '') === region && ['active', 'watch', 'rehab'].includes(String(event.status || 'active')))
  if (activeSameRegion) {
    logNotice = 'Bu bölge zaten haritada aktif. Önce eskisini kapat.'
    scheduleRender()
    return
  }
  try {
    bodySubmitBusy = true
    await store.addBodyEvent({
      kind: 'injury',
      region,
      severity: Number(data.get('severity')) || 3,
      recoveryPercent: Number(data.get('recoveryPercent')) || 70,
      etaDays: 3,
      status: 'active',
      note: String(data.get('note') || '').trim(),
      source: 'manual',
    })
    logNotice = 'Vücut notu haritaya eklendi.'
    setActiveTab('map')
  } catch (error) {
    console.error('[odiept] body gate failed:', error)
    logNotice = `Vücut notu takıldı: ${error?.message || error}`
  }
  bodySubmitBusy = false
  scheduleRender()
}

async function saveFeedback(type) {
  const feedbackType = type === 'tone_good' ? 'prefer' : type
  try {
    await store.addMemoryFeedback({ feedbackType, note: `ODIE feedback: ${feedbackType}` })
    signalNotice = 'Geri bildirim hafızaya gitti.'
  } catch (error) {
    signalNotice = `Geri bildirim takıldı: ${error?.message || error}`
  }
  scheduleRender()
}

async function syncNow() {
  if (syncBusy) return
  syncBusy = true
  scheduleRender()
  try {
    await store.syncFromSupabase()
    logNotice = 'Kayıtlar yenilendi.'
  } catch (error) {
    logNotice = `Yenileme takıldı: ${error?.message || error}`
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
    const response = await fetch('/api/ask', {
      headers: appHeaders(),
    })
    const data = await readJsonResponse(response, 'Sohbet geçmişi alınamadı')
    if (!response.ok || !data.ok) throw new Error(data.error || 'Sohbet geçmişi alınamadı')
    askState.items = data.items || []
  } catch (error) {
    askState.items = []
    askState.error = error?.message || 'Sohbet geçmişi alınamadı'
  } finally {
    askState.loading = false
    scheduleRender()
  }
}

async function askOdie(form) {
  const question = String(new FormData(form).get('question') || askState.draft || '').trim()
  if (!question) {
    askState.error = 'Boş giriş olmaz.'
    scheduleRender()
    return
  }

  askState.submitting = true
  askState.error = ''
  askState.result = null
  askState.intakePreview = null
  askState.intakeResult = null
  scheduleRender()

  try {
    const response = await fetch('/api/intake', {
      method: 'POST',
      headers: appHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ mode: 'preview', text: question }),
    })
      const data = await readJsonResponse(response, 'ODIE kartı dönmedi')
    if (!response.ok || !data.ok) throw new Error(data.error || 'ODIE kartı dönmedi')
    if (data.preview?.kind === 'question') {
      await askQuestion(question)
      form.reset()
      askState.draft = ''
      return
    }
    askState.intakePreview = data.preview
    form.reset()
    askState.draft = ''
  } catch (error) {
    askState.error = error?.message || 'ODIE girişi takıldı'
  } finally {
    askState.submitting = false
    scheduleRender()
  }
}

async function askQuestion(question) {
  const response = await fetch('/api/ask', {
    method: 'POST',
    headers: appHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ question }),
  })
  const data = await readJsonResponse(response, 'ODIE cevabı dönmedi')
  if (!response.ok || !data.ok) throw new Error(data.error || 'ODIE cevabı dönmedi')
  askState.result = data.item
  askState.items = [data.item, ...(askState.items || [])]
}

async function confirmOdieIntake() {
  if (!askState.intakePreview || askState.confirming) return
  askState.confirming = true
  askState.error = ''
  scheduleRender()
  try {
    const response = await fetch('/api/intake', {
      method: 'POST',
      headers: appHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ mode: 'confirm', preview: askState.intakePreview }),
    })
    const data = await readJsonResponse(response, 'Kayıt yazılamadı')
    if (!response.ok || !data.ok) throw new Error(data.error || 'Kayıt yazılamadı')
    askState.intakeResult = data
    askState.intakePreview = null
    signalNotice = `${intakeKindLabel(data.kind)} sisteme girdi.`
    if (data.kind === 'workout' && data.result?.reward) {
      rewardRecap = {
        id: `intake-${Date.now()}`,
        title: 'Ödül Alındı',
        body: 'ODIE kaydı işledi. XP, seri ve harita güncellendi.',
        chips: data.result.reward.chips || [],
        questClosed: true,
      }
    }
    await store.syncFromSupabase()
    if (data.kind === 'body_event') setActiveTab('map')
    else if (data.kind === 'workout') setActiveTab('route')
  } catch (error) {
    askState.error = error?.message || 'Kayıt takıldı'
  } finally {
    askState.confirming = false
    scheduleRender()
  }
}

/* ============================================================
   HELPERS
   ============================================================ */
async function readJsonResponse(response, fallbackMessage = 'İşlem takıldı') {
  try {
    return await response.json()
  } catch {
    throw new Error(fallbackMessage)
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
  const text = `${workout.type || ''} ${(workout.tags || []).join(' ')} ${(workout.blocks || []).map(b => b.kind).join(' ')}`.toLowerCase()
  return /stretch|recovery|mobility|mobilite|breath|nefes/.test(text)
}
function isAcroSession(workout = {}) {
  const text = `${workout.type || ''} ${(workout.tags || []).join(' ')}`.toLowerCase()
  return /akrobasi|acro|flip|barani|handstand|calisthenics/.test(text)
}

function toneLabel(tone = '') {
  return { danger: 'Riskli', warn: 'Dikkat', go: 'Hazır', calm: 'Sakin plan', fire: 'Tempo' }[tone] || 'Plan'
}

function timeGreeting() {
  const h = new Date().getHours()
  if (h < 6) return 'İyi geceler'
  if (h < 12) return 'Günaydın'
  if (h < 18) return 'İyi günler'
  return 'İyi akşamlar'
}

function rankFromValue(value = 0) {
  const n = Number(value) || 0
  if (n >= 88) return 'S'
  if (n >= 72) return 'A'
  if (n >= 55) return 'B'
  if (n >= 40) return 'C'
  if (n >= 25) return 'D'
  return 'F'
}

function isoDate(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function cleanText(value = '') {
  return cleanGameText(plainCopyText(String(value || '')))
    .replace(/\bHevy yok\b/gi, '')
    .replace(/\bSon Hevy\b/gi, 'Son seans')
    .replace(/\bApple Health\b/gi, 'sağlık')
    .replace(/\bcanli veri\b/gi, 'güncel kayıt')
    .replace(/\bveri\b/gi, 'kayıt')
    .replace(/\bevidence\b/gi, 'not')
    .replace(/\bconfidence\b/gi, 'netlik')
    .replace(/\bsource\b/gi, 'kayıt')
    .replace(/\bendpoint\b/gi, 'not')
    .replace(/\bschema\b/gi, 'not')
    .replace(/\bmigration\b/gi, 'not')
    .replace(/\bapi\b/gi, 'not')
    .replace(/\bjson\b/gi, 'not')
    .replace(/\bpayload\b/gi, 'not')
    .replace(/\bcache\b/gi, 'not')
    .replace(/\bfallback\b/gi, 'not')
    .replace(/\btelemetry\b/gi, 'not')
    .replace(/\bkanıt\w*/gi, 'not')
    .replace(/\bkanit\w*/gi, 'not')
    .replace(/\bgüven\w*/gi, 'netlik')
    .replace(/\bguven\w*/gi, 'netlik')
    .replace(/\bkaynak\w*/gi, 'kayıt')
    .replace(/\bIlk\b/g, 'İlk')
    .replace(/\bkayitta\b/gi, 'kayıtta')
    .replace(/\bkayit\b/gi, 'kayıt')
    .replace(/\bkayitlar\b/gi, 'kayıtlar')
    .replace(/\bkaydi\b/gi, 'kaydı')
    .replace(/\bbugun\b/gi, 'bugün')
    .replace(/\bbugunu\b/gi, 'bugünü')
    .replace(/\bgore\b/gi, 'göre')
    .replace(/\bgorev\b/gi, 'görev')
    .replace(/\bbolge\b/gi, 'bölge')
    .replace(/\bsaglik\b/gi, 'sağlık')
    .replace(/\bdusuk\b/gi, 'düşük')
    .replace(/\bagir\b/gi, 'ağır')
    .replace(/\bkalkanini\b/gi, 'kalkanını')
    .replace(/\bkovalamiyoruz\b/gi, 'kovalamıyoruz')
    .replace(/\bnabiz\b/gi, 'nabız')
    .replace(/\byuk\b/gi, 'yük')
    .replace(/\bsure\b/gi, 'süre')
    .replace(/\bsimdi\b/gi, 'şimdi')
    .replace(/\bgelisim\b/gi, 'gelişim')
    .replace(/\bgun\b/gi, 'gün')
    .replace(/\bhafiza\b/gi, 'hafıza')
    .replace(/\bkapali\b/gi, 'kapalı')
    .replace(/\bkapisi\b/gi, 'kapısı')
    .replace(/\bnetlesir\b/gi, 'netleşir')
    .replace(/\bparca\b/gi, 'parça')
    .replace(/\bodul\b/gi, 'ödül')
    .replace(/\s+/g, ' ')
    .trim()
}

function shortCommand(value = '', limit = 132) {
  const text = cleanText(value)
  if (text.length <= limit) return text
  const cut = text.slice(0, limit)
  const boundary = Math.max(cut.lastIndexOf('.'), cut.lastIndexOf(';'), cut.lastIndexOf(','))
  const safe = boundary > 64 ? cut.slice(0, boundary) : cut
  return `${safe.trim()}...`
}

function visibleWarnings(items = []) {
  return (items || [])
    .map(item => cleanText(item))
    .filter(Boolean)
    .filter(item => !/hevy yok|eslemeyi kontrol|kayitlarda hevy|kaynak|endpoint|schema|migration|confidence|evidence|source|kanit|kanıt|guven|güven/i.test(item))
}

function formatNumber(value = 0) {
  return Math.round(Number(value) || 0).toLocaleString('tr-TR')
}

function clamp(value, min = 0, max = 100) {
  const n = Number(value)
  if (!Number.isFinite(n)) return min
  return Math.max(min, Math.min(max, n))
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
