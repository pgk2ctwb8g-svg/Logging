# Logging

## Features
- Prozess-Logging mit Start/Ende pro Prozess inklusive CSV-Export.
- GPS-Abfrage inkl. automatischer Airport-Erkennung (IATA) auf Basis einer nahegelegenen Airport-Liste.
- Flugvorschläge im ±30-Minuten-Fenster mit automatischer Übernahme von Flugnummer, Airline-Code und Aircraft Type (Sample-Daten als Fallback).

## Flug-API anbinden (optional)
Die Flugvorschläge nutzen standardmäßig lokale Beispieldaten. Für eine echte API kannst du zur Laufzeit (z.B. in der Browser-Konsole) folgende Konfiguration setzen:

```js
window.flightApiConfig = {
  url: "https://deine-api.example.com/flights", // Endpoint mit CORS-Freigabe
  apiKey: "<optional-bearer-token-oder-api-key>",
};
```

Erwartet wird eine Antwort als Array oder `{ flights: [...] }` mit Feldern wie `flight_no`, `airline_code`, `airline`, `aircraft_type`, `direction`, `gate`, `stand`.

Alternativ kannst du direkt in der UI im Abschnitt „Flugvorschläge (±30 Min)“ die Flug-API-URL und den optionalen Bearer-Token eintragen. Die App ruft dann live diesen Endpoint auf; wenn der Aufruf fehlschlägt oder kein Endpoint gesetzt ist, werden automatisch Sample-Daten angezeigt. Achte auf CORS-Freigaben, wenn du aus dem Browser heraus eine externe API nutzt.
Die eingetragene API-URL samt Token wird im Browser gespeichert, damit du sie nicht bei jedem Öffnen erneut eingeben musst (lokales `localStorage`).

### Beispiel: Proxy für Flightradar & Co.
Viele öffentliche Flugseiten blockieren direkte Browser-Zugriffe (CORS, Cookies, Rate-Limits). Baue deshalb einen kleinen Proxy, der die Daten serverseitig holt, glättet und ohne Auth nach außen reicht. Beispiel (Cloudflare Worker, stark vereinfacht – passe URL/Auth an die jeweilige Quelle an):

```js
export default {
  async fetch(request) {
    const url = new URL(request.url);
    const airport = url.searchParams.get("airport");
    const start = url.searchParams.get("start");
    const end = url.searchParams.get("end");

    // Beispiel-Call: hole JSON von einem eigenen Backend oder externen API,
    // mappe auf das erwartete Format.
    const upstream = await fetch(`https://your-backend.example.com/flights?airport=${airport}&start=${start}&end=${end}`);
    if (!upstream.ok) return new Response("Upstream error", { status: 502 });

    const data = await upstream.json();
    const flights = (data.flights || data || []).map((f) => ({
      flight_no: f.flight_no,
      airline: f.airline,
      airline_code: f.airline_code,
      aircraft_type: f.aircraft_type,
      direction: f.direction,
      gate: f.gate,
      stand: f.stand,
      description: f.description || "",
    }));

    return new Response(JSON.stringify({ flights }), {
      headers: { "content-type": "application/json" },
    });
  },
};
```

Diese Worker-URL trägst du dann in der UI als „Flug-API URL“ ein; optional kannst du einen Bearer-Token hinterlegen. Der Worker muss CORS erlauben, z.B. mit `Access-Control-Allow-Origin: *`.

## Eigener Proxy-Server (Express)
Der Ordner enthält jetzt einen kleinen Proxy (`server.js`), der wahlweise OpenSky (ohne Key), AviationStack (mit Key) oder AeroDataBox über RapidAPI (mit Key) anspricht. Er nimmt `airport`, `start`, `end`, `direction` entgegen, setzt CORS-Header und liefert `{ flights: [...] }` zurück.

### Lokale Nutzung
1. Abhängigkeiten installieren: `npm install`
2. Env-Datei kopieren/anpassen (Key bleibt lokal, kommt nicht ins Repo):
   ```bash
   cp .env.example .env
   # Danach in .env den echten Key setzen:
   # FLIGHT_PROVIDER=aerodatabox
   # AERODATABOX_API_KEY=<rapidapi-key>
   ```
   Alternativ per Shell-Variablen exportieren.
3. Optional:
   - `export FLIGHT_PROVIDER=aviationstack` und `export AVIATIONSTACK_API_KEY=<dein-key>` für AviationStack.
   - `export FLIGHT_PROVIDER=aerodatabox` und `export AERODATABOX_API_KEY=<rapidapi-key>` für AeroDataBox (RapidAPI). Optional kannst du `AERODATABOX_HOST` bzw. `AERODATABOX_BASE_URL` überschreiben, falls du einen anderen RapidAPI-Host nutzt.
   - Standard ist `opensky` (nutzt ICAO, z.B. EDDM statt MUC). Wenn `AERODATABOX_API_KEY` gesetzt ist, wird automatisch `aerodatabox` gewählt, sofern `FLIGHT_PROVIDER` leer ist.
4. Starten: `npm start` (lauscht auf Port 8788).
5. Test: `curl "http://localhost:8788/flights?airport=MUC&direction=departure"` – Zeitfenster wird automatisch auf ±30 Minuten gesetzt, wenn `start/end` fehlen.

### Deployment-Idee (Render / VM / Cloudflare)
- **Render/VM**: Repo deployen, Node 18+, `PORT` durch Plattform gesetzt, `FLIGHT_PROVIDER` und den passenden API-Key (`AVIATIONSTACK_API_KEY` oder `AERODATABOX_API_KEY`) als Secret hinterlegen.
- **Cloudflare Worker**: Falls du den Worker-Ansatz bevorzugst, kannst du die oben stehende Worker-Skizze nutzen oder den Express-Proxy in eine Worker-Route portieren. Wichtig: CORS `Access-Control-Allow-Origin: *` setzen und den API-Key als Secret speichern.
- **GitHub Pages (statisch)**: Der Browser kann Secrets nicht schützen. Für Pages musst du einen separaten Proxy/Worker deployen (z.B. Render/CF Worker) und in der UI nur dessen URL hinterlegen; den Key hältst du dort als Secret. Keys gehören nicht ins öffentliche Repo.

### In der UI nutzen
1. Proxy-HTTPS-URL (z.B. `https://dein-proxy.example.com/flights`) in der App im Feld „Flug-API URL“ eintragen.
2. Bearer-Token leer lassen, wenn der Proxy den Key serverseitig setzt.
3. Airport + Direction wählen und „Flüge laden“ klicken. Erfolgreicher Call zeigt eine echte Liste; per „Flug übernehmen“ werden Felder vorausgefüllt.
