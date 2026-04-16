# OKR-Feedback: Objectives, KR-Sortierung, Wochen-Check

## Kurzfassung

Wir setzen die abgestimmte Komfort-Loesung um:

- Beim Anlegen eines neuen Objectives sind direkt `4` Key-Result-Felder sichtbar.
- Speichern ist schon mit `1` bis `5` ausgefuellten Key Results erlaubt.
- Pro Objective sind maximal `5` Key Results erlaubt.
- Auf dem Dashboard gibt es einen kleinen Sortier-Schalter fuer Objectives.
- Bei Key Results gibt es ebenfalls einen Sortier-Schalter; die Auswahl wird pro Nutzer gemerkt.
- Der Wochen-Check startet oben mit der reinen Scoring-Ansicht und behaelt darunter die Reflexionsfragen.
- Die sichtbare KR-Signalfarbe folgt ueberall denselben Grenzen:
  - `0-39%` = rot
  - `40-69%` = gelb
  - `70-100%` = gruen
- Fehlermeldungen fuer zu lange Objective-Titel werden klar und konkret.

## Ausgangslage

Im aktuellen Stand zeigen sich vier Probleme:

1. Objectives werden auf dem Dashboard standardmaessig `neueste zuerst` angezeigt. Das fuehlt sich nicht wie "wie erfasst" an.
2. Der Wochen-Check ist heute eine Misch-Seite mit Reflexion, Stimmung und Zusagen, aber noch keine klare OKR-Scoring-Seite.
3. Die KR-Signalfarben wirken uneinheitlich. Ein Teil der Anzeige haengt an spezieller Ampel-Logik, nicht an einer einfachen, fuer Nutzer klaren Prozentlogik.
4. Beim Speichern eines zu langen Objective-Titels bekommt man keine gut erklaerende Rueckmeldung.

## Ziele

- Die App soll sich im Alltag ruhiger und vorhersehbarer verhalten.
- Nutzer sollen sofort mit einer guten OKR-Standardstruktur starten: `4` KRs vorgeschlagen, `5` moeglich.
- Reihenfolgen sollen bewusst steuerbar sein und sich die letzte Auswahl merken.
- Der Wochen-Check soll oben das zeigen, was in den Kursen erwartet wird: Objectives und KRs scoren.
- Fehlermeldungen sollen das Problem klar benennen.

## Nicht-Ziele

- Kein Drag-and-Drop fuer freie manuelle Reihenfolge in dieser Ausbaustufe.
- Keine neue komplexe Check-in-Methodik mit Tabs oder mehrstufigem Wizard.
- Keine unbegrenzte Zahl an Key Results.
- Keine komplette Neudefinition der Objective-Mechanik.

## Gewaehlter Ansatz

Wir setzen auf eine kleine, stabile Erweiterung der bestehenden App statt auf einen grossen Umbau.

Der Kern davon ist:

- Standards vernuenftig setzen
- Reihenfolge bewusst steuerbar machen
- Nutzerpraeferenzen speichern
- Wochen-Check visuell neu priorisieren
- KR-Signalfarbe vereinheitlichen

## Fachliche Regeln

### 1. Neues Objective

- Das Formular startet mit `4` sichtbaren KR-Feldern.
- Leere KR-Felder duerfen leer bleiben.
- Gespeichert werden nur KR-Felder, die einen Titel haben.
- Mindestens `1` ausgefuelltes KR ist notwendig.
- Maximal `5` KRs pro Objective sind erlaubt.
- Der Button `Weiteres KR erfassen` fuegt genau ein weiteres Feld hinzu, bis das Limit `5` erreicht ist.

### 2. Objective-Sortierung

- Standard: `Wie erfasst`
- Bedeutung von `Wie erfasst`: `aelteste zuerst`
- `Zielerreichung` bei Objectives bedeutet der bereits berechnete Objective-Fortschritt in Prozent.
- Weitere Optionen:
  - `Alphabetisch`
  - `Zielerreichung aufsteigend`
  - `Zielerreichung absteigend`
- Die zuletzt gewaehlte Objective-Sortierung wird pro Nutzer gespeichert.

### 3. KR-Sortierung

- Standard: `Wie erfasst`
- Bedeutung von `Wie erfasst`: `aelteste zuerst`
- `Zielerreichung` bei KRs bedeutet der bereits berechnete KR-Fortschritt in Prozent.
- Weitere Optionen:
  - `Alphabetisch`
  - `Zielerreichung aufsteigend`
  - `Zielerreichung absteigend`
  - `Am laengsten nicht gescored`
- `Am laengsten nicht gescored` bedeutet:
  - KRs ohne Updates stehen zuerst.
  - Danach folgen KRs mit dem aeltesten letzten Update.
