let activeQuestTab = 'daily'

export function renderQuests(p) {
  return `
    <div id="quest-section">
      ${renderQuestSection(p)}
    </div>
    <div style="margin-top:32px">
      <div class="sec">Başarılar</div>
      ${renderAchievements(p)}
    </div>
    <div style="margin-top:32px">
      <div class="sec">Antrenman Geçmişi</div>
      ${renderLog(p)}
    </div>`
}

function renderQuestSection(p) {
  const daily = p.quests.daily
  const weekly = p.quests.weekly
  const items = activeQuestTab === 'daily' ? daily : weekly

  const questItems = items.map(q => {
    const pct = Math.min(100, Math.round((q.progress / q.total) * 100))
    const isDone = q.done || q.progress >= q.total
    return `
      <div class="qitem ${q.urgent && !isDone ? 'urgent' : ''} ${isDone ? 'done' : ''}">
        <div class="qcheck ${isDone ? 'done' : ''}">${isDone ? '✓' : ''}</div>
        <div class="qico">${q.icon}</div>
        <div class="qinfo">
          <div class="qname">${q.name}${q.urgent && !isDone ? ' <span class="nbadge">URGENT</span>' : ''}</div>
          <div class="qdesc">${q.desc}</div>
          <div class="qprog-track">
            <div class="qprog-fill ${isDone ? '' : pct < 30 ? 'red' : ''}" style="width:${pct}%"></div>
          </div>
          <div class="qprog-txt">${q.progress} / ${q.total} ${isDone ? '— TAMAMLANDI ✓' : `(${pct}%)`}</div>
        </div>
        <div class="qreward">${q.reward}</div>
      </div>`
  }).join('')

  const dailyDone = daily.filter(q => q.done || q.progress >= q.total).length
  const weeklyDone = weekly.filter(q => q.done || q.progress >= q.total).length

  return `
    <div class="sec">Görevler</div>
    <div class="quest-tabs">
      <button class="qtab ${activeQuestTab === 'daily' ? 'active' : ''}" data-qtab="daily">
        Günlük (${dailyDone}/${daily.length})
      </button>
      <button class="qtab ${activeQuestTab === 'weekly' ? 'active' : ''}" data-qtab="weekly">
        Haftalık (${weeklyDone}/${weekly.length})
      </button>
    </div>
    <div id="quest-list">${questItems}</div>`
}

function renderAchievements(p) {
  const cards = p.achievements.map(a => `
    <div class="ach ${a.unlocked ? 'unlocked' : ''}">
      <div class="ach-icon">${a.icon}</div>
      <div class="ach-name">${a.name}</div>
      <div class="ach-desc">${a.desc}</div>
      ${a.unlocked
        ? `<div class="ach-date">${a.date}</div>`
        : `<div class="ach-req">${a.req}</div>`}
    </div>`).join('')
  return `<div class="ach-grid">${cards}</div>`
}

function renderLog(p) {
  const rows = p.workoutLog.map(w => `
    <tr>
      <td class="log-date">${w.date}</td>
      <td class="log-type">${w.type}</td>
      <td class="log-dur">${w.duration}</td>
      <td class="log-vol">${w.volume}</td>
      <td class="log-hl">${w.highlight}</td>
    </tr>`).join('')

  return `
    <table class="log-table">
      <thead>
        <tr>
          <th>Tarih</th>
          <th>Antrenman</th>
          <th>Süre</th>
          <th>Hacim</th>
          <th>Öne Çıkan</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`
}

export function initQuests(p) {
  const section = document.getElementById('quest-section')
  if (!section) return
  section.addEventListener('click', e => {
    const btn = e.target.closest('[data-qtab]')
    if (!btn) return
    activeQuestTab = btn.dataset.qtab
    section.innerHTML = renderQuestSection(p)
  })
}
