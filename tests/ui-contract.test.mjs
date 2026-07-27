import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8')
const css = readFileSync(new URL('../src/styles/cozy-reforge.css', import.meta.url), 'utf8')
const index = readFileSync(new URL('../index.html', import.meta.url), 'utf8')
const snapshotApi = readFileSync(new URL('../api/snapshot.js', import.meta.url), 'utf8')
const dashboardStore = readFileSync(new URL('../src/data/dashboard-store.js', import.meta.url), 'utf8')
const hevyPersist = readFileSync(new URL('../lib/hevy/persist.js', import.meta.url), 'utf8')

test('dashboard has only the three product surfaces requested', () => {
  assert.match(main, /\{ key: 'overview', label: 'Durum'/)
  assert.match(main, /\{ key: 'body', label: 'Bölgeler'/)
  assert.match(main, /\{ key: 'sessions', label: 'Antrenmanlar'/)
  assert.match(main, /renderOverviewScreen/)
  assert.match(main, /renderBodyScreen/)
  assert.match(main, /renderSessionsScreen/)
  assert.doesNotMatch(main, /renderSignalScreen|renderMapScreen|ask-form|data-intake|panel-coach/)
})

test('overview exposes Hevy status, 28 day metrics, XP, gaps and ranks', () => {
  assert.match(main, /HEVY TRAINING CONSOLE/)
  assert.match(main, /SEVİYE İLERLEMESİ/)
  assert.match(main, /SON 28 GÜN/)
  assert.match(main, /Eksik kalan bölgeler/)
  assert.match(main, /KARAKTER STATLARI/)
  assert.match(main, /data-sync/)
  assert.match(css, /\.player-card/)
  assert.match(css, /\.weekly-chart/)
  assert.match(css, /\.activity-grid/)
  assert.match(css, /\.gap-row/)
  assert.match(css, /\.stat-tile/)
})

test('body and session screens expose compact tappable detail surfaces', () => {
  assert.match(main, /28 GÜNLÜK BÖLGE ANALİZİ/)
  assert.match(main, /data-region=/)
  assert.match(main, /HEVY ANTRENMAN GEÇMİŞİ/)
  assert.match(main, /NEYİ GELİŞTİRİR\?/)
  assert.match(main, /SENDE ÇALIŞAN HAREKETLER/)
  assert.match(main, /data-session=/)
  assert.match(main, /session\.verdict/)
  assert.match(main, /renderStatGains/)
  assert.match(main, /function renderDetail/)
  assert.match(main, /currentModel \|\| createDashboardModel/)
  assert.match(main, /role="dialog"/)
  assert.match(css, /\.region-grid/)
  assert.match(css, /\.session-row/)
  assert.match(css, /\.stat-gain/)
  assert.match(css, /\.contributor-list/)
  assert.match(css, /\.detail-sheet/)
})

test('browser data path is a direct Hevy snapshot with optional app-token headers', () => {
  assert.match(main, /dashboardStore/)
  assert.doesNotMatch(main, /supabase-client|from ['"].*\/store\.js['"]|\/api\/ask|\/api\/intake/)
  assert.match(snapshotApi, /buildDirectHevySnapshot/)
  assert.doesNotMatch(snapshotApi, /SUPABASE|hevy_sync_state|coach_notes|athlete_memory|memory_feedback|odie_questions/)
  assert.match(dashboardStore, /params\.set\('refresh', '1'\)/)
  assert.match(dashboardStore, /params\.set\('refresh_nonce', Date\.now\(\)\.toString\(36\)\)/)
  assert.match(dashboardStore, /headers: appHeaders\(\)/)
  assert.doesNotMatch(dashboardStore, /\/api\/hevy-sync/)
  assert.match(main, /Hevy zaten güncel/)
})

test('Hevy persistence does not trigger coach or model generation', () => {
  const ingestStart = hevyPersist.indexOf('export async function ingestNormalizedExternalWorkout')
  const ingestEnd = hevyPersist.indexOf('export function buildExternalWorkoutDraftSession')
  const activeIngest = hevyPersist.slice(ingestStart, ingestEnd)
  assert.ok(ingestStart >= 0 && ingestEnd > ingestStart)
  assert.doesNotMatch(activeIngest, /generateCoach|getCoachResponse|generateAndPersistCoachNote|coachResult/)
  assert.doesNotMatch(activeIngest, /coach:/)
})

test('responsive console keeps zoom available and has mobile navigation', () => {
  assert.doesNotMatch(index, /maximum-scale|user-scalable=no/)
  assert.match(index, /Oxanium/)
  assert.match(css, /@media \(max-width: 840px\)/)
  assert.match(css, /\.mobile-nav/)
  assert.match(css, /min-width: 320px/)
  assert.match(css, /min-height: 44px/)
})

test('new dashboard source contains no user-facing AI or chat product', () => {
  const lower = main.toLocaleLowerCase('tr-TR')
  for (const banned of ['gemini', 'chatbot', 'coach', 'soru sor', 'odie’ye söyle', 'ask-form']) {
    assert.equal(lower.includes(banned), false, `unexpected product term: ${banned}`)
  }
})
