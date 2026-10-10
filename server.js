// Tiny zero-dependency server so every phone/laptop sees the same total.
// Run with:  node server.js      (then open http://<this-computer's-IP>:3000)
const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, "count.json");
const STATIC = { "/": "index.html", "/index.html": "index.html", "/logo.png": "logo.png" };
const TYPES = { ".html": "text/html; charset=utf-8", ".png": "image/png" };

let count = 0;
try {
  count = JSON.parse(fs.readFileSync(DATA_FILE, "utf8")).count || 0;
} catch (e) {}

function save() {
  fs.writeFile(DATA_FILE, JSON.stringify({ count }), () => {});
}

function sendJson(res, status, obj) {
  res.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store" });
  res.end(JSON.stringify(obj));
}

http.createServer((req, res) => {
  const url = req.url.split("?")[0];

  if (url === "/api/count") {
    if (req.method === "GET") return sendJson(res, 200, { count });
    if (req.method === "POST") {
      let body = "";
      req.on("data", (c) => { body += c; if (body.length > 1000) req.destroy(); });
      req.on("end", () => {
        let data;
        try { data = JSON.parse(body); } catch (e) { return sendJson(res, 400, { error: "bad json" }); }
        if (Number.isInteger(data.set) && data.set >= 0) count = data.set;
        else if (data.delta === 1 || data.delta === -1) count = Math.max(0, count + data.delta);
        else return sendJson(res, 400, { error: "bad request" });
        save();
        sendJson(res, 200, { count });
      });
      return;
    }
    return sendJson(res, 405, { error: "method not allowed" });
  }

  const file = STATIC[url];
  if (!file) { res.writeHead(404); return res.end("Not found"); }
  fs.readFile(path.join(__dirname, file), (err, buf) => {
    if (err) { res.writeHead(404); return res.end("Not found"); }
    res.writeHead(200, { "Content-Type": TYPES[path.extname(file)] });
    res.end(buf);
  });
}).listen(PORT, () => {
  console.log(`Shoebox counter running at http://localhost:${PORT}`);
});
