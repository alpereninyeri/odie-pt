import './style.css'
import { store } from './data/store.js'
import { formatMonthShort } from './data/rules.js'
import { renderStats, initStats } from './components/panel-stats.js'
import { renderMuscles, initMuscles } from './components/panel-muscles.js'
import { renderSkills, initSkills } from './components/panel-skills.js'
import { renderQuests, initQuests } from './components/panel-quests.js'
import { renderCoach, initCoach } from './components/panel-coach.js'
import { renderDailyChecklist, initDailyChecklist } from './components/daily-checklist.js'
import { initModal, closeModal, openAvatarModal } from './components/modal.js'
import { openWorkoutForm } from './components/workout-form.js'
import { injectToastStyles, showToast } from './components/toast.js'

const tabs = [
  { key: 'dashboard', label: 'Dashboard', icon: '◎' },
  { key: 'progress', label: 'Progress', icon: '◔' },
  { key: 'training', label: 'Training', icon: '▣' },
  { key: 'coach', label: 'Coach', icon: '◈' },
]

let activeTab = 'dashboard'

injectToastStyles()
initTheme()

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
      icon: '◈',
      title: 'ODIE raporu geldi',
      msg: coachNote.xp_note || 'Yeni antrenman analizi hazir',
      rarity: 'rare',
      duration: 3200,
    })
  })
})

function initTheme() {
  const saved = localStorage.getItem('odiept-theme') || 'light'
  document.documentElement.setAttribute('data-theme', saved)
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'light'
  const next = current === 'dark' ? 'light' : 'dark'
  document.documentElement.setAttribute('data-theme', next)
  localStorage.setItem('odiept-theme', next)
  renderApp()
}

function renderApp() {
  const state = store.getState()
  const profile = store.getProfile()
  const theme = document.documentElement.getAttribute('data-theme') || 'light'

  document.getElementById('app').innerHTML = `
    <div class="modal-bg" id="statModal">
      <div class="modal" id="modalContent"></div>
    </div>

    <div class="app-shell">
      <aside class="app-nav glass-card">
        <div class="nav-brand">
          <div class="nav-brand-mark">${profile.avatar}</div>
          <div>
            <div class="nav-brand-title">OdiePt V2</div>
            <div class="nav-brand-sub">${profile.handle}</div>
          </div>
        </div>

        <button class="theme-pill" data-action="toggle-theme" aria-label="Tema degistir">
          <span>${theme === 'dark' ? 'Moon' : 'Light'}</span>
          <strong>${theme === 'dark' ? 'Dark' : 'Light'}</strong>
        </button>

        <button class="primary-button desktop-only" data-action="open-workout-form">
          <span>+</span>
          <strong>Antrenman Ekle</strong>
        </button>

        <nav class="nav-list">
          ${tabs.map(tab => renderNavButton(tab, activeTab === tab.key)).join('')}
        </nav>

        <div class="nav-status glass-subtle">
          <div class="mini-label">Current Focus</div>
          <div class="nav-status-title">${state.profile.currentFocus || 'Hybrid denge'}</div>
          <div class="nav-status-sub">${state.profile.classObj?.name || profile.class}</div>
        </div>
      </aside>

      <main class="app-main">
        <header class="topbar">
          <div>
            <div class="eyebrow">${tabs.find(tab => tab.key === activeTab)?.label || 'Dashboard'}</div>
            <h1 class="page-title">${pageTitle(activeTab, profile)}</h1>
          </div>
          <div class="topbar-actions">
            <button class="avatar-chip" data-action="open-avatar" aria-label="Profili ac">
              <span class="avatar-chip-icon">${profile.avatar}</span>
              <span>${profile.nick}</span>
            </button>
            <button class="primary-button mobile-inline" data-action="open-workout-form">
              <span>+</span>
              <strong>Kayit</strong>
            </button>
          </div>
        </header>

        <section class="page-content">
          ${renderPage(activeTab, state, profile)}
        </section>
      </main>
    </div>

    <nav class="bottom-tabs glass-card">
      ${tabs.map(tab => renderNavButton(tab, activeTab === tab.key, true)).join('')}
    </nav>

    <button class="primary-fab" data-action="open-workout-form" aria-label="Antrenman ekle">+</button>
  `

  initModal()
  initActivePage(activeTab, profile)
  window.__refreshActivePanel = () => renderApp()
}

