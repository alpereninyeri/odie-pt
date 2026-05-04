import './styles/odie-ui.css'
import './styles/heroic-rpg.css'
import { store } from './data/store.js'
import { computeProfileStatsSnapshotDaysAgo, formatMonthShort, getLocalDateString, normalizeDateString } from './data/rules.js'
import { buildSemanticProfile } from './data/semantic-profile.js'
import { renderCoach, initCoach } from './components/panel-coach.js'
import { renderAsk, initAsk } from './components/panel-ask.js'
import { renderDailyChecklist, initDailyChecklist } from './components/daily-checklist.js'
import { renderHeatmap } from './components/heatmap-calendar.js'
import { openWorkoutForm } from './components/workout-form.js'
import { initModal, closeModal, openModal, openAvatarModal, openArchetypeModal, openFocusModal, openStatModal, openUnlockModal } from './components/modal.js'
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

  const appMarkup = `
    <div class="modal-bg" id="statModal">
      <div class="modal" id="modalContent"></div>
    </div>

    ${renderMobileHud(state, profile)}

    <div class="app-shell app-shell-v6">
      <aside class="app-nav glass-card">
        <div class="nav-brand">
          <div class="nav-brand-mark">${avatarMark(profile)}</div>
          <div>
            <div class="nav-brand-title">OdiePT</div>
            <div class="nav-brand-sub">${renderExplainButton('class', state.profile.classObj?.name || profile.class || 'Class', 'explain-link nav-explain')}</div>
          </div>
        </div>

        <nav class="nav-list">
          ${tabs.map(tab => renderNavButton(tab, activeTab === tab.key)).join('')}
        </nav>

        <div class="nav-status glass-subtle">
          <div class="mini-label">${renderExplainButton('current-focus', 'Current Focus', 'explain-link metric-explain')}</div>
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
  const source = String(state.workouts?.[0]?.source || 'manual').toUpperCase()
  const statValue = key => Math.round(Number((profile.stats || []).find(stat => stat.key === key)?.val ?? state.profile?.stats?.[key]) || 0)
  const hudStats = [
    { key: 'STR', val: statValue('str') },
    { key: 'DEX', val: statValue('dex') },
    { key: 'CON', val: statValue('con') },
  ]

  return `
    <div class="mobile-hud-wrap">
      <div class="mobile-hud mobile-hud-v6">
        <button class="mobile-hud-avatar" data-action="open-avatar" aria-label="Profili ac">${avatarMark(profile)}</button>
        <div class="mobile-hud-center">
          <div class="mobile-hud-topline">
            <span>${renderExplainButton('class', state.profile.classObj?.name || profile.class || 'OdiePT', 'explain-link hud-explain')}</span>
            <span class="source-pill">${renderExplainButton(source === 'HEVY' ? 'hevy' : 'kaynak', source === 'HEVY' ? 'HEVY LIVE' : 'CANLI', 'explain-link source-explain')}</span>
          </div>
          <div class="mobile-hud-nick">${profile.nick}<span>L${level}</span></div>
          <div class="mobile-hud-xpbar"><div class="mobile-hud-xpfill" style="width:${pct}%"></div></div>
          <div class="mobile-hud-stats">
            ${hudStats.map(stat => `
              <span class="hud-stat-chip">
                <b>${stat.key}</b>
                <em>${stat.val}</em>
              </span>
            `).join('')}
          </div>
        </div>
        <div class="mobile-hud-side">
          <strong>${streak}</strong>
          <small>${renderExplainButton('seri', 'seri', 'explain-link metric-explain')}</small>
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

