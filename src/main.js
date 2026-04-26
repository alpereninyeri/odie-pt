import './style.css'
import './styles/legacy-overrides.css'
import './styles/theme-mmo.css'
import './styles/hud-ask.css'
import './styles/hud-redesign.css'
import { store } from './data/store.js'
import { computeStatSnapshotDaysAgo, formatMonthShort } from './data/rules.js'
import { buildSemanticProfile } from './data/semantic-profile.js'
import { renderCoach, initCoach } from './components/panel-coach.js'
import { renderAsk, initAsk } from './components/panel-ask.js'
import { renderDailyChecklist, initDailyChecklist } from './components/daily-checklist.js'
import { renderHeatmap } from './components/heatmap-calendar.js'
import { openWorkoutForm } from './components/workout-form.js'
import { initModal, closeModal, openAvatarModal, openArchetypeModal, openFocusModal, openUnlockModal } from './components/modal.js'
import { injectToastStyles, showToast } from './components/toast.js'
import { initTelegramMiniApp } from './data/telegram-webapp.js'

const tabs = [
  { key: 'today', label: 'Bugun', icon: 'home' },
  { key: 'character', label: 'Karakter', icon: 'char' },
  { key: 'odie', label: 'ODIE', icon: 'pulse' },
]

let activeTab = 'today'
let odieMode = 'coach'
let activeSkillBranch = 0
let activeQuestTab = 'daily'
let _renderQueued = false
let _lastAppMarkup = ''
let _semanticCache = {
  workouts: null,
  dailyLogs: null,
  value: null,
}

injectToastStyles()
initTheme()
initTelegramMiniApp()

store.init().then(() => {
  renderApp()

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

  const appMarkup = `
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
          <div class="nav-status-sub">${Number(state.health?.readiness?.score) || '--'}/100 hazirlik</div>
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

  if (appMarkup === _lastAppMarkup) return

  document.getElementById('app').innerHTML = appMarkup
  _lastAppMarkup = appMarkup
  initModal()
  initActivePage(activeTab, profile)
  window.__refreshActivePanel = () => scheduleRender({ immediate: true })
}

function pageTitle(tabKey, profile) {
  switch (tabKey) {
    case 'today':
      return `${profile.nick} - Bugun`
    case 'character':
      return `${profile.nick} Karakter Sayfasi`
    case 'odie':
      return odieMode === 'ask' ? "ODIE'ye Sor" : 'ODIE Yorumu'
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
    <div class="mobile-hud-wrap">
      <div class="mobile-hud mobile-hud-v6">
        <button class="mobile-hud-avatar" data-action="open-avatar" aria-label="Profili ac">${profile.avatar}</button>
        <div class="mobile-hud-center">
          <div class="mobile-hud-nick">${profile.nick}<span>L${level}</span></div>
          <div class="mobile-hud-xpbar"><div class="mobile-hud-xpfill" style="width:${pct}%"></div></div>
        </div>
        <div class="mobile-hud-side">
          <strong>${Number.isFinite(readiness) ? readiness : streak}</strong>
          <small>${Number.isFinite(readiness) ? 'hazirlik' : 'seri'}</small>
        </div>
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
    case 'pulse':
      return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12h4l2-4 3 9 2-5h7"/></svg>`
    default:
      return kind
  }
}

function renderPage(tabKey, state, profile, semantic) {
  switch (tabKey) {
    case 'today':
      return renderTodayPage(state, profile, semantic)
    case 'character':
      return renderCharacterPage(state, profile, semantic)
    case 'odie':
      return renderOdiePage(state, profile)
    default:
      return ''
  }
}

/* ---------- Today (Bugun) page ---------- */

