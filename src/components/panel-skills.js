export function renderSkills(p) {
  const statusMap = {
    done: { cls: 'ss-done', icon: '✓' },
    prog: { cls: 'ss-prog', icon: '⟳' },
    lock: { cls: 'ss-lock', icon: '🔒' },
  }

  const branches = p.skills.map(branch => {
    const items = branch.items.map(item => {
      const s = statusMap[item.status]
      return `
        <div class="sitem ${item.status === 'lock' ? 'locked' : ''}">
          <div class="sst ${s.cls}">${s.icon}</div>
          <div class="stxt">
            <div class="sname">${item.name}</div>
            <div class="sdesc">${item.desc}</div>
            ${item.req ? `<div class="sreq">${item.req}</div>` : ''}
          </div>
          <div class="sval" ${item.valColor ? `style="color:${item.valColor}"` : ''}>${item.val}</div>
        </div>`
    }).join('')

    const doneCount = branch.items.filter(i => i.status === 'done').length
    const total = branch.items.length

    return `
      <div class="sbranch">
        <div class="sbhead">
          ${branch.branch}
          <span class="sbhead-counter">${doneCount}/${total} UNLOCKED</span>
          ${branch.warning ? '<span class="sbhead-warn">⚠ DIKKAT</span>' : ''}
        </div>
        <div class="slist">${items}</div>
      </div>`
  }).join('')

  const allItems = p.skills.flatMap(b => b.items)
  const totalDone = allItems.filter(i => i.status === 'done').length
  const totalProg = allItems.filter(i => i.status === 'prog').length
  const totalLock = allItems.filter(i => i.status === 'lock').length

  return `
    <div class="sec">Skill Ağacı ve Hedefler</div>
    <div class="skill-summary">
      <div class="skill-summary-card">
        <div class="skill-summary-val" style="color:var(--grn)">${totalDone}</div>
        <div class="skill-summary-lbl">Unlocked</div>
      </div>
      <div class="skill-summary-card">
        <div class="skill-summary-val" style="color:var(--gold)">${totalProg}</div>
        <div class="skill-summary-lbl">In Progress</div>
      </div>
      <div class="skill-summary-card">
        <div class="skill-summary-val" style="color:var(--dim)">${totalLock}</div>
        <div class="skill-summary-lbl">Locked</div>
      </div>
    </div>
    ${branches}`
}

export function initSkills() {}
