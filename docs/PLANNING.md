# 미니 React 요구사항

> Virtual DOM부터 Hooks까지 직접 구현하고, 입력과 클릭에 따라 필요한 부분만 갱신되는 웹 페이지를 만들어요.

| 항목 | 내용 |
|---|---|
| 출처 | [LMS 미니 리액트 구현](https://jungle-lms.krafton.com/learning/1258) (2026-11-06 확인, 로그인 필요) |
| 구현 언어 | TypeScript |
| 제한 | HTML, CSS, TypeScript만 사용. React, Vue 같은 외부 프레임워크 금지 |

이 문서는 LMS 내용을 요약한 거예요. 해석이 갈리면 LMS 원문을 따라요. 구현 설계는 `docs/design/`에 따로 작성해요.

## Phase 1. Virtual DOM + Diff + Patch

| ID | 요구사항 |
|---|---|
| R1-1 | 브라우저 DOM을 읽어 Virtual DOM으로 변환해요 |
| R1-2 | 두 Virtual DOM의 차이를 찾는 Diff를 구현해요 |
| R1-3 | 실제 영역과 테스트 영역, Patch·뒤로가기·앞으로가기 버튼이 있는 검증 페이지를 만들어요 |
| R1-4 | 페이지 로드 시 실제 영역을 Virtual DOM으로 바꾸고, 그것으로 테스트 영역을 그려요 |
| R1-5 | 사용자는 테스트 영역의 HTML을 자유롭게 수정할 수 있어요 |
| R1-6 | Patch를 누르면 테스트 영역을 Virtual DOM으로 만들어 이전 것과 비교하고, 변경분만 실제 영역에 반영한 뒤 히스토리에 저장해요 |
| R1-7 | 뒤로가기·앞으로가기로 히스토리를 이동하면 두 영역이 함께 바뀌어요 |

## Phase 2. Component + State + Hooks

| ID | 요구사항 |
|---|---|
| R2-1 | 함수형 컴포넌트를 감싸는 `FunctionComponent` 클래스를 만들어요 (`hooks` 배열, `mount()`, `update()`) |
| R2-2 | Hook과 상태는 루트 컴포넌트에서만 써요 |
| R2-3 | 자식 컴포넌트는 props만 받는 순수 함수로 만들어요 (Lifting State Up) |
| R2-4 | 상태가 바뀌면 화면이 자동으로 다시 그려져요 |
| R2-5 | `useState`, `useEffect`, `useMemo`를 구현해요 |
| R2-6 | 다시 그릴 때 Phase 1의 Virtual DOM, Diff, Patch를 사용해 변경분만 반영해요 |

## 결과물과 품질

| ID | 요구사항 |
|---|---|
| R3-1 | 사용자 입력이나 클릭으로 화면이 바뀌는 테스트 페이지를 만들어요. 주제는 자유예요 |
| R3-2 | Virtual DOM 변환, Diff, Patch, 각 Hook을 단위 테스트로 검증해요 |
| R3-3 | 기능 테스트로 화면 동작을 확인하고, 다양한 태그와 요소로 엣지 케이스를 점검해요 |
| R3-4 | AI를 적극 활용하되, 핵심 로직은 직접 이해하고 설명할 수 있어야 해요 |
| R3-5 | 포트폴리오에 넣을 수 있는 완성도를 목표로 하고, 다른 팀과의 차별점을 고민해요 |

## 설명할 수 있어야 하는 내용

### Phase 1

- DOM과 Window를 다루는 방법, DOM 변화를 감지하는 브라우저 API
- 실제 DOM이 느린 이유 (Reflow, Repaint)
- Virtual DOM의 구조와 필요한 이유
- Diff의 동작 방식, 최소 변경을 찾는 5가지 핵심 케이스, 실제 DOM 반영 방법
- React가 Virtual DOM과 Diff로 실제 DOM을 바꾸는 방식

### Phase 2

- UI를 컴포넌트로 나누는 기준, 상태를 두는 위치
- `setState`가 상태 변경 외에 해야 하는 일
- 여러 상태 변경을 한 번에 처리하는 방법 (Batching, 선택 과제)
- 구현체와 실제 React의 차이
