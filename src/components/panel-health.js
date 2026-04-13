function ringCircle(pct, color, size = 70) {
  const r = (size - 10) / 2
  const circ = 2 * Math.PI * r
  const filled = (pct / 100) * circ
  const gap = circ - filled
  return `
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" style="transform:rotate(-90deg);display:block">
      <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none"
        stroke="var(--bg)" stroke-width="7"/>
      <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none"
        stroke="${color}" stroke-width="7"
        stroke-dasharray="${filled} ${gap}"
        stroke-linecap="round"
        style="transition:stroke-dasharray 1.5s cubic-bezier(.22,.68,0,1.2)"
        data-circ="${circ}" data-pct="${pct}"/>
    </svg>`
}

export function renderHealth(p) {
  const { rings, metrics, warnings } = p.health

  const ringCards = rings.map(r => `
    <div class="ring-card">
      <div class="ring-svg-wrap">
        ${ringCircle(0, r.color)}
        <div class="ring-center">${r.icon}</div>
      </div>
      <div class="ring-name">${r.name}</div>
      <div class="ring-val">${r.current.toLocaleString('tr-TR')} ${r.unit}</div>
      <div class="ring-pct" data-ring-pct="${r.pct}" style="color:${r.color}">%0</div>
    </div>`).join('')

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

  return `
    <div class="sec">Aktivite Halkaları</div>
    <div class="rings-row">${ringCards}</div>

    <div class="sec">Vücut & Sağlık Metrikleri</div>
    <div class="health-grid">${metricCards}</div>

    <div class="sec">Sağlık Uyarıları</div>
    ${warningRows}`
}

export function initHealth(p) {
  const { rings } = p.health
  // Animate rings after panel becomes visible
  requestAnimationFrame(() => {
    setTimeout(() => {
      const circles = document.querySelectorAll('#panel-health circle[data-pct]')
      const pctEls = document.querySelectorAll('#panel-health [data-ring-pct]')

      circles.forEach((c, i) => {
        const pct = parseFloat(c.dataset.pct)
        const circ = parseFloat(c.dataset.circ)
        const filled = (pct / 100) * circ
        const gap = circ - filled
        c.style.strokeDasharray = `${filled} ${gap}`
      })

      pctEls.forEach(el => {
        const target = parseInt(el.dataset.ringPct)
        let cur = 0
        const step = () => {
          cur = Math.min(cur + 2, target)
          el.textContent = `%${cur}`
          if (cur < target) requestAnimationFrame(step)
        }
        setTimeout(() => requestAnimationFrame(step), 300)
      })
    }, 150)
  })
}
