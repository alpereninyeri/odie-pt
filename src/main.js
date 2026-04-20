import './style.css'
import { store } from './data/store.js'
import { formatMonthShort } from './data/rules.js'
import { buildSemanticProfile } from './data/semantic-profile.js'
import { renderStats, initStats } from './components/panel-stats.js'
import { renderSkills, initSkills } from './components/panel-skills.js'
import { renderQuests, initQuests } from './components/panel-quests.js'
import { renderCoach, initCoach } from './components/panel-coach.js'
import { renderHealth } from './components/panel-health.js'
import { initModal, closeModal, openAvatarModal, openArchetypeModal, openFocusModal, openUnlockModal } from './components/modal.js'
import { injectToastStyles, showToast } from './components/toast.js'
import { initTelegramMiniApp } from './data/telegram-webapp.js'

const tabs = [
  { key: 'dashboard', label: 'Home', icon: 'home' },
  { key: 'progress', label: 'Stats', icon: 'chart' },
  { key: 'training', label: 'Missions', icon: 'target' },
  { key: 'coach', label: 'ODIE', icon: 'pulse' },
]

let activeTab = 'dashboard'

injectToastStyles()
initTheme()
initTelegramMiniApp()

store.init().then(() => {
  renderApp()

  store.subscribe('*', () => {
    renderApp()
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
      title: 'ODIE raporu geldi',
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

function renderApp() {
  const state = store.getState()
  const profile = store.getProfile()
  const semantic = buildSemanticProfile(state.workouts || [], state.dailyLogs || [])

  document.getElementById('app').innerHTML = `
    <div class="modal-bg" id="statModal">
      <div class="modal" id="modalContent"></div>
    </div>

    ${renderMobileHud(state, profile)}

    <div class="app-shell app-shell-v6">
      <aside class="app-nav glass-card">
        <div class="nav-brand">
          <div class="nav-brand-mark">${profile.avatar}</div>
          <div>
            <div class="nav-brand-title">OdiePT</div>
            <div class="nav-brand-sub">${state.profile.classObj?.name || profile.class}</div>
          </div>
        </div>

        <nav class="nav-list">
          ${tabs.map(tab => renderNavButton(tab, activeTab === tab.key)).join('')}
        </nav>

        <div class="nav-status glass-subtle">
          <div class="mini-label">Current Focus</div>
          <div class="nav-status-title">${state.profile.currentFocus || 'Hybrid denge'}</div>
          <div class="nav-status-sub">${Number(state.health?.readiness?.score) || '--'}/100 readiness</div>
        </div>
      </aside>

      <main class="app-main">
        <header class="topbar">
          <div>
            <div class="eyebrow">${tabs.find(tab => tab.key === activeTab)?.label || 'Home'}</div>
            <h1 class="page-title">${pageTitle(activeTab, profile)}</h1>
          </div>
          <div class="topbar-actions">
            <button class="avatar-chip" data-action="open-avatar" aria-label="Profili ac">
              <span class="avatar-chip-icon">${profile.avatar}</span>
              <span>${profile.nick}</span>
            </button>
          </div>
        </header>

        <section class="page-content">
          ${renderPage(activeTab, state, profile, semantic)}
        </section>
      </main>
    </div>

    <nav class="bottom-tabs glass-card">
      ${tabs.map(tab => renderNavButton(tab, activeTab === tab.key, true)).join('')}
    </nav>
  `

  initModal()
  initActivePage(activeTab, profile)
  window.__refreshActivePanel = () => renderApp()
}

function pageTitle(tabKey, profile) {
  switch (tabKey) {
    case 'dashboard':
      return `${profile.nick} Character Sheet`
    case 'progress':
      return 'Stats and Performance'
    case 'training':
      return 'Missions and Sessions'
    case 'coach':
      return 'ODIE Coach'
    default:
      return profile.nick
  }
}

function renderMobileHud(state, profile) {
  const xpCur = profile?.xp?.current ?? 0
  const xpMax = profile?.xp?.max || 1
  const pct = Math.max(0, Math.min(100, Math.round((xpCur / xpMax) * 100)))
  const level = profile.level ?? '-'
  const readiness = state.health?.readiness?.score
  const streak = state.profile?.streak?.current ?? 0

  return `
    <div class="mobile-hud mobile-hud-v6">
      <button class="mobile-hud-avatar" data-action="open-avatar" aria-label="Profili ac">${profile.avatar}</button>
      <div class="mobile-hud-center">
        <div class="mobile-hud-nick">${profile.nick}<span>L${level}</span></div>
        <div class="mobile-hud-xpbar"><div class="mobile-hud-xpfill" style="width:${pct}%"></div></div>
      </div>
      <div class="mobile-hud-side">
        <strong>${Number.isFinite(readiness) ? readiness : streak}</strong>
        <small>${Number.isFinite(readiness) ? 'ready' : 'streak'}</small>
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
    case 'chart':
      return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 19V9h3v10zm5 0V5h3v14zm5 0v-7h3v7z"/></svg>`
    case 'target':
      return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3a9 9 0 1 0 9 9h-2.2A6.8 6.8 0 1 1 12 5.2zm0 3.2a5.8 5.8 0 1 0 5.8 5.8h-2a3.8 3.8 0 1 1-3.8-3.8zm0 2.8a3 3 0 1 0 3 3h-1.8A1.2 1.2 0 1 1 12 10.2z"/></svg>`
    case 'pulse':
      return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12h4l2-4 3 9 2-5h7"/></svg>`
    default:
      return kind
  }
}

function renderPage(tabKey, state, profile, semantic) {
  switch (tabKey) {
    case 'dashboard':
      return renderHomeV6(state, profile, semantic)
    case 'progress':
      return renderProgressV6(state, profile, semantic)
    case 'training':
      return renderTrainingV6(state, profile, semantic)
    case 'coach':
      return renderCoachPageV6(state, profile)
    default:
      return ''
  }
}

function renderHomeV6(state, profile, semantic) {
  return `
    <section class="surface-stack home-v6">
      ${renderCharacterSheet(state, profile, semantic)}

      <div class="home-quick-grid">
        ${renderLastSessionCard(state)}
        ${renderCurrentQuestCard(profile)}
        ${renderRecoveryCard(state, profile)}
        ${renderRecentWinCard(state, profile)}
      </div>
    </section>
  `
}

function renderCharacterSheet(state, profile, semantic) {
  const stats = profile.stats || []
  const left = stats.filter(stat => ['str', 'agi', 'end'].includes(stat.key))
  const right = stats.filter(stat => ['dex', 'con', 'sta'].includes(stat.key))
  const liveClass = state.profile.classObj || {}
  const nextUnlock = findNextUnlock(profile.skills || [])
  const nextUnlockHint = summarizeUnlockHint(nextUnlock, profile.skills || [])
  const rank = profile.rank || 'Unranked'
  const focus = state.profile.currentFocus || 'Hybrid denge'
  const latestDelta = state.workouts?.[0]?.statDelta || {}

  return `
    <article class="glass-card character-sheet-card">
      <div class="character-sheet-top">
        <div>
          <div class="eyebrow">Character Sheet</div>
          <h2>${profile.nick}</h2>
        </div>
        <div class="character-sheet-badges">
          <span class="sheet-chip rank">${rank}</span>
          <span class="sheet-chip level">L${profile.level}</span>
        </div>
      </div>

      <div class="character-sheet-body">
        <div class="stat-rail stat-rail-left">
          ${left.map(stat => renderSheetStat(stat, latestDelta)).join('')}
        </div>

        <div class="portrait-core">
          <button class="portrait-frame" data-action="open-avatar" aria-label="Profili ac">${profile.avatar}</button>
          <div class="portrait-meta">
            <strong>${liveClass.name || profile.class}</strong>
            <span>${profile.subClass}</span>
          </div>
        </div>

        <div class="stat-rail stat-rail-right">
          ${right.map(stat => renderSheetStat(stat, latestDelta)).join('')}
        </div>
      </div>

      <div class="character-sheet-footer">
        <button class="sheet-info-card" data-action="open-archetype" aria-label="Archetype detayı">
          <span class="mini-label">Archetype</span>
          <strong>${liveClass.name || profile.class}</strong>
          <small>${liveClass.reason || 'Current build kimligi aktif seanslardan okunur.'}</small>
        </button>
        <button class="sheet-info-card" data-action="open-focus" aria-label="Focus detayı">
          <span class="mini-label">Current Focus</span>
          <strong>${focus}</strong>
          <small>${(liveClass.signals || []).slice(0, 2).join(' / ') || 'Yeni sinyal bekleniyor'}</small>
        </button>
        <button class="sheet-info-card" data-action="open-unlock" aria-label="Next Unlock detayı">
          <span class="mini-label">Next Unlock</span>
          <strong>${nextUnlock?.name || 'Stable Build'}</strong>
          <small>${nextUnlockHint || `Variety ${semantic.variety || 0}`}</small>
        </button>
      </div>
    </article>
  `
}

function renderSheetStat(stat, latestDelta = {}) {
  const delta = Number(latestDelta?.[stat.key]) || 0
  return `
    <button class="sheet-stat ${stat.critical ? 'critical' : ''}" data-tab="progress" aria-label="${stat.name} detay">
      <span class="sheet-stat-key">${stat.label}</span>
      <div class="sheet-stat-main">
        <strong>${Math.round(Number(stat.val) || 0)}</strong>
        ${renderStatDelta(delta, stat.critical)}
      </div>
      <small>${sheetStatStatus(stat)}</small>
    </button>
  `
}

function renderStatDelta(delta, critical) {
  if (delta >= 1.5) return '<span class="sheet-stat-delta up">+2</span>'
  if (delta >= 0.75) return '<span class="sheet-stat-delta up">+1</span>'
  if (delta > 0) return '<span class="sheet-stat-delta up">UP</span>'
  if (critical) return '<span class="sheet-stat-delta focus">F</span>'
  return '<span class="sheet-stat-delta hold">-</span>'
}

function sheetStatStatus(stat) {
  if (stat.critical) return 'FOCUS'
  if ((Number(stat.val) || 0) >= 80) return 'STRONG'
  if ((Number(stat.val) || 0) >= 60) return 'STABLE'
  return 'BUILD'
}

function renderLastSessionCard(state) {
  const workout = (state.workouts || [])[0]
  if (!workout) {
    return renderQuickCard('Last Session', 'Yeni seans yok', 'Yeni antrenman geldiginde burada ozet gosterilecek.')
  }

  const title = `${formatMonthShort(workout.date)} / ${workout.type}`
  const body = workout.highlight || (workout.evidence || []).slice(0, 1).join(' ') || 'Seans sinyali yok.'
  const meta = `${workout.durationMin || 0}dk${workout.distanceKm ? ` / ${workout.distanceKm}km` : ''}`
  return renderQuickCard('Last Session', title, body, meta)
}

function renderCurrentQuestCard(profile) {
  const activeQuest = [...(profile.quests?.daily || []), ...(profile.quests?.weekly || [])].find(quest => !quest.done)
  if (!activeQuest) {
    return renderQuickCard('Current Quest', 'Tum gorevler temiz', 'Yeni gorev baskisi yok.')
  }
  return renderQuickCard(
    'Current Quest',
    activeQuest.name,
    activeQuest.desc,
    `${activeQuest.progress}/${activeQuest.total} / ${activeQuest.reward || 'XP'}`
  )
}

function renderRecoveryCard(state, profile) {
  const readiness = state.health?.readiness?.score
  const armor = Math.round(Number(state.profile?.armor) || 0)
  const fatigue = Math.round(Number(state.profile?.fatigue) || 0)
  const body = Number.isFinite(readiness)
    ? `Readiness ${readiness}/100 / Armor ${armor} / Fatigue ${fatigue}`
    : `Armor ${armor} / Fatigue ${fatigue}`
  return renderQuickCard('Recovery', profile.health?.metrics?.[1]?.val || 'Stable', body)
}

function renderRecentWinCard(state, profile) {
  const perf = (profile.performance || []).find(item => String(item.trend || '').includes('+') || String(item.trend || '').includes('Elite'))
  const badge = (profile.achievements || []).find(item => item.unlocked)
  if (perf) {
    return renderQuickCard('Recent Win', perf.name, perf.trend, perf.val)
  }
  if (badge) {
    return renderQuickCard('Recent Win', badge.name, badge.desc, badge.date || 'Unlocked')
  }
  return renderQuickCard('Recent Win', 'No recent win', 'Yeni basari veya PR bekleniyor.')
}

function renderQuickCard(label, title, body, meta = '') {
  return `
    <article class="glass-card quick-card">
      <span class="mini-label">${label}</span>
      <strong>${title}</strong>
      <p>${body}</p>
      ${meta ? `<small>${meta}</small>` : ''}
    </article>
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

function renderProgressV6(state, profile, semantic) {
  return `
    <section class="surface-stack">
      <div class="glass-card" id="panel-stats">
        ${renderStats(profile, semantic)}
      </div>

      <div class="glass-card" id="panel-skills">
        ${renderSkills(profile, semantic)}
      </div>
    </section>
  `
}

function renderTrainingV6(state, profile, semantic) {
  return `
    <section class="surface-stack">
      <div class="glass-card" id="panel-training">
        ${renderQuests(profile, semantic)}
      </div>
    </section>
  `
}

function renderCoachPageV6(state, profile) {
  const coachProfile = {
    ...profile,
    armor: state.profile?.armor,
    fatigue: state.profile?.fatigue,
    injuryUntil: state.profile?.injuryUntil,
    consecutiveHeavy: state.profile?.consecutiveHeavy,
    survivalWarnings: state.profile?.survivalWarnings || [],
  }

  return `
    <section class="surface-stack">
      <article class="glass-card page-banner coach-banner">
        <div>
          <div class="eyebrow">ODIE</div>
          <h3>Coach feed ve recovery durumu</h3>
          <p>Aktif yorumlar, confidence ve recovery ayni akista.</p>
        </div>
      </article>

      <div class="coach-shell">
        ${renderCoach(coachProfile)}
      </div>
    </section>
  `
}

function initActivePage(tabKey, profile) {
  switch (tabKey) {
    case 'progress':
      initStats(profile)
      initSkills()
      break
    case 'training':
      initQuests(profile)
      break
    case 'coach':
      initCoach(profile)
      break
  }
}

document.addEventListener('click', event => {
  const tab = event.target.closest('[data-tab]')
  if (tab) {
    closeModal()
    activeTab = tab.dataset.tab
    renderApp()
    return
  }

  const action = event.target.closest('[data-action]')?.dataset.action
  if (!action) return

  if (action === 'open-avatar') {
    openAvatarModal(store.getProfile())
    return
  }

  if (action === 'open-archetype') {
    const state = store.getState()
    const profile = store.getProfile()
    const semantic = buildSemanticProfile(state.workouts || [], state.dailyLogs || [])
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
    const semantic = buildSemanticProfile(state.workouts || [], state.dailyLogs || [])
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

  if (action === 'open-unlock') {
    const profile = store.getProfile()
    const nextUnlock = findNextUnlock(profile.skills || [])
    openUnlockModal({
      nextUnlock,
      skills: profile.skills || [],
      profile,
    })
    return
  }
})
