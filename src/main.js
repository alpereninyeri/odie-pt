import './styles/cozy-reforge.css'
import { store } from './data/store.js'
import { buildBodyMapState } from './data/body-map-engine.js'
import { BODY_REGION_OPTIONS } from './data/body-events.js'
import { buildNextSessionRecommendation } from './data/next-session-engine.js'
import { buildSemanticProfile } from './data/semantic-profile.js'
import { initTelegramMiniApp } from './data/telegram-webapp.js'
import { getLocalDateString, normalizeDateString } from './data/rules.js'
import { plainCopyText } from './data/ui-copy.js'
import mapLayer from './assets/game/cozy-v3/map-layer.jpg'
import cabinRoom from './assets/game/cozy-v3/cabin-room.jpg'
import avatarAthlete from './assets/game/cozy-v3/avatar-athlete.png'
import odieStamp from './assets/game/cozy-v3/odie-stamp.jpg'
import rewardXp from './assets/game/cozy-v3/reward-xp.jpg'
import rewardGift from './assets/game/cozy-v3/reward-gift.jpg'
import routeMarker from './assets/game/cozy-v3/route-marker.jpg'
import statStr from './assets/game/cozy-v3/stat-str.jpg'
import statAgi from './assets/game/cozy-v3/stat-agi.jpg'
import statEnd from './assets/game/cozy-v3/stat-end.jpg'
import statDex from './assets/game/cozy-v3/stat-dex.jpg'
import statCon from './assets/game/cozy-v3/stat-con.jpg'
import statSta from './assets/game/cozy-v3/stat-sta.jpg'

