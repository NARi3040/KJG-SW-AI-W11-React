# Patch

> 이 문서를 읽으면 Patch 목록을 실제 DOM에 어떤 순서로 반영해야 인덱스가 밀리지 않는지 알고, `applyPatches`를 바로 구현할 수 있어요.

| 항목 | 내용 |
|---|---|
| 상태 | 공통 형식 합의 완료 ([vnode-spec.md](vnode-spec.md)) |
| 다루는 요구사항 | R1-6, R3-2 |
| 관련 이슈 | #6 |
| 소스 파일 | `src/patch.ts`, `src/patch.test.ts` |

Patch 형식과 Diff가 지키는 약속은 [vnode-spec.md](vnode-spec.md#patch)를 봐 주세요.

## 함수

| 함수 | 입력 | 출력 |
|---|---|---|
| `resolve(container, path)` | `container: Node`: 영역. `path: Path` | `path`가 가리키는 `Node`. `[]`는 `container.firstChild`예요 |
| `applyPatches(container, patches)` | `container: Node`: 영역. `patches: Patch[]`: `diff`의 결과 | 없음. 영역의 DOM을 고쳐요 |
| `formatPatches(patches)` | `patches: Patch[]` | 로그용 JSON 문자열 |

`resolve`는 루트에서 시작해 `childNodes[i]`를 따라 내려가요. 경로가 어긋나면 `undefined`를 돌려주거나 `TypeError`가 나요. 둘 다 [약속](vnode-spec.md#diff와-patch-사이의-약속)이 깨졌다는 신호예요.

`formatPatches`는 `node`를 `toHTML` 문자열로, 함수를 `"ƒ"`로 바꿔요.

```ts
formatPatches([{ type: "CREATE", parentPath: [0], index: 5, node: h("p", null, "추가") }]);
// '[{"type":"CREATE","parentPath":[0],"index":5,"node":"<p>추가</p>"}]'
```

## `applyPatches`의 네 단계

| 단계 | 하는 일 | 이유 |
|---|---|---|
| 1. 찾기 | 아무것도 고치기 전에 모든 대상을 이전 구조에서 찾아 둬요. `CREATE`는 부모, `MOVE`는 부모와 옮길 노드(`childNodes[from]`), 나머지는 `path`의 노드예요 | 앞 Patch가 뒤 Patch의 인덱스를 밀어내는 일이 없어요 |
| 2. 구조 | Patch 순서대로 `REMOVE`는 제거, `REPLACE`는 `createDOM(node)`로 교체, `TEXT`는 `textContent` 대입, `MOVE`는 대상을 떼어 둬요 | 부모 아래에 움직이지 않는 노드만 남아요 |
| 3. 삽입 | `CREATE`와 `MOVE`를 Patch 순서대로 `parent.childNodes[index]` 앞에 넣어요. 그 자리에 노드가 없으면 맨 뒤에 넣어요. `MOVE`의 `index`는 `to`예요 | 아래 설명 |
| 4. 속성 | `PROPS`를 Patch 순서대로 적용해요. `remove`를 먼저 `setProp(el, k, null)`로 지우고, `value` 외 `set`, 마지막에 `value`를 써요 | 새 `option`이 들어간 뒤 `select`의 값을 맞춰요 |

**삽입 단계가 맞는 이유**: 2단계가 끝나면 부모 아래에는 앞뒤 공통 구간, LIS에 속한 노드, 위치 비교의 공통 구간만 남고, 이들은 이미 최종 순서예요. 새 인덱스 0부터 차례로 "자기 자리 앞"에 넣으면, 넣기 직전 앞쪽은 이미 최종 상태이고 `childNodes[index]`는 다음에 올 고정 노드예요. 그래서 각 노드가 정확히 자기 자리에 들어가요.

**`MOVE`를 한 번에 `insertBefore`하지 않는 이유**: 아직 옮기지 않은 노드가 앞쪽에 남아 있으면 인덱스가 어긋나요. 떼어 내기와 넣기로 나눠도 `MutationObserver` 기록은 2건으로 같아요.

`REPLACE`의 대상이 루트여도 같아요. 루트의 부모는 영역이므로 영역 안에서 바뀌어요.

## 예시

```text
이전: <ul><li>a</li><li>b</li><li>c</li></ul>     (ul의 경로 [0])
새것: <ul><li>a</li></ul>
Patch: REMOVE [0, 2], REMOVE [0, 1]
```

1단계에서 `b`, `c`를 먼저 찾아 두므로 어떤 순서로 지워도 결과가 같아요.

## 예외

`applyPatches`는 예외를 잡지 않아요. 예외가 나면 DOM이 절반만 바뀐 채로 호출한 쪽에 전달돼요. 복구는 호출하는 쪽의 책임이에요([verify-page.md](verify-page.md#patch-실패)).

| 예외가 나는 입력 | 오류 |
|---|---|
| `<input type="file" value="a">` | `value` 프로퍼티 대입에서 `InvalidStateError` (jsdom에서 확인) |

## 복잡도

- 찾기: O(Patch 수 × 깊이).
- 적용: O(변경된 서브트리 크기).
- 대상 참조: O(Patch 수).
- `childNodes[i]` 조회 비용은 브라우저 구현에 달려 있어요. 측정하지 않았으므로 상수 시간이라고 가정하지 않아요.

## 테스트

`src/patch.test.ts`에서 `node:test`와 `jsdom`으로 확인해요.

| 검사 | 기대값 |
|---|---|
| 인덱스 밀림 | 형제 여러 개 동시 삭제(위치 비교, key 목록) 후 DOM이 새 VNode와 같음 |
| 최소 변경 | 텍스트 하나만 바꾸면 Patch 1개, `MutationObserver` 기록 1건 |
| DOM 재사용 | 텍스트만 바뀐 노드, key로 이동한 노드가 같은 객체(`===`) |
| 자식 종류 전환 | 텍스트 ↔ 배열, 배열 → 없음, 없음 → 텍스트, 텍스트 → 없음, 루트 교체 |
| 영역 독립 | 같은 VNode로 두 영역을 그린 뒤 한쪽만 고쳐도 다른 쪽은 그대로 |
| 속성 | 새 `option`과 함께 `select` 값 변경, 삭제 후 빈 `class` 없음 |
| 무작위 key 목록 | 적용 결과의 `innerHTML`이 새로 그린 것과 같음. 모든 VNode를 `Object.freeze` |
| 자가 검사 | `readArea(container.firstElementChild)`가 새 VNode와 `assert.deepStrictEqual`로 같음 |

자가 검사를 `toHTML` 문자열로 비교하면 안 돼요. `value`를 마지막에 쓰므로 DOM의 속성 순서가 VNode와 달라져서(`<option selected value="be">`) 내용이 같아도 실패해요. `assert.deepStrictEqual`은 객체 키 순서를 무시해요.

## 실제 React와 다른 점

- React는 커밋 단계에서 Fiber의 DOM 참조로 바로 고쳐요. 이 구현은 적용할 때 경로를 따라 찾아요.
- React는 레이아웃 효과와 ref 처리까지 커밋 단계에서 해요. 이 구현에는 ref가 없어요.
