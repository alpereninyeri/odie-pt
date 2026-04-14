import { openAvatarModal } from './modal.js'

export function renderHeader(p) {
  const xpPct = Math.round((p.xp.current / p.xp.max) * 100)
  return `
    <div class="header">
      <div class="avatar-wrap">
        <div class="avatar" id="avatarBtn">${p.avatar}</div>
        <div class="avatar-rank">${p.rankIcon}</div>
        <div class="avatar-online"></div>
      </div>
      <div class="nick-row">
        <div class="nick">${p.nick}</div>
      </div>
      <div class="nick-tag">${p.handle} · ${p.rank}</div>
      <div class="class-badge">${p.class} · ${p.subClass}</div>

      <div class="rank-row">
        <div class="rcell">
          <div class="rlbl">Rank</div>
          <div class="rico">${p.rankIcon}</div>
          <div class="rval">${p.rank}</div>
          <div class="rsub">${p.xp.current.toLocaleString('tr-TR')} XP</div>
        </div>
        <div class="rdiv"></div>
        <div class="rcell">
          <div class="rlbl">Level</div>
          <div class="rico"><span class="rico-text rico-lg">${p.level}</span></div>
          <div class="rval">Level ${p.level}</div>
          <div class="rsub">%${xpPct} Progress</div>
        </div>
        <div class="rdiv"></div>
        <div class="rcell">
          <div class="rlbl">Antrenman</div>
          <div class="rico"><span class="rico-text rico-md">${p.sessions}</span></div>
          <div class="rval">${p.sessions} Seans</div>
          <div class="rsub">${p.totalTime}</div>
        </div>
        <div class="rdiv"></div>
        <div class="rcell">
          <div class="rlbl">Hacim</div>
          <div class="rico"><span class="rico-text rico-sm">${p.totalVolume.replace(' kg','k')}</span></div>
          <div class="rval">${p.totalVolume}</div>
          <div class="rsub">${p.totalSets} set toplam</div>
        </div>
      </div>

      <div class="xpbar">
        <div class="xptop">
          <span>LEVEL ${p.level} → LEVEL ${p.level + 1}</span>
          <span>${p.xp.current.toLocaleString('tr-TR')} / ${p.xp.max.toLocaleString('tr-TR')} XP</span>
        </div>
        <div class="xptrack">
          <div class="xpfill" data-width="${xpPct}%" style="width:0%"></div>
        </div>
      </div>
    </div>

    <div class="gstats">
      ${p.globalStats.map(s => `
        <div class="gstat">
          <div class="gstat-val" ${s.red ? 'style="color:var(--red)"' : ''}>${s.val}</div>
          <div class="gstat-lbl">${s.label}</div>
        </div>`).join('')}
    </div>`
}

export function initHeader(p) {
  document.getElementById('avatarBtn').addEventListener('click', () => openAvatarModal(p))
  requestAnimationFrame(() => {
    setTimeout(() => {
      const fill = document.querySelector('.xpfill')
      if (fill) fill.style.width = fill.dataset.width
    }, 200)
  })
}
