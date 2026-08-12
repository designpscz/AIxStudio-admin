import { httpsCallable } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-functions.js";
import { requireLogin, adminLogout, functions } from "./admin_auth.js";

const tableBody = document.getElementById("userTableBody");
const searchInput = document.getElementById("userSearch");
const statusEl = document.getElementById("dashboardStatus");
const userCountEl = document.getElementById("userCount");
const refreshBtn = document.getElementById("refreshBtn");
const logoutBtn = document.getElementById("logoutBtn");
const adminEmailEl = document.getElementById("adminEmail");

const deletedTableBody = document.getElementById("deletedTableBody");
const deletedStatusEl = document.getElementById("deletedStatus");
const deletedCountEl = document.getElementById("deletedCount");

const creditModalOverlay = document.getElementById("creditModalOverlay");
const creditModalTarget = document.getElementById("creditModalTarget");
const creditDeltaInput = document.getElementById("creditDeltaInput");
const creditReasonInput = document.getElementById("creditReasonInput");
const creditModalError = document.getElementById("creditModalError");
const creditModalCancelBtn = document.getElementById("creditModalCancelBtn");
const creditModalSubmitBtn = document.getElementById("creditModalSubmitBtn");

const adminListUsersFn = httpsCallable(functions, "adminListUsers");
const adminAdjustCreditFn = httpsCallable(functions, "adminAdjustCredit");
const adminListDeletedAccountsFn = httpsCallable(functions, "adminListDeletedAccounts");
const adminDeleteUserFn = httpsCallable(functions, "adminDeleteUser");

let allUsers = [];
let creditModalTargetUser = null;

function formatCredit(value) {
  return Math.max(0, Number(value) || 0).toLocaleString("ko-KR");
}

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit" });
}

function renderRows(users) {
  if (!users.length) {
    tableBody.innerHTML = `<tr><td colspan="7" class="empty_cell">조건에 맞는 회원이 없습니다.</td></tr>`;
    return;
  }

  tableBody.innerHTML = users
    .map((u) => `
      <tr>
        <td>${u.name || "-"}</td>
        <td>${u.email || "-"}</td>
        <td><span class="plan_badge">${u.plan || "free"}</span></td>
        <td>${formatCredit(u.use_credit)} / ${formatCredit(u.max_credit)}</td>
        <td>${u.company || "-"}</td>
        <td>${formatDate(u.createdAt)}</td>
        <td class="action_cell">
          <button type="button" class="btn_adjust_credit" data-uid="${u.uid}">크레딧 조정</button>
          <button type="button" class="btn_delete_user" data-uid="${u.uid}">삭제</button>
        </td>
      </tr>
    `)
    .join("");
}

function applyFilter() {
  const keyword = searchInput.value.trim().toLowerCase();

  if (!keyword) {
    renderRows(allUsers);
    return;
  }

  const filtered = allUsers.filter((u) =>
    String(u.email || "").toLowerCase().includes(keyword) ||
    String(u.name || "").toLowerCase().includes(keyword)
  );

  renderRows(filtered);
}

async function loadUsers() {
  statusEl.textContent = "회원 목록을 불러오는 중...";
  statusEl.classList.remove("is_error");
  tableBody.innerHTML = "";
  refreshBtn.disabled = true;

  try {
    const result = await adminListUsersFn();
    allUsers = result.data?.users || [];
    userCountEl.textContent = `총 ${allUsers.length.toLocaleString("ko-KR")}명`;
    applyFilter();
    statusEl.textContent = "";
  } catch (error) {
    console.error("[AdminDashboard] 회원 목록 조회 오류:", error);

    if (error?.code === "functions/permission-denied") {
      statusEl.textContent = "관리자 권한이 없습니다.";
      statusEl.classList.add("is_error");
      alert("관리자 권한이 없습니다.");
      await adminLogout();
      return;
    }

    statusEl.textContent = "회원 목록을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.";
    statusEl.classList.add("is_error");
  } finally {
    refreshBtn.disabled = false;
  }
}

function renderDeletedRows(accounts) {
  if (!accounts.length) {
    deletedTableBody.innerHTML = `<tr><td colspan="4" class="empty_cell">탈퇴한 회원이 없습니다.</td></tr>`;
    return;
  }

  deletedTableBody.innerHTML = accounts
    .map((d) => `
      <tr>
        <td>${d.email}</td>
        <td>${formatDate(d.deletedAt)}</td>
        <td>${formatDate(d.eligibleAt)}</td>
        <td>${d.allowed ? "해제됨" : `제한중 (${d.remainingDays}일 남음)`}</td>
      </tr>
    `)
    .join("");
}

