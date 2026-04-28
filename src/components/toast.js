let _container = null

function _ensureContainer() {
  if (_container) return _container
  _container = document.createElement('div')
  _container.id = 'toast-container'
  _container.style.cssText = `
    position:fixed; bottom:88px; left:50%; transform:translateX(-50%);
    display:flex; flex-direction:column; gap:8px; align-items:center;
    z-index:9999; pointer-events:none;
  `
  document.body.appendChild(_container)
  return _container
}

const TOAST_MAX = 3

export function showToast({ icon = 'OD', title, sub = '', msg = '', duration = 3500, rarity = 'common' }) {
  sub = sub || msg
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

  requestAnimationFrame(() => el.classList.add('toast-show'))

  setTimeout(() => {
    el.classList.remove('toast-show')
    el.addEventListener('transitionend', () => el.remove(), { once: true })
  }, duration)
}

export function showBadgeToasts(badges) {
  badges.forEach((badge, i) => {
    setTimeout(() => {
      showToast({
        icon: badge.icon || 'BDG',
        title: `YENI ROZET: ${badge.name}`,
        sub: _rarityLabel(badge.rarity),
        rarity: badge.rarity,
        duration: 4000,
      })
    }, i * 600)
  })
}

export function showPRToast(exerciseName, val) {
  showToast({
    icon: 'PR',
    title: `YENI PR: ${exerciseName}`,
    sub: val,
    rarity: 'rare',
    duration: 3500,
  })
}

export function showXPToast(amount, multiplier) {
  const mult = multiplier > 1 ? ` (x${multiplier})` : ''
  showToast({
    icon: 'XP',
    title: `+${amount} XP kazandin${mult}`,
    rarity: 'common',
    duration: 2500,
  })
}

function _rarityLabel(rarity) {
  return { common: 'Common', rare: 'Rare', epic: 'Epic', legendary: 'Legendary', hidden: '???' }[rarity] || ''
}

export function injectToastStyles() {
  if (document.getElementById('toast-styles')) return
  const s = document.createElement('style')
  s.id = 'toast-styles'
  s.textContent = `
    .toast {
      display:flex; align-items:center; gap:10px;
      background:var(--panel); border:1px solid var(--line);
      border-radius:8px; padding:10px 14px;
      font-family:var(--font-ui);
      box-shadow:0 16px 30px rgba(0,0,0,.35);
      opacity:0; transform:translateY(16px);
      transition:opacity .2s ease, transform .2s ease;
      pointer-events:auto; min-width:220px; max-width:min(340px, calc(100vw - 28px));
    }
    .toast.toast-show { opacity:1; transform:translateY(0); }
    .toast-rare { border-color:color-mix(in srgb, var(--cobalt) 55%, var(--line)); }
    .toast-epic { border-color:color-mix(in srgb, var(--violet) 55%, var(--line)); }
    .toast-legendary { border-color:color-mix(in srgb, var(--amber) 65%, var(--line)); }
    .toast-hidden { border-color:var(--muted); }
    .toast-icon {
      display:inline-flex; align-items:center; justify-content:center;
      width:32px; height:32px; border-radius:7px;
      background:var(--panel-soft); color:var(--accent);
      font-family:var(--font-mono); font-size:11px; font-weight:800;
      flex-shrink:0;
    }
    .toast-title { font-size:12px; font-weight:800; color:var(--text); }
    .toast-sub { font-size:11px; color:var(--muted); margin-top:2px; line-height:1.35; }
  `
  document.head.appendChild(s)
}
