import './styles/cozy-reforge.css'
import avatarAthlete from './assets/game/cozy-v4/avatar-athlete.png'
import { clearAppAccessToken, hasAppAccessToken, setAppAccessToken } from './data/app-access.js'
import { createDashboardModel } from './data/dashboard-model.js'
import { dashboardStore } from './data/dashboard-store.js'

const TABS = [
  { key: 'overview', label: 'Durum', icon: 'pulse' },
  { key: 'body', label: 'Bölgeler', icon: 'body' },
  { key: 'sessions', label: 'Antrenmanlar', icon: 'list' },
]

let activeTab = readInitialTab()
let detail = null
let accessPromptOpen = false
let currentModel = null
let lastMarkup = ''
let renderQueued = false

boot()

async function boot() {
  document.addEventListener('click', handleClick)
  document.addEventListener('keydown', handleKeydown)
  document.addEventListener('submit', handleSubmit)
  dashboardStore.subscribe(() => scheduleRender())
  render()
  await dashboardStore.init()
  render()
}

function readInitialTab() {
  const requested = new URLSearchParams(window.location.search).get('tab')
  if (TABS.some(tab => tab.key === requested)) return requested
  try {
    const saved = localStorage.getItem('odiept-dashboard-tab')
    if (TABS.some(tab => tab.key === saved)) return saved
  } catch {}
  return 'overview'
}

function setActiveTab(tab) {
  if (!TABS.some(item => item.key === tab)) return
  activeTab = tab
  detail = null
  try {
    localStorage.setItem('odiept-dashboard-tab', tab)
    const url = new URL(window.location.href)
    url.searchParams.set('tab', tab)
    window.history.replaceState({}, '', url)
  } catch {}
  scheduleRender()
}

function scheduleRender() {
  if (renderQueued) return
  renderQueued = true
  window.requestAnimationFrame(() => {
    renderQueued = false
    render()
  })
}

function render() {
  const model = createDashboardModel(dashboardStore.getState())
  currentModel = model
  const markup = renderShell(model)
  const title = `OdiePt · ${TABS.find(tab => tab.key === activeTab)?.label || 'Durum'}`
  if (document.title !== title) document.title = title
  if (markup === lastMarkup) return
  const app = document.getElementById('app')
  if (app) app.innerHTML = markup
  lastMarkup = markup
}

function renderShell(model) {
  return `
    <div class="app-shell mode-${escapeAttr(model.mode)}">
      ${renderSidebar(model)}
      <main class="main-stage">
        ${renderMobileTop(model)}
        ${renderStatusBanner(model)}
        ${renderActiveScreen(model)}
      </main>
      ${renderMobileNav()}
      ${renderDetail()}
      ${renderAccessPrompt()}
    </div>
  `
}

function renderSidebar(model) {
  const live = model.mode === 'live'
  const accessLocked = model.error === 'unauthorized'
  return `
    <aside class="side-rail">
      <button class="brand-block" type="button" data-tab="overview" aria-label="OdiePt durum ekranı">
        <span class="brand-mark">OP</span>
        <span>
          <b>ODIE<span>PT</span></b>
          <small>HEVY TRAINING CONSOLE</small>
        </span>
      </button>

      <section class="rail-player">
        <div class="rail-avatar">
          <img src="${avatarAthlete}" alt="">
          <span class="level-badge">LV ${formatNumber(model.profile.level || 1)}</span>
        </div>
        <div>
          <small>OYUNCU</small>
          <strong>${escapeHtml(model.profile.nick || 'Sporcu')}</strong>
          <span>${escapeHtml(model.profile.displayTitle || model.profile.className || 'Hybrid Athlete')}</span>
        </div>
      </section>

      <nav class="rail-nav" aria-label="Ana menü">
        ${TABS.map(tab => renderNavButton(tab, 'rail-nav-button')).join('')}
      </nav>

      <section class="rail-source">
        <div class="source-row">
          <span class="source-led ${live ? 'is-live' : ''}" aria-hidden="true"></span>
          <div>
            <small>VERİ KAYNAĞI</small>
            <b>${live ? 'HEVY CANLI' : model.mode === 'cache' ? 'SON CANLI KAYIT' : 'DEMO MODU'}</b>
            ${model.mode === 'cache' ? `<small>${escapeHtml(cacheAgeLabel(model.cacheAgeMs))}</small>` : ''}
          </div>
        </div>
        ${live
          ? '<button type="button" class="rail-action" data-sync>Hevy’yi yenile</button>'
          : accessLocked
            ? '<button type="button" class="rail-action" data-access>Erişim anahtarı gir</button>'
            : '<button type="button" class="rail-action" data-sync>Canlı veriyi dene</button>'}
        ${hasAppAccessToken() ? '<button type="button" class="rail-action danger" data-access-clear>Bağlantıyı kapat</button>' : ''}
      </section>
    </aside>
  `
}

