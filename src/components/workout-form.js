/**
 * Antrenman Giriş Formu — modal olarak açılır.
 * store.addWorkout() ile kaydeder.
 */

import { store } from '../data/store.js'
import { detectPRs } from '../data/pr-detector.js'
import { openModal, closeModal } from './modal.js'
import { showBadgeToasts, showXPToast, showPRToast } from './toast.js'

const WORKOUT_TYPES = ['Push', 'Pull', 'Shoulder', 'Akrobasi', 'Parkour', 'Bacak', 'Yürüyüş', 'Stretching', 'Custom']

export function openWorkoutForm() {
  const today = new Date().toISOString().slice(0, 10)
  openModal(_renderForm(today))
  _bindForm()
}

function _renderForm(date) {
  const typeOptions = WORKOUT_TYPES.map(t =>
    `<option value="${t}">${t}</option>`
  ).join('')

  return `
    <div class="modal-head">
      <span style="font-size:22px">➕</span>
      <div class="modal-head-title">Antrenman Ekle</div>
      <button class="modal-close" data-close-modal aria-label="Kapat">✕</button>
    </div>
    <div class="modal-body">
      <form id="workout-form" autocomplete="off">

        <div class="wf-row">
          <label class="wf-label">Tarih</label>
          <input class="wf-input" type="date" id="wf-date" value="${date}" required>
        </div>

        <div class="wf-row">
          <label class="wf-label">Antrenman Tipi</label>
          <select class="wf-input wf-select" id="wf-type">${typeOptions}</select>
        </div>

        <div class="wf-row">
          <label class="wf-label">Süre (dakika)</label>
          <input class="wf-input" type="number" id="wf-duration" min="1" max="600" placeholder="60" required>
        </div>

        <div class="wf-row">
          <label class="wf-label">Öne Çıkan Not (opsiyonel)</label>
          <input class="wf-input" type="text" id="wf-highlight" placeholder="Bench 62.5kg PR, Barani deneme...">
        </div>

        <div class="wf-section-title">Egzersizler <span class="wf-optional">(opsiyonel)</span></div>
        <div id="wf-exercises"></div>
        <button type="button" class="wf-add-ex" id="wf-add-exercise">+ Egzersiz Ekle</button>

        <div class="wf-volume-preview" id="wf-volume-preview" style="display:none">
          Toplam Hacim: <strong id="wf-volume-val">0 kg</strong>
        </div>

        <div class="wf-actions">
          <button type="submit" class="wf-submit" id="wf-submit">💾 KAYDET</button>
        </div>
      </form>
    </div>`
}

function _bindForm() {
  const form = document.getElementById('workout-form')
  if (!form) return

  document.getElementById('wf-add-exercise')?.addEventListener('click', _addExerciseRow)

  form.addEventListener('input', _updateVolumePreview)

  form.addEventListener('submit', async e => {
    e.preventDefault()
    const submitBtn = document.getElementById('wf-submit')
    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = '⏳ Kaydediliyor...' }

    try {
      await _saveWorkout()
      closeModal()
      // Panel'leri yenile
      window.__refreshActivePanel?.()
    } catch (err) {
      console.error('[workout-form] save error:', err)
      if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = '💾 KAYDET' }
    }
  })
}

function _addExerciseRow() {
  const container = document.getElementById('wf-exercises')
  if (!container) return

  const idx = container.children.length
  const div = document.createElement('div')
  div.className = 'wf-ex-row'
  div.dataset.exIdx = idx
  div.innerHTML = `
    <input class="wf-input wf-ex-name" type="text" placeholder="Egzersiz adı (örn: Bench Press)" list="ex-suggestions">
    <div class="wf-sets-list" id="wf-sets-${idx}">
      ${_setRowHtml(idx, 0)}
    </div>
    <button type="button" class="wf-add-set" data-ex="${idx}">+ Set</button>
    <button type="button" class="wf-remove-ex" data-ex="${idx}">✕</button>
  `
  container.appendChild(div)

  // Autocomplete listesi (önceki egzersizlerden)
  if (!document.getElementById('ex-suggestions')) {
    const dl = document.createElement('datalist')
    dl.id = 'ex-suggestions'
    const seen = store.getState()?.workouts?.flatMap(w =>
      (w.exercises || []).map(e => e.name)
    ) || []
    ;[...new Set(seen)].forEach(name => {
      const opt = document.createElement('option')
      opt.value = name
      dl.appendChild(opt)
    })
    document.body.appendChild(dl)
  }

  // Set ekle butonu
  div.querySelector(`.wf-add-set`)?.addEventListener('click', () => {
    const setsContainer = document.getElementById(`wf-sets-${idx}`)
    if (!setsContainer) return
    const setIdx = setsContainer.children.length
    setsContainer.insertAdjacentHTML('beforeend', _setRowHtml(idx, setIdx))
    _updateVolumePreview()
  })

  // Egzersiz kaldır
  div.querySelector(`.wf-remove-ex`)?.addEventListener('click', () => {
    div.remove()
    _updateVolumePreview()
  })
}

