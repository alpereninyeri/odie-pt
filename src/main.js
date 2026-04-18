import './style.css'
import { store } from './data/store.js'
import { formatMonthShort } from './data/rules.js'
import { buildSemanticProfile } from './data/semantic-profile.js'
import { renderStats, initStats } from './components/panel-stats.js'
import { renderMuscles, initMuscles } from './components/panel-muscles.js'
import { renderSkills, initSkills } from './components/panel-skills.js'
import { renderQuests, initQuests } from './components/panel-quests.js'
import { renderCoach, initCoach } from './components/panel-coach.js'
import { initModal, closeModal, openAvatarModal } from './components/modal.js'
import { openWorkoutForm } from './components/workout-form.js'
import { injectToastStyles, showToast } from './components/toast.js'

const tabs = [
  { key: 'dashboard', label: 'Nexus', icon: '✦' },
  { key: 'progress', label: 'Stats', icon: '◈' },
  { key: 'training', label: 'Quest', icon: '⚔' },
  { key: 'coach', label: 'ODIE', icon: '◉' },
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
      icon: '◉',
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
  const mobileHud = renderMobileHud(state, profile)

  document.getElementById('app').innerHTML = `
    <div class="modal-bg" id="statModal">
      <div class="modal" id="modalContent"></div>
    </div>

    ${mobileHud}

    <div class="app-shell">
      <aside class="app-nav glass-card">
        <div class="nav-brand">
          <div class="nav-brand-mark">${profile.avatar}</div>
          <div>
            <div class="nav-brand-title">OdiePt Nexus</div>
            <div class="nav-brand-sub">solo performance app</div>
          </div>
        </div>

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
            <div class="eyebrow">${tabs.find(tab => tab.key === activeTab)?.label || 'Nexus'}</div>
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
      ${renderNavButton(tabs[0], activeTab === tabs[0].key, true)}
      ${renderNavButton(tabs[1], activeTab === tabs[1].key, true)}
      <button class="bottom-tab bottom-tab-action" data-action="open-workout-form" aria-label="Antrenman ekle">
        <span class="nav-icon">+</span>
        <span>Add</span>
      </button>
      ${renderNavButton(tabs[2], activeTab === tabs[2].key, true)}
      ${renderNavButton(tabs[3], activeTab === tabs[3].key, true)}
    </nav>
  `

  initModal()
  initActivePage(activeTab, profile)
  window.__refreshActivePanel = () => renderApp()
}

function pageTitle(tabKey, profile) {
  switch (tabKey) {
    case 'dashboard':
      return `${profile.nick} performance hub`
    case 'progress':
      return 'Build, denge ve progression'
    case 'training':
      return 'Mission board, log ve session history'
    case 'coach':
      return 'ODIE command center'
    default:
      return profile.nick
  }
}

function renderMobileHud(state, profile) {
  const xpCur = profile?.xp?.current ?? 0
  const xpMax = profile?.xp?.max || 1
  const pct = Math.max(0, Math.min(100, Math.round((xpCur / xpMax) * 100)))
  const level = profile.level ?? '-'
  const streak = state.profile?.streak?.current ?? 0

  return `
    <div class="mobile-hud">
      <button class="mobile-hud-avatar" data-action="open-avatar" aria-label="Profili ac">${profile.avatar}</button>
      <div class="mobile-hud-center">
        <div class="mobile-hud-nick">${profile.nick} <span>| L${level}</span></div>
        <div class="mobile-hud-xpbar"><div class="mobile-hud-xpfill" style="width:${pct}%"></div></div>
        <div class="mobile-hud-xptext">${xpCur.toLocaleString('tr-TR')} / ${xpMax.toLocaleString('tr-TR')} XP</div>
      </div>
      <div class="mobile-hud-stats">
        <div class="mobile-hud-stat"><strong>${streak}</strong><small>STREAK</small></div>
      </div>
    </div>
  `
}

function renderNavButton(tab, isActive, mobile = false) {
  const icon = mobile ? tab.label.slice(0, 1) : tab.label.slice(0, 1)
  return `
    <button class="${mobile ? 'bottom-tab' : 'nav-button'} ${isActive ? 'active' : ''}" data-tab="${tab.key}">
      <span class="nav-icon">${icon}</span>
      <span>${tab.label}</span>
    </button>
  `
}

function renderPage(tabKey, state, profile) {
  const semantic = buildSemanticProfile(state.workouts || [], state.dailyLogs || [])
  switch (tabKey) {
    case 'dashboard':
      return renderDashboard(state, profile, semantic)
    case 'progress':
      return renderProgress(state, profile, semantic)
    case 'training':
      return renderTraining(state, profile, semantic)
    case 'coach':
      return renderCoachPage(profile)
    default:
      return ''
  }
}