function renderMobileTop(model) {
  return `
    <header class="mobile-top">
      <button class="mobile-brand" type="button" data-tab="overview" aria-label="OdiePt durum ekranı">
        <span class="brand-mark">OP</span>
        <b>ODIE<span>PT</span></b>
      </button>
      <button type="button" class="mobile-source ${model.mode === 'live' ? 'is-live' : ''}" data-sync>
        <span></span>${model.mode === 'live' ? 'HEVY' : model.mode === 'cache' ? 'KAYIT' : 'DEMO'}
      </button>
    </header>
  `
}

function renderMobileNav() {
  return `
    <nav class="mobile-nav" aria-label="Ana menü">
      ${TABS.map(tab => renderNavButton(tab, 'mobile-nav-button')).join('')}
    </nav>
  `
}

function renderNavButton(tab, className) {
  const active = activeTab === tab.key
  return `
    <button type="button" class="${className} ${active ? 'is-active' : ''}" data-tab="${escapeAttr(tab.key)}" aria-current="${active ? 'page' : 'false'}">
      ${icon(tab.icon)}
      <span>${escapeHtml(tab.label)}</span>
    </button>
  `
}

function renderStatusBanner(model) {
  if (model.status === 'syncing') {
    return `
      <div class="status-banner is-syncing" role="status">
        <span class="spinner" aria-hidden="true"></span>
        Hevy güncellemeleri çekiliyor…
      </div>
    `
  }
  if (model.error) {
    const demoMode = model.mode === 'demo'
    const accessLocked = model.error === 'unauthorized'
    const serverUnconfigured = model.error === 'app_auth_not_configured'
    const message = accessLocked
      ? 'OdiePt kilitli. Canlı Hevy verisini görmek için erişim anahtarını gir.'
      : serverUnconfigured
        ? 'Sunucuda OdiePt erişim anahtarı yapılandırılmamış.'
        : demoMode
          ? 'Hevy bağlantısı yerelde yok. Tasarım demo verisiyle gösteriliyor.'
          : `Canlı veri yenilenemedi. ${cacheAgeLabel(model.cacheAgeMs)} yaşındaki son güvenli kayıt gösteriliyor.`
    return `
      <div class="status-banner is-error" role="alert">
        ${icon('warning')}
        <span>${escapeHtml(message)}</span>
        <button type="button" ${accessLocked ? 'data-access' : 'data-sync'}>${accessLocked ? 'Anahtarı gir' : demoMode ? 'Canlı veriyi dene' : 'Tekrar dene'}</button>
      </div>
    `
  }
  if (model.syncSummary) {
    const fetched = Number(model.syncSummary.fetched || 0)
    if (model.syncSummary.refreshed === false) {
      return `
        <div class="status-banner is-success" role="status" data-sync-outcome="current">
          ${icon('check')}
          Hevy zaten güncel · son kayıt değişmedi
        </div>
      `
    }
    return `
      <div class="status-banner is-success" role="status" data-sync-outcome="refreshed">
        ${icon('check')}
        Hevy yenilendi · ${formatNumber(fetched)} antrenman okundu
      </div>
    `
  }
  return ''
}

function renderActiveScreen(model) {
  switch (activeTab) {
    case 'body': return renderBodyScreen(model)
    case 'sessions': return renderSessionsScreen(model)
    case 'overview':
    default: return renderOverviewScreen(model)
  }
}

function renderPageHead(model, eyebrow, title, subtitle) {
  return `
    <header class="page-head">
      <div>
        <span class="eyebrow">${escapeHtml(eyebrow)}</span>
        <h1>${escapeHtml(title)}</h1>
        <p>${escapeHtml(subtitle)}</p>
      </div>
      <button type="button" class="sync-button" data-sync ${model.status === 'syncing' ? 'disabled' : ''}>
        ${icon('refresh')}
        <span>${model.mode === 'live' ? 'Hevy’yi yenile' : 'Canlı veriyi dene'}</span>
      </button>
    </header>
  `
}

