let activeQuestTab = 'daily'

function progressPct(item) {
  return Math.min(100, Math.round((Number(item.progress) / Math.max(1, Number(item.total) || 1)) * 100))
}

function isDone(item) {
  return item.done || Number(item.progress) >= Number(item.total)
}

function ringLabel(item) {
  return isDone(item) ? 'Done' : `${Number(item.progress)}/${Number(item.total)}`
}

function renderQuestScroll(quest) {
  const pct = progressPct(quest)
  const done = isDone(quest)
  return `
    <article class="quest-scroll-card ${done ? 'done' : ''} ${quest.urgent && !done ? 'urgent' : ''}">
      <div class="quest-ring">
        <svg viewBox="0 0 42 42" class="quest-ring-svg" aria-hidden="true">
          <circle class="quest-ring-track" cx="21" cy="21" r="16"></circle>
          <circle class="quest-ring-fill" cx="21" cy="21" r="16" style="stroke-dasharray:${pct}, 100"></circle>
        </svg>
        <span>${done ? 'OK' : `${pct}%`}</span>
      </div>

      <div class="quest-copy">
        <div class="quest-copy-top">
          <strong>${quest.name}</strong>
          <span class="quest-reward">${quest.reward || 'XP'}</span>
        </div>
        <p>${quest.desc}</p>
        <div class="quest-meta">
          <span>${ringLabel(quest)}</span>
          <span class="quest-state ${done ? 'done' : ''}">${done ? 'Completed' : 'Active'}</span>
        </div>
      </div>
    </article>
  `
}

function shortText(value = '', max = 82) {
  const text = String(value || '').trim()
  if (text.length <= max) return text
  return `${text.slice(0, max - 1)}…`
}

function renderRaidLog(p) {
  return `
    <div class="raid-ledger-list">
      ${(p.workoutLog || []).slice(0, 4).map(item => `
        <article class="raid-ledger-card">
          <div class="raid-ledger-top">
            <strong>${item.type}</strong>
            <span>${item.date}</span>
          </div>
          <div class="raid-meta">
            <span>${item.duration}</span>
            <span>${item.volume}</span>
            <span>${item.sets} set</span>
          </div>
          <p>${shortText(item.highlight || 'Seans notu yok.', 68)}</p>
          ${(item.blocks || []).length ? `
            <div class="raid-block-row">
              ${(item.blocks || []).slice(0, 3).map(block => `<span class="raid-block-chip">${block}</span>`).join('')}
            </div>
          ` : ''}
        </article>
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

    <div class="quest-scroll-stack">
      ${items.slice(0, 4).map(renderQuestScroll).join('')}
    </div>
  `
}

export function renderQuests(p, semantic = {}) {
  const daily = p.quests.daily || []
  const weekly = p.quests.weekly || []
  const openObjectives = [...daily, ...weekly].filter(item => !isDone(item)).length
  const recoveryDiscipline = Math.round((semantic.recoveryDiscipline || 0) * 100)
  const variety = semantic.variety || 0
  const trunkGap = semantic.chains?.trunkControl || 0

  return `
    <section id="quest-section" class="quest-ledger-surface">
      <div class="sec">Mission Board</div>
      <div class="mission-pressure-strip">
        <div class="pressure-chip">
          <span>Open</span>
          <strong>${openObjectives}</strong>
        </div>
        <div class="pressure-chip">
          <span>Recovery</span>
          <strong>${recoveryDiscipline}%</strong>
        </div>
        <div class="pressure-chip">
          <span>Variety</span>
          <strong>${variety}</strong>
        </div>
        <div class="pressure-chip">
          <span>Trunk</span>
          <strong>${trunkGap}</strong>
        </div>
      </div>
      ${renderQuestSection(p)}
    </section>

    <section class="training-subsection raid-ledger-surface">
      <div class="sec">Recent Sessions</div>
      ${renderRaidLog(p)}
    </section>
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
      <div class="sec">Mission Board</div>
      <div class="mission-pressure-strip">
        <div class="pressure-chip">
          <span>Open</span>
          <strong>${[...p.quests.daily, ...p.quests.weekly].filter(item => !isDone(item)).length}</strong>
        </div>
        <div class="pressure-chip">
          <span>Daily</span>
          <strong>${p.quests.daily.filter(isDone).length}/${p.quests.daily.length}</strong>
        </div>
        <div class="pressure-chip">
          <span>Weekly</span>
          <strong>${p.quests.weekly.filter(isDone).length}/${p.quests.weekly.length}</strong>
        </div>
        <div class="pressure-chip">
          <span>View</span>
          <strong>${activeQuestTab === 'daily' ? 'Daily' : 'Weekly'}</strong>
        </div>
      </div>
      ${renderQuestSection(p)}
    `
  }
  section.addEventListener('click', section._questsHandler)
}
