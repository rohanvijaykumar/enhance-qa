#!/usr/bin/env node
// enhance-qa web driver: runs one check's steps in a real browser from a small JSON plan and prints a
// compact JSON result. One call per check keeps agent context small (no page dumps).
// Needs Playwright, from the project (npm i -D playwright / @playwright/test) or a global install.
// Usage: node <skill>/scripts/drive-web.mjs plan.json     or     echo '{…}' | node <skill>/scripts/drive-web.mjs
//        node <skill>/scripts/drive-web.mjs --check     (is Playwright available, and which browser starts?)
// Plan reference: see references/platforms/drivers.md, or run with --help.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { execSync } from 'node:child_process';

const HELP = `enhance-qa web driver
Plan (JSON): {
  "base": "http://localhost:3000",            base URL for relative "goto" paths (default: $QA_BASE_URL)
  "browser": "chromium" | "firefox" | "webkit", default chromium
  "channel": "chrome" | "msedge" (optional; by default it tries Playwright's Chromium, then installed Chrome, then Edge)
  "viewport": "1280x800" | "390x844" | {"width":..,"height":..}
  "colorScheme": "light" | "dark", "locale": "en-US", "headless": true
  "storageState": "qa/.state/sessions/user-a.json",   load a saved login
  "saveStorageState": "qa/.state/sessions/user-a.json", save the session after the steps
  "timeout": 10000,                            ms per step
  "screenshot": "on-failure" | "always" | "never",   default on-failure
  "video": "off" | "on-failure" | "always",    default off ("always" keeps it on success too: after-evidence for fixes)
  "evidence": "qa/evidence/007/cart-004",      path prefix for screenshots and videos
  "steps": [ … ]
}
Steps: {"goto": "/path"} {"click": L} {"fill": L, "value": "text or $ENV_VAR"} {"type": L, "value": …}
  {"press": "Enter", "on": L?} {"select": L, "value": "…"} {"check": L} {"uncheck": L} {"hover": L}
  {"upload": L, "files": ["path"]} {"wait": 500} {"waitFor": L} {"waitForUrl": "/done"}
  {"expectText": "…", "in": L?} {"expectNoText": "…", "in": L?} {"expectUrl": "/login" | "/regex/"}
  {"expectVisible": L} {"expectHidden": L} {"expectCount": L, "count": 3} {"expectTitle": "…"}
  {"read": L, "as": "name"} {"readAll": L, "as": "name", "max": 20} {"screenshot": "name"}
  {"eval": "js expression", "as": "name"} {"request": {"method": "GET", "url": "/api/x", "data": …}, "as": "name"}
  {"setViewport": "390x844"} {"reload": true} {"back": true}
Locators (L): {"role": "button", "name": "Sign in"} {"label": "Email"} {"text": "Add to cart"}
  {"placeholder": "…"} {"testId": "cart-badge"} {"css": "#email"} {"alt": "…"} {"title": "…"}
  optional "exact": true, "nth": 0. A plain string is CSS if it looks like a selector (#id, .class, [attr],
  a > b, li.product), otherwise text.
Values starting with $ are read from environment variables and never printed.
Exit: 0 all steps passed · 1 a step or expectation failed · 2 plan or driver problem.`;

function emit(obj, code) {
  process.stdout.write(JSON.stringify(obj, null, 1) + '\n');
  process.exit(code);
}

function readPlan() {
  const arg = process.argv.slice(2).find((a) => !a.startsWith('--'));
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    process.stdout.write(HELP + '\n');
    process.exit(0);
  }
  let raw = '';
  try {
    raw = arg ? fs.readFileSync(arg, 'utf8') : (process.stdin.isTTY ? '' : fs.readFileSync(0, 'utf8'));
  } catch (e) {
    emit({ ok: false, error: `Can't read the plan: ${e.message}` }, 2);
  }
  if (!raw.trim()) emit({ ok: false, error: 'No plan given. Pass a JSON file or pipe JSON on stdin (--help for the format).' }, 2);
  try {
    return JSON.parse(raw);
  } catch (e) {
    return emit({ ok: false, error: `The plan isn't valid JSON: ${e.message}` }, 2);
  }
}