function renderOverviewScreen(model) {
  return `
    <section class="screen overview-screen">
      ${renderPageHead(
        model,
        formatFullDate(model.today),
        `Selam, ${model.profile.nick || 'sporcu'}.`,
        `${model.statusLine}. Son antrenman ${model.latestWorkout ? relativeDay(model.latestAge) : 'henüz yok'}.`,
      )}

      <div class="overview-grid">
        ${renderPlayerCard(model)}
        ${renderQuestCard(model)}

        <section class="metric-strip" aria-label="Son 28 gün özeti">
          ${renderMetric('Antrenman', model.current28.sessions, `${signed(model.momentum.sessions)} önceki dönem`, 'sessions')}
          ${renderMetric('Aktif gün', model.current28.activeDays, `${model.recent7.activeDays} gün / son 7`, 'days')}
          ${renderMetric('Hacim', compactNumber(model.current28.volumeKg, 'kg'), `${signed(model.momentum.volume)} önceki dönem`, 'volume')}
          ${renderMetric('Süre', compactMinutes(model.current28.minutes), `${signed(model.momentum.minutes)} önceki dönem`, 'time')}
        </section>

        <section class="console-panel trend-panel">
          <div class="panel-head">
            <div>
              <span class="eyebrow">8 HAFTALIK RİTİM</span>
              <h2>Antrenman yükü</h2>
            </div>
            <span class="panel-chip">${model.weekly.some(week => week.volumeKg) ? 'KG' : 'DK'}</span>
          </div>
          ${renderWeeklyChart(model.weekly)}
          <div class="trend-footer">
            <div>
              <small>BU DÖNEM</small>
              <b>${compactNumber(model.current28.volumeKg || model.current28.minutes, model.current28.volumeKg ? 'kg' : 'dk')}</b>
            </div>
            <div>
              <small>ÖNCEKİ 28 GÜN</small>
              <b>${compactNumber(model.previous28.volumeKg || model.previous28.minutes, model.previous28.volumeKg ? 'kg' : 'dk')}</b>
            </div>
            <span class="momentum ${model.momentum.volume >= 0 ? 'is-up' : 'is-down'}">${signed(model.momentum.volume)}</span>
          </div>
        </section>

        <section class="console-panel heat-panel">
          <div class="panel-head compact">
            <div>
              <span class="eyebrow">SON 28 GÜN</span>
              <h2>Devam zinciri</h2>
            </div>
            <strong class="streak-number">${formatNumber(model.streak.current || 0)}<small> seri</small></strong>
          </div>
          ${renderHeatmap(model.heatmap)}
          <div class="heat-legend">
            <span>BOŞ</span><i class="heat-0"></i><i class="heat-1"></i><i class="heat-2"></i><i class="heat-3"></i><i class="heat-4"></i><span>YÜKSEK</span>
          </div>
        </section>

        ${renderGapPanel(model)}
        ${renderStatsPanel(model)}
      </div>
    </section>
  `
}

function renderPlayerCard(model) {
  const classTrack = model.profile.classTrack || {}
  const classDelta = Number(classTrack.delta) || 0
  const classDirection = classDelta > 0 ? 'up' : classDelta < 0 ? 'down' : 'steady'
  return `
    <section class="player-card">
      <div class="player-card-grid" aria-hidden="true"></div>
      <div class="player-copy">
        <span class="eyebrow">${escapeHtml(model.profile.rank || 'OYUNCU KARTI')}</span>
        <h2>${escapeHtml(model.profile.displayTitle || model.profile.className || 'HYBRID ATHLETE')}</h2>
        <div class="class-track-line">
          <span>${escapeHtml(classTrack.familyName || model.profile.className || 'Hybrid Athlete')} · %${formatNumber(classTrack.affinity || 0)} uyum</span>
          <b class="class-shift is-${classDirection}">${classDelta > 0 ? '▲' : classDelta < 0 ? '▼' : '◆'} ${classDelta > 0 ? '+' : ''}${formatNumber(classDelta)}</b>
        </div>
        <div class="player-state">
          <span class="pulse-dot"></span>
          ${escapeHtml(model.statusLine)}
        </div>
      </div>
      <div class="player-portrait">
        <img src="${avatarAthlete}" alt="${escapeAttr(model.profile.nick || 'Sporcu')} avatarı">
        <span>LV ${formatNumber(model.profile.level || 1)}</span>
      </div>
      <div class="xp-console">
        <div class="xp-label">
          <span>SEVİYE İLERLEMESİ</span>
          <b>${formatNumber(model.xp.current)} / ${formatNumber(model.xp.max)} XP</b>
        </div>
        <div class="xp-track" role="progressbar" aria-label="Seviye ilerlemesi" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(model.xp.percent)}">
          <span style="--progress:${model.xp.percent}%"></span>
        </div>
      </div>
    </section>
  `
}

function renderQuestCard(model) {
  const quest = model.quest
  return `
    <section class="quest-card">
      <div class="quest-scanline" aria-hidden="true"></div>
      <div class="quest-topline">
        <span>${escapeHtml(quest.eyebrow)}</span>
        <b>${escapeHtml(quest.reward)}</b>
      </div>
      <div class="quest-icon">${icon('target')}</div>
      <h2>${escapeHtml(quest.title)}</h2>
      <p>${escapeHtml(quest.action)}</p>
      ${quest.region ? `
        <button type="button" class="quest-progress" data-region="${escapeAttr(quest.region.id)}" aria-label="${escapeAttr(`${quest.region.label} detayını aç`)}">
          <span style="--progress:${quest.region.load}%"></span>
          <b>${formatNumber(quest.region.load)}%</b>
          <small>BÖLGE YÜKÜ</small>
        </button>
      ` : ''}
    </section>
  `
}

