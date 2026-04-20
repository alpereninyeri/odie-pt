function branchTone(branch = '') {
  const text = String(branch).toLowerCase()
  if (text.includes('acro')) return 'emerald'
  if (text.includes('strength')) return 'gold'
  if (text.includes('mobility')) return 'violet'
  if (text.includes('core')) return 'danger'
  return 'neutral'
}

function branchSignal(branch = '', semantic = {}) {
  const chains = semantic.chains || {}
  const feats = semantic.feats || {}
  const counts = semantic.counts || {}
  const text = String(branch).toLowerCase()

  if (text.includes('acro')) return `${counts.acrobatics || 0} acro / aerial ${chains.aerialControl || 0}${feats.baraniSeen ? ' / barani seen' : ''}`
  if (text.includes('strength')) return `${counts.strength || 0} strength block / bench ${feats.benchMaxKg || 0}kg / MU ${feats.muscleUpMaxReps || 0}`
  if (text.includes('mobility')) return `${counts.mobility || 0} mobility block / shoulder ${feats.shoulderMobilitySessions || 0} / split ${feats.splitSessions || 0}`
  if (text.includes('core')) return `core ${counts.core || 0} / trunk ${chains.trunkControl || 0} / hollow ${feats.hollowMaxSec || 0}sn`
  return 'semantic signal yok'
}

function branchNext(branch) {
  return branch.items.find(item => item.status !== 'done') || null
}

export function renderSkills(p, semantic = {}) {
  const statusMap = {
    done: { cls: 'ss-done', icon: 'OK', label: 'Unlocked' },
    prog: { cls: 'ss-prog', icon: 'UP', label: 'Warm' },
    lock: { cls: 'ss-lock', icon: 'LOCK', label: 'Locked' },
  }

  const allItems = p.skills.flatMap(branch => branch.items)
  const totalDone = allItems.filter(item => item.status === 'done').length
  const totalProg = allItems.filter(item => item.status === 'prog').length
  const totalLock = allItems.filter(item => item.status === 'lock').length
  const readySoon = allItems.filter(item => item.status === 'prog').slice(0, 3)

  const branches = p.skills.map(branch => {
    const doneCount = branch.items.filter(item => item.status === 'done').length
    const total = branch.items.length
    const tone = branchTone(branch.branch)
    const nextNode = branchNext(branch)

    return `
      <div class="skill-branch-card tone-${tone}">
        <div class="skill-branch-head">
          <div>
            <div class="skill-branch-title">${branch.branch}</div>
            <div class="skill-branch-signal">${branchSignal(branch.branch, semantic)}</div>
          </div>
          <div class="skill-branch-meta">
            <strong>${doneCount}/${total}</strong>
            <small>${Math.round((doneCount / Math.max(1, total)) * 100)}% clear</small>
          </div>
        </div>

        ${nextNode ? `
          <div class="next-node-card">
            <span class="mini-label">Next Node</span>
            <strong>${nextNode.name}</strong>
            <p>${nextNode.desc}</p>
          </div>
        ` : ''}

        <div class="skill-node-list">
          ${branch.items.map(item => {
            const status = statusMap[item.status]
            return `
              <div class="skill-node ${item.status === 'lock' ? 'locked' : ''}">
                <div class="skill-node-status ${status.cls}">
                  <span>${status.icon}</span>
                </div>
                <div class="skill-node-copy">
                  <div class="skill-node-top">
                    <strong>${item.name}</strong>
                    <span class="skill-node-label">${status.label}</span>
                  </div>
                  <p>${item.desc}</p>
                  ${item.req ? `<div class="skill-node-req">${item.req}</div>` : ''}
                </div>
                <div class="skill-node-val" ${item.valColor ? `style="color:${item.valColor}"` : ''}>${item.val}</div>
              </div>
            `
          }).join('')}
        </div>
      </div>
    `
  }).join('')

  return `
    <div class="sec">Skill Tree Control</div>
    <div class="skill-summary tactical-summary">
      <div class="skill-summary-card">
        <div class="skill-summary-val" style="color:var(--grn)">${totalDone}</div>
        <div class="skill-summary-lbl">Unlocked</div>
      </div>
      <div class="skill-summary-card">
        <div class="skill-summary-val" style="color:var(--gold)">${totalProg}</div>
        <div class="skill-summary-lbl">Heating Up</div>
      </div>
      <div class="skill-summary-card">
        <div class="skill-summary-val" style="color:var(--dim)">${totalLock}</div>
        <div class="skill-summary-lbl">Locked</div>
      </div>
    </div>

    <div class="ready-row">
      ${readySoon.length
        ? readySoon.map(item => `<div class="ready-chip"><span>READY SOON</span><strong>${item.name}</strong></div>`).join('')
        : '<div class="ready-chip"><span>STABLE</span><strong>Yeni unlock baskisi dusuk</strong></div>'}
    </div>

    <div class="skill-branch-grid">
      ${branches}
    </div>
  `
}

export function initSkills() {}
