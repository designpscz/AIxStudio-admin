# AIxStudio Admin

AIxStudio(aiproductpage) 서비스의 회원 관리를 위한 정적 관리자 웹 페이지입니다. Firebase Authentication으로 로그인하고, Firebase Cloud Functions(callable)를 통해 회원 목록 조회, 크레딧 조정, 회원 삭제, 탈퇴 회원 관리 기능을 제공합니다.

## 주요 기능

- **로그인** (`pages/login.html`, `js/login.js`) — Firebase Auth 이메일/비밀번호 로그인, 이미 로그인된 경우 대시보드로 리다이렉트
- **회원 목록 조회** — `adminListUsers` callable function 호출, 이름/이메일 검색 필터링
- **크레딧 조정** — `adminAdjustCredit` callable function 호출, 모달을 통해 증감액과 사유 입력
- **회원 삭제** — `adminDeleteUser` callable function 호출, 삭제 시 30일간 동일 이메일 재가입 제한
- **탈퇴 회원 관리** — `adminListDeletedAccounts` callable function으로 탈퇴 회원 및 재가입 가능일 조회

## 기술 스택

- Vanilla JS(ES Modules), HTML, CSS — 별도 빌드 도구 없음
- Firebase SDK v12 (CDN, `gstatic.com`에서 직접 import)
  - Firebase Authentication
  - Firebase Cloud Functions (callable, 리전: `asia-northeast3`)
  - Firebase Firestore (`getFirestore` 초기화만 되어 있음, 현재 코드에서 직접 사용처는 없음)

## 프로젝트 구조

```
index.html              대시보드(회원 관리) 메인 페이지
pages/login.html         로그인 페이지
css/admin.css            전체 스타일
js/firebaseconfig.js     Firebase 프로젝트 설정 (base64 인코딩된 공개 클라이언트 설정)
js/admin_auth.js         로그인 상태 체크, 리다이렉트, 로그아웃 공통 로직
js/login.js              로그인 폼 처리
js/dashboard.js          회원 목록/탈퇴 회원 렌더링, 크레딧 조정, 삭제 처리
```

## 인증/권한 흐름

1. `index.html` 접근 시 `requireLogin()`으로 로그인 여부 확인, 미로그인 시 `pages/login.html`로 이동
2. 로그인 성공 시 `index.html`로 리다이렉트
3. 실제 관리자 권한 검증은 클라이언트가 아닌 Firebase Cloud Functions(callable) 쪽에서 수행되며, 권한이 없으면 `functions/permission-denied` 오류로 응답 → 클라이언트는 알림 후 자동 로그아웃

> 이 저장소에는 Cloud Functions 소스가 포함되어 있지 않습니다. `adminListUsers`, `adminAdjustCredit`, `adminDeleteUser`, `adminListDeletedAccounts` 함수는 별도 백엔드 저장소/프로젝트에서 관리되는 것으로 보입니다.

## 실행 방법

빌드 과정이 없는 정적 사이트이므로, 정적 파일 서버로 루트 디렉터리를 서빙하면 됩니다.

```bash
npx serve .
```

이후 브라우저에서 `index.html`(또는 서버가 안내하는 URL)로 접속합니다. 로그인이 되어 있지 않으면 자동으로 로그인 페이지로 이동합니다.

## 참고 사항

- `js/firebaseconfig.js`의 `FIREBASE_CONFIG_B64`는 Firebase 클라이언트 SDK 설정값(apiKey, authDomain 등)으로, 클라이언트에 공개되는 것이 정상이며 서버 비밀키가 아닙니다.
- 실제 접근 제어는 Firebase Auth 로그인 여부 + 서버 측(Cloud Functions) 관리자 권한 체크로 이중으로 이뤄집니다.
