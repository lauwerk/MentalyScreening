/**
 * DIAGNOSE: Intake-Bug — native Radio-Button Implementierung
 * Umgebung A: Desktop Chromium
 * Umgebung B: iPhone 13 Emulation
 * Umgebung C: iPhone, umgekehrte Reihenfolge
 * Umgebung D: Alter nach Buttons
 */
const { chromium, devices } = require('/opt/node22/lib/node_modules/playwright');
const iPhone = devices['iPhone 13'];
const FILE   = 'file:///home/user/MentalyScreening/ADHS-Selbsttest%20Child%20v3.html';

let passed = 0, failed = 0;
function assert(label, condition, detail) {
  var mark = condition ? '  ✓' : '  ✗ FAIL';
  console.log(mark + ': ' + label + (detail ? '  →  ' + detail : ''));
  condition ? passed++ : failed++;
}

async function readState(p) {
  return p.evaluate(function() {
    var sexChecked  = document.querySelector('input[name="sex"]:checked');
    var roleChecked = document.querySelector('input[name="role"]:checked');
    var sexLabels   = Array.from(document.querySelectorAll('input[name="sex"]')).map(function(r) {
      return { value: r.value, checked: r.checked };
    });
    var roleLabels  = Array.from(document.querySelectorAll('input[name="role"]')).map(function(r) {
      return { value: r.value, checked: r.checked };
    });
    return {
      nameVal:       document.getElementById('child-name').value,
      ageVal:        document.getElementById('child-age').value,
      sexChecked:    sexChecked ? sexChecked.value : null,
      roleChecked:   roleChecked ? roleChecked.value : null,
      sexRadios:     sexLabels,
      roleRadios:    roleLabels,
      startDisabled: document.getElementById('start-btn').disabled,
      statusText:    (document.getElementById('intake-status') || {}).textContent || '',
    };
  });
}

