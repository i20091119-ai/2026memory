# 토러스와 즐기는 랜덤 메모리 게임

4개의 100파이 아케이드 버튼(빨강·노랑·초록·파랑)으로 플레이하는 기억력 게임.
아두이노 우노 Q + 보조모니터로 만든 실물 게임기에서 돌아가고,
**같은 코드가 일반 브라우저에서 키보드로도 그대로 플레이된다.**

```
1차 색깔 → 2차 숫자 → 3차 모양   (각 5단계, 목숨 3개 공유)
```

n단계에서는 n개를 외운다. 오답이 나오면 목숨이 하나 줄고 같은 단계를
**새로운 시퀀스**로 다시 낸다. 목숨이 0이 되면 게임 오버 —
초록 버튼으로 죽은 차수부터 이어하거나, 빨강 버튼으로 처음부터 다시 할 수 있다.

## 바로 해보기

**https://i20091119-ai.github.io/2026memory/** 에서 바로 할 수 있다.

직접 띄우려면:

```bash
python3 -m http.server 8000
# 브라우저에서 http://localhost:8000
```

키보드 **1 2 3 4** = 빨강·노랑·초록·파랑. 화면의 버튼·카드를 마우스나 터치로 직접 눌러도 된다.

> 빌드 단계가 없다. 저장소를 그대로 정적 서빙하면 끝이다.
> (파일을 직접 여는 `file://` 방식은 ES 모듈 제약 때문에 동작하지 않는다 — 위 명령을 쓸 것.)

## 조작

| | |
|---|---|
| 1차 회상 | 외운 색 순서대로 해당 색 버튼을 누른다 |
| 2·3차 회상 | 4지선다 — 외운 숫자/모양이 들어 있는 칸의 **색 버튼**을 누른다 |
| 화면 넘기기 | 차수 안내는 **아무 버튼이나 누를 때까지 기다린다** (자동으로 넘어가지 않는다) |
| 홈으로 나가기 | **빨강 + 파랑을 2초 동안 함께** (화면 위쪽에 게이지가 찬다). 브라우저에서는 **ESC** 로도 된다 |
| 입력 제한시간 | 없음 |

회상 중에는 화면 가운데 **답안 스트립**이 있어, 이번 단계가 몇 개짜리인지와
지금까지 무엇을 눌렀는지를 함께 보여 준다 (예: `4` `5` `7` `_` `_` — "5개 중 4번째").
틀리면 놓친 자리에 정답이 빨갛게 밝혀진다.

## 개발용 URL 옵션

| 옵션 | 효과 |
|---|---|
| `?game=3&level=4` | 해당 차수·단계에서 바로 시작 |
| `?fast=1` | 연출 타이밍을 1/3로 단축 (반복 확인용) |
| `?cursor=1` | 마우스 커서를 되살린다 (기본은 키오스크용으로 숨김) |

프로덕션 키오스크는 파라미터 없는 URL 로 뜨므로 자연히 비활성화된다.

## 테스트

게임 규칙(시퀀스 생성·4지선다 보기 생성·판정·상태 전이)은 `js/games.js` 에
**DOM 무의존 순수 함수**로 분리해 두었다. 그래서 별도 도구 없이 노드 내장 러너로 돌아간다.

```bash
node --test          # 38개 테스트
```

## 저장소 구조

게임 파일이 저장소 루트에 있다. GitHub Pages 를 루트로 배포하면 주소가 곧 게임이
되고, 하위 폴더 설정이나 리다이렉트가 필요 없다.

