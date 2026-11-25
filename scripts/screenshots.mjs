// Captures the 6 documentation screenshots into docs/.
// Serves dist/ with vite preview and drives it with Playwright Chromium.
// Run with: node scripts/screenshots.mjs

import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';

const CHROME = '/home/hatch/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome';
const PORT = 4175;
const BASE = `http://localhost:${PORT}/`;
const OUT = new URL('../docs/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });

const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], {
  cwd: new URL('..', import.meta.url).pathname,
  stdio: 'ignore',
});

async function waitForServer() {
  for (let i = 0; i < 40; i++) {
    try {
      const res = await fetch(BASE);
      if (res.ok) return;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error('preview server did not start');
}

async function select(page, code) {
  await page.locator('.course-row', { hasText: code }).first().click();
  await page.waitForFunction(
    (c) => document.querySelector('.right h2')?.textContent.includes(c),
    code,
    { timeout: 15000 },
  );
}

async function shot(page, name) {
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(350);
  await page.screenshot({ path: `${OUT}${name}` });
  console.log(name);
}

try {
  await waitForServer();
  const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1500, height: 950 } });
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForSelector('.topbar-stats', { timeout: 30000 });
  await page.waitForTimeout(600);

  // 1. The full graph.
  await shot(page, '1-graph.png');

  // 2. Course detail with the prerequisite chain highlighted.
  await select(page, 'CPT401');
  await page.waitForTimeout(500);
  await shot(page, '2-detail.png');

  // 3. Path finder result.
  await page.getByRole('button', { name: 'Path finder' }).click();
  await page.locator('.right select').first().selectOption('CPT401');
  await page.getByRole('button', { name: 'Build my study path' }).click();
  await page.waitForSelector('.path-list li', { timeout: 15000 });
  await page.waitForTimeout(400);
  await shot(page, '3-path.png');

  // 4. Progress after completing the 100 level foundations.
  for (const code of ['CPT101', 'CPT102', 'MTH101', 'CPT103']) {
    await select(page, code);
    await page.getByRole('button', { name: 'Mark as completed' }).click();
    await page.waitForTimeout(300);
  }
  await page.getByRole('button', { name: 'Course', exact: true }).click();
  await page.waitForTimeout(400);
  await shot(page, '4-progress.png');

  // 5. Add course form.
  await page.getByRole('button', { name: 'Add course' }).click();
  await page.locator('.right input').nth(0).fill('CPT309');
  await page.locator('.right input').nth(1).fill('Web Development');
  await page.locator('.right select[multiple]').selectOption(['CPT204', 'CPT206']);
  await page.waitForTimeout(300);
  await shot(page, '5-add.png');

  // 6. Mobile view.
  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await mobile.goto(BASE, { waitUntil: 'networkidle' });
  await mobile.waitForSelector('.topbar-stats', { timeout: 30000 });
  await mobile.waitForTimeout(600);
  await mobile.screenshot({ path: `${OUT}6-mobile.png` });
  console.log('6-mobile.png');

  await browser.close();
} finally {
  server.kill();
}
console.log('Screenshots done.');