function renderMetric(label, value, sub, iconName) {
  return `
    <article class="metric-card">
      <span class="metric-icon">${icon(iconName)}</span>
      <div>
        <small>${escapeHtml(label)}</small>
        <b>${escapeHtml(String(value))}</b>
        <em>${escapeHtml(sub)}</em>
      </div>
    </article>
  `
}

function renderWeeklyChart(weeks) {
  return `
    <div class="weekly-chart" aria-label="Sekiz haftalık antrenman grafiği">
      ${weeks.map((week, index) => `
        <div class="week-column ${index === weeks.length - 1 ? 'is-current' : ''}">
          <span class="week-value">${week.chartValue ? compactNumber(week.chartValue) : '—'}</span>
          <div class="week-bar">
            <i style="--height:${week.height}%"></i>
          </div>
          <small>${escapeHtml(week.label)}</small>
        </div>
      `).join('')}
    </div>
  `
}

function renderHeatmap(items) {
  return `
    <div class="activity-grid" aria-label="Son 28 gün antrenman yoğunluğu">
      ${items.map(item => `
        <button type="button" class="activity-cell heat-${item.level}" title="${escapeAttr(`${item.date}: ${item.value || 0} yük`)}" aria-label="${escapeAttr(`${item.date}: ${item.value ? `${item.value} yük` : 'boş'}`)}"></button>
      `).join('')}
    </div>
  `
}

function renderGapPanel(model) {
  const gaps = model.gaps.slice(0, 4)
  return `
    <section class="console-panel gap-panel">
      <div class="panel-head">
        <div>
          <span class="eyebrow">AÇIK TARAMASI</span>
          <h2>Eksik kalan bölgeler</h2>
        </div>
        <button type="button" class="text-link" data-tab="body">Tümünü gör ${icon('arrow')}</button>
      </div>
      <div class="gap-list">
        ${gaps.length ? gaps.map((region, index) => `
          <button type="button" class="gap-row" data-region="${escapeAttr(region.id)}">
            <span class="gap-rank">0${index + 1}</span>
            <div class="gap-copy">
              <b>${escapeHtml(region.label)}</b>
              <small>${escapeHtml(region.develops)}</small>
              <em>${escapeHtml(region.exercisePreview.join(' · '))} · ${region.daysSince >= 99 ? 'kayıt yok' : `${formatNumber(region.daysSince)}g önce`}</em>
            </div>
            <div class="mini-track"><span style="--progress:${region.load}%"></span></div>
            <strong>${formatNumber(region.load)}%</strong>
            ${icon('arrow')}
          </button>
        `).join('') : '<p class="empty-state">Belirgin bir bölge açığı yok. Denge korunuyor.</p>'}
      </div>
    </section>
  `
}

function renderStatsPanel(model) {
  return `
    <section class="console-panel stats-panel">
      <div class="panel-head">
        <div>
          <span class="eyebrow">KARAKTER STATLARI</span>
          <h2>Rank görünümü</h2>
        </div>
        <span class="panel-chip">HEVY</span>
      </div>
      <div class="stat-grid">
        ${model.stats.map(stat => `
          <button type="button" class="stat-tile" data-stat="${escapeAttr(stat.key)}">
            <span>${escapeHtml(stat.short)}</span>
            <b>${escapeHtml(stat.rank)}</b>
            <div class="mini-track"><i style="--progress:${stat.score}%"></i></div>
            <small>${escapeHtml(stat.name)}</small>
          </button>
        `).join('')}
      </div>
    </section>
  `
}

