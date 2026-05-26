const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

function createUserStore(dataDir) {
  const storePath = path.join(dataDir, "users.json");

  function readStore() {
    try {
      const raw = fs.readFileSync(storePath, "utf8");
      const data = JSON.parse(raw);
      return Array.isArray(data.users) ? data.users : [];
    } catch (error) {
      if (error.code === "ENOENT") return [];
      throw error;
    }
  }

  function writeStore(users) {
    const tempPath = `${storePath}.tmp`;
    fs.writeFileSync(tempPath, JSON.stringify({ users }, null, 2), "utf8");
    fs.renameSync(tempPath, storePath);
  }

  return {
    list(statusFilter) {
      const users = readStore();
      if (!statusFilter) return users.slice().sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
      return users.filter((user) => user.status === statusFilter).sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
    },
    findByEmail(email) {
      const normalized = String(email || "").trim().toLowerCase();
      return readStore().find((user) => user.email === normalized) || null;
    },
    findById(id) {
      return readStore().find((user) => user.id === id) || null;
    },
    insert(user) {
      const users = readStore();
      users.push(user);
      writeStore(users);
      return user;
    },
    update(id, patch) {
      const users = readStore();
      const index = users.findIndex((user) => user.id === id);
      if (index < 0) return null;
      users[index] = { ...users[index], ...patch };
      writeStore(users);
      return users[index];
    },
    ensureBootstrapAdmin({ email, password, name, hashPassword }) {
      const normalized = String(email || "").trim().toLowerCase();
      const existing = readStore().find((user) => user.email === normalized);
      if (existing) {
        return this.update(existing.id, { status: "approved", role: "admin" });
      }
      const user = {
        id: crypto.randomUUID(),
        name: name || "Administrador",
        email: normalized,
        password_hash: hashPassword(password),
        status: "approved",
        role: "admin",
        created_at: new Date().toISOString(),
      };
      return this.insert(user);
    },
  };
}

module.exports = { createUserStore };
