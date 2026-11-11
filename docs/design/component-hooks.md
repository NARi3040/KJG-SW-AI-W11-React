# FunctionComponent와 Hooks

> 이 문서를 읽으면 함수가 매번 새로 실행되어도 상태가 어떻게 유지되는지 알고, `FunctionComponent`와 `useState`, `useEffect`, `useMemo`를 바로 구현할 수 있어요.

| 항목 | 내용 |
|---|---|
| 상태 | **구현 예정.** Notion "Phase 2 정해야 할 것 (안건 정리본)"의 결정을 반영했어요(2026-11-11). 결정 칸이 빈 안건은 제안으로 적었어요([미정](#미정)). 분담과 순서는 [phase-2-plan.md](phase-2-plan.md)를 봐 주세요 |
| 다루는 요구사항 | R2-1, R2-2, R2-3, R2-4, R2-5, R2-6, R3-2 |
| 관련 이슈 | #8, #9 |
| 소스 파일 | `src/component.ts`, `src/hooks.ts`, `src/component.test.ts`, `src/hooks.test.ts` |

## 구조

함수는 렌더마다 새로 실행되므로 상태를 둘 변하지 않는 자리가 필요해요. VNode는 불변이고 DOM 참조도 없으니 그 자리를 **루트 컴포넌트 인스턴스 하나**로 둬요. Hook과 상태를 루트에서만 쓰는 과제 제약(R2-2, R2-3) 덕분에 가능해요.

```text
setState → 바로 update() → 루트 함수 실행 → expand로 자식 펼침 → diff(이전 트리, 새 트리) → applyPatches → effect 실행
```

- `setState`는 부를 때마다 그 자리에서 다시 그려요(5-1 A). 한 핸들러에서 두 번 부르면 두 번 그려요.
- `diff`와 `applyPatches`는 Phase 1과 같은 코드를 직접 불러요(R2-6, 18-1 제안). 검증 페이지의 `onPatch`와 `history`는 쓰지 않아요.
- 이벤트는 루트 컨테이너에 위임해요([virtual-dom.md의 이벤트 위임](virtual-dom.md#이벤트-위임)). `mount`가 `listen(container)`을 불러요.
- `src/component.ts`는 `expand`와 `FunctionComponent`, `src/hooks.ts`는 Hook을 담아요. `src/hooks.ts`가 `src/component.ts`를 import하고, 반대 방향은 없어요.

## `expand`

`expand(v: VNode, prev?: Map<string, Memo>, next?: Map<string, Memo>): VNode`는 컴포넌트 VNode를 실행해 요소 VNode만 남겨요(2 C).

- 컴포넌트면 `v.type({ ...v.props, children: v.children })`를 실행하고 결과를 다시 펼쳐요.
- 컴포넌트는 요소 VNode를 돌려줘야 해요. `null`, 문자열 반환은 지원하지 않고 검사하지도 않아요([제외한 안건](#제외한-안건)의 13).
- 컴포넌트에 붙인 `key`는 결과에 `key`가 없을 때 결과로 물려줘요. 그래야 목록 재정렬 때 key 비교가 동작해요.
- 요소면 배열 자식을 펼쳐요. 자식이 하나도 바뀌지 않으면 원래 VNode를 그대로 돌려주고, 바뀌면 그 요소만 새 객체로 만들어요. 원래 VNode는 고치지 않아요.

```ts
const Item = (props) => h("li", null, props.label);
expand(h("ul", null, h(Item, { key: "a", label: "x" })));
// ul VNode. 자식은 { type: "li", key: "a", children: "x", ... }
```

펼친 뒤에는 컴포넌트 타입이 사라져요. 두 자식 컴포넌트가 같은 태그를 반환하면 교체가 아니라 속성과 자식 비교가 돼요. 자식에 상태가 없으므로 결과 DOM은 같아요.

### 결과 캐시

자식 컴포넌트는 props만 받는 순수 함수라서, 지난 렌더와 입력이 같으면 결과도 같아요. 그래서 `prev`와 `next`를 받으면 지난 결과를 다시 써요. 다시 쓴 결과는 지난 트리에 있던 **같은 객체**라서, `diff`가 `o === n`에서 바로 끝나 그 아래를 비교하지 않아요.

- **자리 이름(`slot`):** 루트 결과는 `""`예요. 요소의 `i`번째 자식은 `부모 slot + "/" + i`, key가 있으면 `부모 slot + "/k" + JSON.stringify(key)`예요(`/k"a"`, `/k1`). 컴포넌트의 결과는 `컴포넌트 slot + ">"`예요. key로 이름을 지으면 목록 순서가 바뀌어도 같은 이름이에요. `JSON.stringify`로 감싸서 key `1`과 `"1"`, `/`나 `>`가 든 key도 다른 이름이 돼요.
- **다시 쓰는 조건:** `prev.get(slot)`이 있고 `type`이 같고, props의 키 수가 같고 모든 값이 `Object.is`로 같고, `children`이 `Object.is`로 같을 때예요.
- 다시 쓰면 그 `Memo`를 `next`에 그대로 넣고, `prev`에서 이름이 `slot + ">"`로 시작하는 항목(그 컴포넌트 안쪽의 자리)도 모두 `next`에 옮긴 뒤 `result`를 돌려줘요. 옮기지 않으면 다음 렌더에 바깥 컴포넌트가 다시 실행될 때 안쪽 컴포넌트가 모두 다시 실행돼요. 아니면 컴포넌트를 실행해 펼친 결과를 `{ type, props, children, result }`로 `next`에 넣어요. `result`에는 물려받은 `key`가 들어가 있어요.
- `FunctionComponent`가 렌더마다 새 `Map`을 `next`로 넘기고, 끝나면 그것을 다음 렌더의 `prev`로 써요. 이번 렌더에 없던 자리는 사라져요.
- 루트 컴포넌트는 캐시하지 않아요. `renderTree`가 루트 함수를 직접 실행해요.

| 경우 | 다시 쓰나 | 이유 |
|---|---|---|
| props가 숫자, 문자열, 같은 객체, setter뿐 | 예 | setter는 렌더마다 같은 함수예요(5-4 A) |
| props에 렌더마다 새로 만든 화살표 함수나 객체 | 아니오 | 참조가 달라요. 자식에게는 setter를 직접 넘겨요(10 B) |
| 자식으로 VNode 배열을 받음 | 아니오 | `children` 배열이 렌더마다 새 객체예요 |
| key 없는 목록에서 앞 항목이 빠짐 | 뒤 항목은 아니오 | 뒤 항목의 인덱스가 바뀌어 자리 이름이 달라요 |
| 다시 쓴 컴포넌트 안의 컴포넌트 | 예. 다음 렌더에 바깥만 다시 실행돼도 안쪽은 props가 같으면 다시 써요 | 다시 쓸 때 안쪽 자리를 `next`에 옮겨요 |

다시 쓸 때 `prev`를 한 번 훑으므로 비용이 캐시 크기에 비례해요. 자식 수백 개 규모에서는 문제가 없다고 판단했어요.

## `FunctionComponent`

`erasableSyntaxOnly` 때문에 생성자 매개변수 프로퍼티는 쓸 수 없어요. 필드를 따로 선언해요. 생성자는 `(container: Element, type: Component, props: Record<string, unknown> | null = null)`이고 렌더하지 않아요. `createRoot`와 인자 순서가 같아요.

| 필드 | 형식 | 의미 |
|---|---|---|
| `type`, `props`, `container` | `Component`, `Record<string, unknown> \| null`, `Element` | 루트 컴포넌트 함수, props, 그릴 영역. 루트 props는 `PropValue`가 아닌 값도 받아요 |
| `tree` | `VNode \| null` | 마지막 렌더 결과(요소 VNode만 있는 트리). 다음 Diff의 이전 트리예요. `mount` 전에는 `null` |
| `hooks` | `unknown[]` | Hook 칸. 호출 순서로 구분해요(3 A). 칸의 모양은 [Hooks](#hooks) 표에 있어요 |
| `hookIndex` | `number` | 이번 렌더에서 다음에 쓸 칸 번호 |
| `effects` | `Array<() => void>` | 이번 렌더 뒤에 실행할 effect 작업. `useEffect`가 넣어요 |
| `memo` | `Map<string, Memo>` | 지난 렌더의 [결과 캐시](#결과-캐시) |
| `static current` | `FunctionComponent \| null` | 지금 렌더 중인 루트. Hook이 이 값으로 칸을 찾아요(12-2 제안) |

| 메서드 | 하는 일 |
|---|---|
| `renderTree(): VNode` | `hookIndex = 0`, `effects = []`로 비우고 `FunctionComponent.current`를 자신으로 둔 채 루트 함수를 실행해 `expand(결과, memo, 새 Map)`로 펼쳐요. 새 `Map`을 `memo`에 넣어요. `finally`로 `current`를 이전 값으로 되돌려요 |
| `mount(): void` | 첫 렌더. `renderTree` → `listen(container)` → `mountArea` → `tree` 저장 → `runEffects` |
| `update(): Patch[]` | 다시 그리기. `renderTree` → `diff(tree, 새 트리)` → `applyPatches` → `tree` 교체 → `runEffects`. 적용한 Patch를 돌려줘요 |
| `runEffects(): void` | `effects`를 떼어 낸 뒤(`const list = this.effects; this.effects = []`) 차례로 실행해요. 떼어 내야 effect 안의 `setState`가 다시 렌더해도 남은 작업이 섞이지 않아요 |

`tree`를 저장하고 나서 `runEffects`를 불러요. effect 안의 `setState`가 부르는 `update()`가 새 `tree`를 기준으로 비교해야 하기 때문이에요.

`createRoot(container, type, props = null)`은 인스턴스를 만들어 `mount()`하고 돌려줘요(12-1 제안).

## Hooks

| Hook | 시그니처 | 칸에 저장하는 것 | 다시 계산하는 조건 |
|---|---|---|---|
| `useState` | `useState<T>(init: T \| (() => T)): [T, SetState<T>]` | `{ value, set }` | 해당 없음. 함수 `init`은 첫 렌더에만 실행해요 |
| `useEffect` | `useEffect(create: () => void \| (() => void), deps?: readonly unknown[]): void` | `{ deps, cleanup, run }` | `deps` 없음: 매 렌더. `[]`: 첫 렌더만. 그 밖: 값이 바뀔 때(7-4 A) |
| `useMemo` | `useMemo<T>(factory: () => T, deps?: readonly unknown[]): T` | `{ value, deps }` | `deps`가 바뀔 때. 없으면 매번(8-1 A) |

`SetState<T>`는 `(next: T | ((prev: T) => T)) => void`예요.

- **칸 찾기:** 모든 Hook은 `FunctionComponent.current`의 `hooks[hookIndex]`를 쓰고 `hookIndex`를 1 올려요. `current`가 `null`이면 "Hook은 컴포넌트를 렌더하는 중에만 부를 수 있어요" 오류를 던져요. 칸이 비어 있으면 첫 렌더예요.
- **`deps` 비교:** `useEffect`와 `useMemo`가 같은 함수를 써요(8-2 A). 어느 쪽이든 `deps`가 없거나, 길이가 다르거나, 어느 값이든 `Object.is`로 다르면 바뀐 거예요(7-3 A).
- **호출 순서:** 조건문이나 반복문 안에서 부르면 안 돼요. 검사하지 않아요([제외한 안건](#제외한-안건)의 9).

**setter가 하는 일**

setter는 첫 렌더에 한 번 만들어 칸에 넣고, 다음 렌더부터는 같은 함수를 돌려줘요(5-4 A).

1. `next`가 함수면 칸의 현재 값으로 실행해 새 값을 구해요(5-3 A). 그래서 상태 자체로 함수를 넣으려면 `set(() => fn)`처럼 감싸요.
2. `Object.is`로 현재 값과 같으면 아무것도 하지 않아요(5-2 A).
3. 칸에 값을 저장하고 바로 `root.update()`를 불러요(5-1 A).

**effect 실행**

`useEffect`는 다시 실행할 때만 작업 하나를 만들어 `effects`에 넣고, 칸의 `run`을 그 작업으로, `deps`를 새 값으로 바꿔요. 작업은 실행될 때 칸의 `run`이 자기 자신이 아니면 아무것도 하지 않아요. effect 안의 `setState`로 그사이 다시 렌더해 같은 칸에 더 새 작업이 생겼다면, 바깥 렌더의 옛 작업이 새 cleanup을 부르고 옛 `create`를 다시 켜는 일을 막기 위해서예요. 자기 자신이면 `run`을 비우고, 칸의 이전 `cleanup`을 먼저 부르고 `create`를 실행해요. 반환값이 함수면 칸의 `cleanup`으로 저장하고, 아니면 `cleanup`을 비워요. 작업은 `applyPatches` 직후 같은 흐름에서 동기로 실행돼요(7-1 A). 그래서 effect 안에서 읽은 DOM은 이미 새 값이에요. cleanup은 그 effect를 다시 실행하기 전에만 불러요(7-2 A). 언마운트가 없어서 마지막 cleanup은 불리지 않아요([제외한 안건](#제외한-안건)의 11).

## 엣지 케이스

| 상황 | 처리 |
|---|---|
| 같은 값으로 `setState` | 재렌더 없음 |
| 한 핸들러에서 `setState` 3번 | 값이 바뀔 때마다 재렌더. `set(c + 1)` 3번은 첫 번째만 바뀌어 재렌더 1번, `set((p) => p + 1)` 3번은 재렌더 3번 |
| 배열을 직접 고치고 같은 참조로 `setState` | 같은 값이라 재렌더 없음. 새 배열을 만들어 넘겨요 |
| effect 안에서 `setState` | 그 자리에서 바로 다시 그려요. 남은 effect는 그 뒤에 이어서 실행돼요 |
| 렌더 중(루트 함수 본문)에 `setState` | 지원하지 않아요. 렌더 도중 안쪽 렌더가 시작돼 `hookIndex`가 0으로 돌아가고, 바깥 렌더의 남은 Hook이 엉뚱한 칸을 읽어요. 값이 매번 바뀌면 끝없이 반복돼요([제외한 안건](#제외한-안건)의 5-5) |
| 렌더 밖에서 Hook 호출 | 오류 |
| 자식에서 Hook 호출 | 검사하지 않아요. 자식의 Hook이 루트의 칸을 차지해 순서가 어긋나요. 과제 제약으로만 막아요 |
| 컴포넌트가 `null`이나 문자열 반환 | 지원하지 않아요. 검사하지 않아서 뒤의 `diff`나 `createDOM`에서 오류가 날 수 있어요 |
| 루트 태그가 바뀜 | 경로 `[]`의 `REPLACE` |
| 조건부 자식 `cond && h(A)` | `false`를 버려요. key가 없으면 뒤 형제의 위치가 바뀌어 캐시도 다시 실행해요 |
| 렌더나 effect에서 예외 | 처리하지 않고 그대로 던져요. `FunctionComponent.current`만 `finally`로 되돌려요 |

## 테스트

`src/component.test.ts`와 `src/hooks.test.ts`에서 `node:test`와 `jsdom`으로 확인해요. `setState`가 끝나면 DOM이 이미 바뀌어 있으므로 기다리지 않아요(15 제안). 렌더 횟수는 루트 함수 안에서 센 수예요.

`src/component.test.ts`(단계 6까지)는 Hook을 쓰지 않아요. 상태 대신 테스트 바깥 변수를 바꾸고 `root.update()`를 직접 불러요. Hook이 필요한 줄은 `src/hooks.test.ts`(단계 7)에 둬요.

| 검사 | 기대값 |
|---|---|
| `expand`: 컴포넌트 없음 | 입력과 같은 객체(`===`) |
| `expand`: 중첩 | `A`가 `h(B)`를 돌려줘도 결과에 `COMPONENT` 플래그가 없음 |
| `expand`: `children` 전달 | `h(Box, null, "x")`에서 `Box`가 `props.children === "x"`를 받음 |
| key 승계 | `h(Item, { key })`를 재정렬해도 Patch는 `MOVE`뿐이고 DOM 노드가 같은 객체(`===`) |
| 캐시: 같은 props | 두 번째 `expand`에서 자식 함수 호출 0번, 결과가 지난 결과와 같은 객체 |
| 캐시: 다른 props, 새 함수 prop | 자식 함수 호출 1번 |
| 캐시: key 목록 재정렬 | 자식 함수 호출 0번 |
| 캐시: 자식 81개 중 1개 변경 | 자식 함수 호출 1번 |
| 캐시: 바깥만 다시 쓴 뒤 안쪽 1개 변경 | 목록을 감싼 컴포넌트를 한 번 다시 쓰고(props 같음), 다음 렌더에 항목 하나만 바꾸면 항목 함수 호출 1번 |
| `mount` | 영역의 자식이 루트 하나, `tree`가 `null`이 아님 |
| `renderTree` 예외 | 루트 함수가 던진 뒤 `FunctionComponent.current`가 `null` |
| 변경분만 반영 | 상태 하나를 바꾸면 `update()`가 해당 Patch만 돌려주고, 나머지 노드가 같은 객체(`===`) |
| `useState` 즉시 렌더 | `set(1)` 다음 줄에서 DOM이 `"1"` |
| `useState` 같은 값 | 재렌더 없음 |
| `useState` 세 번 | 0에서 `set(c + 1)` 3번 → 값 1, 첫 렌더 포함 렌더 2번. 이어서 `set((p) => p + 1)` 3번 → 값 4, 렌더 5번 |
| setter 고정 | 두 렌더의 setter가 같은 함수(`===`) |
| 지연 초깃값 | `useState(() => ...)`의 함수가 렌더 3번 동안 1번만 불림 |
| `useEffect` 시점 | effect 안에서 읽은 DOM이 이미 새 값 |
| cleanup | `deps`가 바뀌면 이전 cleanup → 새 effect 순서로 불림 |
| `deps` 생략, `[]`, `[a]` | 렌더 3번에 각각 3번, 1번, `a`가 바뀐 횟수 + 1번 |
| `deps`에 `NaN` | 다시 실행하지 않음 |
| effect 안 `setState` | 다시 그린 뒤 DOM이 마지막 값이고, 첫 렌더의 다른 effect도 한 번씩 실행됨 |
| effect 재진입 | effect A가 `setState`해 effect B의 deps가 바뀌면, B의 `create`는 새 렌더의 것만 1번 불리고 옛 작업은 건너뜀 |
| `useMemo` | `deps`가 같으면 `factory`를 다시 부르지 않고 같은 객체를 돌려줌. 바뀌면 다시 부름. 생략하면 매번 부름 |
| 자식에 setter 전달 | 루트가 `h(Counter, { count, setCount })`를 돌려주고 `Counter`의 버튼 `onClick`이 `setCount(count + 1)`을 부르면, 클릭 뒤 DOM이 `"1"`이고 루트 렌더 2번(10 B) |
| 렌더 밖 Hook | 오류 |

## 제외한 안건

Notion 정리본에서 과제 범위 밖이라 뺀 안건이에요(2026-11-11). 구현하지 않아요.

| 안건 | 내용 | 이유 |
|---|---|---|
| 6 | `update()` 중 예외와 실패 복구 | 일어날 일이 없다는 코치 판단 |
| 9 | 자식 Hook 호출, Hook 순서 변경 감지 | 요구사항에 없어요 |
| 11 | 언마운트 | 요구사항은 mount와 update만 요구해요 |
| 13 | 컴포넌트의 `null`, 문자열 반환 | 컴포넌트는 요소 VNode만 반환한다는 규칙으로 대신해요 |
| 5-5 | 끝없는 렌더 방지 | 요구사항에 없어요. 회의에서 고른 B(렌더 중 `setState` 오류)는 기록으로만 남겼어요 |
| 8-3 | 캐시를 반드시 지키는가 | 요구사항에 없어요. 구현은 `deps`가 같으면 항상 다시 써요 |

## 미정

결정 칸이 비어 있어서 따로 적지 않은 한 Notion의 "최적의 선택"으로 적은 내용이에요. 팀이 다르게 정하면 이 문서와 [phase-2-plan.md](phase-2-plan.md#미정)를 같이 고쳐요.

| 항목 | 이 문서에 적은 내용 |
|---|---|
| 12-1 루트를 만드는 방법 | `FunctionComponent`와 `createRoot`를 둘 다 둬요 |
| 12-2 현재 인스턴스를 아는 방법 | `FunctionComponent.current` 하나 |
| 15 테스트 방법 | 기다리지 않아요. Notion의 최적의 선택(A, microtask `await`)이 아니라 이 문서의 제안이에요. 5-1 A라 기다릴 것이 없어요 |
| 18-1 Phase 1을 부르는 경로 | `diff`, `applyPatches`를 직접 불러요 |
| 18-2 변경분만 반영 확인 | 테스트의 "변경분만 반영" 줄 |
