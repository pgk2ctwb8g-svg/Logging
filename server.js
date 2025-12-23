require("dotenv").config();
const express = require("express");
const fetch = require("node-fetch");

const app = express();
const PORT = process.env.PORT || 8788;
const DEFAULT_PROVIDER = process.env.AERODATABOX_API_KEY ? "aerodatabox" : "opensky";
const PROVIDER = (process.env.FLIGHT_PROVIDER || DEFAULT_PROVIDER).toLowerCase();
const OPEN_SKY_BASE_URL = process.env.OPEN_SKY_BASE_URL || "https://opensky-network.org/api";
const AVIATIONSTACK_API_KEY = process.env.AVIATIONSTACK_API_KEY;
const AERODATABOX_API_KEY = process.env.AERODATABOX_API_KEY;
const AERODATABOX_HOST = process.env.AERODATABOX_HOST || "aerodatabox.p.rapidapi.com";
const AERODATABOX_BASE_URL = process.env.AERODATABOX_BASE_URL || `https://${AERODATABOX_HOST}`;

const AIRPORT_IATA_TO_ICAO = {
  MUC: "EDDM",
  FRA: "EDDF",
  BER: "EDDB",
  HAM: "EDDH",
  CGN: "EDDK",
  DUS: "EDDL",
  STR: "EDDS",
  NUE: "EDDN",
  LEJ: "EDDP",
  HAJ: "EDDV",
  DTM: "EDLW",
  FMM: "EDJA",
  ZRH: "LSZH",
  GVA: "LSGG",
  BSL: "LFSB",
  BRN: "LSZB",
  VIE: "LOWW",
  SZG: "LOWS",
  INN: "LOWI",
  AMS: "EHAM",
  LUX: "ELLX",
  PRG: "LKPR",
};

app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }
  next();
});

app.get("/health", (req, res) => {
  res.json({ status: "ok", provider: PROVIDER });
});

app.get("/flights", async (req, res) => {
  const airport = req.query.airport ? String(req.query.airport).trim().toUpperCase() : "";
  const direction = normalizeDirection(req.query.direction);
  const start = parseEpochSeconds(req.query.start) ?? defaultWindow().start;
  const end = parseEpochSeconds(req.query.end) ?? defaultWindow().end;
  const preferBoth = !req.query.direction || String(req.query.direction).toLowerCase() === "both";

  if (!airport) {
    return res.status(400).json({ error: "Missing airport query parameter." });
  }

  if (start >= end) {
    return res.status(400).json({ error: "Parameter 'start' must be before 'end'." });
  }

  try {
    const flights = await fetchFlights({ airport, direction, start, end, preferBoth });
    return res.json({ flights });
  } catch (error) {
    console.error("Flight proxy error", error);
    return res.status(502).json({ error: "Upstream error", details: error.message || "unknown" });
  }
});

function normalizeDirection(direction) {
  if (!direction) return "departure";
  const value = String(direction).toLowerCase();
  if (value === "both") return "both";
  return value === "arrival" ? "arrival" : "departure";
}

function parseEpochSeconds(value) {
  if (!value) return null;
  if (typeof value === "number") return Math.floor(value);

  const numeric = Number(value);
  if (!Number.isNaN(numeric)) {
    return numeric > 1e12 ? Math.floor(numeric / 1000) : Math.floor(numeric);
  }

  const parsedDate = Date.parse(value);
  if (!Number.isNaN(parsedDate)) {
    return Math.floor(parsedDate / 1000);
  }

  return null;
}

function defaultWindow() {
  const now = Math.floor(Date.now() / 1000);
  return { start: now - 30 * 60, end: now + 30 * 60 };
}

async function fetchFlights({ airport, direction, start, end, preferBoth }) {
  if (PROVIDER === "aerodatabox") {
    if (!AERODATABOX_API_KEY) {
      throw new Error("AERODATABOX_API_KEY not set for aerodatabox provider");
    }
    const providerDirection = preferBoth ? "both" : direction;
    return fetchAerodatabox({ airport, direction: providerDirection, start, end });
  }

  if (PROVIDER === "aviationstack") {
    if (!AVIATIONSTACK_API_KEY) {
      throw new Error("AVIATIONSTACK_API_KEY not set for aviationstack provider");
    }
    return fetchAviationStack({ airport, direction, start, end });
  }

  return fetchOpenSky({ airport, direction, start, end });
}