```
index.html              # 진입점
style.css
favicon.svg
fonts/                  # 로컬 번들 웹폰트 (CDN 미사용)
js/
├── config.js           # 모든 튜닝 상수 (난이도·타이밍) — 조정은 여기서만
├── strings.js          # 모든 화면 문구 — 문구 수정은 여기서만
├── games.js            # 게임 규칙 순수 함수 (테스트 대상)
├── state.js            # 상태 머신 메인 루프
├── main.js             # 부트스트랩·키오스크 설정
├── input.js            # KeyboardInput / SocketInput 추상화
├── audio.js            # Web Audio 효과음 합성 (외부 음원 없음)
├── mascot.js           # 타이틀 로봇 캐릭터 SVG
├── torus.js            # 게임 중 안내자 토러스 SVG + 표정 상태
├── shapes.js           # 3차 도형 8종 SVG
├── storage.js          # 최고기록 저장/로드
├── util.js             # DOM·대기 도우미 (중도 이탈 신호 포함)
└── scenes/             # title, intro, present, recall, feedback, gameover,
                        #   allclear, attract, hud, strip(답안 스트립)
firmware/button_bridge/ # 우노 Q 버튼 → WebSocket 브리지
├── sketch/sketch.ino   # STM32: 버튼 읽기 + 디바운스
└── python/main.py      # 리눅스: WebSocket 서버
docs/hardware-guide.md  # 실물 조립·설치 가이드
test/games.test.js      # node --test
```

설계명세서 §2 는 `web/` 하위에 두도록 되어 있으나, GitHub Pages 를 루트로 배포해도 바로 열리도록 저장소 루트로 옮겼다. 파일 구성 자체는 그대로다. 또 §2 목록에 더해 `shapes.js`(도형 SVG)와 `util.js`(공통 도우미),
`scenes/hud.js`·`scenes/attract.js` 를 두었다. 역할 분리를 위한 것으로 의존성은 늘지 않았다.

## 기술 스택

순수 HTML + CSS + ES 모듈 JavaScript. **빌드 도구·번들러·npm 의존성이 없다.**
외부 라이브러리도 CDN 링크도 쓰지 않아 오프라인 키오스크에서 완전히 동작한다.

- 렌더링: DOM + CSS 애니메이션, 필요한 곳만 인라인 SVG
- 저장: localStorage (`torus-memory.best`) — 접근이 막힌 환경에서도 게임은 정상 진행
- 사운드: Web Audio 합성 효과음만 (배경음악 없음, 음원 파일 없음)

### 폰트

제목·큰 문구는 **Do Hyeon(배민 도현체)** 를 `fonts/DoHyeon-Regular.woff2` 로 동봉해 쓴다.

- 라이선스: SIL Open Font License 1.1 (`fonts/OFL.txt` 동봉) — 재배포 허용
- 출처: [google/fonts · ofl/dohyeon](https://github.com/google/fonts/tree/main/ofl/dohyeon)
- 원본 TTF 를 woff2 로 변환해 넣었다 (880KB → 200KB)

설계명세서는 이사만루체를 1순위로 지정했으나, 재배포 조건을 저장소 동봉 방식으로
확인하기 어려워 명세서가 대체 후보로 열어 둔 OFL 서체 중 하나를 골랐다.
바꾸려면 `fonts/` 에 woff2 를 넣고 `style.css` 의 `@font-face` 한 곳만 고치면 된다.

## 실물 게임기

조립·배선·키오스크 설정은 [`docs/hardware-guide.md`](docs/hardware-guide.md),
버튼 브리지는 [`firmware/README.md`](firmware/README.md) 참조.

웹앱은 시작할 때 `ws://localhost:8765` 접속을 시도하고, 실패하면 **조용히 키보드 모드로만
동작한다**(에러 화면이 뜨지 않는다). 접속 여부는 화면 오른쪽 아래 점으로만 표시된다 —
초록이면 연결됨, 회색이면 미연결.

## GitHub Pages 배포

저장소 **Settings → Pages** 에서

- Source: `Deploy from a branch`
- Branch: 배포할 브랜치 + 폴더 **`/`(root)**

로 지정하면 끝이다. 게임이 저장소 루트에 있으므로 주소가 곧 게임이 된다.

> 게임 파일을 하위 폴더(예전의 `web/`)에 두면, Pages 폴더 설정을 그 폴더로
> 정확히 맞추지 않는 한 루트에 `index.html` 이 없어 GitHub 이 `README.md` 를
> 대신 렌더링한다 — 게임 대신 이 문서가 뜬다. 그 함정을 없애려고 루트에 두었다.

빌드 단계가 없으므로 워크플로 설정은 필요 없다.
`.nojekyll` 은 Pages 가 파일을 Jekyll 로 가공하지 않고 그대로 서빙하게 한다.
