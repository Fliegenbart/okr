# Code Quality Audit

Stand: 2026-04-15

## Kurzfassung

Die Codebasis war insgesamt in einem brauchbaren Zustand, hatte aber mehrere typische Wachstumsprobleme:

- gleiche Logik an mehreren Stellen
- verstreute Typdefinitionen
- ungenutzte Dateien und Exporte
- defensive Fehlerbehandlung, die echte Probleme teilweise versteckt hat
- einzelne Legacy- und Fallback-Pfade, die den Code unnötig kompliziert gemacht haben

Die folgenden High-Confidence-Änderungen wurden umgesetzt:

- gemeinsame Typen fuer Key Results, Thinking Partner und Board Events eingefuehrt
- Thinking-Partner-Antwortformatierung und Join-URL-Erzeugung dedupliziert
- ungenutzte Dateien und alte Scaffold-Reste entfernt
- Fehlerbehandlung praeziser gemacht, vor allem bei Rate Limits und API-Fehlern
- schwache Typen an mehreren kritischen Stellen durch staerkere Typen ersetzt
- einen klar ueberfluessigen Legacy-Quarter-Fallback entfernt

Geprueft mit:

- `npx tsc --noEmit --pretty false`
- `npm run lint -- --max-warnings=0`
- `npx --yes madge --extensions ts,tsx,js,jsx,mjs --ts-config tsconfig.json --circular src scripts tests prisma/seed.js eslint.config.mjs`
- `git diff --check`

## 1. DRY / Duplikate

### Kritische Einschaetzung

- Es gab doppelte Logik fuer Thinking-Partner-Antworten.
- Join-Links wurden an mehreren Stellen von Hand zusammengesetzt.
- Es gibt noch weitere kleinere Wiederholungen, zum Beispiel bei Revalidation und Datumsformatierung.

### Empfehlung

- gemeinsame Helfer fuer wiederholte Business-Logik nutzen
- nur dann zusammenziehen, wenn der Code danach wirklich einfacher wird

### Umgesetzt

- gemeinsame Thinking-Partner-Formatter extrahiert
- gemeinsame `buildJoinUrl(...)`-Helferfunktion eingefuehrt

### Noch offen

- einige Revalidation- und Datums-Helfer koennen spaeter noch zentralisiert werden

## 2. Typen konsolidieren

### Kritische Einschaetzung

- gleiche oder sehr aehnliche Typideen waren ueber mehrere Dateien verteilt
- das fuehrt leicht zu stillen Abweichungen und Folgefehlern

### Empfehlung

- geteilte Domain-Typen an zentralen Stellen ablegen
- UI und API auf dieselben Typen beziehen

### Umgesetzt

- gemeinsame Typen fuer Key-Result-Fortschritt eingefuehrt
- gemeinsame Typen fuer Thinking-Partner-API eingefuehrt
- gemeinsame Board-Event-Typen eingefuehrt

## 3. Ungenutzter Code

### Kritische Einschaetzung

- Knip hat mehrere ungenutzte Dateien und Exporte gefunden
- ein Teil davon war eindeutig tot, ein Teil ist moeglicherweise noch fuer kuenftige UI-Anbindung gedacht

### Empfehlung

- nur eindeutig tote Teile sofort loeschen
- bei ungenutzten Exporten mit Seiteneffekten oder Produktbezug vorsichtig sein

### Umgesetzt

- kompletten `_scaffold/`-Ordner entfernt
- `objective-progress-mini-chart.tsx` entfernt
- `progress-donut.tsx` entfernt
- mehrere klar ungenutzte Helper-Funktionen entfernt

### Noch offen

- `invite-code-card.tsx` wird derzeit von Knip als ungenutzt markiert
- einige weitere Exporte sind noch Kandidaten fuer eine zweite, vorsichtige Bereinigung

## 4. Zirkulaere Abhaengigkeiten

### Kritische Einschaetzung

