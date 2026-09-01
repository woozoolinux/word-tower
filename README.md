# Word Tower 🏰

초등학생용 영어 단어 학습 게임. 미로 → 몬스터 배틀 → 달리기로 탑을 한 층씩 정복하며 단어를 익힙니다.
브라우저만 있으면 됩니다 (설치·서버 없음).

| 문서 | 내용 |
|---|---|
| [PLAN.md](PLAN.md) | 왜 이렇게 만들었나 (설계) |
| [CHANGELOG.md](CHANGELOG.md) | 무엇이 언제 바뀌었나 |
| [BACKLOG.md](BACKLOG.md) | 앞으로 할 것 |
| [js/balance.js](js/balance.js) | 난이도·보상 수치 (여기만 고치면 밸런스가 바뀜) |

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

## 개발 루틴

파일을 고쳤으면 **커밋 전에 한 줄**:

```bash
node tools/bump.js      # 캐시 번호 v+1 + 검사까지 한 번에
```

`index.html`의 `?v=` 번호를 전부 같이 올려 줍니다. 하나라도 빠뜨리면 아이 폰에
새 파일과 낡은 파일이 섞여 로드돼 게임이 반쯤 깨지는데, 그걸 막는 장치입니다.
(특정 번호로 맞추려면 `node tools/bump.js 25`)

타워 데이터만 손봤을 때는 검사만 돌려도 됩니다:

```bash
node tools/validate.js   # 타워 데이터 + index.html 검사
node tools/test.js       # 회귀 테스트 66개 (밸런스·층 구성·출제·카드·오라·저장)
```

검사 내용 — 타워 id 중복·형식, 단어 중복, 단원 번호 중복, 단어 8개 미만,
뜻이 겹쳐 오답 보기가 안 되는 단어, `auras` 이름·개수, `tier`/`lvRange`/`clearBonus` 형식,
그리고 `index.html`에 빠진 `<script>` 태그와 섞인 캐시 번호.

## 진행이 날아가는 걸 막는 장치

- **자동 백업** — 불러오기·초기화·저장 손상 직전의 상태를 하나 보관합니다.
  로비 → 💾 저장코드 → 🩹 백업에서 되돌릴 수 있어요.
- **회귀 테스트** — `node tools/test.js`. PLAN.md의 밸런스 검증표를 코드로 옮겨 놨어요.
  수식을 고쳤는데 여기가 깨지면, 기획 의도와 어긋났다는 뜻입니다.
- **세이브 버전** — `js/state.js`의 `SAVE_VERSION` + `MIGRATIONS`.
  저장 구조에서 **필드의 뜻이 바뀔 때만** 버전을 +1 하고 변환 함수를 추가합니다.
  필드를 더하기만 하는 변경은 `fillShape()`가 알아서 채우니 그냥 두면 됩니다.
