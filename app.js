const canvas = document.querySelector("#canvas");
const ctx = canvas.getContext("2d");

const ui = {
  fabricWidth: document.querySelector("#fabricWidth"),
  spacing: document.querySelector("#spacing"),
  vectorInput: document.querySelector("#vectorInput"),
  importStatus: document.querySelector("#importStatus"),
  autoNest: document.querySelector("#autoNest"),
  exportSvg: document.querySelector("#exportSvg"),
  modeMove: document.querySelector("#modeMove"),
  modePoints: document.querySelector("#modePoints"),
  modePan: document.querySelector("#modePan"),
  modeCalibrate: document.querySelector("#modeCalibrate"),
  modeTrace: document.querySelector("#modeTrace"),
  finishTrace: document.querySelector("#finishTrace"),
  zoomOut: document.querySelector("#zoomOut"),
  zoomIn: document.querySelector("#zoomIn"),
  resetView: document.querySelector("#resetView"),
  addPiece: document.querySelector("#addPiece"),
  imageInput: document.querySelector("#imageInput"),
  calibrationLength: document.querySelector("#calibrationLength"),
  digitizeStatus: document.querySelector("#digitizeStatus"),
  rotateLeft: document.querySelector("#rotateLeft"),
  rotateRight: document.querySelector("#rotateRight"),
  mirrorPiece: document.querySelector("#mirrorPiece"),
  rotation: document.querySelector("#rotation"),
  selectionName: document.querySelector("#selectionName"),
  usedLength: document.querySelector("#usedLength"),
  efficiency: document.querySelector("#efficiency"),
  collisions: document.querySelector("#collisions"),
};

const baseScale = 4;
const origin = { x: 56, y: 66 };
const fabricHeight = 158;
const view = { zoom: 1, panX: 0, panY: 0 };

let mode = "move";
let selectedId = "front";
let dragState = null;
let newPieceCount = 1;
let digitizedCount = 1;
let importedCount = 1;
let backgroundImage = null;
let background = null;
let calibrationPoints = [];
let tracePoints = [];

const pieces = [
  {
    id: "front",
    name: "Frente corpo",
    x: 16,
    y: 18,
    rotation: 0,
    mirrored: false,
    color: "#0f766e",
    points: [
      [0, 10],
      [12, 0],
      [35, 3],
      [45, 28],
      [42, 78],
      [6, 80],
      [0, 54],
    ],
  },
  {
    id: "back",
    name: "Costas corpo",
    x: 64,
    y: 20,
    rotation: 0,
    mirrored: false,
    color: "#2563eb",
    points: [
      [0, 8],
      [15, 0],
      [38, 6],
      [48, 35],
      [43, 82],
      [5, 78],
      [0, 48],
    ],
  },
  {
    id: "sleeve",
    name: "Manga",
    x: 112,
    y: 28,
    rotation: 0,
    mirrored: false,
    color: "#9333ea",
    points: [
      [0, 18],
      [22, 0],
      [48, 18],
      [43, 52],
      [8, 54],
    ],
  },
  {
    id: "collar",
    name: "Gola",
    x: 24,
    y: 110,
    rotation: 0,
    mirrored: false,
    color: "#ca8a04",
    points: [
      [0, 0],
      [64, 0],
      [68, 15],
      [5, 18],
    ],
  },
  {
    id: "waist",
    name: "Cos",
    x: 94,
    y: 118,
    rotation: 0,
    mirrored: false,
    color: "#dc2626",
    points: [
      [0, 0],
      [72, 0],
      [72, 16],
      [0, 16],
    ],
  },
];

function selectedPiece() {
  return pieces.find((piece) => piece.id === selectedId);
}

function centroid(points) {
  const total = points.reduce((acc, point) => [acc[0] + point[0], acc[1] + point[1]], [0, 0]);
  return [total[0] / points.length, total[1] / points.length];
}

function transformedPoints(piece) {
  const [cx, cy] = centroid(piece.points);
  const angle = (piece.rotation * Math.PI) / 180;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const flip = piece.mirrored ? -1 : 1;

  return piece.points.map(([px, py]) => {
    const localX = (px - cx) * flip;
    const localY = py - cy;
    const rx = localX * cos - localY * sin;
    const ry = localX * sin + localY * cos;
    return [piece.x + cx + rx, piece.y + cy + ry];
  });
}

