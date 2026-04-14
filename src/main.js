import './style.css'
import { profile } from './data/profile.js'
import { renderHeader, initHeader } from './components/header.js'
import { renderStats, initStats } from './components/panel-stats.js'
import { renderMuscles, initMuscles } from './components/panel-muscles.js'
import { renderSkills, initSkills } from './components/panel-skills.js'
import { renderHealth, initHealth } from './components/panel-health.js'
import { renderQuests, initQuests } from './components/panel-quests.js'
import { renderCoach, initCoach } from './components/panel-coach.js'
import { initModal, closeModal } from './components/modal.js'

// Expose closeModal globally for inline onclick in modal HTML
window.__closeModal = closeModal

// ── Theme ──
function initTheme() {
  const saved = localStorage.getItem('odiept-theme') || 'dark'
  document.documentElement.setAttribute('data-theme', saved)
}
function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'dark'
  const next = current === 'dark' ? 'light' : 'dark'
  document.documentElement.setAttribute('data-theme', next)
  localStorage.setItem('odiept-theme', next)
  const icon = document.getElementById('themeIcon')
  if (icon) icon.textContent = next === 'dark' ? '🌙' : '☀️'
  const label = document.getElementById('themeLabel')
  if (label) label.textContent = next === 'dark' ? 'DARK' : 'LIGHT'
}
initTheme()

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
  const theme = document.documentElement.getAttribute('data-theme') || 'dark'
  const tabButtons = tabs.map(t => `
    <button class="tab ${activeTab === t.key ? 'active' : ''}" data-tab="${t.key}">${t.label}</button>
  `).join('')

  const panels = tabs.map(t => `
    <div id="panel-${t.key}" class="panel ${activeTab === t.key ? 'active' : ''}">
      ${getPanelContent(t.key)}
    </div>`).join('')

  document.getElementById('app').innerHTML = `
    <div class="modal-bg" id="statModal">
      <div class="modal" id="modalContent"></div>
    </div>
    <div class="wrap">
      <button class="theme-toggle" id="themeToggle">
        <span id="themeIcon">${theme === 'dark' ? '🌙' : '☀️'}</span>
        <span class="theme-toggle-label" id="themeLabel">${theme === 'dark' ? 'DARK' : 'LIGHT'}</span>
      </button>
      ${renderHeader(profile)}
      <div class="tabs">${tabButtons}</div>
      ${panels}
    </div>
    <button class="coach-fab ${activeTab === 'coach' ? 'hidden' : ''}" id="coachFab">☠</button>`
}

function getPanelContent(key) {
  switch (key) {
    case 'stats':   return renderStats(profile)
    case 'muscles': return renderMuscles(profile)
    case 'skills':  return renderSkills(profile)
    case 'health':  return renderHealth(profile)
    case 'quests':  return renderQuests(profile)
    case 'coach':   return renderCoach(profile)
    default:        return ''
  }
}

function initActivePanel(key) {
  switch (key) {
    case 'stats':   initStats(profile); break
    case 'muscles': initMuscles(); break
    case 'skills':  initSkills(); break
    case 'health':  initHealth(profile); break
    case 'quests':  initQuests(profile); break
    case 'coach':   initCoach(profile); break
  }
}

function switchTab(key) {
  if (key === activeTab) return
  closeModal()
  activeTab = key

  document.querySelectorAll('.tab').forEach(t => {
    t.classList.toggle('active', t.dataset.tab === key)
  })
  document.querySelectorAll('.panel').forEach(p => {
    p.classList.toggle('active', p.id === `panel-${key}`)
  })

  // Show/hide FAB
  const fab = document.getElementById('coachFab')
  if (fab) fab.classList.toggle('hidden', key === 'coach')

  initActivePanel(key)
}

// Boot
renderApp()
initModal()
initHeader(profile)
initStats(profile)

// Event delegation
document.addEventListener('click', e => {
  const tab = e.target.closest('[data-tab]')
  if (tab) { switchTab(tab.dataset.tab); return }

  if (e.target.closest('#themeToggle')) { toggleTheme(); return }

  if (e.target.closest('#coachFab')) { switchTab('coach'); return }
})
