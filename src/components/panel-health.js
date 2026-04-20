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

function renderBodyHistory(profile, compact = false) {
  const trend = summarizeWeightHistory(profile.bodyMetricsHistory || [])
  if (!trend.rows.length) return ''

  const deltaLabel = trend.deltaKg
    ? `${trend.deltaKg > 0 ? '+' : ''}${trend.deltaKg}kg`
    : 'stabil'

  return `
    <div class="body-history-card ${compact ? 'compact' : ''}">
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

function renderMetricCard(metric, compact = false) {
  return `
    <div class="vital-card ${compact ? 'compact' : ''}" style="--hc:${metric.color}">
      <div class="vital-card-top">
        <span class="vital-card-icon">${metric.icon}</span>
        <strong>${metric.val}</strong>
      </div>
      <div class="vital-card-label">${metric.label}</div>
      <small>${metric.sub}</small>
    </div>
  `
}

export function renderHealth(profile, options = {}) {
  const compact = Boolean(options?.compact)
  const { metrics = [], warnings = [], readiness = null } = profile.health || {}

  const visibleMetrics = compact ? metrics.slice(1, 5) : metrics
  const warningsSection = warnings.length
    ? `
      <div class="health-warning-list">
        ${warnings.map(item => `
          <div class="dbf" style="--dc:${item.color}">
            <div>
              <div class="dbf-name">${item.icon} ${item.name}</div>
              <div class="dbf-desc">${item.desc}</div>
            </div>
          </div>
        `).join('')}
      </div>
    `
    : ''

  const readinessSection = readiness
    ? `
      <div class="readiness-card ${compact ? 'compact' : ''} readiness-${readiness.confidence || 'low'}">
        <div class="readiness-head">
          <div>
            <div class="mini-label">${compact ? 'Recovery Trust' : 'Recovery Confidence'}</div>
            <strong>${Number.isFinite(readiness.score) ? readiness.score : '--'}/100</strong>
          </div>
          <span class="readiness-source">${String(readiness.confidence || 'low').toUpperCase()}</span>
        </div>
        <p>${readiness.reason || 'Recovery guven notu yok.'}</p>
      </div>
    `
    : ''

  return `
    ${compact ? '' : '<div class="sec">Vital Codex</div>'}
    ${readinessSection}
    <div class="vital-grid ${compact ? 'compact' : ''}">
      ${visibleMetrics.map(metric => renderMetricCard(metric, compact)).join('')}
    </div>
    ${renderBodyHistory(profile, compact)}
    ${warningsSection}
  `
}