function inverseTransformedPoint(piece, point) {
  const [cx, cy] = centroid(piece.points);
  const angle = (piece.rotation * Math.PI) / 180;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const flip = piece.mirrored ? -1 : 1;
  const dx = point[0] - piece.x - cx;
  const dy = point[1] - piece.y - cy;
  const localX = dx * cos + dy * sin;
  const localY = -dx * sin + dy * cos;
  return [cx + localX / flip, cy + localY];
}

function bounds(points) {
  const xs = points.map((point) => point[0]);
  const ys = points.map((point) => point[1]);
  return {
    minX: Math.min(...xs),
    minY: Math.min(...ys),
    maxX: Math.max(...xs),
    maxY: Math.max(...ys),
  };
}

function polygonArea(points) {
  let area = 0;
  for (let index = 0; index < points.length; index += 1) {
    const next = (index + 1) % points.length;
    area += points[index][0] * points[next][1] - points[next][0] * points[index][1];
  }
  return Math.abs(area / 2);
}

function pointInPolygon(point, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const xi = polygon[i][0];
    const yi = polygon[i][1];
    const xj = polygon[j][0];
    const yj = polygon[j][1];
    const intersects = yi > point[1] !== yj > point[1] && point[0] < ((xj - xi) * (point[1] - yi)) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

function lineSegmentsIntersect(a, b, c, d) {
  const det = (p, q, r) => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
  const d1 = det(a, b, c);
  const d2 = det(a, b, d);
  const d3 = det(c, d, a);
  const d4 = det(c, d, b);
  return d1 * d2 < 0 && d3 * d4 < 0;
}

function polygonsOverlap(a, b) {
  for (let i = 0; i < a.length; i += 1) {
    for (let j = 0; j < b.length; j += 1) {
      if (lineSegmentsIntersect(a[i], a[(i + 1) % a.length], b[j], b[(j + 1) % b.length])) return true;
    }
  }
  return a.some((point) => pointInPolygon(point, b)) || b.some((point) => pointInPolygon(point, a));
}

function worldToScreen(point) {
  return [
    origin.x + view.panX + point[0] * baseScale * view.zoom,
    origin.y + view.panY + point[1] * baseScale * view.zoom,
  ];
}

function screenToWorld(screenX, screenY) {
  return [
    (screenX - origin.x - view.panX) / (baseScale * view.zoom),
    (screenY - origin.y - view.panY) / (baseScale * view.zoom),
  ];
}

function eventScreen(event) {
  const rect = canvas.getBoundingClientRect();
  return [
    (event.clientX - rect.left) * (canvas.width / rect.width),
    (event.clientY - rect.top) * (canvas.height / rect.height),
  ];
}

function eventWorld(event) {
  return screenToWorld(...eventScreen(event));
}

function pieceAt(point) {
  for (let index = pieces.length - 1; index >= 0; index -= 1) {
    if (pointInPolygon(point, transformedPoints(pieces[index]))) return pieces[index];
  }
  return null;
}

function vertexAt(screenPoint) {
  const piece = selectedPiece();
  if (!piece) return null;
  const points = transformedPoints(piece);
  for (let index = 0; index < points.length; index += 1) {
    const [x, y] = worldToScreen(points[index]);
    const distance = Math.hypot(screenPoint[0] - x, screenPoint[1] - y);
    if (distance <= 10) return { piece, index };
  }
  return null;
}

function collisionInfo() {
  const collisions = new Set();
  let pairs = 0;
  for (let i = 0; i < pieces.length; i += 1) {
    for (let j = i + 1; j < pieces.length; j += 1) {
      if (polygonsOverlap(transformedPoints(pieces[i]), transformedPoints(pieces[j]))) {
        collisions.add(pieces[i].id);
        collisions.add(pieces[j].id);
        pairs += 1;
      }
    }
  }
  return { ids: collisions, pairs };
}

function drawRulers(width) {
  ctx.fillStyle = "#5d6966";
  ctx.font = "12px Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  for (let cm = 0; cm <= width; cm += 10) {
    const [x, y] = worldToScreen([cm, 0]);
    ctx.beginPath();
    ctx.moveTo(x, y - 8);
    ctx.lineTo(x, y - 22);
    ctx.stroke();
    ctx.fillText(String(cm), x, y - 32);
  }

  ctx.textAlign = "right";
  for (let cm = 0; cm <= fabricHeight; cm += 10) {
    const [x, y] = worldToScreen([0, cm]);
    ctx.beginPath();
    ctx.moveTo(x - 8, y);
    ctx.lineTo(x - 22, y);
    ctx.stroke();
    ctx.fillText(String(cm), x - 28, y);
  }
}

