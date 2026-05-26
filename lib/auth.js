const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { createUserStore } = require("./user-store");

const root = path.join(__dirname, "..");
const dataDir = process.env.MOLDELAB_DATA_DIR || path.join(root, "data");
const cookieName = "moldelab_session";
const tokenTtl = "7d";
const disabled = process.env.MOLDELAB_AUTH_DISABLED === "1";
const allowRegister = process.env.MOLDELAB_ALLOW_REGISTER !== "0";
const adminEmails = new Set(
  String(process.env.MOLDELAB_ADMIN_EMAILS || "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean),
);

let store;

function jwtSecret() {
  const fromEnv = process.env.MOLDELAB_JWT_SECRET;
  if (fromEnv) return fromEnv;
  if (disabled) return "moldelab-dev-secret";

  ensureDataDir();
  const secretPath = path.join(dataDir, ".jwt-secret");
  if (fs.existsSync(secretPath)) return fs.readFileSync(secretPath, "utf8");
  const generated = crypto.randomBytes(48).toString("hex");
  fs.writeFileSync(secretPath, generated, { encoding: "utf8", mode: 0o600 });
  console.warn("MOLDELAB_JWT_SECRET nao definido; usando segredo persistido em disco.");
  return generated;
}

function ensureDataDir() {
  fs.mkdirSync(dataDir, { recursive: true });
}

function initDb() {
  ensureDataDir();
  store = createUserStore(dataDir);
  bootstrapAdmin();
}

function bootstrapAdmin() {
  const email = process.env.MOLDELAB_BOOTSTRAP_EMAIL;
  const password = process.env.MOLDELAB_BOOTSTRAP_PASSWORD;
  if (!email || !password) return;
  const user = store.ensureBootstrapAdmin({
    email,
    password,
    name: process.env.MOLDELAB_BOOTSTRAP_NAME || "Administrador",
    hashPassword: (value) => bcrypt.hashSync(value, 12),
  });
  console.log(`Administrador inicial: ${user.email}`);
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function resolveRole(email) {
  return adminEmails.has(normalizeEmail(email)) ? "admin" : "user";
}

function createUser(name, email, password, options = {}) {
  const normalized = normalizeEmail(email);
  const user = {
    id: crypto.randomUUID(),
    name: name.trim(),
    email: normalized,
    password_hash: bcrypt.hashSync(password, 12),
    status: options.status || "pending",
    role: options.role || resolveRole(normalized),
    created_at: new Date().toISOString(),
  };
  return store.insert(user);
}

function findUserByEmail(email) {
  return store.findByEmail(email);
}

function findUserById(id) {
  return store.findById(id);
}

function listUsers(statusFilter) {
  return store.list(statusFilter || null);
}

function setUserStatus(userId, status) {
  return store.update(userId, { status });
}

function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    status: user.status,
    role: user.role,
  };
}

function isApproved(user) {
  return user?.status === "approved";
}

function isAdmin(user) {
  return user?.role === "admin" && isApproved(user);
}

function signToken(user) {
  return jwt.sign({ sub: user.id, email: user.email }, jwtSecret(), { expiresIn: tokenTtl });
}

function verifyToken(token) {
  try {
    const payload = jwt.verify(token, jwtSecret());
    return findUserById(payload.sub);
  } catch {
    return null;
  }
}

function parseCookies(request) {
  const header = request.headers.cookie || "";
  const cookies = {};
  header.split(";").forEach((part) => {
    const [key, ...rest] = part.trim().split("=");
    if (!key) return;
    cookies[key] = decodeURIComponent(rest.join("="));
  });
  return cookies;
}

function isSecureRequest(request) {
  const proto = request.headers["x-forwarded-proto"];
  if (proto) return String(proto).split(",")[0].trim() === "https";
  return false;
}

function setSessionCookie(response, token, request) {
  const secure = isSecureRequest(request) ? "; Secure" : "";
  response.setHeader(
    "Set-Cookie",
    `${cookieName}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${7 * 24 * 60 * 60}${secure}`,
  );
}

function clearSessionCookie(response, request) {
  const secure = isSecureRequest(request) ? "; Secure" : "";
  response.setHeader("Set-Cookie", `${cookieName}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`);
}

function getSessionUser(request) {
  if (disabled) {
    return { id: "dev", name: "Desenvolvimento", email: "dev@moldelab.local", status: "approved", role: "admin" };
  }
  const token = parseCookies(request)[cookieName];
  if (!token) return null;
  return verifyToken(token);
}

function getApprovedUser(request) {
  const user = getSessionUser(request);
  if (!user || !isApproved(user)) return null;
  return user;
}

function isPublicPath(pathname) {
  if (pathname === "/login.html" || pathname === "/login.js") return true;
  if (pathname === "/admin.html" || pathname === "/admin.js") return true;
  if (pathname === "/mobile-scanner.js") return true;
  if (pathname === "/styles.css") return true;
  if (pathname.startsWith("/api/auth/login") || pathname.startsWith("/api/auth/register")) return true;
  if (pathname.startsWith("/api/admin/")) return true;
  if (pathname.startsWith("/api/auth/me")) return true;
  return false;
}

function sendJson(response, statusCode, payload) {
  if (response.writableEnded || response.headersSent) return true;
  response.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(payload));
  return true;
}

async function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        reject(new Error("payload too large"));
        request.destroy();
      }
    });
    request.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error("JSON invalido"));
      }
    });
    request.on("error", reject);
  });
}

