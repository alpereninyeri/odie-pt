import './styles/odie-ui.css'
import './styles/cozy-rpg/mobile.css'
import { store } from './data/store.js'
import { buildBodyMapState } from './data/body-map-engine.js'
import { BODY_REGION_OPTIONS } from './data/body-events.js'
import { buildNextSessionRecommendation } from './data/next-session-engine.js'
import { buildOdiePresence } from './data/odie-presence.js'
import { computeProfileStatsSnapshotDaysAgo, formatMonthShort, getLocalDateString, normalizeDateString } from './data/rules.js'
import { buildSemanticProfile } from './data/semantic-profile.js'
import { renderDailyChecklist, initDailyChecklist } from './components/daily-checklist.js'
import { renderHeatmap } from './components/heatmap-calendar.js'
import { initModal, closeModal, openModal, openAvatarModal, openArchetypeModal, openFocusModal, openStatModal, openStatCalibrationModal, openUnlockModal } from './components/modal.js'
import { injectToastStyles, showToast } from './components/toast.js'
import { initTelegramMiniApp } from './data/telegram-webapp.js'
import { goalTitle, riskToneLabel, sourceLabel, uiLabel } from './data/ui-copy.js'

const tabs = [
  { key: 'today', label: 'Bugun', icon: 'home' },
  { key: 'character', label: 'Karakter', icon: 'char' },
  { key: 'quests', label: 'Pano', icon: 'quest' },
  { key: 'odie', label: 'ODIE', icon: 'pulse' },
]

const requestedTab = new URLSearchParams(window.location.search).get('tab')
let activeTab = tabs.some(tab => tab.key === requestedTab) ? requestedTab : 'today'
let odieMode = 'coach'
let activeSkillBranch = 0
let activeQuestTab = 'daily'
let _renderQueued = false
let _lastAppMarkup = ''
let _workoutFormModule = null
let _odiePanelModules = null
let _odiePanelModulesPromise = null
let _semanticCache = {
  workouts: null,
  dailyLogs: null,
  value: null,
}

injectToastStyles()
initTheme()
initTelegramMiniApp()

async function openWorkoutFormLazy(options) {
  if (!_workoutFormModule) {
    _workoutFormModule = import('./components/workout-form.js')
  }
  const mod = await _workoutFormModule
  return mod.openWorkoutForm(options)
}

function ensureOdiePanelsLoaded() {
  if (_odiePanelModules) return _odiePanelModules
  if (!_odiePanelModulesPromise) {
    _odiePanelModulesPromise = Promise.all([
      import('./components/panel-coach.js'),
      import('./components/panel-ask.js'),
    ]).then(([coach, ask]) => {
      _odiePanelModules = { ...coach, ...ask }
      if (activeTab === 'odie') scheduleRender({ immediate: true })
      return _odiePanelModules
    }).catch(error => {
      _odiePanelModulesPromise = null
      console.error('[odie-panel] load error:', error)
      showToast({ icon: '!', title: 'ODIE odasi acilmadi', msg: 'Panel yuklenirken takildi.', rarity: 'common' })
      return null
    })
  }
  return null
}

store.init().then(() => {
  renderApp()
  window.setInterval(() => store.refreshRecovery(), 5 * 60 * 1000)

  store.subscribe('*', () => {
    scheduleRender()
  })

  store.subscribe('_classChanged', classObj => {
    if (!classObj?.id) return
    showToast({
      icon: classObj.icon,
      title: `SINIF DEGISTI: ${classObj.name}`,
      msg: classObj.buff || classObj.desc,
      rarity: 'epic',
      duration: 4200,
    })
  })

  store.subscribe('_coachUpdated', coachNote => {
    if (!coachNote) return
    showToast({
      icon: 'OD',
      title: 'ODIE yorumu geldi',
      msg: coachNote.xp_note || 'Yeni antrenman analizi hazir',
      rarity: 'rare',
      duration: 3200,
    })
  })
})

function initTheme() {
  document.documentElement.setAttribute('data-theme', 'dark')
  localStorage.setItem('odiept-theme', 'dark')
}

function getSemanticProfile(workouts = [], dailyLogs = []) {
  if (_semanticCache.workouts === workouts && _semanticCache.dailyLogs === dailyLogs && _semanticCache.value) {
    return _semanticCache.value
  }

  const value = buildSemanticProfile(workouts, dailyLogs)
  _semanticCache = { workouts, dailyLogs, value }
  return value
}

function scheduleRender({ immediate = false } = {}) {
  if (immediate) {
    _renderQueued = false
    renderApp()
    return
  }

  if (_renderQueued) return
  _renderQueued = true

  const flush = () => {
    _renderQueued = false
    renderApp()
  }

  if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
    window.requestAnimationFrame(flush)
    return
  }

  setTimeout(flush, 16)
}

function renderApp() {
  const state = store.getState()
  const profile = store.getProfile()
  const semantic = getSemanticProfile(state.workouts || [], state.dailyLogs || [])
  const ui = buildUiRuntime(state, profile, semantic)

  const appMarkup = `
    <div class="modal-bg" id="statModal">
      <div class="modal" id="modalContent"></div>
    </div>

    ${renderMobileHud(state, profile, semantic, ui)}

    <div class="app-shell app-shell-v6">
      <aside class="app-nav glass-card">
        <div class="nav-brand">
          <div class="nav-brand-mark">${avatarMark(profile)}</div>
          <div>
            <div class="nav-brand-title">OdiePT</div>
            <div class="nav-brand-sub">${renderExplainButton('class', state.profile.classObj?.name || profile.class || 'Karakter', 'explain-link nav-explain')}</div>
          </div>
        </div>

        <nav class="nav-list">
          ${tabs.map(tab => renderNavButton(tab, activeTab === tab.key)).join('')}
        </nav>

        <div class="nav-status glass-subtle">
          <div class="mini-label">${renderExplainButton('current-focus', uiLabel('focus'), 'explain-link metric-explain')}</div>
            <div class="nav-status-title">${state.profile.currentFocus || 'Hybrid denge'}</div>
          <div class="nav-status-sub">${Number(state.health?.readiness?.score) || '--'}/100 ${renderExplainButton('readiness', 'hazirlik', 'explain-link metric-explain')}</div>
        </div>
      </aside>

      <main class="app-main">
        <header class="topbar">
          <div>
            <div class="eyebrow">${tabs.find(tab => tab.key === activeTab)?.label || 'Bugun'}</div>
            <h1 class="page-title">${pageTitle(activeTab, profile)}</h1>
          </div>
          <div class="topbar-actions">
            <button class="avatar-chip" data-action="open-avatar" aria-label="Profili ac">
              <span class="avatar-chip-icon">${avatarMark(profile)}</span>
              <span>${profile.nick}</span>
            </button>
          </div>
        </header>

        <section class="page-content">
          ${renderPage(activeTab, state, profile, semantic, ui)}
        </section>
      </main>
    </div>

    <nav class="bottom-tabs glass-card">
      ${tabs.map(tab => renderNavButton(tab, activeTab === tab.key, true)).join('')}
    </nav>
  `

  if (appMarkup === _lastAppMarkup) return

  document.getElementById('app').innerHTML = appMarkup
  _lastAppMarkup = appMarkup
  initModal()
  initActivePage(activeTab, profile)
  window.__refreshActivePanel = () => scheduleRender({ immediate: true })
}

function buildUiRuntime(state, profile, semantic) {
  const bodyMapState = state.bodyMapState || buildBodyMapState({ state, profile, semantic })
  const nextSession = buildNextSessionRecommendation({
    profile: { ...state.profile, ...profile },
    workouts: state.workouts || [],
    dailyLogs: state.dailyLogs || [],
    memoryFeedback: state.memoryFeedback || [],
    health: state.health || {},
    bodyEvents: state.bodyEvents || [],
  })
  const activeQuest = bodyMapState?.dailyQuest || [...(profile.quests?.daily || []), ...(profile.quests?.weekly || [])].find(quest => !quest.done)
  const latestWorkout = (state.workouts || [])[0] || null
  return { activeQuest, bodyMapState, latestWorkout, nextSession }
}

function pageTitle(tabKey, profile) {
  switch (tabKey) {
    case 'today':
      return `${profile.nick} - Bugun`
    case 'character':
      return `${profile.nick} Karakter Defteri`
    case 'quests':
      return `${profile.nick} Kasaba Panosu`
    case 'odie':
      return odieMode === 'ask' ? "ODIE'ye Sor" : 'ODIE Defteri'
    default:
      return profile.nick
  }
}

function renderMobileHud(state, profile, semantic = {}, ui = buildUiRuntime(state, profile, semantic)) {
  const bodyMapState = ui.bodyMapState
  const nextSession = ui.nextSession
  const activeQuest = ui.activeQuest
  const presence = buildOdiePresence({ state, profile, nextSession, bodyMapState })
  const hunterLine = buildHunterOdieLine({
    state,
    nextSession,
    bodyMapState,
    decision: buildTodayDecision(state, activeQuest),
  })
  const xpCur = profile?.xp?.current ?? 0
  const xpMax = profile?.xp?.max || 1
  const pct = Math.max(0, Math.min(100, Math.round((xpCur / xpMax) * 100)))
  const level = profile.level ?? '-'
  const readiness = state.health?.readiness?.score
  const readinessScore = Number(readiness)
  const streak = state.profile?.streak?.current ?? 0
  const source = String(state.workouts?.[0]?.source || 'manual').toUpperCase()
  const hudSideValue = Number.isFinite(readinessScore) ? Math.round(readinessScore) : streak
  const hudSideKey = Number.isFinite(readinessScore) ? 'readiness' : 'seri'
  const hudSideLabel = Number.isFinite(readinessScore) ? 'hazir' : 'seri'
  const rank = aggregateRank(getFrontStats(state, profile))
  const statValue = key => {
    const stat = (profile.stats || []).find(item => item.key === key)
    return stat?.rank || Math.round(Number(stat?.val ?? state.profile?.stats?.[key]) || 0)
  }
  const hudStats = [
    { key: 'STR', val: statValue('str') },
    { key: 'AGI', val: statValue('agi') },
    { key: 'CON', val: statValue('con') },
  ]

  return `
    <div class="mobile-hud-wrap">
      <div class="mobile-hud mobile-hud-v6 hunter-global-card">
        <button class="mobile-hud-avatar mobile-hud-sigil" data-action="open-avatar" aria-label="Profili ac">${renderMiniSigil(profile)}</button>
        <div class="mobile-hud-center">
          <div class="mobile-hud-topline">
            <span>${renderExplainButton('class', state.profile.classObj?.name || profile.class || 'OdiePT', 'explain-link hud-explain')}</span>
            <span class="source-pill">${renderExplainButton(source === 'HEVY' ? 'hevy' : 'kaynak', source === 'HEVY' ? 'HEVY' : 'CANLI', 'explain-link source-explain')}</span>
          </div>
          <div class="mobile-hud-nick">${profile.nick}<span>L${level} / ${escapeHtml(rank)}</span></div>
          <div class="mobile-hud-xpbar"><div class="mobile-hud-xpfill" style="width:${pct}%"></div></div>
          <div class="mobile-hud-stats">
            ${hudStats.map(stat => `
              <span class="hud-stat-chip stat-tone-${stat.key.toLowerCase()}">
                <b>${stat.key}</b>
                <em>${stat.val}</em>
              </span>
            `).join('')}
          </div>
        </div>
        <div class="mobile-hud-side">
          <strong>${hudSideValue}</strong>
          <small>${renderExplainButton(hudSideKey, hudSideLabel, 'explain-link metric-explain')}</small>
        </div>
      </div>
      <div class="mobile-hud-voice tone-${escapeHtml(presence.tone || 'calm')}">
        <b>ODIE</b>
        <span>${escapeHtml(compactText(hunterLine || presence.hudLine || presence.routineLine || '', 92))}</span>
      </div>
    </div>
  `
}

function renderNavButton(tab, isActive, mobile = false) {
  return `
    <button class="${mobile ? 'bottom-tab' : 'nav-button'} ${isActive ? 'active' : ''}" data-tab="${tab.key}">
      <span class="nav-icon">${renderNavGlyph(tab.icon)}</span>
      <span>${tab.label}</span>
    </button>
  `
}

function renderNavGlyph(kind) {
  switch (kind) {
    case 'home':
      return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 11.5 12 5l8 6.5V20h-5.5v-4.8h-5V20H4z"/></svg>`
    case 'char':
      return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 4 7v6c0 4.4 3.1 7.7 8 9 4.9-1.3 8-4.6 8-9V7l-8-4z"/></svg>`
    case 'quest':
      return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v4M12 17v4M3 12h4M17 12h4"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>`
    case 'pulse':
      return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12h4l2-4 3 9 2-5h7"/></svg>`
    default:
      return kind
  }
}

function avatarMark(profile = {}) {
  const nick = String(profile.nick || 'OD')
  return escapeHtml(nick.replace(/[^a-z0-9]/gi, '').slice(0, 2).toUpperCase() || 'OD')
}

function renderPage(tabKey, state, profile, semantic, ui) {
  switch (tabKey) {
    case 'today':
      return renderTodayPage(state, profile, semantic, ui)
    case 'character':
      return renderCharacterPage(state, profile, semantic, ui)
    case 'quests':
      return renderQuestPage(state, profile, semantic, ui)
    case 'odie':
      return renderOdiePage(state, profile, semantic, ui)
    default:
      return ''
  }
}

/* ---------- Today (Bugun) page ---------- */

function readinessTitle(score) {
  if (!Number.isFinite(score)) return 'BASLANGIC'
  if (score >= 80) return 'AGIRLIK ACILIR'
  if (score >= 60) return 'SEANS HAZIR'
  if (score >= 40) return 'KONTROLLU GUN'
  return 'HAFIF GUN'
}

const KIND_TR_MAP = {
  strength: 'guc',
  locomotion: 'hareket',
  mobility: 'mobilite',
  recovery: 'toparlanma',
  skill: 'teknik',
  explosive: 'patlayici',
  conditioning: 'kondisyon',
  mixed: 'karma',
}

const WORKOUT_TYPE_LABELS = [
  ['Push', 'Itis'],
  ['Pull', 'Cekis'],
  ['Shoulder', 'Omuz'],
  ['Core', 'Govde'],
  ['Workout', 'Antrenman'],
  ['Recovery', 'Toparlanma'],
  ['Strength', 'Kuvvet'],
  ['Mobility', 'Mobilite'],
  ['Skill', 'Teknik'],
  ['Conditioning', 'Kondisyon'],
]

function localizeKindWords(text = '') {
  let out = String(text)
  for (const [en, tr] of Object.entries(KIND_TR_MAP)) {
    out = out.replace(new RegExp(`\\b${en}\\b`, 'gi'), tr)
  }
  return out
}

function displayWorkoutType(text = '') {
  let out = String(text || 'Seans')
  for (const [en, tr] of WORKOUT_TYPE_LABELS) {
    out = out.replace(new RegExp(`\\b${en}\\b`, 'gi'), tr)
  }
  return out
}