function pageTitle(tabKey, profile) {
  switch (tabKey) {
    case 'dashboard':
      return `${profile.nick} performans ozeti`
    case 'progress':
      return 'Statlar, denge ve skill progression'
    case 'training':
      return 'Gunluk takip, gorevler ve workout gecmisi'
    case 'coach':
      return 'ODIE analysis feed'
    default:
      return profile.nick
  }
}

function renderNavButton(tab, isActive, mobile = false) {
  return `
    <button class="${mobile ? 'bottom-tab' : 'nav-button'} ${isActive ? 'active' : ''}" data-tab="${tab.key}">
      <span class="nav-icon">${tab.icon}</span>
      <span>${tab.label}</span>
    </button>
  `
}

function renderPage(tabKey, state, profile) {
  switch (tabKey) {
    case 'dashboard':
      return renderDashboard(state, profile)
    case 'progress':
      return renderProgress(profile)
    case 'training':
      return renderTraining(profile)
    case 'coach':
      return renderCoachPage(profile)
    default:
      return ''
  }
}

function renderDashboard(state, profile) {
  const readinessMetric = profile.health.metrics.find(metric => metric.label === 'Readiness')
  const rings = profile.health.rings || []
  const highlights = (state.workouts || []).slice(0, 2)
  const coachInsight = extractCoachInsight(profile)
  const streak = state.profile.streak || { current: 0, label: '' }
  const dashboardFocus = renderFocusItems(state, profile).slice(0, 2)
  const quickStats = renderDashboardStats(profile)

  return `
    <section class="hero-card glass-card">
      <div class="hero-ornaments">
        <span class="hero-ornament orb"></span>
        <span class="hero-ornament crest"></span>
      </div>
      <div class="hero-main">
        <button class="hero-avatar" data-action="open-avatar" aria-label="Profili ac">${profile.avatar}</button>
        <div class="hero-copy">
          <div class="hero-meta">
            <span class="rank-capsule">${profile.rank}</span>
            <span class="class-chip">${state.profile.classObj?.name || profile.class}</span>
          </div>
          <h2>${profile.nick}</h2>
          <p>${state.profile.classObj?.desc || profile.subClass}</p>
          <div class="hero-focus">
            <span class="mini-label">Active Questline</span>
            <strong>${state.profile.currentFocus || 'Hybrid denge'}</strong>
          </div>
        </div>
      </div>

      <div class="hero-raids">
        <div class="hero-raid-item">
          <span class="mini-label">Guild Rank</span>
          <strong>${profile.rank}</strong>
          <small>${state.profile.classObj?.name || profile.class}</small>
        </div>
        <div class="hero-raid-item">
          <span class="mini-label">Streak Aura</span>
          <strong>${streak.current} gun</strong>
          <small>${streak.label || 'Yeni seri'}</small>
        </div>
        <div class="hero-raid-item">
          <span class="mini-label">Readiness</span>
          <strong>${readinessMetric?.val || '100/100'}</strong>
          <small>${state.profile.survivalStatus || 'healthy'}</small>
        </div>
      </div>

      <div class="hero-stats">
        <div class="identity-metric">
          <span class="mini-label">Level</span>
          <strong>${profile.level}</strong>
          <small>${profile.xp.current.toLocaleString('tr-TR')} / ${profile.xp.max.toLocaleString('tr-TR')} XP</small>
        </div>
        <div class="identity-metric">
          <span class="mini-label">Lifetime XP</span>
          <strong>${state.profile.xp.total.toLocaleString('tr-TR')}</strong>
          <small>Gercek toplam</small>
        </div>
        <div class="identity-metric">
          <span class="mini-label">Sessions</span>
          <strong>${profile.sessions}</strong>
          <small>${profile.totalTime}</small>
        </div>
        <div class="identity-metric">
          <span class="mini-label">Volume</span>
          <strong>${profile.totalVolume}</strong>
          <small>${profile.totalSets} set</small>
        </div>
      </div>

      <div class="progress-strip">
        <div class="progress-strip-head">
          <span>Level progress</span>
          <strong>%${Math.round((profile.xp.current / Math.max(1, profile.xp.max)) * 100)}</strong>
        </div>
        <div class="progress-bar">
          <div class="progress-bar-fill" style="width:${Math.round((profile.xp.current / Math.max(1, profile.xp.max)) * 100)}%"></div>
        </div>
      </div>
    </section>

    <section class="stat-hud glass-card">
      <div class="section-top compact-top">
        <div>
          <div class="eyebrow">Character Sheet</div>
          <h3>Core statlar acilista gorunsun</h3>
        </div>
        <button class="inline-link" data-tab="progress">Tum progression</button>
      </div>
      <div class="stat-hud-grid">
        ${quickStats}
      </div>
    </section>

    <section class="dashboard-grid">
      <article class="glass-card dashboard-card">
        <div class="section-top">
          <div>
            <div class="eyebrow">Battle Readiness</div>
            <h3>Bugun raid'e ne kadar hazirsin</h3>
          </div>
          <span class="pill pill-emerald">${state.profile.survivalStatus || 'healthy'}</span>
        </div>
        <div class="readiness-row">
          <div class="readiness-score">${readinessMetric?.val || '100/100'}</div>
          <div class="readiness-copy">
            <div class="mini-label">Streak</div>
            <strong>${streak.current} gun ${streak.label ? `· ${streak.label}` : ''}</strong>
            <p>${readinessMetric?.sub || 'Armor ve fatigue dengesiyle hesaplanir.'}</p>
          </div>
        </div>
        <div class="readiness-bars">
          <div class="micro-bar">
            <span>Armor</span>
            <div class="track"><div class="fill emerald" style="width:${Math.max(0, Math.min(100, state.profile.armor || 0))}%"></div></div>
            <strong>${state.profile.armor || 0}</strong>
          </div>
          <div class="micro-bar">
            <span>Fatigue</span>
            <div class="track"><div class="fill amber" style="width:${Math.max(0, Math.min(100, state.profile.fatigue || 0))}%"></div></div>
            <strong>${state.profile.fatigue || 0}</strong>
          </div>
        </div>
      </article>

      <article class="glass-card dashboard-card">
        <div class="section-top">
          <div>
            <div class="eyebrow">Daily Rings</div>
            <h3>Gunun aktiflik halkalari</h3>
          </div>
          <button class="inline-link" data-tab="training">Training</button>
        </div>
        <div class="ring-stack">
          ${rings.map(renderRingSummary).join('')}
        </div>
      </article>

      <article class="glass-card dashboard-card">
        <div class="section-top">
          <div>
            <div class="eyebrow">Quest Radar</div>
            <h3>Bir sonraki net gorev</h3>
          </div>
          <button class="inline-link" data-tab="progress">Progress</button>
        </div>
        <div class="focus-list">
          ${dashboardFocus.join('')}
        </div>
      </article>

      <article class="glass-card dashboard-card wide">
        <div class="section-top">
          <div>
            <div class="eyebrow">Raid Log</div>
            <h3>Son seanslardan net sinyaller</h3>
          </div>
          <button class="inline-link" data-tab="training">Tum gecmis</button>
        </div>
        <div class="highlight-list">
          ${highlights.map(workout => `
            <div class="highlight-item">
              <div class="highlight-top">
                <strong>${workout.type}</strong>
                <span>${formatMonthShort(workout.date)}</span>
              </div>
              <p>${workout.highlight || 'Kisa not yok.'}</p>
              <div class="highlight-meta">
                <span>${workout.durationMin || 0}dk</span>
                <span>${workout.primaryCategory}</span>
                <span>${(workout.tags || []).slice(0, 3).join(' · ') || 'hybrid'}</span>
              </div>
            </div>
          `).join('')}
        </div>
      </article>

      <article class="glass-card dashboard-card wide coach-preview">
        <div class="section-top">
          <div>
            <div class="eyebrow">Guild Intel</div>
            <h3>Odie'den en kritik not</h3>
          </div>
          <button class="inline-link" data-tab="coach">Coach ekranini ac</button>
        </div>
        <div class="coach-preview-body">
          <div class="coach-preview-mark">ODIE</div>
          <div>
            <strong>${coachInsight.title}</strong>
            <p>${coachInsight.body}</p>
          </div>
        </div>
      </article>
    </section>
  `
}

