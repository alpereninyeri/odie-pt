/**
 * Günlük Hızlı Giriş Widget'ı — Su, Uyku, Adım
 * Stats paneli üstüne eklenir.
 * store üzerinden veriyi okur ve yazar.
 */

import { store } from '../data/store.js'
import { upsertDailyLog } from '../data/supabase-client.js'

export function renderDailyChecklist() {
  const today = new Date().toISOString().slice(0, 10)
  const logs  = store.getState()?.dailyLogs || []
  const log   = logs.find(l => l.date === today) || { waterMl: 0, sleepHours: 0, steps: 0 }

  const waterL    = (log.waterMl / 1000).toFixed(1)
  const waterPct  = Math.min(100, Math.round((log.waterMl / 2500) * 100))
  const sleepPct  = Math.min(100, Math.round((log.sleepHours / 8) * 100))
  const stepsPct  = Math.min(100, Math.round((log.steps / 12000) * 100))

  return `
    <div class="daily-checklist" id="daily-checklist">
      <div class="dc-title">📅 BUGÜN — ${_formatDate(today)}</div>

      <div class="dc-row">
        <div class="dc-icon">💧</div>
        <div class="dc-info">
          <div class="dc-lbl">Su</div>
          <div class="dc-bar"><div class="dc-fill" style="width:${waterPct}%;background:var(--blu)"></div></div>
        </div>
        <div class="dc-val" id="dc-water-val">${waterL}L / 2.5L</div>
        <div class="dc-btns">
          <button class="dc-btn" data-action="water" data-amount="500">+0.5L</button>
          <button class="dc-btn" data-action="water" data-amount="1000">+1L</button>
        </div>
      </div>

      <div class="dc-row">
        <div class="dc-icon">😴</div>
        <div class="dc-info">
          <div class="dc-lbl">Uyku</div>
          <div class="dc-bar"><div class="dc-fill" style="width:${sleepPct}%;background:var(--pur)"></div></div>
        </div>
        <div class="dc-val" id="dc-sleep-val">${log.sleepHours}h / 8h</div>
        <div class="dc-btns">
          <input class="dc-input" type="number" id="dc-sleep-input" min="0" max="16" step="0.5"
            placeholder="7.5" value="${log.sleepHours || ''}"
            title="Uyku saatini gir">
          <button class="dc-btn" data-action="sleep">✓</button>
        </div>
      </div>

      <div class="dc-row">
        <div class="dc-icon">👟</div>
        <div class="dc-info">
          <div class="dc-lbl">Adım</div>
          <div class="dc-bar"><div class="dc-fill" style="width:${stepsPct}%;background:var(--gold)"></div></div>
        </div>
        <div class="dc-val" id="dc-steps-val">${log.steps.toLocaleString('tr-TR')} / 12k</div>
        <div class="dc-btns">
          <input class="dc-input" type="number" id="dc-steps-input" min="0"
            placeholder="12000" value="${log.steps || ''}"
            title="Adım sayısını gir">
          <button class="dc-btn" data-action="steps">✓</button>
        </div>
      </div>
    </div>`
}

export function initDailyChecklist() {
  const el = document.getElementById('daily-checklist')
  if (!el) return

  el.removeEventListener('click', el._dcHandler)
  el._dcHandler = async e => {
    const btn = e.target.closest('[data-action]')
    if (!btn) return

    const today   = new Date().toISOString().slice(0, 10)
    const logs    = store.getState()?.dailyLogs || []
    const logIdx  = logs.findIndex(l => l.date === today)
    const current = logIdx >= 0 ? { ...logs[logIdx] } : { date: today, waterMl: 0, sleepHours: 0, steps: 0, mood: 3 }

    switch (btn.dataset.action) {
      case 'water': {
        const amount = parseInt(btn.dataset.amount) || 500
        current.waterMl = Math.min(5000, current.waterMl + amount)
        _updateDisplay('dc-water-val', `${(current.waterMl / 1000).toFixed(1)}L / 2.5L`)
        _updateBar(el, 0, Math.min(100, Math.round((current.waterMl / 2500) * 100)), 'var(--blu)')
        break
      }
      case 'sleep': {
        const val = parseFloat(document.getElementById('dc-sleep-input')?.value)
        if (isNaN(val) || val < 0 || val > 20) return
        current.sleepHours = val
        _updateDisplay('dc-sleep-val', `${val}h / 8h`)
        _updateBar(el, 1, Math.min(100, Math.round((val / 8) * 100)), 'var(--pur)')
        break
      }
      case 'steps': {
        const val = parseInt(document.getElementById('dc-steps-input')?.value)
        if (isNaN(val) || val < 0) return
        current.steps = val
        _updateDisplay('dc-steps-val', `${val.toLocaleString('tr-TR')} / 12k`)
        _updateBar(el, 2, Math.min(100, Math.round((val / 12000) * 100)), 'var(--gold)')
        break
      }
    }

    // Store güncelle
    const newLogs = [...logs]
    if (logIdx >= 0) newLogs[logIdx] = current
    else newLogs.unshift(current)
    store.set('dailyLogs', newLogs)

    // Supabase'e yaz (async, UI beklemez)
    try { await upsertDailyLog(current) } catch { /* offline OK */ }

    // Quest progress güncelle (quests-engine)
    _updateQuestProgress(current)
  }
  el.addEventListener('click', el._dcHandler)
}

function _updateDisplay(id, text) {
  const el = document.getElementById(id)
  if (el) el.textContent = text
}

function _updateBar(container, rowIndex, pct, color) {
  const fills = container.querySelectorAll('.dc-fill')
  if (fills[rowIndex]) {
    fills[rowIndex].style.width = pct + '%'
    fills[rowIndex].style.background = color
  }
}

function _updateQuestProgress(log) {
  // Quest'lere etkiyi güncelle
  const state = store.getState()
  if (!state?.quests?.daily) return

  const newQuests = { ...state.quests }
  newQuests.daily = state.quests.daily.map(q => {
    if (q.icon === '💧' && q.name.includes('Hidrasyon')) {
      return { ...q, progress: log.waterMl / 1000, done: log.waterMl >= 2500 }
    }
    if (q.icon === '😴' && q.name.includes('Uyku')) {
      return { ...q, progress: log.sleepHours, done: log.sleepHours >= 8 }
    }
    if (q.icon === '🚶' && q.name.includes('Adım')) {
      return { ...q, progress: log.steps, done: log.steps >= q.total }
    }
    return q
  })
  store.set('quests', newQuests)
}

function _formatDate(isoDate) {
  const [y, m, d] = isoDate.split('-')
  const months = ['Ock', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara']
  return `${d} ${months[parseInt(m) - 1]} ${y}`
}
