# Bugfix-Auftrag: Intake-Maske im Kinder-Screening

## Datei

`ADHS-Selbsttest_Child_v3.html` (liegt im selben Verzeichnis wie diese MD)

Es ist eine **einzelne, eigenständige HTML-Datei** (HTML + CSS + Vanilla-JS in einem `<script>`-Block am Ende des `<body>`). Kein Build, keine Dependencies, keine externen Module außer Google Fonts.

## Symptom (reproduzierbar auf iPhone/Safari, evtl. auch Desktop)

Die Startmaske (“Intake”) hat vier Pflichtfelder:

1. Vorname (Textfeld `#child-name`)
1. Alter (Zahlfeld `#child-age`, 2–8)
1. Geschlecht (3 Buttons mit `data-sex`)
1. Rolle (2 Buttons mit `data-role`)

**Fehler:** Geschlecht und Rolle schließen sich gegenseitig aus. Wählt man erst Geschlecht und dann Rolle (oder umgekehrt), wird die **erste Auswahl optisch und/oder logisch zurückgesetzt**. Dadurch sind nie alle vier Felder gleichzeitig “gesetzt”, der Button `#start-btn` (`disabled`) wird nie aktiviert, und der Fragebogen lässt sich nicht starten.

## Bisherige Fix-Versuche (haben das Problem NICHT gelöst)

- Inline `onclick` → `addEventListener` umgestellt
- Globale Variable `role` → `raterRole` umbenannt
- `type="button"` auf alle Buttons gesetzt
- Auf Event-Delegation am Container `#intake` umgestellt
- Live-Statuszeile `#intake-status` ergänzt

Die JS-Logik scheint isoliert korrekt (Syntax ok, Simulation mit DOM-Stub funktioniert). Der Fehler tritt nur im **echten Browser** auf — bitte dort verifizieren.

## Aufgabe

1. **Reproduziere** den Fehler in einem echten Browser (z.B. Headless Chrome / Playwright / Puppeteer). Fülle Name + Alter aus, klicke einen `data-sex`-Button, dann einen `data-role`-Button. Prüfe ob beide die Klasse `active` behalten und ob `#start-btn` aktiv (`disabled === false`) wird.
1. **Finde die echte Ursache.** Verdachtsmomente, die zu prüfen sind:
- Wird `wireIntake()` überhaupt ausgeführt? (console.log / Breakpoint)
- Werfen `setSex`/`setRole`/`checkIntake`/`onAgeChange` zur Laufzeit einen Fehler, der die Verarbeitung abbricht? (Browser-Konsole auf Errors prüfen)
- Greift die Delegation `e.target.closest('button')` korrekt, auch wenn auf das innere Text-/Span-Element geklickt wird?
- Gibt es ein verstecktes `<form>`-Element, das bei Button-Klick einen Submit/Reset auslöst? (Falls ja: `type="button"` sicherstellen bzw. `e.preventDefault()`)
- Sind die Variablen `childSex` und `raterRole` evtl. in unterschiedlichen Scopes (z.B. eine Funktion redeklariert `let`/`var` lokal und überschreibt nicht die globale)? Per Suche prüfen: alle Zuweisungen an `childSex` und `raterRole`.
- Wird `checkIntake()` evtl. von einem `input`-Delegations-Handler bei jedem Klick mitgefeuert und liest dabei einen veralteten Wert?
- CSS: Prüfen ob `.role-btn.active` evtl. durch eine spezifischere Regel überschrieben wird (beide Gruppen nutzen die Klasse `role-btn`).
1. **Behebe** die Ursache mit minimalem, robustem Eingriff. Bevorzugt: state in einem einzigen `state`-Objekt halten, Buttons rein über `data-`-Attribute + Delegation steuern, `active`-Klasse nur innerhalb der jeweiligen `.role-group` togglen.
1. **Verifiziere** automatisiert (Playwright o.ä.):
- Beide Auswahlreihenfolgen (Geschlecht→Rolle UND Rolle→Geschlecht) führen dazu, dass beide `active` bleiben.
- `#start-btn` wird aktiv, sobald Name (nicht leer) + Alter (2–8) + Geschlecht + Rolle gesetzt sind.
- Klick auf Start blendet `#intake` aus und zeigt `#quiz`.
- Re-Test nach `doRestart()`.

## Sehr wichtige Rahmenbedingungen

- **Eine einzige .html-Datei als Ergebnis.** Nicht in mehrere Dateien aufteilen, keine externen JS/CSS-Dateien, kein Bundler. Muss lokal per Doppelklick / über `file://` bzw. statisches Hosting (Netlify Drop) laufen.
- **KEIN localStorage / sessionStorage** verwenden (läuft in manchen Umgebungen nicht).
- Bestehendes Design, Fragenlogik, altersadaptive Auswertung und PDF-Export **unverändert** lassen — nur den Intake-Bug beheben.
- Deutschsprachige UI beibehalten.
- Am Ende kurz dokumentieren (Kommentar im Code oder kurze Antwort), **was** die Ursache war und **wie** behoben.

## Schnelltest-Snippet (Playwright, als Orientierung)

```js
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  p.on('console', m => console.log('PAGE:', m.text()));
  p.on('pageerror', e => console.log('PAGEERROR:', e.message));
  await p.goto('file://' + process.cwd() + '/ADHS-Selbsttest_Child_v3.html');
  await p.fill('#child-name', 'Lena');
  await p.fill('#child-age', '4');
  await p.click('[data-sex="m"]');
  await p.click('[data-role="parent"]');
  const sexActive  = await p.$$eval('[data-sex]',  els => els.filter(e => e.classList.contains('active')).map(e => e.id));
  const roleActive = await p.$$eval('[data-role]', els => els.filter(e => e.classList.contains('active')).map(e => e.id));
  const disabled   = await p.$eval('#start-btn', e => e.disabled);
  console.log({ sexActive, roleActive, startDisabled: disabled });
  // Erwartung: sexActive=['sex-m'], roleActive=['role-parent'], startDisabled=false
  await b.close();
})();
```