function renderBodyScreen(model) {
  const priority = model.gaps[0] || null
  const muscleRegions = model.regions.filter(region => region.group === 'muscle')
  const jointRegions = model.regions.filter(region => region.group === 'joint')
  return `
    <section class="screen body-screen">
      ${renderPageHead(
        model,
        '28 GÜNLÜK BÖLGE ANALİZİ',
        'Neresi geride?',
        'Hevy ana/ikincil kas hedefleri, set türü ve son temas birlikte tarandı.',
      )}

      ${priority ? `
        <section class="priority-banner">
          <span class="priority-index">01</span>
          <div>
            <span class="eyebrow">EN BÜYÜK AÇIK</span>
            <h2>${escapeHtml(priority.label)}</h2>
            <p>${escapeHtml(priority.action)} · ${priority.daysSince >= 99 ? 'yakın dönem kaydı yok' : `son temas ${priority.daysSince} gün önce`}.</p>
          </div>
          <div class="priority-score">
            <strong>${formatNumber(priority.load)}</strong>
            <small>/100 YÜK</small>
          </div>
        </section>
      ` : ''}

      <div class="body-layout">
        <section class="console-panel body-map-panel">
          <div class="panel-head">
            <div>
              <span class="eyebrow">KAS HARİTASI</span>
              <h2>Bölge yükü</h2>
            </div>
            <span class="panel-chip">28G</span>
          </div>
          <div class="region-grid">
            ${muscleRegions.map(renderRegionTile).join('')}
          </div>
        </section>

        <div class="body-side">
          <section class="console-panel ranking-panel">
            <div class="panel-head compact">
              <div>
                <span class="eyebrow">ÖNCELİK SIRASI</span>
                <h2>İlk üç açık</h2>
              </div>
            </div>
            <ol class="priority-list">
              ${model.gaps.slice(0, 3).map((region, index) => `
                <li>
                  <button type="button" data-region="${escapeAttr(region.id)}">
                    <span>0${index + 1}</span>
                    <div>
                      <b>${escapeHtml(region.label)}</b>
                      <small>${escapeHtml(region.develops)}</small>
                      <em>${escapeHtml(region.exercisePreview.join(' · '))}</em>
                    </div>
                    <strong>${formatNumber(region.load)}%</strong>
                  </button>
                </li>
              `).join('')}
            </ol>
          </section>

          <section class="console-panel joint-panel">
            <div class="panel-head compact">
              <div>
                <span class="eyebrow">EKLEM YÜKÜ</span>
                <h2>Tahmini maruziyet</h2>
              </div>
            </div>
            <div class="joint-list">
              ${jointRegions.map(region => `
                <button type="button" data-region="${escapeAttr(region.id)}">
                  <span class="risk-dot risk-${riskTone(region.risk)}"></span>
                  <div><b>${escapeHtml(region.label)}</b><small>${escapeHtml(region.riskLabel)}</small></div>
                  <strong>${formatNumber(region.risk)}</strong>
                </button>
              `).join('')}
            </div>
          </section>
        </div>
      </div>
    </section>
  `
}

function renderRegionTile(region) {
  return `
    <button type="button" class="region-tile tone-${regionTone(region)}" data-region="${escapeAttr(region.id)}">
      <div class="region-top">
        <span class="region-status">${region.trend === 'ihmal' ? 'AÇIK' : region.trend === 'sicak' ? 'SICAK' : 'DENGE'}</span>
        <strong>${formatNumber(region.load)}</strong>
      </div>
      <h3>${escapeHtml(region.label)}</h3>
      <p class="region-develops">${escapeHtml(region.develops)}</p>
      <span class="region-examples">${escapeHtml(region.exercisePreview.join(' · '))}</span>
      <div class="region-bars">
        <span><i style="--progress:${region.load}%"></i></span>
        <small>${region.daysSince >= 99 ? 'temas yok' : `${region.daysSince}g önce`}</small>
      </div>
    </button>
  `
}

function renderSessionsScreen(model) {
  return `
    <section class="screen sessions-screen">
      ${renderPageHead(
        model,
        'HEVY ANTRENMAN GEÇMİŞİ',
        'Ne yaptın?',
        `${formatNumber(model.workouts.length)} antrenman kayıtlı. Son 28 günde ${formatNumber(model.current28.sets)} set tamamlandı.`,
      )}

      <div class="sessions-layout">
        <section class="console-panel session-list-panel">
          <div class="panel-head">
            <div>
              <span class="eyebrow">SON KAYITLAR</span>
              <h2>Antrenman günlüğü</h2>
            </div>
            <span class="panel-chip">${formatNumber(model.sessions.length)}</span>
          </div>
          <div class="session-list">
            ${model.sessions.length ? model.sessions.map(renderSessionRow).join('') : '<p class="empty-state">Hevy’den henüz antrenman gelmedi.</p>'}
          </div>
        </section>

        <aside class="session-side">
          <section class="console-panel category-panel">
            <div class="panel-head compact">
              <div>
                <span class="eyebrow">SON 28 GÜN</span>
                <h2>Dağılım</h2>
              </div>
            </div>
            <div class="category-list">
              ${model.categories.map((category, index) => `
                <div class="category-row">
                  <span class="category-index">0${index + 1}</span>
                  <div>
                    <b>${escapeHtml(category.label)}</b>
                    <small>${formatNumber(category.sessions)} antrenman · ${formatNumber(category.minutes)} dk</small>
                  </div>
                  <div class="mini-track"><span style="--progress:${category.share}%"></span></div>
                  <strong>${formatNumber(category.share)}%</strong>
                </div>
              `).join('')}
            </div>
          </section>

          <section class="console-panel record-panel">
            <span class="eyebrow">DÖNEM ÖZETİ</span>
            <div class="record-grid">
              <div><strong>${formatNumber(model.current28.prs)}</strong><small>PR</small></div>
              <div><strong>${formatNumber(model.current28.sets)}</strong><small>SET</small></div>
              <div><strong>${compactNumber(model.current28.volumeKg)}</strong><small>KG</small></div>
              <div><strong>${formatNumber(model.current28.activeDays)}</strong><small>AKTİF GÜN</small></div>
            </div>
          </section>
        </aside>
      </div>
    </section>
  `
}