function avatarMark(profile = {}) {
  const nick = String(profile.nick || 'OD')
  return escapeHtml(nick.replace(/[^a-z0-9]/gi, '').slice(0, 2).toUpperCase() || 'OD')
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

function localizeKindWords(text = '') {
  let out = String(text)
  for (const [en, tr] of Object.entries(KIND_TR_MAP)) {
    out = out.replace(new RegExp(`\\b${en}\\b`, 'gi'), tr)
  }
  return out
}

function buildTodayLead(state, latestWorkout = null) {
  if (latestWorkout) {
    const meta = [
      latestWorkout.durationMin ? `${latestWorkout.durationMin} dakika` : null,
      latestWorkout.volumeKg ? `${Math.round(latestWorkout.volumeKg).toLocaleString('tr-TR')} kg hacim` : null,
      latestWorkout.source === 'hevy' ? 'Hevy senkron' : null,
    ].filter(Boolean).join(' / ')
    return `${formatMonthShort(latestWorkout.date)} ${latestWorkout.type || 'seans'} kaydi tamam. ${meta || 'Detay az, ama kayit geldi.'}`
  }
  const score = Number(state.health?.readiness?.score)
  if (Number.isFinite(score)) {
    if (score >= 80) return 'Bugun ana blok icin iyi gorunuyor. Hevy ve Telegram akisi geldikce kart kendini yeniler.'
    if (score >= 60) return 'Normal tempo uygun. Son veriler yuk, kaynak ve ritim panellerine dusuyor.'
    if (score >= 40) return 'Kontrollu git. Teknik, core veya daha kisa bir seans mantikli.'
    return 'Yorgunluk yuksek gorunuyor. Bugun hafif teknik veya kisa hareket yeter.'
  }
  return 'Hevy ve Telegram kayitlari geldikce karakter karti, skill agaci ve gorevler canli veriden guncellenir.'
}

function renderTodayPage(state, profile, semantic) {
  const readiness = Number(state.health?.readiness?.score)
  const armor = Math.round(Number(state.profile?.armor) || 0)
  const fatigue = Math.round(Number(state.profile?.fatigue) || 0)
  const streak = Number(state.profile?.streak?.current) || 0
  const activeQuest = [...(profile.quests?.daily || []), ...(profile.quests?.weekly || [])].find(quest => !quest.done)
  const recentSessions = (state.workouts || []).slice(0, 3)
  const latestWorkout = recentSessions[0] || null
  const lead = buildTodayLead(state, latestWorkout)
  const title = latestWorkout ? `${formatMonthShort(latestWorkout.date)} / ${latestWorkout.type || 'Seans'}` : readinessTitle(readiness)
  const heroMetric = latestWorkout?.durationMin
    ? latestWorkout.durationMin
    : Number.isFinite(readiness)
      ? readiness
      : profile.sessions || 0
  const heroMetricLabel = latestWorkout?.durationMin ? 'dk' : Number.isFinite(readiness) ? '/100' : 'seans'
  const sourceLabel = latestWorkout?.source === 'hevy' ? 'HEVY SON KAYIT' : latestWorkout ? 'SON SEANS' : 'BUGUN'

  return `
    <section class="today-page">
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

        <div class="home-stat-strip">
          ${(profile.stats || []).slice(0, 6).map(stat => `
            <button class="home-stat-mini ${stat.critical ? 'crit' : ''}" data-action="open-stat" data-stat-key="${escapeHtml(stat.key)}">
              <span>${escapeHtml(stat.label || stat.key)}</span>
              <strong>${Math.round(Number(stat.val) || 0)}</strong>
            </button>
          `).join('')}
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
          <div><span>${renderExplainButton('hacim', 'Hacim', 'explain-link metric-explain')}</span><strong>${escapeHtml(profile.totalVolume || '0 kg')}</strong></div>
          <div><span>${renderExplainButton('seri', 'Seri', 'explain-link metric-explain')}</span><strong>${streak}g</strong></div>
        </div>

        ${renderHomeDataDeck(state, profile)}
      </article>

      ${renderTodayDecisionCard(state, profile, activeQuest)}

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
          <p>${escapeHtml(activeQuest.desc || '')}</p>
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
    summary: 'ODIE bu kartta bugunku ana tercihi tek cumleye indirir: agir seans, teknik gun, recovery veya denge kapatma.',
    bullets: [
      'Fatigue, armor, son seans, recovery sayaci ve acik gorevler birlikte okunur.',
      'Bu bir yasak listesi degil; bugunku en mantikli ilk hamledir.',
      'Karar degisirse sebebi genelde yeni seans, yeni daily log veya zamanla dusen fatigue olur.',
    ],
  },
  'denge-kapatma': {
    title: 'Denge Kapatma',
    summary: 'Son 30 gunde geride kalan hattin kisa bir blokla tamamlanmasi demek.',
    bullets: [
      'Ornek: push/pull cok yuksek ama core azsa seansa 8-10 dk core ile baslamak.',
      'Amac ana programi bozmak degil; acik kalan halkayi kapatmak.',
      'Bu kart genelde Core, Bacak, mobilite veya recovery eksigi gorunurse cikar.',
    ],
  },
  'recovery-gunu': {
    title: 'Recovery Gunu',
    summary: 'Yuk bindirmek yerine toparlanmayi hizlandiran gun.',
    bullets: [
      'Fatigue yuksekken agir push/pull yerine yuruyus, mobilite veya hafif teknik secilir.',
      'Hedef XP kasmak degil; bir sonraki verimli seansi acmaktir.',
      '40 saatlik toparlanma sayaci ilerledikce karar tekrar normale donebilir.',
    ],
  },
  'kontrollu-teknik': {
    title: 'Kontrollu Teknik',
    summary: 'Risk varken tamamen durmadan, yuk yerine kalite calismak.',
    bullets: [
      'PR denemesi veya hacim kovalamak yerine form, accessory ve dusuk riskli bloklar.',
      'Armor dusuk veya readiness zayifken kullanilir.',
      'Seans kisa kalabilir; veri girisi yine de build ritmini korur.',
    ],
  },
  'normal-seans': {
    title: 'Normal Seans',
    summary: 'Recovery riski dusuk, ana blok acilabilir demek.',
    bullets: [
      'Fatigue kabul edilebilir seviyededir ve armor kritik degildir.',
      'Yine de acik denge gap varsa kisa tamamlayici blok eklenebilir.',
    ],
  },
  fatigue: {
    title: 'Fatigue',
    summary: 'Sinir sistemi ve genel yorgunluk sayaci. Yuksekse agir seans verimi duser.',
    bullets: [
      'Agir, uzun veya PR iceren seanslardan sonra artar.',
      'Son antrenman bittikten sonra 2 saatlik ticklerle azalir.',
      '40 saat dolunca fatigue sifira iner.',
    ],
  },
  armor: {
    title: 'Armor',
    summary: 'Tendon/eklem toleransi gibi dusun. Dusuk armor, ayni yukun daha riskli olmasi demek.',
    bullets: [
      'Yuksek fatigue ustune agir seans armor azaltabilir.',
      "Recovery, mobilite ve zaman armor'u tekrar 100'e yaklastirir.",
      'Armor kritik dusunce ODIE daha temkinli karar verir.',
    ],
  },
  'recovery-trend': {
    title: 'Recovery Trend',
    summary: 'Son seans bittikten sonra 40 saatlik toparlanma ilerlemesini gosterir.',
    bullets: [
      'Her 2 saatte bir fatigue biraz duser, armor biraz dolar.',
      'Uyku, su ve adim ortalamalari kartin altinda destek sinyali olarak durur.',
      'Bu kart anlik hissi degil, kayitli veriye gore matematiksel toparlanmayi gosterir.',
    ],
  },
  'denge-paneli': {
    title: 'Denge Paneli',
    summary: 'Son 30 gunde Push, Pull, Bacak ve Core hatlarinin ne kadar calistigini karsilastirir.',
    bullets: [
      'Bar uzunlugu en yuksek hatta gore normalize edilir.',
      'Sari bar en geride kalan hatti isaret eder.',
      'Amac simetrik olmak degil; ihmal edilen hatti erken yakalamak.',
    ],
  },
  push: {
    title: 'Push',
    summary: 'Itis hatti: bench, press, dips, push-up, triceps ve gogus/omuz baskin isler.',
  },
  pull: {
    title: 'Pull',
    summary: 'Cekis hatti: row, pull-up, pulldown, curl, dead hang ve sirt/biceps isleri.',
  },
  legs: {
    title: 'Bacak',
    summary: 'Alt vucut hatti: squat, lunge, leg press, calf, posterior chain ve kosu/yuruyus bacak etkisi.',
  },
  core: {
    title: 'Core',
    summary: 'Govde stabilitesi hatti: hollow, plank, leg raise, L-sit, anti-rotation ve trunk kontrolu.',
    bullets: [
      "ODIE core'u sadece yuruyusten saymaz; direkt core veya block sinyali arar.",
      'Core gerideyse skill ve sakatlik toleransi da etkilenebilir.',
    ],
  },
  xp: {
    title: 'XP',
    summary: 'Seansin karakter ilerlemesine yazdigi puan.',
    bullets: [
      "Seans tipi, streak, class carpani, PR ve survival durumu XP'yi etkiler.",
      'Fatigue asiri yuksekse agir seans XP verimi dusebilir.',
    ],
  },
  hacim: {
    title: 'Hacim',
    summary: 'Kaldirilan toplam yuk. Genelde kilo x tekrar toplamidir.',
    bullets: [
      'Bodyweight hareketlerde kilo bilgisi varsa daha dogru hesaplanir.',
      'Hacim tek basina kalite degildir; sure, set ve recovery ile birlikte okunur.',
    ],
  },
  seri: {
    title: 'Seri',
    summary: 'Arka arkaya gelen antrenman gunleri. Bosluk uzarsa seri kirilir.',
  },
  kaynak: {
    title: 'Kaynak',
    summary: 'Workout verisinin nereden geldigini gosterir: Hevy, Telegram veya web/manual.',
  },
  ritim: {
    title: 'Ritim',
    summary: 'Son 7 gunde workout veya daily log izi olan gun sayisi.',
    bullets: [
      'Ritim sadece agir antrenman degil; recovery logu da davranis zincirini gosterir.',
    ],
  },
  datalarim: {
    title: 'Datalarim',
    summary: 'Son 7 seansin yuk grafigi. Hacim varsa kilo, yoksa sure/set/XP sinyali kullanilir.',
  },
  readiness: {
    title: 'Readiness',
    summary: 'Bugunku hazirlik skoru. Armor/fatigue, yuk ve daily log sinyallerinden turetilir.',
  },
  'daily-status': {
    title: 'Vucut Durumu',
    summary: 'Bugunku can, yorgunluk ve seri ozetidir. Kart, karakterin seansa ne kadar acik oldugunu hizli okutur.',
    bullets: [
      'Can armor degerinden, yorgunluk fatigue degerinden gelir.',
      'Seri davranis zincirini gosterir; tek basina agir calismak zorunda degildir.',
    ],
  },
  'current-focus': {
    title: 'Current Focus',
    summary: "ODIE'nin su an en cok dikkat edilmesi gereken hat olarak okudugu alan.",
    bullets: [
      'Kritik stat, kas dengesi, son seans tipi ve class sinyali birlikte okunur.',
      'Yeni workout veya daily log geldikce focus degisebilir.',
    ],
  },
  class: {
    title: 'Class',
    summary: 'Son antrenman deseninden tureyen aktif RPG arketipi.',
    bullets: [
      'Push/pull/core/movement dagilimi degistikce class da degisebilir.',
      'Class XP ve recovery carpani gibi kucuk pasif etkiler tasir.',
    ],
  },
  'active-quests': {
    title: 'Aktif Gorevler',
    summary: 'Bugun veya bu hafta kapanabilecek kucuk hedeflerdir.',
    bullets: [
      'Class veya coach tarafindan acilabilir.',
      'Progress tamamlaninca XP, stat ya da ritim etkisi yazilir.',
    ],
  },
  'combat-stats': {
    title: 'Combat Stats',
    summary: 'STR, AGI, END, DEX, CON ve STA karakter parametrelerinin canli ozetidir.',
    bullets: [
      'Stat kartina basinca ilgili statin neden yukseldigi veya kritik oldugu acilir.',
      'Son seans delta verisi varsa kartta UP veya kritik flag gorunur.',
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
    title: 'Skill Tree',
    summary: 'Uzun vadeli hareket yeteneklerini branch mantigiyla takip eder.',
    bullets: [
      'Done node tamamlanmis, prog node ilerleyen, lock node henuz acilmamis beceridir.',
      'Class ve workout verisi bazi branchleri one cikarabilir.',
    ],
  },
  'daily-checklist': {
    title: 'Gunluk Durum',
    summary: 'Su, uyku, adim ve mood kaydi recovery hesabina destek sinyali verir.',
    bullets: [
      'Bu kayitlar tek seans yerine genel hazirlik trendini duzeltir.',
      'Eksik log, ODIE kararini daha temkinli yapabilir.',
    ],
  },
  'coach-feedback': {
    title: 'Coach Feedback',
    summary: 'ODIE yorumlarina verdigin DOGRU/YANLIS/ESKI/TONU IYI isaretlerinin ozeti.',
    bullets: [
      'Yanlis isaretleri coach hafizasini temizlemek icin sinyal olur.',
      "Tonu iyi isareti ODIE'nin konusma bicimini korumasina yardim eder.",
    ],
  },
  'session-detail': {
    title: 'Seans Detayi',
    summary: 'Kaydedilen antrenmanin ham veriye en yakin ozeti.',
    bullets: [
      'Sure, hacim, set, XP, PR ve kaynak burada birlikte gorunur.',
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
    summary: 'Seansin parcalara ayrilmis calisma hatlari: strength, core, locomotion, mobility, skill gibi.',
  },
  fact: {
    title: 'Kanit / Fact',
    summary: "Parser'in seans notundan ayikladigi somut ipuclari. Coach cevabinin dayanaklarindan biridir.",
  },
  pr: {
    title: 'PR',
    summary: 'Personal record sinyali. Hareket, tekrar, kilo veya surede yeni en iyi performans olabilir.',
  },
  water: {
    title: 'Su',
    summary: 'Gunluk su kaydi. Recovery yorumunda destek sinyali olarak kullanilir.',
  },
  sleep: {
    title: 'Uyku',
    summary: 'Son gun uyku saati. Hazirlik ve recovery kararlarinda en guclu yan sinyallerden biridir.',
  },
  steps: {
    title: 'Adim',
    summary: 'Gunluk hareket miktari. Dusuk yogunluklu toparlanma ve genel ritim icin okunur.',
  },
  mood: {
    title: 'Mood',
    summary: 'Bugunku his skoru. Coach kararini tek basina degil, fatigue ve armor ile birlikte etkiler.',
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
    summary: 'Armor, fatigue, readiness ve risk uyarilarinin coach ekranindaki teknik ozeti.',
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
    title: 'Seans Okumasi',
    summary: 'ODIE parserinin son seansi ne kadar net anladigini ve hangi verilere dayandigini gosterir.',
  },
  confidence: {
    title: 'Netlik',
    summary: 'Seans kaydinin ne kadar iyi parse edildigini gosteren guven skoru.',
  },
  'parsed-piece': {
    title: 'Okunan Parca',
    summary: 'Seans notundan veya Hevy verisinden ayiklanan somut ipucu sayisi.',
  },
  'main-load': {
    title: 'Ana Yuk',
    summary: 'Seansin baskin calisma tipi ve blok dagilimi.',
  },
  evidence: {
    title: 'Dayanak',
    summary: 'Coach veya Ask cevabinin hangi veri parcalarina baktigini gosterir.',
  },
  memory: {
    title: 'Kalici Hafiza',
    summary: "ODIE'nin senden ogrendigi kalici tercih, risk ve hedef notlari.",
  },
  'live-context': {
    title: 'Canli Baglam',
    summary: 'Coach yorumunun o anki seans, uyarilar ve acik hedeflerle beslendigini gosterir.',
  },
  'ask-line': {
    title: 'ODIE Hatti',
    summary: 'Sorularin ayri kaydoldugu ve cevaplarin workout/recovery baglamindan uretildigi panel.',
  },
  'ask-answer': {
    title: 'Kisa Yorum',
    summary: 'Son soruya verilen ana cevap. Detaylar dayanak ve sonraki adim kartlarinda ayrilir.',
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
    summary: 'Web uzerinden manuel workout kaydi girme modali.',
  },
  'workout-date': {
    title: 'Tarih',
    summary: 'Seansin hangi gune yazilacagini belirler.',
  },
  'workout-type': {
    title: 'Seans Tipi',
    summary: 'Workoutun ana kategorisi. Class, denge paneli ve stat delta hesabina sinyal verir.',
  },
  duration: {
    title: 'Sure',
    summary: 'Seansin dakika cinsinden suresi. Hacim yoksa yuk tahmininde destek sinyali olur.',
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
    title: 'Highlight',
    summary: 'Seansin en onemli notu: PR, teknik kalite, zorlanan bolge veya ozel durum.',
  },
  notes: {
    title: 'Notlar',
    summary: 'Coach parserinin okuyabilecegi serbest metin alani.',
  },
  exercises: {
    title: 'Egzersizler',
    summary: 'Hareket, tekrar, kilo veya sure detaylari. Hacim ve PR hesaplarini guclendirir.',
  },
  volume: {
    title: 'Toplam Hacim',
    summary: 'Formdaki egzersizlerden hesaplanan toplam kg yukudur.',
  },
  hevy: {
    title: 'Hevy',
    summary: 'Hevy uygulamasindan gelen structured workout kaydi.',
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
      title: 'Recovery gunu',
      command: 'Agir push/pull yok; 25-35 dk yuruyus veya mobilite.',
      reason: `Fatigue ${Math.round(fatigue)}. ${recovery ? `${recovery.progressPct}% toparlanma isledi.` : 'Toparlanma verisi sinirli.'}`,
      next: balance.lowest?.key === 'core' ? '8 dk core aktivasyon eklenebilir.' : 'Yuk degil, ritim koru.',
    }
  }

  if (armor < 55 || (Number.isFinite(readiness) && readiness < 45)) {
    return {
      key: 'kontrollu-teknik',
      tone: 'warn',
      title: 'Kontrollu teknik',
      command: 'Kisa teknik blok veya accessory; PR denemesi yok.',
      reason: `Armor ${Math.round(armor)} ve hazirlik ${Number.isFinite(readiness) ? Math.round(readiness) : '--'}/100.`,
      next: nextQuest || 'Gunluk logu kapat, uyku/su sinyalini tamamla.',
    }
  }

  if (balance.lowest?.key === 'legs' || balance.lowest?.key === 'core') {
    return {
      key: 'denge-kapatma',
      tone: 'warn',
      title: 'Denge kapatma',
      command: balance.lowest.key === 'legs'
        ? 'Bacak veya posterior chain blok ekle.'
        : 'Seansa direkt core ile basla.',
      reason: `${balance.lowest.label} son 30 gunde en geride kalan hat.`,
      next: nextQuest || 'Kisa ama net blok yeter.',
    }
  }

  return {
    key: 'normal-seans',
    tone: 'calm',
    title: 'Normal seans',
    command: latest ? `${latest.type || 'Ana blok'} temposu acilabilir.` : 'Ilk seansi net logla.',
    reason: `Fatigue ${Math.round(fatigue)}, armor ${Math.round(armor)}.`,
    next: nextQuest || 'Set, sure ve hareketleri temiz gir.',
  }
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
          <p>${escapeHtml(decision.command)}</p>
        </div>
        <div class="today-decision-meter">
          <strong>${Math.round(Number(state.profile?.fatigue) || 0)}</strong>
          <span>${renderExplainButton('fatigue', 'fatigue', 'explain-link metric-explain')}</span>
        </div>
      </div>
      <div class="today-decision-foot">
        <span>${escapeHtml(decision.reason)}</span>
        <span>${escapeHtml(decision.next)}</span>
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
    ? `${Math.floor(recovery.elapsedHours)} saat gecti, ${recovery.fatigueRecovered} fatigue dustu`
    : 'Yeni seans geldikce 40 saatlik toparlanma sayaci baslar.'

  return `
    <article class="glass-card today-insight-card recovery-trend-card">
      <div class="insight-card-head">
        <div>
          <div class="eyebrow">${renderExplainButton('recovery-trend', 'Recovery Trend', 'explain-link eyebrow-explain')}</div>
          <h3>${renderExplainButton('recovery-trend', '40 saatlik toparlanma', 'explain-link explain-heading')}</h3>
        </div>
        <strong>${progress}%</strong>
      </div>
      <p>${escapeHtml(subtitle)}</p>
      <div class="insight-meter-list">
        ${renderInsightMeter('Fatigue', fatigue, 'danger')}
        ${renderInsightMeter('Armor', armor, 'ok')}
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
    push: { key: 'push', label: 'Push', value: 0 },
    pull: { key: 'pull', label: 'Pull', value: 0 },
    legs: { key: 'legs', label: 'Bacak', value: 0 },
    core: { key: 'core', label: 'Core', value: 0 },
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
          <h3>${renderExplainButton('denge-paneli', 'Push / Pull / Bacak / Core', 'explain-link explain-heading')}</h3>
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
          <div class="eyebrow">${renderExplainButton('coach-feedback', 'Coach Feedback', 'explain-link eyebrow-explain')}</div>
          <h3>${renderExplainButton('coach-feedback', 'ODIE kalite dongusu', 'explain-link explain-heading')}</h3>
        </div>
        <strong>${total}</strong>
      </div>
      <div class="feedback-count-grid">
        <span><b>${counts.correct || 0}</b>DOGRU</span>
        <span><b>${counts.wrong || 0}</b>YANLIS</span>
        <span><b>${counts.outdated || 0}</b>ESKI</span>
        <span><b>${counts.prefer || 0}</b>TON</span>
      </div>
      <p>${latest ? `${latest.feedbackType} / ${latest.note || 'son isaret'}` : 'Coach kartlarindan isaret geldikce ODIE tonu ve hafizasi temizlenir.'}</p>
    </article>
  `
}

function renderHomeDataDeck(state, profile) {
  const workouts = state.workouts || []
  const bars = buildHomeLoadBars(workouts, profile)
  const sourceMix = buildHomeSourceMix(workouts)
  const rhythm = buildHomeRhythm(state)
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
          <span>${renderExplainButton('datalarim', 'DATALARIM', 'explain-link metric-explain')}</span>
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
          <span>${renderExplainButton('kaynak', 'KAYNAK', 'explain-link metric-explain')}</span>
          <strong>${sourceMix.total}</strong>
        </div>
        <div class="home-source-stack">
          ${sourceMix.parts.map(part => `<span class="${part.key}" style="width:${part.pct}%"></span>`).join('')}
        </div>
        <div class="home-source-legend">
          ${sourceMix.parts.map(part => `<small>${escapeHtml(part.label)} ${part.count}</small>`).join('')}
        </div>
      </div>

      <div class="home-data-card">
        <div class="home-data-head">
          <span>${renderExplainButton('ritim', 'RITIM', 'explain-link metric-explain')}</span>
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
        title: `${formatMonthShort(workout.date)} / ${workout.type || 'Seans'} / ${volume ? `${formatCompactMetric(volume)} kg` : `${Math.round(minutes)} dk`}`,
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
  const title = `${formatMonthShort(workout.date)} / ${workout.type || 'Seans'}`
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
  const blocks = workout.blocks || []
  const statDelta = workout.statDelta || workout.stat_delta || {}
  const facts = (state.workoutFacts || []).filter(item => String(item.workoutId || item.workout_id || '') === String(workout.id)).slice(0, 6)
  const title = `${formatMonthShort(workout.date)} / ${workout.type || 'Seans'}`
  const source = String(workout.source || 'manual').toUpperCase()
  const metrics = [
    { label: 'Sure', value: workout.durationMin ? `${workout.durationMin} dk` : '-', explain: 'session-detail' },
    { label: 'Hacim', value: workout.volumeKg ? `${Math.round(workout.volumeKg).toLocaleString('tr-TR')} kg` : '-', explain: 'hacim' },
    { label: 'Set', value: workout.sets || '-', explain: 'session-detail' },
    { label: 'XP', value: workout.xpEarned ? `+${workout.xpEarned}` : '-', explain: 'xp' },
    { label: 'Kaynak', value: source, explain: source === 'HEVY' ? 'hevy' : 'kaynak' },
    { label: 'PR', value: workout.hasPr ? 'VAR' : 'YOK', explain: 'pr' },
  ]

  openModal(`
    <div class="modal-head">
      <span style="font-size:22px">LOG</span>
      <div class="modal-head-title">${renderExplainButton('session-detail', title, 'explain-link modal-title-explain')}</div>
      <button class="modal-close" data-close-modal aria-label="Kapat">x</button>
    </div>
    <div class="modal-body session-detail-modal">
      <div class="session-detail-hero">
        <div>
          <div class="mini-label">Highlight</div>
          <strong>${escapeHtml(workout.highlight || 'Seans kaydi')}</strong>
          <p>${escapeHtml(workout.notes || 'Ek not yok.')}</p>
        </div>
        <span>${escapeHtml(workout.primaryCategory || 'mixed')}</span>
      </div>
      <div class="modal-grid">
        ${metrics.map(item => `
          <div class="modal-item">
            <div class="modal-item-label">${renderExplainButton(item.explain, item.label, 'explain-link metric-explain')}</div>
            <div class="modal-item-val">${escapeHtml(item.value)}</div>
          </div>
        `).join('')}
      </div>
      <div class="modal-section-label">${renderExplainButton('stat-delta', 'STAT DELTA', 'explain-link metric-explain')}</div>
      ${renderSessionStatDelta(statDelta)}
      <div class="modal-section-label">${renderExplainButton('bloklar', 'BLOKLAR', 'explain-link metric-explain')}</div>
      ${renderSessionBlocks(blocks)}
      <div class="modal-section-label">${renderExplainButton('fact', 'KANIT / FACT', 'explain-link metric-explain')}</div>
      ${facts.length ? `
        <div class="session-fact-list">
          ${facts.map(fact => `<span>${escapeHtml(fact.label || fact.raw || fact.blockKind || 'fact')}</span>`).join('')}
        </div>
      ` : '<div class="modal-coach">Bu seans icin ayri fact kaydi yok; bloklar workout verisinden okunuyor.</div>'}
    </div>
  `)
}

function renderSessionStatDelta(delta = {}) {
  const items = ['str', 'agi', 'end', 'dex', 'con', 'sta']
    .map(key => ({ key: key.toUpperCase(), value: Number(delta?.[key]) || 0 }))
    .filter(item => item.value > 0)
  if (!items.length) return '<div class="modal-coach">Bu kayitta stat delta sinyali yok.</div>'
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
              <strong>${escapeHtml(block.label || block.kind)}</strong>
              <span>${escapeHtml(block.kind || 'mixed')} ${meta ? `/ ${meta}` : ''}</span>
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
            <span class="pixel-label">${renderExplainButton('armor', 'ARMOR', 'explain-link metric-explain')}</span>
            <div class="pix-bar"><div class="pix-bar-fill green" style="width:${armor}%"></div></div>
            <span class="bar-val">${armor}</span>
          </div>
          <div class="portrait-bar-row">
            <span class="pixel-label">${renderExplainButton('fatigue', 'FATIGUE', 'explain-link metric-explain')}</span>
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
          <div class="eyebrow">${renderExplainButton('combat-stats', 'Combat Stats', 'explain-link eyebrow-explain')}</div>
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
  const delta = Number(latestDelta?.[stat.key]) || 0
  const upFlag = delta > 0 ? `<span class="stat-pixel-flag" style="background:var(--mmo-emerald)">UP</span>` : ''
  const critFlag = stat.critical ? `<span class="stat-pixel-flag">F</span>` : ''
  return `
    <button class="stat-pixel ${stat.critical ? 'crit' : ''}" data-action="open-stat" data-stat-key="${escapeHtml(stat.key)}" aria-label="${escapeHtml(stat.name)} detayini ac">
      <span class="stat-pixel-icon">${escapeHtml(stat.label || stat.key || '*')}</span>
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
          <div class="pixel-label">${renderExplainButton('skill-tree', 'Skill Tree', 'explain-link metric-explain')}</div>
          <div class="panel-title">${renderExplainButton('skill-tree', 'Branch noktalari', 'explain-link explain-heading')}</div>
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
          <div class="eyebrow">${renderExplainButton('active-quests', 'Active Quests', 'explain-link eyebrow-explain')}</div>
          <h3>${renderExplainButton('active-quests', 'Gorev defteri', 'explain-link explain-heading')}</h3>
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

  if (action === 'open-workout') {
    openWorkoutForm()
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
