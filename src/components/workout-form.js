import { store } from '../data/store.js'
import { detectPRs } from '../data/pr-detector.js'
import { getLocalDateString } from '../data/rules.js'
import { computeVolumeWithBodyweight } from '../data/volume-utils.js'
import { closeModal, openModal } from './modal.js'
import { showBadgeToasts, showPRToast, showXPToast } from './toast.js'

const WORKOUT_TYPES = [
  'Push',
  'Pull',
  'Shoulder',
  'Bacak',
  'Parkour',
  'Akrobasi',
  'Calisthenics',
  'Gym',
  'Yuruyus',
  'Bisiklet',
  'Kayak',
  'Tirmanis',
  'Kosu',
  'Stretching',
  'Custom',
]

export function openWorkoutForm() {
  openModal(renderForm(getLocalDateString()))
  bindForm()
}

function renderForm(date) {
  return `
    <div class="modal-head">
      <span style="font-size:22px">+</span>
      <div class="modal-head-title">Yeni seans ekle</div>
      <button class="modal-close" data-close-modal aria-label="Kapat">×</button>
    </div>
    <div class="modal-body">
      <form id="workout-form" autocomplete="off">
        <div class="wf-row">
          <label class="wf-label">Tarih</label>
          <input class="wf-input" type="date" id="wf-date" value="${date}" required>
        </div>

        <div class="wf-row">
          <label class="wf-label">Seans tipi</label>
          <select class="wf-input wf-select" id="wf-type">
            ${WORKOUT_TYPES.map(type => `<option value="${type}">${type}</option>`).join('')}
          </select>
        </div>

        <div class="wf-set-row">
          <div class="wf-row">
            <label class="wf-label">Sure (dk)</label>
            <input class="wf-input" type="number" id="wf-duration" min="1" max="720" placeholder="60" required>
          </div>
          <div class="wf-row">
            <label class="wf-label">Mesafe km</label>
            <input class="wf-input" type="number" id="wf-distance" min="0" step="0.1" placeholder="Opsiyonel">
          </div>
          <div class="wf-row">
            <label class="wf-label">Yukselti m</label>
            <input class="wf-input" type="number" id="wf-elevation" min="0" step="1" placeholder="Opsiyonel">
          </div>
        </div>

        <div class="wf-row">
          <label class="wf-label">Highlight</label>
          <input class="wf-input" type="text" id="wf-highlight" placeholder="PR, teknik blok, set kalitesi...">
        </div>

        <div class="wf-row">
          <label class="wf-label">Notlar</label>
          <textarea class="wf-input" id="wf-notes" rows="3" placeholder="Yorgunluk, zemin, denge, carry, teknik his..."></textarea>
        </div>

        <div class="wf-section-title">Egzersizler <span class="wf-optional">(opsiyonel)</span></div>
        <div id="wf-exercises"></div>
        <button type="button" class="wf-add-ex" id="wf-add-exercise">+ Egzersiz ekle</button>

        <div class="wf-volume-preview" id="wf-volume-preview" style="display:none">
          Toplam hacim: <strong id="wf-volume-val">0 kg</strong>
        </div>

        <div class="wf-actions">
          <button type="submit" class="wf-submit" id="wf-submit">Kaydet</button>
        </div>
      </form>
    </div>
  `
}

function bindForm() {
  const form = document.getElementById('workout-form')
  if (!form) return

  document.getElementById('wf-add-exercise')?.addEventListener('click', addExerciseRow)
  form.addEventListener('input', updateVolumePreview)

  form.addEventListener('submit', async event => {
    event.preventDefault()
    const submit = document.getElementById('wf-submit')
    if (submit) {
      submit.disabled = true
      submit.textContent = 'Kaydediliyor...'
    }

    try {
      await saveWorkout()
      closeModal()
      window.__refreshActivePanel?.()
    } catch (error) {
      console.error('[workout-form] save error:', error)
      if (submit) {
        submit.disabled = false
        submit.textContent = 'Kaydet'
      }
    }
  })
}