function renderDashboard(state, profile, semantic) {
  const latestWorkout = (state.workouts || [])[0] || null
  const highlights = (state.workouts || []).slice(0, 2)
  const coachInsight = extractCoachInsight(profile)
  const streak = state.profile.streak || { current: 0, label: '' }
  const dashboardFocus = renderFocusItems(state, profile).slice(0, 3)
  const quickStats = renderDashboardStats(profile, latestWorkout)
  const heroSigils = renderHeroSigils(state, profile, semantic)
  const buildOS = renderBuildOS(state, profile, semantic)
  const workoutTicker = renderWorkoutTicker(latestWorkout, coachInsight, dashboardFocus[0])

  return `
    <section class="mission-ticker glass-card">
      ${workoutTicker}
    </section>

    <section class="stat-hud glass-card compact-stat-hud">
      <div class="section-top compact-top">
        <div>
          <div class="eyebrow">Live Stats</div>
          <h3>Son seansa gore buff ve focus</h3>
        </div>
        <button class="inline-link" data-tab="progress">Tum progression</button>
      </div>
      <div class="stat-hud-grid">
        ${quickStats}
      </div>
    </section>

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
          <div class="hero-banner">
            <span class="hero-banner-label">Current Focus</span>
            <strong>${state.profile.currentFocus || 'Hybrid discipline protocol'}</strong>
          </div>
          <h2>${profile.nick}</h2>
          <p>${state.profile.classObj?.reason || state.profile.classObj?.desc || profile.subClass}. Parkour, bike, ski, calisthenics ve gym tek karakter sayfasinda ilerliyor.</p>
          <div class="hero-focus">
            <span class="mini-label">Build Tags</span>
            <div class="hero-sigil-row">
              ${heroSigils}
            </div>
          </div>
        </div>
      </div>

      <div class="hero-raids">
        <div class="hero-raid-item">
          <span class="mini-label">Rank</span>
          <strong>${profile.rank}</strong>
          <small>${state.profile.classObj?.name || profile.class}</small>
        </div>
        <div class="hero-raid-item">
          <span class="mini-label">Streak</span>
          <strong>${streak.current} gun</strong>
          <small>${streak.label || 'Yeni seri'}</small>
        </div>
        <div class="hero-raid-item">
          <span class="mini-label">Last Run</span>
          <strong>${latestWorkout?.type || 'No run'}</strong>
          <small>${latestWorkout ? formatMonthShort(latestWorkout.date) : 'Yeni seans bekliyor'}</small>
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

    <section class="dashboard-grid">
      <article class="glass-card dashboard-card">
        <div class="section-top">
          <div>
            <div class="eyebrow">Focus Board</div>
            <h3>Seni level atlatacak sonraki hedefler</h3>
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
            <div class="eyebrow">Recent Log</div>
            <h3>Son seanslardan cikan temiz sinyaller</h3>
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
                <span>${(workout.tags || []).slice(0, 3).join(' | ') || 'hybrid'}</span>
              </div>
            </div>
          `).join('')}
        </div>
      </article>

      <article class="glass-card dashboard-card wide coach-preview">
        <div class="section-top">
          <div>
            <div class="eyebrow">Coach Feed</div>
            <h3>ODIE'nin en kritik notu</h3>
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

    <section class="tactical-os-grid">
      ${buildOS}
    </section>
  `
}

function renderDashboardStats(profile, latestWorkout) {
  const statDelta = latestWorkout?.statDelta || {}
  return (profile.stats || []).map(stat => `
    <button class="stat-hud-item ${stat.critical ? 'critical' : ''}" data-tab="progress" aria-label="${stat.name} detayini ac">
      <span class="stat-hud-icon">${stat.icon || stat.label}</span>
      <span class="stat-hud-key">${stat.label}</span>
      <strong>${String(stat.val).padStart(2, '0')}</strong>
      <span class="stat-hud-chip ${dashboardStatChipClass(stat, statDelta)}">${dashboardStatChipLabel(stat, statDelta)}</span>
      <small>${dashboardStatHint(stat, statDelta)}</small>
    </button>
  `).join('')
}

function dashboardStatChipLabel(stat, statDelta) {
  const delta = Number(statDelta?.[stat.key]) || 0
  if (delta > 0) return `+${delta}`
  if (stat.critical) return 'FOCUS'
  return 'HOLD'
}

function dashboardStatChipClass(stat, statDelta) {
  const delta = Number(statDelta?.[stat.key]) || 0
  if (delta > 0) return 'up'
  if (stat.critical) return 'focus'
  return 'hold'
}

function dashboardStatHint(stat, statDelta) {
  const delta = Number(statDelta?.[stat.key]) || 0
  if (delta > 0) return 'son seans buff'
  if (stat.critical) return 'bu kisma odaklan'
  return 'dengeyi koru'
}

function renderWorkoutTicker(latestWorkout, coachInsight, topFocusCard = '') {
  const focusTitle = extractTextContent(topFocusCard, 'strong') || 'Siradaki blok secimi'
  const focusBody = extractTextContent(topFocusCard, 'p') || coachInsight.body || 'Hybrid ritmi koru ve bir sonraki seansi planli sec.'
  const workoutNote = latestWorkout
    ? `${formatMonthShort(latestWorkout.date)} · ${latestWorkout.type} · ${latestWorkout.highlight || 'Kisa not yok'}`
    : 'Son workout kaydi yok. Yeni seans girdiginde burada canli not akacak.'
  const meta = latestWorkout
    ? `${latestWorkout.durationMin || 0}dk · ${latestWorkout.primaryCategory || 'hybrid'} · ${((latestWorkout.tags || []).slice(0, 2).join(' / ')) || 'signal'}`
    : 'Yeni seans bekleniyor'
  const line = `SON RUN · ${workoutNote} · ${meta} · NEXT FOCUS · ${focusTitle} · ${focusBody}`

  return `
    <div class="mission-ticker-head">
      <span class="mini-label">Session Feed</span>
      <strong>Canli antrenman notu</strong>
    </div>
    <div class="mission-ticker-marquee">
      <div class="mission-ticker-track">
        <span>${line}</span>
        <span>${line}</span>
      </div>
    </div>
  `
}

function extractTextContent(html = '', tag = 'p') {
  const match = String(html).match(new RegExp(`<${tag}[^>]*>(.*?)<\\/${tag}>`, 'i'))
  return match?.[1]?.replace(/<[^>]+>/g, '').trim() || ''
}

function renderHeroSigils(state, profile, semantic) {
  const semanticSigils = [
    semantic.shares?.movement >= 0.25 ? { short: 'MOTION', tone: 'emerald' } : null,
    semantic.shares?.strength >= 0.25 ? { short: 'POWER', tone: 'gold' } : null,
    semantic.shares?.endurance >= 0.2 ? { short: 'ENGINE', tone: 'neutral' } : null,
    semantic.chains?.trunkControl >= 3 ? { short: 'CORE LINK', tone: 'danger' } : null,
  ].filter(Boolean)

  return [...semanticSigils, ...getFocusSignals(state, profile)].slice(0, 3).map(item => `
    <span class="hero-sigil sigil-${item.tone || 'neutral'}">${item.short}</span>
  `).join('')
}


function renderFocusItems(state, profile) {
  return getFocusSignals(state, profile).map(item => `
    <div class="focus-item tone-${item.tone || 'neutral'}">
      <span class="focus-kicker">${item.kicker}</span>
      <strong>${item.title}</strong>
      <p>${item.body}</p>
    </div>
  `)
}

function renderBuildOS(state, profile, semantic) {
  const lanes = [
    { label: 'Strength', value: Math.round((semantic.shares?.strength || 0) * 100), tone: 'gold', hint: `${semantic.counts?.strength || 0} strength block` },
    { label: 'Movement', value: Math.round((semantic.shares?.movement || 0) * 100), tone: 'emerald', hint: `${semantic.counts?.parkour || 0} parkour · ${semantic.counts?.acrobatics || 0} acro` },
    { label: 'Endurance', value: Math.round((semantic.shares?.endurance || 0) * 100), tone: 'cobalt', hint: `${semantic.counts?.locomotion || 0} locomotion session` },
    { label: 'Recovery', value: Math.round((semantic.shares?.recovery || 0) * 100), tone: 'violet', hint: `${Math.round((semantic.recoveryDiscipline || 0) * 100)}% discipline` },
  ]

  const chains = [
    { label: 'Upper Chain', value: semantic.chains?.upperStrength || 0, sub: 'push + pull pressure' },
    { label: 'Lower Power', value: semantic.chains?.lowerPower || 0, sub: 'legs + parkour + explosive' },
    { label: 'Trunk Control', value: semantic.chains?.trunkControl || 0, sub: 'core + carry + climb' },
    { label: 'Aerial Control', value: semantic.chains?.aerialControl || 0, sub: 'acro + balance line' },
    { label: 'Grip Control', value: semantic.chains?.gripControl || 0, sub: 'hang + climb + pull' },
    { label: 'Mobility Base', value: semantic.chains?.mobilityBase || 0, sub: 'recovery + mobility' },
  ]

  const focusGaps = buildFocusGaps(semantic)
  const liveClass = state.profile.classObj || {}

  return `
    <article class="tactical-card os-panel build-identity-card">
      <div class="section-top">
        <div>
          <div class="eyebrow">Build Identity</div>
          <h3>Build profile</h3>
        </div>
        <span class="pill pill-emerald">LIVE</span>
      </div>
      <div class="build-identity-head">
        <div class="build-identity-icon">${liveClass.icon || '◈'}</div>
        <div>
          <strong>${liveClass.name || profile.class}</strong>
          <p>${liveClass.reason || 'Build identity semantic profile uzerinden guncellenir.'}</p>
        </div>
      </div>
      <div class="signal-chip-row">
        ${(liveClass.signals || []).slice(0, 3).map(signal => `<span class="signal-chip">${signal}</span>`).join('')}
      </div>
      <div class="ops-mini-grid">
        <div class="ops-mini-card">
          <span class="mini-label">Hybrid Score</span>
          <strong>${semantic.hybridScore || 0}</strong>
          <small>${semantic.variety || 0} signal</small>
        </div>
        <div class="ops-mini-card">
          <span class="mini-label">Runner Up</span>
          <strong>${liveClass.runnerUp?.name || 'None'}</strong>
          <small>${liveClass.runnerUp?.score ? `score ${liveClass.runnerUp.score.toFixed(1)}` : 'class lock stable'}</small>
        </div>
        <div class="ops-mini-card">
          <span class="mini-label">Recovery Discipline</span>
          <strong>${Math.round((semantic.recoveryDiscipline || 0) * 100)}%</strong>
          <small>sleep + water + steps</small>
        </div>
      </div>
    </article>

    <article class="tactical-card os-panel">
      <div class="section-top">
        <div>
          <div class="eyebrow">Mastery Lanes</div>
          <h3>Discipline pressure map</h3>
        </div>
        <button class="inline-link" data-tab="training">Campaign</button>
      </div>
      <div class="lane-grid">
        ${lanes.map(lane => `
          <div class="lane-card tone-${lane.tone}">
            <div class="lane-head">
              <strong>${lane.label}</strong>
              <span>${lane.value}%</span>
            </div>
            <div class="lane-track"><div class="lane-fill tone-${lane.tone}" style="width:${Math.max(8, lane.value)}%"></div></div>
            <small>${lane.hint}</small>
          </div>
        `).join('')}
      </div>
    </article>

    <article class="tactical-card os-panel">
      <div class="section-top">
        <div>
          <div class="eyebrow">Chain Integrity</div>
          <h3>Weak link detector</h3>
        </div>
      </div>
      <div class="chain-grid">
        ${chains.map(chain => `
          <div class="chain-card ${chain.value <= 1 ? 'low' : chain.value <= 2 ? 'mid' : 'high'}">
            <span class="mini-label">${chain.label}</span>
            <strong>${chain.value}</strong>
            <small>${chain.sub}</small>
          </div>
        `).join('')}
      </div>
    </article>

    <article class="tactical-card os-panel">
      <div class="section-top">
        <div>
          <div class="eyebrow">Gap Board</div>
          <h3>Close these gaps next</h3>
        </div>
      </div>
      <div class="gap-list">
        ${focusGaps.map(item => `
          <div class="gap-item">
            <span class="gap-mark"></span>
            <div>
              <strong>${item.title}</strong>
              <p>${item.body}</p>
            </div>
          </div>
        `).join('')}
      </div>
    </article>
  `
}

function buildFocusGaps(semantic) {
  const items = []
  if ((semantic.chains?.trunkControl || 0) < 2) {
    items.push({ title: 'Trunk control dusuk', body: 'Core, carry veya climb sinyali ekle; aerial ve parkour kalitesi buradan destek alir.' })
  }
  if ((semantic.counts?.mobility || 0) < 2) {
    items.push({ title: 'Mobility hattı ince', body: 'Recovery ve acro progression icin haftalik en az 2 mobility touch iyi olur.' })
  }
  if ((semantic.counts?.legs || 0) < 2) {
    items.push({ title: 'Lower chain frekansi dusuk', body: 'Parkour, bike veya direct leg session sayisi artarsa build daha dengeli acilir.' })
  }
  if (!items.length) {
    items.push({ title: 'Build dengesi iyi', body: 'Simdilik buyuk bir acik yok; siradaki unlock veya quest baskisina gore blok sec.' })
  }
  return items.slice(0, 3)
}

function getFocusSignals(state, profile) {
  const items = []
  const criticalStat = profile.stats.find(stat => stat.critical)

  if (criticalStat) {
    items.push({
      kicker: 'Weak Link',
      short: `${criticalStat.label} low`,
      title: `${criticalStat.label} kritik zayif halka`,
      body: `${criticalStat.name} tarafini core, denge ve kontrollu hacimle yukari cek.`,
      tone: 'danger',
    })
  }

  const weeklyQuest = profile.quests.weekly.find(quest => !quest.done && quest.progress < quest.total)
  if (weeklyQuest) {
    items.push({
      kicker: 'Main Quest',
      short: weeklyQuest.name,
      title: weeklyQuest.name,
      body: `${weeklyQuest.progress} / ${weeklyQuest.total} ilerleme. ${weeklyQuest.desc}`,
      tone: 'gold',
    })
  }

  if (state.profile.survivalWarnings?.length) {
    items.push({
      kicker: 'Recovery',
      short: 'Recovery alert',
      title: 'Recovery uyarisi',
      body: state.profile.survivalWarnings[0],
      tone: 'emerald',
    })
  }

  if (!items.length) {
    items.push({
      kicker: 'Rhythm',
      short: 'Pattern stable',
      title: 'Desen korunuyor',
      body: 'Hybrid dagilim iyi gidiyor. Bir sonraki seansi planli sec ve ritmi bozma.',
      tone: 'neutral',
    })
  }

  return items.slice(0, 3)
}

function extractCoachInsight(profile) {
  const sections = (profile.coachNote?.sections || []).filter(section => !section?.hidden)
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

function renderProgress(state, profile, semantic) {
  return `
    <section class="surface-stack">
      <div class="glass-card surface tactical-surface">
        <div class="section-top">
          <div>
            <div class="eyebrow">Build Console</div>
            <h3>Progression, mastery lanes ve unlock baskisi</h3>
            <p>Stats ve muscles artik semantic build kimligiyle birlikte okunuyor.</p>
          </div>
          <button class="inline-link" data-tab="training">Mission board</button>
        </div>
        <div class="progress-command-grid">
          ${renderBuildOS(state, profile, semantic)}
        </div>
      </div>
      <div class="glass-card surface" id="panel-stats">
        ${renderStats(profile)}
      </div>
      <div class="glass-card surface" id="panel-muscles">
        ${renderMuscles(profile)}
      </div>
      <div class="glass-card surface" id="panel-skills">
        ${renderSkills(profile, semantic)}
      </div>
    </section>
  `
}

function renderTraining(state, profile, semantic) {
  return `
    <section class="surface-stack">
      <div class="glass-card surface training-header">
        <div>
          <div class="eyebrow">Campaign Board</div>
          <h3>Mission board, recovery ops ve raid log</h3>
          <p>Webapp hissi veren kompakt tactical salonda bugunun checklist'i ve haftalik baski tek akista.</p>
        </div>
        <button class="primary-button" data-action="open-workout-form">
          <span>+</span>
          <strong>Yeni Seans</strong>
        </button>
      </div>

      <div class="glass-card surface tactical-surface training-ops">
        <div class="campaign-ops-grid">
          <div class="ops-mini-card">
            <span class="mini-label">Active Quests</span>
            <strong>${[...profile.quests.daily, ...profile.quests.weekly].filter(quest => !quest.done).length}</strong>
            <small>open objective</small>
          </div>
          <div class="ops-mini-card">
            <span class="mini-label">Recovery Discipline</span>
            <strong>${Math.round((semantic.recoveryDiscipline || 0) * 100)}%</strong>
            <small>7 day compliance</small>
          </div>
          <div class="ops-mini-card">
            <span class="mini-label">Outdoor Pressure</span>
            <strong>${semantic.counts?.outdoor || 0}</strong>
            <small>recent outdoor block</small>
          </div>
          <div class="ops-mini-card">
            <span class="mini-label">Aerial Line</span>
            <strong>${semantic.chains?.aerialControl || 0}</strong>
            <small>flip + balance signal</small>
          </div>
        </div>
      </div>

      <div class="glass-card surface" id="panel-training">
        ${renderQuests(profile, semantic)}
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
          <h3>ODIE'nin analiz ve yonlendirme paneli</h3>
          <p>Daha temiz dark arayuz, daha net okuma ve daha sade kontrol hissi.</p>
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

  if (action === 'open-workout-form') {
    openWorkoutForm()
    return
  }

  if (action === 'open-avatar') {
    openAvatarModal(store.getProfile())
  }
})
