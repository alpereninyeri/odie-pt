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
    ? `<div class="sec">Sağlık Uyarıları</div>${warningRows}`
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
        <p>${readiness.reason || 'Recovery güven notu yok.'}</p>
      </div>
    `
    : ''

  return `
    <div class="sec">Vücut & Sağlık Metrikleri</div>
    ${readinessSection}
    <div class="health-grid">${metricCards}</div>
    ${warningsSection}`
}
