import http from "node:http";
import net from "node:net";

const PORT = Number(process.env.PRINTER_BRIDGE_PORT || 5179);
const HOST = process.env.PRINTER_BRIDGE_HOST || "127.0.0.1";

function setCors(res, origin) {
  // Dev-friendly: allow any origin (local LAN printing bridge)
  res.setHeader("Access-Control-Allow-Origin", origin || "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Max-Age", "86400");
}

function readJsonBody(req, limitBytes = 2 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", (c) => {
      size += c.length;
      if (size > limitBytes) {
        reject(new Error("Body too large"));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on("end", () => {
      try {
        const raw = Buffer.concat(chunks).toString("utf8");
        resolve(raw ? JSON.parse(raw) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on("error", reject);
  });
}

function isValidIp(ip) {
  // Simple IPv4 validation (enough for LAN printers)
  return /^(\d{1,3}\.){3}\d{1,3}$/.test(ip || "");
}

async function sendRawToPrinter({ ip, port, dataBase64, timeoutMs = 2000 }) {
  if (!isValidIp(ip)) throw new Error("Invalid ip");
  const p = Number(port || 9100);
  if (!Number.isFinite(p) || p <= 0 || p > 65535) throw new Error("Invalid port");

  const buf = Buffer.from(String(dataBase64 || ""), "base64");
  if (!buf.length) throw new Error("Empty data");

  await new Promise((resolve, reject) => {
    const socket = net.createConnection({ host: ip, port: p });
    const t = setTimeout(() => {
      socket.destroy(new Error("Timeout"));
    }, timeoutMs);

    socket.on("connect", () => {
      socket.write(buf);
      socket.end();
    });
    socket.on("error", (e) => {
      clearTimeout(t);
      reject(e);
    });
    socket.on("close", (hadError) => {
      clearTimeout(t);
      if (hadError) return;
      resolve();
    });
  });
}

const server = http.createServer(async (req, res) => {
  const origin = req.headers.origin;
  setCors(res, origin);

  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (req.method === "GET" && req.url === "/health") {
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  if (req.method !== "POST" || req.url !== "/print") {
    res.statusCode = 404;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ ok: false, error: "Not found" }));
    return;
  }

  try {
    const body = await readJsonBody(req);
    await sendRawToPrinter({
      ip: body?.ip,
      port: body?.port,
      dataBase64: body?.data,
      timeoutMs: Number(body?.timeoutMs || 2000),
    });
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ ok: true }));
  } catch (e) {
    res.statusCode = 400;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ ok: false, error: String(e?.message || e) }));
  }
});

server.listen(PORT, HOST, () => {
  // eslint-disable-next-line no-console
  console.log(`[printer-bridge] listening on http://${HOST}:${PORT}/print`);
});

