// Shoebox counter server: church accounts with PINs, one live counter per church,
// and the packing log. No dependencies. Run with:  node server.js
const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, "data.json");
const LOG_FILE = path.join(__dirname, "log.json");

const MAX_ACTIVE = 5;                    // churches packing at the same time
const REMEMBER_MS = 72 * 60 * 60 * 1000; // how long a device stays signed in after choosing new/continue
const UNDECIDED_MS = 60 * 60 * 1000;     // a sign-in that hasn't chosen new/continue yet
const MAX_PIN_TRIES = 5;
const LOCK_MS = 5 * 60 * 1000;

const STATIC = {
  "/": "index.html",
  "/index.html": "index.html",
  "/log": "log.html",
  "/log.html": "log.html",
  "/history": "history.html",
  "/history.html": "history.html",
  "/style.css": "style.css",
  "/common.js": "common.js",
  "/effects.js": "effects.js",
  "/logo.png": "logo.png"
};
const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".png": "image/png"
};

function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch (e) { return fallback; }
}
// Write to a temp file then rename, so a crash mid-write can't corrupt the data.
function writeJson(file, obj) {
  const tmp = file + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(obj, null, 2));
  fs.renameSync(tmp, file);
}

// data.json: { churches: [{ id, name, salt, pinHash, session }], tokens: { token: { churchId, decided, expires } } }
// session:   { id, count, goal, date, startedAt, lastActive, ended }
const data = readJson(DATA_FILE, {});
data.churches = data.churches || [];
data.tokens = data.tokens || {};
let entries = readJson(LOG_FILE, { entries: [] }).entries || [];

const saveData = () => writeJson(DATA_FILE, data);
const saveLog = () => writeJson(LOG_FILE, { entries });

const failedPins = {}; // churchId -> { count, until }

const hashPin = (pin, salt) => crypto.scryptSync(pin, salt, 32).toString("hex");
const cleanName = (s) => (typeof s === "string" ? s.trim().replace(/\s+/g, " ").slice(0, 80) : "");
const validPin = (p) => typeof p === "string" && /^\d{4,8}$/.test(p);
const validDate = (s) => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s));
const validGoal = (g) => Number.isInteger(g) && g >= 1 && g <= 100000;
const findChurch = (id) => data.churches.find((c) => c.id === id);
const nameTaken = (name, exceptId) =>
  data.churches.some((c) => c.id !== exceptId && c.name.toLowerCase() === name.toLowerCase());

// A session counts as running until it's finished or nobody has touched it for 72 hours.
function isActive(c) {
  const s = c.session;
  return !!(s && !s.ended && Date.now() - s.lastActive < REMEMBER_MS);
}

function publicSession(c) {
  if (!isActive(c)) return null;
  const s = c.session;
  return { id: s.id, count: s.count, goal: s.goal, date: s.date, startedAt: s.startedAt };
}

// The log keeps one row per session, updated as the count changes.
function syncLog(c) {
  const s = c.session;
  if (!s) return;
  let row = entries.find((e) => e.sessionId === s.id);
  if (!row) {
    if (s.count === 0) return; // don't log empty sessions
    row = { id: crypto.randomUUID(), sessionId: s.id };
    entries.push(row);
  }
  row.churchId = c.id;
  row.church = c.name;
  row.date = s.date;
  row.total = s.count;
  row.goal = s.goal;
  row.savedAt = new Date().toISOString();
  saveLog();
}

function issueToken(churchId) {
  const now = Date.now();
  for (const t of Object.keys(data.tokens)) {
    if (data.tokens[t].expires < now || !findChurch(data.tokens[t].churchId)) delete data.tokens[t];
  }
  const token = crypto.randomBytes(24).toString("hex");
  data.tokens[token] = { churchId, decided: false, expires: now + UNDECIDED_MS };
  return token;
}

function auth(req) {
  const m = /^Bearer ([0-9a-f]{48})$/.exec(req.headers.authorization || "");
  const t = m && data.tokens[m[1]];
  if (!t || t.expires < Date.now()) return null;
  const church = findChurch(t.churchId);
  return church ? { token: m[1], t, church } : null;
}

