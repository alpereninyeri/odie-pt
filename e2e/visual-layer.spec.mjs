import { expect, test } from '@playwright/test'

const viewports = [
  { width: 320, height: 568 },
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1440, height: 900 },
]

async function auditSurface(page) {
  const result = await page.evaluate(() => {
    const doc = document.documentElement
    const badImages = [...document.images]
      .filter(image => !image.complete || image.naturalWidth <= 0)
      .map(image => image.currentSrc || image.src)
    const smallTargets = [...document.querySelectorAll('button, a, input, textarea, select')]
      .filter(element => {
        if (element.matches('.activity-cell')) return false
        const rect = element.getBoundingClientRect()
        return rect.width > 0 && rect.height > 0 && (rect.width < 44 || rect.height < 44)
      })
      .map(element => ({
        label: (element.innerText || element.getAttribute('aria-label') || element.className || '').toString().slice(0, 60),
        width: Math.round(element.getBoundingClientRect().width),
        height: Math.round(element.getBoundingClientRect().height),
      }))

    return {
      overflow: Math.max(0, doc.scrollWidth - doc.clientWidth),
      badImages,
      smallTargets,
      bodyText: document.body.innerText.toLocaleLowerCase('tr-TR'),
    }
  })

  expect(result.overflow, 'horizontal overflow').toBe(0)
  expect(result.badImages, 'broken image assets').toEqual([])
  expect(result.smallTargets, 'tap targets under 44px').toEqual([])
  expect(result.bodyText).not.toContain('gemini')
  expect(result.bodyText).not.toContain('chatbot')
  expect(result.bodyText).not.toContain('soru sor')
}

async function openDetailAndClose(page, selector) {
  await page.locator(selector).first().click()
  await expect(page.locator('.detail-sheet')).toBeVisible()
  await page.locator('.detail-sheet .icon-button').click()
  await expect(page.locator('.detail-sheet')).toHaveCount(0)

  await page.locator(selector).first().click()
  await page.keyboard.press('Escape')
  await expect(page.locator('.detail-sheet')).toHaveCount(0)
}

for (const viewport of viewports) {
  test(`Hevy dashboard QA ${viewport.width}x${viewport.height}`, async ({ page }) => {
    const errors = []
    page.on('console', message => {
      if (message.type() === 'error') errors.push(message.text())
    })
    page.on('pageerror', error => errors.push(error.message))

    await page.setViewportSize(viewport)
    await page.goto('/?tab=overview')
    await page.locator('.app-shell').waitFor()

    await expect(page).toHaveTitle('OdiePt · Durum')
    await expect(page.locator('.overview-screen')).toBeVisible()
    await expect(page.locator('.page-head')).toContainText('Son antrenman dün')
    await expect(page.locator('.player-card')).toBeVisible()
    await expect(page.locator('.quest-card')).toBeVisible()
    await expect(page.locator('.metric-card')).toHaveCount(4)
    await expect(page.locator('.weekly-chart')).toBeVisible()
    await expect(page.locator('.activity-cell')).toHaveCount(28)
    await expect(page.locator('.gap-row')).toHaveCount(4)
    await expect(page.locator('.stat-tile')).toHaveCount(6)
    await openDetailAndClose(page, '.gap-row')
    await auditSurface(page)
    await page.evaluate(() => window.scrollTo(0, 0))
    if (viewport.width === 390) {
      await page.screenshot({ path: 'test-results/odiept-mobile-overview.png' })
    }
    if (viewport.width === 1440) {
      await page.screenshot({ path: 'test-results/odiept-desktop-overview.png' })
    }

    const navSelector = viewport.width <= 840 ? '.mobile-nav-button' : '.rail-nav-button'
    await expect(page.locator(navSelector)).toHaveText(['Durum', 'Bölgeler', 'Antrenmanlar'])

    await page.locator(`${navSelector}[data-tab="body"]`).click()
    await expect(page).toHaveTitle('OdiePt · Bölgeler')
    await expect(page.locator('.body-screen')).toBeVisible()
    expect(await page.locator('.region-tile').count()).toBeGreaterThanOrEqual(8)
    await page.locator('.region-tile').first().click()
    await expect(page.locator('.detail-sheet')).toContainText('NEYİ GELİŞTİRİR?')
    await expect(page.locator('.detail-sheet')).toContainText('AÇIĞI KAPAT')
    await page.locator('.detail-sheet .icon-button').click()
    await expect(page.locator('.detail-sheet')).toHaveCount(0)
    await auditSurface(page)

    await page.locator(`${navSelector}[data-tab="sessions"]`).click()
    await expect(page).toHaveTitle('OdiePt · Antrenmanlar')
    await expect(page.locator('.sessions-screen')).toBeVisible()
    expect(await page.locator('.session-row').count()).toBeGreaterThan(0)
    await expect(page.locator('.session-row .session-analysis').first()).toBeVisible()
    await page.locator('.session-row').first().click()
    await expect(page.locator('.detail-sheet .session-verdict')).toBeVisible()
    await expect(page.locator('.detail-sheet .stat-gain').first()).toBeVisible()
    await page.locator('.detail-sheet .icon-button').click()
    await expect(page.locator('.detail-sheet')).toHaveCount(0)
    await auditSurface(page)

    expect(errors, 'console/page errors').toEqual([])
  })
}

