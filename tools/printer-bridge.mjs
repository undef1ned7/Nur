#!/usr/bin/env node
/**
 * HTTP → RAW TCP bridge for Wi-Fi receipt printers (ESC/POS, port 9100).
 * Browser sends POST /print with { ip, port, data (base64) }; bridge forwards bytes to printer.
 */
import http from "node:http";
import net from "node:net";

const HOST = process.env.PRINTER_BRIDGE_HOST || "127.0.0.1";
const PORT = Number(process.env.PRINTER_BRIDGE_PORT || 5179);
const DEFAULT_PRINTER_PORT = 9100;
const DEFAULT_TIMEOUT_MS = 2000;

const IPV4_RE =
  /^(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)$/;

function sendJson(res, status, body) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function sendRawToPrinter(ip, port, data, timeoutMs = DEFAULT_TIMEOUT_MS) {
  return new Promise((resolve, reject) => {
    const socket = new net.Socket();
    let settled = false;

    const finish = (err) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      if (err) reject(err);
      else resolve();
    };

    socket.setTimeout(timeoutMs, () => {
      finish(new Error(`Printer connection timeout (${timeoutMs}ms)`));
    });

    socket.once("error", finish);
    socket.connect(port, ip, () => {
      socket.write(data, (writeErr) => {
        if (writeErr) {
          finish(writeErr);
          return;
        }
        socket.end(() => finish());
      });
    });
  });
}

async function handlePrint(req, res) {
  let raw;
  try {
    raw = await readBody(req);
  } catch (err) {
    return sendJson(res, 400, { ok: false, error: err.message });
  }

  let body;
  try {
    body = JSON.parse(raw || "{}");
  } catch {
    return sendJson(res, 400, { ok: false, error: "Invalid JSON body" });
  }

  const ip = String(body.ip || "").trim();
  const port = Number(body.port || DEFAULT_PRINTER_PORT);
  const timeoutMs = Number(body.timeoutMs || DEFAULT_TIMEOUT_MS);
  const dataBase64 = body.data;

  if (!IPV4_RE.test(ip)) {
    return sendJson(res, 400, { ok: false, error: "Invalid printer IP address" });
  }
  if (!Number.isFinite(port) || port < 1 || port > 65535) {
    return sendJson(res, 400, { ok: false, error: "Invalid printer port" });
  }
  if (typeof dataBase64 !== "string" || !dataBase64.trim()) {
    return sendJson(res, 400, { ok: false, error: "Missing base64 data" });
  }

  let bytes;
  try {
    bytes = Buffer.from(dataBase64, "base64");
  } catch {
    return sendJson(res, 400, { ok: false, error: "Invalid base64 data" });
  }

  if (!bytes.length) {
    return sendJson(res, 400, { ok: false, error: "Empty print payload" });
  }

  try {
    await sendRawToPrinter(ip, port, bytes, timeoutMs);
    return sendJson(res, 200, { ok: true });
  } catch (err) {
    return sendJson(res, 502, {
      ok: false,
      error: err?.message || "Failed to send data to printer",
    });
  }
}

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    });
    return res.end();
  }

  if (req.method === "GET" && req.url === "/health") {
    return sendJson(res, 200, { ok: true, service: "printer-bridge" });
  }

  if (req.method === "POST" && (req.url === "/print" || req.url === "/print/")) {
    return handlePrint(req, res);
  }

  sendJson(res, 404, { ok: false, error: "Not found" });
});

server.listen(PORT, HOST, () => {
  console.log(`printer-bridge listening on http://${HOST}:${PORT}/print`);
});

server.on("error", (err) => {
  console.error("printer-bridge failed to start:", err.message);
  process.exit(1);
});
