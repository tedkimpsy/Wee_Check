# Wee Check

학교 현장에서 학생이 `등교/하교 → 학년 → 반 → 이름` 순서로 직접 선택하는 간단한 출입 확인 웹 앱입니다. 얼굴 정보, QR, NFC는 사용하지 않습니다.

## 로컬 실행

Node.js 20 이상이 필요합니다.

```bash
npm install
npm run dev
```

터미널에 표시되는 주소(기본값 `http://localhost:5173`)를 브라우저에서 엽니다.

## 배포용 빌드

```bash
npm run build
npm run preview
```

현재 학생 명단은 `src/App.tsx`의 예시 데이터로 동작합니다. 다음 개발 단계에서 관리자 화면과 데이터베이스를 연결하면 학교별 명단을 직접 등록하고 수정할 수 있습니다.
