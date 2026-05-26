const preview = document.querySelector("#preview");
const statusEl = document.querySelector("#status");
const startCamera = document.querySelector("#startCamera");
const sendFrame = document.querySelector("#sendFrame");
const toggleLive = document.querySelector("#toggleLive");
const fallbackPhoto = document.querySelector("#fallbackPhoto");
const params = new URLSearchParams(location.search);
const scannerToken = params.get("token");
const protocol = location.protocol === "https:" ? "wss:" : "ws:";
const socket = scannerToken
  ? new WebSocket(`${protocol}//${location.host}/ws/mobile?token=${encodeURIComponent(scannerToken)}`)
  : { readyState: WebSocket.CLOSED, send() {}, addEventListener() {} };
let stream = null;
let liveTimer = null;

function setStatus(message) {
  statusEl.textContent = message;
  if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: "phone-status", message }));
}

if (!scannerToken) {
  setStatus("Acesso negado. Escaneie o QR no MoldeLab com sua conta logada.");
  startCamera.disabled = true;
  sendFrame.disabled = true;
  toggleLive.disabled = true;
  fallbackPhoto.disabled = true;
}

async function openCamera() {
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } },
      audio: false,
    });
    preview.srcObject = stream;
    await preview.play();
    setStatus("Camera aberta. Posicione o molde inteiro.");
  } catch (error) {
    setStatus("Camera bloqueada neste navegador. Use Foto fallback.");
  }
}

function frameFromVideo() {
  if (!preview.videoWidth) return null;
  const canvas = document.createElement("canvas");
  canvas.width = preview.videoWidth;
  canvas.height = preview.videoHeight;
  canvas.getContext("2d").drawImage(preview, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.82);
}

async function sendDataUrl(dataUrl) {
  if (!dataUrl) {
    setStatus("Nenhuma imagem para enviar.");
    return;
  }
  if (socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({ type: "frame", dataUrl, capturedAt: Date.now() }));
    setStatus("Frame enviado ao MoldeLab por WebSocket.");
    return;
  }
  try {
    const response = await fetch("/scanner-frame", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Scanner-Token": scannerToken || "",
      },
      body: JSON.stringify({ type: "frame", dataUrl, capturedAt: Date.now() }),
    });
    setStatus(response.ok ? "Foto enviada ao MoldeLab por fallback HTTP." : "Falha ao enviar foto por fallback HTTP.");
  } catch (error) {
    setStatus("Nao consegui enviar. Confira se o app Windows esta aberto.");
  }
}

function sendCurrentFrame() {
  sendDataUrl(frameFromVideo());
}

socket.addEventListener("open", () => setStatus("Celular conectado ao MoldeLab."));
socket.addEventListener("message", (event) => {
  const payload = JSON.parse(event.data);
  if (payload.type === "capture") sendCurrentFrame();
});
socket.addEventListener("close", () => setStatus("Conexao fechada."));
startCamera.addEventListener("click", openCamera);
sendFrame.addEventListener("click", sendCurrentFrame);
toggleLive.addEventListener("click", () => {
  if (liveTimer) {
    clearInterval(liveTimer);
    liveTimer = null;
    toggleLive.textContent = "Ao vivo: off";
    setStatus("Envio ao vivo pausado.");
    return;
  }
  liveTimer = setInterval(sendCurrentFrame, 900);
  toggleLive.textContent = "Ao vivo: on";
  setStatus("Enviando frames ao vivo.");
});
fallbackPhoto.addEventListener("change", () => {
  const file = fallbackPhoto.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => sendDataUrl(String(reader.result));
  reader.readAsDataURL(file);
});