function readinessTitle(score) {
  if (!Number.isFinite(score)) return 'BASLANGIC'
  if (score >= 80) return 'TAM HAZIRSIN'
  if (score >= 60) return 'HAZIR'
  if (score >= 40) return 'ORTA TEMPO'
  return 'TOPARLANMA'
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

function localizeKindWords(text = '') {
  let out = String(text)
  for (const [en, tr] of Object.entries(KIND_TR_MAP)) {
    out = out.replace(new RegExp(`\\b${en}\\b`, 'gi'), tr)
  }
  return out
}

function buildTodayLead(state) {
  const sections = (state.coachNote?.sections || []).filter(section => !section?.hidden)
  const ordered = [...sections].sort((a, b) => {
    const aNext = /SONRAKI|ADIM|HEDEF|FOKUS/i.test(a.title || '') ? 0 : 1
    const bNext = /SONRAKI|ADIM|HEDEF|FOKUS/i.test(b.title || '') ? 0 : 1
    return aNext - bNext
  })
  for (const section of ordered) {
    const lines = (section.lines || []).map(item => String(item || '').trim()).filter(Boolean)
    const goodLine = lines.find(line => (line.match(/%/g) || []).length < 2) || lines[0]
    if (goodLine) {
      const localized = localizeKindWords(goodLine)
      return localized.length > 180 ? `${localized.slice(0, 177)}...` : localized
    }
  }
  const score = Number(state.health?.readiness?.score)
  if (Number.isFinite(score)) {
    if (score >= 80) return 'Bugun guclu form. Plana gore agir bir blok itebilirsin.'
    if (score >= 60) return 'Stabil durum. Plani normal tempoda surdur.'
    if (score >= 40) return 'Biraz yoruk. Hafif tempo veya teknik calisma daha verimli.'
    return 'Toparlanma onde. Dinlenme, mobilite ve dusuk yogunluk seans mantikli.'
  }
  return 'ODIE seni okumaya hazir. Ilk seansini gir, kisisel ritim cikmaya baslasin.'
}

function renderTodayPage(state, profile, semantic) {
  const readiness = Number(state.health?.readiness?.score)
  const armor = Math.round(Number(state.profile?.armor) || 0)
  const fatigue = Math.round(Number(state.profile?.fatigue) || 0)
  const streak = Number(state.profile?.streak?.current) || 0
  const lead = buildTodayLead(state)
  const title = readinessTitle(readiness)
  const activeQuest = [...(profile.quests?.daily || []), ...(profile.quests?.weekly || [])].find(quest => !quest.done)
  const recentSessions = (state.workouts || []).slice(0, 3)

  return `
    <section class="today-page">
      <article class="card-hero">
        <div class="today-hero-top">
          <div>
            <div class="today-hero-eyebrow">BUGUN ${state.profile.currentFocus ? `/ ${escapeHtml(state.profile.currentFocus)}` : ''}</div>
            <h2 class="today-hero-title">${title}</h2>
          </div>
          <div class="today-hero-score">
            <strong>${Number.isFinite(readiness) ? readiness : '--'}</strong>
            <small>/100</small>
          </div>
        </div>
        <p class="today-hero-lead">${escapeHtml(lead)}</p>
        <div class="today-hero-cta-row">
          <button class="cta-primary" data-action="open-workout">SEANS EKLE</button>
          <button class="cta-secondary" data-tab="odie">ODIE'YE SOR</button>
        </div>
      </article>

      ${activeQuest ? `
        <article class="card-strip" data-tab="character">
          <div class="mini-label">Siradaki Gorev</div>
          <div class="card-strip-row">
            <strong>${escapeHtml(activeQuest.name)}</strong>
            <span>${activeQuest.progress}/${activeQuest.total}</span>
          </div>
          <p>${escapeHtml(activeQuest.desc || '')}</p>
        </article>
      ` : ''}

      <article class="card-strip">
        <div class="mini-label">Toparlanma Durumu</div>
        <div class="card-strip-row">
          <span>Armor ${armor}</span>
          <span>Fatigue ${fatigue}</span>
          <span>Seri ${streak}g</span>
        </div>
      </article>

      <article class="glass-card today-sessions">
        <div class="section-top">
          <div>
            <div class="eyebrow">Son Seanslar</div>
            <strong>Yakin gecmis</strong>
          </div>
        </div>
        ${recentSessions.length ? `
          <ul class="today-session-list">
            ${recentSessions.map(renderTodaySessionItem).join('')}
          </ul>
        ` : `
          <div class="today-session-empty">Henuz seans kaydi yok. Ilk seansini ekle.</div>
        `}
      </article>
    </section>
  `
}

function renderTodaySessionItem(workout) {
  const title = `${formatMonthShort(workout.date)} / ${workout.type || 'Seans'}`
  const meta = [
    workout.durationMin ? `${workout.durationMin}dk` : null,
    workout.distanceKm ? `${workout.distanceKm}km` : null,
    workout.volumeKg ? `${Math.round(workout.volumeKg).toLocaleString('tr-TR')}kg` : null,
  ].filter(Boolean).join(' / ')
  const safeId = escapeHtml(String(workout.id || ''))
  return `
    <li class="today-session-item">
      <div class="today-session-text">
        <strong>${escapeHtml(title)}</strong>
        <span>${escapeHtml(meta || 'detay yok')}</span>
      </div>
      ${safeId ? `<button class="today-session-del" data-action="delete-workout" data-workout-id="${safeId}" aria-label="Seansi sil">Sil</button>` : ''}
    </li>
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

function renderCharacterPage(state, profile, semantic) {
  return `
    <section class="character-page">
      ${renderPortraitBanner(state, profile)}
      ${renderTrioCards(state, profile, semantic)}
      ${renderStatGridPixel(state, profile)}
      ${renderStatRadar(state, profile)}
      ${renderSkillTreePixel(profile)}
      ${renderQuestPixel(profile)}
      <article class="glass-card recovery-pixel">
        <div class="section-top">
          <div>
            <div class="eyebrow">Recovery Hud</div>
            <h3>Gunluk toparlanma</h3>
          </div>
        </div>
        ${renderDailyChecklist()}
      </article>
      ${renderHeatmap(state.workouts || [])}
    </section>
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
        ${profile.avatar}
        <span class="portrait-level-chip">L${profile.level}</span>
      </button>
      <div class="portrait-info">
        <div class="portrait-name">${escapeHtml(profile.nick)}</div>
        <div class="portrait-class-line">
          <span class="rank-pill">${escapeHtml(rank)}</span>
          <span>${escapeHtml(className)}</span>
        </div>
        <div class="portrait-bars">
          <div class="portrait-bar-row">
            <span class="pixel-label">XP</span>
            <div class="pix-bar"><div class="pix-bar-fill" style="width:${xpPct}%"></div></div>
            <span class="bar-val">${xpCur}/${xpMax}</span>
          </div>
          <div class="portrait-bar-row">
            <span class="pixel-label">ARMOR</span>
            <div class="pix-bar"><div class="pix-bar-fill green" style="width:${armor}%"></div></div>
            <span class="bar-val">${armor}</span>
          </div>
          <div class="portrait-bar-row">
            <span class="pixel-label">FATIGUE</span>
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
  const focus = state.profile.currentFocus || 'Hybrid denge'
  const nextUnlock = findNextUnlock(profile.skills || [])
  const nextUnlockHint = summarizeUnlockHint(nextUnlock, profile.skills || [])
  const focusSignal = (liveClass.signals || []).slice(0, 1).join(' / ') || `Variety ${semantic.variety || 0}`

  return `
    <div class="trio-grid">
      <button class="trio-card" data-action="open-archetype">
        <span class="pixel-label">Archetype</span>
        <strong>${escapeHtml(className)}</strong>
        <small>${escapeHtml((liveClass.reason || 'Aktif build').slice(0, 36))}</small>
      </button>
      <button class="trio-card" data-action="open-focus">
        <span class="pixel-label">Focus</span>
        <strong>${escapeHtml(focus)}</strong>
        <small>${escapeHtml(focusSignal.slice(0, 36))}</small>
      </button>
      <button class="trio-card" data-action="open-unlock">
        <span class="pixel-label">Next</span>
        <strong>${escapeHtml(nextUnlock?.name || 'Stable Build')}</strong>
        <small>${escapeHtml((nextUnlockHint || 'Takipte').slice(0, 36))}</small>
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
          <div class="eyebrow">Combat Stats</div>
          <h3>Karakter parametreleri</h3>
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
  const delta = Number(latestDelta?.[stat.key]) || 0
  const upFlag = delta > 0 ? `<span class="stat-pixel-flag" style="background:var(--mmo-emerald)">UP</span>` : ''
  const critFlag = stat.critical ? `<span class="stat-pixel-flag">F</span>` : ''
  return `
    <button class="stat-pixel ${stat.critical ? 'crit' : ''}" data-action="open-focus" aria-label="${stat.name}">
      <span class="stat-pixel-icon">${stat.icon || '*'}</span>
      <div class="stat-pixel-body">
        <div class="stat-pixel-row">
          <span class="pixel-label">${stat.label}</span>
          <strong>${val}${critFlag}${upFlag}</strong>
        </div>
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
  const snapshot = computeStatSnapshotDaysAgo(state.workouts || [], currentMap, 30)

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
        <text x="${x}" y="${y + 12}" text-anchor="middle" dominant-baseline="middle" class="radar-label-val">${current}</text>
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
          <div class="eyebrow">Stat Radar</div>
          <h3>Simdi vs 30 gun once</h3>
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
          <div class="pixel-label">Skill Tree</div>
          <div class="panel-title">Branch noktalari</div>
        </div>
      </div>
      <div class="branch-tabs">
        ${branches.map((branch, i) => `
          <button class="branch-tab ${i === idx ? 'active' : ''} ${branch.warning ? 'warn' : ''}" data-skill-branch="${i}">
            ${escapeHtml(stripBranchEmoji(branch.branch))}
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

function renderSkillNode(item) {
  const status = item.status || 'lock'
  const glyph = status === 'done' ? 'OK' : status === 'prog' ? '...' : 'X'
  const subtitle = item.req || item.val || ''
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
          <div class="eyebrow">Active Quests</div>
          <h3>Gorev defteri</h3>
        </div>
      </div>
      <div class="quest-pixel-tabs">
        <button class="branch-tab ${activeQuestTab === 'daily' ? 'active' : ''}" data-quest-tab="daily">Daily ${daily.filter(q => !q.done).length}/${daily.length}</button>
        <button class="branch-tab ${activeQuestTab === 'weekly' ? 'active' : ''}" data-quest-tab="weekly">Weekly ${weekly.filter(q => !q.done).length}/${weekly.length}</button>
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
  const sourceTag = quest.fromClass ? '<span class="quest-source class">CLASS</span>' : quest.fromCoach ? '<span class="quest-source coach">COACH</span>' : ''
  return `
    <div class="quest-ticket ${quest.done ? 'done' : ''}${quest.fromClass ? ' class-quest' : ''}">
      <span class="quest-icon">${quest.icon || '*'}</span>
      <div class="quest-body">
        <div class="quest-title-row">
          <strong>${escapeHtml(quest.name)}</strong>
          ${sourceTag}
        </div>
        <div class="pix-bar pix-bar-thin"><div class="pix-bar-fill ${quest.done ? 'green' : ''}" style="width:${pct}%"></div></div>
        <div class="quest-meta">
          <small>${progress}/${total}</small>
          <small class="reward">${escapeHtml(quest.reward || '')}</small>
        </div>
      </div>
    </div>
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

function renderOdiePage(state, profile) {
  const coachProfile = {
    ...profile,
    armor: state.profile?.armor,
    fatigue: state.profile?.fatigue,
    injuryUntil: state.profile?.injuryUntil,
    consecutiveHeavy: state.profile?.consecutiveHeavy,
    survivalWarnings: state.profile?.survivalWarnings || [],
  }

  return `
    <section class="odie-page">
      <div class="odie-switcher">
        <button class="odie-switcher-btn ${odieMode === 'coach' ? 'active' : ''}" data-odie-mode="coach">YORUM</button>
        <button class="odie-switcher-btn ${odieMode === 'ask' ? 'active' : ''}" data-odie-mode="ask">SOR</button>
      </div>

      ${odieMode === 'coach' ? `
        <div class="coach-shell">
          ${renderCoach(coachProfile)}
        </div>
      ` : renderAsk(state, profile)}
    </section>
  `
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
      if (odieMode === 'coach') initCoach(profile)
      else initAsk(profile)
      break
  }
}

/* ---------- Global click handler ---------- */

document.addEventListener('click', event => {
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
    scheduleRender({ immediate: true })
    return
  }

  const action = event.target.closest('[data-action]')?.dataset.action
  if (!action) return

  if (action === 'open-avatar') {
    openAvatarModal(store.getProfile())
    return
  }

  if (action === 'open-workout') {
    openWorkoutForm()
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