function renderSessionRow(session, index) {
  return `
    <button type="button" class="session-row" data-session="${escapeAttr(session.id)}">
      <span class="session-index">${String(index + 1).padStart(2, '0')}</span>
      <span class="session-type-icon">${session.hasPr ? icon('trophy') : icon('dumbbell')}</span>
      <div class="session-copy">
        <span>${escapeHtml(session.dateLabel)}</span>
        <b>${escapeHtml(session.type || 'Antrenman')}</b>
        <div class="session-analysis">
          <em>${escapeHtml(session.verdict)}</em>
          ${renderStatGains(session.statGains)}
        </div>
        <small>${escapeHtml(session.topExercises.join(' / ') || session.highlight || 'Egzersiz detayı yok')}</small>
      </div>
      <div class="session-numbers">
        <span><b>${formatNumber(session.sets || 0)}</b><small>set</small></span>
        <span><b>${compactNumber(session.volumeKg || 0)}</b><small>kg</small></span>
        <span><b>${formatNumber(session.durationMin || 0)}</b><small>dk</small></span>
      </div>
      ${icon('arrow')}
    </button>
  `
}

function renderStatGains(statGains = []) {
  return (statGains || []).map(gain => `
    <span class="stat-gain">+${formatDelta(gain.value)} ${escapeHtml(gain.short)}</span>
  `).join('')
}

function renderDetail() {
  if (!detail) return ''
  return `
    <div class="detail-backdrop" data-detail-close>
      <section class="detail-sheet" role="dialog" aria-modal="true" aria-label="${escapeAttr(detail.title)}">
        <div class="detail-head">
          <span class="eyebrow">${escapeHtml(detail.eyebrow || 'DETAY')}</span>
          <button type="button" class="icon-button" data-detail-close aria-label="Kapat">${icon('close')}</button>
        </div>
        <h2>${escapeHtml(detail.title)}</h2>
        ${detail.body}
      </section>
    </div>
  `
}

function renderAccessPrompt() {
  if (!accessPromptOpen) return ''
  return `
    <div class="detail-backdrop" data-access-close>
      <section class="detail-sheet access-sheet" role="dialog" aria-modal="true" aria-labelledby="access-title">
        <div class="detail-head">
          <span class="eyebrow">ÖZEL HEVY VERİSİ</span>
          <button type="button" class="icon-button" data-access-close aria-label="Kapat">${icon('close')}</button>
        </div>
        <h2 id="access-title">Erişim anahtarı</h2>
        <div class="detail-block">
          <p>Anahtar yalnızca bu cihazda saklanır ve Hevy API anahtarını tarayıcıya açmaz.</p>
        </div>
        <form class="access-form" data-access-form>
          <label for="odie-access-token">OdiePt erişim anahtarı</label>
          <input id="odie-access-token" name="accessToken" type="password" autocomplete="off" required>
          <div class="access-actions">
            <button type="submit" class="sync-button">Bağlan</button>
            <button type="button" class="rail-action" data-access-close>Vazgeç</button>
          </div>
        </form>
      </section>
    </div>
  `
}

