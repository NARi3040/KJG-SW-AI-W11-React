# Virtual DOM 변환

> 이 문서를 읽으면 VNode를 만드는 `h`, DOM과 VNode를 오가는 함수, 속성을 DOM에 반영하는 `setProp`을 바로 구현할 수 있어요.

| 항목 | 내용 |
|---|---|
| 상태 | 공통 형식 합의 완료 ([vnode-spec.md](vnode-spec.md)) |
| 다루는 요구사항 | R1-1, R1-4, R3-2, R3-3. Phase 2에서 바뀌는 부분(`h` 오버로드, style 변환, [이벤트 위임](#이벤트-위임))은 R2-3, R2-4 |
| 관련 이슈 | #4, #8 |
| 소스 파일 | `src/vnode.ts`, `src/dom.ts`, `src/dom.test.ts` |

VNode와 `flags`의 정의는 [vnode-spec.md](vnode-spec.md#vnode)를 봐 주세요. 괄호 안 번호(`5-1 A` 등)는 Notion 정리본의 안건 번호예요. 결정 내용은 [phase-2-plan.md의 결정 반영표](phase-2-plan.md#결정-반영표)에 있어요.

## 함수

공개 함수만 적어요. `toVNode`, `readChildren`, `readProps` 같은 내부 함수는 [phase-1-plan.md](phase-1-plan.md#최무헌-srcdomts)를 봐 주세요.

| 함수 | 파일 | 입력 | 출력 |
|---|---|---|---|
| `createTextVNode(text)` | `vnode.ts` | `text: string \| number` | 텍스트 VNode. `flags`는 `TEXT` |
| `h(type, props, ...children)` | `vnode.ts` | 아래 설명 | VNode |
| `readArea(parent)` | `dom.ts` | `parent: ParentNode`: 읽을 영역 | `div.vdom-root`로 감싼 VNode |
| `fromHTML(html)` | `dom.ts` | `html: string`: HTML 소스 | `div.vdom-root`로 감싼 VNode |
| `toHTML(v)` | `dom.ts` | `v: VNode` | 한 줄 HTML 문자열 |
| `sourceOf(root)` | `dom.ts` | `root: VNode`: `div.vdom-root` VNode | 루트 안쪽의 들여쓴 HTML 문자열 |
| `createDOM(v)` | `dom.ts` | `v: VNode`: 컴포넌트가 없는 VNode | 새 `Node`. 문서에 붙이지 않아요 |
| `mountArea(container, vnode)` | `dom.ts` | `container: Element`, `vnode: VNode` | 없음. 새로 그린 뒤 영역의 내용을 바꿔요 |
| `setProp(el, key, next)` | `dom.ts` | `el: Element`, `key: string`, `next: PropValue` | 없음 |
| `applyProps(el, props)` | `dom.ts` | `el: Element`, `props: Props` | 없음. `value` 외 속성을 먼저, `value`를 마지막에 `setProp`해요 |
| `listen(container)` | `dom.ts` | `container: Element`: 루트 컴포넌트를 그린 영역 | 없음. [이벤트 위임](#이벤트-위임) 리스너를 붙여요 |

## `h`

```ts
function h<P>(type: (props: P) => VNode, props: P & { key?: Key | null }, ...children: Child[]): VNode;
function h(type: () => VNode, props?: { key?: Key | null } | null, ...children: Child[]): VNode;
function h(type: string, props?: Props | null, ...children: Child[]): VNode;
```

- `type`: 태그 이름(`"div"`) 또는 함수 컴포넌트.
- `props`: 요소면 `Props` 또는 `null`이에요. `key`, `className`을 받을 수 있어요. (예: `{ key: "a", class: "box" }`) 컴포넌트면 그 컴포넌트가 받는 props 타입 `P`예요. 배열이나 인자 있는 함수도 넘길 수 있어요. (예: `h(Counter, { count, setCount })`)
- `children`: VNode, 문자열, 숫자, `null`, `undefined`, 불리언, 또는 이것들의 중첩 배열.

오버로드는 타입 검사만 나눠요. 구현은 하나이고, 컴포넌트 VNode의 `props` 필드에는 받은 값이 그대로 들어가요([vnode-spec.md의 VNode](vnode-spec.md#vnode)). `h(Item, { wrong: 1 })`처럼 컴포넌트의 props와 맞지 않거나 `h("div", { items: [1] })`처럼 요소에 `PropValue`가 아닌 값을 넣으면 타입 오류예요.

- props를 받는 컴포넌트는 props를 꼭 넘겨요. `h(Item)`, `h(Item, null)`은 타입 오류예요. props가 모두 선택이어도 `h(Box, {}, "x")`처럼 `{}`를 넘겨요.
- 매개변수가 없는 컴포넌트(`() => VNode`)는 `h(App)`, `h(App, null)`, `h(App, { key: 1 })`을 받아요.
- `key`는 어느 컴포넌트에나 붙일 수 있고, 컴포넌트에는 넘어가지 않아요(아래 규칙 5).

처리 규칙이에요.

1. 중첩 배열을 평탄화하고 `null`, `undefined`, `true`, `false`를 버려요. `cond && h(A)`와 `list.map(...)`을 쓰기 위해서예요. 그다음 이웃한 문자열과 숫자를 하나로 합쳐요. 주석으로 나뉜 `<p>a<!--c-->b</p>`가 소스 `<p>ab</p>`를 다시 읽은 결과와 같아지게 하기 위해서예요.
2. 남은 자식이 텍스트 하나면 `children`은 문자열이고 `TEXT_CHILDREN`이에요. 숫자는 문자열로 바꿔요.
3. 남은 자식이 그 밖이면 `children`은 배열이고 `ARRAY_CHILDREN`이에요. 요소와 섞인 텍스트는 텍스트 VNode로 감싸요.
4. 남은 자식이 없으면 `children`은 `null`이에요.
5. `props`에서 `key`를 꺼내 최상위 필드로 옮겨요. `null`과 `undefined`만 key 없음(`null`)이에요. `0`과 `""`도 key예요. 컴포넌트도 마찬가지라 컴포넌트가 받는 props에는 `key`가 없어요. `type`이 문자열(요소)이고 `class`가 없으면 `className`을 `class`로 바꿔요. 요소의 `style`이 객체면 아래 [style 변환](#style-변환)으로 문자열로 바꿔요. 컴포넌트의 props는 바꾸지 않고 그대로 넘겨요. 컴포넌트가 받은 `className`을 읽을 수 있어야 하기 때문이에요. 남은 속성이 없으면 `props`는 `null`이에요.
6. `type`이 문자열이면 `ELEMENT`, 함수면 `COMPONENT`를 `flags`에 합쳐요.

| 호출 | 결과 |
|---|---|
| `h("li", null, "하나")` | `{ type: "li", props: null, key: null, children: "하나", flags: 9 }` |
| `h("p", null, "a", 1)` | `children`은 `"a1"`, `flags: 9` |
| `h("p", null, "a", h("b"))` | `children`은 텍스트 VNode와 `b` VNode의 배열, `flags: 17` |
| `h("li", { key: "a", className: "x" })` | `{ type: "li", props: { class: "x" }, key: "a", children: null, flags: 1 }` |
| `h(Item, { className: "x" })` | `{ type: Item, props: { className: "x" }, key: null, children: null, flags: 4 }`. 컴포넌트라 `className`이 그대로예요 |
| `h("ul", null, false, null, [h("li"), [h("li")]])` | `children`은 `li` 2개의 배열 |
| `h("p", { style: { color: "red", fontSize: "12px" } })` | `props`는 `{ style: "color: red; font-size: 12px" }` |
| `h(Item, { style: { color: "red" } })` | `props.style`은 입력한 객체 그대로예요 |

### style 변환

렌더마다 `style: { ... }`를 새로 만들어도 Diff가 문자열끼리 비교해 같은 값이면 `PROPS`를 내지 않게 하려고 바꿔요(4-2 C). DOM에서 읽은 VNode의 `style`도 문자열이라 형식이 하나로 맞아요.

- 키를 넣은 순서대로 `이름: 값`을 `"; "`로 이어요. 끝에 `;`를 붙이지 않아요.
- 이름의 대문자는 `-`와 소문자로 바꿔요. `fontSize` → `font-size`, `WebkitTransition` → `-webkit-transition`. `--`로 시작하는 사용자 정의 속성은 그대로 둬요.
- 값이 빈 문자열인 키는 빼요. 결과가 빈 문자열이면 `style` 키를 지워요.
- 값은 검사하지 않아요. 브라우저가 받지 않는 값은 `cssText`에 넣을 때 무시돼요.

| 입력 | 결과 |
|---|---|
| `{ color: "red", fontSize: "12px" }` | `"color: red; font-size: 12px"` |
| `{ "--gap": "4px", gridTemplateColumns: "repeat(9, 2rem)" }` | `"--gap: 4px; grid-template-columns: repeat(9, 2rem)"` |
| `{ color: "" }`, `{}` | `style` 키 없음 |
| `"color: red"` | 그대로 |

## DOM → VNode

아래는 `readArea`와 `fromHTML`이 공통으로 따르는 읽기 규칙이에요. 둘 다 내부 함수 `readChildren`, `readProps`를 거쳐 읽어요. 요소 하나를 읽는 `toVNode`는 `readChildren`에서만 불리는 내부 함수라서, 모든 요소가 아래 규칙으로 걸러져요.

| 대상 | 처리 | 이유 |
|---|---|---|
| 공백뿐인 텍스트 | 줄바꿈(LF, CR)이 있으면 버려요. 없으면 원문 그대로 두고, 공백 하나로 줄이지 않아요. `pre`, `textarea` 안에서는 모두 유지해요. 공백은 HTML 공백(스페이스, 탭, LF, FF, CR)만이에요 | 줄바꿈이 있는 공백은 들여쓰기 같은 소스 서식이에요. 남기면 자식 인덱스가 어긋나고, `sourceOf`의 들여쓰기 때문에 변경 없이 Patch해도 `[]`가 나오지 않아요. 같은 줄의 공백(`</b> <i>`)은 화면에 그려지는 내용이에요. `trim()`이나 `\s`는 U+00A0(`&nbsp;`)도 공백으로 봐서 `<td>&nbsp;</td>`의 내용이 사라져요 |
| 내용이 있는 텍스트 | 다듬지 않고 그대로 둬요 | 앞뒤 공백도 화면에 보이는 내용이에요 |
| 주석 등 요소·텍스트가 아닌 노드 | 버려요 | VNode로 표현하지 않아요 |
| `script` 요소 | 버려요 | 테스트 영역에 적은 코드가 Patch 순간 실행되는 것을 막아요 |
| 이름이 `on`으로 시작하는 속성 | 버려요 | 값이 실행될 코드예요. `on*`은 함수만 받아요 |
| 이름이 `=`로 시작하는 속성 | 버려요 | 파서는 `<p =x>`의 `=x`를 속성 이름으로 받지만 `setAttribute`는 `InvalidCharacterError`를 던져요(jsdom 31, Chrome 157에서 확인). 남기면 그릴 수 없는 VNode가 생겨요 |
| `data-key` 속성 | `key`로 쓰고 `props`에도 남겨요. key는 `data-key`에서만 가져와요 | 왕복해도 key가 사라지지 않아요 |
| `key` 속성 | 버려요 | `sourceOf`는 `data-key`만 써요. `key` 속성을 key로 쓰면 변경 없이 다시 Patch해도 `REMOVE`, `CREATE`가 나와요 |
| 그 밖의 속성 | 문자열 그대로 `props`에 넣어요 | 불리언 속성(`checked`)의 값은 빈 문자열이에요 |

`readChildren`은 **주석·`script` 버리기 → 이웃한 텍스트 합치기 → 공백 규칙** 순서로 처리해요. 합친 뒤에 판단해야 주석을 지운 소스를 다시 읽은 결과와 같아요.

| 입력 | 자식 | 공백 판단을 먼저 하면 |
|---|---|---|
| `<p>a<!--x-->\n<b>b</b></p>` | `"a\n"`, `b` | `"a"`, `b`. 화면에서는 띄어 보이는데 VNode로 다시 그리면 붙어요 |
| `<p>\n<!--x--> <b>b</b></p>` | `b` | `" "`, `b` |

`fromHTML`은 `template` 요소의 `innerHTML`로 파싱해요. `template` 안의 내용은 스크립트 실행이나 이미지 로딩이 일어나지 않아서 안전하게 읽을 수 있어요.

**입력과 출력 예시**

| 입력 HTML | `toHTML(fromHTML(입력))` |
|---|---|
| `<ul>\n  <li>a</li>\n</ul>` | `<div class="vdom-root"><ul><li>a</li></ul></div>` |
| `<li data-key="a">x</li>` | `<div class="vdom-root"><li data-key="a">x</li></div>` (`key`는 `"a"`) |
| `<img src="x" onerror="f()">` | `<div class="vdom-root"><img src="x"></div>` |
| `<p>y</p><script>f()</script>` | `<div class="vdom-root"><p>y</p></div>` |

## VNode → HTML

`toHTML`의 규칙이에요.

- 값이 `null`, `undefined`, `false`이거나 함수, 객체인 속성은 쓰지 않아요. 객체 `style`은 `h`가 [문자열로 바꿔서](#style-변환) `toHTML`과 Patch 로그에 나와요.
- 값이 `true`나 빈 문자열인 속성은 이름만 써요. (예: `<input checked>`)
- 속성 값과 텍스트의 `&`, `<`, `>`, `"`를 이스케이프해요.
- `style`, `xmp`, `iframe`, `noembed`, `noframes`의 내용은 이스케이프하지 않아요. 파서가 이 내용의 문자 참조를 풀지 않아서, 이스케이프하면 Patch할 때마다 내용이 바뀌어요.
- `pre`, `textarea`의 내용이 `\n`으로 시작하면 여는 태그 뒤에 `\n`을 하나 더 써요. 파서가 여는 태그 바로 뒤의 줄바꿈 하나를 버리기 때문이에요.
- `area`, `base`, `br`, `col`, `embed`, `hr`, `img`, `input`, `link`, `meta`, `source`, `track`, `wbr`은 닫는 태그를 쓰지 않아요.

`sourceOf`는 루트 안쪽만 만들어요. 자식이 모두 요소일 때만 두 칸씩 들여써 줄을 바꾸고, 텍스트가 섞이면 한 줄로 둬요. `pre`, `textarea`를 만나면 그 서브트리 전체를 `toHTML` 한 줄로 써요. 안쪽 요소를 들여쓰면 그 공백이 `pre` 안이라 텍스트로 남아 자식이 늘어나요. 들여쓰기는 항상 줄바꿈과 함께 들어가므로 다시 읽을 때 버려져서 내용이 바뀌지 않아요. 같은 줄의 공백 `" "`이 자식에 있으면 텍스트가 섞인 것이라 한 줄로 쓰므로 그대로 돌아와요.

```text
fromHTML("<ul><li>a</li><li>b</li></ul>")를 sourceOf로 바꾼 결과

<ul>
  <li>a</li>
  <li>b</li>
</ul>
```

## VNode → DOM

`createDOM`의 순서예요.

1. 컴포넌트 VNode면 오류를 던져요. 컴포넌트는 먼저 `expand`로 펼쳐요([component-hooks.md](component-hooks.md)).
2. 텍스트 VNode면 텍스트 노드를 돌려줘요.
3. 요소를 만들고 **자식 → `value` 외 속성 → `value`** 순서로 채워요.

| 순서의 이유 | 예시 |
|---|---|
| 자식 먼저 | `select`는 `option`이 있어야 값을 고를 수 있어요 |
| `value` 마지막 | `<input type="range" min max value>`는 `min`, `max`가 먼저 있어야 값이 기본 범위(0–100)에 잘리지 않아요 |

서브트리를 문서 밖에서 다 만든 뒤 호출하는 쪽이 한 번에 넣어요.

`mountArea`는 `createDOM(vnode)`를 먼저 만든 뒤 `replaceChildren`으로 영역의 내용을 바꿔요. 먼저 비우면 생성이 실패했을 때 빈 영역만 남기 때문이에요. 첫 렌더와 실패 복구에만 써요.

## `setProp`

위에서부터 먼저 맞는 줄 **하나**를 적용해요. `off`는 `next`가 `null`, `undefined`, `false`인 경우예요. `class`와 `style`을 제외한 속성에서는 객체 값도 `off`로 처리해요.

| `key` | 처리 | 이유 |
|---|---|---|
| `on`으로 시작 | 속성으로도 요소 리스너로도 붙이지 않아요. 값이 함수면 [이벤트 위임](#이벤트-위임)의 핸들러 맵에 넣고, 아니면 맵에서 그 이름을 지워요 | 문자열로 넣어도 실행 코드가 들어가지 않아요 |
| `class` | `off`면 속성 제거, 아니면 `className` 대입 | 비우기만 하면 `class=""`가 남아요 |
| `style` | `off`면 속성 제거. 문자열이면 `cssText` 대입. 객체면 `cssText`를 비우고 `el.style`에 복사(키는 camelCase). `h`로 만든 VNode에는 객체가 없지만 `setProp`을 직접 부르는 경우를 위해 남겨요 | DOM에서 읽은 스타일은 문자열이에요 |
| 그 밖 | `off`면 `removeAttribute`, 아니면 `setAttribute`를 써요. 값이 `true`면 빈 문자열이에요 | DOM을 다시 읽었을 때 VNode와 같아야 해요 |

"그 밖" 줄을 적용한 뒤 아래 경우에는 프로퍼티도 함께 바꿔요.

| `key`와 조건 | 처리 | 이유 |
|---|---|---|
| `checked`, `selected` (`el`에 그 프로퍼티가 있을 때) | 프로퍼티에 `!off`를 대입 | 사용자가 바꾼 뒤에는 프로퍼티가 현재 상태예요. 읽어 온 값 `""`도 켜짐이에요 |
| `value` (`el`이 `input`, `select`, `textarea`일 때) | 프로퍼티에 대입, `off`면 빈 문자열. `type`이 `file`인 `input`에는 대입하지 않아요 | 이 요소들의 현재값은 프로퍼티예요. 다른 요소에는 대입하지 않아요. `output`은 자식이 지워져 경로가 어긋나고, `li`는 값이 `0`으로 바뀌고, `progress`는 예외가 나요. 파일 입력의 `value` 프로퍼티는 빈 문자열만 받아 `InvalidStateError`가 나요. 속성은 그대로 남아요 |

## 이벤트 위임

Phase 2에서 구현해요(4-1 C). 요소마다 리스너를 붙이지 않고 루트 컴포넌트를 그린 영역에 이벤트 종류마다 리스너 하나를 붙여요. 렌더마다 핸들러가 새 함수여도 리스너를 붙였다 떼지 않고, 요소를 만들거나 지울 때 등록 작업이 없어요. Diff는 그대로라 새 함수면 `PROPS` Patch는 여전히 나와요. 그 Patch는 맵의 함수만 바꿔요.

- **핸들러 맵:** `WeakMap<Element, Record<string, Listener>>`예요. `setProp(el, "onClick", f)`는 `el`의 기록에 `click: f`를 넣어요. 이벤트 이름은 `key.slice(2).toLowerCase()`예요. 그래서 대소문자는 상관없고(`onContextMenu`도 `contextmenu`), 이 문서는 아래 표의 `onContextmenu` 표기를 써요. `REMOVE` 때 맵에서 지우는 코드는 없어요. 지운 요소를 아무도 참조하지 않으면 `WeakMap`이 정리해요.
- **`listen(container)`:** 아래 이벤트마다 `container.addEventListener(이름, 리스너)`를 한 번씩 불러요. 이미 붙인 영역은 `WeakSet`으로 기억해 다시 붙이지 않아요.
- **전달:** 리스너는 먼저 `event.target`에서 `parentNode`를 따라 `container` 직전까지의 요소(`nodeType` 1)를 목록으로 모아요. 그다음 목록 순서대로 맵에서 `event.type`의 함수를 찾아 `fn(event)`로 불러요. 함수는 부르는 순간에 찾으므로 언제나 최신 핸들러예요. 부른 뒤 `event.cancelBubble`이 `true`면(핸들러가 `stopPropagation()`을 불렀으면) 멈춰요. 목록을 먼저 모으는 이유는 핸들러 안의 `setState`가 요소를 지우면 그 요소의 `parentNode`가 `null`이 되어 부모까지 못 가기 때문이에요.
- `preventDefault()`는 같은 이벤트 객체라 그대로 동작해요.
- **`event.currentTarget`은 영역이에요.** 리스너를 붙인 곳이 영역이라서, 핸들러를 단 요소가 아니에요. 핸들러를 단 요소가 필요하면 클로저로 잡거나 `event.target`을 써요. 입력창의 값은 `event.target.value`로 읽어요(입력창은 자식이 없어 `target`이 그 입력창이에요).

| 위임하는 이벤트 | 쓰는 이름 |
|---|---|
| `click`, `dblclick`, `contextmenu` | `onClick`, `onDblclick`, `onContextmenu` |
| `input`, `change`, `submit` | `onInput`, `onChange`, `onSubmit` |
| `keydown`, `keyup` | `onKeydown`, `onKeyup` |
| `focusin`, `focusout` | `onFocusin`, `onFocusout` |

| 상황 | 처리 |
|---|---|
| 위 표에 없는 이벤트(`onFocus`, `onBlur`, `onMouseenter` 등) | 맵에 들어가지만 불리지 않아요. `focus`, `blur`, `mouseenter`는 위로 올라오지 않아 영역에서 받을 수 없어요. 포커스는 `onFocusin`, `onFocusout`을 써요 |
| `listen`을 부르지 않은 영역(검증 페이지) | 핸들러가 불리지 않아요. 검증 페이지는 HTML에서 읽어 `on*`이 없어요 |
| 핸들러 안에서 `setState` | 즉시 다시 그려요. 리스너는 다시 그린 뒤 이벤트 시작 때 모은 목록의 나머지 요소로 이어서 가요. 그사이 지워진 요소의 핸들러도 맵에 남아 있으면 불려요 |
| 영역 안에 `listen`한 다른 영역 | 지원하지 않아요. 바깥 영역의 리스너도 안쪽 요소까지 목록에 모아서 안쪽 핸들러가 두 번 불려요. 루트 컴포넌트는 영역 하나에 하나만 그려요 |
| `dispatchEvent`로 만든 이벤트 | `bubbles: true`여야 영역까지 올라와요. `preventDefault()`를 확인하려면 `cancelable: true`도 필요해요. `el.click()`은 저절로 올라와요 |

## 엣지 케이스

| 입력 | 결과 |
|---|---|
| 빈 영역, 빈 문자열 | `children`이 `null`인 루트 |
| `<p>a<!--c-->b</p>` | `children`은 `"ab"`. 주석은 버려지고 이웃한 텍스트는 합쳐져요 |
| `<p><b>a</b> <i>b</i></p>` | 자식은 `b`, `" "`, `i`예요. 같은 줄의 공백은 남아 화면처럼 띄어져요 |
| `<p><b>a</b>\n<i>b</i></p>` | **공백이 사라져요.** 브라우저는 띄어 보여 주지만 줄바꿈이 있는 공백이라 버려요. 띄어 보이려면 같은 줄에 써요 |
| `<div>a</div> <div>b</div>` | `" "`이 자식으로 남아요. 화면에는 보이지 않지만 VNode와 Patch 로그에 나와요 |
| `<p> </p>`, `<p>\n</p>` | `children`은 `" "`, `null`이에요 |
| `<div key="a">` | `key` 속성은 읽을 때 버려요. key는 `null`이에요. key를 남기려면 `data-key`로 써요 |
| `<li data-key="y" key="x">` | key는 `"y"`예요 |
| `<li data-key="">`, `h("li", { key: 0 })` | key는 `""`, `0`이에요. key 없음이 아니에요 |
| `<template><p>x</p></template>` | 내용을 읽지 않아요. 내용은 `childNodes`가 아니라 `content`에 있어요 |
| `<pre>\n\nabc</pre>`, `<textarea>\n\n</textarea>` | 처음 읽을 때 파서가 맨 앞 줄바꿈 하나를 버려 내용은 `"\nabc"`, `"\n"`이에요. 그 뒤로는 `toHTML`이 줄바꿈을 하나 더 써서 왕복해도 그대로예요 |
| `<svg>` | 미지원. HTML 요소로 만들어져 그림이 그려지지 않아요. 네임스페이스가 필요해요 |
| `iframe srcdoc`, `href="javascript:..."` | 막지 않아요. 입력하는 사람이 사용자 자신이라 범위 밖이에요 |
| `h("script", ...)` | 막지 않아요. 개발자가 쓴 코드예요 |

## 테스트

`src/dom.test.ts`에서 `node:test`와 `jsdom`으로 확인해요.

### DOM 전역 규칙

`src/dom.ts`, `src/patch.ts`, `src/app.ts`가 모두 따라요. Node 26.13.0에는 `document`뿐 아니라 `Node`, `HTMLInputElement`, `MutationObserver`도 없어요. 테스트는 `globalThis.document`만 설정하므로, 다른 전역을 쓰면 `ReferenceError`가 나요.

- DOM 전역은 함수 안에서만 써요. `fromHTML`용 `template`을 모듈 최상위에 만들면, 정적 import가 테스트 본문보다 먼저 평가돼서 `document is not defined`가 나요.
- `document` 외 전역은 쓰지 않아요. 노드 종류는 `nodeType` 숫자(요소 1, 텍스트 3)로, 요소 종류는 `tagName`으로 판단해요. `instanceof HTMLInputElement`를 쓰지 않아요.
- 그 밖의 DOM 생성자는 `node.ownerDocument.defaultView`에서 꺼내요. (예: `countMutations`의 `MutationObserver`)
- 테스트 파일마다 안에서 `globalThis.document`를 설정해요. 설정 코드를 별도 파일로 빼면 `tsconfig.build.json`의 제외 대상(`src/**/*.test.ts`)에서 벗어나 빌드에 들어가요.

### 검사

- `h` 정규화: 위 표의 호출 전부와 [style 변환](#style-변환)의 표. 오버로드는 `// @ts-expect-error`를 단 줄로 타입 오류를 확인해요.
- 읽기: 위 입력·출력 표, 공백 규칙과 합치는 순서(위 두 표), `pre` 유지, `&nbsp;` 유지, `data-key`, `key` 속성 버림, `=`로 시작하는 속성 버림, 거짓 값 key.
- 왕복: [무작위 입력](#무작위-입력)에서 `fromHTML(sourceOf(v))`가 `v`와 같은지.
- 소스 왕복: `fromHTML(sourceOf(fromHTML(x)))`가 `fromHTML(x)`와 같은지. `x`는 `<p>a<!--c-->b</p>`, `<pre>\n\nabc</pre>`, `<textarea>\n\n</textarea>`, `<pre><div><b>x</b><i>y</i></div></pre>`, `<ul><li key="x">a</li></ul>`, `<li data-key="y" key="x">a</li>`, `<p><b>a</b> <i>b</i></p>`, `<p><b>a</b>\n<i>b</i></p>`, `<p>a<!--x-->\n<b>b</b></p>`, `<p>\n<!--x--> <b>b</b></p>`, `<li> <b>x</b></li>`, `<ul>\n  <li>a</li>\n  <li>b</li>\n</ul>`예요. 무작위 입력은 규칙대로 만든 입력만 써서 이런 경우를 잡지 못해요.
- 다양한 태그: 아래 [HTML](#다양한-태그)로 왕복과 자가 검사를 해요.
- `createDOM`: `select`의 `value`, `range`의 `min`/`max`/`value`, 읽어 온 `checked`, `value`가 있는 파일 입력.
- `mountArea`: 생성이 실패하면 기존 내용이 그대로임.
- `setProp`: 빈 `class` 없음, 문자열과 함수 `on*`이 모두 붙지 않음, 일반 속성을 문자열에서 객체 값으로 바꾸면 기존 속성 제거, 객체 값이면 `checked`·`selected`에 `false`를 대입하고 폼의 `value`에 빈 문자열 대입, `output`의 자식과 `li`의 `value`가 그대로임, `progress`에 잘못된 값을 넣어도 예외가 없음.
- 이벤트 위임(Phase 2): 요소의 `addEventListener`는 0회, `listen`을 두 번 불러도 영역의 `addEventListener`는 위임하는 이벤트 수만큼만, 핸들러를 바꾸면 새 함수만 불림, `null`로 지우면 안 불림, 자식 → 부모 순서, `stopPropagation()` 뒤 부모 안 불림, `contextmenu`의 `preventDefault()` 뒤 `defaultPrevented`가 `true`, 핸들러 안 `event.currentTarget`이 영역, `onInput` 핸들러에서 `event.target.value`가 입력한 값.

### 다양한 태그

줄바꿈이 들어간 요소 사이 공백은 읽을 때 버려져요. 줄을 바꿔 적어도 결과는 같아요. `<p>` 안의 `</b> <i>`처럼 같은 줄의 공백은 남아요.

```text
<section id="s" class="a b" data-x="1">
  <h1>제목</h1>
  <p>글 <b>굵게</b> <i>기울임</i></p>
  <a href="#x">링크</a>
  <ul><li data-key="a">a</li><li data-key="b">b</li></ul>
  <ol start="3"><li>c</li></ol>
  <table>
    <thead><tr><th>h</th></tr></thead>
    <tbody><tr><td colspan="2">d</td></tr></tbody>
  </table>
  <form>
    <label><input type="checkbox" checked> 체크</label>
    <input type="range" min="200" max="300" value="250">
    <input type="text" value="t">
    <select name="s"><option value="x">X</option><option value="y" selected>Y</option></select>
    <textarea>  두
줄</textarea>
    <button type="button" value="v">버튼</button>
  </form>
  <pre>  공백
유지</pre>
  <img src="x.png" alt="그림"><br><hr>
  <style>a > b { color: red; }</style>
  <output value="o"><b>출력</b></output>
</section>
```

| 그린 뒤 확인할 값 | 기대값 |
|---|---|
| `range`의 `value` | `"250"` |
| 체크박스의 `checked` | `true` |
| `select`의 `value` | `"y"` |
| `output` 안의 `b` | `"출력"` |

### 무작위 입력

시드를 줄 수 있게 `Math.random` 대신 테스트 파일 안에 mulberry32 같은 난수 함수를 둬요. 시드 1–5에서 시드마다 2,000개를 돌리고, 실패 메시지에 시드, 순번, 입력을 남겨요. 이 규칙으로 만든 입력만 왕복이 성립해요.

| 항목 | 규칙 | 이유 |
|---|---|---|
| 태그 | `div`, `span`, `section`, `ul`, `b`, `i`, `em`, `br` | `p`, `li`는 파서가 잘못된 중첩을 고쳐 읽어요 |
| 크기 | 최상위 0–3개, 요소마다 자식 0–3개, 깊이는 5층까지. `br`은 자식 0개 | 2026-11-07 측정에서 왕복, 쌍 비교, key 목록을 합쳐 약 6초가 걸렸어요. `<br>x`는 다시 읽으면 `br`과 `x`가 형제가 돼요 |
| 속성 | `id`, `class`, `data-x`만. 값은 영문자와 숫자 | `key`는 DOM에 남지 않고, `style`은 브라우저가 고쳐 써요 |
| 텍스트 | 영문자와 숫자만. 주석은 넣지 않아요 | 주석, `pre`, `textarea`는 [소스 왕복](#검사)에서 따로 확인해요 |
