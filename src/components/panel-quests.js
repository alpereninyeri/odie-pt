let activeQuestTab = 'daily'

export function renderQuests(p) {
  return `
    <div class="quest-ops">
      ${renderQuestOps(p)}
    </div>
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

function renderQuestOps(p) {
  const daily = p.quests.daily || []
  const weekly = p.quests.weekly || []
  const urgent = [...daily, ...weekly].filter(quest => quest.urgent && !(quest.done || quest.progress >= quest.total)).length
  const done = [...daily, ...weekly].filter(quest => quest.done || quest.progress >= quest.total).length
  const nextQuest = [...daily, ...weekly].find(quest => !(quest.done || quest.progress >= quest.total))
  const rewardCount = [...daily, ...weekly].reduce((sum, quest) => sum + (Number(String(quest.reward || '').replace(/[^\d]/g, '')) || 0), 0)

  return `
    <div class="progress-brief-grid">
      <article class="brief-card tone-gold">
        <span class="brief-kicker">Next Objective</span>
        <strong>${nextQuest?.name || 'Quest temiz'}</strong>
        <p>${nextQuest?.desc || 'Açık görev kalmadığında yeni loop burada görünür.'}</p>
      </article>
      <article class="brief-card tone-danger">
        <span class="brief-kicker">Pressure</span>
        <strong>${urgent} urgent</strong>
        <p>${done} görev tamamlanmış durumda. Kalan board buradan hızlı okunuyor.</p>
      </article>
      <article class="brief-card tone-emerald">
        <span class="brief-kicker">Board Value</span>
        <strong>${rewardCount} XP</strong>
        <p>Günlük ve haftalık board üzerindeki toplam görünür ödül havuzu.</p>
      </article>
    </div>
  `
}

function renderQuestSection(p) {
  const daily = p.quests.daily
  const weekly = p.quests.weekly
  const items = activeQuestTab === 'daily' ? daily : weekly

  const questItems = items.map(quest => {
    const pct = Math.min(100, Math.round((quest.progress / quest.total) * 100))
    const isDone = quest.done || quest.progress >= quest.total
    return `
      <div class="qitem ${quest.urgent && !isDone ? 'urgent' : ''} ${isDone ? 'done' : ''}">
        <div class="qcheck ${isDone ? 'done' : ''}">${isDone ? '✓' : ''}</div>
        <div class="qico">${quest.icon}</div>
        <div class="qinfo">
          <div class="qname">${quest.name}${quest.urgent && !isDone ? ' <span class="nbadge">URGENT</span>' : ''}</div>
          <div class="qdesc">${quest.desc}</div>
          <div class="qprog-track">
            <div class="qprog-fill ${isDone ? '' : pct < 30 ? 'red' : ''}" style="width:${pct}%"></div>
          </div>
          <div class="qprog-txt">${quest.progress} / ${quest.total} ${isDone ? '— TAMAMLANDI ✓' : `(${pct}%)`}</div>
        </div>
        <div class="qreward">${quest.reward}</div>
      </div>`
  }).join('')

  const dailyDone = daily.filter(quest => quest.done || quest.progress >= quest.total).length
  const weeklyDone = weekly.filter(quest => quest.done || quest.progress >= quest.total).length

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
  const cards = p.achievements.map(achievement => `
    <div class="ach ${achievement.unlocked ? 'unlocked' : ''}">
      <div class="ach-icon">${achievement.icon}</div>
      <div class="ach-name">${achievement.name}</div>
      <div class="ach-desc">${achievement.desc}</div>
      ${achievement.unlocked
        ? `<div class="ach-date">${achievement.date}</div>`
        : `<div class="ach-req">${achievement.req}</div>`}
    </div>`).join('')
  return `<div class="ach-grid">${cards}</div>`
}

function renderLog(p) {
  const rows = p.workoutLog.map(workout => `
    <tr>
      <td class="log-date">${workout.date}</td>
      <td class="log-type">${workout.type}</td>
      <td class="log-dur">${workout.duration}</td>
      <td class="log-vol">${workout.volume}</td>
      <td class="log-hl">${workout.highlight}</td>
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

  section.removeEventListener('click', section._questsHandler)
  section._questsHandler = event => {
    const button = event.target.closest('[data-qtab]')
    if (!button) return
    activeQuestTab = button.dataset.qtab
    section.innerHTML = renderQuestSection(p)
  }
  section.addEventListener('click', section._questsHandler)
}