(async function() {
  var browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox'],
  });

  // ══════════════════════════════════════
  console.log('\n' + '═'.repeat(50));
  console.log('UMGEBUNG A: Desktop Chromium');
  console.log('═'.repeat(50));
  var ctxA = await browser.newContext();
  var pA   = await ctxA.newPage();
  pA.on('pageerror', function(e) { console.error('  JS-ERROR:', e.message); });
  await pA.goto(FILE);
  await pA.fill('#child-name', 'Lena');
  await pA.fill('#child-age', '4');
  await pA.press('#child-age', 'Tab');
  // Klick auf Label (für Geschlecht), nicht auf hidden input
  await pA.click('label[for="sex-m"]');
  var sA1 = await readState(pA);
  console.log('  Nach sex-m: sexChecked=' + sA1.sexChecked + ' disabled=' + sA1.startDisabled);
  assert('A: sex-m selektiert', sA1.sexChecked === 'm');
  await pA.click('label[for="role-parent"]');
  var sA2 = await readState(pA);
  console.log('  Nach role-parent: sexChecked=' + sA2.sexChecked + ' roleChecked=' + sA2.roleChecked + ' disabled=' + sA2.startDisabled);
  assert('A: sex-m bleibt selektiert', sA2.sexChecked === 'm');
  assert('A: role-parent selektiert',  sA2.roleChecked === 'parent');
  assert('A: start-btn enabled',       sA2.startDisabled === false, sA2.statusText);
  await ctxA.close();

  // ══════════════════════════════════════
  console.log('\n' + '═'.repeat(50));
  console.log('UMGEBUNG B: iPhone 13 Emulation (Touch)');
  console.log('═'.repeat(50));
  var ctxB = await browser.newContext(Object.assign({}, iPhone));
  var pB   = await ctxB.newPage();
  pB.on('pageerror', function(e) { console.error('  JS-ERROR:', e.message); });
  await pB.goto(FILE);
  await pB.tap('#child-name'); await pB.fill('#child-name', 'Lena');
  await pB.tap('#child-age');  await pB.fill('#child-age', '4');
  await pB.tap('.intake-title');
  var sB0 = await readState(pB);
  assert('B: ageVal="4" nach Blur', sB0.ageVal === '4', 'ageVal="' + sB0.ageVal + '"');
  await pB.tap('label[for="sex-m"]');
  var sB1 = await readState(pB);
  console.log('  Nach sex-m tap: sexChecked=' + sB1.sexChecked + ' status=' + sB1.statusText);
  assert('B: sex-m selektiert nach tap', sB1.sexChecked === 'm');
  await pB.tap('label[for="role-parent"]');
  var sB2 = await readState(pB);
  console.log('  Nach role-parent tap: sex=' + sB2.sexChecked + ' role=' + sB2.roleChecked + ' disabled=' + sB2.startDisabled);
  assert('B: sex-m bleibt selektiert', sB2.sexChecked === 'm');
  assert('B: role-parent selektiert',  sB2.roleChecked === 'parent');
  assert('B: start-btn enabled',       sB2.startDisabled === false, sB2.statusText);
  await ctxB.close();

  // ══════════════════════════════════════
  console.log('\n' + '═'.repeat(50));
  console.log('UMGEBUNG C: iPhone — Rolle zuerst, dann Geschlecht');
  console.log('═'.repeat(50));
  var ctxC = await browser.newContext(Object.assign({}, iPhone));
  var pC   = await ctxC.newPage();
  await pC.goto(FILE);
  await pC.fill('#child-name', 'Tim');
  await pC.tap('#child-age'); await pC.fill('#child-age', '6'); await pC.tap('.intake-title');
  await pC.tap('label[for="role-pro"]');
  await pC.tap('label[for="sex-f"]');
  var sC = await readState(pC);
  console.log('  sex=' + sC.sexChecked + ' role=' + sC.roleChecked + ' disabled=' + sC.startDisabled);
  assert('C: sex-f selektiert',    sC.sexChecked === 'f');
  assert('C: role-pro selektiert', sC.roleChecked === 'pro');
  assert('C: start-btn enabled',   sC.startDisabled === false, sC.statusText);
  await ctxC.close();

  // ══════════════════════════════════════
  console.log('\n' + '═'.repeat(50));
  console.log('UMGEBUNG D: Neustart (doRestart)');
  console.log('═'.repeat(50));
  var ctxD = await browser.newContext(Object.assign({}, iPhone));
  var pD   = await ctxD.newPage();
  await pD.goto(FILE);
  await pD.fill('#child-name', 'Anna');
  await pD.tap('#child-age'); await pD.fill('#child-age', '3'); await pD.tap('.intake-title');
  await pD.tap('label[for="sex-m"]');
  await pD.tap('label[for="role-parent"]');
  var sD1 = await readState(pD);
  assert('D: vor Restart alles ok', sD1.startDisabled === false);
  // Neustart
  await pD.evaluate(function() { doRestart(); });
  var sD2 = await readState(pD);
  assert('D: nach Restart sex leer',    sD2.sexChecked === null,  'sexChecked=' + sD2.sexChecked);
  assert('D: nach Restart role leer',   sD2.roleChecked === null, 'roleChecked=' + sD2.roleChecked);
  assert('D: nach Restart btn disabled', sD2.startDisabled === true);
  // Wieder ausfüllen
  await pD.fill('#child-name', 'Max');
  await pD.tap('#child-age'); await pD.fill('#child-age', '5'); await pD.tap('.intake-title');
  await pD.tap('label[for="sex-f"]');
  await pD.tap('label[for="role-pro"]');
  var sD3 = await readState(pD);
  assert('D: nach Neustart sex-f ok',      sD3.sexChecked === 'f');
  assert('D: nach Neustart role-pro ok',   sD3.roleChecked === 'pro');
  assert('D: nach Neustart btn enabled',   sD3.startDisabled === false, sD3.statusText);
  await ctxD.close();

  // ══════════════════════════════════════
  console.log('\n' + '═'.repeat(50));
  console.log('UMGEBUNG E: Start-Button startet Quiz');
  console.log('═'.repeat(50));
  var ctxE = await browser.newContext();
  var pE   = await ctxE.newPage();
  await pE.goto(FILE);
  await pE.fill('#child-name', 'Test');
  await pE.fill('#child-age', '5'); await pE.press('#child-age', 'Tab');
  await pE.click('label[for="sex-m"]');
  await pE.click('label[for="role-parent"]');
  await pE.click('#start-btn');
  var intakeHidden = await pE.$eval('#intake', function(e) { return e.style.display === 'none'; });
  var quizOk       = await pE.$eval('#quiz',   function(e) { return e.innerHTML.trim().length > 0; });
  assert('E: intake ausgeblendet', intakeHidden);
  assert('E: quiz hat Inhalt',     quizOk);
  await ctxE.close();

  await browser.close();
  console.log('\n' + '─'.repeat(50));
  console.log('Ergebnis: ' + passed + ' bestanden, ' + failed + ' fehlgeschlagen');
  if (failed > 0) process.exit(1);
})().catch(function(e) { console.error('FATAL:', e.message); process.exit(1); });
