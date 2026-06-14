const http = require("http");
const crypto = require("crypto");
const fs = require("fs");
const net = require("net");
const path = require("path");
const tls = require("tls");

const port = process.env.PORT || 3000;
const root = __dirname;
const dataFile = path.join(root, "sn-data.json");
const adminUser = process.env.ADMIN_USER || "adminpro";
const adminPassword = process.env.ADMIN_PASSWORD || "Zynek2541";
const sessionTimeoutMs = 2 * 60 * 60 * 1000;
const notificationEmail = "Yootthasak.ra@prosecure.co.th";
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
  return clean;
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

function getAdminSession(req) {
  const token = cookies(req).sn_admin;
  if (!token) return null;
  const session = sessions.get(token);
  if (!session) return null;
  if (Date.now() - session.lastSeen > sessionTimeoutMs) {
    sessions.delete(token);
    return null;
  }
  session.lastSeen = Date.now();
  return { token, session };
}

function isAdmin(req) {
  return Boolean(getAdminSession(req));
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

function smtpLine(socket) {
  return new Promise((resolve, reject) => {
    let buffer = "";
    const onData = (chunk) => {
      buffer += chunk.toString("utf8");
      const lines = buffer.split(/\r?\n/).filter(Boolean);
      if (!lines.length) return;
      const last = lines[lines.length - 1];
      if (/^\d{3} /.test(last)) {
        cleanup();
        resolve(buffer);
      }
    };
    const onError = (error) => {
      cleanup();
      reject(error);
    };
    const cleanup = () => {
      socket.off("data", onData);
      socket.off("error", onError);
    };
    socket.on("data", onData);
    socket.on("error", onError);
  });
}

async function smtpCommand(socket, command, expected = /^[23]/) {
  if (command) socket.write(`${command}\r\n`);
  const response = await smtpLine(socket);
  if (!expected.test(response)) throw new Error(`SMTP error: ${response.trim()}`);
  return response;
}

function smtpConnect({ host, port, secure }) {
  return new Promise((resolve, reject) => {
    const socket = secure
      ? tls.connect({ host, port, servername: host }, () => resolve(socket))
      : net.connect({ host, port }, () => resolve(socket));
    socket.once("error", reject);
  });
}

async function sendSmtpMail({ to, subject, text }) {
  const host = process.env.SMTP_HOST;
  if (!host) {
    console.log(`Email notification skipped. Set SMTP_HOST to send updates to ${to}.`);
    return;
  }

  const portNumber = Number(process.env.SMTP_PORT || 587);
  const secure = String(process.env.SMTP_SECURE || "").toLowerCase() === "true" || portNumber === 465;
  const user = process.env.SMTP_USER || "";
  const pass = process.env.SMTP_PASS || "";
  const from = process.env.SMTP_FROM || user || notificationEmail;
  let socket = await smtpConnect({ host, port: portNumber, secure });

  await smtpCommand(socket, null);
  await smtpCommand(socket, `EHLO ${process.env.COMPUTERNAME || "sn-warranty-system"}`);

  if (!secure && String(process.env.SMTP_STARTTLS || "true").toLowerCase() !== "false") {
    await smtpCommand(socket, "STARTTLS", /^220/);
    socket = tls.connect({ socket, servername: host });
    await new Promise((resolve, reject) => {
      socket.once("secureConnect", resolve);
      socket.once("error", reject);
    });
    await smtpCommand(socket, `EHLO ${process.env.COMPUTERNAME || "sn-warranty-system"}`);
  }

  if (user && pass) {
    await smtpCommand(socket, "AUTH LOGIN", /^334/);
    await smtpCommand(socket, Buffer.from(user).toString("base64"), /^334/);
    await smtpCommand(socket, Buffer.from(pass).toString("base64"), /^235/);
  }

  const encodedSubject = `=?UTF-8?B?${Buffer.from(subject, "utf8").toString("base64")}?=`;
  const message = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${encodedSubject}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=utf-8",
    "",
    text
  ].join("\r\n");

  await smtpCommand(socket, `MAIL FROM:<${from}>`);
  await smtpCommand(socket, `RCPT TO:<${to}>`);
  await smtpCommand(socket, "DATA", /^354/);
  await smtpCommand(socket, `${message.replace(/\r?\n\./g, "\r\n..")}\r\n.`, /^250/);
  await smtpCommand(socket, "QUIT", /^221/);
  socket.end();
}

function notifyDataChanged(data, req) {
  const subject = "SN Warranty System: มีการแก้ไขข้อมูล";
  const text = [
    "มีการบันทึก/แก้ไขข้อมูลในระบบ SN Warranty System",
    "",
    `เวลา: ${new Date().toLocaleString("th-TH", { timeZone: "Asia/Bangkok" })}`,
    `ผู้ใช้งาน: ${adminUser}`,
    `จำนวน SN ทั้งหมด: ${data.products.length}`,
    `จำนวนรหัสสินค้า: ${data.models.length}`,
    `IP: ${req.socket.remoteAddress || "-"}`,
    "",
    "หมายเหตุ: หากยังไม่ได้ตั้งค่า SMTP_HOST / SMTP_USER / SMTP_PASS ระบบจะบันทึกแจ้งเตือนในหน้าต่างเซิร์ฟเวอร์แทนการส่งอีเมลจริง"
  ].join("\n");

  sendSmtpMail({ to: notificationEmail, subject, text }).catch((error) => {
    console.error("Email notification failed:", error.message);
  });
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
        if (payload.username !== adminUser || payload.password !== adminPassword) {
          sendJson(res, 403, { ok: false, error: "Invalid username or password" });
          return;
        }
        const token = crypto.randomBytes(32).toString("hex");
        sessions.set(token, { lastSeen: Date.now() });
        res.writeHead(200, {
          "Content-Type": "application/json; charset=utf-8",
          "Cache-Control": "no-store",
          "Set-Cookie": `sn_admin=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=7200`
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
        const data = writeData(JSON.parse(body || "{}"));
        sendJson(res, 200, { ok: true });
        notifyDataChanged(data, req);
      } catch {
        sendJson(res, 400, { ok: false, error: "Invalid JSON" });
      }
    });
    return;
  }

  if (url.pathname === "/admin") {
    res.writeHead(302, { Location: "/" });
    res.end();
    return;
  }

  if (url.pathname === "/" || url.pathname === "/index.html") {
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