function cozyDisplayText(text = '') {
  return displayWorkoutType(text)
    .replace(/\btrunk control\b/gi, 'govde kontrolu')
    .replace(/\bbuild['’]?i\b/gi, 'rotasi')
    .replace(/\bbuild\w*\b/gi, 'rota')
    .replace(/\bglobal\b/gi, 'genel')
    .replace(/\bclass\b/gi, 'sinif')
    .replace(/\bcoach\b/gi, 'ODIE')
    .replace(/\bsource\b/gi, 'defter')
    .replace(/\bsignal\b/gi, 'iz')
    .replace(/\bblock\b/gi, 'blok')
    .replace(/\bdrill\b/gi, 'teknik parca')
}

function cozyConfidenceLabel(confidence = '') {
  const key = String(confidence || 'seed').toUpperCase()
  return ({ HIGH: 'NET', MEDIUM: 'ORTA', LOW: 'AZ', SEED: 'DEFTER' })[key] || displayWorkoutType(key)
}

function buildTodayLead(state, latestWorkout = null) {
  if (latestWorkout) {
    if (String(latestWorkout.source || '').toLowerCase() === 'apple_health') {
      const distance = Number(latestWorkout.distanceKm) ? `${Math.round(latestWorkout.distanceKm * 10) / 10} km` : `${latestWorkout.durationMin || 0} dakika`
      const terrain = (latestWorkout.tags || []).includes('terrain') ? 'arazi yuruyusu' : displayWorkoutType(latestWorkout.type || 'hareket')
      return `Apple Health ${distance} ${terrain} kaydini yazdi. ODIE bunu yorgunluk, XP ve bugunku hamleye dahil ediyor.`
    }
    const meta = [
      latestWorkout.durationMin ? `${latestWorkout.durationMin} dakika` : null,
      latestWorkout.volumeKg ? `${Math.round(latestWorkout.volumeKg).toLocaleString('tr-TR')} kg yuk` : null,
      latestWorkout.source === 'hevy' ? 'Hevy senkron' : null,
    ].filter(Boolean).join(' / ')
    return `${formatMonthShort(latestWorkout.date)} ${displayWorkoutType(latestWorkout.type || 'seans')} kaydi tamam. ${meta || 'Detay az, ama kayit geldi.'}`
  }
  const score = Number(state.health?.readiness?.score)
  if (Number.isFinite(score)) {
    if (score >= 80) return 'Bugun ana blok icin iyi gorunuyor. Hevy ve Telegram akisi geldikce kart kendini yeniler.'
    if (score >= 60) return 'Normal tempo uygun. Son veriler yuk, defter ve ritim panellerine dusuyor.'
    if (score >= 40) return 'Kontrollu git. Teknik, core veya daha kisa bir seans mantikli.'
    return 'Yorgunluk yuksek gorunuyor. Bugun hafif teknik veya kisa hareket yeter.'
  }
  return 'Hevy ve Telegram kayitlari geldikce karakter karti, acilim dallari ve gorevler canli veriden guncellenir.'
}

const FRONT_STAT_ORDER = ['str', 'agi', 'end', 'dex', 'con', 'sta']

const STAT_UI_META = {
  str: { trait: 'Guc', tone: 'str' },
  agi: { trait: 'Akis', tone: 'agi' },
  end: { trait: 'Nefes', tone: 'end' },
  dex: { trait: 'Teknik', tone: 'dex' },
  con: { trait: 'Govde', tone: 'con' },
  sta: { trait: 'Enerji', tone: 'sta' },
}

function getFrontStats(state, profile) {
  const arrayStats = profile.stats || []
  const liveStats = state.profile?.stats || {}
  return FRONT_STAT_ORDER
    .map(key => {
      const stat = arrayStats.find(item => item.key === key)
      if (!stat) return null
      const liveValue = Number(liveStats[key])
      const seedValue = Number(stat.val)
      const value = Number.isFinite(liveValue) ? liveValue : seedValue
      const meta = STAT_UI_META[key] || { trait: stat.name || key, tone: key }
      return {
        ...stat,
        ...meta,
        val: Math.max(0, Math.min(100, Math.round(Number.isFinite(value) ? value : 0))),
      }
    })
    .filter(Boolean)
}

function renderInfographicStatBoard(state, profile, nextSession = {}) {
  const stats = getFrontStats(state, profile)
  const avgRank = aggregateRank(stats)
  const readinessValue = Number(nextSession.readiness?.score ?? state.health?.readiness?.score)
  const readiness = Number.isFinite(readinessValue) ? Math.round(readinessValue) : '--'
  const hevyLabel = nextSession.sourceHealth?.latestHevyDate
    ? `HEVY LIVE ${formatMonthShort(nextSession.sourceHealth.latestHevyDate)}`
    : 'HEVY LIVE bekliyor'
  const className = state.profile.classObj?.name || profile.class || 'OdiePT'
  const focus = displayWorkoutType(state.profile.currentFocus || nextSession.primaryGoal?.title || 'Karma rota')

  return `
    <article class="glass-card infographic-stat-board" aria-label="RPG karakter stat panosu">
      <div class="stat-board-player">
        <button class="stat-board-avatar" data-action="open-avatar" aria-label="Profili ac">
          <span>${avatarMark(profile)}</span>
          <small>L${profile.level || 1}</small>
        </button>
        <div class="stat-board-id">
          <span>${renderExplainButton('class', className, 'explain-link stat-board-class')}</span>
          <strong>${escapeHtml(profile.nick)}</strong>
        </div>
        <div class="stat-board-readiness">
          <span>${renderExplainButton('readiness', uiLabel('readiness'), 'explain-link metric-explain')}</span>
          <strong>${readiness}</strong>
        </div>
      </div>

      <div class="stat-node-grid">
        ${stats.map(renderInfographicStatNode).join('')}
      </div>

      <div class="stat-board-livebar">
        <span class="live-sync-pill"><i aria-hidden="true"></i>${renderExplainButton('hevy-live', hevyLabel, 'explain-link metric-explain')}</span>
        <span>${renderExplainButton('combat-stats', `RANK ${avgRank}`, 'explain-link metric-explain')}</span>
        <span>${escapeHtml(focus)}</span>
      </div>
    </article>
  `
}

function renderInfographicStatNode(stat) {
  const label = stat.label || stat.key.toUpperCase()
  const value = Math.round(Number(stat.val) || 0)
  const rank = stat.rank || value
  const confidence = cozyConfidenceLabel(stat.confidence)
  return `
    <button
      class="stat-node stat-tone-${escapeHtml(stat.tone || stat.key)} ${stat.critical ? 'is-critical' : ''}"
      style="--stat-pct:${value}%"
      data-action="open-stat"
      data-stat-key="${escapeHtml(stat.key)}"
      aria-label="${escapeHtml(label)} ${rank} detayini ac"
    >
      <span class="stat-node-ring" aria-hidden="true"></span>
      <span class="stat-node-label">${escapeHtml(label)}</span>
      <strong>${escapeHtml(rank)}</strong>
      <small>${escapeHtml(`${stat.trait || stat.name || ''} / ${confidence}`)}</small>
      <span class="stat-node-bar" aria-hidden="true"><i style="width:${value}%"></i></span>
    </button>
  `
}

function aggregateRank(stats = []) {
  const rankScore = { F: 0, D: 1, C: 2, B: 3, A: 4, S: 5 }
  const ranks = stats.map(stat => rankScore[stat.rank] ?? null).filter(Number.isFinite)
  if (!ranks.length) return 'F'
  const avg = Math.round(ranks.reduce((sum, value) => sum + value, 0) / ranks.length)
  return Object.entries(rankScore).find(([, value]) => value === avg)?.[0] || 'F'
}

function percentOf(current = 0, max = 1) {
  const total = Number(max) || 1
  return clamp(Math.round(((Number(current) || 0) / total) * 100))
}

function renderMiniSigil(profile = {}) {
  return `
    <span class="mini-sigil-mark" aria-hidden="true">
      <i></i>
      <b></b>
    </span>
    <span class="sr-only">${escapeHtml(profile.nick || 'Profil')}</span>
  `
}

function renderOdieSignalPills(signals = [], className = '') {
  return `
    <div class="odie-signal-pills ${className}">
      ${signals.slice(0, 4).map(signal => `
        <span class="odie-signal-pill tone-${escapeHtml(signal.tone || 'calm')}">
          <b>${escapeHtml(signal.label || '')}</b>
          <strong>${escapeHtml(signal.value ?? '--')}</strong>
          <small>${escapeHtml(signal.detail || '')}</small>
        </span>
      `).join('')}
    </div>
  `
}

function renderOdieMemoryChips(cards = []) {
  if (!cards.length) {
    return `
      <div class="odie-memory-chips empty">
        <span><b>hafiza</b><small>Yeni soru, seans ve duzeltmeler geldikce burasi dolacak.</small></span>
      </div>
    `
  }
  return `
    <div class="odie-memory-chips">
      ${cards.map(card => `
        <span class="tone-${escapeHtml(card.tone || 'calm')}">
          <b>${escapeHtml(card.label || 'hafiza')}</b>
          <small>${escapeHtml(card.value || '')}</small>
        </span>
      `).join('')}
    </div>
  `
}

function renderOdieLiveCard(presence = {}, { compact = false, action = true } = {}) {
  return `
    <article class="odie-live-card tone-${escapeHtml(presence.tone || 'calm')} ${compact ? 'compact' : ''}">
      <div class="odie-live-head">
        <div class="odie-live-face" aria-hidden="true"><i></i><b></b></div>
        <div>
          <span>ODIE Live</span>
          <strong>${escapeHtml(presence.headline || 'ODIE izleri okuyor')}</strong>
          <small>${escapeHtml(presence.moodLabel || 'canli mod')} / ${escapeHtml(presence.dataConfidence ?? '--')}% veri netligi</small>
        </div>
      </div>
      <p>${escapeHtml(presence.chatLine || presence.hudLine || '')}</p>
      <div class="odie-live-routine">${escapeHtml(presence.routineLine || '')}</div>
      ${renderOdieSignalPills(presence.signals || [])}
      ${compact ? '' : renderOdieMemoryChips(presence.memoryCards || [])}
      ${action ? `
        <div class="odie-live-actions">
          <button type="button" data-tab="odie">ODIE ile konus</button>
          <button type="button" data-action="open-health-shortcut">Defterleri bagla</button>
        </div>
      ` : ''}
    </article>
  `
}

function renderRevMeter(explainKey, label, value, tone = 'ok') {
  const pct = clamp(value)
  const display = Number.isFinite(Number(value)) ? Math.round(Number(value)) : '--'
  return `
    <div class="rev-meter rev-tone-${tone}" style="--meter:${pct}%">
      <div>
        <span>${renderExplainButton(explainKey, label, 'explain-link rev-explain')}</span>
        <strong>${display}</strong>
      </div>
      <i aria-hidden="true"><b></b></i>
    </div>
  `
}

function compactText(value = '', max = 72) {
  const text = String(value || '').replace(/\s+/g, ' ').trim()
  if (!text) return ''
  if (text.length <= max) return text
  return `${text.slice(0, Math.max(0, max - 3)).trim()}...`
}

function regionById(bodyMapState, id) {
  return (bodyMapState?.regions || []).find(region => region.id === id) || null
}

function movementById(bodyMapState, id) {
  return (bodyMapState?.movementLines || []).find(line => line.id === id) || null
}

const ANATOMY_ZONE_ANCHORS = {
  shoulder: { x: 120, y: 112 },
  chest: { x: 120, y: 136 },
  lat: { x: 78, y: 158 },
  'upper-back': { x: 162, y: 158 },
  core: { x: 120, y: 196 },
  forearm: { x: 62, y: 204 },
  wrist: { x: 44, y: 236 },
  hips: { x: 120, y: 252 },
  quads: { x: 120, y: 306 },
  knees: { x: 120, y: 350 },
  calves: { x: 120, y: 382 },
  ankles: { x: 120, y: 402 },
}

const PRESTIGE_ZONE_SHAPES = [
  ['shoulder', { type: 'ellipse', cx: 84, cy: 111, rx: 22, ry: 15 }],
  ['shoulder', { type: 'ellipse', cx: 156, cy: 111, rx: 22, ry: 15 }],
  ['chest', { type: 'ellipse', cx: 120, cy: 137, rx: 43, ry: 24 }],
  ['lat', { type: 'ellipse', cx: 78, cy: 160, rx: 16, ry: 32 }],
  ['upper-back', { type: 'ellipse', cx: 162, cy: 160, rx: 16, ry: 32 }],
  ['core', { type: 'ellipse', cx: 120, cy: 196, rx: 30, ry: 47 }],
  ['forearm', { type: 'ellipse', cx: 56, cy: 205, rx: 12, ry: 36 }],
  ['forearm', { type: 'ellipse', cx: 184, cy: 205, rx: 12, ry: 36 }],
  ['wrist', { type: 'circle', cx: 43, cy: 237, r: 10 }],
  ['wrist', { type: 'circle', cx: 197, cy: 237, r: 10 }],
  ['hips', { type: 'ellipse', cx: 120, cy: 252, rx: 40, ry: 22 }],
  ['quads', { type: 'ellipse', cx: 97, cy: 309, rx: 16, ry: 46 }],
  ['quads', { type: 'ellipse', cx: 143, cy: 309, rx: 16, ry: 46 }],
  ['knees', { type: 'circle', cx: 94, cy: 351, r: 11 }],
  ['knees', { type: 'circle', cx: 146, cy: 351, r: 11 }],
  ['calves', { type: 'ellipse', cx: 88, cy: 383, rx: 13, ry: 34 }],
  ['calves', { type: 'ellipse', cx: 152, cy: 383, rx: 13, ry: 34 }],
]

function renderBodyZone(bodyMapState, id, shape) {
  const region = regionById(bodyMapState, id) || { id, label: id, load: 0, recovery: 0, risk: 0, trend: 'hazir' }
  const tone = region.injury ? 'injury' : region.risk >= 68 ? 'risk' : region.trend === 'ihmal' ? 'gap' : region.trend === 'sicak' ? 'hot' : region.recovery >= 70 ? 'ready' : 'build'
  const common = `
    class="body-zone tone-${tone}"
    data-action="open-body-region"
    data-region-id="${escapeHtml(region.id)}"
    role="button"
    tabindex="0"
    aria-label="${escapeHtml(region.label)} bolge detayi"
    style="--load:${clamp(region.load)}%;--risk:${clamp(region.risk)}%"
  `
  if (shape.type === 'ellipse') {
    return `<ellipse ${common} cx="${shape.cx}" cy="${shape.cy}" rx="${shape.rx}" ry="${shape.ry}" />`
  }
  if (shape.type === 'circle') {
    return `<circle ${common} cx="${shape.cx}" cy="${shape.cy}" r="${shape.r}" />`
  }
  return `<path ${common} d="${shape.d}" />`
}

function anatomyAnchorFor(region) {
  const id = typeof region === 'string' ? region : region?.id
  return ANATOMY_ZONE_ANCHORS[id] || ANATOMY_ZONE_ANCHORS.core
}

function renderPrestigeHeatLayer(bodyMapState, priorityRegion) {
  const anchor = anatomyAnchorFor(priorityRegion)
  return `
    <svg viewBox="0 0 240 420" class="prestige-heat-layer" focusable="false" aria-hidden="true">
      ${PRESTIGE_ZONE_SHAPES.map(([id, shape]) => renderBodyZone(bodyMapState, id, shape)).join('')}
      <circle class="priority-pulse-ring" cx="${anchor.x}" cy="${anchor.y}" r="24" />
      <circle class="priority-pulse-core" cx="${anchor.x}" cy="${anchor.y}" r="7" />
    </svg>
  `
}

function renderPrestigeAnatomySheet(bodyMapState, profile, className = '') {
  const priorityRegion = bodyMapState?.priority?.region
  const priorityMovement = bodyMapState?.priority?.movement
  const quest = bodyMapState?.dailyQuest
  const injury = priorityRegion?.injury || bodyMapState?.injuries?.[0] || null
  const lines = (bodyMapState?.movementLines || []).slice().sort((a, b) => {
    const aScore = (a.tone === 'gap' ? 40 : 0) + a.risk + (100 - a.progress)
    const bScore = (b.tone === 'gap' ? 40 : 0) + b.risk + (100 - b.progress)
    return bScore - aScore
  }).slice(0, injury ? 3 : 4)
  const remainingPct = injury?.remainingPct ?? Math.max(0, 100 - (injury?.recoveryPct || 0))
  const injurySummary = injury
    ? `%${Math.round(injury.recoveryPct ?? 0)} toparlandi / %${Math.round(remainingPct)} kaldi / ${Math.round(injury.etaDays ?? 0)} gun`
    : 'Temiz yuk, kontrollu artis'

  return `
    <div class="prestige-anatomy">
      <button class="anatomy-hero-stage" data-action="open-body-region" data-region-id="${escapeHtml(priorityRegion?.id || 'core')}" aria-label="Canli vucut haritasini ac">
        <span class="anatomy-hero-meta">
          <b>${escapeHtml(profile.nick || 'Atlet')}</b>
          <em>${escapeHtml(className || 'Karakter')}</em>
        </span>
        <span class="anatomy-orbit" aria-hidden="true"></span>
        <span class="prestige-anatomy-art is-retired" aria-hidden="true">Karakter</span>
        ${renderPrestigeHeatLayer(bodyMapState, priorityRegion)}
      </button>

      <div class="anatomy-status-rail" aria-label="Vucut durumu">
        <button class="anatomy-rail-card tone-priority" data-action="open-body-region" data-region-id="${escapeHtml(priorityRegion?.id || 'core')}">
          <span>Odak bolge</span>
          <strong>${escapeHtml(priorityRegion?.label || 'Govde')}</strong>
          <small>${escapeHtml(priorityMovement?.label || 'Mobilite')} hatti</small>
        </button>
        <button class="anatomy-rail-card ${injury ? 'tone-injury' : 'tone-ready'}" data-action="open-body-region" data-region-id="${escapeHtml(injury?.regionId || priorityRegion?.id || 'core')}">
          <span>${injury ? 'Temkin' : 'Kalkan'}</span>
          <strong>${escapeHtml(injury?.label || 'Stabil yuk')}</strong>
          <small>${escapeHtml(injurySummary)}</small>
        </button>
        <button class="anatomy-rail-card tone-quest" data-action="open-body-region" data-region-id="${escapeHtml(priorityRegion?.id || 'core')}">
          <span>Ara gorev</span>
          <strong>${escapeHtml(quest?.name || 'Mini hamle')}</strong>
          <small>${escapeHtml(cozyDisplayText(quest?.desc || 'Bugunun temiz ilerleme isi'))}</small>
        </button>
      </div>

      <div class="movement-stack prestige-movement-stack">
        ${lines.map(line => `
          <span class="movement-line tone-${escapeHtml(line.tone)}" style="--move:${clamp(line.progress)}%">
            <b>${escapeHtml(line.label)}</b>
            <i><em></em></i>
            <strong>${Math.round(line.progress)}</strong>
          </span>
        `).join('')}
      </div>
    </div>
  `
}

function renderXpRoute(bodyMapState) {
  const parts = bodyMapState?.xpPreview?.parts || []
  if (!parts.length) return ''
  return `
    <div class="xp-route" aria-label="Bugun XP nereden gelir">
      <span>XP ROTASI</span>
      <div>
        ${parts.slice(0, 4).map(part => `<b>+${Math.round(part.value)} ${escapeHtml(part.label)}</b>`).join('')}
      </div>
    </div>
  `
}

function cleanScore(value, fallback = 0) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return fallback
  return Math.max(0, Math.min(100, Math.round(numeric)))
}

function vitalTone(value, reverse = false) {
  const score = cleanScore(value)
  const good = reverse ? score <= 45 : score >= 72
  const warn = reverse ? score >= 70 : score < 45
  if (good) return 'good'
  if (warn) return 'warn'
  return 'steady'
}

function renderVitalRing({ key, label, value, detail, reverse = false }) {
  const score = cleanScore(value)
  return `
    <div class="vital-ring tone-${vitalTone(score, reverse)}" style="--vital:${score};--vital-deg:${score * 3.6}deg">
      <div class="vital-ring-orb">
        <span>${escapeHtml(label)}</span>
        <strong>${score}</strong>
      </div>
      <small>${escapeHtml(detail || '')}</small>
    </div>
  `
}

function getVitalOsModel(state = {}, bodyMapState = null, nextSession = null) {
  const vital = state.health?.vitalScores || {}
  const summary = vital.summary || state.healthDailySummary || state.healthStatus?.dailySummary || null
  const load = cleanScore(vital.load ?? summary?.strainScore ?? state.profile?.fatigue ?? 0)
  const recovery = cleanScore(vital.recovery ?? summary?.recoveryScore ?? state.health?.readiness?.score ?? 0)
  const sleep = cleanScore(vital.sleep ?? summary?.sleepScore ?? 0)
  const heartRaw = vital.heart ?? summary?.heartScore
  const heart = Number.isFinite(Number(heartRaw)) ? cleanScore(heartRaw) : 0
  const injury = bodyMapState?.injuries?.[0] || bodyMapState?.priority?.region?.injury || null
  const quest = bodyMapState?.dailyQuest || null
  const unlock = bodyMapState?.unlockTargets?.[0] || null
  const dataConfidence = cleanScore(vital.dataConfidence ?? summary?.dataConfidence ?? state.healthStatus?.dailySummary?.dataConfidence ?? 0)
  const readinessConfidence = ({ high: 'yuksek', medium: 'orta', low: 'dusuk' })[state.health?.readiness?.confidence] || 'orta'
  const activeCommand = cozyDisplayText(nextSession?.coachCommand || quest?.desc || 'Bugunu temiz veriyle kapat.')
  const risk = injury
    ? `${injury.label || 'Bilek'} temkinde: %${Math.round(injury.recoveryPct ?? 0)} toparlandi, ${Math.round(injury.etaDays ?? 0)} gun agir grip yok.`
    : cozyDisplayText(nextSession?.warnings?.[0] || state.health?.warnings?.[0]?.desc || 'Risk sinyali sakin.')

  return {
    summary,
    dataConfidence,
    injury,
    quest,
    unlock,
    activeCommand,
    risk,
    rings: [
      { key: 'load', label: 'Yuk', value: load, reverse: true, detail: summary?.steps ? `${Math.round(summary.steps).toLocaleString('tr-TR')} adim` : `${Math.round(state.profile?.fatigue || 0)} yorgunluk` },
      { key: 'recovery', label: 'Toparlanma', value: recovery, detail: `${readinessConfidence} guven` },
      { key: 'sleep', label: 'Uyku', value: sleep, detail: summary?.totalSleepHours ? `${Number(summary.totalSleepHours).toFixed(1)} saat` : 'izin bekliyor' },
      { key: 'heart', label: 'Kalp', value: heart, detail: summary?.hrvSdnn ? `HRV ${Math.round(summary.hrvSdnn)} / RHR ${Math.round(summary.restingHeartRate || 0)}` : 'nabiz bekliyor' },
    ],
  }
}

function renderVitalPulsePanel(state, bodyMapState, nextSession = null) {
  const model = getVitalOsModel(state, bodyMapState, nextSession)
  return `
    <div class="vital-pulse-panel">
      <div class="vital-pulse-head">
        <span>Karakter Odasi</span>
        <strong>${model.dataConfidence}% okuma netligi</strong>
      </div>
      <div class="vital-ring-grid">
        ${model.rings.map(renderVitalRing).join('')}
      </div>
      <div class="vital-pulse-alert ${model.injury ? 'tone-injury' : 'tone-steady'}">
        <span>${model.injury ? 'Temkin' : 'Durum'}</span>
        <strong>${escapeHtml(model.risk)}</strong>
      </div>
    </div>
  `
}

function renderHealthBridgeCard(state = {}) {
  const healthStatus = state.healthStatus || {}
  const sources = healthStatus.sources || {}
  const appleWorkout = healthStatus.lastAppleWorkout || (state.workouts || []).find(workout => String(workout.source || '').toLowerCase() === 'apple_health')
  const sourceRows = [
    ['Hevy', sources.hevy || 'configured'],
    ['Apple Antrenman', sources.appleWorkout || (appleWorkout ? 'linked' : 'waiting')],
    ['Apple Uyku', sources.appleSleep || 'waiting'],
    ['Apple Kalp', sources.appleHeart || 'waiting'],
    ['Manuel', sources.manual || 'available'],
  ]
  const latestText = appleWorkout
    ? `${formatMonthShort(appleWorkout.date)} / ${appleWorkout.distanceKm ? `${Math.round(appleWorkout.distanceKm * 10) / 10} km` : `${appleWorkout.durationMin || 0} dk`}`
    : (healthStatus.missing ? 'Kurulum bekliyor' : 'Kestirme bekliyor')
  const lastSync = healthStatus.lastSyncAt ? formatMonthShort(healthStatus.lastSyncAt) : 'iz yok'
  const lastError = healthStatus.lastError?.error || ''
  return `
    <article class="health-bridge-card">
      <div>
        <span>${renderExplainButton('apple-health', 'Canli Defterler', 'explain-link metric-explain')}</span>
        <strong>Hevy kuvvet defteri, Apple yasam izi</strong>
        <small>${escapeHtml(latestText)} / son iz ${escapeHtml(lastSync)}${lastError ? ` / hata: ${escapeHtml(lastError).slice(0, 80)}` : ''}</small>
      </div>
      <div class="health-source-grid">
        ${sourceRows.map(([label, status]) => `
          <span class="source-state tone-${escapeHtml(status)}"><b>${escapeHtml(label)}</b><i>${escapeHtml(sourceStateLabel(status))}</i></span>
        `).join('')}
      </div>
      <div class="health-bridge-actions">
        <button data-action="open-health-shortcut">Kestirme kur</button>
        <button data-action="open-walk-form">12 km dogayi yaz</button>
      </div>
    </article>
  `
}

function sourceStateLabel(status = '') {
  const key = String(status || '').toLowerCase()
  return ({
    configured: 'bagli',
    linked: 'bagli',
    available: 'hazir',
    waiting: 'bekliyor',
    missing: 'eksik',
    error: 'hata',
  })[key] || String(status || 'bekliyor').replace(/_/g, ' ')
}

const HUNTER_ICON_PATHS = {
  blade: '<path d="M14 3l7 7-4 1-7 7-4-4 7-7 1-4Z"/><path d="M5 19l4-4"/>',
  heart: '<path d="M12 21s-7-4.4-9-9.3C1.7 8.4 3.6 5 7 5c2 0 3.2 1.1 5 3 1.8-1.9 3-3 5-3 3.4 0 5.3 3.4 4 6.7C19 16.6 12 21 12 21Z"/>',
  flame: '<path d="M12 22c4 0 7-2.8 7-6.5 0-2.8-1.7-5.1-3.7-7.1-.7 2.2-2 3.4-3.3 4.1.5-3.4-.9-6.2-4-9.5.1 4-2.3 6.1-3.4 8.4C3 14.6 4.5 22 12 22Z"/>',
  pulse: '<path d="M3 12h4l2-5 4 10 2-5h6"/>',
  target: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
  shield: '<path d="M12 3 5 6v5c0 4 2.7 7.1 7 8 4.3-.9 7-4 7-8V6l-7-3Z"/><path d="M9 12l2 2 4-5"/>',
  log: '<path d="M7 3h8l4 4v14H7V3Z"/><path d="M15 3v5h4M9 13h6M9 17h6"/>',
  coach: '<path d="M5 6h14v9H9l-4 4V6Z"/><path d="M9 10h6M9 13h4"/>',
  sync: '<path d="M5 7h8a4 4 0 0 1 0 8H9"/><path d="M9 11l-4 4 4 4"/><path d="M15 5h2a4 4 0 0 1 0 8h-2"/>',
}

function renderHunterIcon(kind = 'target') {
  return `
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      ${HUNTER_ICON_PATHS[kind] || HUNTER_ICON_PATHS.target}
    </svg>
  `
}

function buildHunterOdieLine({ state = {}, nextSession = {}, bodyMapState = {}, decision = {} } = {}) {
  const injury = bodyMapState?.injuries?.[0] || bodyMapState?.priority?.region?.injury || null
  const fatigue = Math.round(Number(state.profile?.fatigue) || 0)
  const armor = Math.round(Number(state.profile?.armor) || 0)
  const readiness = Number(nextSession.readiness?.score ?? state.health?.readiness?.score)
  const warning = nextSession.warnings?.[0] || state.profile?.survivalWarnings?.[0] || ''
  if (injury) return `${injury.label || 'Beden'} hala nazli. Bugun ego degil, temiz tekrar kazanir.`
  if (fatigue >= 75) return 'Motor isinmis ama depo bos. Bugun karakteri parlatan sey toparlanma.'
  if (armor < 55 || (Number.isFinite(readiness) && readiness < 45)) return 'Kalkan ince. Kisa, temiz ve kontrollu hamle bugunun galibiyeti.'
  if (warning) return `${compactText(cozyDisplayText(warning), 72)}. Puan sabirdan gelir.`
  return cozyDisplayText(decision.command || nextSession.coachCommand || 'Bugun kucuk artis yeter. Karakteri ileri tasiyan sey temiz kayit.')
}

function buildHunterArc({ state = {}, profile = {}, nextSession = {}, bodyMapState = {}, activeQuest = null, latestWorkout = null } = {}) {
  const decision = buildTodayDecision(state, activeQuest)
  const goal = nextSession.primaryGoal || {}
  const title = goalTitle(goal) || decision.title || activeQuest?.name || 'Temiz Ilerleme'
  const hevy = nextSession.sourceHealth || buildHevyLiveSummary(state.workouts || [], profile)
  const stats = getFrontStats(state, profile)
  const rank = aggregateRank(stats)
  const source = hevy.latestHevyDate ? `HEVY ${formatMonthShort(hevy.latestHevyDate)}` : latestWorkout ? sourceLabel(latestWorkout.source) : 'Defter bekliyor'
  return {
    decision,
    title,
    chapter: `Gun ${profile.level || 1}`,
    rank,
    source,
    line: cozyDisplayText(buildHunterOdieLine({ state, nextSession, bodyMapState, decision })),
  }
}

function renderHunterStatDock(stats = []) {
  const iconFor = {
    str: 'blade',
    agi: 'pulse',
    end: 'flame',
    dex: 'target',
    con: 'shield',
    sta: 'heart',
  }
  return `
    <div class="game-stat-row" aria-label="Karakter statlari">
      ${stats.slice(0, 6).map(stat => {
        const value = clamp(stat.val)
        const rank = stat.rank || Math.round(value)
        return `
          <button class="game-stat-seed stat-tone-${escapeHtml(stat.key)} ${stat.critical ? 'is-critical' : ''}" data-action="open-stat" data-stat-key="${escapeHtml(stat.key)}" style="--stat-pct:${value}%" aria-label="${escapeHtml(stat.name || stat.label)} detayini ac">
            <span class="game-stat-seed-icon">${renderHunterIcon(iconFor[stat.key] || 'target')}</span>
            <span class="game-stat-copy">
              <span>${escapeHtml(stat.label || stat.key?.toUpperCase() || 'ST')}</span>
              <strong>${escapeHtml(rank)}</strong>
            </span>
          </button>
        `
      }).join('')}
    </div>
  `
}

function buildHunterRewardChips(nextSession = {}, bodyMapState = {}, latestWorkout = null) {
  const chips = []
  const delta = latestWorkout?.statDelta || latestWorkout?.stat_delta || {}
  for (const key of FRONT_STAT_ORDER) {
    const value = Number(delta?.[key]) || 0
    if (value > 0) chips.push({ label: `${key.toUpperCase()} +${Math.round(value)}`, tone: key })
  }
  for (const part of bodyMapState?.xpPreview?.parts || []) {
    if (chips.length >= 3) break
    chips.push({ label: `+${Math.round(part.value)} ${part.label}`, tone: 'xp' })
  }
  for (const cap of nextSession.progressionCaps || []) {
    if (chips.length >= 3) break
    chips.push({ label: compactText(cozyDisplayText(cap), 22), tone: 'guard' })
  }
  if (!chips.length) chips.push({ label: 'XP temiz kayittan', tone: 'xp' })
  return chips.slice(0, 3)
}

function renderHunterRewardChips(nextSession, bodyMapState, latestWorkout) {
  return `
    <div class="game-loot-row">
      ${buildHunterRewardChips(nextSession, bodyMapState, latestWorkout).map(chip => `
        <span class="game-loot tone-${escapeHtml(chip.tone)}">
          ${renderHunterIcon(chip.tone === 'guard' ? 'shield' : chip.tone === 'xp' ? 'flame' : 'target')}
          <span>${escapeHtml(chip.label)}</span>
        </span>
      `).join('')}
    </div>
  `
}

function renderHunterQuestCard({ title, label, detail, reward, tone = 'main', action = '', tab = '', explain = '', regionId = '' }) {
  const icon = tone === 'recovery' || tone === 'danger' ? 'shield' : tone === 'side' ? 'pulse' : 'target'
  const attrs = [
    'type="button"',
    `class="game-note tone-${escapeHtml(tone)}"`,
    `data-quest="${escapeHtml(tone === 'danger' ? 'recovery' : tone)}"`,
    `aria-label="${escapeHtml(title)} detayini ac"`,
  ]
  if (action) attrs.push(`data-action="${escapeHtml(action)}"`)
  if (tab) attrs.push(`data-tab="${escapeHtml(tab)}"`)
  if (explain && !action && !tab) attrs.push(`data-explain="${escapeHtml(explain)}"`)
  if (regionId) attrs.push(`data-region-id="${escapeHtml(regionId)}"`)
  return `
    <button ${attrs.join(' ')}>
      <span class="game-note-pin">${renderHunterIcon(icon)}</span>
      <span class="game-note-body">
        <span class="game-note-top">
          <span>
            <span class="game-note-kind">${escapeHtml(label)}</span>
            <strong class="game-note-title">${escapeHtml(title)}</strong>
          </span>
          <em>${escapeHtml(reward)}</em>
        </span>
        <small class="game-note-copy">${escapeHtml(detail)}</small>
      </span>
    </button>
  `
}

function buildHunterQuestCards({ state = {}, profile = {}, nextSession = {}, bodyMapState = {}, activeQuest = null, latestWorkout = null } = {}) {
  const decision = buildTodayDecision(state, activeQuest)
  const blocks = nextSession.blocks || []
  const mainBlock = blocks[0] || {}
  const supportBlock = blocks[1] || {}
  const injury = bodyMapState?.injuries?.[0] || bodyMapState?.priority?.region?.injury || null
  const priorityRegion = bodyMapState?.priority?.region || null
  const recovery = state.profile?.recovery
  const mainTitle = goalTitle(nextSession.primaryGoal) || decision.title
  const mainDetail = cozyDisplayText(mainBlock.target || nextSession.coachCommand || decision.command)
  const recoveryTitle = injury ? `${injury.label || 'Bolge'} korumasi` : 'Kalkan Onarimi'
  const recoveryDetail = injury
    ? `${Math.round(injury.recoveryPct ?? 0)}% toparlandi / ${Math.round(injury.etaDays ?? 0)} gun temkin`
    : recovery ? `${recovery.progressPct}% toparlanma isledi` : 'Uyku, su ve adim bugunku yakit'
  const optionalQuest = bodyMapState?.dailyQuest || activeQuest

  return [
    {
      label: 'Ana Gorev',
      title: mainTitle,
      detail: compactText(mainDetail, 78),
      reward: buildHunterRewardChips(nextSession, bodyMapState, latestWorkout)[0]?.label || '+XP',
      tone: 'main',
      action: 'open-workout',
    },
    {
      label: 'Kalkan',
      title: recoveryTitle,
      detail: compactText(recoveryDetail, 78),
      reward: injury ? 'risk kilidi' : 'kalkan +',
      tone: injury ? 'danger' : 'recovery',
      action: injury ? 'open-body-region' : 'open-health-shortcut',
      regionId: injury?.regionId || priorityRegion?.id || 'core',
    },
    {
      label: 'Ara Gorev',
      title: optionalQuest?.name || supportBlock.target || 'Mini ritim',
      detail: compactText(cozyDisplayText(optionalQuest?.desc || supportBlock.label || decision.next || 'Kisa ama temiz adim'), 78),
      reward: optionalQuest?.reward || 'seri koru',
      tone: 'side',
      action: optionalQuest ? '' : 'open-workout',
      tab: optionalQuest ? 'quests' : '',
      explain: optionalQuest ? 'active-quests' : '',
    },
  ]
}

function renderHunterQuestLane(args) {
  return `
    <div class="game-note-lane" aria-label="Gunluk gorev rotasi">
      <div class="game-lane-head">
        <h3>Kasaba panosu</h3>
        <span>3 not</span>
      </div>
      <div class="game-note-list">
        ${buildHunterQuestCards(args).map(renderHunterQuestCard).join('')}
      </div>
    </div>
  `
}

function renderTodayHunterCardScreen(state, profile, semantic, nextSession = {}, latestWorkout = null, activeQuest = null, bodyMapState = null) {
  const stats = getFrontStats(state, profile)
  const arc = buildHunterArc({ state, profile, nextSession, bodyMapState, activeQuest, latestWorkout })
  const xpPct = percentOf(profile?.xp?.current, profile?.xp?.max)
  const readiness = Number(nextSession.readiness?.score ?? state.health?.readiness?.score)
  const readinessLabel = Number.isFinite(readiness) ? Math.round(readiness) : '--'
  const streak = Number(state.profile?.streak?.current) || 0
  const className = state.profile.classObj?.name || profile.class || 'OdiePT'
  const nextUnlock = bodyMapState?.unlockTargets?.[0] || findNextUnlock(profile.skills || [])
  const unlockHint = nextUnlock?.progress != null
    ? `${Math.round(nextUnlock.progress)}% acilim`
    : summarizeUnlockHint(nextUnlock, profile.skills || []) || 'acilim takipte'

  return `
    <section class="game-day-screen tone-${nextSession.tone || arc.decision.tone || 'calm'}" style="--xp-pct:${xpPct}%">
      <div class="game-night-grain" aria-hidden="true"></div>

      <header class="game-topbar">
        <button class="game-player-tag" data-action="open-avatar" aria-label="Profili ac">
          <span class="game-face" aria-hidden="true"></span>
          <span>
            <span>Day ${escapeHtml(profile.level || 1)}</span>
            <strong>${escapeHtml(profile.nick || 'Oyuncu')}</strong>
          </span>
        </button>
        <div class="game-meter-mini">
          <span>Rank</span>
          <strong>${escapeHtml(arc.rank)}</strong>
        </div>
        <div class="game-meter-mini live">
          <span>${escapeHtml(arc.source)}</span>
          <strong>${streak}g seri</strong>
        </div>
      </header>

      <button class="game-world-stage" data-action="open-avatar" aria-label="Gunluk oyun sahnesini ac">
        <span class="game-sky" aria-hidden="true"></span>
        <span class="game-moon" aria-hidden="true"></span>
        <span class="game-stars" aria-hidden="true"></span>
        <span class="game-hill hill-back" aria-hidden="true"></span>
        <span class="game-hill hill-front" aria-hidden="true"></span>
        <span class="game-ground" aria-hidden="true"></span>
        <span class="game-player-shadow" aria-hidden="true"><i></i><b></b></span>
        <span class="game-campfire" aria-hidden="true"><i></i><b></b></span>
        <span class="game-sign rank-sign" aria-hidden="true">${escapeHtml(arc.rank)}</span>
        <span class="game-sign level-sign" aria-hidden="true">L${escapeHtml(profile.level || 1)}</span>
        <span class="game-story-panel">
          <span class="game-kicker">${escapeHtml(arc.chapter)} / ${escapeHtml(className)}</span>
          <strong>${escapeHtml(arc.title)}</strong>
          <small>${escapeHtml(arc.line)}</small>
        </span>
        <span class="game-xp-log">
          <span>
            <b>XP</b>
            <em>${escapeHtml(profile.xp?.current || 0)}/${escapeHtml(profile.xp?.max || 2000)}</em>
          </span>
          <i><b style="width:${xpPct}%"></b></i>
        </span>
      </button>

      ${renderHunterStatDock(stats)}

      <article class="game-quest-board">
        <div class="game-board-head">
          <span class="game-board-icon">${renderHunterIcon('log')}</span>
          <span>
            <span>Bugunun isi</span>
            <strong>${escapeHtml(arc.title)}</strong>
          </span>
          <em>Hazir ${readinessLabel}</em>
        </div>
        <ul class="game-board-notes">
          <li>${escapeHtml(compactText(cozyDisplayText(nextSession.coachCommand || arc.decision.command), 86))}</li>
          <li>${escapeHtml(compactText(cozyDisplayText(nextSession.primaryGoal?.subtitle || arc.decision.reason || unlockHint), 86))}</li>
        </ul>
        ${renderHunterRewardChips(nextSession, bodyMapState, latestWorkout)}
        <div class="game-action-row">
          <button class="game-primary-btn" type="button" data-action="open-workout">Kayda yaz</button>
          <button class="game-ghost-btn" type="button" data-tab="quests">Panoyu ac</button>
        </div>
      </article>

      ${renderHunterQuestLane({ state, profile, nextSession, bodyMapState, activeQuest, latestWorkout })}

      <footer class="game-logbook">
        <span>Sonraki acilim</span>
        <p>${renderHunterIcon('flame')} ${escapeHtml(unlockHint)}. Bugunun yolu uzun degil, temiz.</p>
        ${latestWorkout?.id ? `
          <button class="game-ghost-btn" type="button" data-action="open-session-detail" data-workout-id="${escapeHtml(latestWorkout.id)}">Son kayit</button>
        ` : `
          <button class="game-ghost-btn" type="button" data-action="open-workout">Ilk kayit</button>
        `}
      </footer>
    </section>
  `
}

function renderTodayPage(state, profile, semantic, ui = buildUiRuntime(state, profile, semantic)) {
  const nextSession = ui.nextSession
  const bodyMapState = ui.bodyMapState
  const activeQuest = ui.activeQuest
  const readiness = Number(state.health?.readiness?.score)
  const armor = Math.round(Number(state.profile?.armor) || 0)
  const fatigue = Math.round(Number(state.profile?.fatigue) || 0)
  const streak = Number(state.profile?.streak?.current) || 0
  const recentSessions = (state.workouts || []).slice(0, 3)
  const latestWorkout = ui.latestWorkout || recentSessions[0] || null
  const lead = buildTodayLead(state, latestWorkout)
  const title = latestWorkout ? `${formatMonthShort(latestWorkout.date)} / ${displayWorkoutType(latestWorkout.type || 'Seans')}` : readinessTitle(readiness)
  const heroMetric = latestWorkout?.durationMin
    ? latestWorkout.durationMin
    : Number.isFinite(readiness)
      ? readiness
      : profile.sessions || 0
  const heroMetricLabel = latestWorkout?.durationMin ? 'dk' : Number.isFinite(readiness) ? '/100' : 'seans'
  const sourceLabel = latestWorkout?.source === 'hevy' ? 'HEVY SON KAYIT' : latestWorkout ? 'SON SEANS' : 'BUGUN'

  return `
    <section class="today-page today-hunter-page">
      ${renderTodayHunterCardScreen(state, profile, semantic, nextSession, latestWorkout, activeQuest, bodyMapState)}

      <div class="today-legacy-desktop">
        ${renderHealthBridgeCard(state)}
        ${renderInfographicStatBoard(state, profile, nextSession)}
        ${renderNextSessionCard(nextSession)}

        <article class="home-cockpit">
          <div class="home-cockpit-main">
            <button class="home-avatar-frame" data-action="open-avatar" aria-label="Profili ac">
              <span>${avatarMark(profile)}</span>
              <small>L${profile.level || 1}</small>
            </button>

            <div class="home-identity">
              <div class="today-hero-eyebrow">${renderExplainButton('class', state.profile.classObj?.name || profile.class || 'OdiePT', 'explain-link eyebrow-explain')}</div>
              <h2>${escapeHtml(profile.nick)}</h2>
              <div class="home-xp-line">
                <span>${renderExplainButton('xp', 'XP', 'explain-link metric-explain')}</span>
                <div class="pix-bar pix-bar-thin"><div class="pix-bar-fill" style="width:${Math.max(0, Math.min(100, Math.round(((profile.xp?.current || 0) / (profile.xp?.max || 1)) * 100)))}%"></div></div>
                <strong>${profile.xp?.current || 0}/${profile.xp?.max || 2000}</strong>
              </div>
            </div>

            ${renderHomeRadar(profile)}
          </div>

          <div class="home-session-card">
            <div>
              <span>${renderExplainButton(latestWorkout?.source === 'hevy' ? 'hevy' : 'kaynak', sourceLabel, 'explain-link metric-explain')}</span>
              <strong>${escapeHtml(title)}</strong>
              <p>${escapeHtml(lead)}</p>
            </div>
            <div class="today-hero-score">
              <strong>${heroMetric || '--'}</strong>
              <small>${heroMetricLabel}</small>
            </div>
          </div>

          <div class="home-metrics-grid">
            <div><span>${renderExplainButton('armor', 'Can', 'explain-link metric-explain')}</span><strong>${armor}</strong></div>
            <div><span>${renderExplainButton('fatigue', 'Yorgunluk', 'explain-link metric-explain')}</span><strong>${fatigue}</strong></div>
            <div><span>${renderExplainButton('hacim', 'Yuk', 'explain-link metric-explain')}</span><strong>${escapeHtml(profile.totalVolume || '0 kg')}</strong></div>
            <div><span>${renderExplainButton('seri', 'Seri', 'explain-link metric-explain')}</span><strong>${streak}g</strong></div>
          </div>

          ${renderHomeDataDeck(state, profile, nextSession)}
        </article>

        <div class="today-insight-grid">
          ${renderRecoveryTrendCard(state)}
          ${renderDisciplineBalanceCard(state)}
          ${renderCoachFeedbackDashboard(state)}
        </div>

        ${activeQuest ? `
          <article class="card-strip" data-tab="character">
            <div class="mini-label">${renderExplainButton('active-quests', 'Siradaki Gorev', 'explain-link metric-explain')}</div>
            <div class="card-strip-row">
              <strong>${escapeHtml(activeQuest.name)}</strong>
              <span>${activeQuest.progress}/${activeQuest.total}</span>
            </div>
            <p>${escapeHtml(cozyDisplayText(activeQuest.desc || ''))}</p>
          </article>
        ` : ''}

        <article class="card-strip">
          <div class="mini-label">${renderExplainButton('daily-status', 'Vucut Durumu', 'explain-link metric-explain')}</div>
          <div class="card-strip-row">
            <span>${renderExplainButton('armor', 'Can', 'explain-link metric-explain')} ${armor}</span>
            <span>${renderExplainButton('fatigue', 'Yorgunluk', 'explain-link metric-explain')} ${fatigue}</span>
            <span>${renderExplainButton('seri', 'Seri', 'explain-link metric-explain')} ${streak}g</span>
          </div>
        </article>

        <article class="glass-card today-sessions">
          <div class="section-top">
            <div>
              <div class="eyebrow">${renderExplainButton('session-detail', 'Son Seanslar', 'explain-link eyebrow-explain')}</div>
              <strong>${renderExplainButton('session-detail', 'Yakin gecmis', 'explain-link explain-heading')}</strong>
            </div>
          </div>
          ${recentSessions.length ? `
            <ul class="today-session-list">
              ${recentSessions.map(renderTodaySessionItem).join('')}
            </ul>
          ` : `
            <div class="today-session-empty">Hevy veya Telegram kaydi bekleniyor.</div>
          `}
        </article>
      </div>
    </section>
  `
}

function clamp(value, min = 0, max = 100) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return min
  return Math.max(min, Math.min(max, numeric))
}