- Die zuletzt gewaehlte KR-Sortierung wird pro Nutzer gespeichert.

### 4. Wochen-Check

- Im Menuepunkt `Wochen-Check` steht oben zuerst die Scoring-Ansicht.
- Dort werden Objectives und ihre KRs zum schnellen Bewerten und Aktualisieren gezeigt.
- Die bisherigen Reflexionsbereiche bleiben erhalten, ruecken aber nach unten:
  - Stimmung
  - Highlights
  - Spannungen
  - Kurz-Zusammenfassung
  - Naechste Schritte

### 5. KR-Signalfarben

Die sichtbare KR-Farbe richtet sich ueberall nach der Zielerreichung in Prozent:

- `0-39%` = rot
- `40-69%` = gelb
- `70-100%` = gruen

Diese Logik gilt fuer:

- KR-Listen im Dashboard
- KR-Bereiche im Wochen-Check
- KR-Detailansichten
- weitere KR-Uebersichten, sofern die Seite keine bewusst andere Darstellungslogik braucht

Spezielle KR-Typen wie `TRAFFIC_LIGHT` duerfen ihre interne Berechnung behalten. Fuer die sichtbare Signal-Farbe zaehlt aber die einheitliche Prozentlogik, damit Nutzer ueberall dasselbe Signal sehen.
Die Detailseite darf die Ampel-Schwellen weiter als Zusatzinfo anzeigen. Die sichtbare Chip-Farbe folgt aber trotzdem der Prozentlogik.

### 6. Fehlermeldungen

Wenn ein Objective zu lang ist, soll die Rueckmeldung klar sein.

Beispiel:

- `Objective ist zu lang. Maximal 120 Zeichen.`

Die Rueckmeldung soll:

- direkt am Feld sichtbar sein
- beim Speichern in der Fehlermeldung wiederholt werden

## Technisches Design

### Datenmodell

Die einfachste und passendste Loesung ist, die Sortierpraeferenzen am `User` zu speichern. Das passt zum vorhandenen Muster `preferredQuarterId`.

Neue Felder auf `User`:

- `preferredObjectiveSort`
- `preferredKeyResultSort`

Beide Felder werden als Enum gespeichert, damit nur erlaubte Werte moeglich sind.

Vorgeschlagene Enum-Werte:

#### ObjectiveSortOption

- `CREATED_ASC`
- `ALPHABETICAL_ASC`
- `PROGRESS_ASC`
- `PROGRESS_DESC`

#### KeyResultSortOption

- `CREATED_ASC`
- `ALPHABETICAL_ASC`
- `PROGRESS_ASC`
- `PROGRESS_DESC`
- `STALEST_FIRST`

Warum keine eigene Tabelle:

- pro Nutzer gibt es nur zwei kleine Praeferenzen
- die Werte werden oft gelesen, aber selten geaendert
- das bleibt einfacher als eine generische Preference-Tabelle

### Server- und UI-Logik

#### Objectives

- Objectives werden weiterhin fuer den Nutzer geladen.
- Danach wird anhand der gespeicherten Praeferenz sortiert.
- Fuer `Wie erfasst` wird `createdAt ASC` verwendet.
- Bei gleichen Werten wird stabil mit `id ASC` nachsortiert, damit die Reihenfolge nicht springt.

#### Key Results

- Key Results werden fuer jede Seite zunaechst vollstaendig geladen.
- Danach wird anhand der Nutzerpraeferenz sortiert.
- Fuer `STALEST_FIRST` wird das letzte Update pro KR betrachtet.
- KRs ohne Update bekommen den niedrigsten "Aktualitaetswert" und erscheinen daher zuerst.

#### Sortier-Schalter

- Objectives: auf dem Dashboard ueber der Objective-Liste
- KRs: auf Objective-Detailseite und im Wochen-Check
- Die Auswahl aktualisiert die gespeicherte Nutzerpraeferenz direkt
- Beim naechsten Laden der Seite bleibt die Auswahl erhalten
- Die gespeicherte Praeferenz gilt fuer alle passenden Listen dieses Nutzers, sofern eine Seite sie nicht bewusst ueberschreibt.

### Formularlogik fuer Objectives

Aktuell verlangt die App mindestens `2` Key Results und erlaubt bis `6`.

Das wird geaendert zu:

- mindestens `1`
- maximal `5`

Betroffene Stellen:

- Create-Validierung
- Create-Formular
- KR-Hinzufuegen im Objective-Formular
- KR-Archivierung, damit nicht mehr kuenstlich mindestens `2` aktive KRs erzwungen werden

Wichtig:

- Die Edit-Seite muss ebenfalls mit der neuen Mindestgrenze `1` arbeiten.
- Sonst waere das Neuanlegen erlaubt, spaeteres Bearbeiten/Archivieren aber inkonsistent.

