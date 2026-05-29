import { expect, test } from '@playwright/test'

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
]

async function auditSurface(page) {
  const result = await page.evaluate((banned) => {
    const body = document.body
    const text = body.innerText.toLowerCase()
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
    return {
      title: document.title,
      badImages: images.filter(img => !img.complete || img.naturalWidth <= 0),
      overflow,
      banned: banned.find(word => text.includes(word)) || null,
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

    await page.locator('[data-tab="map"]').click()
    await expect(page).toHaveTitle('OdiePt - Harita')
    await expect(page.locator('.world-node')).toHaveCount(6)
    await expect(page.locator('.active-quest-node')).toHaveCount(1)
    await expect(page.locator('.world-mini-node').first()).toBeVisible()
    await openDetailAndClose(page, '.world-node')
    await auditSurface(page)

    await page.locator('[data-tab="signal"]').click()
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
