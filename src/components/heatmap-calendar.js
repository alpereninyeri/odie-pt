import { getLocalDateString, normalizeDateString } from '../data/rules.js'

const MONTH_LABELS = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara']
const DAY_LABELS = ['Pzt', '', 'Çar', '', 'Cum', '', 'Paz']
const CELL = 11
const GAP = 2

function _isMobile() {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(max-width: 560px)').matches
}

function escapeAttr(value = '') {
  return String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function tone(durationMin) {
  if (!durationMin) return 0
  if (durationMin < 30) return 1
  if (durationMin < 60) return 2
  if (durationMin < 90) return 3
  return 4
}

function _aggregate(workouts = []) {
  const map = new Map()
  for (const workout of (workouts || [])) {
    const date = normalizeDateString(workout.date)
    if (!date) continue
    const entry = map.get(date) || { date, durationMin: 0, sessions: 0, types: new Set() }
    entry.durationMin += Number(workout.durationMin) || 0
    entry.sessions += 1
    if (workout.type) entry.types.add(workout.type)
    map.set(date, entry)
  }
  return map
}

function _formatDateLabel(dateStr) {
  const [y, m, d] = dateStr.split('-')
  return `${Number(d)} ${MONTH_LABELS[Number(m) - 1]} ${y}`
}

export function renderHeatmap(workouts = [], todayStr = getLocalDateString()) {
  const today = new Date(`${normalizeDateString(todayStr)}T00:00:00`)
  const todayDow = (today.getDay() + 6) % 7

  const mobile = _isMobile()
  const totalDays = mobile ? 182 : 365
  const startTs = today.getTime() - ((totalDays - 1) * 86400000)
  const startDate = new Date(startTs)
  const startDow = (startDate.getDay() + 6) % 7
  const firstSundayOffset = startDow
  const totalCells = firstSundayOffset + totalDays + (6 - todayDow)
  const weekCount = Math.ceil(totalCells / 7)

  const aggregated = _aggregate(workouts)
  const cells = []
  let lastMonthLabeled = -1
  const monthLabels = []

  for (let week = 0; week < weekCount; week += 1) {
    for (let dayOfWeek = 0; dayOfWeek < 7; dayOfWeek += 1) {
      const cellIndex = (week * 7) + dayOfWeek
      const dayOffset = cellIndex - firstSundayOffset
      if (dayOffset < 0 || dayOffset >= totalDays) continue

      const cellDate = new Date(startTs + (dayOffset * 86400000))
      const dateStr = `${cellDate.getFullYear()}-${String(cellDate.getMonth() + 1).padStart(2, '0')}-${String(cellDate.getDate()).padStart(2, '0')}`
      const entry = aggregated.get(dateStr)
      const t = tone(entry?.durationMin || 0)
      const x = week * (CELL + GAP)
      const y = dayOfWeek * (CELL + GAP)
      const isToday = dateStr === normalizeDateString(todayStr)
      const sessions = entry?.sessions || 0
      const types = entry ? [...entry.types].slice(0, 2).join(' / ') : ''
      const tooltip = entry
        ? `${_formatDateLabel(dateStr)} · ${entry.durationMin}dk · ${sessions} seans${types ? ` · ${types}` : ''}`
        : `${_formatDateLabel(dateStr)} · seans yok`

      cells.push(`<rect x="${x}" y="${y}" width="${CELL}" height="${CELL}" rx="2" ry="2" class="heatmap-cell tone-${t}${isToday ? ' today' : ''}" data-date="${escapeAttr(dateStr)}"><title>${escapeAttr(tooltip)}</title></rect>`)

      if (cellDate.getDate() === 1 || (week === 0 && dayOfWeek === firstSundayOffset)) {
        const month = cellDate.getMonth()
        if (month !== lastMonthLabeled) {
          lastMonthLabeled = month
          monthLabels.push({ x, label: MONTH_LABELS[month] })
        }
      }
    }
  }

  const dayLabelOffset = 24
  const monthLabelOffset = 14
  const svgWidth = dayLabelOffset + (weekCount * (CELL + GAP))
  const svgHeight = monthLabelOffset + (7 * (CELL + GAP))

  const dayLabels = DAY_LABELS.map((label, index) => {
    if (!label) return ''
    const y = monthLabelOffset + (index * (CELL + GAP)) + (CELL / 2) + 3
    return `<text x="0" y="${y}" class="heatmap-day-label">${label}</text>`
  }).join('')

  const monthLabelMarkup = monthLabels.map(item => (
    `<text x="${dayLabelOffset + item.x}" y="${monthLabelOffset - 4}" class="heatmap-month-label">${item.label}</text>`
  )).join('')

  const totals = (workouts || []).reduce((sum, workout) => sum + (Number(workout.durationMin) || 0), 0)
  const activeDayCount = aggregated.size
  const periodLabel = mobile ? '6 ay' : '365 gun'
  const stats = `${activeDayCount} aktif · ${Math.round(totals / 60)}s · ${weekCount}h`

  return `
    <article class="glass-card heatmap-card">
      <div class="section-top">
        <div>
          <div class="eyebrow">${periodLabel} Aktivite</div>
          <h3>Aktivite haritasi</h3>
        </div>
        <div class="heatmap-summary">${stats}</div>
      </div>
      <div class="heatmap-svg-wrap">
        <svg viewBox="0 0 ${svgWidth} ${svgHeight}" width="${svgWidth}" height="${svgHeight}" class="heatmap-svg">
          ${monthLabelMarkup}
          <g transform="translate(${dayLabelOffset}, ${monthLabelOffset})">
            ${cells.join('')}
          </g>
          ${dayLabels}
        </svg>
      </div>
      <div class="heatmap-legend">
        <span>Az</span>
        <i class="heatmap-cell tone-0"></i>
        <i class="heatmap-cell tone-1"></i>
        <i class="heatmap-cell tone-2"></i>
        <i class="heatmap-cell tone-3"></i>
        <i class="heatmap-cell tone-4"></i>
        <span>Cok</span>
      </div>
    </article>
  `
}
