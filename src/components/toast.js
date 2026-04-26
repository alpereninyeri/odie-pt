/**
 * Toast bildirimi — badge/achievement/PR için.
 * store.js'in '_newBadges' path'ini dinler.
 */

let _container = null

function _ensureContainer() {
  if (_container) return _container
  _container = document.createElement('div')
  _container.id = 'toast-container'
  _container.style.cssText = `
    position:fixed; bottom:80px; left:50%; transform:translateX(-50%);
    display:flex; flex-direction:column; gap:8px; align-items:center;
    z-index:9999; pointer-events:none;
  `
  document.body.appendChild(_container)
  return _container
}

/**
 * Tek bir toast göster.
 * @param {Object} opts - { icon, title, sub, duration, rarity }
 */
const TOAST_MAX = 3

export function showToast({ icon = '🏆', title, sub = '', msg = '', duration = 3500, rarity = 'common' }) {
  sub = sub || msg  // msg alias (main.js uyumluluğu)
  const container = _ensureContainer()

  const dupe = [...container.querySelectorAll('.toast')].find(node => {
    return node.querySelector('.toast-title')?.textContent === String(title)
  })
  if (dupe) return

  while (container.childElementCount >= TOAST_MAX) {
    container.firstElementChild?.remove()
  }

  const el = document.createElement('div')
  el.className = `toast toast-${rarity}`
  el.innerHTML = `
    <span class="toast-icon">${icon}</span>
    <div class="toast-body">
      <div class="toast-title">${title}</div>
      ${sub ? `<div class="toast-sub">${sub}</div>` : ''}
    </div>
  `
  container.appendChild(el)

  // Slide-in animasyonu
  requestAnimationFrame(() => el.classList.add('toast-show'))

  setTimeout(() => {
    el.classList.remove('toast-show')
    el.addEventListener('transitionend', () => el.remove(), { once: true })
  }, duration)
}

/**
 * Yeni kazanılan badge listesini toast olarak göster.
 */
export function showBadgeToasts(badges) {
  badges.forEach((badge, i) => {
    setTimeout(() => {
      showToast({
        icon: badge.icon,
        title: `YENİ ROZET: ${badge.name}`,
        sub: _rarityLabel(badge.rarity),
        rarity: badge.rarity,
        duration: 4000,
      })
    }, i * 600)
  })
}

/**
 * PR toast.
 */
export function showPRToast(exerciseName, val) {
  showToast({
    icon: '🎯',
    title: `YENİ PR: ${exerciseName}`,
    sub: val,
    rarity: 'rare',
    duration: 3500,
  })
}

/**
 * XP kazanma toast.
 */
export function showXPToast(amount, multiplier) {
  const mult = multiplier > 1 ? ` (×${multiplier})` : ''
  showToast({
    icon: '⚡',
    title: `+${amount} XP kazandın${mult}`,
    rarity: 'common',
    duration: 2500,
  })
}

function _rarityLabel(rarity) {
  return { common: 'Common', rare: 'Rare ✦', epic: 'Epic ✦✦', legendary: 'Legendary ✦✦✦', hidden: '???' }[rarity] || ''
}

/**
 * Toast CSS'ini dinamik inject et (style.css'e eklenmek istenirse buradan kaldırılabilir)
 */
export function injectToastStyles() {
  if (document.getElementById('toast-styles')) return
  const s = document.createElement('style')
  s.id = 'toast-styles'
  s.textContent = `
    .toast {
      display: flex; align-items: center; gap: 10px;
      background: var(--bg3); border: 1px solid var(--brd);
      border-radius: 10px; padding: 10px 16px;
      font-family: 'Share Tech Mono', monospace;
      box-shadow: 0 4px 24px rgba(0,0,0,.5);
      opacity: 0; transform: translateY(16px);
      transition: opacity .3s, transform .3s;
      pointer-events: auto; min-width: 220px; max-width: 320px;
    }
    .toast.toast-show { opacity: 1; transform: translateY(0); }
    .toast-rare      { border-color: var(--blu); }
    .toast-epic      { border-color: var(--pur); }
    .toast-legendary { border-color: var(--gold); box-shadow: 0 0 20px color-mix(in srgb, var(--gold) 30%, transparent); }
    .toast-hidden    { border-color: var(--dim); }
    .toast-icon { font-size: 22px; flex-shrink: 0; }
    .toast-title { font-size: 11px; font-weight: 700; color: var(--txt); letter-spacing: 1px; }
    .toast-sub   { font-size: 10px; color: var(--dim); margin-top: 2px; }
  `
  document.head.appendChild(s)
}
