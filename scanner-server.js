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

function qrSvg(text) {
  const version = 4;
  const size = 17 + version * 4;
  const dataCodewords = 80;
  const eccCodewords = 20;
  const modules = Array.from({ length: size }, () => Array(size).fill(false));
  const reserved = Array.from({ length: size }, () => Array(size).fill(false));
  const bytes = [...Buffer.from(text, "utf8")];

  function set(x, y, value, isReserved = true) {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    modules[y][x] = Boolean(value);
    if (isReserved) reserved[y][x] = true;
  }

  function finder(x, y) {
    for (let dy = -1; dy <= 7; dy += 1) {
      for (let dx = -1; dx <= 7; dx += 1) {
        const xx = x + dx;
        const yy = y + dy;
        if (xx < 0 || yy < 0 || xx >= size || yy >= size) continue;
        const dark = dx >= 0 && dx <= 6 && dy >= 0 && dy <= 6 && (dx === 0 || dx === 6 || dy === 0 || dy === 6 || (dx >= 2 && dx <= 4 && dy >= 2 && dy <= 4));
        set(xx, yy, dark);
      }
    }
  }

  function alignment(cx, cy) {
    for (let dy = -2; dy <= 2; dy += 1) {
      for (let dx = -2; dx <= 2; dx += 1) {
        set(cx + dx, cy + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
      }
    }
  }

  function pushBits(target, value, length) {
    for (let bit = length - 1; bit >= 0; bit -= 1) target.push((value >>> bit) & 1);
  }

  function gfTables() {
    const exp = Array(512).fill(0);
    const log = Array(256).fill(0);
    let value = 1;
    for (let index = 0; index < 255; index += 1) {
      exp[index] = value;
      log[value] = index;
      value <<= 1;
      if (value & 0x100) value ^= 0x11d;
    }
    for (let index = 255; index < 512; index += 1) exp[index] = exp[index - 255];
    return { exp, log };
  }

  const gf = gfTables();
  const gfMul = (a, b) => (a && b ? gf.exp[gf.log[a] + gf.log[b]] : 0);
  let generator = [1];
  for (let degree = 0; degree < eccCodewords; degree += 1) {
    const next = Array(generator.length + 1).fill(0);
    generator.forEach((coefficient, index) => {
      next[index] ^= coefficient;
      next[index + 1] ^= gfMul(coefficient, gf.exp[degree]);
    });
    generator = next;
  }

  const bits = [];
  pushBits(bits, 0b0100, 4);
  pushBits(bits, bytes.length, 8);
  bytes.forEach((byte) => pushBits(bits, byte, 8));
  const maxBits = dataCodewords * 8;
  pushBits(bits, 0, Math.min(4, maxBits - bits.length));
  while (bits.length % 8) bits.push(0);
  const data = [];
  for (let index = 0; index < bits.length; index += 8) {
    data.push(bits.slice(index, index + 8).reduce((total, bit) => (total << 1) | bit, 0));
  }
  for (let pad = 0; data.length < dataCodewords; pad += 1) data.push(pad % 2 ? 0x11 : 0xec);

  const ecc = Array(eccCodewords).fill(0);
  data.forEach((byte) => {
    const factor = byte ^ ecc[0];
    ecc.copyWithin(0, 1);
    ecc[eccCodewords - 1] = 0;
    for (let index = 0; index < eccCodewords; index += 1) ecc[index] ^= gfMul(generator[index + 1], factor);
  });
  const codeBits = [...data, ...ecc].flatMap((byte) => Array.from({ length: 8 }, (_, index) => (byte >>> (7 - index)) & 1));

  finder(0, 0);
  finder(size - 7, 0);
  finder(0, size - 7);
  alignment(26, 26);
  for (let index = 8; index < size - 8; index += 1) {
    set(index, 6, index % 2 === 0);
    set(6, index, index % 2 === 0);
  }
  set(8, size - 8, true);
  for (let index = 0; index < 9; index += 1) {
    if (index !== 6) {
      reserved[8][index] = true;
      reserved[index][8] = true;
    }
  }
  for (let index = 0; index < 8; index += 1) {
    reserved[8][size - 1 - index] = true;
    reserved[size - 1 - index][8] = true;
  }

  function maskBit(mask, x, y) {
    return [
      (x + y) % 2 === 0,
      y % 2 === 0,
      x % 3 === 0,
      (x + y) % 3 === 0,
      (Math.floor(y / 2) + Math.floor(x / 3)) % 2 === 0,
      ((x * y) % 2) + ((x * y) % 3) === 0,
      (((x * y) % 2) + ((x * y) % 3)) % 2 === 0,
      (((x + y) % 2) + ((x * y) % 3)) % 2 === 0,
    ][mask];
  }

  function applyData(mask) {
    const trial = modules.map((row) => [...row]);
    let bitIndex = 0;
    let upward = true;
    for (let x = size - 1; x > 0; x -= 2) {
      if (x === 6) x -= 1;
      for (let step = 0; step < size; step += 1) {
        const y = upward ? size - 1 - step : step;
        for (let dx = 0; dx < 2; dx += 1) {
          const xx = x - dx;
          if (reserved[y][xx]) continue;
          trial[y][xx] = Boolean(codeBits[bitIndex] || 0) !== maskBit(mask, xx, y);
          bitIndex += 1;
        }
      }
      upward = !upward;
    }
    return trial;
  }

  function penalty(matrix) {
    let total = 0;
    for (let y = 0; y < size; y += 1) {
      let runColor = matrix[y][0];
      let run = 1;
      for (let x = 1; x < size; x += 1) {
        if (matrix[y][x] === runColor) run += 1;
        else {
          if (run >= 5) total += run - 2;
          runColor = matrix[y][x];
          run = 1;
        }
      }
      if (run >= 5) total += run - 2;
    }
    for (let x = 0; x < size; x += 1) {
      let runColor = matrix[0][x];
      let run = 1;
      for (let y = 1; y < size; y += 1) {
        if (matrix[y][x] === runColor) run += 1;
        else {
          if (run >= 5) total += run - 2;
          runColor = matrix[y][x];
          run = 1;
        }
      }
      if (run >= 5) total += run - 2;
    }
    return total;
  }

  function formatBits(mask) {
    let dataValue = (1 << 3) | mask;
    let value = dataValue << 10;
    for (let bit = 14; bit >= 10; bit -= 1) {
      if ((value >>> bit) & 1) value ^= 0x537 << (bit - 10);
    }
    return (((dataValue << 10) | value) ^ 0x5412) & 0x7fff;
  }

  let bestMask = 0;
  let bestMatrix = applyData(0);
  let bestPenalty = penalty(bestMatrix);
  for (let mask = 1; mask < 8; mask += 1) {
    const trial = applyData(mask);
    const score = penalty(trial);
    if (score < bestPenalty) {
      bestMask = mask;
      bestMatrix = trial;
      bestPenalty = score;
    }
  }

  const fmt = formatBits(bestMask);
  const coords1 = [[8, 0], [8, 1], [8, 2], [8, 3], [8, 4], [8, 5], [8, 7], [8, 8], [7, 8], [5, 8], [4, 8], [3, 8], [2, 8], [1, 8], [0, 8]];
  const coords2 = [[size - 1, 8], [size - 2, 8], [size - 3, 8], [size - 4, 8], [size - 5, 8], [size - 6, 8], [size - 7, 8], [size - 8, 8], [8, size - 7], [8, size - 6], [8, size - 5], [8, size - 4], [8, size - 3], [8, size - 2], [8, size - 1]];
  coords1.forEach(([x, y], index) => { bestMatrix[y][x] = Boolean((fmt >>> index) & 1); });
  coords2.forEach(([x, y], index) => { bestMatrix[y][x] = Boolean((fmt >>> index) & 1); });

  const scale = 6;
  const quiet = 4;
  const rects = [];
  bestMatrix.forEach((row, y) => row.forEach((dark, x) => {
    if (dark) rects.push(`<rect x="${(x + quiet) * scale}" y="${(y + quiet) * scale}" width="${scale}" height="${scale}"/>`);
  }));
  const pixels = (size + quiet * 2) * scale;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${pixels}" height="${pixels}" viewBox="0 0 ${pixels} ${pixels}">
<rect width="100%" height="100%" fill="#fff"/>
<g fill="#000">${rects.join("")}</g>
</svg>`;
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
    response.end(JSON.stringify({ mobileUrl: mobileUrl(), qrUrl: "/scanner-qr.svg" }));
    return;
  }
  if (url.pathname === "/scanner-qr.svg") {
    response.writeHead(200, { "Content-Type": mimeTypes[".svg"], "Cache-Control": "no-store" });
    response.end(qrSvg(mobileUrl()));
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
