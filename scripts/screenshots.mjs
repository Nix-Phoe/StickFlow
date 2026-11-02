// Captures d'écran de l'app (manifeste de la PWA, fiche Google Play en phase 7B) et image de
// partage (Open Graph, 1200 × 630). Pilote le Chrome installé (puppeteer-core) sur le build servi
// localement, dans un profil vierge : rien n'est lu ni écrit dans les données de l'utilisateur.
//
//   npm run build && npx vite preview --port 4173
//   npm run screenshots                     (BASE_URL=http://localhost:4173 par défaut)

import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:4173';
const OUT = new URL('../public/', import.meta.url);
const CHROME_PATHS = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
].filter(Boolean);

const executablePath = CHROME_PATHS.find((path) => existsSync(path));
if (!executablePath) throw new Error('Chrome introuvable : indiquez son chemin dans CHROME_PATH.');

const browser = await puppeteer.launch({ executablePath, headless: true, args: ['--enable-unsafe-swiftshader', '--lang=fr-FR'] });
const page = await browser.newPage();
await page.emulateMediaFeatures([
  { name: 'prefers-color-scheme', value: 'light' },
  { name: 'prefers-reduced-motion', value: 'reduce' },
]);
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
await page.evaluateOnNewDocument(() => localStorage.setItem('stickflow:preferences', JSON.stringify({ installInviteDismissed: true })));

/** Crée un projet depuis un modèle de départ (un clic sur sa carte l'ouvre dans l'éditeur). */
async function createFromTemplate(name) {
  await page.goto(`${BASE_URL}/#/`, { waitUntil: 'networkidle0' });
  await page.waitForSelector('.template-card__button');
  await page.evaluate((label) => {
    [...document.querySelectorAll('.template-card__button')].find((button) => button.getAttribute('aria-label')?.includes(`« ${label} »`))?.click();
  }, name);
  await page.waitForSelector('canvas#stage');
  await wait(800);
}

mkdirSync(new URL('screenshots/', OUT), { recursive: true });
await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 1 });
for (const template of ['Marche', 'Saut', 'Coup de poing', 'Course']) await createFromTemplate(template);

// L'éditeur, sur le dernier projet créé (Course).
await page.screenshot({ path: fileURLToPath(new URL('screenshots/editor-wide.png', OUT)) });
const editor = await page.screenshot({ encoding: 'base64' });

await page.goto(`${BASE_URL}/#/`, { waitUntil: 'networkidle0' });
await wait(1200);
await page.screenshot({ path: fileURLToPath(new URL('screenshots/home-wide.png', OUT)) });

await page.setViewport({ width: 540, height: 1170, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
await page.reload({ waitUntil: 'networkidle0' });
await wait(1200);
await page.screenshot({ path: fileURLToPath(new URL('screenshots/home-narrow.png', OUT)) });

// Image de partage : le logo, le nom, une phrase, et l'éditeur.
const icon = readFileSync(new URL('app-icon.svg', OUT), 'utf8');
await page.setViewport({ width: 1200, height: 630, deviceScaleFactor: 1 });
await page.setContent(`<!doctype html><html lang="fr"><head><meta charset="utf-8"><style>
  body { margin: 0; width: 1200px; height: 630px; overflow: hidden; font-family: "Segoe UI", system-ui, sans-serif;
    background: radial-gradient(120% 90% at 0% 0%, rgba(0, 102, 204, 0.16), transparent 60%), #f2f2f7; color: #000; }
  .text { position: absolute; left: 64px; top: 0; bottom: 0; width: 400px; display: flex; flex-direction: column; justify-content: center; gap: 20px; }
  .text svg { width: 112px; height: 112px; }
  h1 { margin: 0; font-size: 64px; letter-spacing: -0.02em; }
  p { margin: 0; font-size: 28px; line-height: 1.3; color: #3c3c43; }
  .shot { position: absolute; left: 500px; top: 72px; width: 760px; border-radius: 20px; overflow: hidden;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12), 0 24px 48px rgba(0, 0, 0, 0.18); }
  .shot img { display: block; width: 100%; }
</style></head><body>
  <div class="text">${icon}<h1>StickFlow</h1><p>Animez des stickmans, l’IA assiste, vous décidez.</p></div>
  <div class="shot"><img src="data:image/png;base64,${editor}" alt=""></div>
</body></html>`);
await page.screenshot({ path: fileURLToPath(new URL('og-image.png', OUT)) });

await browser.close();
console.log('Captures enregistrées dans public/screenshots/ et public/og-image.png');
