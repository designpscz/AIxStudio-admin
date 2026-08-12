import { app, auth } from "./firebaseconfig.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";
import { getFunctions } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-functions.js";

export const functions = getFunctions(app, "asia-northeast3");

// 로그인 안 된 상태로 접근하면 로그인 페이지로 보냄. 콜백은 로그인된 user로 호출됨.
// requireLogin/adminLogout은 admin 루트(index.html)에서만 호출되므로 상대경로는 그 위치 기준.
export function requireLogin(onReady) {
  onAuthStateChanged(auth, (user) => {
    if (!user) {
      window.location.replace("pages/login.html");
      return;
    }
    onReady(user);
  });
}

// 이미 로그인된 상태로 로그인 페이지에 접근하면 대시보드로 보냄.
// pages/login.html에서만 호출되므로 상대경로는 그 위치(한 단계 하위) 기준.
export function redirectIfLoggedIn() {
  onAuthStateChanged(auth, (user) => {
    if (user) {
      window.location.replace("../index.html");
    }
  });
}

export async function adminLogout() {
  await signOut(auth);
  window.location.replace("pages/login.html");
}
