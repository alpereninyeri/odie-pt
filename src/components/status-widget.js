/**
 * Status Widget — Class kartı + Epic Volume Raider
 * Stats paneli üstüne yerleşir. store.getState() ile beslenir.
 */

import { store } from '../data/store.js'

export function renderStatusWidget() {
  const p = store.getState()?.profile || {}
  const cls = p.classObj || { name: 'Çırak', icon: '🥚', color: '#64748b', desc: '—', buff: '—', evolving: true, progress: 0 }
  const epicVol = p.epicVolume

  return `
  <div class="status-widget">
    <div class="status-class" style="--class-color:${cls.color}">
      <div class="status-class-icon">${cls.icon}</div>
      <div class="status-class-body">
        <div class="status-class-name">${cls.name}</div>
        <div class="status-class-sub">${cls.subName || ''}</div>
        <div class="status-class-buff">${cls.buff || ''}</div>
      </div>
    </div>

    ${epicVol?.achieved || epicVol?.next ? `
    <div class="status-epic">
      <div class="status-epic-title">EPIC VOLUME RAIDER</div>
      <div class="status-epic-tier">
        <span class="status-epic-icon">${epicVol.achieved?.icon || epicVol.next?.icon || '⚪'}</span>
        <div class="status-epic-body">
          <div class="status-epic-name">${epicVol.achieved?.name || 'Başlangıç'}</div>
          <div class="status-epic-msg">${epicVol.message}</div>
          <div class="status-epic-bar"><div class="status-epic-fill" style="width:${Math.round((epicVol.progress || 0) * 100)}%"></div></div>
        </div>
      </div>
    </div>` : ''}
  </div>`
}