function renderDashboardStats(profile) {
  return (profile.stats || []).map(stat => `
    <button class="stat-hud-item ${stat.critical ? 'critical' : ''}" data-tab="progress" aria-label="${stat.name} detayini ac">
      <span class="stat-hud-icon">${stat.icon || stat.label}</span>
      <span class="stat-hud-key">${stat.label}</span>
      <strong>${String(stat.val).padStart(2, '0')}</strong>
      <small>${stat.name}</small>
    </button>
  `).join('')
}

function renderRingSummary(ring) {
  const pct = Math.max(0, Math.min(100, ring.pct || 0))
  return `
    <div class="ring-summary">
      <div class="ring-visual" style="--ring-pct:${pct}%;--ring-color:${ring.color}">
        <span>${ring.icon}</span>
      </div>
      <div class="ring-copy">
        <div class="ring-head">
          <strong>${ring.name}</strong>
          <span>%${pct}</span>
        </div>
        <p>${ring.current.toLocaleString('tr-TR')} / ${ring.max.toLocaleString('tr-TR')} ${ring.unit}</p>
      </div>
    </div>
  `
}

function renderFocusItems(state, profile) {
  const items = []
  const criticalStat = profile.stats.find(stat => stat.critical)
  if (criticalStat) {
    items.push(`
      <div class="focus-item">
        <strong>${criticalStat.label} kritik zayif halka</strong>
        <p>${criticalStat.name} tarafini core veya denge bloklariyla destekle.</p>
      </div>
    `)
  }

  const weeklyQuest = profile.quests.weekly.find(quest => !quest.done && quest.progress < quest.total)
  if (weeklyQuest) {
    items.push(`
      <div class="focus-item">
        <strong>${weeklyQuest.name}</strong>
        <p>${weeklyQuest.progress} / ${weeklyQuest.total} ilerleme. ${weeklyQuest.desc}</p>
      </div>
    `)
  }

  if (state.profile.survivalWarnings?.length) {
    items.push(`
      <div class="focus-item">
        <strong>Recovery uyarisi</strong>
        <p>${state.profile.survivalWarnings[0]}</p>
      </div>
    `)
  }

  if (!items.length) {
    items.push(`
      <div class="focus-item">
        <strong>Desen korunuyor</strong>
        <p>Hybrid dagilimi iyi gidiyor. Bir sonraki seansi planli sekilde sec.</p>
      </div>
    `)
  }

  return items.slice(0, 3)
}

