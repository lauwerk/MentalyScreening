/**
 * DIAGNOSE: Intake-Bug reproduzieren und debuggen
 * Umgebung: Chromium mit iPhone 13 Emulation (Touch, mobile viewport, UA)
 * Ziel: Jeden Event und jeden State-Change protokollieren
 */
const { chromium, devices } = require('/opt/node22/lib/node_modules/playwright');

const iPhone = devices['iPhone 13'];
const FILE   = 'file:///home/user/MentalyScreening/ADHS-Selbsttest%20Child%20v3.html';

let passed = 0, failed = 0;
function assert(label, condition, detail = '') {
  const mark = condition ? '  ✓' : '  ✗ FAIL';
  console.log(`${mark}: ${label}${detail ? '  →  ' + detail : ''}`);
  condition ? passed++ : failed++;
}

// ─────────────────────────────────────────
// Hilfsfunktion: State aus DOM auslesen
// ─────────────────────────────────────────
async function readState(p) {
  return p.evaluate(() => {
    const sexBtns  = [...document.querySelectorAll('[data-sex]')].map(b => ({ id: b.id, active: b.classList.contains('active'), value: b.dataset.sex }));
    const roleBtns = [...document.querySelectorAll('[data-role]')].map(b => ({ id: b.id, active: b.classList.contains('active'), value: b.dataset.role }));
    return {
      nameVal:      document.getElementById('child-name').value,
      ageVal:       document.getElementById('child-age').value,
      sexBtns,
      roleBtns,
      startDisabled: document.getElementById('start-btn').disabled,
      statusText:   document.getElementById('intake-status')?.textContent ?? '',
      intakeVisible: document.getElementById('intake').style.display !== 'none',
    };
  });
}

// ─────────────────────────────────────────
// Hilfsfunktion: Event-Log in die Seite injizieren
// ─────────────────────────────────────────
async function injectEventLogger(p) {
  await p.evaluate(() => {
    window._log = [];
    const log = (tag, detail) => {
      window._log.push(`[${tag}] ${detail}`);
      console.log(`EVT ${tag}: ${detail}`);
    };

    // Alter-Input: alle Events
    const age = document.getElementById('child-age');
    ['input','change','blur','focus'].forEach(evt =>
      age.addEventListener(evt, e => log('age:' + evt, `value="${e.target.value}"`)));

    // Name-Input
    const name = document.getElementById('child-name');
    ['input','change','blur'].forEach(evt =>
      name.addEventListener(evt, e => log('name:' + evt, `value="${e.target.value}"`)));

    // Alle Buttons
    document.querySelectorAll('#intake button').forEach(btn => {
      ['click','touchstart','touchend','mousedown','mouseup'].forEach(evt =>
        btn.addEventListener(evt, () => log(`btn:${evt}`, `id="${btn.id}" sex="${btn.dataset.sex||''}" role="${btn.dataset.role||''}"`)));
    });
  });
}

async function getLog(p) {
  return p.evaluate(() => window._log || []);
}

