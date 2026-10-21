// 서비스(aixstudio-modal-codex)의 js/common/aix_dialog.js와 같은 파일이다. 서비스와 관리자 화면의
// 안내창 모양을 맞추기 위해 복사해 쓰므로, 한쪽을 고치면 다른 쪽에도 함께 옮긴다.
//
// 브라우저 기본 alert/confirm 대신 쓰는 공통 안내창.
// 크레딧 부족 안내창(credit_alert.js)과 같은 모양으로 그리고, 닫힐 때 resolve되는 Promise를 돌려준다.
// alert처럼 다음 코드가 사용자의 확인 뒤에 실행돼야 하면 await으로 기다린다.
//   await showAlert("저장되었습니다.");
//   if (await showConfirm("해지할까요?", { confirmText: "해지하기", danger: true })) { ... }

const STYLE_ID = "aix-dialog-style";

const STYLE_TEXT = `
.aix_dialog_backdrop {
  position: fixed; inset: 0; z-index: 10001;
  display: flex; align-items: center; justify-content: center;
  padding: 16px; background: rgba(15, 23, 42, 0.55);
}
.aix_dialog {
  width: 100%; max-width: 380px; box-sizing: border-box;
  padding: 28px 24px 20px; border-radius: 16px; background: #fff;
  box-shadow: 0 24px 48px rgba(15, 23, 42, 0.2);
  font-family: inherit; text-align: center;
}
.aix_dialog_title {
  margin: 0 0 8px; font-size: 17px; font-weight: 700; color: #111827;
}
.aix_dialog_message {
  margin: 0 0 24px; font-size: 14px; line-height: 1.6; color: #4b5563;
  white-space: pre-line; word-break: keep-all;
}
.aix_dialog_title[hidden] + .aix_dialog_message { margin-top: 4px; font-size: 15px; color: #1f2937; }
.aix_dialog_actions { display: flex; gap: 8px; }
.aix_dialog_actions button {
  flex: 1; height: 44px; border: 0; border-radius: 10px;
  font-family: inherit; font-size: 15px; font-weight: 600; cursor: pointer;
}
.aix_dialog_cancel { background: #f3f4f6; color: #374151; }
.aix_dialog_cancel:hover { background: #e5e7eb; }
.aix_dialog_confirm { background: #1a67fb; color: #fff; }
.aix_dialog_confirm:hover { background: #1557d8; }
.aix_dialog_confirm.is_danger { background: #212121; }
.aix_dialog_confirm.is_danger:hover { background: #3a3a3a; }
`;

function ensureStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = STYLE_TEXT;
  document.head.appendChild(style);
}

// 안내창이 겹치지 않도록 앞의 창이 닫힌 뒤에 다음 창을 연다.
let queue = Promise.resolve();

function openDialog({ title, message, confirmText, cancelText, danger }) {
  const run = () => new Promise((resolve) => {
    ensureStyle();

    const backdrop = document.createElement("div");
    backdrop.className = "aix_dialog_backdrop";
    backdrop.innerHTML = `
      <div class="aix_dialog" role="alertdialog" aria-modal="true"
        aria-labelledby="aixDialogTitle" aria-describedby="aixDialogMessage">
        <p class="aix_dialog_title" id="aixDialogTitle"></p>
        <p class="aix_dialog_message" id="aixDialogMessage"></p>
        <div class="aix_dialog_actions">
          ${cancelText ? '<button type="button" class="aix_dialog_cancel"></button>' : ""}
          <button type="button" class="aix_dialog_confirm"></button>
        </div>
      </div>
    `;

    const titleEl = backdrop.querySelector(".aix_dialog_title");
    titleEl.textContent = title || "";
    titleEl.hidden = !title;
    backdrop.querySelector(".aix_dialog_message").textContent = String(message ?? "");
    const confirmBtn = backdrop.querySelector(".aix_dialog_confirm");
    confirmBtn.textContent = confirmText;
    confirmBtn.classList.toggle("is_danger", Boolean(danger));
    const cancelBtn = backdrop.querySelector(".aix_dialog_cancel");
    if (cancelBtn) cancelBtn.textContent = cancelText;

    const previousFocus = document.activeElement;
    const close = (result) => {
      document.removeEventListener("keydown", onKeyDown, true);
      backdrop.remove();
      if (previousFocus && typeof previousFocus.focus === "function") previousFocus.focus();
      resolve(result);
    };
    // Esc·바깥 클릭은 "취소"로 본다 (확인창이 아니면 그냥 닫기).
    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        close(false);
      }
    };

    confirmBtn.addEventListener("click", () => close(true));
    if (cancelBtn) cancelBtn.addEventListener("click", () => close(false));
    backdrop.addEventListener("click", (event) => {
      if (event.target === backdrop) close(false);
    });
    document.addEventListener("keydown", onKeyDown, true);

    document.body.appendChild(backdrop);
    confirmBtn.focus();
  });

  const result = queue.then(run);
  queue = result.catch(() => {});
  return result;
}

export function showAlert(message, { title = "", confirmText = "확인" } = {}) {
  return openDialog({ title, message, confirmText }).then(() => undefined);
}

export function showConfirm(message, { title = "", confirmText = "확인", cancelText = "취소", danger = false } = {}) {
  return openDialog({ title, message, confirmText, cancelText, danger });
}