function regionDetail(model, regionId) {
  const region = model.regions.find(item => item.id === regionId)
  if (!region) return null
  if (region.group === 'joint') {
    return {
      eyebrow: 'EKLEM YÜKÜ',
      title: region.label,
      body: `
        <div class="detail-score-grid">
          <div><small>YÜK</small><strong>${formatNumber(region.load)}</strong></div>
          <div><small>TOPARLANMA</small><strong>${formatNumber(region.recovery)}</strong></div>
          <div><small>MARUZİYET</small><strong>${formatNumber(region.risk)}</strong></div>
        </div>
        <div class="detail-block">
          <span class="eyebrow">${escapeHtml(region.riskLabel)}</span>
          <p>Bu skor yalnızca Hevy hareket ve set verisinden tahmini yük maruziyetidir; ağrı veya sakatlık teşhisi değildir.</p>
        </div>
        <div class="detail-block">
          <span class="eyebrow">DENGELEYİCİ DESTEK</span>
          <p>${escapeHtml(region.action)}</p>
        </div>
        <div class="detail-meta">
          <span>Son temas</span>
          <b>${region.daysSince >= 99 ? 'Yakın dönem kaydı yok' : `${formatNumber(region.daysSince)} gün önce`}</b>
        </div>
      `,
    }
  }

  const contributors = region.contributors || []
  return {
    eyebrow: 'HAREKET → BÖLGE',
    title: region.label,
    body: `
      <div class="detail-score-grid">
        <div><small>YÜK</small><strong>${formatNumber(region.load)}</strong></div>
        <div><small>SON TEMAS</small><strong>${region.daysSince >= 99 ? '—' : formatNumber(region.daysSince)}<em>${region.daysSince >= 99 ? '' : 'g'}</em></strong></div>
        <div><small>KAYIT</small><strong>${formatNumber(region.matchedSessions || 0)}</strong></div>
      </div>
      <div class="detail-block">
        <span class="eyebrow">NEYİ GELİŞTİRİR?</span>
        <p>${escapeHtml(region.develops)}</p>
      </div>
      <div class="detail-section">
        <span class="eyebrow">SENDE ÇALIŞAN HAREKETLER · 28G</span>
        <div class="contributor-list">
          ${contributors.length ? contributors.map(item => `
            <div>
              <span><b>${escapeHtml(item.name)}</b><small>${formatNumber(item.sessions)} antrenman · son ${formatNumber(item.daysSince)}g</small></span>
              <strong>${formatNumber(item.sets)} set</strong>
            </div>
          `).join('') : '<p class="empty-inline">Son 28 günde bu bölgeye doğrudan eşleşen hareket yok.</p>'}
        </div>
      </div>
      <div class="detail-section">
        <span class="eyebrow">AÇIĞI KAPAT</span>
        <div class="recommendation-chips">
          ${(region.recommendations || []).map(item => `<span>${escapeHtml(item)}</span>`).join('')}
        </div>
      </div>
    `,
  }
}

function sessionDetail(model, sessionId) {
  const session = model.sessions.find(item => String(item.id) === String(sessionId))
  if (!session) return null
  return {
    eyebrow: `${session.dateLabel} · ANTRENMAN OKUMASI`,
    title: session.type || 'Antrenman',
    body: `
      <div class="session-verdict">
        <b>${escapeHtml(session.verdict)}</b>
        <div>${renderStatGains(session.statGains)}</div>
      </div>
      <div class="detail-score-grid">
        <div><small>SET</small><strong>${formatNumber(session.sets || 0)}</strong></div>
        <div><small>HACİM</small><strong>${compactNumber(session.volumeKg || 0)}</strong></div>
        <div><small>SÜRE</small><strong>${formatNumber(session.durationMin || 0)}<em>dk</em></strong></div>
      </div>
      ${session.highlight ? `<div class="detail-block"><span class="eyebrow">ÖNE ÇIKAN</span><p>${escapeHtml(session.highlight)}</p></div>` : ''}
      <div class="exercise-list">
        ${(session.exercises || []).length ? session.exercises.map(exercise => `
          <div>
            <span>
              <b>${escapeHtml(exercise.name || 'Egzersiz')}</b>
              <small>${escapeHtml((exercise.targets || []).map(target => target.label).join(' · ') || 'Genel katkı')}</small>
            </span>
            <strong>${formatNumber(Array.isArray(exercise.sets) ? exercise.sets.length : 0)} set</strong>
          </div>
        `).join('') : '<p class="empty-state">Egzersiz kırılımı yok.</p>'}
      </div>
    `,
  }
}

async function handleClick(event) {
  const closeButton = event.target.closest('[data-detail-close]')
  if (closeButton && (!event.target.closest('.detail-sheet') || event.target.closest('.icon-button'))) {
    detail = null
    scheduleRender()
    return
  }

  const accessClose = event.target.closest('[data-access-close]')
  if (accessClose && (!event.target.closest('.access-sheet') || event.target.closest('button'))) {
    accessPromptOpen = false
    scheduleRender()
    return
  }

  const tabButton = event.target.closest('[data-tab]')
  if (tabButton) {
    setActiveTab(tabButton.dataset.tab)
    return
  }

  if (event.target.closest('[data-sync]')) {
    await syncDashboard()
    return
  }

  if (event.target.closest('[data-access-clear]')) {
    dashboardStore.clearCache()
    clearAppAccessToken()
    window.location.reload()
    return
  }

  if (event.target.closest('[data-access]')) {
    connectLive()
    return
  }

  const model = currentModel || createDashboardModel(dashboardStore.getState())
  const regionButton = event.target.closest('[data-region]')
  if (regionButton) {
    detail = regionDetail(model, regionButton.dataset.region)
    scheduleRender()
    return
  }

  const sessionButton = event.target.closest('[data-session]')
  if (sessionButton) {
    detail = sessionDetail(model, sessionButton.dataset.session)
    scheduleRender()
    return
  }

  const statButton = event.target.closest('[data-stat]')
  if (statButton) {
    const stat = model.stats.find(item => item.key === statButton.dataset.stat)
    if (!stat) return
    detail = {
      eyebrow: 'KARAKTER STATI',
      title: `${stat.name} · Rank ${stat.rank}`,
      body: `
        <div class="detail-stat-rank">${escapeHtml(stat.rank)}</div>
        <div class="detail-block"><p>Bu rank Hevy antrenmanlarındaki ilgili hareket, yük ve tekrar kanıtlarından hesaplanır. Ham skor: ${formatNumber(stat.score)}/100.</p></div>
      `,
    }
    scheduleRender()
  }
}

