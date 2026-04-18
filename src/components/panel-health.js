export function renderHealth(p) {
  const { metrics, warnings } = p.health

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

  return `
    <div class="sec">Vücut & Sağlık Metrikleri</div>
    <div class="health-grid">${metricCards}</div>
    ${warningsSection}`
}
