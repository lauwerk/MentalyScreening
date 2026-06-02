const { chromium } = require('/opt/node22/lib/node_modules/playwright');

let passed = 0, failed = 0;

function assert(label, condition) {
  if (condition) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${label}`);
    failed++;
  }
}

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await b.newPage();
  p.on('console', m => { if (m.type() === 'error') console.log('PAGE ERROR:', m.text()); });
  p.on('pageerror', e => console.error('PAGEERROR:', e.message));

  const FILE = 'file:///home/user/MentalyScreening/ADHS-Selbsttest%20Child%20v3.html';

  // ─────────────────────────────────────────────
  console.log('\n=== Test 1: Geschlecht zuerst, dann Rolle ===');
  await p.goto(FILE);
  await p.fill('#child-name', 'Lena');
  await p.fill('#child-age', '4');
  await p.click('[data-sex="m"]');
  await p.click('[data-role="parent"]');

  const sexActive1  = await p.$$eval('[data-sex]',  els => els.filter(e => e.classList.contains('active')).map(e => e.dataset.sex));
  const roleActive1 = await p.$$eval('[data-role]', els => els.filter(e => e.classList.contains('active')).map(e => e.dataset.role));
  const disabled1   = await p.$eval('#start-btn', e => e.disabled);

  assert('sex-m hat Klasse active',    sexActive1.includes('m'));
  assert('Kein anderer sex-Button aktiv', sexActive1.length === 1);
  assert('role-parent hat Klasse active', roleActive1.includes('parent'));
  assert('Kein anderer role-Button aktiv', roleActive1.length === 1);
  assert('#start-btn ist enabled',     disabled1 === false);

  // ─────────────────────────────────────────────
  console.log('\n=== Test 2: Rolle zuerst, dann Geschlecht ===');
  await p.goto(FILE);
  await p.fill('#child-name', 'Tim');
  await p.fill('#child-age', '6');
  await p.click('[data-role="pro"]');
  await p.click('[data-sex="f"]');

  const sexActive2  = await p.$$eval('[data-sex]',  els => els.filter(e => e.classList.contains('active')).map(e => e.dataset.sex));
  const roleActive2 = await p.$$eval('[data-role]', els => els.filter(e => e.classList.contains('active')).map(e => e.dataset.role));
  const disabled2   = await p.$eval('#start-btn', e => e.disabled);

  assert('sex-f hat Klasse active',    sexActive2.includes('f'));
  assert('Kein anderer sex-Button aktiv', sexActive2.length === 1);
  assert('role-pro hat Klasse active', roleActive2.includes('pro'));
  assert('Kein anderer role-Button aktiv', roleActive2.length === 1);
  assert('#start-btn ist enabled',     disabled2 === false);

  // ─────────────────────────────────────────────
  console.log('\n=== Test 3: Start-Button zeigt Quiz ===');
  // Reuse current state (tim, 6, f, pro — all set)
  await p.click('#start-btn');
  const intakeHidden = await p.$eval('#intake', e => e.style.display === 'none');
  const quizHasContent = await p.$eval('#quiz', e => e.innerHTML.trim().length > 0);
  assert('#intake wird ausgeblendet', intakeHidden);
  assert('#quiz enthält Fragen',      quizHasContent);

  // ─────────────────────────────────────────────
  console.log('\n=== Test 4: Neustart via doRestart() ===');
  // doRestart() ist eine function-Deklaration, also auf window verfügbar
  await p.evaluate(() => doRestart());
  const intakeVisible4 = await p.$eval('#intake', e => e.style.display !== 'none');
  const disabled4      = await p.$eval('#start-btn', e => e.disabled);
  const sexActive4     = await p.$$eval('[data-sex]',  els => els.filter(e => e.classList.contains('active')).length);
  const roleActive4    = await p.$$eval('[data-role]', els => els.filter(e => e.classList.contains('active')).length);

  assert('Nach Neustart: #intake sichtbar',       intakeVisible4);
  assert('Nach Neustart: #start-btn disabled',    disabled4);
  assert('Nach Neustart: keine sex-Buttons aktiv', sexActive4 === 0);
  assert('Nach Neustart: keine role-Buttons aktiv', roleActive4 === 0);

  // After restart, fill in again and test both groups stay active
  await p.fill('#child-name', 'Anna');
  await p.fill('#child-age', '3');
  await p.click('[data-sex="d"]');
  await p.click('[data-role="parent"]');
  const sexActive4b  = await p.$$eval('[data-sex]',  els => els.filter(e => e.classList.contains('active')).map(e => e.dataset.sex));
  const roleActive4b = await p.$$eval('[data-role]', els => els.filter(e => e.classList.contains('active')).map(e => e.dataset.role));
  const disabled4b   = await p.$eval('#start-btn', e => e.disabled);
  assert('Nach Neustart: sex-d aktiv',           sexActive4b.includes('d') && sexActive4b.length === 1);
  assert('Nach Neustart: role-parent aktiv',     roleActive4b.includes('parent') && roleActive4b.length === 1);
  assert('Nach Neustart: #start-btn enabled',    disabled4b === false);

  // ─────────────────────────────────────────────
  console.log('\n=== Test 5: Ohne Name bleibt start-btn disabled ===');
  await p.goto(FILE);
  await p.fill('#child-age', '5');
  await p.click('[data-sex="m"]');
  await p.click('[data-role="pro"]');
  const disabledNoName = await p.$eval('#start-btn', e => e.disabled);
  assert('#start-btn disabled wenn kein Name', disabledNoName === true);

  // ─────────────────────────────────────────────
  console.log('\n=== Test 6: Ohne Alter bleibt start-btn disabled ===');
  await p.goto(FILE);
  await p.fill('#child-name', 'Max');
  await p.click('[data-sex="m"]');
  await p.click('[data-role="parent"]');
  const disabledNoAge = await p.$eval('#start-btn', e => e.disabled);
  assert('#start-btn disabled wenn kein Alter', disabledNoAge === true);

  await b.close();

  console.log(`\n${'─'.repeat(45)}`);
  console.log(`Ergebnis: ${passed} bestanden, ${failed} fehlgeschlagen`);
  if (failed > 0) process.exit(1);
})().catch(e => { console.error('FATAL:', e); process.exit(1); });