const EXPLAINERS = {
  'today-decision': {
    title: 'Bugunun Karari',
    summary: 'ODIE bugunku ana tercihi tek cumleye indirir: yuklen, form tut, toparlan veya eksik hatti kapat.',
    bullets: [
      'Yorgunluk, kalkan, son seans, toparlanma sayaci ve acik gorevler birlikte okunur.',
      'Bu bir yasak listesi degil; bugunku en mantikli ilk hamledir.',
      'Karar degisirse sebebi genelde yeni seans, yeni gunluk log veya zamanla dusen yorgunluk olur.',
    ],
  },
  'denge-kapatma': {
    title: 'Denge Kapatma',
    summary: 'Son 30 gunde geride kalan hattin kisa bir blokla tamamlanmasi demek.',
    bullets: [
      'Ornek: itis/cekis cok yuksek ama govde azsa seansa 8-10 dk govde ile baslamak.',
      'Amac ana programi bozmak degil; acik kalan halkayi kapatmak.',
      'Bu kart genelde govde, bacak, mobilite veya toparlanma eksigi gorunurse cikar.',
    ],
  },
  'recovery-gunu': {
    title: 'Toparlanma Gunu',
    summary: 'Yuk bindirmek yerine toparlanmayi hizlandiran gun.',
    bullets: [
      'Yorgunluk yuksekken agir itis/cekis yerine yuruyus, mobilite veya hafif form isi secilir.',
      'Hedef XP kasmak degil; bir sonraki verimli seansi acmaktir.',
      'Toparlanma sayaci ilerledikce karar tekrar normale donebilir.',
    ],
  },
  'kontrollu-teknik': {
    title: 'Form Gunu',
    summary: 'Risk varken tamamen durmadan, yuk yerine form temizligi calismak.',
    bullets: [
      'Rekor denemesi veya yuk kovalamak yerine form, destek seti ve dusuk riskli bloklar.',
      'Kalkan dusuk veya hazirlik zayifken kullanilir.',
      'Seans kisa kalabilir; veri girisi yine de build ritmini korur.',
    ],
  },
  'normal-seans': {
    title: 'Kucuk Artis Gunu',
    summary: 'Toparlanma riski dusuk, ana hamle acilabilir demek.',
    bullets: [
      'Yorgunluk kabul edilebilir seviyededir ve kalkan kritik degildir.',
      'Yine de acik denge gap varsa kisa tamamlayici blok eklenebilir.',
    ],
  },
  fatigue: {
    title: 'Yorgunluk',
    summary: 'Vucudun bugun ne kadar yuk tasidigini anlatan sayac. Yuksekse agir seans verimi duser.',
    bullets: [
      'Agir, uzun veya PR iceren seanslardan sonra artar.',
      'Son antrenman bittikten sonra zamanla azalir.',
      'Toparlanma tamamlandikca sifira yaklasir.',
    ],
  },
  armor: {
    title: 'Kalkan',
    summary: 'Tendon ve eklem toleransi gibi dusun. Dusuk kalkan, ayni yukun daha riskli olmasi demek.',
    bullets: [
      'Yuksek yorgunluk ustune agir seans kalkan azaltabilir.',
      "Mobilite, hafif hareket ve zaman kalkan'i tekrar 100'e yaklastirir.",
      'Kalkan kritik dusunce ODIE daha temkinli karar verir.',
    ],
  },
  'recovery-trend': {
    title: 'Toparlanma Seyri',
    summary: 'Son seans bittikten sonra 40 saatlik toparlanma ilerlemesini gosterir.',
    bullets: [
      'Zaman ilerledikce yorgunluk duser, kalkan dolar.',
      'Uyku, su ve adim ortalamalari kartin altinda destek sinyali olarak durur.',
      'Bu kart anlik hissi degil, kayitli veriye gore matematiksel toparlanmayi gosterir.',
    ],
  },
  'denge-paneli': {
    title: 'Denge Paneli',
    summary: 'Son 30 gunde itis, cekis, bacak ve govde hatlarinin ne kadar calistigini karsilastirir.',
    bullets: [
      'Bar uzunlugu en yuksek hatta gore normalize edilir.',
      'Sari bar en geride kalan hatti isaret eder.',
      'Amac simetrik olmak degil; ihmal edilen hatti erken yakalamak.',
    ],
  },
  push: {
    title: 'Itis',
    summary: 'Itis hatti: bench, press, dips, push-up, triceps ve gogus/omuz baskin isler.',
  },
  pull: {
    title: 'Cekis',
    summary: 'Cekis hatti: row, pull-up, pulldown, curl, dead hang ve sirt/biceps isleri.',
  },
  legs: {
    title: 'Bacak',
    summary: 'Alt vucut hatti: squat, lunge, leg press, calf, posterior chain ve kosu/yuruyus bacak etkisi.',
  },
  core: {
    title: 'Govde',
    summary: 'Govde stabilitesi hatti: hollow, plank, leg raise, L-sit, anti-rotation ve trunk kontrolu.',
    bullets: [
      "ODIE govde isini sadece yuruyusten saymaz; direkt govde veya blok izi arar.",
      'Govde gerideyse teknik ve sakatlik toleransi da etkilenebilir.',
    ],
  },
  xp: {
    title: 'XP',
    summary: 'Seansin karakter ilerlemesine yazdigi puan.',
    bullets: [
      "Seans tipi, seri, sinif carpani, PR ve kalkan durumu XP'yi etkiler.",
      'Yorgunluk asiri yuksekse agir seans XP verimi dusebilir.',
    ],
  },
  hacim: {
    title: 'Yuk Defteri',
    summary: 'Kaldirilan toplam yuk. Genelde kilo x tekrar toplamidir.',
    bullets: [
      'Bodyweight hareketlerde kilo bilgisi varsa daha dogru hesaplanir.',
      'Yuk tek basina iyi seans demek degildir; sure, set ve toparlanma ile birlikte okunur.',
    ],
  },
  seri: {
    title: 'Seri',
    summary: 'Arka arkaya gelen antrenman gunleri. Bosluk uzarsa seri kirilir.',
  },
  kaynak: {
    title: 'Defter',
    summary: 'Antrenman verisinin nereden geldigini gosterir: Hevy, Telegram, Apple Health veya web/manual.',
  },
  'apple-health': {
    title: 'Apple Health',
    summary: 'iPhone ve Apple Watch hareket verisini OdiePT antrenman motoruna tasiyan Kestirme koprusu.',
    bullets: [
      'Web app Health verisini kendi kendine cekemez; iPhone izniyle Kestirme veriyi endpoint e yollar.',
      'Yuruyus, hiking, kosu ve bisiklet seanslari XP, yorgunluk, hareket hatti ve bugunun hamlesine yazilir.',
      'Ayni aktivite externalId ile tekrar gelirse ikinci kez XP yazilmaz.',
    ],
  },
  ritim: {
    title: 'Ritim',
    summary: 'Son 7 gunde antrenman veya gunluk iz olan gun sayisi.',
    bullets: [
      'Ritim sadece agir antrenman degil; toparlanma kaydi da davranis zincirini gosterir.',
    ],
  },
  datalarim: {
    title: 'Datalarim',
    summary: 'Son 7 seansin yuk grafigi. Kilo varsa yuk, yoksa sure/set/XP izi kullanilir.',
  },
  readiness: {
    title: 'Hazirlik',
    summary: 'Bugun seansa ne kadar acik oldugunu anlatan kisa skor. Kalkan, yorgunluk ve gunluk loglardan gelir.',
  },
  'daily-status': {
    title: 'Vucut Durumu',
    summary: 'Bugunku can, yorgunluk ve seri ozetidir. Kart, karakterin seansa ne kadar acik oldugunu hizli okutur.',
    bullets: [
      'Can kalkan degerinden, yorgunluk yuk sayacindan gelir.',
      'Seri davranis zincirini gosterir; tek basina agir calismak zorunda degildir.',
    ],
  },
  'current-focus': {
    title: 'Bugunku Odak',
    summary: "ODIE'nin su an en cok dikkat edilmesi gereken hat olarak okudugu alan.",
    bullets: [
      'Kritik stat, kas dengesi, son seans tipi ve karakter sinyali birlikte okunur.',
      'Yeni seans veya gunluk log geldikce odak degisebilir.',
    ],
  },
  class: {
    title: 'Karakter Tipi',
    summary: 'Son antrenman deseninden tureyen aktif RPG arketipi.',
    bullets: [
      'Itis/cekis/govde/hareket dagilimi degistikce karakter tipi de degisebilir.',
      'Karakter tipi XP ve toparlanma gibi kucuk pasif etkiler tasir.',
    ],
  },
  'active-quests': {
    title: 'Aktif Gorevler',
    summary: 'Bugun veya bu hafta kapanabilecek kucuk hedeflerdir.',
    bullets: [
      'Karakter tipi veya ODIE tarafindan acilabilir.',
      'Ilerleme tamamlaninca XP, stat ya da ritim etkisi yazilir.',
    ],
  },
  'combat-stats': {
    title: 'Karakter Statlari',
    summary: 'Guclenme, hareket, dayaniklilik, beceri, kondisyon ve istikrar tarafinin canli ozetidir.',
    bullets: [
      'Stat kartina basinca ilgili alanin neden yukseldigi veya kritik oldugu acilir.',
      'Son seans etkisi varsa kartta artis veya dikkat sinyali gorunur.',
    ],
  },
  'stat-radar': {
    title: 'Stat Radar',
    summary: 'Bugunku stat profilini 30 gun onceki tahmini profil ile karsilastirir.',
    bullets: [
      'Mavi alan simdiki buildi, soluk alan onceki buildi temsil eder.',
      'Toplam fark pozitifse son 30 gun karakter tarafi genislemis demektir.',
    ],
  },
  'skill-tree': {
    title: 'Acilim Dallari',
    summary: 'Uzun vadeli hareket yeteneklerini dal mantigiyla takip eder.',
    bullets: [
      'Acik dugum tamamlanmis, isinan dugum ilerleyen, kilitli dugum henuz acilmamis beceridir.',
      'Karakter tipi ve seans verisi bazi dallari one cikarabilir.',
    ],
  },
  'daily-checklist': {
    title: 'Gunluk Durum',
    summary: 'Su, uyku, adim ve his kaydi toparlanma hesabina destek izi verir.',
    bullets: [
      'Bu kayitlar tek seans yerine genel hazirlik trendini duzeltir.',
      'Eksik log, ODIE kararini daha temkinli yapabilir.',
    ],
  },
  'coach-feedback': {
    title: 'ODIE Hafiza Ayari',
    summary: 'ODIE yorumlarina verdigin DOGRU/YANLIS/ESKI/TONU IYI isaretlerinin kisa ozeti.',
    bullets: [
      'Yanlis isareti hatali yorumu kenara alir.',
      "Tonu iyi isareti ODIE'nin ayni konusma ritmini korumasina yardim eder.",
    ],
  },
  'session-detail': {
    title: 'Seans Detayi',
    summary: 'Kaydedilen antrenmanin ham veriye en yakin ozeti.',
    bullets: [
      'Sure, yuk, set, XP, PR ve defter burada birlikte gorunur.',
      'Bloklar egzersizlerin hangi hatta yazildigini gosterir.',
    ],
  },
  'stat-delta': {
    title: 'Stat Delta',
    summary: 'Bu seansin STR/AGI/END/DEX/CON/STA tarafina yazdigi etkidir.',
    bullets: [
      'Delta tek seans etkisidir; toplam stat kalibrasyonu tum gecmise bakar.',
    ],
  },
  bloklar: {
    title: 'Bloklar',
    summary: 'Seansin parcalara ayrilmis calisma hatlari: kuvvet, govde, hareket, mobilite ve teknik gibi.',
  },
  fact: {
    title: 'Seans Izi',
    summary: "ODIE'nin seans notu veya Hevy verisinden okudugu somut hareket/sure/yuk sinyalleri.",
  },
  pr: {
    title: 'PR',
    summary: 'Personal record sinyali. Hareket, tekrar, kilo veya surede yeni en iyi performans olabilir.',
  },
  water: {
    title: 'Su',
    summary: 'Gunluk su kaydi. Toparlanma yorumunda destek izi olarak kullanilir.',
  },
  sleep: {
    title: 'Uyku',
    summary: 'Son gun uyku saati. Hazirlik ve toparlanma kararlarinda en guclu yan izlerden biridir.',
  },
  steps: {
    title: 'Adim',
    summary: 'Gunluk hareket miktari. Dusuk yogunluklu toparlanma ve genel ritim icin okunur.',
  },
  mood: {
    title: 'Mood',
    summary: 'Bugunku his skoru. ODIE kararini tek basina degil, yorgunluk ve kalkanla birlikte etkiler.',
  },
  'activity-map': {
    title: 'Aktivite Haritasi',
    summary: 'Takvim uzerinde hangi gunlerde kayitli hareket oldugunu ve yogunlugunu gosterir.',
    bullets: [
      'Koyu hucre daha uzun veya yuklu gun demektir.',
      'Bosluklar ritim kopuslarini ve recovery donemlerini yakalamaya yarar.',
    ],
  },
  'survival-console': {
    title: 'Durum Hatti',
    summary: 'Kalkan, yorgunluk, hazirlik ve dikkat uyarilarinin coach ekranindaki kisa ozeti.',
  },
  'heavy-load': {
    title: 'Yuk Birikimi',
    summary: 'Ardisik agir seanslarin ve risk lock durumunun kisa kontroludur.',
  },
  'field-note': {
    title: 'Saha Notu',
    summary: 'Survival motorunun yakaladigi pratik uyari veya olumlu sinyal.',
  },
  'session-reading': {
    title: 'Seans Defteri',
    summary: 'ODIE son seansi hangi hareket, sure, yuk ve blok sinyalleriyle okudugunu gosterir.',
  },
  confidence: {
    title: 'Okuma',
    summary: 'Seans kaydinda Odie yorumunu besleyecek ne kadar somut veri oldugunu gosterir.',
  },
  'parsed-piece': {
    title: 'Seans Izi',
    summary: 'Seans notundan veya Hevy verisinden okunan hareket, set, sure ve mesafe parcalari.',
  },
  'main-load': {
    title: 'Ana Hat',
    summary: 'Seansin baskin calisma tipi ve blok dagilimi.',
  },
  evidence: {
    title: 'Bakilan Izler',
    summary: 'ODIE cevabinda dikkate alinan somut seans ve trend parcalari.',
  },
  memory: {
    title: 'Kalici Notlar',
    summary: "ODIE'nin senden ogrendigi kalici tercih, risk ve hedef notlari.",
  },
  'live-context': {
    title: 'Canli Iz',
    summary: 'ODIE notunun o anki seans, uyarilar ve acik hedeflerle beslendigini gosterir.',
  },
  'ask-line': {
    title: 'ODIE Defteri',
    summary: 'Sorularin ayri kaydoldugu ve cevaplarin antrenman/toparlanma izlerinden uretildigi panel.',
  },
  'ask-answer': {
    title: 'Kisa Yorum',
    summary: 'Son soruya verilen ana cevap. Detaylar sinyal ve sonraki adim kartlarinda ayrilir.',
  },
  'ask-next': {
    title: 'Ne Yapalim',
    summary: 'Ask cevabindan cikan uygulanabilir sonraki adimlar.',
  },
  'ask-memory': {
    title: 'Aklimda Tutsun',
    summary: "ODIE'nin ileride kullanabilecegi tercih veya hedef notu.",
  },
  'ask-history': {
    title: 'Soru Gecmisi',
    summary: 'Onceki soru-cevap kayitlari. Eski soruya basinca o cevap tekrar acilir.',
  },
  'workout-form': {
    title: 'Yeni Seans Ekle',
    summary: 'Web uzerinden manuel antrenman kaydi girme modali.',
  },
  'workout-date': {
    title: 'Tarih',
    summary: 'Seansin hangi gune yazilacagini belirler.',
  },
  'workout-type': {
    title: 'Seans Tipi',
    summary: 'Seansin ana kategorisi. Karakter tipi, denge paneli ve stat etkisine sinyal verir.',
  },
  duration: {
    title: 'Sure',
    summary: 'Seansin dakika cinsinden suresi. Yuk yoksa karar icin destek izi olur.',
  },
  distance: {
    title: 'Mesafe',
    summary: 'Kosma, yuruyus, bisiklet gibi hareketlerde kilometre verisi.',
  },
  elevation: {
    title: 'Yukselti',
    summary: 'Tirmanis veya parkur gibi islerde yukseklik kazanimi.',
  },
  highlight: {
    title: 'Kisa Not',
    summary: 'Seansin en onemli notu: PR, temiz tekrar, zorlanan bolge veya ozel durum.',
  },
  notes: {
    title: 'Notlar',
    summary: "ODIE'nin okuyabilecegi serbest metin alani.",
  },
  exercises: {
    title: 'Egzersizler',
    summary: 'Hareket, tekrar, kilo veya sure detaylari. Yuk ve PR hesaplarini guclendirir.',
  },
  volume: {
    title: 'Toplam Yuk',
    summary: 'Formdaki egzersizlerden hesaplanan toplam kg yukudur.',
  },
  hevy: {
    title: 'Hevy',
    summary: 'Hevy uygulamasindan gelen yapili antrenman kaydi.',
  },
  'hevy-live': {
    title: 'Hevy Live',
    summary: 'Hevy API, webhook ve gunluk events sync hattindan gelen son antrenman durumudur.',
    bullets: [
      'Webhook hizli tetik, cron events sync kacani yakalayan guvence hattidir.',
      'Son Hevy tarihi yoksa API key, webhook veya cron loglari kontrol edilmeli.',
    ],
  },
  'next-session': {
    title: 'Bugunun Hamlesi',
    summary: 'Son Hevy/Telegram/manual veriden bugunku antrenman kararini cikarir.',
    bullets: [
      'Yorgunluk, kalkan, hazirlik, son rekor ve push/pull/bacak/core dengesi birlikte okunur.',
      'Cikti ozet degil, bugun uygulanacak net hamledir.',
    ],
  },
  'progression-cap': {
    title: 'Artis Tavani',
    summary: 'Bugun ne kadar artisa izin oldugunu belirleyen guvenlik siniridir.',
  },
}

