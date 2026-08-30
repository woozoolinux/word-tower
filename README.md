# Word Tower 🏰

초등학생용 영어 단어 학습 게임. 미로 → 몬스터 배틀 → 달리기로 탑을 한 층씩 정복하며 단어를 익힙니다.
브라우저만 있으면 됩니다 (설치·서버 없음). 기획 내용은 [PLAN.md](PLAN.md).

## 실행

- 온라인: GitHub Pages 링크로 접속
- 로컬: `index.html`을 브라우저로 열기 (또는 `npx serve .`)

## 타워(단어팩) 추가하기

1. `data/` 폴더에 새 파일을 만듭니다. 예: `data/my-book.js`

```js
window.TOWERS = window.TOWERS || [];
window.TOWERS.push({
  id: 'mybook',            // 영문 소문자, 겹치면 안 됨 (저장 키로 쓰임)
  name: '📘 우리 책 타워',
  desc: '3학년 1학기 단어',
  emoji: '📘',
  units: [
    { unit: 1, words: [
      { w: 'apple', m: '사과' },
      { w: 'brave', m: '용감한', pos: 'adj', ex: 'She is brave.' },
      // ... 한 단원에 8~12개 추천
    ]},
    { unit: 2, words: [ /* ... */ ] },
  ],
});
```

2. `index.html`의 `<!-- 타워 데이터 -->` 아래에 한 줄 추가:

```html
<script src="data/my-book.js"></script>
```

끝. 로비에 타워가 나타납니다.

### 규칙
- `w`(영어), `m`(한글 뜻), `unit`은 필수. `pos`, `ex`는 선택.
- 타워 전체 단어가 **최소 8개**는 되어야 보기(오답)가 만들어집니다.
- 단원 1개 = 일반 층 2개. 단원 2개마다 보스 층 1개.
- 예문(`ex`)은 책의 것을 복사하지 말고 직접 쓰세요.

## 저장

진행 상황은 브라우저 localStorage에 자동 저장됩니다. 다른 기기로 옮기려면 로비 → 💾 저장코드.
