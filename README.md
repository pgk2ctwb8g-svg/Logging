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
