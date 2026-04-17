import './style.css'
import { store } from './data/store.js'
import { renderHeader, initHeader } from './components/header.js'
import { renderStats, initStats } from './components/panel-stats.js'
import { renderMuscles, initMuscles } from './components/panel-muscles.js'
import { renderSkills, initSkills } from './components/panel-skills.js'
import { renderHealth, initHealth } from './components/panel-health.js'
import { renderQuests, initQuests } from './components/panel-quests.js'
import { renderCoach, initCoach } from './components/panel-coach.js'
import { initModal, closeModal } from './components/modal.js'
import { openWorkoutForm } from './components/workout-form.js'
import { renderStatusWidget, initStatusWidget } from './components/status-widget.js'
import { injectToastStyles, showToast } from './components/toast.js'
import { checkStreakIntact } from './data/streak-engine.js'

// ── Başlatma ─────────────────────────────────────────────────────────────────
injectToastStyles()

// Store init (async — Supabase yoksa mock ile çalışır)
store.init().then(() => {
  // Streak'in bozulup bozulmadığını kontrol et
  const streak = store.get('profile.streak')
  if (streak) {
    const checked = checkStreakIntact(streak)
    if (checked.current !== streak.current) store.set('profile.streak', checked)
  }

  renderApp()
  initModal()
  _initPanelForKey('stats')

  // Store değişikliklerinde header'ı yenile
  store.subscribe('profile', () => {
    const headerEl = document.querySelector('.header')
    if (headerEl) {
      const p = store.getProfile()
      headerEl.outerHTML = renderHeader(p)
      initHeader(p)
    }
  })

  // Yeni workout geldiğinde aktif panel'i yenile
  store.subscribe('workouts', () => window.__refreshActivePanel?.())

  // Class değiştiğinde toast
  store.subscribe('_classChanged', (cls) => {
    if (cls?.id) showToast({
      icon: cls.icon,
      title: 'YENİ SINIF — ' + cls.name,
      msg: cls.buff || cls.desc,
      rarity: 'epic',
      duration: 4500,
    })
  })
})

// ── Theme ─────────────────────────────────────────────────────────────────────
function initTheme() {
  const saved = localStorage.getItem('odiept-theme') || 'dark'
  document.documentElement.setAttribute('data-theme', saved)
}
function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'dark'
  const next = current === 'dark' ? 'light' : 'dark'
  document.documentElement.setAttribute('data-theme', next)
  localStorage.setItem('odiept-theme', next)
  const icon  = document.getElementById('themeIcon')
  const label = document.getElementById('themeLabel')
  if (icon)  icon.textContent  = next === 'dark' ? '🌙' : '☀️'
  if (label) label.textContent = next === 'dark' ? 'DARK' : 'LIGHT'
}
initTheme()

// ── Tabs ──────────────────────────────────────────────────────────────────────
const tabs = [
  { key: 'stats',   label: '📊 Stats' },
  { key: 'muscles', label: '💪 Kas' },
  { key: 'skills',  label: '⚔️ Skill' },
  { key: 'health',  label: '❤️ Sağlık' },
  { key: 'quests',  label: '📋 Görevler' },
  { key: 'coach',   label: '☠ Koç' },
]

let activeTab = 'stats'

function renderApp() {
  const p = store.getProfile()
  const theme = document.documentElement.getAttribute('data-theme') || 'dark'
  const tabButtons = tabs.map(t => `
    <button class="tab ${activeTab === t.key ? 'active' : ''}" data-tab="${t.key}">${t.label}</button>
  `).join('')

  const panels = tabs.map(t => `
    <div id="panel-${t.key}" class="panel ${activeTab === t.key ? 'active' : ''}">
      ${getPanelContent(t.key, p)}
    </div>`).join('')

  // Streak badge
  const streak = p.streak
  const streakBadge = streak?.current >= 3
    ? `<div class="streak-badge">${streak.label || '🔥'} ${streak.current} GÜN</div>`
    : ''

  document.getElementById('app').innerHTML = `
    <div class="modal-bg" id="statModal">
      <div class="modal" id="modalContent"></div>
    </div>
    <div class="wrap">
      <button class="theme-toggle" id="themeToggle">
        <span id="themeIcon">${theme === 'dark' ? '🌙' : '☀️'}</span>
        <span class="theme-toggle-label" id="themeLabel">${theme === 'dark' ? 'DARK' : 'LIGHT'}</span>
      </button>
      ${streakBadge}
      ${renderHeader(p)}
      <div class="tabs">${tabButtons}</div>
      ${panels}
    </div>
    <button class="coach-fab ${activeTab === 'coach' ? 'hidden' : ''}" id="coachFab">☠</button>
    <button class="workout-fab" id="workoutFab" title="Antrenman Ekle">➕</button>`

  // Refresh hook — workout-form.js kapandıktan sonra çağrılır
  window.__refreshActivePanel = () => _initPanelForKey(activeTab)
}

function getPanelContent(key, p) {
  switch (key) {
    case 'stats':   return renderStatusWidget() + renderStats(p)
    case 'muscles': return renderMuscles(p)
    case 'skills':  return renderSkills(p)
    case 'health':  return renderHealth(p)
    case 'quests':  return renderQuests(p)
    case 'coach':   return renderCoach(p)
    default:        return ''
  }
}

function _initPanelForKey(key) {
  const p = store.getProfile()
  switch (key) {
    case 'stats':
      initStats(p)
      initStatusWidget()
      break
    case 'muscles': initMuscles(); break
    case 'skills':  initSkills();  break
    case 'health':  initHealth(p); break
    case 'quests':  initQuests(p); break
    case 'coach':   initCoach(p);  break
  }
}

function switchTab(key) {
  if (key === activeTab) return
  closeModal()
  activeTab = key

  document.querySelectorAll('.tab').forEach(t => {
    t.classList.toggle('active', t.dataset.tab === key)
  })
  document.querySelectorAll('.panel').forEach(panel => {
    const isActive = panel.id === `panel-${key}`
    panel.classList.toggle('active', isActive)
    // Aktif panelin içeriğini yenile (güncel store verisiyle)
    if (isActive) {
      panel.innerHTML = getPanelContent(key, store.getProfile())
      _initPanelForKey(key)
    }
  })

  const fab = document.getElementById('coachFab')
  if (fab) fab.classList.toggle('hidden', key === 'coach')
}

// ── Event delegation ──────────────────────────────────────────────────────────
document.addEventListener('click', e => {
  const tab = e.target.closest('[data-tab]')
  if (tab) { switchTab(tab.dataset.tab); return }

  if (e.target.closest('#themeToggle'))   { toggleTheme(); return }
  if (e.target.closest('#coachFab'))      { switchTab('coach'); return }
  if (e.target.closest('#workoutFab'))    { openWorkoutForm(); return }
})