function me(a) {
  return {
    church: { id: a.church.id, name: a.church.name },
    session: publicSession(a.church),
    decided: a.t.decided,
    expires: a.t.expires
  };
}

function sendJson(res, status, obj) {
  res.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store" });
  res.end(JSON.stringify(obj));
}

function readBody(req, res, handler) {
  let body = "";
  req.on("data", (c) => { body += c; if (body.length > 4000) req.destroy(); });
  req.on("end", () => {
    let parsed;
    try { parsed = body ? JSON.parse(body) : {}; } catch (e) { return sendJson(res, 400, { error: "Bad request." }); }
    if (!parsed || typeof parsed !== "object") return sendJson(res, 400, { error: "Bad request." });
    handler(parsed);
  });
}

const routes = {
  // Church list for the sign-in screen and the TV picker.
  "GET /api/churches": (req, res) => {
    sendJson(res, 200, {
      churches: data.churches
        .map((c) => ({ id: c.id, name: c.name, active: isActive(c) }))
        .sort((a, b) => a.name.localeCompare(b.name))
    });
  },

  "POST /api/signup": (req, res, body) => {
    const name = cleanName(body.name);
    if (!name) return sendJson(res, 400, { error: "Enter the church name." });
    if (nameTaken(name)) return sendJson(res, 409, { error: "That church already has an account. Sign in instead." });
    if (!validPin(body.pin)) return sendJson(res, 400, { error: "The PIN must be 4 to 8 numbers." });
    const salt = crypto.randomBytes(16).toString("hex");
    const church = { id: crypto.randomUUID(), name, salt, pinHash: hashPin(body.pin, salt), session: null };
    data.churches.push(church);
    const token = issueToken(church.id);
    saveData();
    sendJson(res, 200, { token, ...me({ church, t: data.tokens[token] }) });
  },

  "POST /api/login": (req, res, body) => {
    const church = findChurch(body.churchId);
    if (!church) return sendJson(res, 404, { error: "Pick your church from the list." });
    const now = Date.now();
    let rec = failedPins[church.id];
    if (rec && rec.until > now) {
      const mins = Math.ceil((rec.until - now) / 60000);
      return sendJson(res, 429, { error: `Too many wrong PINs. Try again in ${mins} minute${mins === 1 ? "" : "s"}.` });
    }
    const ok = typeof body.pin === "string" &&
      crypto.timingSafeEqual(Buffer.from(hashPin(body.pin, church.salt), "hex"), Buffer.from(church.pinHash, "hex"));
    if (!ok) {
      if (!rec || rec.until) rec = { count: 0, until: 0 }; // fresh count after a lockout ends
      rec.count += 1;
      if (rec.count >= MAX_PIN_TRIES) rec.until = now + LOCK_MS;
      failedPins[church.id] = rec;
      return sendJson(res, 401, { error: "That PIN isn't right." });
    }
    delete failedPins[church.id];
    const token = issueToken(church.id);
    saveData();
    sendJson(res, 200, { token, ...me({ church, t: data.tokens[token] }) });
  },

  "GET /api/me": (req, res, body, a) => sendJson(res, 200, me(a)),

  "POST /api/logout": (req, res, body, a) => {
    delete data.tokens[a.token];
    saveData();
    sendJson(res, 200, { ok: true });
  },

  // Start a new packing session. Any earlier session is finished (it's already in the log).
  "POST /api/session/start": (req, res, body, a) => {
    const name = cleanName(body.name);
    if (!name) return sendJson(res, 400, { error: "Enter the church name." });
    if (nameTaken(name, a.church.id)) return sendJson(res, 409, { error: "Another church already uses that name." });
    if (!validGoal(body.goal)) return sendJson(res, 400, { error: "Enter a packing goal of at least 1 box." });
    if (!validDate(body.date)) return sendJson(res, 400, { error: "Bad date." });
    const others = data.churches.filter((c) => c.id !== a.church.id && isActive(c)).length;
    if (others >= MAX_ACTIVE) {
      return sendJson(res, 409, { error: `${MAX_ACTIVE} churches are already packing. One of them needs to finish their session first.` });
    }
    a.church.name = name;
    const now = Date.now();
    a.church.session = { id: crypto.randomUUID(), count: 0, goal: body.goal, date: body.date, startedAt: now, lastActive: now, ended: false };
    a.t.decided = true;
    a.t.expires = now + REMEMBER_MS;
    saveData();
    sendJson(res, 200, me(a));
  },

  "POST /api/session/continue": (req, res, body, a) => {
    if (!publicSession(a.church)) return sendJson(res, 409, { error: "There's no session to continue. Start a new one." });
    a.church.session.lastActive = Date.now();
    a.t.decided = true;
    a.t.expires = Date.now() + REMEMBER_MS;
    saveData();
    sendJson(res, 200, me(a));
  },

  "POST /api/session/goal": (req, res, body, a) => {
    if (!publicSession(a.church)) return sendJson(res, 409, { error: "No session running." });
    if (!validGoal(body.goal)) return sendJson(res, 400, { error: "Enter a packing goal of at least 1 box." });
    a.church.session.goal = body.goal;
    saveData();
    syncLog(a.church);
    sendJson(res, 200, me(a));
  },

  // Finish packing: the session stays in the log and this device signs out.
  "POST /api/session/finish": (req, res, body, a) => {
    if (a.church.session) a.church.session.ended = true;
    delete data.tokens[a.token];
    saveData();
    sendJson(res, 200, { ok: true });
  },

  "POST /api/count": (req, res, body, a) => {
    if (!publicSession(a.church)) return sendJson(res, 409, { error: "No session running. Start or continue one." });
    if (body.delta !== 1 && body.delta !== -1) return sendJson(res, 400, { error: "Bad request." });
    const s = a.church.session;
    s.count = Math.max(0, s.count + body.delta);
    s.lastActive = Date.now();
    saveData();
    syncLog(a.church);
    sendJson(res, 200, me(a));
  },

  "GET /api/log": (req, res) => sendJson(res, 200, { entries }),

  "POST /api/log/delete": (req, res, body) => {
    const before = entries.length;
    entries = entries.filter((e) => e.id !== body.id);
    if (entries.length === before) return sendJson(res, 404, { error: "Already deleted." });
    saveLog();
    sendJson(res, 200, { ok: true });
  }
};

