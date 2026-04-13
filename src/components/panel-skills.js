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
          <span style="margin-left:auto;font-family:'Share Tech Mono',monospace;font-size:9px;color:var(--dim)">${doneCount}/${total} UNLOCKED</span>
          ${branch.warning ? '<span class="sbhead-warn">⚠ DIKKAT</span>' : ''}
        </div>
        <div class="slist">${items}</div>
      </div>`
  }).join('')

  // Progress summary
  const allItems = p.skills.flatMap(b => b.items)
  const totalDone = allItems.filter(i => i.status === 'done').length
  const totalProg = allItems.filter(i => i.status === 'prog').length
  const totalLock = allItems.filter(i => i.status === 'lock').length

  return `
    <div class="sec">Skill Ağacı ve Hedefler</div>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-bottom:20px">
      <div style="background:var(--bg3);border:1px solid var(--brd);padding:10px;text-align:center">
        <div style="font-family:'Cinzel',serif;font-size:20px;color:var(--grn)">${totalDone}</div>
        <div style="font-size:9px;color:var(--dim);letter-spacing:2px;text-transform:uppercase;margin-top:2px">Unlocked</div>
      </div>
      <div style="background:var(--bg3);border:1px solid var(--brd);padding:10px;text-align:center">
        <div style="font-family:'Cinzel',serif;font-size:20px;color:var(--gold)">${totalProg}</div>
        <div style="font-size:9px;color:var(--dim);letter-spacing:2px;text-transform:uppercase;margin-top:2px">In Progress</div>
      </div>
      <div style="background:var(--bg3);border:1px solid var(--brd);padding:10px;text-align:center">
        <div style="font-family:'Cinzel',serif;font-size:20px;color:var(--dim)">${totalLock}</div>
        <div style="font-size:9px;color:var(--dim);letter-spacing:2px;text-transform:uppercase;margin-top:2px">Locked</div>
      </div>
    </div>
    ${branches}`
}

export function initSkills() {}
