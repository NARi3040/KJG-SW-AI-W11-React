# FunctionComponent와 Hooks

> 이 문서를 읽으면 함수가 매번 새로 실행되어도 상태가 어떻게 유지되는지 알고, `FunctionComponent`와 `useState`, `useEffect`, `useMemo`를 바로 구현할 수 있어요.

| 항목 | 내용 |
|---|---|
| 상태 | **이번 구현 범위 밖.** Phase 1 다음 작업에서 구현해요([범위와 분담](vnode-spec.md#이번-구현-범위와-분담)). 형식은 팀 합의 전이에요 |
| 다루는 요구사항 | R2-1, R2-2, R2-3, R2-4, R2-5, R2-6, R3-2 |
| 관련 이슈 | #8, #9 |
| 소스 파일 | `src/component.ts`, `src/component.test.ts` |

## 구조

함수는 렌더마다 새로 실행되므로 상태를 둘 변하지 않는 자리가 필요해요. VNode는 불변이고 DOM 참조도 없으니 그 자리를 **루트 컴포넌트 인스턴스 하나**로 둬요. Hook과 상태를 루트에서만 쓰는 과제 제약(R2-2, R2-3) 덕분에 가능해요.

```text
setState → 루트 함수 다시 실행 → expand로 자식 펼침 → diff(이전 트리, 새 트리) → applyPatches → effect 실행
```

`diff`와 `applyPatches`는 Phase 1과 같은 코드예요(R2-6). 이벤트 리스너는 Phase 1에 없으므로 이 작업에서 `setProp`의 [invoker 규칙](virtual-dom.md#setprop)을 함께 구현해요.

## `expand`

`expand(v: VNode): VNode`는 컴포넌트 VNode를 실행해 요소 VNode만 남겨요.

- 컴포넌트면 `v.type({ ...v.props, children: v.children })`를 실행하고 결과를 다시 펼쳐요. 실행 중에는 `childDepth`를 올려 자식임을 표시해요.
- 결과가 VNode가 아니면 오류를 던져요. `null`, 문자열 반환은 지원하지 않아요.
- 컴포넌트에 붙인 `key`는 결과에 `key`가 없을 때 결과로 물려줘요. 그래야 목록 재정렬 때 key 비교가 동작해요.
- 요소면 배열 자식을 펼쳐요. 바뀐 곳만 새 객체로 만들고 원래 VNode는 고치지 않아요.

```ts
const Item = (props) => h("li", null, props.label);
expand(h("ul", null, h(Item, { key: "a", label: "x" })));
// ul VNode. 자식은 { type: "li", key: "a", children: "x", ... }
```

펼친 뒤에는 컴포넌트 타입이 사라져요. 두 자식 컴포넌트가 같은 태그를 반환하면 교체가 아니라 속성과 자식 비교가 돼요. 자식에 상태가 없으므로 결과 DOM은 같아요.

## `FunctionComponent`

`erasableSyntaxOnly` 때문에 생성자 매개변수 프로퍼티는 쓸 수 없어요. 필드를 따로 선언해요.

| 필드·메서드 | 의미 |
|---|---|
| `type`, `props`, `container` | 루트 컴포넌트 함수, props, 그릴 영역 |
| `tree` | 마지막 렌더 결과(요소 VNode만 있는 트리). 다음 Diff의 이전 트리예요 |
| `hooks`, `hookIndex` | Hook 상태 배열과 현재 위치. 호출 순서로 구분해요 |
| `effects` | 이번 렌더에서 실행할 effect |
| `isUnmounted` | 언마운트 후 갱신을 막는 표시 |
| `renderTree()` | `hookIndex`와 `effects`를 초기화하고 `currentRoot`를 자신으로 둔 채 실행해 펼친 트리를 돌려줘요. 끝나면 `currentRoot`를 되돌려요 |
| `mount()` | 첫 렌더. `renderTree` → `mountArea`, effect 예약 |
| `update()` | 재렌더. 언마운트됐으면 무시해요. `renderTree` → `diff` → `applyPatches`, `tree` 교체, effect 예약 |
| `unmount()` | `isUnmounted` 표시, 큐에서 제거, 모든 cleanup 호출, 영역 비우기 |

`createRoot(container, type, props = null)`은 인스턴스를 만들어 `mount()`하고 effect를 실행한 뒤 돌려줘요.

## Hooks

| Hook | 시그니처 | 저장하는 것 | 다시 계산하는 조건 |
|---|---|---|---|
| `useState` | `useState<T>(init: T \| (() => T)): [T, (v: T \| ((prev: T) => T)) => void]` | `{ value }` | 해당 없음. 함수 `init`은 첫 렌더에만 실행해요 |
| `useEffect` | `useEffect(create: () => void \| (() => void), deps?: unknown[]): void` | `{ create, deps, cleanup, inst }` | `deps` 없음: 매 렌더. `[]`: 첫 렌더만. 그 밖: 값이 바뀔 때 |
| `useMemo` | `useMemo<T>(factory: () => T, deps?: unknown[]): T` | `{ value, deps }` | `deps`가 바뀔 때. 없으면 매번 |

- **`deps` 비교:** 길이가 다르거나 어느 값이든 `Object.is`로 다르면 바뀐 거예요. 어느 쪽이든 `deps`가 없어도 바뀐 거예요.
- **호출 위치 검사:** 렌더 밖에서 부르면 오류를 던져요. `childDepth`가 0보다 크면 자식에서 부른 것이므로 오류를 던져요. 그대로 두면 자식의 Hook이 루트의 `hooks` 칸을 조용히 차지해 순서가 어긋나기 때문이에요. 과제 제약이 구조로 강제돼요.
- **호출 순서:** 조건문이나 반복문 안에서 부르면 안 돼요. 검사하지 않아요.

**`setState`가 하는 일**

1. 언마운트됐으면 무시해요.
2. 함수면 현재 값으로 실행해 새 값을 구해요.
3. `Object.is`로 같으면 아무것도 하지 않아요.
4. 값을 저장하고 재렌더를 예약해요.

**Batching** (선택 과제): 같은 tick의 `setState`는 `queueMicrotask` 한 번으로 묶여 재렌더 1회가 돼요. 큐를 복사해 비운 뒤 실행하므로, 실행 중에 들어온 갱신은 다음 microtask에서 처리돼요.

**effect 실행**: 큐의 모든 `update()`가 끝난 직후 동기로 실행해요. 언마운트된 인스턴스의 effect는 건너뛰어요. 이전 cleanup을 먼저 부르고 `create`를 실행해요. 반환값이 함수면 다음 cleanup으로 저장해요. cleanup은 effect를 다시 실행하기 전과 언마운트 때 불러요.

## 엣지 케이스

| 상황 | 처리 |
|---|---|
| 같은 값으로 `setState` | 재렌더 없음 |
| 언마운트 후 `setState` | 무시 |
| 자식에서 Hook 호출 | 오류 |
| 렌더 밖에서 Hook 호출 | 오류 |
| 컴포넌트가 `null` 반환 | 오류. 지원하지 않아요 |
| 루트 태그가 바뀜 | 경로 `[]`의 `REPLACE` |
| effect 안에서 `setState` | 다음 microtask에서 재렌더 |
| 조건부 자식 `cond && h(A)` | `false`를 버려요. 뒤 형제의 위치가 바뀌어요 |

## 테스트

`src/component.test.ts`에서 `node:test`와 `jsdom`으로 확인해요. microtask 뒤에 확인하도록 `await`해요.

| 검사 | 기대값 |
|---|---|
| Batching | 동기로 `setState` 3회 → 첫 렌더 포함 렌더 2회, DOM은 마지막 값 |
| 같은 값 | 재렌더 없음 |
| `useMemo` | `deps`가 같으면 `factory`를 다시 부르지 않음 |
| `useEffect` 시점 | effect 안에서 읽은 DOM이 이미 새 값 |
| cleanup | 다시 실행 전과 언마운트 때 호출 |
| 언마운트 후 `setState` | 무시, 재렌더 없음 |
| 자식 Hook | 오류 |
| key 승계 | `h(Item, { key })`를 재정렬해도 DOM 노드가 같은 객체(`===`) |
| 변경분만 반영 | 상태 하나를 바꾸면 해당 Patch만 나옴 |

## 미정

| 항목 | 이유 |
|---|---|
| `update()` 중 예외 처리 | Notion 문서에 정의가 없어요. 렌더나 `applyPatches`에서 예외가 나면 `tree`와 DOM이 어긋날 수 있어요. Phase 1은 복구하기로 정했지만([verify-page.md](verify-page.md#patch-실패)) Phase 2에 그대로 쓸지는 아직 정하지 않았어요 |
| 테스트 페이지 주제 | #10에서 정해요 |

## 실제 React와 다른 점

- **자식 상태:** React는 어느 컴포넌트에서나 Hook을 쓸 수 있어요. 이 구현은 과제 제약대로 루트에서만 쓰고, 자식에서 부르면 오류예요.
- **컴포넌트 비교:** React는 컴포넌트 타입이 다르면 서브트리를 교체해요. 이 구현은 펼친 결과만 비교해요.
- **`useEffect` 시점:** React는 화면을 그린 뒤 비동기로 실행해요. 이 구현은 DOM 반영 직후 동기로 실행해서 `useLayoutEffect`에 가까워요.
- **`setState` 함수:** React는 렌더 사이에 같은 함수를 유지해요. 이 구현은 렌더마다 새 함수를 만들어요.
- **Batching:** 이 구현은 microtask로 묶어요. Vue 3의 갱신 큐와 같은 방식이고, React의 스케줄러와는 달라요.
- **미지원:** Fragment, Portal, ref, 서버 렌더링, 동시성 렌더링, `null` 반환.
