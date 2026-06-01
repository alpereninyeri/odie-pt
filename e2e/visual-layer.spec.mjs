import { expect, test } from '@playwright/test'

import { parseIntakeText } from '../lib/odie-intake/parser.js'

const viewports = [
  { width: 320, height: 568 },
  { width: 390, height: 844 },
  { width: 414, height: 896 },
  { width: 768, height: 1024 },
  { width: 1440, height: 900 },
]

const bannedVisible = [
  'mission loop',
  'hud',
  'lvl',
  'locked',
  'unlocked',
  'confidence',
  'evidence',
  'source',
  'schema',
  'migration',
  'endpoint',
  'json',
  'payload',
  'cache',
  'fallback',
  'defter',
  'kayit',
  'simdi',
  'gelisim',
  'gorev',
  'bolge',
  'kapisi',
  'gecmis',
  'gunluk',
  'hafiza',
]

async function auditSurface(page) {
  const result = await page.evaluate((banned) => {
    const body = document.body
    const text = body.innerText.toLocaleLowerCase('tr-TR')
    const images = [...document.images].map(img => ({
      src: img.currentSrc || img.src,
      complete: img.complete,
      naturalWidth: img.naturalWidth,
    }))
    const doc = document.documentElement
    const overflow = Math.max(0, doc.scrollWidth - doc.clientWidth)
    const smallTargets = [...document.querySelectorAll('button, a, input, textarea, select')]
      .filter(el => {
        const rect = el.getBoundingClientRect()
        return rect.width > 0 && rect.height > 0 && (rect.width < 44 || rect.height < 44)
      })
      .map(el => ({
        tag: el.tagName.toLowerCase(),
        text: (el.innerText || el.getAttribute('aria-label') || el.id || el.className || '').toString().slice(0, 60),
        width: Math.round(el.getBoundingClientRect().width),
        height: Math.round(el.getBoundingClientRect().height),
      }))
    const hasBanned = (word) => {
      const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      return new RegExp(`(^|[^\\p{L}\\p{N}_])${escaped}([^\\p{L}\\p{N}_]|$)`, 'iu').test(text)
    }
    return {
      title: document.title,
      badImages: images.filter(img => !img.complete || img.naturalWidth <= 0),
      overflow,
      banned: banned.find(word => hasBanned(word)) || null,
      smallTargets,
    }
  }, bannedVisible)

  expect(result.badImages, 'broken image assets').toEqual([])
  expect(result.overflow, 'horizontal overflow').toBe(0)
  expect(result.banned, 'banned visible word').toBeNull()
  expect(result.smallTargets, 'tap targets under 44px').toEqual([])
}

async function openDetailAndClose(page, selector) {
  await page.locator(selector).first().click()
  await expect(page.locator('.detail-sheet')).toBeVisible()
  await page.locator('[data-close-detail]').click()
  await expect(page.locator('.detail-sheet')).toHaveCount(0)

  await page.locator(selector).first().click()
  await page.keyboard.press('Escape')
  await expect(page.locator('.detail-sheet')).toHaveCount(0)
}

for (const viewport of viewports) {
  test(`visual layer QA ${viewport.width}x${viewport.height}`, async ({ page }) => {
    const errors = []
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text())
    })
    page.on('pageerror', error => errors.push(error.message))

    await page.setViewportSize(viewport)
    await page.goto('/?audit=e2e')
    await page.locator('.cozy-app').waitFor()
    await auditSurface(page)
    await expect(page.locator('.nav-item')).toHaveText(['Komuta', 'Harita', 'ODIE'])
    await expect(page).toHaveTitle('OdiePt - Komuta')
    await openDetailAndClose(page, '.xp-track')

    await page.locator('.cozy-nav [data-tab="map"]').click()
    await expect(page).toHaveTitle('OdiePt - Harita')
    await expect(page.locator('.world-node')).toHaveCount(6)
    await expect(page.locator('.active-quest-node')).toHaveCount(1)
    await expect(page.locator('.world-mini-node').first()).toBeVisible()
    await expect(page.locator('.world-mini-node.type-bountyNode').first()).toBeVisible()
    await openDetailAndClose(page, '.world-node')
    await openDetailAndClose(page, '.world-mini-node.type-bountyNode')
    await auditSurface(page)

    await page.locator('.cozy-nav [data-tab="signal"]').click()
    await expect(page).toHaveTitle('OdiePt - ODIE')
    await expect(page.locator('#ask-form')).toBeVisible()
    if (viewport.width <= 390) {
      const fit = await page.evaluate(() => {
        const navTop = document.querySelector('.cozy-nav')?.getBoundingClientRect().top || window.innerHeight
        const textarea = document.querySelector('#ask-textarea')?.getBoundingClientRect()
        const submit = document.querySelector('#ask-form button[type="submit"]')?.getBoundingClientRect()
        return {
          textareaTop: textarea?.top || 0,
          submitBottom: submit?.bottom || 9999,
          navTop,
        }
      })
      expect(fit.textareaTop, 'ODIE textarea first viewport').toBeLessThan(fit.navTop)
      expect(fit.submitBottom, 'ODIE CTA above bottom nav').toBeLessThanOrEqual(fit.navTop - 4)
    }
    await auditSurface(page)

    expect(errors, 'console/page errors').toEqual([])
  })
}