function explainerFor(key) {
  return EXPLAINERS[key] || {
    title: key,
    summary: 'Bu terim icin henuz kisa aciklama eklenmedi.',
  }
}

function renderExplainButton(key, label, className = 'explain-link') {
  return `<button type="button" class="${className}" data-explain="${escapeHtml(key)}" aria-haspopup="dialog" aria-label="${escapeHtml(label)} aciklamasini ac">${escapeHtml(label)}</button>`
}

function openExplainModal(key) {
  const item = explainerFor(key)
  openModal(`
    <div class="modal-head">
      <span style="font-size:18px">?</span>
      <div class="modal-head-title">${escapeHtml(item.title)}</div>
      <button class="modal-close" data-close-modal aria-label="Kapat">x</button>
    </div>
    <div class="modal-body explain-modal">
      <div class="modal-desc">${escapeHtml(item.summary || '')}</div>
      ${Array.isArray(item.bullets) && item.bullets.length ? `
        <div class="explain-list">
          ${item.bullets.map(line => `<div>${escapeHtml(line)}</div>`).join('')}
        </div>
      ` : ''}
    </div>
  `)
}

function recentWorkoutsSince(workouts = [], days = 30) {
  const today = new Date(`${getLocalDateString()}T00:00:00`).getTime()
  const cutoff = today - (days * 86400000)
  return (workouts || []).filter(workout => {
    const ts = new Date(`${normalizeDateString(workout.date)}T00:00:00`).getTime()
    return Number.isFinite(ts) && ts >= cutoff
  })
}

function buildTodayDecision(state, activeQuest = null) {
  const fatigue = Number(state.profile?.fatigue) || 0
  const armor = Number(state.profile?.armor) || 0
  const readiness = Number(state.health?.readiness?.score)
  const latest = state.workouts?.[0] || null
  const recovery = state.profile?.recovery || null
  const balance = buildDisciplineBalance(state)
  const nextQuest = activeQuest?.name ? `${activeQuest.name} ${activeQuest.progress}/${activeQuest.total}` : ''

  if (fatigue >= 75 || state.profile?.survivalStatus === 'cns_overloaded') {
    return {
      key: 'recovery-gunu',
      tone: 'danger',
      title: 'Toparlanma Gunu',
      command: 'Agir push/pull yok; 25-35 dk yuruyus veya mobilite.',
      reason: `Yorgunluk ${Math.round(fatigue)}. ${recovery ? `${recovery.progressPct}% toparlanma isledi.` : 'Toparlanma verisi sinirli.'}`,
      next: balance.lowest?.key === 'core' ? '8 dk core aktivasyon eklenebilir.' : 'Yuk degil, ritim koru.',
    }
  }

  if (armor < 55 || (Number.isFinite(readiness) && readiness < 45)) {
    return {
      key: 'kontrollu-teknik',
      tone: 'warn',
      title: 'Form Gunu',
      command: 'Kisa form blogu veya destek seti; rekor denemesi yok.',
      reason: `Kalkan ${Math.round(armor)} ve hazirlik ${Number.isFinite(readiness) ? Math.round(readiness) : '--'}/100.`,
      next: nextQuest || 'Gunluk logu kapat, uyku/su sinyalini tamamla.',
    }
  }

  if (balance.lowest?.key === 'legs' || balance.lowest?.key === 'core') {
    return {
      key: 'denge-kapatma',
      tone: 'warn',
      title: 'Hatti Kapat',
      command: balance.lowest.key === 'legs'
        ? 'Bacak veya arka zincir blogu ekle.'
        : 'Seansa direkt core ile basla.',
      reason: `${balance.lowest.label} son 30 gunde en geride kalan hat.`,
      next: nextQuest || 'Kisa ama net blok yeter.',
    }
  }

  return {
    key: 'normal-seans',
    tone: 'calm',
    title: 'Kucuk Artis Gunu',
    command: latest ? `${displayWorkoutType(latest.type || 'Ana blok')} temposu acilabilir.` : 'Ilk seansi net logla.',
    reason: `Yorgunluk ${Math.round(fatigue)}, kalkan ${Math.round(armor)}.`,
    next: nextQuest || 'Set, sure ve hareketleri temiz gir.',
  }
}