const NEEDS_AUTH = new Set([
  "GET /api/me", "POST /api/logout", "POST /api/session/start", "POST /api/session/continue",
  "POST /api/session/goal", "POST /api/session/finish", "POST /api/count"
]);

http.createServer((req, res) => {
  const url = req.url.split("?")[0];

  // Public TV feed for one church: /api/tv/<churchId>
  const tv = /^\/api\/tv\/([0-9a-f-]{36})$/.exec(url);
  if (tv && req.method === "GET") {
    const c = findChurch(tv[1]);
    if (!c) return sendJson(res, 404, { error: "Church not found." });
    return sendJson(res, 200, { church: { id: c.id, name: c.name }, session: publicSession(c) });
  }

  const key = req.method + " " + url;
  const route = routes[key];
  if (route) {
    let a = null;
    if (NEEDS_AUTH.has(key)) {
      a = auth(req);
      if (!a) return sendJson(res, 401, { error: "Please sign in again.", signedOut: true });
    }
    if (req.method === "GET") return route(req, res, {}, a);
    return readBody(req, res, (body) => route(req, res, body, a));
  }
  if (url.startsWith("/api/")) return sendJson(res, 404, { error: "Not found." });

  const file = STATIC[url];
  if (!file) { res.writeHead(404); return res.end("Not found"); }
  fs.readFile(path.join(__dirname, file), (err, buf) => {
    if (err) { res.writeHead(404); return res.end("Not found"); }
    res.writeHead(200, { "Content-Type": TYPES[path.extname(file)], "Cache-Control": "no-cache" });
    res.end(buf);
  });
}).listen(PORT, () => {
  console.log(`Shoebox counter running at http://localhost:${PORT}`);
});
