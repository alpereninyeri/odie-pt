/**
 * Status Widget — Class kartı + Armor/Fatigue bar + Epic tier
 * Stats paneli üstüne yerleşir. store.getProfile() ile beslenir.
 */

import { store } from '../data/store.js'
import { statusColor, statusLabel } from '../data/survival-engine.js'

export function renderStatusWidget() {
  const p = store.getState()?.profile || {}
  const cls = p.classObj || { name: 'Çırak', icon: '🥚', color: '#64748b', desc: '—', buff: '—', evolving: true, progress: 0 }
  const armor = p.armor ?? 100
  const fatigue = p.fatigue ?? 0
  const status = p.survivalStatus || 'healthy'
  const epicVol = p.epicVolume
  const epicGeo = p.epicGeography

  const statusColorVal = statusColor(status)
  const statusText = statusLabel(status)

  const evolving = cls.evolving
  const progressPct = Math.round((cls.progress || 0) * 100)

  return `
  <div class="status-widget">
    <div class="status-class" style="--class-color:${cls.color}">
      <div class="status-class-icon">${cls.icon}</div>
      <div class="status-class-body">
        <div class="status-class-name">${cls.name}</div>
        <div class="status-class-sub">${cls.subName || ''}</div>
        <div class="status-class-buff">${cls.buff || ''}</div>
        ${evolving ? `<div class="status-class-evolving">Evolving — ${progressPct}% (10 antrenman sonra belirlenecek)</div>` : ''}
      </div>
    </div>

    <div class="status-survival">
      <div class="status-survival-header">
        <span class="status-survival-badge" style="background:${statusColorVal}20;color:${statusColorVal};border-color:${statusColorVal}">${statusText}</span>
      </div>
      <div class="status-bar-row">
        <span class="status-bar-label">🛡️ Armor</span>
        <div class="status-bar"><div class="status-bar-fill" style="width:${armor}%;background:${_armorColor(armor)}"></div></div>
        <span class="status-bar-val">${armor}/100</span>
      </div>
      <div class="status-bar-row">
        <span class="status-bar-label">🧠 Fatigue</span>
        <div class="status-bar"><div class="status-bar-fill" style="width:${fatigue}%;background:${_fatigueColor(fatigue)}"></div></div>
        <span class="status-bar-val">${fatigue}/100</span>
      </div>
      ${p.survivalWarnings?.length ? `<div class="status-warnings">${p.survivalWarnings.map(w => `<div class="status-warning">${w}</div>`).join('')}</div>` : ''}
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

    ${epicGeo?.value > 0 ? `
    <div class="status-epic">
      <div class="status-epic-title">GEOGRAPHY RAIDER</div>
      <div class="status-epic-tier">
        <span class="status-epic-icon">${epicGeo.achieved?.icon || epicGeo.next?.icon || '🗺️'}</span>
        <div class="status-epic-body">
          <div class="status-epic-name">${epicGeo.achieved?.name || 'Başlangıç'} · ${epicGeo.value.toFixed(1)} km</div>
          <div class="status-epic-msg">${epicGeo.message}</div>
          <div class="status-epic-bar"><div class="status-epic-fill" style="width:${Math.round((epicGeo.progress || 0) * 100)}%"></div></div>
        </div>
      </div>
    </div>` : ''}
  </div>`
}

function _armorColor(v) {
  if (v <= 0)  return '#7f1d1d'
  if (v < 20)  return '#ef4444'
  if (v < 50)  return '#f97316'
  return '#22c55e'
}

function _fatigueColor(v) {
  if (v >= 75) return '#ef4444'
  if (v >= 50) return '#f97316'
  if (v >= 25) return '#eab308'
  return '#22c55e'
}
