const pendingUsers = document.querySelector("#pendingUsers");
const allUsers = document.querySelector("#allUsers");
const adminMessage = document.querySelector("#adminMessage");
const refreshUsers = document.querySelector("#refreshUsers");

function showMessage(text, isError = false) {
  adminMessage.hidden = false;
  adminMessage.textContent = text;
  adminMessage.classList.toggle("auth-error", isError);
  adminMessage.classList.toggle("auth-success", !isError);
}

function statusLabel(status) {
  if (status === "approved") return "Aprovado";
  if (status === "rejected") return "Recusado";
  return "Pendente";
}

function renderUserCard(user, container) {
  const card = document.createElement("article");
  card.className = "admin-user-card";
  card.innerHTML = `
    <div>
      <strong>${user.name}</strong>
      <div class="admin-user-meta">${user.email}</div>
      <div class="admin-user-meta">${statusLabel(user.status)} · ${user.role}</div>
    </div>
    <div class="admin-user-buttons"></div>
  `;
  const buttons = card.querySelector(".admin-user-buttons");
  if (user.status === "pending") {
    const approve = document.createElement("button");
    approve.type = "button";
    approve.className = "primary";
    approve.textContent = "Aprovar";
    approve.addEventListener("click", () => updateUser(user.id, "approve"));
    buttons.appendChild(approve);

    const reject = document.createElement("button");
    reject.type = "button";
    reject.textContent = "Recusar";
    reject.addEventListener("click", () => updateUser(user.id, "reject"));
    buttons.appendChild(reject);
  }
  container.appendChild(card);
}

async function updateUser(userId, action) {
  const response = await fetch(`/api/admin/users/${userId}/${action}`, {
    method: "POST",
    credentials: "same-origin",
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.ok) {
    showMessage(data.error || "Nao foi possivel atualizar o usuario.", true);
    return;
  }
  showMessage(`Usuario ${action === "approve" ? "aprovado" : "recusado"}.`, false);
  await loadUsers();
}

async function loadUsers() {
  const meResponse = await fetch("/api/auth/me", { credentials: "same-origin" });
  const meData = await meResponse.json().catch(() => ({}));
  if (!meResponse.ok || meData.user?.role !== "admin" || meData.user?.status !== "approved") {
    window.location.href = "/login.html?next=/admin.html";
    return;
  }

  const [pendingResponse, allResponse] = await Promise.all([
    fetch("/api/admin/users?status=pending", { credentials: "same-origin" }),
    fetch("/api/admin/users", { credentials: "same-origin" }),
  ]);
  const pendingData = await pendingResponse.json();
  const allData = await allResponse.json();

  pendingUsers.replaceChildren();
  allUsers.replaceChildren();

  if (!pendingData.ok || !allData.ok) {
    showMessage("Nao foi possivel carregar os usuarios.", true);
    return;
  }

  if (!pendingData.users.length) {
    pendingUsers.innerHTML = '<p class="admin-empty">Nenhum usuario pendente.</p>';
  } else {
    pendingData.users.forEach((user) => renderUserCard(user, pendingUsers));
  }

  allData.users.forEach((user) => renderUserCard(user, allUsers));
}

refreshUsers.addEventListener("click", () => loadUsers().catch(() => showMessage("Erro ao atualizar.", true)));
loadUsers().catch(() => showMessage("Erro ao carregar painel.", true));
