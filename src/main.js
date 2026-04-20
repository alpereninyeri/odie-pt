import './style.css'
import { store } from './data/store.js'
import { formatMonthShort } from './data/rules.js'
import { buildSemanticProfile } from './data/semantic-profile.js'
import { renderStats, initStats } from './components/panel-stats.js'
import { renderMuscles, initMuscles } from './components/panel-muscles.js'
import { renderSkills, initSkills } from './components/panel-skills.js'
import { renderQuests, initQuests } from './components/panel-quests.js'
import { renderCoach, initCoach } from './components/panel-coach.js'
import { renderHealth } from './components/panel-health.js'
import { initModal, closeModal, openAvatarModal } from './components/modal.js'
import { injectToastStyles, showToast } from './components/toast.js'
import { initTelegramMiniApp } from './data/telegram-webapp.js'

const tabs = [
  { key: 'dashboard', label: 'Nexus', icon: 'NX' },
  { key: 'progress', label: 'Stats', icon: 'ST' },
  { key: 'training', label: 'Quest', icon: 'QS' },
  { key: 'coach', label: 'ODIE', icon: 'OD' },
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
  const mobileHud = renderMobileHud(state, profile)

  document.getElementById('app').innerHTML = `
    <div class="modal-bg" id="statModal">
      <div class="modal" id="modalContent"></div>
    </div>

    ${mobileHud}

    <div class="app-shell pixel-shell">
      <aside class="app-nav glass-card surface-rune">
        <div class="nav-brand">
          <div class="nav-brand-mark">${profile.avatar}</div>
          <div>
            <div class="nav-brand-title">ODIE PT</div>
            <div class="nav-brand-sub">field ledger</div>
          </div>
        </div>

        <nav class="nav-list">
          ${tabs.map(tab => renderNavButton(tab, activeTab === tab.key)).join('')}
        </nav>

        <div class="nav-status glass-subtle surface-rune">
          <div class="mini-label">Field Focus</div>
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
      return `${profile.nick} Field Nexus`
    case 'progress':
      return 'Stat Codex ve Forge'
    case 'training':
      return 'Quest Ledger ve Raid Log'
    case 'coach':
      return 'ODIE Survival Console'
    default:
      return profile.nick
  }
}

function renderMobileHud(state, profile) {
  const xpCur = profile?.xp?.current ?? 0
  const xpMax = profile?.xp?.max || 1
  const pct = Math.max(0, Math.min(100, Math.round((xpCur / xpMax) * 100)))
  const level = profile.level ?? '-'
  const armor = Math.max(0, Math.min(100, Number(state.profile?.armor) || 0))
  const fatigue = Math.max(0, Math.min(100, Number(state.profile?.fatigue) || 0))
  const streak = state.profile?.streak?.current ?? 0
  const readiness = state.health?.readiness?.score
  const sideLabel = Number.isFinite(readiness) ? `RDY ${readiness}` : `${streak} ST`

  return `
    <div class="mobile-hud vitals-rail">
      <button class="mobile-hud-avatar" data-action="open-avatar" aria-label="Profili ac">${profile.avatar}</button>
      <div class="mobile-hud-center vitals-rail-center">
        <div class="mobile-hud-nick">${profile.nick}<span> L${level}</span></div>
        <div class="mobile-hud-xpbar"><div class="mobile-hud-xpfill" style="width:${pct}%"></div></div>
        <div class="vital-meter-row">
          <div class="vital-meter tone-armor">
            <span>AR</span>
            <div class="vital-meter-track"><div class="vital-meter-fill tone-armor" style="width:${armor}%"></div></div>
          </div>
          <div class="vital-meter tone-fatigue">
            <span>FT</span>
            <div class="vital-meter-track"><div class="vital-meter-fill tone-fatigue" style="width:${fatigue}%"></div></div>
          </div>
        </div>
      </div>
      <div class="mobile-hud-side">
        <strong>${sideLabel}</strong>
        <small>${xpCur.toLocaleString('tr-TR')} / ${xpMax.toLocaleString('tr-TR')} XP</small>
      </div>
    </div>
  `
}

function renderNavButton(tab, isActive, mobile = false) {
  return `
    <button class="${mobile ? 'bottom-tab' : 'nav-button'} ${isActive ? 'active' : ''}" data-tab="${tab.key}">
      <span class="nav-icon">${tab.icon}</span>
      <span>${tab.label}</span>
    </button>
  `
}

function renderPage(tabKey, state, profile, semantic) {
  switch (tabKey) {
    case 'dashboard':
      return renderDashboardV5(state, profile, semantic)
    case 'progress':
      return renderProgressV5(state, profile, semantic)
    case 'training':
      return renderTrainingV5(state, profile, semantic)
    case 'coach':
      return renderCoachPageV5(state, profile)
    default:
      return ''
  }
}

function renderDashboardV5(state, profile, semantic) {
  const latestWorkout = (state.workouts || [])[0] || null
  const coachInsight = extractCoachInsight(profile)

  return `
    <section class="surface-stack dashboard-stack">
      ${renderLastSessionBanner(latestWorkout)}

      <div class="dashboard-columns">
        ${renderClassSigilCard(state, profile)}
        ${renderActivityLedger(profile, state)}
      </div>

      <article class="glass-card surface-rune stat-pulse-panel">
        <div class="section-top">
          <div>
            <div class="eyebrow">Stat Pulse</div>
            <h3>Son seans buff, focus ve hold</h3>
          </div>
          <button class="inline-link" data-tab="progress">Stat codex</button>
        </div>
        <div class="stat-pulse-grid">
          ${renderDashboardStats(profile, latestWorkout)}
        </div>
      </article>

      <div class="dashboard-columns">
        ${renderBuildDeck(semantic, profile, state)}

        <article class="glass-card surface-rune compact-vitals-panel">
          <div class="section-top">
            <div>
              <div class="eyebrow">Vitals</div>
              <h3>Readiness ve body ledger</h3>
            </div>
            <button class="inline-link" data-tab="coach">Survival</button>
          </div>
          ${renderHealth(profile, { compact: true })}
        </article>
      </div>

      <article class="glass-card surface-rune coach-preview-panel">
        <div class="section-top">
          <div>
            <div class="eyebrow">ODIE Feed</div>
            <h3>Son komut yorumu</h3>
          </div>
          <button class="inline-link" data-tab="coach">Tam konsol</button>
        </div>
        <div class="coach-preview-body">
          <div class="coach-preview-mark">OD</div>
          <div>
            <strong>${coachInsight.title}</strong>
            <p>${coachInsight.body}</p>
          </div>
        </div>
      </article>
    </section>
  `
}

function renderProgressV5(state, profile, semantic) {
  return `
    <section class="surface-stack">
      <article class="glass-card surface-rune page-banner">
        <div>
          <div class="eyebrow">Stat Codex</div>
          <h3>Hexwheel, forge kartlari ve chain seals</h3>
          <p>Guc, hareket ve progression ayni ekranda okunur.</p>
        </div>
      </article>

      <div class="glass-card surface-rune" id="panel-stats">
        ${renderStats(profile, semantic)}
      </div>
      <div class="glass-card surface-rune" id="panel-muscles">
        ${renderMuscles(profile)}
      </div>
      <div class="glass-card surface-rune" id="panel-skills">
        ${renderSkills(profile, semantic)}
      </div>
    </section>
  `
}

function renderTrainingV5(state, profile, semantic) {
  const openQuests = [...profile.quests.daily, ...profile.quests.weekly].filter(quest => !quest.done).length
  const recovery = Math.round((semantic.recoveryDiscipline || 0) * 100)

  return `
    <section class="surface-stack">
      <article class="glass-card surface-rune page-banner">
        <div>
          <div class="eyebrow">Quest Ledger</div>
          <h3>Aktif gorevler, mission baskisi ve raid kaydi</h3>
          <p>Gorevleri ve son seans izlerini tek akista takip et.</p>
        </div>
        <div class="page-banner-chips">
          <span class="signal-chip">${openQuests} open</span>
          <span class="signal-chip">${recovery}% recovery</span>
          <span class="signal-chip">${semantic.variety || 0} variety</span>
        </div>
      </article>

      <div class="glass-card surface-rune" id="panel-training">
        ${renderQuests(profile, semantic)}
      </div>

      ${renderSignalArchive(state)}
    </section>
  `
}

function renderCoachPageV5(state, profile) {
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
      <article class="glass-card surface-rune page-banner coach-banner">
        <div>
          <div class="eyebrow">ODIE</div>
          <h3>Survival console ve coach feed</h3>
          <p>Aktif recovery durumu, parse confidence ve hafiza ayni hatta.</p>
        </div>
        <button class="inline-link" data-tab="training">Raid ledger</button>
      </article>

      <div class="coach-shell">
        ${renderCoach(coachProfile)}
      </div>
    </section>
  `
}