function renderNextSessionCard(nextSession = {}) {
  const readiness = nextSession.readiness || {}
  const goal = nextSession.primaryGoal || {}
  const tone = nextSession.tone || 'calm'
  const blocks = nextSession.blocks || []
  const caps = nextSession.progressionCaps || []
  const warnings = nextSession.warnings || []
  const evidence = nextSession.evidence || []
  const hevyLabel = nextSession.sourceHealth?.latestHevyDate
    ? `HEVY LIVE / ${formatMonthShort(nextSession.sourceHealth.latestHevyDate)}`
    : 'HEVY LIVE / sync bekliyor'
  const primaryBlock = blocks[0] || {}
  const supportBlock = blocks[1] || {}
  const command = cozyDisplayText(nextSession.coachCommand || goal.subtitle || 'Veri geldikce recete olusur.')

  return `
    <article class="glass-card next-session-card next-move-strip tone-${tone}">
      <div class="next-session-head next-move-head">
        <div>
          <div class="eyebrow">${renderExplainButton('next-session', uiLabel('command'), 'explain-link eyebrow-explain')}</div>
          <h3>${renderExplainButton('next-session', goalTitle(goal), 'explain-link explain-heading')}</h3>
        </div>
        <div class="next-move-score" aria-label="Hazirlik skoru">
          <span>H</span>
          <strong>${readiness.score ?? '--'}</strong>
        </div>
      </div>

      <p class="next-move-command">${escapeHtml(command)}</p>

      <div class="next-session-blocks">
        <div class="next-block ${escapeHtml(primaryBlock.kind || 'main')}">
          <span>${escapeHtml(cozyDisplayText(primaryBlock.label || 'Ana gorev'))}</span>
          <strong>${escapeHtml(cozyDisplayText(primaryBlock.target || '-'))}</strong>
        </div>
        <div class="next-block ${escapeHtml(supportBlock.kind || 'support')}">
          <span>${escapeHtml(cozyDisplayText(supportBlock.label || 'Destek'))}</span>
          <strong>${escapeHtml(cozyDisplayText(supportBlock.target || '-'))}</strong>
        </div>
      </div>

      <div class="next-session-foot">
        <span>${renderExplainButton('hevy-live', hevyLabel, 'explain-link metric-explain')}</span>
        <span>${renderExplainButton('progression-cap', cozyDisplayText(caps[0] || 'Artis tavani temiz'), 'explain-link metric-explain')}</span>
        <span>${escapeHtml(cozyDisplayText(warnings[0] || evidence[0] || 'Risk sinyali yok'))}</span>
      </div>
    </article>
  `
}

function renderTodayDecisionCard(state, profile, activeQuest) {
  const decision = buildTodayDecision(state, activeQuest)
  const recovery = state.profile?.recovery
  const recoveryLabel = recovery
    ? `${Math.floor(recovery.elapsedHours)}s gecmis / ${recovery.progressPct}%`
    : 'toparlanma bekliyor'

  return `
    <article class="glass-card today-decision-card tone-${decision.tone}">
      <div class="today-decision-main">
        <div>
          <div class="eyebrow">${renderExplainButton('today-decision', 'Bugunun Karari', 'explain-link eyebrow-explain')}</div>
          <h3>${renderExplainButton(decision.key, decision.title, 'explain-link explain-heading')}</h3>
          <p>${escapeHtml(cozyDisplayText(decision.command))}</p>
        </div>
        <div class="today-decision-meter">
          <strong>${Math.round(Number(state.profile?.fatigue) || 0)}</strong>
          <span>${renderExplainButton('fatigue', 'fatigue', 'explain-link metric-explain')}</span>
        </div>
      </div>
      <div class="today-decision-foot">
        <span>${escapeHtml(cozyDisplayText(decision.reason))}</span>
        <span>${escapeHtml(cozyDisplayText(decision.next))}</span>
        <span>${escapeHtml(recoveryLabel)}</span>
      </div>
    </article>
  `
}

function averageRecentLogs(logs = [], limit = 14) {
  const recent = [...(logs || [])]
    .sort((a, b) => normalizeDateString(b.date).localeCompare(normalizeDateString(a.date)))
    .slice(0, limit)
  const avg = key => recent.length
    ? recent.reduce((sum, item) => sum + (Number(item[key]) || 0), 0) / recent.length
    : 0
  return {
    samples: recent.length,
    sleep: Math.round(avg('sleepHours') * 10) / 10,
    waterL: Math.round((avg('waterMl') / 1000) * 10) / 10,
    steps: Math.round(avg('steps')),
    mood: Math.round(avg('mood') * 10) / 10,
  }
}

function renderRecoveryTrendCard(state) {
  const recovery = state.profile?.recovery || null
  const avg = averageRecentLogs(state.dailyLogs || [], 14)
  const fatigue = clamp(state.profile?.fatigue)
  const armor = clamp(state.profile?.armor)
  const progress = clamp(recovery?.progressPct)
  const subtitle = recovery
    ? `${Math.floor(recovery.elapsedHours)} saat gecti, ${recovery.fatigueRecovered} yorgunluk dustu`
    : 'Yeni seans geldikce 40 saatlik toparlanma sayaci baslar.'

  return `
    <article class="glass-card today-insight-card recovery-trend-card">
      <div class="insight-card-head">
        <div>
          <div class="eyebrow">${renderExplainButton('recovery-trend', 'Toparlanma Seyri', 'explain-link eyebrow-explain')}</div>
          <h3>${renderExplainButton('recovery-trend', '40 saatlik toparlanma', 'explain-link explain-heading')}</h3>
        </div>
        <strong>${progress}%</strong>
      </div>
      <p>${escapeHtml(subtitle)}</p>
      <div class="insight-meter-list">
        ${renderInsightMeter(uiLabel('fatigue'), fatigue, 'danger')}
        ${renderInsightMeter(uiLabel('armor'), armor, 'ok')}
      </div>
      <div class="insight-mini-grid">
        <span><b>${avg.sleep || '-'}</b> uyku</span>
        <span><b>${avg.waterL || '-'}</b>L su</span>
        <span><b>${formatCompactMetric(avg.steps)}</b> adim</span>
        <span><b>${avg.samples}</b> log</span>
      </div>
    </article>
  `
}

function renderInsightMeter(label, value, tone = 'ok') {
  return `
    <div class="insight-meter-row">
      <div>
        <span>${renderExplainButton(label.toLocaleLowerCase('tr-TR') === 'armor' ? 'armor' : 'fatigue', label, 'explain-link metric-explain')}</span>
        <strong>${Math.round(value)}</strong>
      </div>
      <div class="insight-meter-track"><i class="${tone}" style="width:${clamp(value)}%"></i></div>
    </div>
  `
}

function buildDisciplineBalance(state) {
  const recent = recentWorkoutsSince(state.workouts || [], 30)
  const totals = {
    push: { key: 'push', label: 'Itis', value: 0 },
    pull: { key: 'pull', label: 'Cekis', value: 0 },
    legs: { key: 'legs', label: 'Bacak', value: 0 },
    core: { key: 'core', label: 'Govde', value: 0 },
  }

  for (const workout of recent) {
    const sets = Number(workout.sets) || 1
    const type = String(workout.type || '').toLowerCase()
    const tags = new Set(workout.tags || [])
    if (type.includes('push') || tags.has('push')) totals.push.value += sets
    if (type.includes('pull') || tags.has('pull')) totals.pull.value += sets
    if (type.includes('bacak') || tags.has('legs')) totals.legs.value += sets
    const coreBlocks = (workout.blocks || []).filter(block => block.kind === 'core')
    const coreSets = coreBlocks.reduce((sum, block) => sum + (Number(block.sets) || 0), 0)
    if (coreSets || tags.has('core')) totals.core.value += coreSets || Math.max(1, Math.round(sets * 0.35))
  }

  const items = Object.values(totals)
  const max = Math.max(1, ...items.map(item => item.value))
  const normalized = items.map(item => ({
    ...item,
    pct: Math.max(item.value ? 8 : 0, Math.round((item.value / max) * 100)),
  }))
  const lowest = [...normalized].sort((a, b) => a.value - b.value)[0] || null
  return { items: normalized, lowest, sample: recent.length }
}

function renderDisciplineBalanceCard(state) {
  const balance = buildDisciplineBalance(state)
  return `
    <article class="glass-card today-insight-card balance-card">
      <div class="insight-card-head">
        <div>
          <div class="eyebrow">${renderExplainButton('denge-paneli', 'Denge Paneli', 'explain-link eyebrow-explain')}</div>
          <h3>${renderExplainButton('denge-paneli', 'Itis / Cekis / Bacak / Govde', 'explain-link explain-heading')}</h3>
        </div>
        <strong>${balance.sample}</strong>
      </div>
      <div class="balance-lanes">
        ${balance.items.map(item => `
          <div class="balance-lane ${item.key === balance.lowest?.key ? 'low' : ''}">
            <span>${renderExplainButton(item.key, item.label, 'explain-link lane-explain')}</span>
            <div><i style="width:${item.pct}%"></i></div>
            <strong>${Math.round(item.value)}</strong>
          </div>
        `).join('')}
      </div>
      <p>${balance.lowest ? `${balance.lowest.label} hatti geride; bir sonraki plana kisa blok olarak girebilir.` : 'Denge verisi bekleniyor.'}</p>
    </article>
  `
}

function renderCoachFeedbackDashboard(state) {
  const feedback = state.memoryFeedback || []
  const counts = feedback.reduce((acc, item) => {
    const key = item.feedbackType || 'correct'
    acc[key] = (acc[key] || 0) + 1
    return acc
  }, {})
  const total = feedback.length
  const latest = feedback[0]

  return `
    <article class="glass-card today-insight-card coach-feedback-card">
      <div class="insight-card-head">
        <div>
          <div class="eyebrow">${renderExplainButton('coach-feedback', 'ODIE Hafiza', 'explain-link eyebrow-explain')}</div>
          <h3>${renderExplainButton('coach-feedback', 'ODIE ayari', 'explain-link explain-heading')}</h3>
        </div>
        <strong>${total}</strong>
      </div>
      <div class="feedback-count-grid">
        <span><b>${counts.correct || 0}</b>DOGRU</span>
        <span><b>${counts.wrong || 0}</b>YANLIS</span>
        <span><b>${counts.outdated || 0}</b>ESKI</span>
        <span><b>${counts.prefer || 0}</b>TON</span>
      </div>
      <p>${latest ? `${latest.feedbackType} / ${latest.note || 'son isaret'}` : 'ODIE defterinden isaret geldikce ses daha netlesir.'}</p>
    </article>
  `
}

function renderHomeDataDeck(state, profile, nextSession = null) {
  const workouts = state.workouts || []
  const bars = buildHomeLoadBars(workouts, profile)
  const sourceMix = buildHomeSourceMix(workouts)
  const rhythm = buildHomeRhythm(state)
  const hevy = nextSession?.sourceHealth || buildHevyLiveSummary(workouts, profile)
  const totalVolume = workouts.slice(0, 7).reduce((sum, workout) => sum + (Number(workout.volumeKg) || 0), 0)
  const totalMinutes = workouts.slice(0, 7).reduce((sum, workout) => sum + (Number(workout.durationMin) || 0), 0)
  const loadValue = totalVolume > 0
    ? `${formatCompactMetric(totalVolume)} kg`
    : totalMinutes > 0
      ? `${Math.round(totalMinutes)} dk`
      : `${Math.round(avgStatValue(profile))}/100`
  const loadLabel = workouts.length ? 'Son 7 seans yuku' : 'Profil sim'

  return `
    <div class="home-data-deck" aria-label="Datalarim">
      <div class="home-data-card home-data-card-wide">
        <div class="home-data-head">
          <span>${renderExplainButton('datalarim', 'Veri Izi', 'explain-link metric-explain')}</span>
          <strong>${escapeHtml(loadValue)}</strong>
        </div>
        <div class="home-data-sub">${escapeHtml(loadLabel)}</div>
        <div class="home-load-bars">
          ${bars.map(bar => `
            <div class="home-load-bar" title="${escapeHtml(bar.title)}">
              <span style="height:${bar.height}%"></span>
              <small>${escapeHtml(bar.label)}</small>
            </div>
          `).join('')}
        </div>
      </div>

      <div class="home-data-card">
        <div class="home-data-head">
          <span>${renderExplainButton('kaynak', uiLabel('source'), 'explain-link metric-explain')}</span>
          <strong>${sourceMix.total}</strong>
        </div>
        <div class="home-source-stack">
          ${sourceMix.parts.map(part => `<span class="${part.key}" style="width:${part.pct}%"></span>`).join('')}
        </div>
        <div class="home-source-legend">
          ${sourceMix.parts.map(part => `<small>${escapeHtml(part.label)} ${part.count}</small>`).join('')}
        </div>
      </div>

      <div class="home-data-card home-data-card-hevy">
        <div class="home-data-head">
          <span>${renderExplainButton('hevy-live', 'HEVY LIVE', 'explain-link metric-explain')}</span>
          <strong>${escapeHtml(hevy.latestHevyDate ? formatMonthShort(hevy.latestHevyDate) : 'YOK')}</strong>
        </div>
        <div class="home-data-sub">${escapeHtml(hevy.label || 'Hevy API sync bekleniyor')}</div>
        <div class="home-sync-line">
          <span>${escapeHtml(hevy.latestSource || 'manual')}</span>
          <span>${escapeHtml(hevy.lastSync ? formatMonthShort(String(hevy.lastSync).slice(0, 10)) : 'sync yok')}</span>
        </div>
      </div>

      <div class="home-data-card">
        <div class="home-data-head">
          <span>${renderExplainButton('ritim', 'Ritim', 'explain-link metric-explain')}</span>
          <strong>${rhythm.active}/7</strong>
        </div>
        <div class="home-day-dots">
          ${rhythm.days.map(day => `<span class="${day.active ? 'active' : ''}" title="${escapeHtml(day.title)}">${day.label}</span>`).join('')}
        </div>
        <div class="home-data-sub">${escapeHtml(rhythm.summary)}</div>
      </div>
    </div>
  `
}

function buildHevyLiveSummary(workouts = [], profile = {}) {
  const recent = (workouts || []).slice(0, 30)
  const hevy = recent.filter(workout => String(workout.source || '').toLowerCase() === 'hevy')
  const latest = recent[0] || null
  const latestHevy = hevy[0] || null
  return {
    hevyCount: hevy.length,
    totalRecent: recent.length,
    latestHevyDate: latestHevy?.date || null,
    latestSource: latest?.source || 'manual',
    lastSync: profile.lastUpdated || latest?.createdAt || latest?.created_at || null,
    label: hevy.length ? `Hevy ${hevy.length}/${recent.length || hevy.length}` : 'Hevy API sync bekleniyor',
  }
}

function buildHomeLoadBars(workouts = [], profile = {}) {
  const recent = workouts.slice(0, 7).reverse()
  const source = recent.length
    ? recent.map(workout => {
      const volume = Number(workout.volumeKg) || 0
      const minutes = Number(workout.durationMin) || 0
      const sets = Number(workout.sets) || 0
      const value = volume || (minutes * 70) || (sets * 180) || (Number(workout.xpEarned) || 1)
      return {
        value,
        label: shortDateLabel(workout.date),
        title: `${formatMonthShort(workout.date)} / ${displayWorkoutType(workout.type || 'Seans')} / ${volume ? `${formatCompactMetric(volume)} kg` : `${Math.round(minutes)} dk`}`,
      }
    })
    : (profile.stats || []).slice(0, 7).map(stat => ({
      value: Number(stat.val) || 0,
      label: stat.label || stat.key,
      title: `${stat.label || stat.key} ${Math.round(Number(stat.val) || 0)}`,
    }))

  const max = Math.max(1, ...source.map(item => item.value))
  return source.map(item => ({
    ...item,
    height: Math.max(16, Math.round((item.value / max) * 100)),
  }))
}

function buildHomeSourceMix(workouts = []) {
  const counts = workouts.reduce((acc, workout) => {
    const source = String(workout.source || 'manual').toLowerCase()
    if (source === 'hevy') acc.hevy += 1
    else if (source === 'telegram') acc.telegram += 1
    else acc.manual += 1
    return acc
  }, { hevy: 0, telegram: 0, manual: 0 })
  const total = counts.hevy + counts.telegram + counts.manual
  const rawParts = [
    { key: 'hevy', label: 'Hevy', count: counts.hevy },
    { key: 'telegram', label: 'TG', count: counts.telegram },
    { key: 'manual', label: 'Web', count: counts.manual },
  ]
  const parts = total
    ? rawParts.map(part => ({ ...part, pct: Math.max(part.count ? 8 : 0, Math.round((part.count / total) * 100)) }))
    : [{ key: 'manual', label: 'Bekliyor', count: 0, pct: 100 }]
  return { total, parts }
}

function buildHomeRhythm(state) {
  const workouts = state.workouts || []
  const dailyLogs = state.dailyLogs || []
  const activeDates = new Set(workouts.map(workout => normalizeDateString(workout.date)))
  const logDates = new Set(dailyLogs.map(log => normalizeDateString(log.date)))
  const anchor = parseLocalDate(workouts[0]?.date || dailyLogs[0]?.date || getLocalDateString())
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = shiftDate(anchor, index - 6)
    const key = normalizeDateString(date.toISOString())
    const active = activeDates.has(key) || logDates.has(key)
    return {
      active,
      label: String(date.getDate()).padStart(2, '0'),
      title: `${key}${active ? ' aktif' : ' bos'}`,
    }
  })
  const active = days.filter(day => day.active).length
  const latestLog = dailyLogs[0]
  const sleepHours = Number(latestLog?.sleepHours) || 0
  const steps = Number(latestLog?.steps) || 0
  const waterMl = Number(latestLog?.waterMl) || 0
  const summary = sleepHours > 0 || steps > 0
    ? `Uyku ${sleepHours.toFixed(1)}s / ${formatCompactMetric(steps)} adim`
    : waterMl > 0
      ? `${formatCompactMetric(waterMl)} ml su`
      : active ? 'Son hafta hareket izi' : 'Ritim verisi bekliyor'
  return { days, active, summary }
}

function avgStatValue(profile = {}) {
  const stats = (profile.stats || []).map(stat => Number(stat.val)).filter(Number.isFinite)
  if (!stats.length) return 0
  return stats.reduce((sum, value) => sum + value, 0) / stats.length
}

function formatCompactMetric(value = 0) {
  const num = Math.round(Number(value) || 0)
  if (Math.abs(num) >= 1000000) return `${(num / 1000000).toFixed(1).replace(/\.0$/, '')}m`
  if (Math.abs(num) >= 1000) return `${Math.round(num / 1000)}k`
  return String(num)
}

function parseLocalDate(value) {
  const normalized = normalizeDateString(value)
  const parsed = new Date(`${normalized}T12:00:00`)
  return Number.isNaN(parsed.getTime()) ? new Date(`${getLocalDateString()}T12:00:00`) : parsed
}

function shiftDate(date, offset) {
  const next = new Date(date.getTime())
  next.setDate(next.getDate() + offset)
  return next
}

function shortDateLabel(value) {
  const label = formatMonthShort(value)
  return label.split(' ')[0] || label
}

function renderHomeRadar(profile) {
  const stats = profile.stats || []
  const order = ['str', 'agi', 'end', 'dex', 'con', 'sta']
  const ordered = order.map(key => stats.find(stat => stat.key === key)).filter(Boolean)
  if (ordered.length < 6) return ''

  const size = 132
  const cx = size / 2
  const cy = size / 2
  const radius = 42
  const angleFor = index => (-Math.PI / 2) + (index * (2 * Math.PI / 6))
  const point = (value, index, scale = 1) => {
    const angle = angleFor(index)
    const r = (Math.max(0, Math.min(100, value)) / 100) * radius * scale
    return [cx + r * Math.cos(angle), cy + r * Math.sin(angle)]
  }
  const polygon = ordered.map((stat, index) => point(Number(stat.val) || 0, index).join(',')).join(' ')
  const rings = [0.35, 0.7, 1].map(scale => {
    const points = ordered.map((_, index) => point(100, index, scale).join(',')).join(' ')
    return `<polygon points="${points}" class="home-radar-ring"/>`
  }).join('')
  const axis = ordered.map((_, index) => {
    const [x, y] = point(100, index)
    return `<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" class="home-radar-axis"/>`
  }).join('')
  const labels = ordered.map((stat, index) => {
    const [x, y] = point(100, index, 1.28)
    return `<text x="${x}" y="${y}" text-anchor="middle" dominant-baseline="middle">${escapeHtml(stat.label || stat.key)}</text>`
  }).join('')

  return `
    <div class="home-radar">
      <svg viewBox="0 0 ${size} ${size}" aria-hidden="true">
        ${rings}
        ${axis}
        <polygon points="${polygon}" class="home-radar-shape"/>
        ${labels}
      </svg>
    </div>
  `
}

function renderTodaySessionItem(workout) {
  const title = `${formatMonthShort(workout.date)} / ${displayWorkoutType(workout.type || 'Seans')}`
  const meta = [
    workout.durationMin ? `${workout.durationMin}dk` : null,
    workout.distanceKm ? `${workout.distanceKm}km` : null,
    workout.volumeKg ? `${Math.round(workout.volumeKg).toLocaleString('tr-TR')}kg` : null,
    workout.source === 'hevy' ? 'Hevy' : null,
  ].filter(Boolean).join(' / ')
  const safeId = escapeHtml(String(workout.id || ''))
  return `
    <li class="today-session-item">
      <button class="today-session-open" data-action="open-session-detail" data-workout-id="${safeId}">
        <div class="today-session-text">
        <strong>${escapeHtml(title)}</strong>
        <span>${escapeHtml(meta || 'detay yok')}</span>
        </div>
      </button>
      ${safeId ? `<button class="today-session-del" data-action="delete-workout" data-workout-id="${safeId}" aria-label="Seansi sil">Sil</button>` : ''}
    </li>
  `
}

