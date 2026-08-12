import { initializeApp } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";

// aixstudio-modal과 동일한 Firebase 프로젝트(aiproductpage)를 사용합니다.
const FIREBASE_CONFIG_B64 = "eyJhcGlLZXkiOiJBSXphU3lEMi1KR1RFQVBFRm1MZWNnbkx3ZTNQemg5aDBTMHBvVWciLCJhdXRoRG9tYWluIjoiYWlwcm9kdWN0cGFnZS5maXJlYmFzZWFwcC5jb20iLCJwcm9qZWN0SWQiOiJhaXByb2R1Y3RwYWdlIiwic3RvcmFnZUJ1Y2tldCI6ImFpcHJvZHVjdHBhZ2UuZmlyZWJhc2VzdG9yYWdlLmFwcCIsIm1lc3NhZ2luZ1NlbmRlcklkIjoiOTMwMjk2NjQxNjgyIiwiYXBwSWQiOiIxOjkzMDI5NjY0MTY4Mjp3ZWI6MzZmODIyNDg5N2NhNmEwMjA4OGU0YiJ9";

function parseCfgFromB64(b64) {
  if (!b64) {
    throw new Error("[ENV] Missing Firebase config B64");
  }

  const cleaned = String(b64)
    .trim()
    .replace(/^["']|["']$/g, "")
    .replace(/\s+/g, "");

  let decoded = "";

  try {
    decoded = atob(cleaned);
  } catch (err) {
    throw new Error("[ENV] Invalid Firebase config B64");
  }

  try {
    return JSON.parse(decoded);
  } catch (err) {
    throw new Error("[ENV] Invalid Firebase config JSON");
  }
}

const firebaseConfig = parseCfgFromB64(FIREBASE_CONFIG_B64);

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const auth = getAuth(app);
export { app };
