function summarizeWeightHistory(history = []) {
  const rows = [...(history || [])]
    .filter(item => item?.date)
    .sort((left, right) => String(right.date || '').localeCompare(String(left.date || '')))
    .slice(0, 4)

  const latest = rows[0] || null
  const oldest = rows[rows.length - 1] || null
  const deltaKg = latest?.weightKg != null && oldest?.weightKg != null && rows.length > 1
    ? Math.round((latest.weightKg - oldest.weightKg) * 10) / 10
    : 0

  return {
    rows,
    latest,
    deltaKg,
  }
}

function renderBodyHistory(p) {
  const trend = summarizeWeightHistory(p.bodyMetricsHistory || [])
  if (!trend.rows.length) return ''

  const deltaLabel = trend.deltaKg
    ? `${trend.deltaKg > 0 ? '+' : ''}${trend.deltaKg}kg trend`
    : 'stabil gorunum'

  return `
    <div class="body-history-card">
      <div class="body-history-head">
        <div>
          <div class="mini-label">Body History</div>
          <strong>${trend.latest?.weightKg || '-'} kg</strong>
        </div>
        <span class="body-history-chip">${deltaLabel}</span>
      </div>
      <div class="body-history-list">
        ${trend.rows.map(item => `
          <div class="body-history-row">
            <span>${item.date}</span>
            <strong>${item.weightKg || '-'}kg</strong>
            <small>${item.heightCm || '-'}cm</small>
          </div>
        `).join('')}
      </div>
    </div>
  `
}

export function renderHealth(p) {
  const { metrics, warnings, readiness } = p.health

  const metricCards = metrics.map(m => `
    <div class="hcard" style="--hc:${m.color}">
      <div class="hcard-icon">${m.icon}</div>
      <div class="hval">${m.val}</div>
      <div class="hlbl">${m.label}</div>
      <div class="hsub">${m.sub}</div>
    </div>`).join('')

  const warningRows = warnings.map(w => `
    <div class="dbf" style="--dc:${w.color}">
      <div>
        <div class="dbf-name">${w.icon} ${w.name}</div>
        <div class="dbf-desc">${w.desc}</div>
      </div>
    </div>`).join('')

  const warningsSection = warnings.length
    ? `<div class="sec">Saglik Uyarilari</div>${warningRows}`
    : ''

  const readinessSection = readiness
    ? `
      <div class="readiness-card readiness-${readiness.confidence || 'low'}">
        <div class="readiness-head">
          <div>
            <div class="mini-label">Recovery Confidence</div>
            <strong>${String(readiness.confidence || 'low').toUpperCase()}</strong>
          </div>
          <span class="readiness-source">${readiness.source || 'limited_data'}</span>
        </div>
        <p>${readiness.reason || 'Recovery guven notu yok.'}</p>
      </div>
    `
    : ''

  const historySection = renderBodyHistory(p)

  return `
    <div class="sec">Vucut & Saglik Metrikleri</div>
    ${readinessSection}
    <div class="health-grid">${metricCards}</div>
    ${historySection}
    ${warningsSection}`
}