async function loadDeletedAccounts() {
  deletedStatusEl.textContent = "탈퇴 회원 목록을 불러오는 중...";
  deletedStatusEl.classList.remove("is_error");
  deletedTableBody.innerHTML = "";

  try {
    const result = await adminListDeletedAccountsFn();
    const accounts = result.data?.accounts || [];
    deletedCountEl.textContent = `총 ${accounts.length.toLocaleString("ko-KR")}명`;
    renderDeletedRows(accounts);
    deletedStatusEl.textContent = "";
  } catch (error) {
    console.error("[AdminDashboard] 탈퇴 회원 목록 조회 오류:", error);
    deletedStatusEl.textContent = "탈퇴 회원 목록을 불러오지 못했습니다.";
    deletedStatusEl.classList.add("is_error");
  }
}

function openCreditModal(uid) {
  const user = allUsers.find((u) => u.uid === uid);
  if (!user) return;

  creditModalTargetUser = user;
  creditModalTarget.replaceChildren(
    document.createTextNode(`${user.name || "-"} (${user.email}) `),
    document.createElement("br"),
    document.createTextNode(`- 현재 사용 크레딧 ${formatCredit(user.use_credit)} / 총 ${formatCredit(user.max_credit)}`)
  );
  creditDeltaInput.value = "";
  creditReasonInput.value = "";
  creditModalError.textContent = "";
  creditModalOverlay.classList.add("show");
  creditDeltaInput.focus();
}

function closeCreditModal() {
  creditModalOverlay.classList.remove("show");
  creditModalTargetUser = null;
}

async function submitCreditAdjustment() {
  if (!creditModalTargetUser) return;

  const delta = Number(creditDeltaInput.value);
  const reason = creditReasonInput.value.trim();

  if (!delta) {
    creditModalError.textContent = "조정 금액을 입력해주세요. (0은 불가)";
    return;
  }

  if (!reason) {
    creditModalError.textContent = "조정 사유를 입력해주세요.";
    return;
  }

  creditModalSubmitBtn.disabled = true;
  creditModalError.textContent = "";

  try {
    const result = await adminAdjustCreditFn({ uid: creditModalTargetUser.uid, delta, reason });
    const newUseCredit = result.data?.use_credit;

    const target = allUsers.find((u) => u.uid === creditModalTargetUser.uid);
    if (target) {
      target.use_credit = newUseCredit;
    }

    applyFilter();
    closeCreditModal();
  } catch (error) {
    console.error("[AdminDashboard] 크레딧 조정 오류:", error);
    creditModalError.textContent = error?.message || "크레딧 조정 중 오류가 발생했습니다.";
  } finally {
    creditModalSubmitBtn.disabled = false;
  }
}

async function deleteUser(uid) {
  const user = allUsers.find((u) => u.uid === uid);
  if (!user) return;

  const confirmed = window.confirm(
    `${user.name || "-"} (${user.email}) 회원을 삭제하시겠습니까?\n계정이 영구 삭제되며, 30일간 같은 이메일로 재가입이 제한됩니다.`
  );
  if (!confirmed) return;

  try {
    await adminDeleteUserFn({ uid });
    allUsers = allUsers.filter((u) => u.uid !== uid);
    userCountEl.textContent = `총 ${allUsers.length.toLocaleString("ko-KR")}명`;
    applyFilter();
    loadDeletedAccounts();
  } catch (error) {
    console.error("[AdminDashboard] 회원 삭제 오류:", error);
    alert(error?.message || "회원 삭제 중 오류가 발생했습니다.");
  }
}

tableBody.addEventListener("click", (event) => {
  const adjustBtn = event.target.closest(".btn_adjust_credit");
  if (adjustBtn) {
    openCreditModal(adjustBtn.dataset.uid);
    return;
  }

  const deleteBtn = event.target.closest(".btn_delete_user");
  if (deleteBtn) {
    deleteUser(deleteBtn.dataset.uid);
  }
});

creditModalCancelBtn.addEventListener("click", closeCreditModal);
creditModalSubmitBtn.addEventListener("click", submitCreditAdjustment);
creditModalOverlay.addEventListener("click", (event) => {
  if (event.target === creditModalOverlay) closeCreditModal();
});

searchInput.addEventListener("input", applyFilter);
refreshBtn.addEventListener("click", () => {
  loadUsers();
  loadDeletedAccounts();
});
logoutBtn.addEventListener("click", adminLogout);

requireLogin((user) => {
  adminEmailEl.textContent = user.email || "";
  loadUsers();
  loadDeletedAccounts();
});
