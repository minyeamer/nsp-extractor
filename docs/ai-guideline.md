# AI 작업 가이드라인

## ⚠️ 반드시 준수할 것

---

## 1. Python 실행 환경

| 항목 | 내용 |
|------|------|
| Shell | **Command Prompt (cmd.exe) 만 사용** |
| 가상환경 | `conda activate main` (base가 아닌 **main** 환경) |
| 작업 경로 | `<프로젝트 루트 경로>` |
| 금지 | PowerShell, `&&` 연산자 (cmd에서는 사용 가능, PS에서는 불가) |

### 실행 템플릿
```
cmd /c "cd /d <프로젝트 루트 경로> && conda activate main && python [파일명]"
```

### 가상환경 확인
```
cmd /c "conda activate main && conda info --envs"
```
→ `main` 옆에 `*` 마크 확인 필수

### ⚠️ conda activate가 base로 유지되는 경우 (자주 발생)
`conda activate main`을 해도 base 환경이 유지될 때는 **절대 경로로 직접 실행**:
```
cmd /c "<conda envs 경로>\main\python.exe [파일명]"
```
또는 스크립트 실행 시:
```
cmd /c "cd /d <프로젝트 루트 경로> && <conda envs 경로>\main\python.exe [파일명]"
```

---

## 2. 크롬 확장 프로그램 로드

1. `chrome://extensions/` 접속
2. **개발자 모드** 토글 ON
3. **"압축해제된 확장프로그램을 로드합니다"** 클릭
4. `<프로젝트 루트 경로>/extension` 폴더 선택
5. 코드 수정 후 확장 프로그램 페이지에서 **새로고침(↻)** 버튼 클릭

---

## 3. 네이버 자동화 차단 대응

- 크롬 확장 프로그램은 실제 사용자 프로필/쿠키 사용 → 자동화 차단 회피
- API 요청 간 딜레이: **최소 1500ms** 유지 (429 방지)
- 429 에러 시 딜레이를 3000ms 이상으로 자동 증가
- User-Agent 수정 금지 (실제 브라우저 UA 그대로 사용)
- 과거 이력: Playwright headless 방식은 429 에러 발생 → **확장 프로그램 방식 채택**

---

## 4. 핵심 API 엔드포인트

```
https://brand.naver.com/n/v2/channels/{channel_uid}/products/{product_id}?withWindow=false
```

### 데이터 추출 전략 (우선순위)
1. **1순위**: `fetch()` 인터셉트 → `/n/v2/channels/.../products/...` API 응답 캡처
2. **2순위**: `window.__PRELOADED_STATE__` 직접 읽기 (content_script)
3. **3순위**: HTML `<script>` 태그 내 PRELOADED_STATE JSON 파싱

---

## 5. 작업 연속성 규칙

- **작업 시작 시**: `chat.log` 내용 먼저 확인
- **작업 완료 시**: `chat.log`에 반드시 아래 항목을 기록:
  - 작업 내용 요약
  - 코드 작성 의도 및 핵심 설계 결정 사항
  - 시행착오 및 실패한 접근 방법
  - 발견한 문제와 해결 방법
  - 미해결 문제 및 다음 단계
- **주요 발견사항**: 즉시 기록 (에러 원인, 해결 방법 등)
- **파일 작성**: 에디터 도구 사용 (터미널로 파일 작성 금지)
- **매 채팅 세션 종료 전** chat.log 업데이트 필수

---

## 7. 크롬 브라우저 직접 실행 (디버깅용)

```
"C:\Program Files\Google\Chrome\Application\chrome.exe" --user-data-dir="<Chrome 사용자 데이터 경로>"
```

- 사용자 프로필에 아이템스카우트 확장 프로그램 설치됨 (`history/itemscout/`와 동일)
- Service Worker 디버깅: `chrome://extensions/` → NSP-Extractor → "Service Worker" 클릭

---

## 8. 핵심 기술 인사이트 (아이템스카우트 역분석)

### ❌ 실패한 방식 (절대 사용 금지)
- content_script에서 `fetch()` 인터셉트 → **타이밍 이슈, PRELOADED_STATE 없음**
- Playwright headless → **429 Too Many Requests**

### ✅ 아이템스카우트가 사용하는 방식
1. **`declarativeNetRequest` 동적 규칙 추가** (background.js에서)
   - `Referer` 헤더를 해당 스토어 URL로 설정
   - `sec-ch-ua`, `sec-fetch-*` 헤더를 실제 브라우저 값으로 설정
   - `credentials: 'include'` 로 쿠키 포함 요청
2. **background.js에서 직접 `fetch()`** 로 API 호출
   - SmartStore: `https://smartstore.naver.com/i/v2/channels/{uid}/products/{id}?withWindow=false`
   - BrandStore: `https://brand.naver.com/n/v2/channels/{uid}/products/{id}?withWindow=false`
3. **Channel UID 획득**:
   - SmartStore: `GET /i/v1/smart-stores?url={storeSlug}` → `channel.channelUid`
   - BrandStore: `GET /n/v1/channels?brandUrl={storeSlug}` → `channel.channelUid`
4. **규칙 ID 관리**: 1~30 범위에서 순환 사용 (충돌 방지)

---

## 6. 프로젝트 구조

```
<프로젝트 루트 경로>/
├── extension/              ← 크롬 확장 프로그램 폴더 (이걸 Chrome에서 로드)
│   ├── manifest.json
│   ├── background.js
│   ├── content_script.js
│   ├── popup.html
│   ├── popup.css
│   ├── popup.js
│   └── icons/
│       ├── icon16.png
│       ├── icon48.png
│       └── icon128.png
├── build_min.js            ← 난독화 빌드 스크립트
├── package.json
├── README.md
├── docs/
│   ├── ai-guideline.md     ← 이 파일
│   └── chat.log            ← 작업 로그
└── history/                ← 참고용 (과거 개발 이력)
    ├── itemscout/          ← 아이템스카우트 원본 확장 프로그램
    ├── new_extension/      ← 과거 개발 시도 (Python 서버 방식 - 실패)
    ├── python_script/      ← 과거 Python 스크립트들
    ├── smartstore/         ← 참고용 API 응답 샘플
    └── products/urls.txt   ← 테스트 URL 목록
```
