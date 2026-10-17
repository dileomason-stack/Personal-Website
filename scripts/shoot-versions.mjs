// Screenshots past versions of the site for the version scrubber (needs puppeteer-core and Chrome).
// Export each commit (git archive <sha> | tar -x -C <dir>/<sha>), serve <dir> locally, then:
//   node scripts/shoot-versions.mjs http://127.0.0.1:8790 <out dir> <sha> <sha> ...
// and convert the PNGs to 1200x750 WebP in versions/.
import puppeteer from 'puppeteer-core';
const [,, base, out, ...shas] = process.argv;
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--hide-scrollbars', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
for (const sha of shas) {
  await page.goto(`${base}/${sha}/index.html?project=none`, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => { localStorage.setItem('mdl-intro-seen', String(Date.now())); localStorage.removeItem('mdl-theme'); });
  await page.goto(`${base}/${sha}/index.html`, { waitUntil: 'networkidle2', timeout: 30000 }).catch(e => console.log(sha, e.message));
  await new Promise(r => setTimeout(r, 3500));
  const sw = await page.$('#switch'); if (sw) { await page.evaluate(() => document.getElementById('switch').click()); await new Promise(r => setTimeout(r, 6500)); }
  await new Promise(r => setTimeout(r, 3000));
  await page.screenshot({ path: `${out}/${sha}.png` });
  console.log('shot', sha);
}
await browser.close();