function addExerciseRow() {
  const container = document.getElementById('wf-exercises')
  if (!container) return

  const index = container.children.length
  const row = document.createElement('div')
  row.className = 'wf-ex-row'
  row.innerHTML = `
    <input class="wf-input wf-ex-name" type="text" placeholder="Egzersiz adi">
    <div class="wf-sets-list" id="wf-sets-${index}">
      ${renderSetRow()}
    </div>
    <button type="button" class="wf-add-set" data-ex="${index}">+ Set</button>
    <button type="button" class="wf-remove-ex" data-ex="${index}">Sil</button>
  `
  container.appendChild(row)

  row.querySelector('.wf-add-set')?.addEventListener('click', () => {
    document.getElementById(`wf-sets-${index}`)?.insertAdjacentHTML('beforeend', renderSetRow())
    updateVolumePreview()
  })

  row.querySelector('.wf-remove-ex')?.addEventListener('click', () => {
    row.remove()
    updateVolumePreview()
  })
}

function renderSetRow() {
  return `
    <div class="wf-set-row">
      <input class="wf-input wf-set-reps" type="number" min="1" placeholder="Rep">
      <input class="wf-input wf-set-weight" type="number" min="0" step="0.5" placeholder="kg">
      <input class="wf-input wf-set-dur" type="number" min="1" placeholder="sn">
    </div>
  `
}

function collectExercises() {
  return [...document.querySelectorAll('.wf-ex-row')].map(row => {
    const name = row.querySelector('.wf-ex-name')?.value?.trim()
    if (!name) return null

    const sets = [...row.querySelectorAll('.wf-set-row')].map(setRow => {
      const reps = Number(setRow.querySelector('.wf-set-reps')?.value) || null
      const weightKg = Number(setRow.querySelector('.wf-set-weight')?.value) || null
      const durationSec = Number(setRow.querySelector('.wf-set-dur')?.value) || null
      if (!reps && !weightKg && !durationSec) return null
      return { reps, weightKg, durationSec }
    }).filter(Boolean)

    return { name, sets }
  }).filter(Boolean)
}

function getBodyWeight() {
  return Number(store.getState()?.bodyMetrics?.weightKg) || Number(store.getProfile?.()?.bodyMetrics?.weightKg) || 0
}

function updateVolumePreview() {
  const exercises = collectExercises()
  const totalVolume = computeVolumeWithBodyweight(exercises, getBodyWeight())

  const preview = document.getElementById('wf-volume-preview')
  const value = document.getElementById('wf-volume-val')
  if (!preview || !value) return

  preview.style.display = totalVolume > 0 ? 'block' : 'none'
  value.textContent = `${totalVolume.toLocaleString('tr-TR')} kg`
}

async function saveWorkout() {
  const exercises = collectExercises()
  const volumeKg = computeVolumeWithBodyweight(exercises, getBodyWeight())
  const sets = exercises.reduce((sum, exercise) => sum + (exercise.sets || []).length, 0)

  const session = {
    date: document.getElementById('wf-date')?.value,
    type: document.getElementById('wf-type')?.value,
    durationMin: Number(document.getElementById('wf-duration')?.value) || 0,
    distanceKm: Number(document.getElementById('wf-distance')?.value) || 0,
    elevationM: Number(document.getElementById('wf-elevation')?.value) || 0,
    highlight: document.getElementById('wf-highlight')?.value?.trim() || '',
    notes: document.getElementById('wf-notes')?.value?.trim() || '',
    exercises,
    volumeKg,
    sets,
    source: 'manual',
  }

  const { hasPr, newPrs } = detectPRs(session, store.getState()?.prs || {})
  session.hasPr = hasPr

  const workout = await store.addWorkout(session)
  showXPToast(workout.xpEarned, workout.xpMultiplier)

  if (hasPr) {
    Object.entries(newPrs).forEach(([exercise, pr]) => {
      const value = pr.weightKg && pr.reps
        ? `${pr.weightKg}kg x ${pr.reps}`
        : pr.reps
          ? `${pr.reps} rep`
          : `${pr.durationSec}sn`
      showPRToast(exercise, value)
    })
  }

  const newBadges = store.get('_newBadges')
  if (newBadges?.length) {
    showBadgeToasts(newBadges)
    store.set('_newBadges', [])
  }
}