- zirkulaere Imports waeren gefaehrlich, weil sie Initialisierung und Debugging schwer machen

### Empfehlung

- weiterhin regelmaessig mit Madge pruefen

### Ergebnis

- aktuell keine zirkulaeren Abhaengigkeiten gefunden

## 5. Schwache Typen

### Kritische Einschaetzung

- an mehreren Stellen gab es `unknown`, implizite JSON-Annahmen oder breite Typen
- das ist besonders riskant bei API-Antworten, Prisma-JSON und globalen Singletons

### Empfehlung

- nur echte Strukturtypen verwenden
- JSON-Daten aktiv validieren, statt blind zu casten

### Umgesetzt

- Prisma-Global-Typing verbessert
- Tool-Call-JSON in `llm.ts` strenger typisiert
- Transcript- und Topic-Daten staerker typisiert
- Audit-Metadata klarer typisiert

## 6. Try/Catch und defensive Muster

### Kritische Einschaetzung

- einige Catch-Bloecke haben Fehler zu pauschal behandelt
- dadurch wurden echte Ursachen teilweise verdeckt

### Empfehlung

- nur dort catchen, wo wirklich sinnvoll reagiert wird
- bekannte Fehler gezielt behandeln, unbekannte Fehler nicht verstecken

### Umgesetzt

- `RateLimitError` eingefuehrt
- Thinking-Partner- und Power-Move-APIs geben jetzt klarere Fehler zurueck
- Board-APIs unterscheiden jetzt sauberer zwischen `401` und `404`
- FileReader-Fehler werden nicht mehr still geschluckt

## 7. Legacy-, Deprecated- und Fallback-Code

### Kritische Einschaetzung

- einige Fallbacks dienten nicht mehr der Stabilitaet, sondern nur noch alter Kompatibilitaet
- das macht den Code schwerer zu verstehen

### Empfehlung

- Fallbacks nur behalten, wenn sie eine echte Produkt- oder Ausfallsicherheit absichern

### Umgesetzt

- klar ueberfluessigen Quarter-Fallback entfernt
- Thinking-Partner-Fallback-Felder und verwandte Altpfade entfernt

### Bewusst behalten

- sinnvolle Betriebs-Fallbacks, zum Beispiel fuer Modellwahl oder Polling, wurden nicht blind geloescht

## 8. AI-Slop, Stubs und Kommentare

### Kritische Einschaetzung

- einzelne Kommentare waren eher Historie oder Zwischenstand als Hilfe
- solche Kommentare lenken Anfaenger oft eher ab als dass sie helfen

### Empfehlung

- Kommentare nur behalten, wenn sie Kontext geben, den man aus dem Code nicht sofort sieht

### Umgesetzt

- mehrere schwache oder veraltete Kommentare entfernt oder gekuerzt
- an einzelnen Stellen auf klarere, nuetzlichere Kommentare umgestellt
- ein Bild-Upload-Teil sauberer auf `next/image` umgestellt

## Was ich absichtlich noch nicht automatisch entfernt habe

Ein paar Teile wurden bewusst nicht blind geloescht, obwohl Tools sie als Kandidaten markieren:

- `src/components/dashboard/invite-code-card.tsx`
- einzelne Exporte in Board- und Couple-Actions
- einige exportierte UI-Prop-Typen

Der Grund ist einfach: Tools finden gut "wahrscheinlich ungenutzt", aber nicht immer "sicher ungenutzt". Fuer diese Reste ist ein zweiter, konservativer Cleanup-Schritt sinnvoll.

## Empfohlene naechste Schritte

1. verbliebene Knip-Treffer einzeln pruefen und den Rest toten Codes entfernen
2. wiederholte Revalidation- und Datumslogik bei Gelegenheit weiter vereinheitlichen
3. wichtige Kernbereiche mit ein paar gezielten Tests absichern, bevor weitere groessere Bereinigungen folgen