// ─────────────────────────────────────────
(async () => {
  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox'],
  });

  // ══════════════════════════════════════
  // UMGEBUNG A: Desktop Chromium
  // ══════════════════════════════════════
  console.log('\n' + '═'.repeat(55));
  console.log('UMGEBUNG A: Desktop Chromium');
  console.log('═'.repeat(55));
  {
    const ctx  = await browser.newContext();
    const page = await ctx.newPage();
    page.on('pageerror', e => console.error('  JS-ERROR:', e.message));
    page.on('console',   m => { if (m.type()==='error') console.error('  CONSOLE-ERR:', m.text()); });
    await page.goto(FILE);
    await injectEventLogger(page);

    // Schritt 1: Name + Age füllen
    await page.fill('#child-name', 'Lena');
    await page.fill('#child-age', '4');
    // Blur simulieren (Tab aus dem Feld)
    await page.press('#child-age', 'Tab');
    let s = await readState(page);
    console.log(`\n  Nach Name+Age: ageVal="${s.ageVal}" status="${s.statusText}"`);

    // Schritt 2: Geschlecht klicken
    await page.click('[data-sex="m"]');
    s = await readState(page);
    console.log(`  Nach sex-m:   sexActive=${JSON.stringify(s.sexBtns.filter(b=>b.active).map(b=>b.value))}  roleActive=${JSON.stringify(s.roleBtns.filter(b=>b.active).map(b=>b.value))}  disabled=${s.startDisabled}`);
    assert('A: sex-m active nach Klick', s.sexBtns.find(b=>b.value==='m')?.active);

    // Schritt 3: Rolle klicken
    await page.click('[data-role="parent"]');
    s = await readState(page);
    console.log(`  Nach role-p:  sexActive=${JSON.stringify(s.sexBtns.filter(b=>b.active).map(b=>b.value))}  roleActive=${JSON.stringify(s.roleBtns.filter(b=>b.active).map(b=>b.value))}  disabled=${s.startDisabled}`);
    assert('A: sex-m bleibt active nach role-Klick', s.sexBtns.find(b=>b.value==='m')?.active);
    assert('A: role-parent active',                  s.roleBtns.find(b=>b.value==='parent')?.active);
    assert('A: start-btn enabled',                   s.startDisabled === false, `status="${s.statusText}"`);

    const log = await getLog(page);
    console.log('\n  Event-Log:', log.join('\n  '));
    await ctx.close();
  }

  // ══════════════════════════════════════
  // UMGEBUNG B: iPhone 13 Emulation (Touch)
  // ══════════════════════════════════════
  console.log('\n' + '═'.repeat(55));
  console.log('UMGEBUNG B: iPhone 13 Emulation (Touch + mobile UA)');
  console.log('═'.repeat(55));
  {
    const ctx  = await browser.newContext({ ...iPhone });
    const page = await ctx.newPage();
    page.on('pageerror', e => console.error('  JS-ERROR:', e.message));
    page.on('console',   m => { if (m.type()==='error') console.error('  CONSOLE-ERR:', m.text()); });
    await page.goto(FILE);
    await injectEventLogger(page);

    // Name füllen
    await page.tap('#child-name');
    await page.fill('#child-name', 'Lena');

    // Age füllen — auf iOS tippen, dann Blur durch Tap auf anderes Element
    await page.tap('#child-age');
    await page.fill('#child-age', '4');
    // iOS: Blur durch Tap woanders (simuliert "Done"-Button oder Tap außerhalb)
    await page.tap('.intake-title');  // Tap auf neutrales Label

    let s = await readState(page);
    console.log(`\n  Nach Name+Age (mit Blur): ageVal="${s.ageVal}" status="${s.statusText}"`);
    assert('B: ageVal ist "4" nach fill+blur', s.ageVal === '4', `ageVal="${s.ageVal}"`);

    // Geschlecht tippen
    await page.tap('[data-sex="m"]');
    s = await readState(page);
    console.log(`  Nach sex-m tap: sexActive=${JSON.stringify(s.sexBtns.filter(b=>b.active).map(b=>b.value))}  disabled=${s.startDisabled}  status="${s.statusText}"`);
    assert('B: sex-m active nach tap', s.sexBtns.find(b=>b.value==='m')?.active);

    // Rolle tippen
    await page.tap('[data-role="parent"]');
    s = await readState(page);
    console.log(`  Nach role-p tap: sexActive=${JSON.stringify(s.sexBtns.filter(b=>b.active).map(b=>b.value))}  roleActive=${JSON.stringify(s.roleBtns.filter(b=>b.active).map(b=>b.value))}  disabled=${s.startDisabled}  status="${s.statusText}"`);
    assert('B: sex-m bleibt active nach role-tap',  s.sexBtns.find(b=>b.value==='m')?.active);
    assert('B: role-parent active',                  s.roleBtns.find(b=>b.value==='parent')?.active);
    assert('B: start-btn enabled',                   s.startDisabled === false, `status="${s.statusText}"`);

    const log = await getLog(page);
    console.log('\n  Event-Log (Touch):');
    log.forEach(l => console.log('  ' + l));
    await ctx.close();
  }

  // ══════════════════════════════════════
  // UMGEBUNG C: iPhone — Reihenfolge umgekehrt
  // ══════════════════════════════════════
  console.log('\n' + '═'.repeat(55));
  console.log('UMGEBUNG C: iPhone — Rolle zuerst, dann Geschlecht');
  console.log('═'.repeat(55));
  {
    const ctx  = await browser.newContext({ ...iPhone });
    const page = await ctx.newPage();
    page.on('pageerror', e => console.error('  JS-ERROR:', e.message));
    await page.goto(FILE);

    await page.fill('#child-name', 'Tim');
    await page.tap('#child-age');
    await page.fill('#child-age', '6');
    await page.tap('.intake-title');

    await page.tap('[data-role="pro"]');
    await page.tap('[data-sex="f"]');

    const s = await readState(page);
    console.log(`  sexActive=${JSON.stringify(s.sexBtns.filter(b=>b.active).map(b=>b.value))}  roleActive=${JSON.stringify(s.roleBtns.filter(b=>b.active).map(b=>b.value))}  disabled=${s.startDisabled}  status="${s.statusText}"`);
    assert('C: sex-f active',         s.sexBtns.find(b=>b.value==='f')?.active);
    assert('C: role-pro active',      s.roleBtns.find(b=>b.value==='pro')?.active);
    assert('C: start-btn enabled',    s.startDisabled === false, `status="${s.statusText}"`);
    await ctx.close();
  }

  // ══════════════════════════════════════
  // UMGEBUNG D: iPhone — Age NACH Buttons
  // ══════════════════════════════════════
  console.log('\n' + '═'.repeat(55));
  console.log('UMGEBUNG D: iPhone — Alter nach den Buttons eingeben');
  console.log('═'.repeat(55));
  {
    const ctx  = await browser.newContext({ ...iPhone });
    const page = await ctx.newPage();
    page.on('pageerror', e => console.error('  JS-ERROR:', e.message));
    await page.goto(FILE);
    await injectEventLogger(page);

    // Name first
    await page.fill('#child-name', 'Anna');
    // Buttons BEFORE age
    await page.tap('[data-sex="d"]');
    await page.tap('[data-role="parent"]');
    // Now fill age
    await page.tap('#child-age');
    await page.fill('#child-age', '3');
    await page.tap('.intake-title');  // blur

    const s = await readState(page);
    console.log(`  ageVal="${s.ageVal}"  sexActive=${JSON.stringify(s.sexBtns.filter(b=>b.active).map(b=>b.value))}  roleActive=${JSON.stringify(s.roleBtns.filter(b=>b.active).map(b=>b.value))}  disabled=${s.startDisabled}  status="${s.statusText}"`);
    assert('D: sex-d active bleibt nach Age-Input',     s.sexBtns.find(b=>b.value==='d')?.active);
    assert('D: role-parent active bleibt nach Age-Input', s.roleBtns.find(b=>b.value==='parent')?.active);
    assert('D: start-btn enabled',                       s.startDisabled === false, `status="${s.statusText}"`);

    const log = await getLog(page);
    console.log('\n  Event-Log:');
    log.forEach(l => console.log('  ' + l));
    await ctx.close();
  }

  await browser.close();
  console.log('\n' + '─'.repeat(55));
  console.log(`Ergebnis: ${passed} bestanden, ${failed} fehlgeschlagen`);
  if (failed > 0) process.exit(1);
})().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
