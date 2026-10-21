import { httpsCallable } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-functions.js";
import { requireLogin, adminLogout, functions } from "./admin_auth.js";
import { showAlert, showConfirm } from "./common/aix_dialog.js";

const tableBody = document.getElementById("userTableBody");
const searchInput = document.getElementById("userSearch");
const statusEl = document.getElementById("dashboardStatus");
const userCountEl = document.getElementById("userCount");
const pendingCountEl = document.getElementById("pendingCount");
const refreshBtn = document.getElementById("refreshBtn");
const marketingCountEl = document.getElementById("marketingCount");
const marketingExportBtn = document.getElementById("marketingExportBtn");
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
const adminApproveUserFn = httpsCallable(functions, "adminApproveUser");
const adminAllowRejoinFn = httpsCallable(functions, "adminAllowRejoin");

let allUsers = [];
let deletedAccounts = [];
let creditModalTargetUser = null;

// 이름·이메일·회사명은 가입자가 입력한 값이라 그대로 innerHTML에 넣으면 스크립트가 관리자 권한으로
// 실행될 수 있다(B2B 초대 링크로 외부인이 가입할 수 있으므로 특히 중요). 화면에 넣는 값은 전부 이스케이프한다.
function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatCredit(value) {
  return Math.max(0, Number(value) || 0).toLocaleString("ko-KR");
}

