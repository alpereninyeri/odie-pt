export function renderSkills(p) {
  const statusMap = {
    done: { cls: 'ss-done', icon: '✓', label: 'Unlocked' },
    prog: { cls: 'ss-prog', icon: '⟳', label: 'Grinding' },
    lock: { cls: 'ss-lock', icon: '⌁', label: 'Locked' },
  }

  const branches = (p.skills || []).map(branch => {
    const doneCount = branch.items.filter(item => item.status === 'done').length
    const total = branch.items.length
    const pct = total ? Math.round((doneCount / total) * 100) : 0
    const nextUnlock = branch.items.find(item => item.status !== 'done')
    const flavor = getBranchFlavor(branch.branch)

    const items = branch.items.map(item => {
      const status = statusMap[item.status]
      return `
        <div class="sitem ${item.status === 'lock' ? 'locked' : ''}">
          <div class="sst ${status.cls}">${status.icon}</div>
          <div class="stxt">
            <div class="sname">${item.name}</div>
            <div class="sdesc">${item.desc}</div>
            <div class="skill-node-meta">
              <span>${status.label}</span>
              ${item.req ? `<span>${item.req}</span>` : `<span>${item.val}</span>`}
            </div>
            ${item.req ? `<div class="sreq">${item.req}</div>` : ''}
          </div>
          <div class="sval" ${item.valColor ? `style="color:${item.valColor}"` : ''}>${item.val}</div>
        </div>
      `
    }).join('')

    return `
      <div class="sbranch">
        <div class="sbhead skill-branch-head">
          <div>
            <div>${branch.branch}</div>
            <div class="skill-branch-flavor">${flavor}</div>
          </div>
          <span class="sbhead-counter">${doneCount}/${total} UNLOCKED</span>
          ${branch.warning ? '<span class="sbhead-warn">⚠ HOT</span>' : ''}
        </div>
        <div class="skill-branch-progress">
          <div class="track"><div class="fill" style="width:${pct}%"></div></div>
          <strong>%${pct}</strong>
        </div>
        <div class="skill-next">
          <span class="brief-kicker">Next Unlock</span>
          <strong>${nextUnlock?.name || 'Branch cleared'}</strong>
          <p>${nextUnlock?.req || nextUnlock?.desc || 'Bu hat üzerindeki tüm düğümler açık.'}</p>
        </div>
        <div class="slist">${items}</div>
      </div>
    `
  }).join('')

  const allItems = (p.skills || []).flatMap(branch => branch.items)
  const totalDone = allItems.filter(item => item.status === 'done').length
  const totalProg = allItems.filter(item => item.status === 'prog').length
  const totalLock = allItems.filter(item => item.status === 'lock').length
  const nextNode = allItems.find(item => item.status === 'prog') || allItems.find(item => item.status === 'lock')

  return `
    <div class="sec">Skill Tree ve Questline</div>
    <div class="skill-command-grid">
      <div class="skill-summary-card">
        <div class="skill-summary-val" style="color:var(--grn)">${totalDone}</div>
        <div class="skill-summary-lbl">Unlocked</div>
      </div>
      <div class="skill-summary-card">
        <div class="skill-summary-val" style="color:var(--gold)">${totalProg}</div>
        <div class="skill-summary-lbl">Active Grind</div>
      </div>
      <div class="skill-summary-card">
        <div class="skill-summary-val" style="color:var(--dim)">${totalLock}</div>
        <div class="skill-summary-lbl">Locked</div>
      </div>
      <div class="skill-summary-card skill-focus-card">
        <div class="skill-summary-lbl">Next Node</div>
        <div class="skill-focus-title">${nextNode?.name || 'All clear'}</div>
        <div class="skill-focus-sub">${nextNode?.req || nextNode?.desc || 'Yeni düğüm bekleniyor.'}</div>
      </div>
    </div>
    ${branches}
  `
}

function getBranchFlavor(branchName) {
  const name = String(branchName || '').toLocaleLowerCase('tr-TR')
  if (name.includes('acro')) return 'Air control, twist güveni ve landing temizliği'
  if (name.includes('strength')) return 'Saf output, grip ankrajı ve çekiş/itiş seviyesi'
  if (name.includes('mobility')) return 'ROM, position ownership ve sakatlık freni'
  if (name.includes('core')) return 'Spine armor, anti-rotation ve force transfer hattı'
  return 'Karakterin ikincil uzmanlık ağacı'
}

export function initSkills() {}
