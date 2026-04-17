import { store } from '../data/store.js'
import { getLocalDateString } from '../data/rules.js'

export function renderDailyChecklist() {
  const today = getLocalDateString()
  const logs = store.getState()?.dailyLogs || []
  const log = logs.find(item => item.date === today) || { waterMl: 0, sleepHours: 0, steps: 0 }

  const waterPct = Math.min(100, Math.round((log.waterMl / 2500) * 100))
  const sleepPct = Math.min(100, Math.round((log.sleepHours / 8) * 100))
  const stepsPct = Math.min(100, Math.round((log.steps / 12000) * 100))
  const readiness = Math.round((waterPct + sleepPct + stepsPct) / 3)

  return `
    <div class="daily-checklist compact-daily" id="daily-checklist">
      <div class="section-top compact-top">
        <div>
          <div class="eyebrow">Daily Recovery Board</div>
          <h3>Adim, uyku ve su tek panoda</h3>
        </div>
        <span class="pill pill-emerald">Readiness ${readiness}%</span>
      </div>

      <div class="dc-compact-grid">
        ${renderDailyCard({
          key: 'water',
          icon: '💧',
          label: 'Su',
          value: `${(log.waterMl / 1000).toFixed(1)}L / 2.5L`,
          pct: waterPct,
          tone: 'var(--blu)',
          controls: `
            <button class="dc-btn" data-action="water" data-amount="500">+0.5L</button>
            <button class="dc-btn" data-action="water" data-amount="1000">+1L</button>
          `,
        })}
        ${renderDailyCard({
          key: 'sleep',
          icon: '😴',
          label: 'Uyku',
          value: `${log.sleepHours || 0}h / 8h`,
          pct: sleepPct,
          tone: 'var(--pur)',
          controls: `
            <input class="dc-input" type="number" id="dc-sleep-input" min="0" max="16" step="0.5" placeholder="7.5" value="${log.sleepHours || ''}">
            <button class="dc-btn" data-action="sleep">Kaydet</button>
          `,
        })}
        ${renderDailyCard({
          key: 'steps',
          icon: '👟',
          label: 'Adim',
          value: `${log.steps.toLocaleString('tr-TR')} / 12k`,
          pct: stepsPct,
          tone: 'var(--gold)',
          controls: `
            <input class="dc-input" type="number" id="dc-steps-input" min="0" placeholder="12000" value="${log.steps || ''}">
            <button class="dc-btn" data-action="steps">Kaydet</button>
          `,
        })}
      </div>
    </div>
  `
}

function renderDailyCard({ key, icon, label, value, pct, tone, controls }) {
  return `
    <article class="dc-card">
      <div class="dc-card-top">
        <div class="dc-card-label">
          <span class="dc-icon">${icon}</span>
          <div>
            <div class="dc-lbl">${label}</div>
            <div class="dc-val" id="dc-${key}-val">${value}</div>
          </div>
        </div>
        <strong>${pct}%</strong>
      </div>
      <div class="dc-bar"><div class="dc-fill" data-fill-key="${key}" style="width:${pct}%;background:${tone}"></div></div>
      <div class="dc-btns compact-btns">
        ${controls}
      </div>
    </article>
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
    const existing = logs.find(item => item.date === today) || { date: today, waterMl: 0, sleepHours: 0, steps: 0, mood: 3 }
    const next = { ...existing }

    switch (button.dataset.action) {
      case 'water':
        next.waterMl = Math.min(5000, next.waterMl + (Number(button.dataset.amount) || 500))
        updateDisplay('dc-water-val', `${(next.waterMl / 1000).toFixed(1)}L / 2.5L`)
        updateBar(element, 'water', Math.min(100, Math.round((next.waterMl / 2500) * 100)), 'var(--blu)')
        break
      case 'sleep': {
        const value = Number(document.getElementById('dc-sleep-input')?.value)
        if (!Number.isFinite(value) || value < 0 || value > 20) return
        next.sleepHours = value
        updateDisplay('dc-sleep-val', `${value}h / 8h`)
        updateBar(element, 'sleep', Math.min(100, Math.round((value / 8) * 100)), 'var(--pur)')
        break
      }
      case 'steps': {
        const value = Number(document.getElementById('dc-steps-input')?.value)
        if (!Number.isFinite(value) || value < 0) return
        next.steps = value
        updateDisplay('dc-steps-val', `${value.toLocaleString('tr-TR')} / 12k`)
        updateBar(element, 'steps', Math.min(100, Math.round((value / 12000) * 100)), 'var(--gold)')
        break
      }
    }

    await store.saveDailyLog(next)
  }

  element.addEventListener('click', element._handler)
}

function updateDisplay(id, text) {
  const element = document.getElementById(id)
  if (element) element.textContent = text
}

function updateBar(container, key, pct, color) {
  const fill = container.querySelector(`[data-fill-key="${key}"]`)
  if (!fill) return
  fill.style.width = `${pct}%`
  fill.style.background = color
}