function handleKeydown(event) {
  if (event.key !== 'Escape') return
  if (detail) detail = null
  else if (accessPromptOpen) accessPromptOpen = false
  else return
  scheduleRender()
}

function handleSubmit(event) {
  const form = event.target.closest('[data-access-form]')
  if (!form) return
  event.preventDefault()
  const field = form.elements.namedItem('accessToken')
  if (!setAppAccessToken(field?.value)) return
  accessPromptOpen = false
  window.location.reload()
}

async function syncDashboard() {
  try {
    await dashboardStore.refresh({ pullHevy: true })
  } catch (error) {
    if (String(error?.message || error) === 'unauthorized') connectLive()
    console.warn('[odiept] sync failed:', error?.message || error)
  }
}

function connectLive() {
  detail = null
  accessPromptOpen = true
  scheduleRender()
}

function icon(name) {
  const paths = {
    pulse: '<path d="M3 12h4l2-6 4 12 2-6h6"/>',
    body: '<circle cx="12" cy="5" r="2.5"/><path d="M8 21l1.5-7L7 9l3-2h4l3 2-2.5 5L16 21M8.5 14h7"/>',
    list: '<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4" cy="6" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="18" r="1"/>',
    refresh: '<path d="M20 7v5h-5"/><path d="M18 17a8 8 0 1 1 1-9l1 4"/>',
    warning: '<path d="M12 3 2.8 20h18.4L12 3Z"/><path d="M12 9v5M12 17.5v.1"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    target: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>',
    sessions: '<path d="M5 6h14M5 12h14M5 18h9"/>',
    days: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18"/>',
    volume: '<path d="M6 8v8M18 8v8M3 10v4M21 10v4M6 12h12"/>',
    time: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    arrow: '<path d="m9 5 7 7-7 7"/>',
    dumbbell: '<path d="M6 8v8M18 8v8M3 10v4M21 10v4M6 12h12"/>',
    trophy: '<path d="M8 4h8v5a4 4 0 0 1-8 0V4Z"/><path d="M8 6H4v2a4 4 0 0 0 4 4M16 6h4v2a4 4 0 0 1-4 4M12 13v4M8 21h8M9 17h6"/>',
    close: '<path d="m6 6 12 12M18 6 6 18"/>',
  }
  return `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">${paths[name] || paths.pulse}</svg>`
}

function regionTone(region) {
  if (region.risk >= 65) return 'danger'
  if (region.trend === 'ihmal' || region.load < 38) return 'gap'
  if (region.trend === 'sicak') return 'hot'
  return 'ready'
}

function riskTone(risk) {
  if (risk >= 65) return 'high'
  if (risk >= 40) return 'medium'
  return 'low'
}

function signed(value) {
  const rounded = Math.round(Number(value) || 0)
  return `${rounded > 0 ? '+' : ''}${rounded}%`
}

function compactNumber(value, suffix = '') {
  const amount = Number(value) || 0
  let output = ''
  if (Math.abs(amount) >= 1_000_000) output = `${(amount / 1_000_000).toFixed(1)}m`
  else if (Math.abs(amount) >= 1000) output = `${(amount / 1000).toFixed(amount >= 10_000 ? 0 : 1)}k`
  else output = formatNumber(Math.round(amount))
  return suffix ? `${output} ${suffix}` : output
}

function compactMinutes(value) {
  const minutes = Math.round(Number(value) || 0)
  if (minutes < 60) return `${minutes} dk`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest ? `${hours}s ${rest}d` : `${hours} saat`
}

function formatNumber(value) {
  return new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 1 }).format(Number(value) || 0)
}

function formatDelta(value) {
  return new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 1 }).format(Math.max(0, Number(value) || 0))
}

function formatFullDate(value) {
  const date = new Date(`${value}T12:00:00`)
  return date.toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long' }).toLocaleUpperCase('tr-TR')
}

function relativeDay(age) {
  if (age <= 0) return 'bugün'
  if (age === 1) return 'dün'
  return `${formatNumber(age)} gün önce`
}

function cacheAgeLabel(value) {
  const ageMs = Number(value)
  if (!Number.isFinite(ageMs) || ageMs < 0) return 'yaşı bilinmiyor'
  const minutes = Math.max(1, Math.round(ageMs / 60_000))
  if (minutes < 60) return `${minutes} dk`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} sa`
  return `${Math.round(hours / 24)} gün`
}

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function escapeAttr(value = '') {
  return escapeHtml(value).replace(/`/g, '&#096;')
}