function extractCoachInsight(profile) {
  const sections = profile.coachNote?.sections || []
  const firstSection = sections[0]
  if (!firstSection) {
    return {
      title: 'Heniz coach raporu yok',
      body: 'Telegram veya form uzerinden yeni seans girdiginde ODIE burada ozet ve uyari biriktirecek.',
    }
  }

  return {
    title: firstSection.title,
    body: (firstSection.lines || []).slice(0, 2).join(' '),
  }
}

function renderProgress(profile) {
  return `
    <section class="surface-stack">
      <div class="glass-card surface" id="panel-stats">
        ${renderStats(profile)}
      </div>
      <div class="glass-card surface" id="panel-muscles">
        ${renderMuscles(profile)}
      </div>
      <div class="glass-card surface" id="panel-skills">
        ${renderSkills(profile)}
      </div>
    </section>
  `
}

function renderTraining(profile) {
  return `
    <section class="surface-stack">
      <div class="glass-card surface training-header">
        <div>
          <div class="eyebrow">Training Flow</div>
          <h3>Gunluk log + gorev + workout gecmisi</h3>
          <p>Tek yerde hem recovery checklist hem de antrenman kaydi.</p>
        </div>
        <button class="primary-button" data-action="open-workout-form">
          <span>+</span>
          <strong>Yeni Seans</strong>
        </button>
      </div>

      <div class="glass-card surface">
        ${renderDailyChecklist()}
      </div>

      <div class="glass-card surface" id="panel-training">
        ${renderQuests(profile)}
      </div>
    </section>
  `
}

function renderCoachPage(profile) {
  return `
    <section class="surface-stack">
      <div class="glass-card surface coach-intro">
        <div>
          <div class="eyebrow">Coach Feed</div>
          <h3>Sinematik ama daha temiz analiz akisi</h3>
          <p>Neon fazlaligini azalttik; icerik hala sert, arayuz daha premium.</p>
        </div>
        <button class="inline-link" data-tab="training">Son seanslari ac</button>
      </div>
      <div class="coach-shell">
        ${renderCoach(profile)}
      </div>
    </section>
  `
}

function initActivePage(tabKey, profile) {
  switch (tabKey) {
    case 'progress':
      initStats(profile)
      initMuscles()
      initSkills()
      break
    case 'training':
      initDailyChecklist()
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

  if (action === 'toggle-theme') {
    toggleTheme()
    return
  }

  if (action === 'open-workout-form') {
    openWorkoutForm()
    return
  }

  if (action === 'open-avatar') {
    openAvatarModal(store.getProfile())
  }
})