function validateRegistration({ name, email, password }) {
  if (!name || String(name).trim().length < 2) return "Informe seu nome.";
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email))) return "Informe um email valido.";
  if (!password || String(password).length < 8) return "A senha precisa ter pelo menos 8 caracteres.";
  return null;
}

function loginErrorForStatus(status) {
  if (status === "pending") return "Conta aguardando aprovacao do administrador.";
  if (status === "rejected") return "Conta recusada. Fale com o administrador.";
  return "Conta sem acesso.";
}

function handleAdminApi(request, response, url) {
  if (!url.pathname.startsWith("/api/admin/")) return false;

  try {
    const admin = getSessionUser(request);
    if (!isAdmin(admin)) {
      sendJson(response, 403, { ok: false, error: "Acesso restrito ao administrador." });
      return true;
    }

    if (url.pathname === "/api/admin/users" && request.method === "GET") {
      const filter = url.searchParams.get("status") || "";
      const users = listUsers(filter || null).map(publicUser);
      sendJson(response, 200, { ok: true, users });
      return true;
    }

    const match = url.pathname.match(/^\/api\/admin\/users\/([^/]+)\/(approve|reject)$/);
    if (match && request.method === "POST") {
      const userId = decodeURIComponent(match[1]);
      const action = match[2];
      const target = findUserById(userId);
      if (!target) {
        sendJson(response, 404, { ok: false, error: "Usuario nao encontrado." });
        return true;
      }
      const status = action === "approve" ? "approved" : "rejected";
      const updated = setUserStatus(userId, status);
      sendJson(response, 200, { ok: true, user: publicUser(updated) });
      return true;
    }

    sendJson(response, 404, { ok: false, error: "Rota nao encontrada." });
    return true;
  } catch (error) {
    console.error("Erro na API admin:", error);
    sendJson(response, 500, { ok: false, error: "Erro interno no painel admin." });
    return true;
  }
}

function handleAuthApi(request, response, url) {
  if (url.pathname.startsWith("/api/admin/")) {
    return handleAdminApi(request, response, url);
  }
  if (!url.pathname.startsWith("/api/auth/")) return false;

  try {
    if (url.pathname === "/api/auth/me" && request.method === "GET") {
      const user = getSessionUser(request);
      if (!user) return sendJson(response, 401, { ok: false, error: "Nao autenticado." });
      return sendJson(response, 200, { ok: true, user: publicUser(user) });
    }

    if (url.pathname === "/api/auth/logout" && request.method === "POST") {
      clearSessionCookie(response, request);
      sendJson(response, 200, { ok: true });
      return true;
    }

    if (request.method !== "POST") {
      sendJson(response, 405, { ok: false, error: "Metodo nao permitido." });
      return true;
    }

    readJsonBody(request)
      .then((payload) => {
        if (url.pathname === "/api/auth/register") {
          if (!allowRegister) {
            sendJson(response, 403, { ok: false, error: "Cadastro desabilitado." });
            return;
          }
          const validationError = validateRegistration(payload);
          if (validationError) {
            sendJson(response, 400, { ok: false, error: validationError });
            return;
          }
          if (findUserByEmail(payload.email)) {
            sendJson(response, 409, { ok: false, error: "Este email ja esta cadastrado." });
            return;
          }
          const user = createUser(payload.name, payload.email, payload.password);
          sendJson(response, 201, {
            ok: true,
            pending: true,
            message: "Cadastro enviado. Aguarde a aprovacao do administrador para entrar.",
            user: publicUser(user),
          });
          return;
        }

        if (url.pathname === "/api/auth/login") {
          const email = normalizeEmail(payload.email);
          const password = String(payload.password || "");
          const user = findUserByEmail(email);
          if (!user || !bcrypt.compareSync(password, user.password_hash)) {
            sendJson(response, 401, { ok: false, error: "Email ou senha incorretos." });
            return;
          }
          if (!isApproved(user)) {
            sendJson(response, 403, {
              ok: false,
              error: loginErrorForStatus(user.status),
              status: user.status,
            });
            return;
          }
          const token = signToken(user);
          setSessionCookie(response, token, request);
          sendJson(response, 200, { ok: true, user: publicUser(findUserById(user.id)) });
          return;
        }

        sendJson(response, 404, { ok: false, error: "Rota nao encontrada." });
      })
      .catch((error) => {
        sendJson(response, 400, { ok: false, error: error.message || "Requisicao invalida." });
      });

    return true;
  } catch (error) {
    console.error("Erro na API auth:", error);
    sendJson(response, 500, { ok: false, error: "Erro interno de autenticacao." });
    return true;
  }
}

function redirectToLogin(response, nextPath = "/") {
  if (response.writableEnded || response.headersSent) return true;
  const target = nextPath && nextPath !== "/"
    ? `/login.html?next=${encodeURIComponent(nextPath)}`
    : "/login.html";
  response.writeHead(302, { Location: target });
  response.end();
  return true;
}

function init() {
  if (disabled) {
    console.log("Autenticacao desabilitada (MOLDELAB_AUTH_DISABLED=1).");
    return;
  }
  try {
    initDb();
    console.log(`Autenticacao ativa. Dados: ${path.join(dataDir, "users.json")}`);
  } catch (error) {
    console.error("Falha ao iniciar autenticacao:", error);
    throw error;
  }
}

module.exports = {
  init,
  disabled,
  allowRegister,
  isPublicPath,
  getSessionUser,
  getApprovedUser,
  getUserFromRequest: getApprovedUser,
  isAdmin,
  handleAuthApi,
  redirectToLogin,
};