const TABS = [
  { key: 'route', label: 'HUD', icon: '\u{1F3AF}' },
  { key: 'map', label: 'Harita', icon: '\u{1F9ED}' },
  { key: 'log', label: 'Defter', icon: '\u{1F4D3}' },
  { key: 'signal', label: 'ODIE', icon: '\u{1F436}' },
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

const STAT_AXES = [
  { key: 'str', short: 'KUV', icon: statStr },
  { key: 'agi', short: 'CEV', icon: statAgi },
  { key: 'end', short: 'DAY', icon: statEnd },
  { key: 'dex', short: 'BEC', icon: statDex },
  { key: 'con', short: 'GÖV', icon: statCon },
  { key: 'sta', short: 'STM', icon: statSta },
]

const ASSETS = {
  mapLayer,
  cabinRoom,
  avatarAthlete,
  odieStamp,
  rewardXp,
  rewardGift,
  routeMarker,
}

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
let askState = {
  items: null,
  loading: false,
  submitting: false,
  error: '',
  result: null,
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
  if (TABS.some(tab => tab.key === requested)) return requested
  try {
    const stored = localStorage.getItem('odiept-tab')
    if (TABS.some(tab => tab.key === stored)) return stored
  } catch {}
  return 'route'
}

function bindGlobalEvents() {
  document.addEventListener('click', handleClick)
  document.addEventListener('submit', handleSubmit)
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
  const progressSnapshot = buildProgressSnapshot(workouts, stats)

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
    sources: buildSources(sourceHealth, workouts, dailyLogs, healthSummary),
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

function buildSources(sourceHealth = {}, workouts = [], dailyLogs = [], healthSummary = null) {
  const latest = workouts[0]
  const recent = workouts.slice(0, 14)
  const movementDays = new Set(recent.map(workout => normalizeDateString(workout.date)).filter(Boolean)).size
  const recoveryLit = Boolean(healthSummary || dailyLogs.some(log => Number(log.sleepHours) || Number(log.waterMl) || Number(log.steps)))
  return [
    { key: 'trail', label: 'Rota', lit: workouts.length > 0, detail: latest?.date || 'ilk kayit' },
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
      label: useVolume ? 'Yuk' : 'Sure',
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
    { key: 'walk', name: 'Yuruyus yolu', emoji: '\u{1F6B6}', count: count(isWalkSession), detail: 'dusuk nabiz rota', tone: 'green' },
    { key: 'recovery', name: 'Dinlenme evi', emoji: '\u{1F9D8}', count: count(isRecoverySession), detail: quest.safeMode ? 'risk kapisi acik' : 'bakim hatti', tone: 'blue' },
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
        <button class="cozy-brand" type="button" data-tab="route" aria-label="HUD ekranina don">
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
    </div>
  `
}

function activeTabLabel() {
  return TABS.find(tab => tab.key === activeTab)?.label || 'HUD'
}

function renderActiveScreen(model) {
  switch (activeTab) {
    case 'map': return renderMapScreen(model)
    case 'log': return renderLogScreen(model)
    case 'signal': return renderSignalScreen(model)
    case 'route':
    default: return renderMissionRouteScreen(model)
  }
}

function renderNavItem(tab) {
  const active = activeTab === tab.key
  return `
    <button type="button" class="nav-item ${active ? 'active' : ''}" data-tab="${escapeAttr(tab.key)}" aria-current="${active ? 'page' : 'false'}">
      <span class="n-ico" aria-hidden="true">${tab.icon}</span>
      <span class="n-label">${escapeHtml(tab.label)}</span>
    </button>
  `
}

function renderPip(source = {}) {
  return `
    <button type="button" class="pip ${source.lit ? 'lit' : ''}" ${detailAttrs(source.label, source.detail || 'Yeni kayit bekliyor.')}>
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
        <p>${escapeHtml(cleanText(detailSheet.body || 'Bu parca yeni kayitlarla netlesir.'))}</p>
      </section>
    </div>
  `
}

/* ============================================================
   ROUTE / KOY
   ============================================================ */
function renderMissionRouteScreen(model) {
  const next = model.nextSession
  const goal = next.primaryGoal || {}
  const quest = model.bodyMap.dailyQuest || {}
  const xpPreview = model.bodyMap.xpPreview || {}
  const profile = model.profile || {}
  const questTitle = cleanText(quest.name || quest.title || goal.title || 'Bugunun ana hamlesi')
  const questBody = cleanText(quest.desc || goal.subtitle || next.coachCommand || 'Tek temiz adim bugunu kazandirir.')
  const command = shortCommand(next.coachCommand || questBody, 112)
  const levelLine = `LVL ${profile.level || 1} - ${formatNumber(profile.xp?.current || 0)} XP`

  return `
    <section class="screen route-screen">
      <div class="route-grid">
        <div class="col-a">
          <div class="mission-hud">
            <img class="hero-bg" src="${ASSETS.mapLayer}" alt="" aria-hidden="true">
            <div class="mission-top">
              <span class="kick">${escapeHtml(timeGreeting())} · ${escapeHtml(next.date || getLocalDateString())}</span>
              <span class="mission-tone">${escapeHtml(levelLine)}</span>
            </div>
            <div class="mission-body">
              <div class="mission-copy">
                <h1>Mission HUD</h1>
                <p>${escapeHtml(command)}</p>
              </div>
              <button type="button" class="mission-avatar" ${detailAttrs(model.profile.nick || 'Profil', `LVL ${model.profile.level || 1}. Seri ${model.profile.streak?.current || 0} gun. XP ${formatNumber(model.profile.xp?.current || 0)} / ${formatNumber(model.profile.xp?.max || 0)}.`)}>
                <img src="${ASSETS.avatarAthlete}" alt="" aria-hidden="true">
              </button>
            </div>
            ${renderMissionQuest(questTitle, questBody, quest, xpPreview, model)}
            ${renderEnergyStrip(model.system.readiness)}
            ${renderStatBelt(model.stats)}
          </div>

          ${renderProgressCard(model.progressSnapshot, 'mobile-progress')}
          ${renderCharCard(model)}
          ${renderQuestBoard(model.profile.quests)}
        </div>

        <div class="col-b">
          ${renderProgressCard(model.progressSnapshot, 'desktop-progress')}
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

function renderMissionQuest(title, body, quest = {}, xpPreview = {}, model = {}) {
  const rewardParts = [
    quest.reward || (quest.xpReward ? `+${quest.xpReward} XP` : ''),
    xpPreview.total ? `+${xpPreview.total} XP potansiyel` : '',
    quest.linkedUnlock ? `${quest.linkedUnlock} yaklasir` : '',
  ].filter(Boolean).slice(0, 3)
  const statImpact = quest.linkedRegion || model.bodyMap?.priority?.region?.label || 'ana hat'
  return `
    <article class="mission-quest">
      <div class="quest-top">
        <span class="quest-scroll" aria-hidden="true"><img src="${ASSETS.routeMarker}" alt=""></span>
        <div>
          <div class="q-kick">Siradaki hamle</div>
          <h2>${escapeHtml(title)}</h2>
        </div>
      </div>
      <p class="q-body">${escapeHtml(shortCommand(body, 118))}</p>
      <div class="reward-strip">
        ${rewardParts.length ? rewardParts.map(part => `<span>${escapeHtml(cleanText(part))}</span>`).join('') : '<span>XP ritmi acilir</span>'}
        <span>${escapeHtml(cleanText(statImpact))}</span>
      </div>
      <div class="quest-row">
        <button class="btn-primary" type="button" data-tab="log">Deftere yaz</button>
        <button class="btn-ghost" type="button" ${detailAttrs(title, `${body} ${xpPreview.text || ''}`)}>Detay</button>
      </div>
    </article>
  `
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
            <img class="hero-bg" src="${ASSETS.mapLayer}" alt="" aria-hidden="true">
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
              <button class="btn-primary" type="button" data-tab="log">Deftere yaz</button>
            </div>
          </div>

          ${renderQuestBoard(model.profile.quests)}
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
        <button type="button" class="stat-stone" ${detailAttrs(`${axis.short} ${axis.rank}`, `Skor ${Math.round(axis.value)}. Bu stat son kayitlara gore hareket eder.`)}>
          <img src="${axis.icon}" alt="" aria-hidden="true">
          <span>${escapeHtml(axis.short)}</span>
          <b>${escapeHtml(axis.rank)}</b>
        </button>
      `).join('')}
    </article>
  `
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
    <button type="button" class="quest-item ${quest.done ? 'is-done' : ''}" ${detailAttrs(quest.name || 'Gorev', `${quest.desc || ''} ${quest.reward || ''}`)}>
      <span class="qi-icon" aria-hidden="true">${quest.icon || '\u{1F3AF}'}</span>
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
            <span class="b-icon" aria-hidden="true"><img src="${a.unlocked ? ASSETS.rewardXp : ASSETS.rewardGift}" alt=""></span>
            <span class="b-name">${escapeHtml(cleanText(a.name || ''))}</span>
            <span class="b-sub">${escapeHtml(cleanText(a.unlocked ? (a.date || 'açık') : (a.req || 'kilitli')))}</span>
          </button>
        `).join('')}
      </div>
    </article>
  `
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
          <span class="lvl-badge">LVL ${escapeHtml(String(p.level || 1))}</span>
        </div>
        <div class="xp-track"><span class="xp-fill" style="--xp:${xpPct}%"></span></div>
        <div class="xp-label">
          <span>${escapeHtml(formatNumber(xp.current || 0))} / ${escapeHtml(formatNumber(xp.max || 0))} XP</span>
          <span class="streak-fire"><span class="flame" aria-hidden="true">\u{1F525}</span><b>${escapeHtml(String(streak.current || 0))}</b><small>gün seri</small></span>
        </div>
      </div>
    </div>
  `
}

function renderEnergyStrip(ready = {}) {
  return `
    <section class="energy-strip" aria-label="Bugünün enerjisi">
      ${energyCell('ready', '\u{1F33F}', 'Enerji', ready.score)}
      ${energyCell('armor', '\u{1F6E1}️', 'Dayanıklılık', ready.armor)}
      ${energyCell('load', '\u{1F4A6}', 'Yorgunluk', ready.fatigue)}
    </section>
  `
}

function energyCell(kind, icon, name, value) {
  const v = clamp(Number(value), 0, 100)
  const display = Number.isFinite(Number(value)) ? Math.round(v) : '--'
  return `
    <button type="button" class="energy-cell is-${escapeAttr(kind)}" ${detailAttrs(name, `${display}/100`)}>
      <div class="e-top"><span class="e-ico" aria-hidden="true">${icon}</span><span class="e-name">${escapeHtml(name)}</span></div>
      <b>${escapeHtml(String(display))}</b>
      <div class="energy-bar"><i style="--v:${v}%"></i></div>
    </button>
  `
}

function renderLastCard(latest) {
  return `
    <article class="card last-card">
      <div class="card-head">
        <span class="card-title">Son kayit</span>
        <button type="button" class="card-tag" data-refresh>${syncBusy ? 'Çekiliyor' : 'Yenile'}</button>
      </div>
      ${latest ? `
        <div class="l-type">${escapeHtml(displayWorkoutType(latest.type || 'Seans'))}</div>
        <p class="soft">${escapeHtml(cleanText(latest.highlight || latest.notes || 'Son kayit defterde.'))}</p>
        <div class="meta-row">
          <span>${escapeHtml(latest.date || '-')}</span>
          <span>${latest.durationMin ? `${Math.round(latest.durationMin)} dk` : 'süre yok'}</span>
          ${latest.volumeKg ? `<span>${escapeHtml(formatNumber(latest.volumeKg))} kg</span>` : ''}
        </div>
      ` : `
        <div class="l-type">Ilk kayit bekliyor</div>
        <p class="soft">Ilk kaydi deftere yaz, HUD canlansin.</p>
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
        <h1>${escapeHtml(cleanText(priority.region?.label || 'Vucut haritasi'))}</h1>
        <p>${escapeHtml(cleanText(quest.desc || priority.movement?.todayStep || 'Bugünün baskı noktası burada.'))}</p>
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
            <span class="pr-icon" aria-hidden="true">${pr.icon || '\u{1F3C6}'}</span>
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
            <span class="sn-dot" aria-hidden="true">${item.status === 'done' ? '✓' : item.status === 'prog' ? '◐' : '\u{1F512}'}</span>
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
    <button type="button" class="muscle-card" ${detailAttrs(muscle.name || 'Bolge', muscle.tip || muscle.detail || '')}>
      <div class="mc-top">
        <span class="mc-icon" aria-hidden="true">${muscle.icon || '\u{1F4AA}'}</span>
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
          <div class="debuff-row lv-${escapeAttr(d.level || 'blu')}">
            <span class="d-icon" aria-hidden="true">${d.icon || '\u{1F535}'}</span>
            <div>
              <b>${escapeHtml(cleanText(d.name || ''))}</b>
              <p>${escapeHtml(cleanText(d.desc || ''))}</p>
            </div>
          </div>
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
        <span class="card-title">Karakter statlari</span>
        <span class="card-tag">RPG</span>
      </div>
      ${statRadar(axes)}
      <div class="stat-legend">
        ${axes.map(a => `
          <div class="stat-chip">
            <img src="${a.icon}" alt="" aria-hidden="true">
            <span class="s-name">${escapeHtml(a.short)}</span>
            <b>${escapeHtml(a.rank)}</b>
            <span class="s-rank">${Math.round(a.value)}</span>
          </div>
        `).join('')}
      </div>
    </article>
  `
}

function renderZoneTile(zone = {}) {
  return `
    <button type="button" class="zone-tile t-${escapeAttr(zone.tone)}" style="--heat:${zone.heat}%" ${detailAttrs(zone.name, zone.detail)}>
      <span class="z-emoji" aria-hidden="true">${zone.emoji}</span>
      <span class="z-name">${escapeHtml(zone.name)}</span>
      <p class="z-detail">${escapeHtml(cleanText(zone.detail))}</p>
      <span class="z-count">${zone.count}</span>
    </button>
  `
}

function renderRegionRow(region = {}) {
  const risk = clamp(region.risk, 0, 100)
  return `
    <div class="bar-row">
      <span class="r-name">${escapeHtml(cleanText(region.label || region.id || 'Bölge'))}</span>
      <b>${Math.round(risk)}</b>
      <span class="track"><i style="--v:${risk}%"></i></span>
    </div>
  `
}

function renderMoveRow(line = {}) {
  const progress = clamp(line.progress ?? line.score, 0, 100)
  return `
    <div class="bar-row is-move">
      <span class="r-name">${escapeHtml(cleanText(line.label || line.id || 'Hat'))}</span>
      <b>${Math.round(progress)}%</b>
      <span class="track"><i style="--v:${progress}%"></i></span>
      <small>${escapeHtml(cleanText(line.todayStep || 'mini blok'))}</small>
    </div>
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
          <label class="field"><span>Sure dk</span><input name="durationMin" type="number" min="1" max="720" value="${escapeAttr(preset.durationMin)}" required></label>
          <label class="field"><span>Mesafe km</span><input name="distanceKm" type="number" min="0" step="0.1" value="${escapeAttr(preset.distanceKm)}"></label>
          <label class="field"><span>Yukselti m</span><input name="elevationM" type="number" min="0" step="1" value="0"></label>
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
        <button class="btn-primary full" type="submit" ${routeSubmitBusy ? 'disabled' : ''}>${routeSubmitBusy ? 'Kayit isleniyor' : 'Kaydi tamamla'}</button>
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
          <button class="btn-ghost full" type="submit" ${bodySubmitBusy ? 'disabled' : ''}>${bodySubmitBusy ? 'Ekleniyor' : 'Vucut notu ekle'}</button>
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
  const command = cleanText(model.nextSession.coachCommand || 'Yeni kayit geldikce bugunun rotasi netlesir.')

  return `
    <section class="screen signal-screen">
      <div class="odie-hero">
        <img class="odie-room-bg" src="${ASSETS.cabinRoom}" alt="" aria-hidden="true">
        <div class="odie-face" aria-hidden="true"><img src="${ASSETS.odieStamp}" alt=""></div>
        <div>
          <div class="o-kick">ODIE komut odasi</div>
          <p>${escapeHtml(command)}</p>
        </div>
      </div>

      ${signalNotice ? `<div class="notice"><span>${escapeHtml(signalNotice)}</span><button type="button" data-clear-signal>Tamam</button></div>` : ''}

      <div class="split-2">
        <article class="card">
          <div class="card-head">
            <span class="card-title">Bugunun ozeti</span>
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

        <article class="card">
          <div class="card-head">
            <span class="card-title">ODIE'ye sor</span>
            <span class="card-tag">${askState.loading ? 'yukleniyor' : 'sohbet'}</span>
          </div>
          <form id="ask-form" class="ask-form">
            <textarea name="question" rows="4" placeholder="Bugun neyi abartmayalim?"></textarea>
            <button class="btn-primary full" type="submit" ${askState.submitting ? 'disabled' : ''}>${askState.submitting ? 'ODIE dusunuyor' : 'ODIE’ye sor'}</button>
          </form>
          ${askState.error ? `<p class="warn-line">${escapeHtml(askState.error)}</p>` : ''}
          ${result ? renderAskResult(result) : renderAskHistory()}
        </article>
      </div>
    </section>
  `
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
  const observation = cleanText(note.xpNote || lines[0] || model.latestWorkout?.highlight || 'Yeni kayit bekleniyor.')
  const reason = cleanText(lines[1] || model.nextSession.primaryGoal?.subtitle || 'Bugunku secim son ritme gore ayarlanir.')
  const action = cleanText(command || lines[2] || 'Tek temiz hamle yeter.')
  return `
    <div class="odie-brief">
      <div><span>Gozlem</span><p>${escapeHtml(shortCommand(observation, 110))}</p></div>
      <div><span>Sebep</span><p>${escapeHtml(shortCommand(reason, 110))}</p></div>
      <div><span>Komut</span><p>${escapeHtml(shortCommand(action, 110))}</p></div>
      ${lines.length > 3 ? `<button type="button" class="btn-ghost full" ${detailAttrs('ODIE detayi', lines.join(' '))}>Tam notu ac</button>` : ''}
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
  if (askState.loading) return '<p class="loading-line">Gecmis sohbetler cekiliyor.</p>'
  const items = askState.items || []
  if (!items.length) return '<p class="loading-line">Henuz soru yok. Ilk sohbeti burada baslat.</p>'
  return `
    <div class="ask-history">
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
  const warnings = visibleWarnings(next.warnings || [])
  const caps = visibleWarnings(next.progressionCaps || [])
  if (!warnings.length && !caps.length) return ''
  return `
    <section class="warn-stack">
      ${warnings.slice(0, 3).map(item => `<p class="warn-line">${escapeHtml(item)}</p>`).join('')}
      ${caps.slice(0, 2).map(item => `<p class="cap-line">${escapeHtml(item)}</p>`).join('')}
    </section>
  `
}

/* ============================================================
   INFOGRAPHICS (pure SVG)
   ============================================================ */
function renderProgressCard(snapshot = {}, extraClass = '') {
  const classes = `card progress-card ${extraClass}`.trim()
  if (snapshot.empty) {
    return `
      <article class="${escapeAttr(classes)}">
        <div class="card-head">
          <span class="card-title">Gelisim pano</span>
          <span class="card-tag">eski -> simdi</span>
        </div>
        <p class="soft">Ilk seans gelsin, burasi baslangic ve simdi halini yan yana cizecek.</p>
      </article>
    `
  }

  const lead = snapshot.metrics?.[0] || {}
  const oldLabel = formatMetricValue(lead.oldValue, lead.unit)
  const nowLabel = formatMetricValue(lead.nowValue, lead.unit)
  return `
    <article class="${escapeAttr(classes)}">
      <div class="card-head">
        <span class="card-title">Gelisim pano</span>
        <span class="card-tag">eski -> simdi</span>
      </div>
      <div class="era-compare">
        <button type="button" class="era-tile is-old" ${detailAttrs(`Ilk ${snapshot.windowSize} seans`, `Baslangic penceresi: ${oldLabel}. Toplam ${snapshot.oldSummary.sessions} seans.`)}>
          <span>Ilk ${escapeHtml(String(snapshot.windowSize))}</span>
          <b>${escapeHtml(oldLabel)}</b>
          <small>baslangic</small>
        </button>
        <div class="era-arrow" aria-hidden="true">-></div>
        <button type="button" class="era-tile is-now" ${detailAttrs(`Son ${snapshot.windowSize} seans`, `Simdi penceresi: ${nowLabel}. Toplam ${snapshot.nowSummary.sessions} seans.`)}>
          <span>Son ${escapeHtml(String(snapshot.windowSize))}</span>
          <b>${escapeHtml(nowLabel)}</b>
          <small>simdi</small>
        </button>
      </div>
      ${progressTrendSvg(snapshot.trend, lead.unit)}
      <div class="progress-lanes">
        ${(snapshot.metrics || []).map(renderProgressLane).join('')}
      </div>
      ${renderStatSparkline(snapshot.statLeaders)}
    </article>
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
      <span class="pl-foot"><small>eski</small><small>simdi</small></span>
    </button>
  `
}

function renderStatSparkline(stats = []) {
  if (!stats.length) return ''
  return `
    <div class="stat-sparks" aria-label="En guclu statlar">
      ${stats.map(stat => `
        <button type="button" class="stat-spark" ${detailAttrs(`${stat.label} ${stat.rank}`, `Skor ${Math.round(stat.value)}. Simdiki karakter gucu.`)}>
          <span>${escapeHtml(stat.label)}</span>
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
    <svg class="progress-sparkline" viewBox="0 0 ${W} ${H}" role="img" aria-label="Eski seanslardan simdiye ${unit || 'yuk'} trendi">
      <polygon points="${area}" fill="var(--leaf)" opacity="0.72"/>
      <polyline points="${line}" fill="none" stroke="var(--moss)" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="${first[0].toFixed(1)}" cy="${first[1].toFixed(1)}" r="5" fill="var(--clay)"/>
      <circle cx="${last[0].toFixed(1)}" cy="${last[1].toFixed(1)}" r="6" fill="var(--moss)"/>
      <text x="${padX}" y="${H - 2}" font-size="10" fill="var(--clay)">eski</text>
      <text x="${W - padX}" y="${H - 2}" font-size="10" fill="var(--moss)" text-anchor="end">simdi</text>
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
    return '<p class="soft">Henuz seans yok. Ilk kaydi gir, grafik buyumeye baslasin.</p>'
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
  if (tabButton) { setActiveTab(tabButton.dataset.tab); return }

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
    logNotice = 'Sure olmadan kayit kapanmaz.'
    scheduleRender()
    return
  }

  if (isStrengthSession(session) && (!session.exercises.length || !session.sets || !session.volumeKg)) {
    logNotice = 'Gym kaydi icin en az bir egzersiz, set, tekrar ve kg gir.'
    scheduleRender()
    return
  }

  try {
    routeSubmitBusy = true
    if (submit) submit.disabled = true
    const workout = await store.addWorkout(session)
    logNotice = `${displayWorkoutType(session.type)} deftere girdi. +${workout?.xpEarned || 0} XP${workout?.syncStatus === 'local' ? ' · cihazda tutuldu' : ''}`
    setActiveTab('route')
  } catch (error) {
    console.error('[odiept] route log failed:', error)
    logNotice = `Kayit takildi: ${error?.message || error}`
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
    logNotice = 'Gunluk durum guncellendi.'
  } catch (error) {
    logNotice = `Gunluk cihazda kaldi: ${error?.message || error}`
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
    logNotice = 'Bu bolge zaten haritada aktif. Once eskisini kapat.'
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
    logNotice = 'Vucut notu haritaya eklendi.'
    setActiveTab('map')
  } catch (error) {
    console.error('[odiept] body gate failed:', error)
    logNotice = `Vucut notu takildi: ${error?.message || error}`
  }
  bodySubmitBusy = false
  scheduleRender()
}

async function saveFeedback(type) {
  const feedbackType = type === 'tone_good' ? 'prefer' : type
  try {
    await store.addMemoryFeedback({ feedbackType, note: `ODIE feedback: ${feedbackType}` })
    signalNotice = 'Geri bildirim hafizaya gitti.'
  } catch (error) {
    signalNotice = `Geri bildirim takildi: ${error?.message || error}`
  }
  scheduleRender()
}

async function syncNow() {
  if (syncBusy) return
  syncBusy = true
  scheduleRender()
  try {
    await store.syncFromSupabase()
    logNotice = 'Defter yenilendi.'
  } catch (error) {
    logNotice = `Yenileme takildi: ${error?.message || error}`
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
    const data = await response.json()
    if (!response.ok || !data.ok) throw new Error(data.error || 'Sohbet gecmisi alinamadi')
    askState.items = data.items || []
  } catch (error) {
    askState.items = []
    askState.error = error?.message || 'Sohbet gecmisi alinamadi'
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
      headers: appHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ question }),
    })
    const data = await response.json()
    if (!response.ok || !data.ok) throw new Error(data.error || 'ODIE cevabi donmedi')
    askState.result = data.item
    askState.items = [data.item, ...(askState.items || [])]
    form.reset()
  } catch (error) {
    askState.error = error?.message || 'ODIE cevabi takildi'
  } finally {
    askState.submitting = false
    scheduleRender()
  }
}

/* ============================================================
   HELPERS
   ============================================================ */
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

function displayWorkoutType(type = '') {
  const map = {
    Yuruyus: 'Yuruyus', 'Yürüyüş': 'Yuruyus', Kosu: 'Kosu', Bacak: 'Bacak',
    Akrobasi: 'Acro', Tirmanis: 'Tirmanis', Stretching: 'Recovery',
  }
  return map[type] || type || 'Seans'
}

function toneLabel(tone = '') {
  return { danger: 'Riskli', warn: 'Dikkat', go: 'Hazir', calm: 'Sakin plan', fire: 'Tempo' }[tone] || 'Plan'
}

function timeGreeting() {
  const h = new Date().getHours()
  if (h < 6) return 'Iyi geceler'
  if (h < 12) return 'Gunaydin'
  if (h < 18) return 'Iyi gunler'
  return 'Iyi aksamlar'
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
  return plainCopyText(String(value || ''))
    .replace(/\bHevy yok\b/gi, '')
    .replace(/\bSon Hevy\b/gi, 'Son seans')
    .replace(/\bApple Health\b/gi, 'saglik')
    .replace(/\bcanli veri\b/gi, 'guncel kayit')
    .replace(/\bveri\b/gi, 'kayit')
    .replace(/\bevidence\b/gi, 'not')
    .replace(/\bconfidence\b/gi, 'netlik')
    .replace(/\bsource\b/gi, 'kayit')
    .replace(/\bendpoint\b/gi, 'adres')
    .replace(/\bschema\b/gi, 'kurulum')
    .replace(/\bmigration\b/gi, 'kurulum')
    .replace(/\bkanıt\w*/gi, 'not')
    .replace(/\bkanit\w*/gi, 'not')
    .replace(/\bgüven\w*/gi, 'netlik')
    .replace(/\bguven\w*/gi, 'netlik')
    .replace(/\bkaynak\w*/gi, 'kayit')
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