function openSessionDetailModal(workout, state) {
  if (!workout) return
  const profile = store.getProfile()
  const blocks = workout.blocks || []
  const statDelta = workout.statDelta || workout.stat_delta || {}
  const facts = (state.workoutFacts || []).filter(item => String(item.workoutId || item.workout_id || '') === String(workout.id)).slice(0, 6)
  const title = `${formatMonthShort(workout.date)} / ${displayWorkoutType(workout.type || 'Seans')}`
  const source = String(workout.source || 'manual').toUpperCase()
  const nextUnlock = findNextUnlock(profile.skills || [])
  const statHits = ['str', 'agi', 'end', 'dex', 'con', 'sta']
    .map(key => ({ key: key.toUpperCase(), value: Number(statDelta?.[key]) || 0 }))
    .filter(item => item.value > 0)
    .sort((a, b) => b.value - a.value)
  const topStat = statHits[0]
  const questLine = workout.xpEarned
    ? `Gorev bitti. +${workout.xpEarned} XP kayda gecti.`
    : 'Gorev kaydi kapandi. Siradaki gelisim icin veri islendi.'
  const odieLine = workout.hasPr
    ? 'Bugun tabela degisti; yarin ego degil toparlanma kazanir.'
    : topStat
      ? `${topStat.key} biraz daha parliyor. Kucuk iz, uzun yolda kalir.`
      : 'Temiz kayit bile karakteri ileri iter. Bugunun izi duruyor.'
  const loot = [
    workout.xpEarned ? `+${workout.xpEarned} XP` : null,
    topStat ? `${topStat.key} +${Math.round(topStat.value)}` : null,
    workout.hasPr ? 'PR izi' : null,
    source === 'HEVY' ? 'Hevy canli' : source,
  ].filter(Boolean).slice(0, 4)
  const completionBadge = workout.hasPr ? 'PR' : workout.xpEarned ? 'BITTI' : 'NOT'
  const completionBadgeClass = workout.hasPr ? 'pr' : workout.xpEarned ? 'clear' : 'log'
  const metrics = [
    { label: 'Sure', value: workout.durationMin ? `${workout.durationMin} dk` : '-', explain: 'session-detail' },
    { label: 'Yuk', value: workout.volumeKg ? `${Math.round(workout.volumeKg).toLocaleString('tr-TR')} kg` : '-', explain: 'hacim' },
    { label: 'Set', value: workout.sets || '-', explain: 'session-detail' },
    { label: 'XP', value: workout.xpEarned ? `+${workout.xpEarned}` : '-', explain: 'xp' },
    { label: 'Defter', value: source, explain: source === 'HEVY' ? 'hevy' : 'kaynak' },
    { label: 'PR', value: workout.hasPr ? 'VAR' : 'YOK', explain: 'pr' },
  ]

  openModal(`
    <div class="modal-head">
      <span style="font-size:22px">OK</span>
      <div class="modal-head-title">${renderExplainButton('session-detail', 'Gorev Tamam', 'explain-link modal-title-explain')}</div>
      <button class="modal-close" data-close-modal aria-label="Kapat">x</button>
    </div>
    <div class="modal-body session-detail-modal quest-complete-modal">
      <div class="quest-complete-hero">
        <div>
          <div class="mini-label">${escapeHtml(title)}</div>
          <strong>${escapeHtml(workout.highlight || questLine)}</strong>
          <p>${escapeHtml(odieLine)}</p>
        </div>
        <span class="quest-complete-badge ${completionBadgeClass}">${escapeHtml(completionBadge)}</span>
      </div>
      <div class="quest-loot-row">
        ${loot.map(item => `<span>${escapeHtml(item)}</span>`).join('')}
      </div>
      <div class="quest-complete-line">
        <span>${escapeHtml(questLine)}</span>
        <strong>${escapeHtml(nextUnlock?.name ? `Siradaki kilit: ${nextUnlock.name}` : 'Siradaki kilit takipte')}</strong>
      </div>
      <div class="modal-grid">
        ${metrics.map(item => `
          <div class="modal-item">
            <div class="modal-item-label">${renderExplainButton(item.explain, item.label, 'explain-link metric-explain')}</div>
            <div class="modal-item-val">${escapeHtml(item.value)}</div>
          </div>
        `).join('')}
      </div>
      <div class="modal-section-label">${renderExplainButton('stat-delta', 'Stat Izi', 'explain-link metric-explain')}</div>
      ${renderSessionStatDelta(statDelta)}
      <div class="modal-section-label">${renderExplainButton('bloklar', 'Blok Izleri', 'explain-link metric-explain')}</div>
      ${renderSessionBlocks(blocks)}
      <div class="modal-section-label">${renderExplainButton('fact', 'Seans Izi', 'explain-link metric-explain')}</div>
      ${facts.length ? `
        <div class="session-fact-list">
          ${facts.map(fact => `<span>${escapeHtml(fact.label || fact.raw || fact.blockKind || 'fact')}</span>`).join('')}
        </div>
      ` : '<div class="modal-coach">Bu seans icin ayri seans izi yok; bloklar antrenman defterinden okunuyor.</div>'}
    </div>
  `)
}

function renderSessionStatDelta(delta = {}) {
  const items = ['str', 'agi', 'end', 'dex', 'con', 'sta']
    .map(key => ({ key: key.toUpperCase(), value: Number(delta?.[key]) || 0 }))
    .filter(item => item.value > 0)
  if (!items.length) return '<div class="modal-coach">Bu kayitta stat izi yok.</div>'
  return `
    <div class="session-delta-pills">
      ${items.map(item => `<span>${item.key} +${item.value}</span>`).join('')}
    </div>
  `
}

function renderSessionBlocks(blocks = []) {
  if (!blocks.length) return '<div class="modal-coach">Blok verisi yok.</div>'
  const max = Math.max(1, ...blocks.map(block => Number(block.sets) || Number(block.durationMin) || Number(block.volumeKg) / 500 || 1))
  return `
    <div class="session-block-list">
      ${blocks.slice(0, 10).map(block => {
        const value = Number(block.sets) || Number(block.durationMin) || Math.round((Number(block.volumeKg) || 0) / 500) || 1
        const width = Math.max(8, Math.round((value / max) * 100))
        const meta = [
          block.sets ? `${block.sets} set` : null,
          block.durationMin ? `${block.durationMin} dk` : null,
          block.volumeKg ? `${Math.round(block.volumeKg)} kg` : null,
          block.distanceKm ? `${block.distanceKm} km` : null,
        ].filter(Boolean).join(' / ')
        return `
          <div class="session-block-row">
            <div>
              <strong>${escapeHtml(cozyDisplayText(localizeKindWords(block.label || block.kind)))}</strong>
              <span>${escapeHtml(cozyDisplayText(localizeKindWords(block.kind || 'mixed')))} ${meta ? `/ ${meta}` : ''}</span>
            </div>
            <div class="session-block-meter"><i style="width:${width}%"></i></div>
          </div>
        `
      }).join('')}
    </div>
  `
}

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/* ---------- Character page (Pixel MMO sheet) ---------- */

function renderCharacterPage(state, profile, semantic, ui = buildUiRuntime(state, profile, semantic)) {
  return `
    <section class="character-page hunter-character-page">
      ${renderHunterCharacterArc(state, profile, semantic, ui)}
      ${renderCharacterArena(state, profile, semantic, ui)}
      ${renderHealthBridgeCard(state)}
      ${renderPortraitBanner(state, profile)}
      ${renderTrioCards(state, profile, semantic)}
      ${renderCalibrationCallout(profile)}
      ${renderStatGridPixel(state, profile)}
      ${renderStatRadar(state, profile)}
      ${renderSkillTreePixel(profile)}
      ${renderQuestPixel(profile)}
      <article class="glass-card recovery-pixel">
        <div class="section-top">
          <div>
            <div class="eyebrow">${renderExplainButton('daily-checklist', 'Gunluk Durum', 'explain-link eyebrow-explain')}</div>
            <h3>${renderExplainButton('daily-checklist', 'Su / uyku / adim', 'explain-link explain-heading')}</h3>
          </div>
        </div>
        ${renderDailyChecklist()}
      </article>
      ${renderHeatmap(state.workouts || [])}
    </section>
  `
}

function renderHunterCharacterArc(state, profile, semantic, ui = buildUiRuntime(state, profile, semantic)) {
  const bodyMapState = ui.bodyMapState
  const nextSession = ui.nextSession
  const latest = ui.latestWorkout || null
  const activeQuest = ui.activeQuest
  const arc = buildHunterArc({ state, profile, nextSession, bodyMapState, activeQuest, latestWorkout: latest })
  const nextUnlock = bodyMapState?.unlockTargets?.[0] || findNextUnlock(profile.skills || [])
  const latestGain = latest?.xpEarned ? `Son gorev +${latest.xpEarned} XP` : latest ? `${formatMonthShort(latest.date)} kaydi islendi` : 'Ilk kayit bekleniyor'
  return `
    <article class="hunter-character-arc">
      <div class="hunter-character-head">
        <span class="hunter-character-mark">${renderHunterIcon('shield')}</span>
        <div>
          <span class="hunter-kicker">${escapeHtml(arc.chapter)}</span>
          <h2 class="hunter-character-title">${escapeHtml(profile.nick)} gelisim kaydi</h2>
        </div>
        <span class="hunter-character-rank">${escapeHtml(arc.rank)}</span>
      </div>
      <p class="hunter-character-copy">${escapeHtml(arc.line)}</p>
      <div class="hunter-character-grid">
        <div class="hunter-character-cell">
          <span class="hunter-field-label">Son kazanim</span>
          <strong class="hunter-character-value">${escapeHtml(latestGain)}</strong>
        </div>
        <div class="hunter-character-cell">
          <span class="hunter-field-label">Siradaki acilim</span>
          <strong class="hunter-character-value">${escapeHtml(nextUnlock?.name || 'Takipte')}</strong>
        </div>
        <div class="hunter-character-cell">
          <span class="hunter-field-label">Sinif</span>
          <strong class="hunter-character-value">${escapeHtml(state.profile.classObj?.name || profile.class || 'Sinif stabil')}</strong>
        </div>
      </div>
    </article>
  `
}

function renderMirogluCommandCard({ label, title, detail, tone = 'focus', action = '', regionId = '' }) {
  const tag = action ? 'button' : 'div'
  const attrs = action
    ? ` data-action="${escapeHtml(action)}"${regionId ? ` data-region-id="${escapeHtml(regionId)}"` : ''}`
    : ''
  return `
    <${tag} class="sheet-command-card tone-${escapeHtml(tone)}"${attrs}>
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(title)}</strong>
      <small>${escapeHtml(detail)}</small>
    </${tag}>
  `
}

function renderVitalOsArena(state, profile, semantic, ui = buildUiRuntime(state, profile, semantic)) {
  const bodyMapState = ui.bodyMapState
  const nextSession = ui.nextSession
  const model = getVitalOsModel(state, bodyMapState, nextSession)
  const presence = buildOdiePresence({ state, profile, nextSession, bodyMapState })
  const xpCur = profile?.xp?.current ?? 0
  const xpMax = profile?.xp?.max || 1
  const xpPct = percentOf(xpCur, xpMax)
  const liveClass = state.profile.classObj || {}
  const className = liveClass.name || profile.class || 'OdiePT'
  const rank = profile.rank || 'Unranked'
  const quest = model.quest
  const unlock = model.unlock || findNextUnlock(profile.skills || [])
  const unlockDetail = unlock?.progress != null
    ? `%${Math.round(unlock.progress)} yakin / ${unlock.todayStep || unlock.missing || 'mini adim bekliyor'}`
    : summarizeUnlockHint(unlock, profile.skills || []) || 'Acilim icin canli veri bekliyor'
  return `
    <article class="character-arena vital-os-arena" style="--xp-pct:${xpPct}%">
      <header class="vital-os-topbar">
        <div>
          <span>Karakter Odasi</span>
          <h2>${escapeHtml(profile.nick)}</h2>
          <p>L${escapeHtml(profile.level || 1)} / ${escapeHtml(rank)} / ${escapeHtml(className)}</p>
        </div>
        <button class="vital-os-confidence" data-action="open-health-shortcut">
          <span>Veri Netligi</span>
          <strong>${model.dataConfidence}%</strong>
        </button>
      </header>

      <section class="vital-os-odie">
        <div>
          <span>ODIE notu</span>
          <strong>${escapeHtml(presence.headline)}</strong>
          <p>${escapeHtml(presence.chatLine)}</p>
        </div>
        ${renderOdieSignalPills(presence.signals || [], 'mini')}
      </section>

      <div class="vital-os-core">
        <div class="vital-os-rings">
          ${model.rings.map(renderVitalRing).join('')}
        </div>
        <div class="vital-os-summary">
          <span>Bugunku rota</span>
          <strong>${escapeHtml(goalTitle(nextSession.primaryGoal) || quest?.name || 'Temiz Gun')}</strong>
          <p>${escapeHtml(cozyDisplayText(model.activeCommand))}</p>
        </div>
      </div>

      <div class="vital-os-risk ${model.injury ? 'tone-injury' : 'tone-steady'}">
        <span>${model.injury ? 'Sakatlik Temkini' : 'Risk'}</span>
        <strong>${escapeHtml(model.risk)}</strong>
      </div>

      <div class="anatomy-command-strip vital-command-strip">
        ${renderMirogluCommandCard({
          label: 'Ara Gorev',
          title: quest?.name || 'Gunluk halka',
          detail: cozyDisplayText(quest?.why || quest?.desc || 'Bugunun XP hattini guvenli kapat.'),
          tone: quest?.safeMode ? 'injury' : 'focus',
        })}
        ${renderMirogluCommandCard({
          label: uiLabel('unlock'),
          title: unlock?.name || 'Stabil yol',
          detail: unlockDetail.slice(0, 96),
          tone: 'unlock',
          action: 'open-unlock',
        })}
        ${renderMirogluCommandCard({
          label: 'XP Nereden Gelir?',
          title: bodyMapState?.xpPreview?.text || `XP ${xpCur}/${xpMax}`,
          detail: 'Antrenman, hareket, uyku onarimi, kalp stabilitesi ve gorev bagli.',
          tone: 'xp',
        })}
      </div>
    </article>
  `
}

function renderCharacterArena(state, profile, semantic, ui = buildUiRuntime(state, profile, semantic)) {
  return renderVitalOsArena(state, profile, semantic, ui)
}

function buildCharacterStatusEffect(bodyMapState = {}, state = {}) {
  const injury = bodyMapState.priority?.region?.injury || bodyMapState.injuries?.[0]
  if (injury) {
    return {
      label: 'Aktif etki',
      title: injury.label || 'Sakatlik korumasi',
      detail: `%${Math.round(injury.recoveryPct ?? 0)} toparlandi, %${Math.round(injury.remainingPct ?? 0)} kaldi. ${Math.round(injury.etaDays ?? 0)} gun temkin.`,
      regionId: injury.regionId,
      tone: 'injury',
    }
  }

  const fatigue = Number(state.profile?.fatigue) || 0
  const armor = Number(state.profile?.armor) || 100
  if (fatigue >= 70) {
    return {
      label: 'Aktif etki',
      title: 'Yorgunluk kilidi',
      detail: 'Bugun XP toparlanmadan gelir; agir yuk karaktere zarar yazar.',
      regionId: bodyMapState.priority?.region?.id || 'core',
      tone: 'risk',
    }
  }
  if (armor < 60) {
    return {
      label: 'Aktif etki',
      title: 'Kalkan ince',
      detail: 'Form ve mobilite bugun ana ilerleme hattidir.',
      regionId: bodyMapState.priority?.region?.id || 'shoulder',
      tone: 'guard',
    }
  }
  return {
    label: 'Aktif etki',
    title: 'Temiz ilerleme',
    detail: 'Build stabil; kucuk artis, temiz tekrar ve ara gorev XP getirir.',
    regionId: bodyMapState.priority?.region?.id || 'core',
    tone: 'ready',
  }
}

function renderPassportStat(stat, nextUnlock = null, bodyMapState = {}) {
  const val = clamp(stat.val)
  const unlockLinked = nextUnlock?.linkedRegions?.some(regionId => {
    const region = regionById(bodyMapState, regionId)
    if (!region) return false
    const statKey = String(stat.key || '')
    return (
      (statKey === 'con' && region.id === 'core') ||
      (statKey === 'str' && ['chest', 'lat', 'upper-back', 'forearm', 'wrist'].includes(region.id)) ||
      (statKey === 'agi' && ['hips', 'knees', 'ankles', 'calves'].includes(region.id)) ||
      (statKey === 'dex' && ['core', 'hips', 'ankles', 'wrist'].includes(region.id)) ||
      (statKey === 'end' && ['calves', 'quads', 'hamstrings'].includes(region.id)) ||
      (statKey === 'sta' && region.recovery >= 65)
    )
  })
  const note = unlockLinked
    ? `Acilima bagli: ${nextUnlock.name}`
    : (stat.critical ? 'Zayif halka: once kontrol' : `${stat.trait || stat.name || 'Build'} hatti`)

  return `
    <button class="passport-stat stat-tone-${escapeHtml(stat.key)} ${stat.critical ? 'is-critical' : ''}" data-action="open-stat" data-stat-key="${escapeHtml(stat.key)}" style="--stat-pct:${val}%" aria-label="${escapeHtml(stat.name || stat.label)} detayini ac">
      <span>${escapeHtml(stat.label || stat.key?.toUpperCase())}</span>
      <strong>${escapeHtml(stat.rank || Math.round(val))}</strong>
      <small>${escapeHtml(note.slice(0, 52))}</small>
      <i aria-hidden="true"><b></b></i>
    </button>
  `
}

function summarizeSkillProgress(skills = []) {
  const nodes = skills.flatMap(branch => branch.items || [])
  if (!nodes.length) return 'Acilim verisi bekliyor'
  const done = nodes.filter(node => node.status === 'done').length
  const progress = nodes.filter(node => node.status === 'prog').length
  return `${done} acilim / ${progress} aktif`
}

function renderCalibrationCallout(profile) {
  if (profile.calibration?.completedAt) return ''
  return `
    <button class="stat-calibration-card" data-action="open-stat-calibration">
      <span class="sec">Kurulum Kalibrasyonu</span>
      <strong>Ranklari kilitle</strong>
      <small>18 kisa cevap. Sadece baslangic guvenini ayarlar; antrenman verisine dokunmaz.</small>
    </button>
  `
}

function renderPortraitBanner(state, profile) {
  const xpCur = profile?.xp?.current ?? 0
  const xpMax = profile?.xp?.max || 1
  const xpPct = Math.max(0, Math.min(100, Math.round((xpCur / xpMax) * 100)))
  const armor = Math.round(Number(state.profile?.armor) || 0)
  const fatigue = Math.round(Number(state.profile?.fatigue) || 0)
  const liveClass = state.profile.classObj || {}
  const className = liveClass.name || profile.class
  const rank = profile.rank || 'Unranked'

  return `
    <article class="glass-card portrait-banner">
      <button class="portrait-img-frame" data-action="open-avatar" aria-label="Profili ac">
        <span>${avatarMark(profile)}</span>
        <span class="portrait-level-chip">L${profile.level}</span>
      </button>
      <div class="portrait-info">
        <div class="portrait-name">${escapeHtml(profile.nick)}</div>
        <div class="portrait-class-line">
          <span class="rank-pill">${escapeHtml(rank)}</span>
          <span>${renderExplainButton('class', className, 'explain-link metric-explain')}</span>
        </div>
        <div class="portrait-bars">
          <div class="portrait-bar-row">
            <span class="pixel-label">${renderExplainButton('xp', 'XP', 'explain-link metric-explain')}</span>
            <div class="pix-bar"><div class="pix-bar-fill" style="width:${xpPct}%"></div></div>
            <span class="bar-val">${xpCur}/${xpMax}</span>
          </div>
          <div class="portrait-bar-row">
            <span class="pixel-label">${renderExplainButton('armor', uiLabel('armor'), 'explain-link metric-explain')}</span>
            <div class="pix-bar"><div class="pix-bar-fill green" style="width:${armor}%"></div></div>
            <span class="bar-val">${armor}</span>
          </div>
          <div class="portrait-bar-row">
            <span class="pixel-label">${renderExplainButton('fatigue', uiLabel('fatigue'), 'explain-link metric-explain')}</span>
            <div class="pix-bar"><div class="pix-bar-fill red" style="width:${fatigue}%"></div></div>
            <span class="bar-val">${fatigue}</span>
          </div>
        </div>
      </div>
    </article>
  `
}

function renderTrioCards(state, profile, semantic) {
  const liveClass = state.profile.classObj || {}
  const className = liveClass.name || profile.class
  const focus = cozyDisplayText(state.profile.currentFocus || 'Karma denge')
  const nextUnlock = findNextUnlock(profile.skills || [])
  const nextUnlockHint = summarizeUnlockHint(nextUnlock, profile.skills || [])
  const focusSignal = cozyDisplayText((liveClass.signals || []).slice(0, 1).join(' / ') || `Cesitlilik ${semantic.variety || 0}`)

  return `
    <div class="trio-grid">
      <button class="trio-card" data-action="open-archetype">
        <span class="pixel-label">${escapeHtml(uiLabel('archetype'))}</span>
        <strong>${escapeHtml(className)}</strong>
        <small>${escapeHtml(cozyDisplayText(liveClass.reason || 'Aktif yol').slice(0, 36))}</small>
      </button>
      <button class="trio-card" data-action="open-focus">
        <span class="pixel-label">${escapeHtml(uiLabel('focus'))}</span>
        <strong>${escapeHtml(focus)}</strong>
        <small>${escapeHtml(focusSignal.slice(0, 36))}</small>
      </button>
      <button class="trio-card" data-action="open-unlock">
        <span class="pixel-label">${escapeHtml(uiLabel('unlock'))}</span>
        <strong>${escapeHtml(nextUnlock?.name || 'Stabil yol')}</strong>
        <small>${escapeHtml(cozyDisplayText(nextUnlockHint || 'Takipte').slice(0, 36))}</small>
      </button>
    </div>
  `
}

