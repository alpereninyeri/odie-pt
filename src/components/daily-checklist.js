import { store } from '../data/store.js'
import { getLocalDateString } from '../data/rules.js'

const MOOD_OPTIONS = [
  { value: 1, label: 'Kotu' },
  { value: 2, label: 'Dusuk' },
  { value: 3, label: 'Orta' },
  { value: 4, label: 'Iyi' },
  { value: 5, label: 'Harika' },
]

export function renderDailyChecklist() {
  const today = getLocalDateString()
  const logs = store.getState()?.dailyLogs || []
  const log = logs.find(item => item.date === today) || { waterMl: 0, sleepHours: 0, steps: 0, mood: 0 }

  const waterPct = Math.min(100, Math.round((log.waterMl / 2500) * 100))
  const sleepPct = Math.min(100, Math.round((log.sleepHours / 8) * 100))
  const stepsPct = Math.min(100, Math.round((log.steps / 12000) * 100))
  const currentMood = Number(log.mood) || 0

  return `
    <div class="daily-checklist" id="daily-checklist">
      <div class="dc-title">BUGUN · ${_formatDate(today)}</div>

      <div class="dc-row">
        <div class="dc-icon">💧</div>
        <div class="dc-info">
          <div class="dc-lbl">Su</div>
          <div class="dc-bar"><div class="dc-fill" style="width:${waterPct}%;background:var(--cobalt)"></div></div>
        </div>
        <div class="dc-val" id="dc-water-val">${(log.waterMl / 1000).toFixed(1)}L / 2.5L</div>
        <div class="dc-btns">
          <button class="dc-btn" data-action="water" data-amount="500">+0.5L</button>
          <button class="dc-btn" data-action="water" data-amount="1000">+1L</button>
        </div>
      </div>

      <div class="dc-row">
        <div class="dc-icon">😴</div>
        <div class="dc-info">
          <div class="dc-lbl">Uyku</div>
          <div class="dc-bar"><div class="dc-fill" style="width:${sleepPct}%;background:var(--purple-accent)"></div></div>
        </div>
        <div class="dc-val" id="dc-sleep-val">${log.sleepHours || 0}h / 8h</div>
        <div class="dc-btns">
          <input class="dc-input" type="number" id="dc-sleep-input" min="0" max="16" step="0.5" placeholder="7.5" value="${log.sleepHours || ''}">
          <button class="dc-btn" data-action="sleep">Kaydet</button>
        </div>
      </div>

      <div class="dc-row">
        <div class="dc-icon">👟</div>
        <div class="dc-info">
          <div class="dc-lbl">Adim</div>
          <div class="dc-bar"><div class="dc-fill" style="width:${stepsPct}%;background:var(--amber)"></div></div>
        </div>
        <div class="dc-val" id="dc-steps-val">${log.steps.toLocaleString('tr-TR')} / 12k</div>
        <div class="dc-btns">
          <input class="dc-input" type="number" id="dc-steps-input" min="0" placeholder="12000" value="${log.steps || ''}">
          <button class="dc-btn" data-action="steps">Kaydet</button>
        </div>
      </div>

      <div class="dc-row dc-mood-row">
        <div class="dc-icon">🎭</div>
        <div class="dc-info">
          <div class="dc-lbl">Mood</div>
          <div class="dc-mood-options">
            ${MOOD_OPTIONS.map(option => `
              <button class="dc-mood-btn ${currentMood === option.value ? 'active' : ''}"
                      data-action="mood" data-mood="${option.value}"
                      aria-pressed="${currentMood === option.value}">${option.label}</button>
            `).join('')}
          </div>
        </div>
        <div class="dc-val" id="dc-mood-val">${currentMood ? MOOD_OPTIONS[currentMood - 1].label : '—'}</div>
      </div>
    </div>
  `
}

export function initDailyChecklist() {
  const element = document.getElementById('daily-checklist')
  if (!element) return

  element.removeEventListener('click', element._handler)
  element._handler = async event => {
    const button = event.target.closest('[data-action]')
    if (!button) return

    const today = getLocalDateString()
    const logs = store.getState()?.dailyLogs || []
    const existing = logs.find(item => item.date === today) || { date: today, waterMl: 0, sleepHours: 0, steps: 0, mood: 0 }
    const next = { ...existing }

    switch (button.dataset.action) {
      case 'water':
        next.waterMl = Math.min(5000, next.waterMl + (Number(button.dataset.amount) || 500))
        _updateDisplay('dc-water-val', `${(next.waterMl / 1000).toFixed(1)}L / 2.5L`)
        _updateBar(element, 0, Math.min(100, Math.round((next.waterMl / 2500) * 100)), 'var(--cobalt)')
        break
      case 'sleep': {
        const value = Number(document.getElementById('dc-sleep-input')?.value)
        if (!Number.isFinite(value) || value < 0 || value > 16) return
        next.sleepHours = value
        _updateDisplay('dc-sleep-val', `${value}h / 8h`)
        _updateBar(element, 1, Math.min(100, Math.round((value / 8) * 100)), 'var(--purple-accent)')
        break
      }
      case 'steps': {
        const value = Number(document.getElementById('dc-steps-input')?.value)
        if (!Number.isFinite(value) || value < 0) return
        next.steps = value
        _updateDisplay('dc-steps-val', `${value.toLocaleString('tr-TR')} / 12k`)
        _updateBar(element, 2, Math.min(100, Math.round((value / 12000) * 100)), 'var(--amber)')
        break
      }
      case 'mood': {
        const value = Math.max(1, Math.min(5, Number(button.dataset.mood) || 0))
        if (!value) return
        next.mood = value
        const label = ['', 'Kotu', 'Dusuk', 'Orta', 'Iyi', 'Harika'][value]
        _updateDisplay('dc-mood-val', label)
        element.querySelectorAll('.dc-mood-btn').forEach(node => {
          const active = Number(node.dataset.mood) === value
          node.classList.toggle('active', active)
          node.setAttribute('aria-pressed', active ? 'true' : 'false')
        })
        break
      }
    }

    await store.saveDailyLog(next)
  }

  element.addEventListener('click', element._handler)
}

function _updateDisplay(id, text) {
  const element = document.getElementById(id)
  if (element) element.textContent = text
}

function _updateBar(container, index, pct, color) {
  const fills = container.querySelectorAll('.dc-fill')
  if (!fills[index]) return
  fills[index].style.width = `${pct}%`
  fills[index].style.background = color
}

function _formatDate(isoDate) {
  const [year, month, day] = isoDate.split('-')
  const months = ['Ock', 'Sub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Agu', 'Eyl', 'Eki', 'Kas', 'Ara']
  return `${day} ${months[Number(month) - 1]} ${year}`
}
