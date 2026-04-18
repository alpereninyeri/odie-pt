let activeQuestTab = 'daily'

function progressPct(item) {
  return Math.min(100, Math.round((Number(item.progress) / Math.max(1, Number(item.total) || 1)) * 100))
}

function isDone(item) {
  return item.done || Number(item.progress) >= Number(item.total)
}

function renderQuestCard(quest) {
  const pct = progressPct(quest)
  const done = isDone(quest)
  return `
    <div class="quest-card ${done ? 'done' : ''} ${quest.urgent && !done ? 'urgent' : ''}">
      <div class="quest-card-head">
        <div class="quest-card-title">
          <span class="quest-icon">${quest.icon}</span>
          <div>
            <strong>${quest.name}</strong>
            <small>${quest.reward}</small>
          </div>
        </div>
        <span class="quest-state">${done ? 'CLEAR' : `${pct}%`}</span>
      </div>
      <p>${quest.desc}</p>
      <div class="quest-progress">
        <div class="quest-progress-track"><div class="quest-progress-fill" style="width:${pct}%"></div></div>
        <span>${quest.progress} / ${quest.total}</span>
      </div>
    </div>
  `
}

function renderAchievements(p) {
  return `
    <div class="trophy-grid">
      ${p.achievements.map(item => `
        <div class="trophy-card ${item.unlocked ? 'unlocked' : ''}">
          <div class="trophy-icon">${item.icon}</div>
          <strong>${item.name}</strong>
          <p>${item.desc}</p>
          <small>${item.unlocked ? item.date : item.req}</small>
        </div>
      `).join('')}
    </div>
  `
}

function renderRaidLog(p) {
  return `
    <div class="raid-log-list">
      ${p.workoutLog.map(item => `
        <div class="raid-log-card">
          <div class="raid-log-top">
            <strong>${item.type}</strong>
            <span>${item.date}</span>
          </div>
          <div class="raid-log-meta">
            <span>${item.duration}</span>
            <span>${item.volume}</span>
          </div>
          <p>${item.highlight}</p>
        </div>
      `).join('')}
    </div>
  `
}

function renderQuestSection(p) {
  const daily = p.quests.daily || []
  const weekly = p.quests.weekly || []
  const items = activeQuestTab === 'daily' ? daily : weekly
  const dailyDone = daily.filter(isDone).length
  const weeklyDone = weekly.filter(isDone).length

  return `
    <div class="campaign-toggle">
      <button class="qtab ${activeQuestTab === 'daily' ? 'active' : ''}" data-qtab="daily">Daily ${dailyDone}/${daily.length}</button>
      <button class="qtab ${activeQuestTab === 'weekly' ? 'active' : ''}" data-qtab="weekly">Weekly ${weeklyDone}/${weekly.length}</button>
    </div>
    <div class="quest-card-grid">
      ${items.map(renderQuestCard).join('')}
    </div>
  `
}

export function renderQuests(p, semantic = {}) {
  const daily = p.quests.daily || []
  const weekly = p.quests.weekly || []
  const openObjectives = [...daily, ...weekly].filter(item => !isDone(item)).length

  return `
    <div id="quest-section">
      <div class="sec">Campaign Board</div>
      <div class="campaign-summary-grid">
        <div class="ops-mini-card">
          <span class="mini-label">Open Objectives</span>
          <strong>${openObjectives}</strong>
          <small>active board load</small>
        </div>
        <div class="ops-mini-card">
          <span class="mini-label">Leg Pressure</span>
          <strong>${semantic.counts?.legs || 0}</strong>
          <small>lower chain hits</small>
        </div>
        <div class="ops-mini-card">
          <span class="mini-label">Core Pressure</span>
          <strong>${semantic.counts?.core || 0}</strong>
          <small>trunk signal</small>
        </div>
        <div class="ops-mini-card">
          <span class="mini-label">Mobility Ops</span>
          <strong>${semantic.counts?.mobility || 0}</strong>
          <small>recovery branch</small>
        </div>
      </div>
      ${renderQuestSection(p)}
    </div>

    <div class="training-subsection">
      <div class="sec">Achievement Sheet</div>
      ${renderAchievements(p)}
    </div>

    <div class="training-subsection">
      <div class="sec">Raid Log</div>
      ${renderRaidLog(p)}
    </div>
  `
}

export function initQuests(p) {
  const section = document.getElementById('quest-section')
  if (!section) return
  section.removeEventListener('click', section._questsHandler)
  section._questsHandler = event => {
    const button = event.target.closest('[data-qtab]')
    if (!button) return
    activeQuestTab = button.dataset.qtab
    section.innerHTML = `
      <div class="sec">Campaign Board</div>
      <div class="campaign-summary-grid">
        <div class="ops-mini-card">
          <span class="mini-label">Open Objectives</span>
          <strong>${[...p.quests.daily, ...p.quests.weekly].filter(item => !isDone(item)).length}</strong>
          <small>active board load</small>
        </div>
        <div class="ops-mini-card">
          <span class="mini-label">Daily Clear</span>
          <strong>${p.quests.daily.filter(isDone).length}/${p.quests.daily.length}</strong>
          <small>today</small>
        </div>
        <div class="ops-mini-card">
          <span class="mini-label">Weekly Clear</span>
          <strong>${p.quests.weekly.filter(isDone).length}/${p.quests.weekly.length}</strong>
          <small>cycle</small>
        </div>
        <div class="ops-mini-card">
          <span class="mini-label">Campaign Mode</span>
          <strong>${activeQuestTab === 'daily' ? 'Daily' : 'Weekly'}</strong>
          <small>active tab</small>
        </div>
      </div>
      ${renderQuestSection(p)}
    `
  }
  section.addEventListener('click', section._questsHandler)
}