function toIcao(airport) {
  if (!airport) return "";
  if (airport.length === 4) return airport;
  return AIRPORT_IATA_TO_ICAO[airport] || airport;
}

async function fetchOpenSky({ airport, direction, start, end }) {
  const icaoAirport = toIcao(airport);
  const params = new URLSearchParams({
    airport: icaoAirport,
    begin: String(start),
    end: String(end),
  });
  const url = `${OPEN_SKY_BASE_URL}/flights/${direction}?${params.toString()}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`OpenSky responded with HTTP ${response.status}`);
  }
  const data = await response.json();
  const flights = Array.isArray(data) ? data : [];
  return flights.map((entry) => mapOpenSky(entry, direction));
}

function mapOpenSky(entry, direction) {
  const callsign = (entry.callsign || "").trim();
  const airlineCode = callsign ? callsign.slice(0, 3) : "";
  const departure = entry.estDepartureAirport || "";
  const arrival = entry.estArrivalAirport || "";

  return {
    flight_no: callsign || null,
    airline: airlineCode ? `Airline ${airlineCode}` : "",
    airline_code: airlineCode,
    aircraft_type: entry.icao24 || "",
    direction,
    gate: "",
    stand: "",
    description: buildOpenSkyDescription({ direction, departure, arrival, time: entry.lastSeen || entry.firstSeen }),
  };
}

function buildOpenSkyDescription({ direction, departure, arrival, time }) {
  const timeLabel = time ? new Date(time * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "";
  if (direction === "arrival") {
    return `Anflug ${arrival || "(n/a)"} aus ${departure || "Unbekannt"}${timeLabel ? `, zuletzt gesehen ${timeLabel}` : ""}.`;
  }
  return `Abflug ${departure || "(n/a)"} nach ${arrival || "Unbekannt"}${timeLabel ? `, zuletzt gesehen ${timeLabel}` : ""}.`;
}

async function fetchAviationStack({ airport, direction, start, end }) {
  const params = new URLSearchParams({
    access_key: AVIATIONSTACK_API_KEY,
    limit: "100",
  });

  if (direction === "arrival") {
    params.set("arr_iata", airport);
  } else {
    params.set("dep_iata", airport);
  }

  const url = `http://api.aviationstack.com/v1/flights?${params.toString()}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`AviationStack responded with HTTP ${response.status}`);
  }
  const data = await response.json();
  const flights = Array.isArray(data?.data) ? data.data : [];

  return flights
    .filter((item) => filterAviationStackByWindow(item, start, end, direction))
    .map((item) => mapAviationStack(item, direction));
}

function filterAviationStackByWindow(item, start, end, direction) {
  const timestamp = direction === "arrival" ? item?.arrival?.estimated || item?.arrival?.scheduled : item?.departure?.estimated || item?.departure?.scheduled;
  const parsed = parseEpochSeconds(timestamp);
  if (!parsed) return true;
  return parsed >= start && parsed <= end;
}

function mapAviationStack(entry, direction) {
  return {
    flight_no: entry?.flight?.iata || entry?.flight?.number || "",
    airline: entry?.airline?.name || "",
    airline_code: entry?.airline?.iata || "",
    aircraft_type: entry?.aircraft?.iata || entry?.aircraft?.icao || "",
    direction,
    gate: direction === "arrival" ? entry?.arrival?.gate || "" : entry?.departure?.gate || "",
    stand: "",
    description: buildAviationStackDescription(entry, direction),
  };
}

