const crypto = require("crypto");
const fs = require("fs");
const http = require("http");
const os = require("os");
const path = require("path");

const root = __dirname;
const port = Number(process.env.MOLDELAB_SCANNER_PORT || 8787);
const desktops = new Set();
const mobiles = new Set();

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".jpg": "image/jpeg",
  ".png": "image/png",
};

function localAddress() {
  const interfaces = os.networkInterfaces();
  for (const entries of Object.values(interfaces)) {
    for (const item of entries || []) {
      if (item.family === "IPv4" && !item.internal) return item.address;
    }
  }
  return "127.0.0.1";
}

function mobileUrl() {
  return `http://${localAddress()}:${port}/mobile-scanner.html`;
}

function sendWs(socket, payload) {
  if (socket.destroyed) return;
  const data = Buffer.from(typeof payload === "string" ? payload : JSON.stringify(payload));
  let header;
  if (data.length < 126) {
    header = Buffer.from([0x81, data.length]);
  } else if (data.length < 65536) {
    header = Buffer.alloc(4);
    header[0] = 0x81;
    header[1] = 126;
    header.writeUInt16BE(data.length, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x81;
    header[1] = 127;
    header.writeBigUInt64BE(BigInt(data.length), 2);
  }
  socket.write(Buffer.concat([header, data]));
}

function readWsFrames(buffer) {
  const messages = [];
  let offset = 0;
  while (offset + 2 <= buffer.length) {
    const byte1 = buffer[offset];
    const byte2 = buffer[offset + 1];
    let length = byte2 & 0x7f;
    let cursor = offset + 2;
    if (length === 126) {
      if (cursor + 2 > buffer.length) break;
      length = buffer.readUInt16BE(cursor);
      cursor += 2;
    } else if (length === 127) {
      if (cursor + 8 > buffer.length) break;
      length = Number(buffer.readBigUInt64BE(cursor));
      cursor += 8;
    }
    const masked = Boolean(byte2 & 0x80);
    const mask = masked ? buffer.subarray(cursor, cursor + 4) : null;
    if (masked) cursor += 4;
    if (cursor + length > buffer.length) break;
    const payload = Buffer.from(buffer.subarray(cursor, cursor + length));
    if (masked) {
      for (let index = 0; index < payload.length; index += 1) payload[index] ^= mask[index % 4];
    }
    if ((byte1 & 0x0f) === 1) messages.push(payload.toString("utf8"));
    offset = cursor + length;
  }
  return { messages, remaining: buffer.subarray(offset) };
}

function routeWs(socket, role, raw) {
  const targets = role === "mobile" ? desktops : mobiles;
  for (const target of targets) sendWs(target, raw);
}

function acceptWebSocket(request, socket, role) {
  const key = request.headers["sec-websocket-key"];
  const accept = crypto.createHash("sha1").update(`${key}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`).digest("base64");
  socket.write(
    "HTTP/1.1 101 Switching Protocols\r\n" +
      "Upgrade: websocket\r\n" +
      "Connection: Upgrade\r\n" +
      `Sec-WebSocket-Accept: ${accept}\r\n\r\n`,
  );
  const group = role === "mobile" ? mobiles : desktops;
  group.add(socket);
  socket.wsBuffer = Buffer.alloc(0);
  socket.on("data", (chunk) => {
    socket.wsBuffer = Buffer.concat([socket.wsBuffer, chunk]);
    const result = readWsFrames(socket.wsBuffer);
    socket.wsBuffer = result.remaining;
    result.messages.forEach((message) => routeWs(socket, role, message));
  });
  socket.on("close", () => group.delete(socket));
  socket.on("error", () => group.delete(socket));
  if (role === "mobile") routeWs(socket, "mobile", JSON.stringify({ type: "phone-status", message: "Celular conectado ao app Windows." }));
}

const server = http.createServer((request, response) => {
  const url = new URL(request.url, `http://${request.headers.host}`);
  if (url.pathname === "/scanner-info.json") {
    response.writeHead(200, { "Content-Type": mimeTypes[".json"] });
    response.end(JSON.stringify({ mobileUrl: mobileUrl() }));
    return;
  }
  const requestedPath = url.pathname === "/" ? "/index.html" : url.pathname;
  const filePath = path.normalize(path.join(root, requestedPath));
  if (!filePath.startsWith(root)) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }
  fs.readFile(filePath, (error, content) => {
    if (error) {
      response.writeHead(404);
      response.end("Not found");
      return;
    }
    response.writeHead(200, { "Content-Type": mimeTypes[path.extname(filePath).toLowerCase()] || "application/octet-stream" });
    response.end(content);
  });
});

server.on("upgrade", (request, socket) => {
  const url = new URL(request.url, `http://${request.headers.host}`);
  if (url.pathname === "/ws/mobile") return acceptWebSocket(request, socket, "mobile");
  if (url.pathname === "/ws/desktop") return acceptWebSocket(request, socket, "desktop");
  socket.destroy();
});

server.listen(port, "0.0.0.0", () => {
  console.log(`MoldeLab local: http://localhost:${port}`);
  console.log(`Scanner mobile: ${mobileUrl()}`);
  console.log("Abra o MoldeLab pelo endereco local e leia o QR Code pelo celular.");
});