### Wochen-Check-Aufbau

Der Wochen-Check bekommt oben einen neuen Bereich, zum Beispiel `Scoring diese Woche`.

Darin:

- Objectives in der gewaehlten Objective-Reihenfolge
- darunter je Objective die KRs in der gewaehlten KR-Reihenfolge
- schneller Zugriff auf vorhandene KR-Update-Mechanik
- sichtbare Farbchips nach der neuen Prozentlogik

Die bestehende `CheckInComposer`-Logik bleibt erhalten, wird aber unter den neuen Scoring-Block verschoben.

Das minimiert Risiko, weil die bestehende Check-in-Speicherung nicht neu erfunden werden muss.

### Status- und Farb-Logik

Wir fuehren eine kleine, zentrale Hilfsfunktion ein, zum Beispiel:

- `getProgressSignalColor(progress)`

Diese Funktion liefert:

- `red`
- `yellow`
- `green`

auf Basis der festen Grenzen `39 / 69 / 100`.

Alle visuellen KR-Signale nutzen dann dieselbe Hilfsfunktion.

## Betroffene Bereiche im Projekt

Wahrscheinlich betroffen sind vor allem:

- `src/components/dashboard/objective-form.tsx`
- `src/actions/objective.ts`
- `src/actions/key-result.ts`
- `src/app/dashboard/page.tsx`
- `src/app/dashboard/check-in/page.tsx`
- `src/components/dashboard/check-in-composer.tsx`
- `src/components/dashboard/objective-card.tsx`
- `src/components/dashboard/objective-detail.tsx`
- `src/components/dashboard/traffic-light-chip.tsx`
- `src/lib/key-results.ts`
- `src/lib/validations/objective.ts`
- `prisma/schema.prisma`

## Fehlerbehandlung

- Zu langer Objective-Titel: klare Validierungsnachricht
- Zu viele KRs: klare Meldung `Maximal 5 Key Results pro Objective.`
- Kein KR ausgefuellt: klare Meldung `Bitte gib mindestens ein Key Result an.`
- Unerlaubte Sortieroption: auf Standard `Wie erfasst` zurueckfallen

## Teststrategie

### Formular

- Objective mit `1`, `2`, `3`, `4`, `5` KRs speicherbar
- Objective mit `0` KRs nicht speicherbar
- `6` KRs nicht moeglich
- zu langer Objective-Titel zeigt klare Fehlermeldung

### Sortierung

- Dashboard startet fuer neue Nutzer mit `Wie erfasst`
- Objective-Sortierung wird nach Aenderung gespeichert
- KR-Sortierung wird nach Aenderung gespeichert
- `Wie erfasst` zeigt wirklich `aelteste zuerst`
- `Stalest first` zeigt KRs ohne Update zuerst

### Wochen-Check

- Scoring-Block steht vor Reflexionsfragen
- KR-Updates sind aus dem Wochen-Check erreichbar
- KR-Farben folgen `39 / 69 / 70`

### Farblogik

- `39%` = rot
- `40%` = gelb
- `69%` = gelb
- `70%` = gruen

## Risiken und Gegenmassnahmen

### Risiko 1: Uneinheitliche Reihenfolge auf verschiedenen Seiten

Gegenmassnahme:

- eine gemeinsame Sortier-Hilfsfunktion fuer Objectives
- eine gemeinsame Sortier-Hilfsfunktion fuer KRs

### Risiko 2: KR-Farbe und KR-Typ verhalten sich widerspruechlich

Gegenmassnahme:

- klar trennen zwischen interner KR-Berechnung und sichtbarer Signal-Farbe
- die sichtbare Farbe folgt immer der Prozentlogik

### Risiko 3: Neue Mindestgrenze nur beim Anlegen, nicht beim Bearbeiten

Gegenmassnahme:

- Create- und Edit-Flows gemeinsam anpassen
- Archivierungslogik fuer KRs mitpruefen

## Offene Entscheidungen

Keine. Alle bisher besprochenen Produktentscheidungen sind festgelegt:

- Komfort-Loesung statt Minimal-Loesung
- Sortier-Schalter ja
- `Wie erfasst` = `aelteste zuerst`
- `4` KR-Felder standardmaessig sichtbar
- Speichern schon mit weniger als `4` moeglich
- maximal `5` KRs
- Wochen-Check oben Scoring, unten Reflexion
- mittlere Farbe bleibt gelb

## Empfehlung fuer die Umsetzung

Die Umsetzung sollte in drei Schritten erfolgen:

1. Datenmodell + Sortierpraeferenzen
2. Objective/KR-Formularlogik + klare Fehlermeldungen
3. Wochen-Check und KR-Farblogik

So bleibt das Risiko klein und die Aenderung gut testbar.