async function loadPlaywright() {
  const tries = [];
  const bases = [path.join(process.cwd(), 'noop.js')];
  try {
    const g = execSync('npm root -g', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
    if (g) bases.push(path.join(g, 'noop.js'));
  } catch { /* no npm */ }
  for (const base of bases) {
    const req = createRequire(base);
    for (const name of ['playwright', '@playwright/test', 'playwright-core']) {
      try {
        const resolved = req.resolve(name);
        const mod = await import(pathToFileURL(resolved).href);
        return mod.default && mod.default.chromium ? mod.default : mod;
      } catch (e) { tries.push(name); }
    }
  }
  return null;
}

function size(v, fallback) {
  if (!v) return fallback;
  if (typeof v === 'object') return { width: Number(v.width), height: Number(v.height) };
  const m = String(v).match(/^(\d+)\s*[x×]\s*(\d+)$/);
  return m ? { width: Number(m[1]), height: Number(m[2]) } : fallback;
}

function envValue(v) {
  if (typeof v === 'string' && v.startsWith('$') && v.length > 1) {
    const name = v.slice(1);
    if (process.env[name] === undefined) throw new Error(`environment variable ${name} isn't set`);
    return { value: process.env[name], secret: true };
  }
  return { value: v == null ? '' : String(v), secret: false };
}

function locate(page, L) {
  if (L == null) throw new Error('missing locator');
  if (typeof L === 'string') {
    // CSS when it looks like a selector (#id, .class, [attr], a > b, li.product, input[name=q]); otherwise text.
    const css = /^[#.\[]/.test(L) || L.includes('>') || /^[a-z][\w-]*[.#\[:]/i.test(L);
    L = css ? { css: L } : { text: L };
  }
  const exact = L.exact === true;
  let loc;
  if (L.role) loc = page.getByRole(L.role, L.name !== undefined ? { name: L.name, exact } : {});
  else if (L.label) loc = page.getByLabel(L.label, { exact });
  else if (L.placeholder) loc = page.getByPlaceholder(L.placeholder, { exact });
  else if (L.testId) loc = page.getByTestId(L.testId);
  else if (L.alt) loc = page.getByAltText(L.alt, { exact });
  else if (L.title) loc = page.getByTitle(L.title, { exact });
  else if (L.text) loc = page.getByText(L.text, { exact });
  else if (L.css) loc = page.locator(L.css);
  else throw new Error(`unknown locator ${JSON.stringify(L)}`);
  if (Number.isInteger(L.nth)) loc = loc.nth(L.nth);
  return loc;
}

function describe(L) {
  if (typeof L === 'string') return L;
  return Object.entries(L || {}).map(([k, v]) => `${k}=${v}`).join(' ');
}

function clip(s, n = 300) {
  s = String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
  return s.length > n ? s.slice(0, n) + '…' : s;
}

function urlMatches(actual, want) {
  const m = String(want).match(/^\/(.+)\/([a-z]*)$/);
  if (m) return new RegExp(m[1], m[2]).test(actual);
  return actual.includes(want);
}

async function probe() {
  const pw = await loadPlaywright();
  if (!pw) emit({ ok: false, playwright: null, error: "Playwright isn't installed (project or global)." }, 1);
  let version = null;
  try { version = createRequire(path.join(process.cwd(), 'noop.js'))('playwright/package.json').version; } catch { /* global or other */ }
  for (const channel of [null, 'chrome', 'msedge']) {
    try {
      const b = await pw.chromium.launch({ headless: true, ...(channel ? { channel } : {}) });
      await b.close();
      emit({ ok: true, playwright: version || 'found', browser: channel || 'chromium' }, 0);
    } catch { /* try the next */ }
  }
  emit({ ok: false, playwright: version || 'found', error: 'No browser could start. With the user\'s OK: npx playwright install chromium' }, 1);
}

async function main() {
  if (process.argv.includes('--check')) return probe();
  const plan = readPlan();
  if (!Array.isArray(plan.steps)) emit({ ok: false, error: 'The plan needs a "steps" array.' }, 2);
  const pw = await loadPlaywright();
  if (!pw) {
    emit({ ok: false, error: "Playwright isn't installed. With the user's OK, add it to the project (npm i -D playwright) or install it globally (npm i -g playwright), then run `npx playwright install chromium`." }, 2);
  }
  const browserName = plan.browser || 'chromium';
  const type = pw[browserName];
  if (!type) emit({ ok: false, error: `Unknown browser "${browserName}" (chromium, firefox or webkit).` }, 2);
  const timeout = Number(plan.timeout) || 10000;
  const viewport = size(plan.viewport, { width: 1280, height: 800 });
  const evidence = plan.evidence ? String(plan.evidence) : '';
  const shotMode = plan.screenshot || 'on-failure';
  const videoMode = plan.video || 'off';
  if (evidence) fs.mkdirSync(path.dirname(evidence), { recursive: true });

  // Launch order: the plan's channel if given; Playwright's own browser; then (Chromium only) the installed
  // Google Chrome or Microsoft Edge. Installed browsers run with a fresh temporary profile, never the user's.
  let browser;
  let launchedWith = browserName;
  const attempts = plan.channel ? [plan.channel] : [null, ...(browserName === 'chromium' ? ['chrome', 'msedge'] : [])];
  let lastError = null;
  for (const channel of attempts) {
    try {
      browser = await type.launch({ headless: plan.headless !== false, ...(channel ? { channel } : {}) });
      launchedWith = channel || browserName;
      break;
    } catch (e) {
      lastError = e;
    }
  }
  if (!browser) {
    emit({ ok: false, error: `Couldn't start ${browserName}: ${clip(lastError && lastError.message, 240)}. With the user's OK: npx playwright install ${browserName}` }, 2);
  }
  const ctxOpts = { viewport, baseURL: plan.base || process.env.QA_BASE_URL || undefined };
  if (plan.colorScheme) ctxOpts.colorScheme = plan.colorScheme;
  if (plan.locale) ctxOpts.locale = plan.locale;
  if (plan.storageState && fs.existsSync(plan.storageState)) ctxOpts.storageState = plan.storageState;
  if ((videoMode === 'on-failure' || videoMode === 'always') && evidence) ctxOpts.recordVideo = { dir: path.dirname(evidence), size: { width: Math.min(viewport.width, 1280), height: Math.min(viewport.height, 800) } };
  // Video needs Playwright's own ffmpeg. Without it, run the check anyway and say why there's no video.
  let videoNote;
  let context;
  let page;
  try {
    context = await browser.newContext(ctxOpts);
    page = await context.newPage();
  } catch (e) {
    if (!ctxOpts.recordVideo || !/ffmpeg/i.test(String(e && e.message))) throw e;
    if (context) await context.close().catch(() => {});
    delete ctxOpts.recordVideo;
    videoNote = "No video: Playwright's ffmpeg isn't installed. With the user's OK: npx playwright install ffmpeg";
    context = await browser.newContext(ctxOpts);
    page = await context.newPage();
  }
  context.setDefaultTimeout(timeout);

  const consoleMsgs = [];
  const pageErrors = [];
  const failedRequests = [];
  const serverErrors = [];
  const httpErrors = [];
  page.on('console', (m) => {
    // "Failed to load resource" carries no URL; those are reported with their URLs from the responses below.
    if (['error', 'warning'].includes(m.type()) && !/^Failed to load resource/.test(m.text()) && consoleMsgs.length < 20) consoleMsgs.push(`${m.type()}: ${clip(m.text(), 200)}`);
  });
  page.on('pageerror', (e) => { if (pageErrors.length < 10) pageErrors.push(clip(e.message, 240)); });
  page.on('requestfailed', (r) => { if (failedRequests.length < 10) failedRequests.push(`${r.method()} ${clip(r.url(), 120)} ${r.failure() ? r.failure().errorText : ''}`); });
  page.on('response', (r) => {
    const s = r.status();
    if (s >= 500 && serverErrors.length < 10) serverErrors.push(`${s} ${r.request().method()} ${clip(r.url(), 120)}`);
    else if (s >= 400 && !/\/favicon\.ico(\?|$)/.test(r.url()) && httpErrors.length < 10) httpErrors.push(`${s} ${r.request().method()} ${clip(r.url(), 120)}`);
  });

  const reads = {};
  const shots = [];
  const started = Date.now();
  let failed = null;
  let index = 0;

  async function shot(name, full) {
    if (!evidence) return null;
    const file = `${evidence}-${name}.png`;
    const opts = { path: file };
    if (!full) opts.clip = { x: 0, y: 0, width: Math.min(viewport.width, 1280), height: Math.min(viewport.height, 800) };
    await page.screenshot(opts).catch(() => {});
    shots.push(file.replace(/\\/g, '/'));
    return file;
  }

  for (const step of plan.steps) {
    index += 1;
    const action = Object.keys(step).find((k) => !['value', 'in', 'on', 'as', 'count', 'files', 'max', 'name'].includes(k)) || '?';
    const t0 = Date.now();
    try {
      const v = step[action];
      switch (action) {
        case 'goto': await page.goto(String(v), { waitUntil: 'domcontentloaded' }); break;
        case 'click': await locate(page, v).click(); break;
        case 'fill': await locate(page, v).fill(envValue(step.value).value); break;
        case 'type': await locate(page, v).pressSequentially(envValue(step.value).value); break;
        case 'press': if (step.on) await locate(page, step.on).press(String(v)); else await page.keyboard.press(String(v)); break;
        case 'select': await locate(page, v).selectOption(String(step.value)); break;
        case 'check': await locate(page, v).check(); break;
        case 'uncheck': await locate(page, v).uncheck(); break;
        case 'hover': await locate(page, v).hover(); break;
        case 'upload': await locate(page, v).setInputFiles(step.files || []); break;
        case 'wait': await page.waitForTimeout(Math.min(Number(v) || 0, 30000)); break;
        case 'waitFor': await locate(page, v).first().waitFor({ state: 'visible' }); break;
        case 'waitForUrl': await page.waitForURL((u) => urlMatches(u.toString(), v)); break;
        case 'expectText': {
          const scope = step.in ? locate(page, step.in) : page.locator('body');
          const deadline = Date.now() + timeout;
          let text = '';
          for (;;) {
            text = await scope.innerText().catch(() => '');
            if (text.includes(String(v))) break;
            if (Date.now() > deadline) throw new Error(`expected text "${clip(v, 120)}" not found${step.in ? ' in ' + describe(step.in) : ''}; saw: "${clip(text, 200)}"`);
            await page.waitForTimeout(200);
          }
          break;
        }
        case 'expectNoText': {
          const scope = step.in ? locate(page, step.in) : page.locator('body');
          const text = await scope.innerText().catch(() => '');
          if (text.includes(String(v))) throw new Error(`unexpected text "${clip(v, 120)}" is present`);
          break;
        }
        case 'expectUrl': {
          const deadline = Date.now() + timeout;
          while (!urlMatches(page.url(), v)) {
            if (Date.now() > deadline) throw new Error(`expected the URL to match "${v}"; it is ${page.url()}`);
            await page.waitForTimeout(200);
          }
          break;
        }
        case 'expectVisible': await locate(page, v).first().waitFor({ state: 'visible' }); break;
        case 'expectHidden': await locate(page, v).first().waitFor({ state: 'hidden' }); break;
        case 'expectCount': {
          const n = await locate(page, v).count();
          if (n !== Number(step.count)) throw new Error(`expected ${step.count} of ${describe(v)}, found ${n}`);
          break;
        }
        case 'expectTitle': {
          const t = await page.title();
          if (!t.includes(String(v))) throw new Error(`expected the title to contain "${v}"; it is "${t}"`);
          break;
        }
        case 'read': reads[step.as || describe(v)] = clip(await locate(page, v).first().innerText()); break;
        case 'readAll': {
          const all = await locate(page, v).allInnerTexts();
          reads[step.as || describe(v)] = all.slice(0, Number(step.max) || 20).map((x) => clip(x, 160));
          break;
        }
        case 'screenshot': await shot(String(v || index), false); break;
        case 'eval': reads[step.as || `eval${index}`] = clip(JSON.stringify(await page.evaluate(String(v))), 600); break;
        case 'request': {
          const r = v || {};
          const resp = await context.request.fetch(String(r.url), { method: r.method || 'GET', headers: r.headers, data: r.data });
          reads[step.as || `request${index}`] = { status: resp.status(), body: clip(await resp.text(), 600) };
          break;
        }
        case 'setViewport': { const s = size(v, viewport); await page.setViewportSize(s); viewport.width = s.width; viewport.height = s.height; break; }
        case 'reload': await page.reload({ waitUntil: 'domcontentloaded' }); break;
        case 'back': await page.goBack({ waitUntil: 'domcontentloaded' }); break;
        default: throw new Error(`unknown step "${action}"`);
      }
    } catch (e) {
      failed = { step: index, action, target: describe(step[action]), ms: Date.now() - t0, error: clip(e.message.split('\n')[0], 300) };
      break;
    }
  }

  if (failed && shotMode !== 'never') await shot('fail', false);
  else if (!failed && shotMode === 'always') await shot('end', false);
  if (plan.saveStorageState && !failed) {
    fs.mkdirSync(path.dirname(plan.saveStorageState), { recursive: true });
    await context.storageState({ path: plan.saveStorageState }).catch(() => {});
  }
  const finalUrl = page.url();
  const title = await page.title().catch(() => '');
  const video = page.video ? page.video() : null;
  await context.close();
  let videoPath = null;
  if (video) {
    try {
      const p = await video.path();
      if (evidence && (failed || videoMode === 'always')) {
        videoPath = `${evidence}-${failed ? 'fail' : 'end'}.webm`;
        fs.renameSync(p, videoPath);
      } else {
        fs.rmSync(p, { force: true });
      }
    } catch { /* ignore */ }
  }
  await browser.close();
  const result = {
    ok: !failed,
    browser: launchedWith,
    steps: plan.steps.length,
    passed: failed ? failed.step - 1 : plan.steps.length,
    failed: failed || undefined,
    url: finalUrl,
    title: clip(title, 120),
    reads: Object.keys(reads).length ? reads : undefined,
    console: consoleMsgs.length ? consoleMsgs : undefined,
    pageErrors: pageErrors.length ? pageErrors : undefined,
    serverErrors: serverErrors.length ? serverErrors : undefined,
    httpErrors: httpErrors.length ? httpErrors : undefined,
    failedRequests: failedRequests.length ? failedRequests : undefined,
    evidence: shots.length || videoPath ? [...shots, ...(videoPath ? [videoPath.replace(/\\/g, '/')] : [])] : undefined,
    videoNote,
    ms: Date.now() - started,
  };
  emit(result, failed ? 1 : 0);
}

main().catch((e) => emit({ ok: false, error: clip(e && e.message, 300) }, 2));
