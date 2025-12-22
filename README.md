# Logging

Ein kleines, rein clientseitiges Tool zum Erfassen von START/END-Ereignissen für Prozesse und Flüge. Öffne einfach `index.html` in einem Browser.

## Funktionen
- Lädt beim Page-Load den letzten State aus dem `localStorage` oder setzt einen Default-State.
- START/END-Buttons erzeugen Events mit ISO-Zeitstempel, aufsteigender `log_id`, `source="HIWI_LOGGER_V1"` und `airport="MUC"`.
- Events werden in `state.events` gespeichert und direkt im `localStorage` persistiert.
- Erkennung laufender Prozesse (letzter START ohne END je Prozess-Code/Flug) und Anzeige mit „läuft seit …“.