function buildAviationStackDescription(entry, direction) {
  const scheduled = direction === "arrival" ? entry?.arrival?.scheduled : entry?.departure?.scheduled;
  const label = scheduled ? new Date(scheduled).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "";
  const from = entry?.departure?.airport || entry?.departure?.iata || "";
  const to = entry?.arrival?.airport || entry?.arrival?.iata || "";
  if (direction === "arrival") {
    return `Anflug ${to || "(n/a)"} aus ${from || "Unbekannt"}${label ? `, ETA ${label}` : ""}.`;
  }
  return `Abflug ${from || "(n/a)"} nach ${to || "Unbekannt"}${label ? `, ETD ${label}` : ""}.`;
}

async function fetchAerodatabox({ airport, direction, start, end }) {
  const codeType = airport.length === 4 ? "icao" : "iata";
  const directionParam = direction === "arrival" ? "Arrival" : direction === "departure" ? "Departure" : "Both";
  const windowStart = formatLocalIsoMinutes(start);
  const windowEnd = formatLocalIsoMinutes(end);

  const params = new URLSearchParams({
    withLeg: "true",
    direction: directionParam,
    withCancelled: "false",
    withCodeshared: "true",
    withCargo: "false",
    withPrivate: "false",
    withLocation: "false",
  });

  const url = `${AERODATABOX_BASE_URL}/flights/airports/${codeType}/${airport}/${windowStart}/${windowEnd}?${params.toString()}`;
  const response = await fetch(url, {
    headers: {
      "X-RapidAPI-Key": AERODATABOX_API_KEY,
      "X-RapidAPI-Host": AERODATABOX_HOST,
    },
  });

  if (!response.ok) {
    throw new Error(`AeroDataBox responded with HTTP ${response.status}`);
  }

  const data = await response.json();
  const flights = [];

  if (direction !== "arrival" && Array.isArray(data?.departures)) {
    flights.push(...data.departures.map((entry) => mapAerodatabox(entry, "departure", airport)));
  }
  if (direction !== "departure" && Array.isArray(data?.arrivals)) {
    flights.push(...data.arrivals.map((entry) => mapAerodatabox(entry, "arrival", airport)));
  }

  return flights;
}

function formatLocalIsoMinutes(epochSeconds) {
  const date = new Date(epochSeconds * 1000);
  return date.toISOString().slice(0, 16);
}

function mapAerodatabox(entry, direction, airport) {
  const movement = direction === "arrival" ? entry.arrival : entry.departure;
  const counterpart = direction === "arrival" ? entry.departure : entry.arrival;
  const scheduledLocal = movement?.scheduledTime?.local || movement?.revisedTime?.local || "";
  const status = entry.status || entry.codeshareStatus || "";
  const fromAirport = counterpart?.airport?.iata || counterpart?.airport?.icao || "";
  const toAirport = direction === "arrival" ? airport : counterpart?.airport?.iata || counterpart?.airport?.icao || "";

  return {
    flight_no: entry.number || entry.callSign || "",
    airline: entry?.airline?.name || "",
    airline_code: entry?.airline?.iata || entry?.airline?.icao || "",
    aircraft_type: entry?.aircraft?.model || entry?.aircraft?.icao || entry?.aircraft?.reg || "",
    direction,
    gate: movement?.gate || "",
    stand: "",
    description: buildAerodataboxDescription({
      direction,
      fromAirport: direction === "arrival" ? fromAirport : airport,
      toAirport: direction === "arrival" ? airport : toAirport,
      scheduledLocal,
      status,
    }),
  };
}

function buildAerodataboxDescription({ direction, fromAirport, toAirport, scheduledLocal, status }) {
  const statusLabel = status ? ` (${status})` : "";
  const timeLabel = scheduledLocal ? `, geplant ${scheduledLocal}` : "";
  if (direction === "arrival") {
    return `Anflug ${toAirport} aus ${fromAirport || "Unbekannt"}${timeLabel}${statusLabel}.`;
  }
  return `Abflug ${fromAirport} nach ${toAirport || "Unbekannt"}${timeLabel}${statusLabel}.`;
}

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Flight proxy listening on port ${PORT} with provider ${PROVIDER}`);
  });
}

module.exports = { app };