function drawFabric() {
  const width = Number(ui.fabricWidth.value);
  const [x, y] = worldToScreen([0, 0]);
  const w = width * baseScale * view.zoom;
  const h = fabricHeight * baseScale * view.zoom;

  ctx.fillStyle = "#f9faf7";
  ctx.strokeStyle = "#a8b4ad";
  ctx.lineWidth = 2;
  ctx.fillRect(x, y, w, h);
  ctx.strokeRect(x, y, w, h);

  ctx.strokeStyle = "#d8e0db";
  ctx.lineWidth = 1;
  for (let cm = 10; cm < width; cm += 10) {
    const [gx] = worldToScreen([cm, 0]);
    ctx.beginPath();
    ctx.moveTo(gx, y);
    ctx.lineTo(gx, y + h);
    ctx.stroke();
  }
  for (let cm = 10; cm < fabricHeight; cm += 10) {
    const [, gy] = worldToScreen([0, cm]);
    ctx.beginPath();
    ctx.moveTo(x, gy);
    ctx.lineTo(x + w, gy);
    ctx.stroke();
  }

  drawRulers(width);
}

function drawVertices(piece) {
  if (mode !== "points" || selectedId !== piece.id) return;
  transformedPoints(piece).forEach((point, index) => {
    const [x, y] = worldToScreen(point);
    ctx.beginPath();
    ctx.arc(x, y, 6, 0, Math.PI * 2);
    ctx.fillStyle = index === 0 ? "#111827" : "#ffffff";
    ctx.strokeStyle = piece.color;
    ctx.lineWidth = 2;
    ctx.fill();
    ctx.stroke();
  });
}

