// Tiny zero-dependency server so every phone/laptop sees the same total.
// Run with:  node server.js      (then open http://<this-computer's-IP>:3000)
const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, "count.json");
const LOG_FILE = path.join(__dirname, "log.json");
const STATIC = {
  "/": "index.html",
  "/index.html": "index.html",
  "/log": "log.html",
  "/log.html": "log.html",
  "/style.css": "style.css",
  "/common.js": "common.js",
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

const state = readJson(DATA_FILE, {});
let count = Number.isInteger(state.count) ? state.count : 0;
let church = typeof state.church === "string" ? state.church : "";
let entries = readJson(LOG_FILE, { entries: [] }).entries || [];

// Write to a temp file then rename, so a crash mid-write can't corrupt the data.
function writeJson(file, obj) {
  const tmp = file + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(obj, null, 2));
  fs.renameSync(tmp, file);
}
const saveState = () => writeJson(DATA_FILE, { count, church });
const saveLog = () => writeJson(LOG_FILE, { entries });

function sendJson(res, status, obj) {
  res.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store" });
  res.end(JSON.stringify(obj));
}

function readBody(req, res, handler) {
  let body = "";
  req.on("data", (c) => { body += c; if (body.length > 2000) req.destroy(); });
  req.on("end", () => {
    let data;
    try { data = JSON.parse(body); } catch (e) { return sendJson(res, 400, { error: "Bad request" }); }
    if (!data || typeof data !== "object") return sendJson(res, 400, { error: "Bad request" });
    handler(data);
  });
}

const cleanChurch = (s) => (typeof s === "string" ? s.trim().slice(0, 80) : "");
const validDate = (s) => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s));

http.createServer((req, res) => {
  const url = req.url.split("?")[0];

  if (url === "/api/count") {
    if (req.method === "GET") return sendJson(res, 200, { count, church });
    if (req.method === "POST") {
      return readBody(req, res, (data) => {
        if (Number.isInteger(data.set) && data.set >= 0) count = data.set;
        else if (data.delta === 1 || data.delta === -1) count = Math.max(0, count + data.delta);
        else if (typeof data.church === "string") church = cleanChurch(data.church);
        else return sendJson(res, 400, { error: "Bad request" });
        saveState();
        sendJson(res, 200, { count, church });
      });
    }
    return sendJson(res, 405, { error: "Method not allowed" });
  }

  if (url === "/api/log") {
    if (req.method === "GET") return sendJson(res, 200, { entries });
    if (req.method === "POST") {
      return readBody(req, res, (data) => {
        const name = cleanChurch(data.church);
        if (!name) return sendJson(res, 400, { error: "Enter the church name." });
        if (!validDate(data.date)) return sendJson(res, 400, { error: "Pick a valid date." });
        if (!Number.isInteger(data.total) || data.total < 0) return sendJson(res, 400, { error: "Bad total." });
        // One row per church per day: saving again updates it.
        const existing = entries.find((e) => e.date === data.date && e.church.toLowerCase() === name.toLowerCase());
        if (existing) {
          existing.total = data.total;
          existing.church = name;
          existing.savedAt = new Date().toISOString();
        } else {
          entries.push({ id: crypto.randomUUID(), church: name, date: data.date, total: data.total, savedAt: new Date().toISOString() });
        }
        saveLog();
        sendJson(res, 200, { ok: true, updated: !!existing });
      });
    }
    return sendJson(res, 405, { error: "Method not allowed" });
  }

  if (url === "/api/log/delete" && req.method === "POST") {
    return readBody(req, res, (data) => {
      const before = entries.length;
      entries = entries.filter((e) => e.id !== data.id);
      if (entries.length === before) return sendJson(res, 404, { error: "Already deleted." });
      saveLog();
      sendJson(res, 200, { ok: true });
    });
  }

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