function renderStatGridPixel(state, profile) {
  const stats = profile.stats || []
  const latestDelta = state.workouts?.[0]?.statDelta || {}

  return `
    <article class="glass-card">
      <div class="section-top">
        <div>
          <div class="eyebrow">${renderExplainButton('combat-stats', 'Karakter Statlari', 'explain-link eyebrow-explain')}</div>
          <h3>${renderExplainButton('combat-stats', 'Karakter parametreleri', 'explain-link explain-heading')}</h3>
        </div>
      </div>
      <div class="stat-grid-pixel">
        ${stats.map(stat => renderStatPixelCard(stat, latestDelta)).join('')}
      </div>
    </article>
  `
}

function renderStatPixelCard(stat, latestDelta = {}) {
  const val = Math.round(Number(stat.val) || 0)
  const rank = stat.rank || val
  const confidence = String(stat.confidence || 'seed').toUpperCase()
  const confidenceLabel = cozyConfidenceLabel(confidence)
  const delta = Number(latestDelta?.[stat.key]) || 0
  const upFlag = delta > 0 ? `<span class="stat-pixel-flag" style="background:var(--cozy-moss)">+</span>` : ''
  const critFlag = stat.critical ? `<span class="stat-pixel-flag">F</span>` : ''
  return `
    <button class="stat-pixel stat-tone-${escapeHtml(stat.key)} ${stat.critical ? 'crit' : ''}" data-action="open-stat" data-stat-key="${escapeHtml(stat.key)}" aria-label="${escapeHtml(stat.name)} detayini ac">
      <span class="stat-pixel-icon">${escapeHtml(stat.label || stat.key || '*')}</span>
      <div class="stat-pixel-body">
        <div class="stat-pixel-row">
          <span class="pixel-label">${stat.label}</span>
          <strong>${escapeHtml(rank)}${critFlag}${upFlag}</strong>
        </div>
        <div class="stat-rank-meta">${escapeHtml(confidenceLabel)} / ham ${val}</div>
        <div class="pix-bar pix-bar-thin"><div class="pix-bar-fill ${stat.critical ? 'red' : ''}" style="width:${val}%"></div></div>
      </div>
    </button>
  `
}

function renderStatRadar(state, profile) {
  const stats = profile.stats || []
  if (!stats.length) return ''
  const order = ['str', 'agi', 'end', 'dex', 'con', 'sta']
  const ordered = order.map(key => stats.find(stat => stat.key === key)).filter(Boolean)
  if (ordered.length < 6) return ''

  const currentMap = {}
  ordered.forEach(stat => { currentMap[stat.key] = Number(stat.val) || 0 })
  const snapshot = computeProfileStatsSnapshotDaysAgo(state.workouts || [], currentMap, 30)

  const size = 220
  const cx = size / 2
  const cy = size / 2
  const radius = 78
  const ringSteps = [25, 50, 75, 100]

  const angleFor = index => (-Math.PI / 2) + (index * (2 * Math.PI / 6))
  const point = (value, index) => {
    const angle = angleFor(index)
    const r = (Math.max(0, Math.min(100, value)) / 100) * radius
    return [cx + r * Math.cos(angle), cy + r * Math.sin(angle)]
  }

  const currentPoints = ordered.map((stat, index) => point(currentMap[stat.key], index).join(',')).join(' ')
  const previousPoints = ordered.map((stat, index) => point(snapshot[stat.key], index).join(',')).join(' ')

  const axisLines = ordered.map((_, index) => {
    const [x, y] = point(100, index)
    return `<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" class="radar-axis"/>`
  }).join('')

  const rings = ringSteps.map(step => {
    const ringPoints = ordered.map((_, index) => point(step, index).join(',')).join(' ')
    return `<polygon points="${ringPoints}" class="radar-ring"/>`
  }).join('')

  const labels = ordered.map((stat, index) => {
    const [x, y] = point(118, index)
    const current = Math.round(currentMap[stat.key])
    const prev = Math.round(snapshot[stat.key])
    const delta = current - prev
    const deltaTxt = delta === 0 ? '' : (delta > 0 ? `+${delta}` : `${delta}`)
    const deltaClass = delta > 0 ? 'pos' : delta < 0 ? 'neg' : 'flat'
    return `
      <g class="radar-label">
        <text x="${x}" y="${y}" text-anchor="middle" dominant-baseline="middle" class="radar-label-key">${stat.label}</text>
        <text x="${x}" y="${y + 12}" text-anchor="middle" dominant-baseline="middle" class="radar-label-val">${stat.rank || current}</text>
        ${deltaTxt ? `<text x="${x}" y="${y + 24}" text-anchor="middle" dominant-baseline="middle" class="radar-label-delta ${deltaClass}">${deltaTxt}</text>` : ''}
      </g>
    `
  }).join('')

  const totalDelta = ordered.reduce((sum, stat) => sum + (Math.round(currentMap[stat.key]) - Math.round(snapshot[stat.key])), 0)
  const totalDeltaTxt = totalDelta === 0 ? 'Stabil' : totalDelta > 0 ? `+${totalDelta} net` : `${totalDelta} net`

  return `
    <article class="glass-card stat-radar-card">
      <div class="section-top">
        <div>
          <div class="eyebrow">${renderExplainButton('stat-radar', 'Stat Radar', 'explain-link eyebrow-explain')}</div>
          <h3>${renderExplainButton('stat-radar', 'Simdi vs 30 gun once', 'explain-link explain-heading')}</h3>
        </div>
        <div class="stat-radar-summary ${totalDelta > 0 ? 'pos' : totalDelta < 0 ? 'neg' : ''}">${totalDeltaTxt}</div>
      </div>
      <div class="stat-radar-svg-wrap">
        <svg viewBox="0 0 ${size} ${size}" class="stat-radar-svg" aria-hidden="true">
          ${rings}
          ${axisLines}
          <polygon points="${previousPoints}" class="radar-prev"/>
          <polygon points="${currentPoints}" class="radar-current"/>
          ${labels}
        </svg>
      </div>
      <div class="stat-radar-legend">
        <span><i class="dot-current"></i> Bugun</span>
        <span><i class="dot-prev"></i> 30 gun once</span>
      </div>
    </article>
  `
}

function renderSkillTreePixel(profile) {
  const branches = profile.skills || []
  if (!branches.length) return ''
  const idx = Math.max(0, Math.min(branches.length - 1, activeSkillBranch))
  const active = branches[idx] || branches[0]

  return `
    <article class="glass-card skill-pixel">
      <div class="panel-head">
        <div>
          <div class="pixel-label">${renderExplainButton('skill-tree', 'Acilim Dallari', 'explain-link metric-explain')}</div>
          <div class="panel-title">${renderExplainButton('skill-tree', 'Acilim noktalari', 'explain-link explain-heading')}</div>
        </div>
      </div>
      <div class="branch-tabs">
        ${branches.map((branch, i) => `
          <button class="branch-tab ${i === idx ? 'active' : ''} ${branch.warning ? 'warn' : ''}" data-skill-branch="${i}">
            ${escapeHtml(cozyBranchLabel(branch.branch))}
          </button>
        `).join('')}
      </div>
      <div class="skill-node-list">
        ${(active.items || []).map(renderSkillNode).join('')}
      </div>
    </article>
  `
}

function stripBranchEmoji(branchName = '') {
  return String(branchName).replace(/[^\w\s-]/g, '').trim().replace(/\s+TREE$/i, '').trim()
}

function cozyBranchLabel(branchName = '') {
  const clean = stripBranchEmoji(branchName)
  const lower = clean.toLowerCase()
  if (lower.includes('acro')) return 'Akrobatik'
  if (lower.includes('strength')) return 'Kuvvet'
  if (lower.includes('mobility')) return 'Mobilite'
  if (lower.includes('core')) return 'Govde'
  return clean || 'Dal'
}

function cozySkillSubtitle(item = {}) {
  const raw = String(item.req || item.val || '')
  return raw
    .replace(/UNLOCKED/gi, 'ACIK')
    .replace(/LOCKED/gi, 'KILITLI')
    .replace(/IN PROG/gi, 'YOLDA')
    .replace(/REQ:/gi, 'GEREK:')
    .replace(/BARANI ACIK/gi, 'BARANI ACIK')
}

function renderSkillNode(item) {
  const status = item.status || 'lock'
  const glyph = status === 'done' ? 'OK' : status === 'prog' ? '...' : 'X'
  const subtitle = cozySkillSubtitle(item)
  return `
    <div class="skill-node ${status}">
      <span class="skill-node-glyph">${glyph}</span>
      <strong>${escapeHtml(item.name)}</strong>
      <small>${escapeHtml(String(subtitle).slice(0, 24))}</small>
    </div>
  `
}

function renderQuestPixel(profile) {
  const daily = profile.quests?.daily || []
  const weekly = profile.quests?.weekly || []
  const list = activeQuestTab === 'weekly' ? weekly : daily
  const sorted = [...list].sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1
    if (a.fromClass !== b.fromClass) return a.fromClass ? -1 : 1
    return 0
  })
  const visible = sorted.slice(0, 8)

  return `
    <article class="glass-card quest-pixel">
      <div class="section-top">
        <div>
          <div class="eyebrow">${renderExplainButton('active-quests', 'Aktif Gorevler', 'explain-link eyebrow-explain')}</div>
          <h3>${renderExplainButton('active-quests', 'Gorev defteri', 'explain-link explain-heading')}</h3>
        </div>
      </div>
      <div class="quest-pixel-tabs">
        <button class="branch-tab ${activeQuestTab === 'daily' ? 'active' : ''}" data-quest-tab="daily">Gunluk ${daily.filter(q => !q.done).length}/${daily.length}</button>
        <button class="branch-tab ${activeQuestTab === 'weekly' ? 'active' : ''}" data-quest-tab="weekly">Haftalik ${weekly.filter(q => !q.done).length}/${weekly.length}</button>
      </div>
      <div class="quest-list">
        ${visible.length ? visible.map(renderQuestTicket).join('') : '<div class="today-session-empty">Aktif gorev yok.</div>'}
      </div>
    </article>
  `
}

function renderQuestTicket(quest) {
  const total = Number(quest.total) || 1
  const progress = Number(quest.progress) || 0
  const pct = Math.max(0, Math.min(100, Math.round((progress / total) * 100)))
  const sourceTag = quest.fromClass ? '<span class="quest-source class">SINIF</span>' : quest.fromCoach ? '<span class="quest-source coach">ODIE</span>' : ''
  return `
    <div class="quest-ticket ${quest.done ? 'done' : ''}${quest.fromClass ? ' class-quest' : ''}">
      <span class="quest-icon">${quest.icon || '*'}</span>
      <div class="quest-body">
        <div class="quest-title-row">
          <strong>${escapeHtml(cozyDisplayText(quest.name))}</strong>
          ${sourceTag}
        </div>
        <div class="pix-bar pix-bar-thin"><div class="pix-bar-fill ${quest.done ? 'green' : ''}" style="width:${pct}%"></div></div>
        <div class="quest-meta">
          <small>${progress}/${total}</small>
          <small class="reward">${escapeHtml(cozyDisplayText(quest.reward || ''))}</small>
        </div>
      </div>
    </div>
  `
}

function renderQuestPage(state, profile, semantic, ui = buildUiRuntime(state, profile, semantic)) {
  const nextSession = ui.nextSession
  const bodyMapState = ui.bodyMapState
  const activeQuest = ui.activeQuest
  const latestWorkout = ui.latestWorkout || null
  const arc = buildHunterArc({ state, profile, nextSession, bodyMapState, activeQuest, latestWorkout })

  return `
    <section class="quest-arc-page">
      <article class="quest-arc-hero tone-${escapeHtml(nextSession.tone || arc.decision.tone || 'calm')}">
        <div class="quest-arc-head">
          <span class="quest-arc-mark">${renderHunterIcon('target')}</span>
          <div>
            <span class="hunter-kicker">Antrenman Rotasi</span>
            <h2 class="quest-arc-title">${escapeHtml(cozyDisplayText(arc.title))}</h2>
          </div>
          <span class="quest-arc-badge">${escapeHtml(arc.rank)}</span>
        </div>
        <p class="quest-arc-copy">${escapeHtml(arc.line)}</p>
        <div class="quest-arc-fields">
          <div class="quest-arc-field">
            <span class="hunter-field-label">Bugun</span>
            <strong class="hunter-field-value">${escapeHtml(arc.chapter)}</strong>
          </div>
          <div class="quest-arc-field">
            <span class="hunter-field-label">Defter</span>
            <strong class="hunter-field-value">${escapeHtml(arc.source)}</strong>
          </div>
          <div class="quest-arc-field">
            <span class="hunter-field-label">Odul</span>
            <strong class="hunter-field-value">${escapeHtml(buildHunterRewardChips(nextSession, bodyMapState, latestWorkout)[0]?.label || '+XP')}</strong>
          </div>
        </div>
        ${renderHunterRewardChips(nextSession, bodyMapState, latestWorkout)}
      </article>
      ${renderHunterQuestLane({ state, profile, nextSession, bodyMapState, activeQuest, latestWorkout })}
      ${renderQuestPixel(profile)}
    </section>
  `
}

function findNextUnlock(skills = []) {
  for (const branch of skills) {
    const next = (branch.items || []).find(item => item.status !== 'done')
    if (next) return { ...next, branch: branch.branch }
  }
  return null
}

function summarizeUnlockHint(nextUnlock, skills = []) {
  if (!nextUnlock) return ''
  const branch = String(nextUnlock.branch || '').replace(/[^\w\s-]/g, '').trim()
  if (nextUnlock.req) return `${branch ? `${branch} / ` : ''}${String(nextUnlock.req).slice(0, 44)}`
  if (nextUnlock.status === 'prog') return `${branch ? `${branch} / ` : ''}aktif baski var`
  if (nextUnlock.desc) return String(nextUnlock.desc).slice(0, 52)
  const fallbackBranch = skills.find(item => (item.items || []).some(node => node.name === nextUnlock.name))
  return fallbackBranch ? `${String(fallbackBranch.branch || '').replace(/[^\w\s-]/g, '').trim()} / takipte` : 'Takipte'
}

/* ---------- ODIE merged page (Yorum + Sor) ---------- */

function renderOdiePage(state, profile, semantic = {}, ui = buildUiRuntime(state, profile, semantic)) {
  const nextSession = ui.nextSession
  const panelModules = ensureOdiePanelsLoaded()
  const coachProfile = {
    ...profile,
    profile: state.profile,
    workouts: state.workouts || [],
    dailyLogs: state.dailyLogs || [],
    athleteMemory: state.athleteMemory || [],
    memoryFeedback: state.memoryFeedback || [],
    health: state.health || {},
    healthStatus: state.healthStatus || null,
    healthDailySummary: state.healthDailySummary || null,
    bodyEvents: state.bodyEvents || [],
    armor: state.profile?.armor,
    fatigue: state.profile?.fatigue,
    injuryUntil: state.profile?.injuryUntil,
    consecutiveHeavy: state.profile?.consecutiveHeavy,
    survivalWarnings: state.profile?.survivalWarnings || [],
  }

  return `
    <section class="odie-page">
      ${renderOdieCommandRoom(state, profile, nextSession, ui.bodyMapState)}
      ${renderOdieHallmark(nextSession)}
      <div class="odie-switcher">
        <button class="odie-switcher-btn ${odieMode === 'coach' ? 'active' : ''}" data-odie-mode="coach">YORUM</button>
        <button class="odie-switcher-btn ${odieMode === 'ask' ? 'active' : ''}" data-odie-mode="ask">SOR</button>
      </div>

      ${!panelModules ? `
        <article class="coach-terminal odie-loading-panel">
          <div class="coach-header">
            <div class="coach-avatar">OD</div>
            <div class="coach-npc-info">
              <div class="coach-npc-name">ODIE</div>
              <div class="coach-npc-sub">defteri aciliyor</div>
            </div>
          </div>
          <div class="modal-coach">Kisa bir nefes. Oda hazirlaniyor.</div>
        </article>
      ` : odieMode === 'coach' ? `
        <div class="coach-shell">
          ${panelModules.renderCoach(coachProfile)}
        </div>
      ` : panelModules.renderAsk(state, profile)}
    </section>
  `
}

function renderOdieCommandRoom(state, profile, nextSession = {}, bodyMapState = state.bodyMapState || {}) {
  const goal = nextSession.primaryGoal || {}
  const readinessValue = Number(nextSession.readiness?.score ?? state.health?.readiness?.score)
  const readiness = Number.isFinite(readinessValue) ? Math.round(readinessValue) : '--'
  const armor = Math.round(Number(state.profile?.armor) || 0)
  const fatigue = Math.round(Number(state.profile?.fatigue) || 0)
  const hevy = nextSession.sourceHealth || {}
  const latestHevy = hevy.latestHevyDate ? formatMonthShort(hevy.latestHevyDate) : 'sync bekliyor'
  const confidence = Number(nextSession.confidence)
  const confidenceLabel = Number.isFinite(confidence) ? `${Math.round(confidence)}%` : '--'
  const warning = cozyDisplayText(nextSession.warnings?.[0] || state.profile?.survivalWarnings?.[0] || 'Risk sinyali yok')
  const command = cozyDisplayText(nextSession.coachCommand || goal.subtitle || 'Veri geldikce komut netlesir.')
  const presence = buildOdiePresence({ state, profile, nextSession })
  const hunterLine = buildHunterOdieLine({
    state,
    nextSession,
    bodyMapState,
    decision: buildTodayDecision(state),
  })

  return `
    <article class="odie-command-room tone-${nextSession.tone || 'calm'}">
      <div class="odie-room-top">
        <div class="odie-room-mark" aria-hidden="true"><i></i><b></b></div>
        <div>
          <span>ODIE Odasi</span>
          <h2>${escapeHtml(cozyDisplayText(goalTitle(goal) || 'Bugunku karar'))}</h2>
        </div>
      </div>

      <section class="odie-room-chat">
        <span>${escapeHtml(presence.moodLabel || 'hazir mod')}</span>
        <p>${escapeHtml(cozyDisplayText(hunterLine || presence.chatLine || command))}</p>
      </section>

      <p class="odie-room-order">${escapeHtml(compactText(cozyDisplayText(command), 118))}</p>

      <div class="odie-room-grid">
        ${renderRevMeter('readiness', uiLabel('readiness'), readiness, 'xp')}
        ${renderRevMeter('armor', uiLabel('armor'), armor, 'armor')}
        ${renderRevMeter('fatigue', uiLabel('fatigue'), fatigue, 'fatigue')}
      </div>

      ${renderOdieMemoryChips(presence.memoryCards || [])}

      <div class="odie-room-signals">
        <span>${renderExplainButton('hevy-live', `HEVY ${latestHevy}`, 'explain-link metric-explain')}</span>
        <span>${renderExplainButton('confidence', `${uiLabel('confidence')} ${confidenceLabel}`, 'explain-link metric-explain')}</span>
        <span>${escapeHtml(cozyDisplayText(warning))}</span>
      </div>
    </article>
  `
}

function renderOdieHallmark(nextSession = {}) {
  const goal = nextSession.primaryGoal || {}
  const hevy = nextSession.sourceHealth || {}
  const latestHevy = hevy.latestHevyDate ? formatMonthShort(hevy.latestHevyDate) : 'sync bekliyor'
  const confidence = Number(nextSession.confidence)
  const confidenceLabel = Number.isFinite(confidence) ? `${Math.round(confidence)}%` : '--'

  return `
    <article class="odie-hallmark tone-${nextSession.tone || 'calm'}">
      <div class="odie-hallmark-main">
        <span>ODIE Not Defteri</span>
        <h2>${escapeHtml(cozyDisplayText(goalTitle(goal) || 'Bugunku karar'))}</h2>
        <p>${escapeHtml(cozyDisplayText(nextSession.coachCommand || goal.subtitle || 'Veri geldikce komut netlesir.'))}</p>
      </div>
      <div class="odie-hallmark-meta">
        <div><span>HEVY</span><strong>${escapeHtml(latestHevy)}</strong></div>
        <div><span>${escapeHtml(uiLabel('confidence'))}</span><strong>${confidenceLabel}</strong></div>
      </div>
    </article>
  `
}