function drawPiece(piece, hasCollision) {
  const points = transformedPoints(piece);
  const canvasPoints = points.map(worldToScreen);
  ctx.beginPath();
  canvasPoints.forEach(([x, y], index) => {
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.closePath();
  ctx.fillStyle = hasCollision ? "rgba(194, 65, 12, 0.18)" : `${piece.color}26`;
  ctx.strokeStyle = hasCollision ? "#c2410c" : piece.color;
  ctx.lineWidth = selectedId === piece.id ? 4 : 2;
  ctx.fill();
  ctx.stroke();

  const box = bounds(points);
  const label = worldToScreen([box.minX + 2, box.minY + 5]);
  ctx.fillStyle = "#1d2424";
  ctx.font = "700 13px Arial";
  ctx.textAlign = "left";
  ctx.fillText(piece.name, label[0], label[1]);
  drawVertices(piece);
}

function updateMetrics(collisions) {
  const allPoints = pieces.flatMap(transformedPoints);
  const box = bounds(allPoints);
  const usedLength = Math.max(0, box.maxX);
  const pieceArea = pieces.reduce((total, piece) => total + polygonArea(transformedPoints(piece)), 0);
  const fabricArea = Math.max(1, Number(ui.fabricWidth.value) * Math.max(usedLength, 1));
  const efficiency = Math.min(100, (pieceArea / fabricArea) * 100);

  ui.usedLength.textContent = `${usedLength.toFixed(1)} cm`;
  ui.efficiency.textContent = `${efficiency.toFixed(1)}%`;
  ui.collisions.textContent = String(collisions.pairs);

  const piece = selectedPiece();
  ui.selectionName.textContent = piece ? piece.name : "Nenhuma peca";
  ui.rotation.value = piece ? piece.rotation : 0;
}

function updateModeButtons() {
  ui.modeMove.classList.toggle("active", mode === "move");
  ui.modePoints.classList.toggle("active", mode === "points");
  ui.modePan.classList.toggle("active", mode === "pan");
  ui.modeCalibrate.classList.toggle("active", mode === "calibrate");
  ui.modeTrace.classList.toggle("active", mode === "trace");
  canvas.style.cursor = mode === "pan" ? "grab" : mode === "move" ? "move" : "crosshair";
}

function updateDigitizeStatus(message) {
  ui.digitizeStatus.textContent = message;
}

function updateImportStatus(message) {
  ui.importStatus.textContent = message;
}

function drawBackgroundImage() {
  if (!backgroundImage || !background) return;
  const [x, y] = worldToScreen([background.x, background.y]);
  const w = background.widthCm * baseScale * view.zoom;
  const h = background.heightCm * baseScale * view.zoom;
  ctx.save();
  ctx.globalAlpha = 0.55;
  ctx.drawImage(backgroundImage, x, y, w, h);
  ctx.restore();
  ctx.strokeStyle = "#64748b";
  ctx.setLineDash([6, 5]);
  ctx.strokeRect(x, y, w, h);
  ctx.setLineDash([]);
}

function drawDigitizeGuides() {
  if (calibrationPoints.length) {
    ctx.fillStyle = "#0f172a";
    ctx.strokeStyle = "#0f172a";
    calibrationPoints.forEach((point) => {
      const [x, y] = worldToScreen(point);
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, Math.PI * 2);
      ctx.fill();
    });
    if (calibrationPoints.length === 2) {
      const a = worldToScreen(calibrationPoints[0]);
      const b = worldToScreen(calibrationPoints[1]);
      ctx.beginPath();
      ctx.moveTo(a[0], a[1]);
      ctx.lineTo(b[0], b[1]);
      ctx.stroke();
    }
  }

  if (!tracePoints.length) return;
  ctx.strokeStyle = "#0891b2";
  ctx.fillStyle = "#0891b2";
  ctx.lineWidth = 2;
  ctx.beginPath();
  tracePoints.forEach((point, index) => {
    const [x, y] = worldToScreen(point);
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();
  tracePoints.forEach((point) => {
    const [x, y] = worldToScreen(point);
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fill();
  });
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawFabric();
  drawBackgroundImage();
  const collisions = collisionInfo();
  pieces.forEach((piece) => drawPiece(piece, collisions.ids.has(piece.id)));
  drawDigitizeGuides();
  updateMetrics(collisions);
  updateModeButtons();
}

function autoNest() {
  const spacing = Number(ui.spacing.value);
  const fabricWidth = Number(ui.fabricWidth.value);
  const ordered = [...pieces].sort((a, b) => polygonArea(transformedPoints(b)) - polygonArea(transformedPoints(a)));
  let cursorX = spacing;
  let cursorY = spacing;
  let rowHeight = 0;

  ordered.forEach((piece) => {
    const box = bounds(transformedPoints({ ...piece, x: 0, y: 0 }));
    const width = box.maxX - box.minX;
    const height = box.maxY - box.minY;

    if (cursorX + width + spacing > fabricWidth) {
      cursorX = spacing;
      cursorY += rowHeight + spacing;
      rowHeight = 0;
    }

    piece.x = cursorX - box.minX;
    piece.y = cursorY - box.minY;
    cursorX += width + spacing;
    rowHeight = Math.max(rowHeight, height);
  });
  draw();
}

function exportSvg() {
  const fabricWidth = Number(ui.fabricWidth.value);
  const paths = pieces
    .map((piece) => {
      const points = transformedPoints(piece);
      const d = points.map(([x, y], index) => `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`).join(" ");
      return `<path d="${d} Z" fill="${piece.color}22" stroke="${piece.color}" stroke-width="0.6"><title>${piece.name}</title></path>`;
    })
    .join("\n  ");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${fabricWidth}cm" height="${fabricHeight}cm" viewBox="0 0 ${fabricWidth} ${fabricHeight}">
  <rect x="0" y="0" width="${fabricWidth}" height="${fabricHeight}" fill="#f9faf7" stroke="#6b7280" stroke-width="0.5"/>
  ${paths}
</svg>`;
  const blob = new Blob([svg], { type: "image/svg+xml" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "risco-moldelab.svg";
  link.click();
  URL.revokeObjectURL(url);
}

function setZoom(nextZoom, anchor = [canvas.width / 2, canvas.height / 2]) {
  const before = screenToWorld(anchor[0], anchor[1]);
  view.zoom = Math.min(2.5, Math.max(0.55, nextZoom));
  const after = worldToScreen(before);
  view.panX += anchor[0] - after[0];
  view.panY += anchor[1] - after[1];
  draw();
}

function addPiece() {
  const id = `custom-${newPieceCount}`;
  pieces.push({
    id,
    name: `Nova peca ${newPieceCount}`,
    x: 18 + newPieceCount * 6,
    y: 18 + newPieceCount * 6,
    rotation: 0,
    mirrored: false,
    color: "#0891b2",
    points: [
      [0, 0],
      [34, 0],
      [40, 24],
      [22, 38],
      [0, 28],
    ],
  });
  newPieceCount += 1;
  selectedId = id;
  mode = "points";
  draw();
}

function normalizeImportedPoints(points) {
  const clean = points.filter((point) => Number.isFinite(point[0]) && Number.isFinite(point[1]));
  if (clean.length < 3) return null;
  const box = bounds(clean);
  const width = Math.max(1, box.maxX - box.minX);
  const scaleToCm = width > 220 ? 0.1 : 1;
  return {
    x: box.minX * scaleToCm,
    y: box.minY * scaleToCm,
    points: clean.map(([x, y]) => [(x - box.minX) * scaleToCm, (y - box.minY) * scaleToCm]),
  };
}

function parsePointList(value) {
  const numbers = value.match(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi)?.map(Number) || [];
  const points = [];
  for (let index = 0; index + 1 < numbers.length; index += 2) {
    points.push([numbers[index], numbers[index + 1]]);
  }
  return points;
}

function parseSimplePath(d) {
  const tokens = d.match(/[MLHVZmlhvz]|-?\d*\.?\d+(?:e[-+]?\d+)?/g) || [];
  const points = [];
  let command = "";
  let index = 0;
  let current = [0, 0];

  while (index < tokens.length) {
    if (/^[A-Za-z]$/.test(tokens[index])) {
      command = tokens[index];
      index += 1;
    }

    if (command === "M" || command === "L") {
      current = [Number(tokens[index]), Number(tokens[index + 1])];
      points.push([...current]);
      index += 2;
    } else if (command === "m" || command === "l") {
      current = [current[0] + Number(tokens[index]), current[1] + Number(tokens[index + 1])];
      points.push([...current]);
      index += 2;
    } else if (command === "H") {
      current = [Number(tokens[index]), current[1]];
      points.push([...current]);
      index += 1;
    } else if (command === "h") {
      current = [current[0] + Number(tokens[index]), current[1]];
      points.push([...current]);
      index += 1;
    } else if (command === "V") {
      current = [current[0], Number(tokens[index])];
      points.push([...current]);
      index += 1;
    } else if (command === "v") {
      current = [current[0], current[1] + Number(tokens[index])];
      points.push([...current]);
      index += 1;
    } else if (command.toLowerCase() === "z") {
      index += 1;
    } else {
      break;
    }
  }
  return points;
}

function createImportedPiece(points, name) {
  const normalized = normalizeImportedPoints(points);
  if (!normalized) return false;
  const id = `imported-${importedCount}`;
  pieces.push({
    id,
    name,
    x: normalized.x,
    y: normalized.y,
    rotation: 0,
    mirrored: false,
    color: "#475569",
    points: normalized.points,
  });
  selectedId = id;
  importedCount += 1;
  return true;
}

function importSvg(text) {
  const doc = new DOMParser().parseFromString(text, "image/svg+xml");
  const shapes = [...doc.querySelectorAll("polygon, polyline, path")];
  let created = 0;
  shapes.forEach((shape) => {
    let points = [];
    if (shape.tagName.toLowerCase() === "path") {
      points = parseSimplePath(shape.getAttribute("d") || "");
    } else {
      points = parsePointList(shape.getAttribute("points") || "");
    }
    if (createImportedPiece(points, `Importada ${importedCount}`)) created += 1;
  });
  updateImportStatus(created ? `${created} peca(s) importada(s) do SVG.` : "SVG sem poligonos simples importaveis.");
  draw();
}

function dxfPairs(text) {
  const lines = text.replace(/\r/g, "").split("\n").map((line) => line.trim());
  const pairs = [];
  for (let index = 0; index + 1 < lines.length; index += 2) {
    pairs.push([lines[index], lines[index + 1]]);
  }
  return pairs;
}

function importDxf(text) {
  const pairs = dxfPairs(text);
  let created = 0;

  for (let index = 0; index < pairs.length; index += 1) {
    const [code, value] = pairs[index];

    if (code === "0" && value === "LWPOLYLINE") {
      const points = [];
      index += 1;
      while (index < pairs.length && pairs[index][0] !== "0") {
        if (pairs[index][0] === "10") {
          const x = Number(pairs[index][1]);
          let y = 0;
          if (pairs[index + 1]?.[0] === "20") {
            y = Number(pairs[index + 1][1]);
            index += 1;
          }
          points.push([x, y]);
        }
        index += 1;
      }
      index -= 1;
      if (createImportedPiece(points, `DXF ${importedCount}`)) created += 1;
    }

    if (code === "0" && value === "POLYLINE") {
      const points = [];
      index += 1;
      while (index < pairs.length) {
        if (pairs[index][0] === "0" && pairs[index][1] === "SEQEND") break;
        if (pairs[index][0] === "0" && pairs[index][1] === "VERTEX") {
          let x = null;
          let y = null;
          index += 1;
          while (index < pairs.length && pairs[index][0] !== "0") {
            if (pairs[index][0] === "10") x = Number(pairs[index][1]);
            if (pairs[index][0] === "20") y = Number(pairs[index][1]);
            index += 1;
          }
          if (x !== null && y !== null) points.push([x, y]);
          index -= 1;
        }
        index += 1;
      }
      if (createImportedPiece(points, `DXF ${importedCount}`)) created += 1;
    }

    if (code === "0" && value === "LINE") {
      let x1 = null;
      let y1 = null;
      let x2 = null;
      let y2 = null;
      index += 1;
      while (index < pairs.length && pairs[index][0] !== "0") {
        if (pairs[index][0] === "10") x1 = Number(pairs[index][1]);
        if (pairs[index][0] === "20") y1 = Number(pairs[index][1]);
        if (pairs[index][0] === "11") x2 = Number(pairs[index][1]);
        if (pairs[index][0] === "21") y2 = Number(pairs[index][1]);
        index += 1;
      }
      index -= 1;
      if ([x1, y1, x2, y2].every((number) => number !== null)) {
        const thickness = 0.2;
        const points = [
          [x1, y1],
          [x2, y2],
          [x2 + thickness, y2 + thickness],
          [x1 + thickness, y1 + thickness],
        ];
        if (createImportedPiece(points, `Linha DXF ${importedCount}`)) created += 1;
      }
    }
  }

  updateImportStatus(created ? `${created} entidade(s) importada(s) do DXF.` : "DXF sem LINE/POLYLINE simples importavel.");
  draw();
}

function importPlt(text) {
  const commands = text
    .replace(/\s+/g, "")
    .split(";")
    .map((command) => command.trim())
    .filter(Boolean);
  const paths = [];
  let current = [0, 0];
  let drawing = false;
  let activePath = [];

  commands.forEach((command) => {
    const op = command.slice(0, 2).toUpperCase();
    const coords = parsePointList(command.slice(2));
    if (op === "PU") {
      if (activePath.length >= 3) paths.push(activePath);
      activePath = [];
      drawing = false;
      if (coords.length) current = coords[coords.length - 1];
    }
    if (op === "PD") {
      drawing = true;
      if (!activePath.length) activePath.push(current);
      coords.forEach((point) => {
        activePath.push(point);
        current = point;
      });
    }
    if (op === "PA" && coords.length) {
      coords.forEach((point) => {
        current = point;
        if (drawing) activePath.push(point);
      });
    }
  });

  if (activePath.length >= 3) paths.push(activePath);
  let created = 0;
  paths.forEach((points) => {
    const scaled = points.map(([x, y]) => [x / 40, y / 40]);
    if (createImportedPiece(scaled, `PLT ${importedCount}`)) created += 1;
  });

  updateImportStatus(created ? `${created} caminho(s) importado(s) do PLT.` : "PLT sem caminhos PU/PD importaveis.");
  draw();
}

function importVectorFile(file) {
  if (!file) return;
  const extension = file.name.split(".").pop().toLowerCase();
  if (extension === "ads") {
    updateImportStatus(".ads precisa de amostras reais do Audaces 7 para mapear a geometria.");
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    const text = String(reader.result);
    if (extension === "svg") importSvg(text);
    else if (extension === "dxf") importDxf(text);
    else if (extension === "plt") importPlt(text);
    else updateImportStatus(`.${extension} nao suportado neste prototipo.`);
  };
  reader.readAsText(file);
}

function importImage(file) {
  if (!file) return;
  const image = new Image();
  image.onload = () => {
    backgroundImage = image;
    const widthCm = 90;
    background = {
      x: 8,
      y: 8,
      widthCm,
      heightCm: widthCm * (image.height / image.width),
    };
    calibrationPoints = [];
    tracePoints = [];
    mode = "calibrate";
    updateDigitizeStatus("Clique dois pontos na imagem e informe a medida real.");
    draw();
  };
  image.src = URL.createObjectURL(file);
}

function calibrateImage() {
  if (!background || calibrationPoints.length !== 2) return;
  const reference = Number(ui.calibrationLength.value);
  const current = Math.hypot(
    calibrationPoints[1][0] - calibrationPoints[0][0],
    calibrationPoints[1][1] - calibrationPoints[0][1],
  );
  if (!current || !reference) return;

  const factor = reference / current;
  background.widthCm *= factor;
  background.heightCm *= factor;
  calibrationPoints = [];
  mode = "trace";
  updateDigitizeStatus("Calibrado. Clique no contorno do molde e depois use Fechar.");
  draw();
}

function finishTrace() {
  if (tracePoints.length < 3) {
    updateDigitizeStatus("Marque pelo menos 3 pontos para criar uma peca.");
    return;
  }
  const box = bounds(tracePoints);
  const points = tracePoints.map(([x, y]) => [x - box.minX, y - box.minY]);
  const id = `digitized-${digitizedCount}`;
  pieces.push({
    id,
    name: `Digitalizada ${digitizedCount}`,
    x: box.minX,
    y: box.minY,
    rotation: 0,
    mirrored: false,
    color: "#0891b2",
    points,
  });
  digitizedCount += 1;
  selectedId = id;
  tracePoints = [];
  mode = "points";
  updateDigitizeStatus("Peca digitalizada criada. Ajuste os pontos se precisar.");
  draw();
}

canvas.addEventListener("pointerdown", (event) => {
  const screen = eventScreen(event);
  const point = screenToWorld(screen[0], screen[1]);

  if (mode === "pan") {
    dragState = { type: "pan", screen };
    canvas.setPointerCapture(event.pointerId);
    canvas.style.cursor = "grabbing";
    return;
  }

  if (mode === "calibrate") {
    if (!background) {
      updateDigitizeStatus("Importe uma imagem antes de calibrar.");
      return;
    }
    calibrationPoints.push(point);
    if (calibrationPoints.length > 2) calibrationPoints = [point];
    if (calibrationPoints.length === 2) calibrateImage();
    else updateDigitizeStatus("Agora clique o segundo ponto da medida de referencia.");
    draw();
    return;
  }

  if (mode === "trace") {
    if (!background) {
      updateDigitizeStatus("Importe uma imagem antes de digitalizar.");
      return;
    }
    tracePoints.push(point);
    updateDigitizeStatus(`${tracePoints.length} pontos marcados. Use Fechar quando completar o contorno.`);
    draw();
    return;
  }

  if (mode === "points") {
    const vertex = vertexAt(screen);
    if (vertex) {
      dragState = { type: "vertex", pieceId: vertex.piece.id, pointIndex: vertex.index };
      canvas.setPointerCapture(event.pointerId);
      return;
    }
  }

  const piece = pieceAt(point);
  if (!piece) return;
  selectedId = piece.id;
  if (mode === "move") {
    dragState = {
      type: "piece",
      pieceId: piece.id,
      offsetX: point[0] - piece.x,
      offsetY: point[1] - piece.y,
    };
    canvas.setPointerCapture(event.pointerId);
  }
  draw();
});

canvas.addEventListener("pointermove", (event) => {
  if (!dragState) return;
  const screen = eventScreen(event);
  const point = screenToWorld(screen[0], screen[1]);

  if (dragState.type === "pan") {
    view.panX += screen[0] - dragState.screen[0];
    view.panY += screen[1] - dragState.screen[1];
    dragState.screen = screen;
  }

  if (dragState.type === "piece") {
    const piece = pieces.find((item) => item.id === dragState.pieceId);
    piece.x = point[0] - dragState.offsetX;
    piece.y = point[1] - dragState.offsetY;
  }

  if (dragState.type === "vertex") {
    const piece = pieces.find((item) => item.id === dragState.pieceId);
    piece.points[dragState.pointIndex] = inverseTransformedPoint(piece, point);
  }

  draw();
});

canvas.addEventListener("pointerup", (event) => {
  dragState = null;
  canvas.releasePointerCapture(event.pointerId);
  updateModeButtons();
});

canvas.addEventListener("wheel", (event) => {
  event.preventDefault();
  const anchor = eventScreen(event);
  const direction = event.deltaY > 0 ? 0.9 : 1.1;
  setZoom(view.zoom * direction, anchor);
});

ui.modeMove.addEventListener("click", () => {
  mode = "move";
  draw();
});

ui.modePoints.addEventListener("click", () => {
  mode = "points";
  draw();
});

ui.modePan.addEventListener("click", () => {
  mode = "pan";
  draw();
});

ui.modeCalibrate.addEventListener("click", () => {
  mode = "calibrate";
  calibrationPoints = [];
  updateDigitizeStatus(background ? "Clique dois pontos da medida de referencia." : "Importe uma imagem antes de calibrar.");
  draw();
});

ui.modeTrace.addEventListener("click", () => {
  mode = "trace";
  updateDigitizeStatus(background ? "Clique no contorno do molde." : "Importe uma imagem antes de digitalizar.");
  draw();
});

ui.zoomOut.addEventListener("click", () => setZoom(view.zoom * 0.9));
ui.zoomIn.addEventListener("click", () => setZoom(view.zoom * 1.1));
ui.resetView.addEventListener("click", () => {
  view.zoom = 1;
  view.panX = 0;
  view.panY = 0;
  draw();
});

ui.rotateLeft.addEventListener("click", () => {
  const piece = selectedPiece();
  piece.rotation = (piece.rotation + 345) % 360;
  draw();
});

ui.rotateRight.addEventListener("click", () => {
  const piece = selectedPiece();
  piece.rotation = (piece.rotation + 15) % 360;
  draw();
});

ui.mirrorPiece.addEventListener("click", () => {
  const piece = selectedPiece();
  piece.mirrored = !piece.mirrored;
  draw();
});

ui.rotation.addEventListener("input", () => {
  selectedPiece().rotation = Number(ui.rotation.value);
  draw();
});

ui.fabricWidth.addEventListener("input", draw);
ui.spacing.addEventListener("input", draw);
ui.autoNest.addEventListener("click", autoNest);
ui.exportSvg.addEventListener("click", exportSvg);
ui.addPiece.addEventListener("click", addPiece);
ui.finishTrace.addEventListener("click", finishTrace);
ui.imageInput.addEventListener("change", (event) => importImage(event.target.files[0]));
ui.vectorInput.addEventListener("change", (event) => importVectorFile(event.target.files[0]));

draw();