test('ODIE intake preview, confirm and reward flow works on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.route('**/api/ask', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, items: [] }),
    })
  })
  await page.route('**/api/intake', async route => {
    const body = route.request().postDataJSON()
    if (body.mode === 'confirm') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          kind: body.preview.kind,
          preview: body.preview,
          result: { reward: { chips: ['+12 XP', 'Seviye 4', 'Seri 2'] } },
        }),
      })
      return
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        preview: parseIntakeText(body.text, { today: '2026-06-01' }),
      }),
    })
  })

  await page.goto('/?audit=e2e')
  await page.locator('.cozy-app').waitFor()
  await page.locator('.cozy-nav [data-tab="signal"]').click()
  await expect(page).toHaveTitle('OdiePt - ODIE')

  await page.locator('#ask-textarea').fill('d\u00fcn g\u00f6\u011f\u00fcs \u00e7al\u0131\u015ft\u0131m 4 set bench 60 kilo')
  await page.locator('#ask-form button[type="submit"]').click()
  await expect(page.locator('.intake-preview')).toBeVisible()
  await expect(page.locator('.intake-preview')).toContainText('Seans kaydı')
  await expect(page.locator('[data-intake-confirm]')).toBeVisible()
  await expect(page.locator('.odie-face img')).toHaveAttribute('src', /odie-confirm/)

  await page.locator('[data-intake-confirm]').click()
  await expect(page.locator('.reward-recap')).toBeVisible()
  await expect(page).toHaveTitle('OdiePt - Komuta')
  await expect(page.locator('.recap-chips')).toContainText('+12 XP')
  await page.locator('[data-close-recap]').first().click()

  await page.locator('.cozy-nav [data-tab="signal"]').click()
  await expect(page.locator('.intake-result')).toContainText('Seans kaydı yazıldı')
  await expect(page.locator('.intake-result')).toContainText('+12 XP')
  await auditSurface(page)
})

test('manual injury manager creates updates and resolves a body event', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/?audit=e2e')
  await page.locator('.cozy-app').waitFor()
  await page.locator('.cozy-nav [data-tab="map"]').click()

  await expect(page.locator('.body-status-manager')).toBeVisible()
  await page.locator('#body-event-form select[name="region"]').selectOption('wrist')
  await page.locator('#body-event-form input[name="severity"]').fill('3')
  await page.locator('#body-event-form input[name="recoveryPercent"]').fill('70')
  await page.locator('#body-event-form input[name="etaDays"]').fill('3')
  await page.locator('#body-event-form input[name="note"]').fill('bilek sert push istemiyor')
  await page.locator('#body-event-form button[type="submit"]').click()

  await expect(page.locator('.injury-card')).toBeVisible()
  await expect(page.locator('.injury-main strong')).toContainText('%70')

  await page.locator('[data-body-event-action="increase_recovery"]').click()
  await expect(page.locator('.injury-main strong')).toContainText('%80')

  await page.locator('[data-body-recovery-input]').fill('95')
  await page.locator('[data-body-event-action="set_recovery"]').click()
  await expect(page.locator('.injury-main strong')).toContainText('%95')

  await page.locator('[data-body-event-action="resolve"]').click()
  await expect(page.locator('.body-empty')).toBeVisible()
  await auditSurface(page)
})