function renderBodyEventForm(region) {
  const today = getLocalDateString()
  const clearAt = new Date(`${today}T00:00:00`)
  clearAt.setDate(clearAt.getDate() + 6)
  return `
    <form class="body-event-form" id="body-event-form">
      <div class="body-event-title">
        <span>Beden kaydi</span>
        <strong>${escapeHtml(region?.label || 'Bolge')} icin ODIE notu</strong>
      </div>
      <div class="body-event-grid">
        <label>
          <span>Bolge</span>
          <select name="region">
            ${BODY_REGION_OPTIONS.map(item => `<option value="${escapeHtml(item.id)}" ${item.id === region?.id ? 'selected' : ''}>${escapeHtml(item.label)}</option>`).join('')}
          </select>
        </label>
        <label>
          <span>Tip</span>
          <select name="kind">
            <option value="injury">Sakatlik</option>
            <option value="pain">Agri</option>
            <option value="tightness">Tutukluk</option>
            <option value="rehab">Rehab</option>
          </select>
        </label>
        <label>
          <span>Taraf</span>
          <select name="side">
            <option value="unknown">Belirsiz</option>
            <option value="left">Sol</option>
            <option value="right">Sag</option>
            <option value="both">Iki taraf</option>
          </select>
        </label>
        <label>
          <span>Siddet 1-5</span>
          <input name="severity" type="number" min="1" max="5" value="3">
        </label>
        <label>
          <span>Toparlanma %</span>
          <input name="recoveryPercent" type="number" min="0" max="100" value="${region?.injury?.recoveryPct ?? 70}">
        </label>
        <label>
          <span>Tahmini temiz gun</span>
          <input name="expectedClearAt" type="date" value="${getLocalDateString(clearAt)}">
        </label>
      </div>
      <label class="body-event-note">
        <span>Not</span>
        <textarea name="note" rows="3" placeholder="Orn: bilek kas temelli, agir grip ve itis temkinli...">${escapeHtml(cozyDisplayText(region?.injury?.note || ''))}</textarea>
      </label>
      <button class="modal-primary-action" type="submit">Beden kaydini yaz</button>
    </form>
  `
}

function shortcutCodeBlock(id, title, body, note = '') {
  return `
    <div class="shortcut-code-card">
      <div class="shortcut-code-head">
        <strong>${escapeHtml(title)}</strong>
        <button type="button" data-copy-target="${escapeHtml(id)}">Kopyala</button>
      </div>
      ${note ? `<p>${escapeHtml(note)}</p>` : ''}
      <pre><code id="${escapeHtml(id)}">${escapeHtml(body)}</code></pre>
    </div>
  `
}

function shortcutPayloadExamples() {
  const testActivity = JSON.stringify({
    kind: 'activity_day',
    samples: [{
      externalId: 'test-activity-2026-05-22',
      day: '2026-05-22',
      steps: 12000,
      walkingDistanceKm: 9.4,
      activeEnergyKcal: 620,
      exerciseMinutes: 78,
      flightsClimbed: 8,
    }],
  }, null, 2)

  const workoutEnd = JSON.stringify({
    kind: 'workout',
    samples: [{
      externalId: 'workout-{{startAt}}',
      activityType: 'Hiking',
      startAt: '{{startAt ISO}}',
      endAt: '{{endAt ISO}}',
      durationMin: '{{duration min}}',
      distanceKm: '{{distance km}}',
      steps: '{{steps}}',
      elevationM: '{{elevation m}}',
      activeEnergyKcal: '{{active kcal}}',
      avgHeartRate: '{{avg bpm}}',
      maxHeartRate: '{{max bpm}}',
      routeName: 'Apple Watch',
    }],
  }, null, 2)

  const morningSync = JSON.stringify({
    samples: [
      {
        kind: 'sleep',
        externalId: 'sleep-{{day}}',
        day: '{{yyyy-mm-dd}}',
        sleepStartAt: '{{sleep start ISO}}',
        sleepEndAt: '{{sleep end ISO}}',
        totalSleepHours: '{{asleep hours}}',
        deepSleepHours: '{{deep hours}}',
        remSleepHours: '{{rem hours}}',
        coreSleepHours: '{{core hours}}',
        awakeMinutes: '{{awake minutes}}',
      },
      {
        kind: 'heart',
        externalId: 'heart-{{day}}',
        day: '{{yyyy-mm-dd}}',
        restingHeartRate: '{{resting bpm}}',
        hrvSdnn: '{{hrv ms}}',
        walkingHeartRateAverage: '{{walking bpm}}',
      },
    ],
  }, null, 2)

  const nightSync = JSON.stringify({
    kind: 'activity_day',
    samples: [{
      externalId: 'activity-{{day}}',
      day: '{{yyyy-mm-dd}}',
      steps: '{{steps}}',
      walkingDistanceKm: '{{walking-running distance km}}',
      activeEnergyKcal: '{{active kcal}}',
      exerciseMinutes: '{{exercise minutes}}',
      flightsClimbed: '{{flights climbed}}',
      standHours: '{{stand hours}}',
    }],
  }, null, 2)

  return { testActivity, workoutEnd, morningSync, nightSync }
}

function openHealthShortcutModal() {
  const origin = window.location.origin
  const endpoint = `${origin}/api/health-import`
  const authHeader = 'Bearer <HEALTH_IMPORT_TOKEN>'
  const examples = shortcutPayloadExamples()
  openModal(`
    <div class="modal-head">
      <span style="font-size:18px">APL</span>
      <div class="modal-head-title">Apple Health Kestirme Kurulumu</div>
      <button class="modal-close" data-close-modal aria-label="Kapat">x</button>
    </div>
    <div class="modal-body health-shortcut-modal">
      <section class="shortcut-hero">
        <span>Bilal modu</span>
        <strong>iPhone veriyi toplar, OdiePt'ye POST atar.</strong>
        <p>Telefonunda 3 kestirme kuracagiz. Sabah uyku+nabiz, antrenman bitince seans, gece gunluk hareket gider. Odie bunlari XP, yorgunluk, toparlanma ve bugunun rotasina katar.</p>
        <a href="shortcuts://create-shortcut" class="shortcut-open-link">Kestirmeler'i ac</a>
      </section>

      <div class="shortcut-field-grid">
        <div class="shortcut-field">
          <span>URL</span>
          <strong>${escapeHtml(endpoint)}</strong>
          <button type="button" data-copy-value="${escapeHtml(endpoint)}">URL kopyala</button>
        </div>
        <div class="shortcut-field">
          <span>Authorization header</span>
          <strong>${escapeHtml(authHeader)}</strong>
          <button type="button" data-copy-value="${escapeHtml(authHeader)}">Header kopyala</button>
        </div>
      </div>

      <div class="shortcut-warning">
        <strong>Token kurali</strong>
        <span>HEALTH_IMPORT_TOKEN gizli sifredir. Site bunu gostermez; Vercel env'deki token neyse telefondaki header'a onu yazacaksin. Yanlis token = 401.</span>
      </div>

      <section class="shortcut-step-card">
        <span>1</span>
        <div>
          <strong>Once kuru test yap</strong>
          <p>Kestirmeler > + > URL ekle. URL'ye endpoint'i yapistir. Sonra "URL Icerigini Al" ekle, method POST yap, headers'a Authorization ve Content-Type yaz, body'ye bu test JSON'unu koy. Calisinca cevapta <b>ok: true</b> gorursen kapi acik.</p>
        </div>
      </section>
      ${shortcutCodeBlock('shortcut-test-activity-json', 'Ilk test JSON', examples.testActivity, 'Bunu ilk denemede elle gonder. Sonra dinamik Health verisine gececegiz.')}

      <section class="shortcut-step-card">
        <span>2</span>
        <div>
          <strong>HTTP kismini her kestirmede ayni kur</strong>
          <p>Action adi: <b>URL Icerigini Al</b>. Show More ac. Method POST. Request Body JSON. Headers: Authorization = Bearer token, Content-Type = application/json.</p>
        </div>
      </section>

      <div class="shortcut-http-grid">
        <div><b>Method</b><strong>POST</strong></div>
        <div><b>Header 1</b><strong>Authorization</strong><small>${escapeHtml(authHeader)}</small></div>
        <div><b>Header 2</b><strong>Content-Type</strong><small>application/json</small></div>
        <div><b>Body</b><strong>JSON</strong><small>Dictionary veya Text JSON</small></div>
      </div>

      <div class="shortcut-rhythm-grid">
        <section class="shortcut-rhythm-card">
          <span>Sabah Izi</span>
          <strong>Uyku + kalp</strong>
          <p>Sabah 08:00 otomasyonu. Health'ten Sleep Analysis, Resting Heart Rate ve HRV SDNN bul. Degerleri JSON'daki ilgili yerlere Magic Variable olarak bagla.</p>
        </section>
        <section class="shortcut-rhythm-card">
          <span>Antrenman Sonu</span>
          <strong>Antrenman bitince</strong>
          <p>Apple Watch antrenman bitti tetikleyicisi. Son seansi bul; tip, baslangic, bitis, sure, mesafe, kalori, nabiz ve varsa yukseltiyi gonder.</p>
        </section>
        <section class="shortcut-rhythm-card">
          <span>Gece Izi</span>
          <strong>Gun ozeti</strong>
          <p>23:30 otomasyonu. Adim, yurume/kosma mesafesi, aktif enerji, egzersiz dakikasi, kat/yukselti gibi gunluk hareketi yollar.</p>
        </section>
      </div>

      ${shortcutCodeBlock('shortcut-morning-json', 'Sabah izi sablonu', examples.morningSync, 'Uyku ve kalp degerlerini Apple Health sample sonucundan doldur.')}
      ${shortcutCodeBlock('shortcut-workout-json', 'Antrenman sonu sablonu', examples.workoutEnd, '12 km doga yuruyusu gibi aktiviteler buradan Odie seansi olarak duser.')}
      ${shortcutCodeBlock('shortcut-night-json', 'Gece izi sablonu', examples.nightSync, 'Antrenman sayilmayan gunluk hareket bile yorgunluk ve XP hesabina girer.')}

      <section class="shortcut-step-card">
        <span>3</span>
        <div>
          <strong>Son kontrol</strong>
          <p>Kestirme calisinca sitede Karakter > Canli Defterler kartina bak. Apple Uyku, Apple Kalp veya Apple Antrenman "baglandi" olduysa veri sisteme girdi. 401 token yanlis, 503 migration eksik, bos cevap Health izni eksik demek.</p>
        </div>
      </section>

      <div class="modal-coach">ODIE ham veriyi hafiza coplugune yazmaz. Ham Apple verisi ledger'da kalir; hafizaya sadece "az uyku PR'i dusuruyor" gibi anlamli pattern girer.</div>
    </div>
  `)
}

function openBodyRegionModal(regionId) {
  const state = store.getState()
  const profile = store.getProfile()
  const semantic = getSemanticProfile(state.workouts || [], state.dailyLogs || [])
  const bodyMapState = state.bodyMapState || buildBodyMapState({ state, profile, semantic })
  const region = regionById(bodyMapState, regionId) || bodyMapState.priority?.region
  if (!region) return
  const linkedLines = (bodyMapState.movementLines || [])
    .filter(line => (line.linkedRegions || []).includes(region.id))
    .slice(0, 3)
  const linkedUnlocks = (bodyMapState.unlockTargets || [])
    .filter(target => (target.linkedRegions || []).includes(region.id))
    .slice(0, 3)
  const quest = bodyMapState.dailyQuest

  openModal(`
    <div class="modal-head">
      <span style="font-size:18px">MAP</span>
      <div class="modal-head-title">${escapeHtml(region.label)} Hatti</div>
      <button class="modal-close" data-close-modal aria-label="Kapat">x</button>
    </div>
    <div class="modal-body body-region-modal">
      <div class="region-score-grid">
        <div><span>Yuk</span><strong>${Math.round(region.load)}</strong></div>
        <div><span>Toparlanma</span><strong>${Math.round(region.recovery)}</strong></div>
        <div><span>Dikkat</span><strong>${Math.round(region.risk)}</strong></div>
      </div>
      ${region.injury ? `
        <div class="region-injury-note">
          <span>Sakatlik notu</span>
          <strong>${escapeHtml(region.injury.label || region.label)}</strong>
          <small>${escapeHtml(region.injury.tissue || 'Kas temelli')} / %${Math.round(region.injury.recoveryPct ?? 0)} toparlandi / ${Math.round(region.injury.etaDays ?? 0)} gun</small>
        </div>
      ` : ''}
      <div class="modal-coach">${escapeHtml(cozyDisplayText(region.source || 'Canli veri bekleniyor.'))}</div>
      ${linkedLines.length ? `
        <div class="region-modal-list">
          <strong>Hareket hattı</strong>
          ${linkedLines.map(line => `<span>${escapeHtml(line.label)}: %${Math.round(line.progress)} / ${escapeHtml(line.todayStep)}</span>`).join('')}
        </div>
      ` : ''}
      ${linkedUnlocks.length ? `
        <div class="region-modal-list">
          <strong>Açılıma etkisi</strong>
          ${linkedUnlocks.map(target => `<span>${escapeHtml(target.name)}: %${Math.round(target.progress)} / ${escapeHtml(target.missing)}</span>`).join('')}
        </div>
      ` : ''}
      ${quest ? `
        <div class="region-modal-quest">
          <span>Bugünkü ara görev</span>
          <strong>${escapeHtml(quest.name)}</strong>
          <small>${escapeHtml(cozyDisplayText(quest.why || quest.desc || ''))}</small>
        </div>
      ` : ''}
      ${renderBodyEventForm(region)}
    </div>
  `)
  bindBodyEventForm()
}

function bindBodyEventForm() {
  const form = document.getElementById('body-event-form')
  if (!form) return
  form.addEventListener('submit', async event => {
    event.preventDefault()
    const submit = form.querySelector('button[type="submit"]')
    if (submit) {
      submit.disabled = true
      submit.textContent = 'Kaydediliyor...'
    }
    const data = new FormData(form)
    try {
      const saved = await store.addBodyEvent({
        kind: data.get('kind'),
        region: data.get('region'),
        side: data.get('side'),
        severity: Number(data.get('severity')) || 3,
        recoveryPercent: Number(data.get('recoveryPercent')) || 0,
        expectedClearAt: data.get('expectedClearAt'),
        note: String(data.get('note') || '').trim(),
        source: 'manual',
        status: 'active',
      })
      closeModal()
      showToast({
        icon: 'BODY',
        title: 'Beden kaydi yazildi',
        msg: saved.odieInterpretation?.command || 'ODIE bu bolgeyi bugunku karara dahil edecek.',
        rarity: 'rare',
        duration: 3200,
      })
      window.__refreshActivePanel?.()
    } catch (error) {
      console.error('[body-event-form] save error:', error)
      if (submit) {
        submit.disabled = false
        submit.textContent = 'Beden kaydini yaz'
      }
    }
  })
}

/* ---------- Init dispatch ---------- */

function initActivePage(tabKey, profile) {
  switch (tabKey) {
    case 'today':
      break
    case 'character':
      initDailyChecklist()
      break
    case 'odie':
      if (!_odiePanelModules) {
        ensureOdiePanelsLoaded()
        break
      }
      if (odieMode === 'coach') _odiePanelModules.initCoach(profile)
      else _odiePanelModules.initAsk(profile)
      break
  }
}

function notifyCopied(ok) {
  showToast({
    icon: ok ? 'OK' : '!',
    title: ok ? 'Kopyalandi' : 'Kopyalama olmadi',
    msg: ok ? 'Simdi Kestirmeler alanina yapistir.' : 'Metni elle secip kopyala.',
    rarity: 'common',
    duration: 1800,
  })
}

function fallbackCopyText(text) {
  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.setAttribute('readonly', '')
  textarea.style.position = 'fixed'
  textarea.style.left = '-9999px'
  textarea.style.opacity = '0'
  document.body.appendChild(textarea)
  textarea.select()
  let ok = false
  try {
    ok = document.execCommand('copy')
  } catch {
    ok = false
  }
  textarea.remove()
  notifyCopied(ok)
}

function copyShortcutText(text) {
  const value = String(text || '').trim()
  if (!value) return
  if (navigator.clipboard?.writeText) {
    let settled = false
    const fallbackTimer = window.setTimeout(() => {
      if (settled) return
      settled = true
      fallbackCopyText(value)
    }, 450)
    navigator.clipboard.writeText(value)
      .then(() => {
        if (settled) return
        settled = true
        window.clearTimeout(fallbackTimer)
        notifyCopied(true)
      })
      .catch(() => {
        if (settled) return
        settled = true
        window.clearTimeout(fallbackTimer)
        fallbackCopyText(value)
      })
    return
  }
  fallbackCopyText(value)
}

/* ---------- Global click handler ---------- */

document.addEventListener('click', event => {
  const copyValueBtn = event.target.closest('[data-copy-value]')
  if (copyValueBtn) {
    event.preventDefault()
    copyShortcutText(copyValueBtn.dataset.copyValue || '')
    return
  }

  const copyTargetBtn = event.target.closest('[data-copy-target]')
  if (copyTargetBtn) {
    event.preventDefault()
    const target = document.getElementById(copyTargetBtn.dataset.copyTarget)
    copyShortcutText(target?.textContent || '')
    return
  }

  const explainBtn = event.target.closest('[data-explain]')
  if (explainBtn) {
    event.preventDefault()
    event.stopPropagation()
    openExplainModal(explainBtn.dataset.explain)
    return
  }

  const odieBtn = event.target.closest('[data-odie-mode]')
  if (odieBtn) {
    odieMode = odieBtn.dataset.odieMode
    scheduleRender({ immediate: true })
    return
  }

  const branchBtn = event.target.closest('[data-skill-branch]')
  if (branchBtn) {
    activeSkillBranch = Number(branchBtn.dataset.skillBranch) || 0
    scheduleRender({ immediate: true })
    return
  }

  const questBtn = event.target.closest('[data-quest-tab]')
  if (questBtn) {
    activeQuestTab = questBtn.dataset.questTab
    scheduleRender({ immediate: true })
    return
  }

  const tab = event.target.closest('[data-tab]')
  if (tab) {
    closeModal()
    activeTab = tab.dataset.tab
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'auto' })
    scheduleRender({ immediate: true })
    return
  }

  const action = event.target.closest('[data-action]')?.dataset.action
  if (!action) return

  if (action === 'open-avatar') {
    openAvatarModal(store.getProfile())
    return
  }

  if (action === 'open-body-region') {
    const regionId = event.target.closest('[data-region-id]')?.dataset.regionId
    openBodyRegionModal(regionId || 'core')
    return
  }

  if (action === 'open-workout') {
    openWorkoutFormLazy().catch(() => {
      showToast({ icon: '!', title: 'Form acilmadi', msg: 'Seans formu yuklenirken takildi.', rarity: 'common' })
    })
    return
  }

  if (action === 'open-walk-form') {
    openWorkoutFormLazy({
      type: 'Yuruyus',
      distanceKm: 12,
      durationMin: 150,
      elevationM: 0,
      highlight: 'Doga yuruyusu',
      notes: 'Apple Health baglanana kadar manuel hizli kayit.',
    }).catch(() => {
      showToast({ icon: '!', title: 'Form acilmadi', msg: 'Yuruyus formu yuklenirken takildi.', rarity: 'common' })
    })
    return
  }

  if (action === 'open-health-shortcut') {
    openHealthShortcutModal()
    return
  }

  if (action === 'open-session-detail') {
    const id = event.target.closest('[data-workout-id]')?.dataset.workoutId
    const state = store.getState()
    const workout = (state.workouts || []).find(item => String(item.id) === String(id))
    openSessionDetailModal(workout, state)
    return
  }

  if (action === 'delete-workout') {
    const id = event.target.closest('[data-workout-id]')?.dataset.workoutId
    if (!id) return
    const ok = window.confirm('Bu seansi silmek istiyor musun? Geri alinamaz.')
    if (!ok) return
    store.deleteWorkout(id).then(success => {
      if (success) showToast({ icon: 'OK', title: 'Seans silindi', msg: 'Stat ve XP yeniden hesaplandi.', rarity: 'common', duration: 2200 })
      else showToast({ icon: '!', title: 'Silme basarisiz', msg: 'Seans bulunamadi veya senkronlanamadi.', rarity: 'common' })
    })
    return
  }

  if (action === 'open-archetype') {
    const state = store.getState()
    const profile = store.getProfile()
    const semantic = getSemanticProfile(state.workouts || [], state.dailyLogs || [])
    const criticalStat = (profile.stats || []).find(stat => stat.critical)
    openArchetypeModal({
      classObj: state.profile.classObj || {},
      profile,
      semantic,
      criticalStat,
    })
    return
  }

  if (action === 'open-focus') {
    const state = store.getState()
    const profile = store.getProfile()
    const semantic = getSemanticProfile(state.workouts || [], state.dailyLogs || [])
    const criticalStats = (profile.stats || []).filter(stat => stat.critical)
    openFocusModal({
      focus: state.profile.currentFocus || profile.currentFocus || 'Hybrid denge',
      classObj: state.profile.classObj || {},
      criticalStats,
      semantic,
      profile: { ...profile, streak: state.profile.streak },
    })
    return
  }

  if (action === 'open-stat') {
    const key = event.target.closest('[data-stat-key]')?.dataset.statKey
    const profile = store.getProfile()
    const stat = (profile.stats || []).find(item => String(item.key) === String(key))
    if (stat) openStatModal({ ...stat, icon: stat.label || stat.key || 'ST' })
    return
  }

  if (action === 'open-stat-calibration') {
    const state = store.getState()
    openStatCalibrationModal({
      calibration: state.profile?.calibration || {},
      onSave: async calibration => {
        await store.saveStatCalibration(calibration)
        showToast({ icon: 'RANK', title: 'Kalibrasyon kaydedildi', msg: 'Rank guveni yeniden hesaplandi.', rarity: 'rare', duration: 2400 })
      },
    })
    return
  }

  if (action === 'open-unlock') {
    const state = store.getState()
    const profile = store.getProfile()
    const semantic = getSemanticProfile(state.workouts || [], state.dailyLogs || [])
    const bodyMapState = state.bodyMapState || buildBodyMapState({ state, profile, semantic })
    const nextUnlock = bodyMapState?.unlockTargets?.[0] || findNextUnlock(profile.skills || [])
    openUnlockModal({
      nextUnlock,
      skills: profile.skills || [],
      profile,
    })
    return
  }
})
