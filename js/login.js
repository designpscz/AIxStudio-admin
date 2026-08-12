import { auth } from "./firebaseconfig.js";
import { signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";
import { redirectIfLoggedIn } from "./admin_auth.js";

redirectIfLoggedIn();

const form = document.getElementById("loginForm");
const emailInput = document.getElementById("loginEmail");
const passwordInput = document.getElementById("loginPassword");
const errorEl = document.getElementById("loginError");
const submitBtn = document.getElementById("loginSubmitBtn");

function getFirebaseErrorMessage(error) {
  const code = error?.code || "";

  switch (code) {
    case "auth/invalid-email":
      return "올바른 이메일 형식이 아닙니다.";
    case "auth/user-not-found":
    case "auth/wrong-password":
    case "auth/invalid-credential":
      return "이메일 또는 비밀번호가 일치하지 않습니다.";
    case "auth/too-many-requests":
      return "로그인 시도가 너무 많습니다. 잠시 후 다시 시도해주세요.";
    default:
      return "로그인 중 오류가 발생했습니다.";
  }
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const email = emailInput.value.trim();
  const password = passwordInput.value;

  errorEl.textContent = "";

  if (!email || !password) {
    errorEl.textContent = "이메일과 비밀번호를 입력해주세요.";
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = "로그인 중...";

  try {
    await signInWithEmailAndPassword(auth, email, password);
    window.location.replace("../index.html");
  } catch (error) {
    console.error("[AdminLogin] 로그인 오류:", error);
    errorEl.textContent = getFirebaseErrorMessage(error);
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "로그인";
  }
});
