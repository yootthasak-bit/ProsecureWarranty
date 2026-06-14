const http = require("http");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const port = process.env.PORT || 3000;
const root = __dirname;
const dataFile = path.join(root, "sn-data.json");
const adminPassword = process.env.ADMIN_PASSWORD || "1234";
const sessions = new Map();

function readData() {
  try {
    const data = JSON.parse(fs.readFileSync(dataFile, "utf8"));
    return {
      products: Array.isArray(data.products) ? data.products : [],
      models: Array.isArray(data.models) ? data.models : [],
      lastUpdated: data.lastUpdated || 0
    };
  } catch {
    return { products: [], models: [], lastUpdated: 0 };
  }
}

function writeData(data) {
  const clean = {
    products: Array.isArray(data.products) ? data.products : [],
    models: Array.isArray(data.models) ? data.models : [],
    lastUpdated: data.lastUpdated || 0
  };
  fs.writeFileSync(dataFile, JSON.stringify(clean, null, 2), "utf8");
}

function sendJson(res, status, body) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  res.end(JSON.stringify(body));
}

function readBody(req, callback) {
  let body = "";
  req.on("data", (chunk) => {
    body += chunk;
    if (body.length > 10_000_000) req.destroy();
  });
  req.on("end", () => callback(body));
}

function cookies(req) {
  return Object.fromEntries((req.headers.cookie || "").split(";").map((item) => {
    const index = item.indexOf("=");
    if (index === -1) return ["", ""];
    return [
      decodeURIComponent(item.slice(0, index).trim()),
      decodeURIComponent(item.slice(index + 1).trim())
    ];
  }).filter(([key]) => key));
}

function isAdmin(req) {
  const token = cookies(req).sn_admin;
  return Boolean(token && sessions.has(token));
}

function requireAdmin(req, res) {
  if (isAdmin(req)) return true;
  sendJson(res, 401, { ok: false, error: "Admin login required" });
  return false;
}

function publicProduct(product) {
  if (!product) return null;
  return {
    sn: product.sn,
    productName: product.productName,
    material: product.material,
    size: product.size,
    voltage: product.voltage,
    status: product.status,
    companyName: product.companyName,
    customerName: product.customerName,
    customerType: product.customerType,
    installLocation: product.installLocation,
    installDate: product.installDate,
    warrantyStart: product.warrantyStart,
    warrantyEnd: product.warrantyEnd
  };
}

function sendFile(res, filePath, contentType) {
  fs.readFile(filePath, (error, content) => {
    if (error) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Not found");
      return;
    }
    res.writeHead(200, {
      "Content-Type": contentType,
      "Cache-Control": "no-store"
    });
    res.end(content);
  });
}

function contentTypeFor(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".svg") return "image/svg+xml";
  if (ext === ".css") return "text/css; charset=utf-8";
  if (ext === ".js") return "application/javascript; charset=utf-8";
  return "application/octet-stream";
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname === "/api/session" && req.method === "GET") {
    sendJson(res, 200, { authenticated: isAdmin(req) });
    return;
  }

  if (url.pathname === "/api/login" && req.method === "POST") {
    readBody(req, (body) => {
      try {
        const payload = JSON.parse(body || "{}");
        if (payload.password !== adminPassword) {
          sendJson(res, 403, { ok: false, error: "Invalid password" });
          return;
        }
        const token = crypto.randomBytes(32).toString("hex");
        sessions.set(token, Date.now());
        res.writeHead(200, {
          "Content-Type": "application/json; charset=utf-8",
          "Cache-Control": "no-store",
          "Set-Cookie": `sn_admin=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/`
        });
        res.end(JSON.stringify({ ok: true }));
      } catch {
        sendJson(res, 400, { ok: false, error: "Invalid JSON" });
      }
    });
    return;
  }

  if (url.pathname === "/api/logout" && req.method === "POST") {
    const token = cookies(req).sn_admin;
    if (token) sessions.delete(token);
    res.writeHead(200, {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "Set-Cookie": "sn_admin=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0"
    });
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  if (url.pathname === "/api/customer" && req.method === "GET") {
    const sn = (url.searchParams.get("sn") || "").trim();
    const product = readData().products.find((item) => item.sn === sn);
    sendJson(res, 200, { product: publicProduct(product) });
    return;
  }

  if (url.pathname === "/api/data" && req.method === "GET") {
    if (!requireAdmin(req, res)) return;
    sendJson(res, 200, readData());
    return;
  }

  if (url.pathname === "/api/data" && req.method === "PUT") {
    if (!requireAdmin(req, res)) return;
    readBody(req, (body) => {
      try {
        writeData(JSON.parse(body || "{}"));
        sendJson(res, 200, { ok: true });
      } catch {
        sendJson(res, 400, { ok: false, error: "Invalid JSON" });
      }
    });
    return;
  }

  if (url.pathname === "/" || url.pathname === "/index.html" || url.pathname === "/admin") {
    sendFile(res, path.join(root, "sn-barcode-system.html"), "text/html; charset=utf-8");
    return;
  }

  if (url.pathname.startsWith("/assets/")) {
    const assetName = decodeURIComponent(url.pathname.slice("/assets/".length));
    const assetsRoot = path.resolve(root, "assets");
    const filePath = path.resolve(assetsRoot, assetName);
    if (!filePath.startsWith(assetsRoot + path.sep)) {
      res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Forbidden");
      return;
    }
    sendFile(res, filePath, contentTypeFor(filePath));
    return;
  }

  res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
  res.end("Not found");
});

server.listen(port, () => {
  console.log(`SN warranty system is running on http://localhost:${port}`);
});