test('private direct Hevy snapshot loads with app auth and manual refresh re-reads it', async ({ page }) => {
  const snapshotRequests = []
  const today = new Date().toISOString().slice(0, 10)
  await page.addInitScript(() => {
    localStorage.setItem('odiept-app-access-token', 'e2e-app-secret')
  })

  await page.route('**/api/snapshot?**', async route => {
    snapshotRequests.push({
      headers: route.request().headers(),
      url: route.request().url(),
    })
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        profile: {
          id: 'e2e-profile',
          nick: 'Alperen',
          level: 8,
          xp_current: 640,
          xp_max: 2000,
          class: 'Hybrid Athlete',
          streak_current: 4,
          streak_max: 9,
          stats: { str: 62, agi: 48, end: 37, dex: 44, con: 41, sta: 56 },
        },
        workouts: [
          {
            id: 'e2e-workout',
            date: today,
            type: 'Parkour',
            duration_min: 90,
            volume_kg: 0,
            sets: 4,
            has_pr: false,
            source: 'hevy',
            exercises: [
              {
                name: 'Kong Vault Jump',
                impactTags: ['parkour', 'balance', 'explosive'],
                sets: [{ reps: 6 }, { reps: 6 }],
              },
              {
                name: 'Front Lever',
                impactTags: ['pull', 'core', 'isometric', 'body-control'],
                sets: [{ duration_sec: 20 }, { duration_sec: 18 }],
              },
            ],
          },
        ],
        syncState: {
          mode: 'direct',
          fetched_workouts: 1,
          last_synced_at: new Date().toISOString(),
        },
        source: { hevy: 'live-direct', storage: 'none' },
        privacy: 'private-athlete',
      }),
    })
  })

  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/?tab=overview')
  await page.locator('.app-shell.mode-live').waitFor()
  await expect(page.locator('.mobile-source')).toContainText('HEVY')
  await expect(page.locator('.page-head h1')).toContainText('Alperen')
  await page.locator('.sync-button').click()
  await expect(page.locator('.status-banner.is-success')).toContainText('1 antrenman okundu')
  await page.locator('.mobile-nav-button[data-tab="sessions"]').click()
  await page.locator('.session-row').first().click()
  await expect(page.locator('.detail-sheet .session-verdict')).toContainText('Patlayıcı Beceri')
  await expect(page.locator('.detail-sheet .exercise-list')).toContainText('Denge · Patlayıcılık · Ön Bacak')
  await expect(page.locator('.detail-sheet .exercise-list')).toContainText('Vücut Kontrolü · İzometrik Güç · Kanat')
  await expect(page.locator('.detail-sheet .exercise-list')).not.toContainText('Genel katkı')
  await page.locator('.detail-sheet .icon-button').click()
  await expect(page.locator('.detail-sheet')).toHaveCount(0)

  expect(snapshotRequests.length).toBeGreaterThanOrEqual(2)
  expect(snapshotRequests.some(request => new URL(request.url).searchParams.get('refresh') === '1')).toBe(true)
  expect(snapshotRequests.every(request => request.headers.authorization === 'Bearer e2e-app-secret')).toBe(true)
  await auditSurface(page)
})

test('locked dashboard does not fetch private data without an access token', async ({ page }) => {
  const requests = []
  await page.route('**/api/snapshot?**', async route => {
    requests.push(route.request().headers())
    await route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: JSON.stringify({ ok: false, error: 'unauthorized' }),
      headers: { 'cache-control': 'private, no-store' },
    })
  })

  await page.goto('/?tab=overview')
  await expect(page.locator('.status-banner.is-error')).toBeVisible()
  await expect(page.locator('.status-banner.is-error')).toContainText('OdiePt kilitli')
  const accessButton = page.locator('.rail-source [data-access]')
  await expect(accessButton).toHaveCount(1)
  await expect(accessButton).toContainText('Erişim anahtarı gir')
  await accessButton.click()
  await expect(page.locator('.access-sheet')).toBeVisible()
  await page.getByLabel('OdiePt erişim anahtarı').fill('test-only-secret')
  await page.locator('.access-sheet .icon-button').click()
  await expect(page.locator('.access-sheet')).toHaveCount(0)
  expect(requests.length).toBeGreaterThan(0)
  expect(requests.every(headers => !headers.authorization)).toBe(true)
})
