// End to end checks for Pathway against the production build.
// Serves dist/ with vite preview, drives it with Playwright Chromium,
// and fails on any console error. Run with: node scripts/e2e.mjs

import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';

const CHROME = '/home/hatch/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome';
const PORT = 4173;
const BASE = `http://localhost:${PORT}/`;

let passed = 0;
let failed = 0;
function check(name, ok, extra = '') {
  if (ok) {
    passed++;
    console.log(`PASS ${name}`);
  } else {
    failed++;
    console.log(`FAIL ${name} ${extra}`);
  }
}

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

try {
  await waitForServer();
  const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1500, height: 950 } });
  const consoleErrors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', (err) => consoleErrors.push(String(err)));

  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForSelector('.topbar-stats', { timeout: 30000 });

  const headerText = await page.locator('.topbar-stats').innerText();
  check('header shows 33 courses', headerText.includes('33'), headerText);
  check('header shows 43 prerequisite links', headerText.includes('43'), headerText);
  check('engine badge shows Relate version', /Relate 1\./.test(headerText), headerText);

  const nodeCount = await page.locator('svg .node').count();
  check('graph renders 33 course nodes', nodeCount === 33, `got ${nodeCount}`);

  // Select CPT401 from the course list.
  await page.locator('.course-row', { hasText: 'CPT401' }).first().click();
  await page.waitForSelector('.right h2', { timeout: 15000 });
  const detailText = await page.locator('.right').innerText();
  check('detail shows Machine Learning', detailText.includes('Machine Learning'));
  check('detail lists direct prerequisite CPT307', detailText.includes('CPT307'));
  check('detail shows lecturer', detailText.includes('Dr Emeka Nwosu'));
  check('shortest chain reaches CPT101', detailText.includes('CPT101'));

  // Mark CPT101 completed, then check progress moved.
  await page.locator('.course-row', { hasText: 'CPT101' }).first().click();
  await page.waitForFunction(
    () => document.querySelector('.right h2')?.textContent.includes('CPT101'),
    null,
    { timeout: 15000 },
  );
  await page.getByRole('button', { name: 'Mark as completed' }).click();
  await page.waitForFunction(
    () => document.querySelector('.progress-box')?.textContent.includes('1 of 33'),
    null,
    { timeout: 15000 },
  );
  check('progress updates after marking CPT101 completed', true);

  // Persistence: reload and confirm CPT101 is still completed (OPFS store).
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector('.topbar-stats', { timeout: 30000 });
  const progressAfterReload = await page.locator('.progress-box').innerText();
  check('completion survives reload (persistent store)', progressAfterReload.includes('1 of 33'), progressAfterReload);

  // Path finder for CPT401.
  await page.getByRole('button', { name: 'Path finder' }).click();
  await page.locator('.right select').first().selectOption('CPT401');
  await page.getByRole('button', { name: 'Build my study path' }).click();
  await page.waitForSelector('.path-list li', { timeout: 15000 });
  const pathItems = await page.locator('.path-list li').allInnerTexts();
  check('path finder returns an ordered sequence', pathItems.length >= 10, `got ${pathItems.length}`);
  const joined = pathItems.join(' ');
  check(
    'path order respects prerequisites (CPT101 before CPT401)',
    joined.indexOf('CPT101') < joined.indexOf('CPT401'),
  );

  // Add a new course and confirm it appears and persists.
  await page.getByRole('button', { name: 'Add course' }).click();
  await page.locator('.right input').nth(0).fill('CPT309');
  await page.locator('.right input').nth(1).fill('Web Development');
  await page.locator('.right select[multiple]').selectOption(['CPT204']);
  await page.getByRole('button', { name: 'Add to graph' }).click();
  await page.waitForFunction(
    () => document.querySelector('.notice')?.textContent.includes('CPT309 added'),
    null,
    { timeout: 15000 },
  );
  check('new course CPT309 added to graph', true);
  const headerAfterAdd = await page.locator('.topbar-stats').innerText();
  check('course count is now 34', headerAfterAdd.includes('34'), headerAfterAdd);

  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector('.topbar-stats', { timeout: 30000 });
  const headerAfterReload = await page.locator('.topbar-stats').innerText();
  check('added course survives reload', headerAfterReload.includes('34'), headerAfterReload);

  // Search filter.
  await page.locator('input[type="search"]').fill('networks');
  await page.waitForFunction(
    () => document.querySelectorAll('.course-row').length === 1,
    null,
    { timeout: 10000 },
  );
  check('search narrows the course list to CPT302', true);

  // Under the hood shows a real Cypher statement.
  const hood = await page.locator('.hood').innerText();
  check('under the hood shows Cypher and store mode', hood.includes('MATCH') && hood.includes('OPFS'), hood.slice(0, 200));

  // Reset restores the sample graph (34 -> 33, progress cleared).
  await page.locator('input[type="search"]').fill('');
  await page.getByRole('button', { name: 'Reset sample graph' }).click();
  await page.waitForFunction(
    () => document.querySelector('.topbar-stats')?.textContent.includes('33'),
    null,
    { timeout: 15000 },
  );
  check('reset restores 33 sample courses', true);

  check('zero console errors', consoleErrors.length === 0, consoleErrors.join(' | '));

  await browser.close();
} finally {
  server.kill();
}

console.log(`\nE2E: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