function _setRowHtml(exIdx, setIdx) {
  return `
    <div class="wf-set-row" data-set="${setIdx}">
      <input class="wf-input wf-set-reps"   type="number" min="1" placeholder="Tekrar" data-field="reps">
      <input class="wf-input wf-set-weight" type="number" min="0" step="0.5" placeholder="kg (opsiyonel)" data-field="weight">
      <input class="wf-input wf-set-dur"    type="number" min="1" placeholder="sn (süre) (opsiyonel)" data-field="dur">
    </div>`
}

function _collectExercises() {
  const exRows = document.querySelectorAll('.wf-ex-row')
  return Array.from(exRows).map(row => {
    const name = row.querySelector('.wf-ex-name')?.value?.trim() || ''
    const setRows = row.querySelectorAll('.wf-set-row')
    const sets = Array.from(setRows).map(sr => {
      const reps    = parseInt(sr.querySelector('[data-field="reps"]')?.value)  || null
      const weightKg = parseFloat(sr.querySelector('[data-field="weight"]')?.value) || null
      const durationSec = parseInt(sr.querySelector('[data-field="dur"]')?.value) || null
      const s = {}
      if (reps)        s.reps = reps
      if (weightKg)    s.weightKg = weightKg
      if (durationSec) s.durationSec = durationSec
      return s
    }).filter(s => Object.keys(s).length > 0)
    return name ? { name, sets } : null
  }).filter(Boolean)
}

function _updateVolumePreview() {
  const exercises = _collectExercises()
  const total = exercises.reduce((sum, ex) =>
    sum + (ex.sets || []).reduce((s, set) =>
      s + ((set.weightKg || 0) * (set.reps || 1)), 0
    ), 0
  )
  const preview = document.getElementById('wf-volume-preview')
  const valEl   = document.getElementById('wf-volume-val')
  if (preview && valEl) {
    preview.style.display = total > 0 ? 'block' : 'none'
    valEl.textContent = `${total.toLocaleString('tr-TR')} kg`
  }
}

async function _saveWorkout() {
  const date     = document.getElementById('wf-date')?.value
  const type     = document.getElementById('wf-type')?.value
  const duration = parseInt(document.getElementById('wf-duration')?.value) || 0
  const highlight = document.getElementById('wf-highlight')?.value?.trim() || ''
  const exercises = _collectExercises()

  const volumeKg = exercises.reduce((sum, ex) =>
    sum + (ex.sets || []).reduce((s, set) =>
      s + ((set.weightKg || 0) * (set.reps || 1)), 0
    ), 0
  )
  const sets = exercises.reduce((sum, ex) => sum + (ex.sets || []).length, 0)

  // PR kontrolü
  const currentPrs = store.getState()?.prs || {}
  const { hasPr, newPrs, updatedPrs } = detectPRs({ exercises }, currentPrs)
  if (hasPr) store.set('prs', updatedPrs)

  const session = {
    date,
    type,
    durationMin: duration,
    volumeKg,
    sets,
    highlight,
    exercises,
    hasPr,
  }

  const savedWorkout = await store.addWorkout(session)

  // Toast'lar
  showXPToast(savedWorkout.xpEarned, savedWorkout.xpMultiplier)

  if (hasPr) {
    Object.entries(newPrs).forEach(([name, pr]) => {
      const val = pr.weightKg && pr.reps ? `${pr.weightKg}kg × ${pr.reps}` : pr.reps ? `${pr.reps} rep` : `${pr.durationSec}sn`
      showPRToast(name, val)
    })
  }

  const newBadges = store.get('_newBadges')
  if (newBadges?.length) {
    showBadgeToasts(newBadges)
    store.set('_newBadges', [])
  }
}