function renderDashboardStats(profile, latestWorkout) {
  const statDelta = latestWorkout?.statDelta || {}
  return (profile.stats || []).map(stat => `
    <button class="stat-pulse-item ${stat.critical ? 'critical' : ''}" data-tab="progress" aria-label="${stat.name} detayini ac">
      <span class="stat-pulse-key">${stat.label}</span>
      <strong>${String(stat.val).padStart(2, '0')}</strong>
      <span class="stat-pulse-chip ${dashboardStatChipClass(stat, statDelta)}">${dashboardStatChipLabel(stat, statDelta)}</span>
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
  if (stat.critical) return 'bu hatta odaklan'
  return 'denge korunuyor'
}

function renderLastSessionBanner(latestWorkout) {
  if (!latestWorkout) {
    return `
      <article class="glass-card surface-rune session-banner empty">
        <div class="eyebrow">Last Session</div>
        <h3>HenÃ¼z seans kaydÄ± yok</h3>
        <p>Telegram'dan yeni workout gÃ¶nderdiÄŸinde burada block mix ve kanÄ±t satÄ±rlarÄ± gÃ¶rÃ¼necek.</p>
      </article>
    `
  }

  const blockChips = (latestWorkout.blockMix || latestWorkout.blocks || []).slice(0, 4).map(block => {
    if (typeof block === 'string') return `<span class="signal-chip">${block}</span>`
    const percent = Number.isFinite(Number(block.percent)) ? ` ${Math.round(Number(block.percent))}%` : ''
    return `<span class="signal-chip">${block.kind}${percent}</span>`
  }).join('')

  const evidence = (latestWorkout.evidence || []).slice(0, 2).join(' · ') || latestWorkout.highlight || 'Ana sinyal kaydi yok.'
  const headline = `${formatMonthShort(latestWorkout.date)} · ${latestWorkout.type} · ${latestWorkout.durationMin || 0}dk`
  const side = latestWorkout.distanceKm ? `${latestWorkout.distanceKm} km` : `${latestWorkout.primaryCategory || 'hybrid'}`

  return `
    <article class="glass-card surface-rune session-banner">
      <div class="session-banner-top">
        <div>
          <div class="eyebrow">Last Session</div>
          <h3>${headline}</h3>
        </div>
        <span class="session-banner-side">${side}</span>
      </div>
      <p>${evidence}</p>
      <div class="session-banner-blocks">${blockChips || '<span class="signal-chip">signal waiting</span>'}</div>
    </article>
  `
}

function renderClassSigilCard(state, profile) {
  const liveClass = state.profile.classObj || {}
  const signals = (liveClass.signals || []).slice(0, 3)
  const runnerUp = liveClass.runnerUp?.name ? `${liveClass.runnerUp.name}${liveClass.runnerUp.score ? ` · ${liveClass.runnerUp.score.toFixed(1)}` : ''}` : 'No challenger'

  return `
    <article class="glass-card surface-rune class-sigil-card">
      <div class="section-top">
        <div>
          <div class="eyebrow">Class Sigil</div>
          <h3>${liveClass.name || profile.class}</h3>
        </div>
        <span class="chip-rarity-legend">${profile.rank}</span>
      </div>
      <div class="class-sigil-body">
        <div class="class-sigil-frame">
          <span class="class-sigil-glyph">${liveClass.icon || 'SG'}</span>
        </div>
        <div class="class-sigil-copy">
          <strong>${liveClass.reason || profile.subClass}</strong>
          <p>${liveClass.buff || 'Aktif build sinyalleri sinif kimligini burada gunceller.'}</p>
        </div>
      </div>
      <div class="signal-chip-row">
        ${signals.length ? signals.map(signal => `<span class="signal-chip">${signal}</span>`).join('') : '<span class="signal-chip">signal waiting</span>'}
      </div>
      <div class="runner-up-note">Runner-up: ${runnerUp}</div>
    </article>
  `
}

function renderActivityLedger(profile, state) {
  const ringStats = normalizeGlobalStats(profile.globalStats || []).slice(0, 4)
  const lifetimeXp = state.profile?.xp?.total || 0
  return `
    <article class="glass-card surface-rune activity-ledger">
      <div class="section-top">
        <div>
          <div class="eyebrow">Activity Rings</div>
          <h3>Session totals ve life ledger</h3>
        </div>
        <span class="signal-chip">${profile.sessions} run</span>
      </div>
      <div class="ring-ledger-grid">
        ${ringStats.map(item => `
          <div class="mini-ring-card ${item.warn ? 'warn' : ''}">
            <strong>${item.val}</strong>
            <small>${item.label}</small>
          </div>
        `).join('')}
      </div>
      <div class="totals-ledger-grid">
        <div class="totals-ledger-cell">
          <span>Volume</span>
          <strong>${profile.totalVolume}</strong>
        </div>
        <div class="totals-ledger-cell">
          <span>Sets</span>
          <strong>${profile.totalSets}</strong>
        </div>
        <div class="totals-ledger-cell">
          <span>Time</span>
          <strong>${profile.totalTime}</strong>
        </div>
        <div class="totals-ledger-cell">
          <span>XP</span>
          <strong>${lifetimeXp.toLocaleString('tr-TR')}</strong>
        </div>
      </div>
    </article>
  `
}

function normalizeGlobalStats(stats = []) {
  return stats.map(item => {
    const label = String(item.label || '')
      .replace(/GÃ¼n/g, 'Gun')
      .replace(/GÃ¼nlÃ¼k/g, 'Gunluk')
      .replace(/AdÄ±m/g, 'Adim')
      .replace(/HalkasÄ±/g, 'Halkasi')
      .replace(/Egzersiz/g, 'Egzersiz')
      .replace(/Hareket/g, 'Hareket')
    return {
      val: item.val,
      label,
      warn: Boolean(item.red),
    }
  })
}

function renderBuildDeck(semantic, profile, state) {
  const tracks = [
    { label: 'Power', value: Math.round((semantic.shares?.strength || 0) * 100), tone: 'str' },
    { label: 'Motion', value: Math.round((semantic.shares?.movement || 0) * 100), tone: 'agi' },
    { label: 'Engine', value: Math.round((semantic.shares?.endurance || 0) * 100), tone: 'end' },
    { label: 'Acro', value: Math.round((semantic.shares?.acrobatics || 0) * 100), tone: 'dex' },
    { label: 'Core', value: Math.min(100, Math.round((semantic.chains?.trunkControl || 0) * 25)), tone: 'con' },
    { label: 'Recovery', value: Math.round((semantic.recoveryDiscipline || 0) * 100), tone: 'sta' },
  ]
  const notices = buildWeakNotices(semantic, profile, state)

  return `
    <article class="glass-card surface-rune build-deck">
      <div class="section-top">
        <div>
          <div class="eyebrow">Build Sigil</div>
          <h3>Discipline tracks ve weak link notices</h3>
        </div>
        <button class="inline-link" data-tab="progress">Codex</button>
      </div>

      <div class="discipline-track-list">
        ${tracks.map(track => `
          <div class="disc-track meter-${track.tone}">
            <div class="disc-track-top">
              <span>${track.label}</span>
              <strong>${track.value}%</strong>
            </div>
            <div class="disc-track-bar">
              <div class="disc-track-fill meter-${track.tone}" style="width:${Math.max(8, track.value)}%"></div>
            </div>
          </div>
        `).join('')}
      </div>

      <div class="weak-notice-stack">
        ${notices.map(item => `
          <div class="weak-notice">
            <strong>${item.title}</strong>
            <p>${item.body}</p>
          </div>
        `).join('')}
      </div>
    </article>
  `
}

function buildWeakNotices(semantic, profile, state) {
  const notices = []
  const criticalStat = (profile.stats || []).find(stat => stat.critical)
  if (criticalStat) {
    notices.push({
      title: `${criticalStat.label} weak link`,
      body: `${criticalStat.name} hattini desteklemek icin kontrollu hacim ve dogrudan aktivasyon ekle.`,
    })
  }
  if ((semantic.chains?.trunkControl || 0) < 2) {
    notices.push({
      title: 'Trunk chain zayif',
      body: 'Core veya anti-rotation sinyali eklenirse acro ve landing kalitesi daha dengeli acilir.',
    })
  }
  if ((semantic.counts?.mobility || 0) < 2) {
    notices.push({
      title: 'Mobility hattÄ± ince',
      body: 'Haftalik en az iki mobility touch recovery ve form kalitesini yukari ceker.',
    })
  }
  if ((state.profile?.survivalWarnings || []).length) {
    notices.push({
      title: 'Recovery uyarisi',
      body: state.profile.survivalWarnings[0],
    })
  }
  if (!notices.length) {
    notices.push({
      title: 'Build stabil',
      body: 'Belirgin zayif halka yok; siradaki quest veya skill kilidine gore seans sec.',
    })
  }
  return notices.slice(0, 3)
}

function extractCoachInsight(profile) {
  const sections = (profile.coachNote?.sections || []).filter(section => !section?.hidden)
  const firstSection = sections[0]
  if (!firstSection) {
    return {
      title: 'HenÃ¼z coach raporu yok',
      body: 'Yeni seans girdiginde ODIE burada ozet ve sonraki odak hatlarini biriktirecek.',
    }
  }

  return {
    title: firstSection.title,
    body: (firstSection.lines || []).slice(0, 2).join(' '),
  }
}

function summarizeBlockArchiveRows(blocks = []) {
  const totals = {}
  for (const block of blocks || []) {
    const bucket = totals[block.kind] || {
      kind: block.kind,
      count: 0,
      durationMin: 0,
      distanceKm: 0,
      weightPct: 0,
    }
    bucket.count += 1
    bucket.durationMin += Number(block.durationMin) || 0
    bucket.distanceKm += Number(block.distanceKm) || 0
    bucket.weightPct += Number(block.weightPct) || 0
    totals[block.kind] = bucket
  }

  return Object.values(totals)
    .map(item => ({
      ...item,
      avgWeightPct: Math.round(item.weightPct / Math.max(1, item.count)),
    }))
    .sort((left, right) => right.count - left.count || right.avgWeightPct - left.avgWeightPct)
    .slice(0, 6)
}

function renderSignalArchive(state) {
  const blockArchive = summarizeBlockArchiveRows(state.workoutBlocks || [])
  const facts = (state.workoutFacts || []).slice(0, 6)

  return `
    <div class="signal-archive-grid">
      <article class="glass-card surface-rune">
        <div class="section-top">
          <div>
            <div class="eyebrow">Block Archive</div>
            <h3>Kalici session block arsivi</h3>
          </div>
        </div>
        <div class="signal-archive-list">
          ${blockArchive.length ? blockArchive.map(item => `
            <div class="signal-archive-row">
              <strong>${item.kind}</strong>
              <span>${item.count} blok</span>
              <small>${item.avgWeightPct}% avg · ${item.durationMin}dk</small>
            </div>
          `).join('') : '<div class="coach-memory-empty">HenÃ¼z workout_blocks verisi yok.</div>'}
        </div>
      </article>

      <article class="glass-card surface-rune">
        <div class="section-top">
          <div>
            <div class="eyebrow">Evidence Audit</div>
            <h3>Atomic parser kanitlari</h3>
          </div>
        </div>
        <div class="signal-archive-list">
          ${facts.length ? facts.map(item => `
            <div class="signal-archive-row">
              <strong>${item.label || item.blockKind}</strong>
              <span>${item.blockKind}</span>
              <small>${item.raw}</small>
            </div>
          `).join('') : '<div class="coach-memory-empty">HenÃ¼z workout_facts verisi yok.</div>'}
        </div>
      </article>
    </div>
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

  if (action === 'open-avatar') {
    openAvatarModal(store.getProfile())
  }
})