// 서버가 내려주는 날짜는 ms 숫자, 초 숫자, ISO 문자열, Firestore Timestamp({seconds}/{_seconds})처럼
// 형태가 제각각이다. 화면과 CSV가 같은 값을 쓰도록 한 곳에서 Date로 맞춘다.
function toDate(value) {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;

  // Firestore Timestamp가 JSON으로 오면 초 단위 필드만 남는다
  if (typeof value === "object") {
    const seconds = Number(value.seconds ?? value._seconds);
    return Number.isFinite(seconds) ? new Date(seconds * 1000) : null;
  }

  // 숫자(숫자만 담긴 문자열 포함). 13자리는 ms, 10자리는 초로 본다.
  if (typeof value === "number" || /^\d+$/.test(String(value))) {
    const num = Number(value);
    return Number.isFinite(num) ? new Date(num < 1e12 ? num * 1000 : num) : null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDate(value) {
  const date = toDate(value);
  return date ? date.toLocaleDateString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit" }) : "-";
}

function isPending(user) {
  return user.approved === false;
}

// 회사명이 없는 회원(구글 가입 등 B2C)은 개인으로 표시한다.
function companyLabel(user) {
  return String(user.company || "").trim() || "개인";
}

// 로그인 방법. 서버가 계정에 연결된 목록(providers)을 내려준다. 같은 이메일이면 구글과 이메일이
// 한 계정으로 연동되므로 두 개가 같이 올 수 있다. 목록이 없으면 가입 경로(signup_provider)를 쓰고,
// 그것도 없는 기존 회원은 구글 로그인이 생기기 전에 가입했으므로 이메일 가입으로 본다.
const PROVIDER_LABELS = {
  "google.com": "구글",
  password: "이메일",
  kakao: "카카오",
  naver: "네이버",
};

// 이 계정으로 로그인할 수 있는 방법들
function userProviders(user) {
  const linked = Array.isArray(user.providers) ? user.providers.filter(Boolean) : [];
  if (linked.length) return linked;

  return [String(user.signup_provider || "").trim() || "password"];
}

// 검색창에서 '구글'·'이메일'로 찾을 수 있게 이름을 이어 붙인다
function providerLabel(user) {
  return userProviders(user)
    .map((provider) => PROVIDER_LABELS[provider] || provider)
    .join(" ");
}

// Firebase 콘솔처럼 아이콘으로 보여준다. 규칙에 없는 경로(카카오 등)는 글자 배지로 남긴다.
const PROVIDER_ICONS = {
  "google.com": `<svg viewBox="0 0 48 48" aria-hidden="true" focusable="false">
    <path fill="#4285F4" d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z"/>
    <path fill="#34A853" d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46z"/>
    <path fill="#FBBC05" d="M11.69 28.18C11.25 26.86 11 25.45 11 24s.25-2.86.69-4.18v-5.7H4.34C2.85 17.09 2 20.45 2 24s.85 6.91 2.34 9.88l7.35-5.7z"/>
    <path fill="#EA4335" d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.96 6.93 4.34 14.12l7.35 5.7c1.73-5.2 6.58-9.07 12.31-9.07z"/>
  </svg>`,
  password: `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path fill="#5f6368" d="M20 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2zm0 4.2-8 4.8-8-4.8V6l8 4.8L20 6v2.2z"/>
  </svg>`,
};

function renderProviderCell(user) {
  return userProviders(user)
    .map((provider) => {
      const label = escapeHtml(PROVIDER_LABELS[provider] || provider);
      const icon = PROVIDER_ICONS[provider];

      // 아이콘이 없는 경로(카카오 등)는 글자 배지로 보여준다
      if (!icon) return `<span class="provider_badge">${label}</span>`;

      return `<span class="provider_icon" role="img" aria-label="${label}" title="${label}">${icon}</span>`;
    })
    .join("");
}

function renderStatusCell(user) {
  if (isPending(user)) {
    return `<span class="status_badge status_badge_pending">승인 대기</span>`;
  }
  return `<span class="status_badge status_badge_approved">승인됨</span>`;
}

function renderCreditCell(user) {
  const base = `${formatCredit(user.use_credit)} / ${formatCredit(user.max_credit)}`;
  if (isPending(user)) {
    return `${base}<br><span class="pending_credit">승인 시 ${formatCredit(user.pending_credit)} 지급</span>`;
  }
  return base;
}

// 마케팅 정보 수신 동의 여부. 동의한 회원은 동의일을 함께 보여준다.
function renderMarketingCell(user) {
  if (!user.marketing_opt_in) return `<span class="marketing_off">-</span>`;
  const since = user.marketing_consent_at ? formatDate(user.marketing_consent_at) : "";
  return `<span class="marketing_badge">동의</span>${since ? `<br><span class="marketing_since">${since}</span>` : ""}`;
}

function renderActionCell(user) {
  const uid = escapeHtml(user.uid);

  if (isPending(user)) {
    return `
      <button type="button" class="btn_approve_user" data-uid="${uid}">승인</button>
      <button type="button" class="btn_delete_user" data-uid="${uid}" data-reject="1">거절</button>
    `;
  }

  return `
    <button type="button" class="btn_adjust_credit" data-uid="${uid}">크레딧 조정</button>
    <button type="button" class="btn_delete_user" data-uid="${uid}">삭제</button>
  `;
}

function renderRows(users) {
  if (!users.length) {
    tableBody.innerHTML = `<tr><td colspan="10" class="empty_cell">조건에 맞는 회원이 없습니다.</td></tr>`;
    return;
  }

  tableBody.innerHTML = users
    .map((u) => `
      <tr class="${isPending(u) ? "row_pending" : ""}">
        <td class="center_col">${renderStatusCell(u)}</td>
        <td>${escapeHtml(u.name || "-")}</td>
        <td>${escapeHtml(u.email || "-")}</td>
        <td class="center_col">${renderProviderCell(u)}</td>
        <td class="center_col"><span class="plan_badge">${escapeHtml(u.plan || "free")}</span></td>
        <td class="credit_cell">${renderCreditCell(u)}</td>
        <td>${escapeHtml(companyLabel(u))}</td>
        <td class="center_col">${renderMarketingCell(u)}</td>
        <td class="center_col">${formatDate(u.createdAt)}</td>
        <td class="action_cell">${renderActionCell(u)}</td>
      </tr>
    `)
    .join("");
}

function updateCounts() {
  userCountEl.textContent = `총 ${allUsers.length.toLocaleString("ko-KR")}명`;
  if (marketingCountEl) {
    marketingCountEl.textContent = `마케팅 동의 ${getMarketingRecipients().length.toLocaleString("ko-KR")}명`;
  }

  const pending = allUsers.filter(isPending).length;
  if (pendingCountEl) {
    pendingCountEl.textContent = pending ? `승인 대기 ${pending.toLocaleString("ko-KR")}명` : "";
    pendingCountEl.hidden = !pending;
  }
}

function applyFilter() {
  const keyword = searchInput.value.trim().toLowerCase();

  // 승인 대기 회원을 맨 위로 올리고, 각 묶음은 가입일 최신순으로 정렬한다.
  const byNewest = (a, b) => (Number(b.createdAt) || 0) - (Number(a.createdAt) || 0);
  const ordered = [
    ...allUsers.filter(isPending).sort(byNewest),
    ...allUsers.filter((u) => !isPending(u)).sort(byNewest),
  ];

  if (!keyword) {
    renderRows(ordered);
    return;
  }

  const filtered = ordered.filter((u) =>
    String(u.email || "").toLowerCase().includes(keyword) ||
    String(u.name || "").toLowerCase().includes(keyword) ||
    companyLabel(u).toLowerCase().includes(keyword) ||
    providerLabel(u).toLowerCase().includes(keyword)
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
    updateCounts();
    applyFilter();
    statusEl.textContent = "";
    return true;
  } catch (error) {
    console.error("[AdminDashboard] 회원 목록 조회 오류:", error);

    if (error?.code === "functions/permission-denied") {
      statusEl.textContent = "관리자 권한이 없습니다.";
      statusEl.classList.add("is_error");
      await showAlert("관리자 권한이 없습니다.", { title: "접근할 수 없어요" });
      await adminLogout();
      return false;
    }

    statusEl.textContent = "회원 목록을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.";
    statusEl.classList.add("is_error");
    return false;
  } finally {
    refreshBtn.disabled = false;
  }
}

// 마케팅 메일 수신 대상: 동의했고, 이메일이 있고, 가입 승인된 회원
function getMarketingRecipients() {
  return allUsers.filter((u) => u.marketing_opt_in && u.email && !isPending(u));
}

// 스티비 날짜 형식(yyyy-MM-dd)
function formatYmd(value) {
  const date = toDate(value);
  if (!date) return "";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

// CSV 한 칸. 쉼표·따옴표·줄바꿈이 있으면 따옴표로 감싸고, 엑셀이 수식으로 읽는 첫 글자(= + - @)는 막는다.
function csvCell(value) {
  let text = String(value ?? "");
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

// 스티비 주소록 [파일로 추가하기]에 바로 올리는 CSV(UTF-8).
// 이메일 → 이메일 주소, 이름 → 이름, 광고성정보수신동의(Y) → 광고성 정보 수신 동의 필드에 연결한다.
// 마이페이지에서 해제한 회원이 빠지도록 내려받기 직전에 목록을 새로 불러온다.
async function exportMarketingRecipients() {
  marketingExportBtn.disabled = true;
  try {
    // 최신 목록을 못 받으면 예전 목록(해제한 회원 포함 가능)으로 내보내지 않는다
    if (!(await loadUsers())) return;

    if (allUsers.length && !allUsers.some((u) => "marketing_opt_in" in u)) {
      await showAlert("adminListUsers 함수를 새 버전으로 배포해주세요.", { title: "서버가 아직 마케팅 동의 정보를 보내지 않아요" });
      return;
    }

    const recipients = getMarketingRecipients();
    if (!recipients.length) {
      await showAlert("마케팅 정보 수신에 동의한 회원이 없습니다.", { title: "내려받을 목록이 없어요" });
      return;
    }

    // 동의일은 스티비 필수 항목이 아니라 비어도 업로드는 되지만, 비는 이유를 바로 알 수 있게 알려준다
    const missingConsentAt = recipients.filter((u) => !u.marketing_consent_at).length;
    if (missingConsentAt) {
      console.warn(`[AdminDashboard] ${missingConsentAt}명은 동의일이 없어 CSV 동의일 칸이 빕니다. adminBackfillMarketingConsentAt으로 채울 수 있습니다.`);
      statusEl.textContent = `${missingConsentAt}명은 동의일 기록이 없어 CSV의 동의일 칸이 비어 있습니다. (이메일·이름·동의 여부는 정상)`;
    }

    const rows = [
      ["이메일", "이름", "광고성정보수신동의", "동의일"],
      ...recipients.map((u) => [u.email, u.name || "", "Y", formatYmd(u.marketing_consent_at)]),
    ];
    const csv = rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
    // 엑셀에서 열어도 한글이 깨지지 않도록 BOM을 붙인다(스티비는 UTF-8 권장)
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `marketing_optin_${formatYmd(Date.now()).replace(/-/g, "")}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  } finally {
    marketingExportBtn.disabled = false;
  }
}

// 탈퇴 기록을 가리키는 값. 서버가 문서 id를 주면 그걸 쓰고, 없으면 이메일로 찾는다.
function deletedKey(account) {
  return String(account.id || account.email || "");
}

// 제한이 남은 회원만 해제 버튼을 보여준다(이미 풀린 기록은 더 할 일이 없다).
function renderDeletedActionCell(account) {
  if (account.allowed) return "-";
  return `<button type="button" class="btn_allow_rejoin" data-key="${escapeHtml(deletedKey(account))}">제한 해제</button>`;
}

function renderDeletedRows(accounts) {
  if (!accounts.length) {
    deletedTableBody.innerHTML = `<tr><td colspan="5" class="empty_cell">탈퇴한 회원이 없습니다.</td></tr>`;
    return;
  }

  deletedTableBody.innerHTML = accounts
    .map((d) => `
      <tr>
        <td>${escapeHtml(d.email)}</td>
        <td>${formatDate(d.deletedAt)}</td>
        <td>${formatDate(d.eligibleAt)}</td>
        <td>${d.allowed ? "해제됨" : `제한중 (${Number(d.remainingDays) || 0}일 남음)`}</td>
        <td class="action_cell">${renderDeletedActionCell(d)}</td>
      </tr>
    `)
    .join("");
}

// 30일을 기다리지 않고 같은 이메일로 다시 가입할 수 있게 풀어준다.
async function allowRejoin(key, button) {
  const account = deletedAccounts.find((d) => deletedKey(d) === key);
  if (!account || account.allowed) return;

  const confirmed = await showConfirm(
    `${account.email}\n\n` +
    `재가입 가능일: ${formatDate(account.eligibleAt)} (${Number(account.remainingDays) || 0}일 남음)\n` +
    `해제하면 지금 바로 같은 이메일로 다시 가입할 수 있습니다.`,
    { title: "재가입 제한을 해제할까요?", confirmText: "해제하기" }
  );
  if (!confirmed) return;

  if (button) button.disabled = true;

  try {
    await adminAllowRejoinFn(account.id ? { id: account.id, email: account.email } : { email: account.email });
    account.allowed = true;
    account.remainingDays = 0;
    renderDeletedRows(deletedAccounts);
  } catch (error) {
    console.error("[AdminDashboard] 재가입 제한 해제 오류:", error);

    // 서버에 함수가 아직 없으면 원인을 바로 알 수 있게 따로 안내한다
    if (error?.code === "functions/not-found") {
      await showAlert("서버에 adminAllowRejoin 함수가 없습니다. 백엔드 배포 후 다시 시도해주세요.", { title: "해제하지 못했어요" });
    } else {
      await showAlert(error?.message || "재가입 제한 해제 중 오류가 발생했습니다.", { title: "해제하지 못했어요" });
    }

    if (button) button.disabled = false;
  }
}

async function loadDeletedAccounts() {
  deletedStatusEl.textContent = "탈퇴 회원 목록을 불러오는 중...";
  deletedStatusEl.classList.remove("is_error");
  deletedTableBody.innerHTML = "";

  try {
    const result = await adminListDeletedAccountsFn();
    deletedAccounts = result.data?.accounts || [];
    deletedCountEl.textContent = `총 ${deletedAccounts.length.toLocaleString("ko-KR")}명`;
    renderDeletedRows(deletedAccounts);
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

async function approveUser(uid, button) {
  const user = allUsers.find((u) => u.uid === uid);
  if (!user) return;

  const confirmed = await showConfirm(
    `${user.name || "-"} (${user.email})\n\n` +
    `회사: ${companyLabel(user)}\n지급 크레딧: ${formatCredit(user.pending_credit)}`,
    { title: "가입을 승인할까요?", confirmText: "승인하기" }
  );
  if (!confirmed) return;

  if (button) button.disabled = true;

  try {
    const result = await adminApproveUserFn({ uid });
    user.approved = true;
    user.max_credit = Number(result.data?.max_credit) || user.pending_credit;
    user.pending_credit = 0;
    updateCounts();
    applyFilter();
  } catch (error) {
    console.error("[AdminDashboard] 가입 승인 오류:", error);
    await showAlert(error?.message || "가입 승인 중 오류가 발생했습니다.", { title: "승인하지 못했어요" });
    if (button) button.disabled = false;
  }
}

async function deleteUser(uid, isReject) {
  const user = allUsers.find((u) => u.uid === uid);
  if (!user) return;

  const confirmed = await showConfirm(
    `${user.name || "-"} (${user.email})\n\n` +
    `계정이 영구 삭제되며, 30일간 같은 이메일로 재가입이 제한됩니다.`,
    isReject
      ? { title: "가입을 거절할까요?", confirmText: "거절하기", danger: true }
      : { title: "회원을 삭제할까요?", confirmText: "삭제하기", danger: true }
  );
  if (!confirmed) return;

  try {
    await adminDeleteUserFn({ uid });
    allUsers = allUsers.filter((u) => u.uid !== uid);
    updateCounts();
    applyFilter();
    loadDeletedAccounts();
  } catch (error) {
    console.error("[AdminDashboard] 회원 삭제 오류:", error);
    await showAlert(error?.message || "회원 삭제 중 오류가 발생했습니다.", { title: "처리하지 못했어요" });
  }
}

tableBody.addEventListener("click", (event) => {
  const approveBtn = event.target.closest(".btn_approve_user");
  if (approveBtn) {
    approveUser(approveBtn.dataset.uid, approveBtn);
    return;
  }

  const adjustBtn = event.target.closest(".btn_adjust_credit");
  if (adjustBtn) {
    openCreditModal(adjustBtn.dataset.uid);
    return;
  }

  const deleteBtn = event.target.closest(".btn_delete_user");
  if (deleteBtn) {
    deleteUser(deleteBtn.dataset.uid, deleteBtn.dataset.reject === "1");
  }
});

deletedTableBody.addEventListener("click", (event) => {
  const allowBtn = event.target.closest(".btn_allow_rejoin");
  if (allowBtn) {
    allowRejoin(allowBtn.dataset.key, allowBtn);
  }
});

creditModalCancelBtn.addEventListener("click", closeCreditModal);
creditModalSubmitBtn.addEventListener("click", submitCreditAdjustment);
creditModalOverlay.addEventListener("click", (event) => {
  if (event.target === creditModalOverlay) closeCreditModal();
});

searchInput.addEventListener("input", applyFilter);
marketingExportBtn?.addEventListener("click", exportMarketingRecipients);
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
