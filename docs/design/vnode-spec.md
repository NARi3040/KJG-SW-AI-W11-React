# VNode·Patch 공통 형식

> 이 문서를 읽으면 Virtual DOM 변환, Diff, Patch가 주고받는 데이터의 모양과 지켜야 할 약속을 알 수 있어요. 담당 영역이 달라도 이 형식만 맞추면 따로 구현해도 맞물려요.

| 항목 | 내용 |
|---|---|
| 상태 | **팀 합의 완료** (2026-11-07 박준호 확인). 합의한 것은 Notion 문서 0장의 결정 A–H예요. 결정 C의 JS와 Vitest는 저장소 규칙대로 TS와 `node:test`로 바꿔요. Notion과 다른 곳은 아래 [달라진 점](#notion-문서와-달라진-점)에 있어요 |
| 다루는 요구사항 | R1-1, R1-2, R1-6 |
| 관련 이슈 | #13, #14 |
| 원본 | [Notion 설계 문서: 경로 기반 패치 목록 VNode·Patch](https://app.notion.com/p/41188145c531811fbc6ad1c735fe709d) (JS 전체 코드와 후보 비교가 있어요) |

## 설계 문서 지도

| 문서 | 다루는 내용 | 소스 파일 | 이슈 |
|---|---|---|---|
| 이 문서 | VNode, Patch, Diff와 Patch 사이의 약속 | `src/vnode.ts` (타입, 상수) | #13, #14 |
| [phase-1-plan.md](phase-1-plan.md) | 담당별 함수 목록, 구현 순서, 완료 확인 | 해당 없음 | #4, #5, #6, #7 |
| [virtual-dom.md](virtual-dom.md) | VNode 생성, DOM ↔ VNode 변환, 속성 반영 | `src/vnode.ts`, `src/dom.ts` | #4 |
| [diff.md](diff.md) | 두 VNode → Patch 목록 | `src/diff.ts` | #5 |
| [patch.md](patch.md) | Patch 목록 → 실제 DOM 반영 | `src/patch.ts` | #6 |
| [verify-page.md](verify-page.md) | 검증 페이지, State History, 시연 시나리오 | `src/app.ts` | #7 |
| [component-hooks.md](component-hooks.md) | `FunctionComponent`, Hooks (이번 구현 범위 밖) | `src/component.ts` | #8, #9 |

의존은 한 방향이에요. `vnode` ← `dom` ← `patch` ← `app`, `vnode` ← `diff` ← `app`이고, `component`는 `vnode`, `dom`, `diff`, `patch`를 써요. `src/index.ts`는 모든 모듈을 다시 내보내요.

## 이번 구현 범위와 분담

이번에는 Phase 1(R1-1~R1-7)까지만 구현해요. Phase 2와 테스트 페이지(#8, #9, #10)는 이번 범위가 아니에요.

담당과 함수별 순서는 [phase-1-plan.md](phase-1-plan.md)를 봐 주세요.

## 왜 경로 기반 Patch 목록인가

Diff는 DOM을 건드리지 않고 Patch 목록(데이터)만 만들어요. `applyPatches`가 그 목록의 경로로 노드를 찾아 고쳐요.

| 방식 | 장점 | 단점 | 판단 |
|---|---|---|---|
| **경로 기반 Patch 목록** | Diff가 순수 함수, 목록이 곧 시연 로그, VNode에 DOM 참조가 없음 | 적용할 때 경로를 다시 따라감, 인덱스 밀림(아래 약속으로 해결) | 채택 |
| 비교하며 바로 반영 | 저장 공간이 없음 | VNode가 DOM에 묶여 두 영역과 히스토리가 복제본을 써야 함, 변경 내용이 데이터로 안 남음 | 탈락 |
| Fiber (React) | 작업을 중단하고 재개할 수 있음 | 구현이 복잡함 | 탈락 |
| 트리 모양 Patch | 경로가 필요 없음 | 변경 없는 노드에도 빈 Patch가 생기고 로그로 보기 불편함 | 탈락 |

- Diff의 비교 비용은 어느 방식이든 같아요. 타입이 다르면 통째로 교체하고 형제는 key로 짝을 맞추는 React의 두 가정으로 일반 트리 비교의 O(n³)를 피해요. 위치 비교와 key 비교 1–3단계는 O(n), LIS까지 가면 최악 O(n log n), key 있는 노드와 없는 노드가 섞이면 최악 O(n²)이에요([diff.md](diff.md#복잡도)).
- 대가로 적용 시간이 O(Patch 수 × 트리 깊이)예요. 테스트 페이지 규모에서는 문제가 없다고 판단했어요.

## VNode

```ts
export const ELEMENT = 1;
export const TEXT = 2;
export const COMPONENT = 4;
export const TEXT_CHILDREN = 8;
export const ARRAY_CHILDREN = 16;
export const TEXT_TYPE = Symbol("text");

export type Listener = (event: Event) => void;
export type PropValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | Listener
  | Record<string, string>;
export type Props = Record<string, PropValue>;
export type Key = string | number;
// 자식 컴포넌트의 props 모양은 컴포넌트마다 달라서 any로 둬요
export type Component = (props: any) => VNode;

export interface VNode {
  type: string | Component | typeof TEXT_TYPE;
  props: Props | null;
  key: Key | null;
  children: VNode[] | string | null;
  flags: number;
}
```

`tsconfig.json`의 `erasableSyntaxOnly` 때문에 `enum`은 쓸 수 없어요. 그래서 `flags` 비트를 상수로 둬요.

`COMPONENT`, `Component`, `Listener`는 Phase 2에서 형식을 바꾸지 않으려고 미리 둬요. Phase 1에서는 컴포넌트를 실행하지 않고 리스너를 붙이지 않아요.

| 필드 | 의미 | 허용 형식 | 예시 |
|---|---|---|---|
| `type` | 노드 종류. 다르면 Diff가 통째로 교체해요 | 소문자 태그 이름, 함수 컴포넌트, `TEXT_TYPE` | `"li"` |
| `props` | 속성. 이름은 HTML 속성 이름이고, `key`는 들어가지 않아요. 없으면 `null`이에요 | `Props` 또는 `null` | `{ class: "list" }` |
| `key` | 형제 사이의 이름표. DOM에서 읽을 때는 `data-key` 값이에요 | 문자열, 숫자, `null` | `"vdom"` |
| `children` | 자식. 텍스트 하나뿐이면 문자열, 아니면 배열, 없으면 `null`이에요. 텍스트 VNode는 항상 자기 내용 문자열이에요 | `VNode[]`, 문자열, `null` | `"하나"` |
| `flags` | 노드 종류와 자식 종류를 합친 비트. `h`가 만들 때 한 번 계산해요 | 위 상수의 합 | `ELEMENT \| TEXT_CHILDREN` = 9 |

`<ul class="list"><li>하나</li><li>둘</li></ul>`의 VNode예요.

```ts
{
  type: "ul", props: { class: "list" }, key: null, flags: ELEMENT | ARRAY_CHILDREN,
  children: [
    { type: "li", props: null, key: null, children: "하나", flags: ELEMENT | TEXT_CHILDREN },
    { type: "li", props: null, key: null, children: "둘", flags: ELEMENT | TEXT_CHILDREN },
  ],
}
```

VNode는 세 가지를 지켜요.

- **`h`로만 만들어요.** DOM에서 읽을 때도 `h`를 불러서 모양이 한 곳에서 정해져요.
- **만든 뒤 고치지 않아요.** 엔진도 고치지 않아요. 그래서 히스토리에 넣을 때 복사하지 않아요.
- **DOM 참조를 담지 않아요.** 같은 VNode를 여러 영역과 히스토리가 함께 써도 안전해요.

## Patch

```ts
export type Path = number[];

export type Patch =
  | { type: "CREATE"; parentPath: Path; index: number; node: VNode }
  | { type: "REMOVE"; path: Path }
  | { type: "REPLACE"; path: Path; node: VNode }
  | { type: "TEXT"; path: Path; value: string }
  | { type: "PROPS"; path: Path; set: Props; remove: string[] }
  | { type: "MOVE"; parentPath: Path; from: number; to: number };
```

**경로**는 루트에서 자식 인덱스를 따라 내려가는 숫자 배열이에요. 항상 **이전 트리 기준**이에요. 경로 `[]`는 영역 안의 루트 `div.vdom-root`이고, 영역 자체는 교체하지 않아요.

```text
<div class="vdom-root">     []
  <ul>                      [0]
    <li>a</li>              [0, 0]
    <li>b</li>              [0, 1]
  </ul>
</div>
```

아래 표의 첫 다섯 종류가 PLANNING.md의 "5가지 핵심 케이스"에 대한 팀 정의예요. 과제 명세에 목록이 없어서 정한 거고, 발표 전에 코치에게 확인해요.

| 종류 | 언제 | 필드 | 예시 |
|---|---|---|---|
| `CREATE` | 이전에 없고 새로 있음 | `parentPath`: 부모의 경로. `index`: 새 자식 목록에서의 위치. `node`: 만들 서브트리 | `{ type: "CREATE", parentPath: [0], index: 2, node }` |
| `REMOVE` | 이전에 있고 새로 없음 | `path`: 지울 노드 | `{ type: "REMOVE", path: [0, 1] }` |
| `REPLACE` | 태그가 다름, 텍스트 ↔ 요소, key가 다름 | `path`: 바꿀 노드. `node`: 새 서브트리 | `{ type: "REPLACE", path: [0], node }` |
| `TEXT` | 텍스트 내용이 다름 | `path`: 텍스트를 가진 노드(아래 설명). `value`: 새 내용 | `{ type: "TEXT", path: [0, 0], value: "A" }` |
| `PROPS` | 같은 태그, 속성이 다름 | `path`: 대상 요소. `set`: 추가·변경할 속성. `remove`: 지울 속성 이름 | `{ type: "PROPS", path: [0, 0], set: { class: "y" }, remove: [] }` |
| `MOVE` | key 목록에서 순서가 바뀜(심화) | `parentPath`: 부모의 경로. `from`: 이전 인덱스. `to`: 새 인덱스 | `{ type: "MOVE", parentPath: [0], from: 4, to: 2 }` |

- **`TEXT`의 `path`:** 자식이 문자열인 요소는 그 요소를, 독립 텍스트 VNode는 그 텍스트 노드를 가리켜요. 적용은 둘 다 `textContent` 대입이에요. 대상이 `textarea`면 `.value`에도 대입해요([patch.md](patch.md#textarea의-text)).
- **`REPLACE` 아래쪽:** 경로에 Patch를 내지 않아요. 새 서브트리는 `node` 하나로 만들어요.
- **옛 값:** Patch에 싣지 않아요. Phase 2의 옛 이벤트 리스너는 요소별 맵에서 꺼내요([virtual-dom.md](virtual-dom.md#setprop)).

## Diff와 Patch 사이의 약속

Diff가 지키는 것이에요. 어기면 `applyPatches`가 틀린 결과를 내요.

1. 모든 `path`와 `parentPath`는 이전 트리 기준이에요. 이동할 노드의 안쪽 Patch도 옛 위치로 적어요.
2. 한 노드에서 자식의 Patch를 먼저 내고, 자기 `PROPS`를 나중에 내요.
3. 자식이 배열에서 텍스트로 바뀌면 `REMOVE`들을 `TEXT`보다 먼저 내요.
4. 같은 부모의 `CREATE`와 `MOVE`는 새 인덱스 오름차순으로 내요.
5. 변경이 없으면 빈 배열이에요.

호출하는 쪽이 지키는 것이에요.

- `applyPatches` 직전 영역의 DOM 구조는 Diff에 넘긴 이전 VNode와 정확히 같아야 해요. 경로가 이전 트리 기준이기 때문이에요. 경로가 어긋나면 가장 먼저 이 조건을 의심해요.
- 실제 영역의 DOM은 엔진만 고쳐요.

## 전체 예시

위치 비교예요.

```text
이전: <ul><li>a</li><li class="x">b</li></ul>
새것: <ul><li class="y">A</li></ul>
```

```ts
[
  { type: "TEXT", path: [0, 0], value: "A" },
  { type: "PROPS", path: [0, 0], set: { class: "y" }, remove: [] },
  { type: "REMOVE", path: [0, 1] },
];
```

key 비교예요. 이전 `a b c d e f g`, 새것 `a b e c d h f g`이고 `ul`의 경로는 `[0]`이에요.

```ts
[
  { type: "MOVE", parentPath: [0], from: 4, to: 2 }, // e를 옛 4번에서 새 2번으로
  { type: "CREATE", parentPath: [0], index: 5, node /* <li>h</li> */ },
];
```

## Notion 문서와 달라진 점

Notion 문서와 다르면 이 저장소의 문서가 우선이에요. 바뀐 규칙은 각 문서에 반영했으므로, Notion 코드를 옮길 때는 아래 항목을 해당 문서의 규칙대로 바꿔요.

- 언어와 테스트: [AGENTS.md](../../AGENTS.md)의 규칙을 따라요
- 읽기: `<script>`와 `key` 속성 버림, 공백 판단, 이웃한 텍스트 합치기 ([virtual-dom.md](virtual-dom.md))
- 쓰기: `style` 내용 이스케이프 안 함, `pre`·`textarea` 맨 앞 줄바꿈, 객체 속성 값 생략, `value` 프로퍼티 대상, 이벤트 맵은 `WeakMap`, invoker는 Phase 2 ([virtual-dom.md](virtual-dom.md))
- key 목록의 같은 key, 다른 `type`: `REMOVE` + `CREATE` ([diff.md](diff.md#엣지-케이스))
- 자가 검사: 속성 순서를 무시하고 비교 ([patch.md](patch.md#테스트))
- Patch 도중 예외: 이전 상태로 복구 ([verify-page.md](verify-page.md#patch-실패))
- 컴포넌트 반환값: VNode가 아니면 오류 ([component-hooks.md](component-hooks.md#expand))

## 검증 범위

2026-11-07에 Notion의 JS 코드에 위 수정을 반영해 Node 26.13.0 + jsdom 31.0.0에서 실행했어요. 시연 시나리오, 자식 비교 9가지, 각 문서의 주요 기대값, 무작위 테스트 세 종류(시드 1–5, 시드마다 2,000개)가 통과했어요. 문서의 모든 줄을 실행한 것은 아니에요. TS 구현은 아직 없어서 TS로 옮긴 코드는 실행하지 않았어요. 실제 브라우저에서도 실행하지 않았어요. 검사 스크립트는 저장소에 없어요.

2026-11-09에 PR #26 리뷰를 반영해 추가한 규칙(이웃한 텍스트 합치기, `key` 속성 버림, 거짓 값 key, HTML 공백, `pre` 서브트리 한 줄, key 비교 4단계의 `REMOVE` 순서)은 참조 구현으로 다시 실행하지 않았어요. `pre`, `textarea` 맨 앞 줄바꿈을 하나 더 쓰는 방식만 jsdom에서 왕복을 확인했어요(`"\nabc"`, `"\n"` 등 8가지). 줄바꿈이 있는 공백만 버리는 규칙은 읽기, `toHTML`, `sourceOf`만 줄인 간이 구현으로 공백·주석·`pre`·`&nbsp;` 입력 15개와 [다양한 태그 HTML](virtual-dom.md#다양한-태그), [샘플 HTML](verify-page.md#샘플-html)까지 17개 입력의 왕복을 두 합치는 순서 모두 jsdom에서 확인했어요(34건 통과). Diff, Patch로는 실행하지 않았어요.
