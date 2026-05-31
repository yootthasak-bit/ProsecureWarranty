const http = require("http");
const fs = require("fs");
const path = require("path");

const port = process.env.PORT || 3000;
const root = __dirname;
const dataFile = path.join(root, "sn-data.json");

function readData() {
  try {
    const data = JSON.parse(fs.readFileSync(dataFile, "utf8"));
    return {
      products: Array.isArray(data.products) ? data.products : [],
      models: Array.isArray(data.models) ? data.models : []
    };
  } catch {
    return { products: [], models: [] };
  }
}

function writeData(data) {
  const clean = {
    products: Array.isArray(data.products) ? data.products : [],
    models: Array.isArray(data.models) ? data.models : []
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

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname === "/api/data" && req.method === "GET") {
    sendJson(res, 200, readData());
    return;
  }

  if (url.pathname === "/api/data" && req.method === "PUT") {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 10_000_000) req.destroy();
    });
    req.on("end", () => {
      try {
        writeData(JSON.parse(body || "{}"));
        sendJson(res, 200, { ok: true });
      } catch {
        sendJson(res, 400, { ok: false, error: "Invalid JSON" });
      }
    });
    return;
  }

  if (url.pathname === "/" || url.pathname === "/index.html") {
    sendFile(res, path.join(root, "sn-barcode-system.html"), "text/html; charset=utf-8");
    return;
  }

  res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
  res.end("Not found");
});

server.listen(port, () => {
  console.log(`SN warranty system is running on http://localhost:${port}`);
});
