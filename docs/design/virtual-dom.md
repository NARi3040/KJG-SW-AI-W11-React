# Virtual DOM 변환

> 이 문서를 읽으면 VNode를 만드는 `h`, DOM과 VNode를 오가는 함수, 속성을 DOM에 반영하는 `setProp`을 바로 구현할 수 있어요.

| 항목 | 내용 |
|---|---|
| 상태 | 공통 형식 합의 완료 ([vnode-spec.md](vnode-spec.md)) |
| 다루는 요구사항 | R1-1, R1-4, R3-2, R3-3 |
| 관련 이슈 | #4 |
| 소스 파일 | `src/vnode.ts`, `src/dom.ts`, `src/dom.test.ts` |

VNode와 `flags`의 정의는 [vnode-spec.md](vnode-spec.md#vnode)를 봐 주세요.

## 함수

| 함수 | 파일 | 입력 | 출력 |
|---|---|---|---|
| `createTextVNode(text)` | `vnode.ts` | `text: string \| number` | 텍스트 VNode. `flags`는 `TEXT` |
| `h(type, props, ...children)` | `vnode.ts` | 아래 설명 | VNode |
| `toVNode(el, keepWs = false)` | `dom.ts` | `el: Element`, `keepWs`: 공백 텍스트 유지 여부 | 요소 VNode |
| `readArea(parent)` | `dom.ts` | `parent: ParentNode`: 읽을 영역 | `div.vdom-root`로 감싼 VNode |
| `fromHTML(html)` | `dom.ts` | `html: string`: HTML 소스 | `div.vdom-root`로 감싼 VNode |
| `toHTML(v)` | `dom.ts` | `v: VNode` | 한 줄 HTML 문자열 |
| `sourceOf(root)` | `dom.ts` | `root: VNode`: `div.vdom-root` VNode | 루트 안쪽의 들여쓴 HTML 문자열 |
| `createDOM(v)` | `dom.ts` | `v: VNode`: 컴포넌트가 없는 VNode | 새 `Node`. 문서에 붙이지 않아요 |
| `mountArea(container, vnode)` | `dom.ts` | `container: Element`, `vnode: VNode` | 없음. 영역을 비우고 새로 그려요 |
| `setProp(el, key, next)` | `dom.ts` | `el: Element`, `key: string`, `next: PropValue` | 없음 |

## `h`

- `type`: 태그 이름(`"div"`) 또는 함수 컴포넌트.
- `props`: 속성 객체 또는 `null`. `key`, `className`을 받을 수 있어요. (예: `{ key: "a", class: "box" }`)
- `children`: VNode, 문자열, 숫자, `null`, `undefined`, 불리언, 또는 이것들의 중첩 배열.

처리 규칙이에요.

1. 중첩 배열을 평탄화하고 `null`, `undefined`, `true`, `false`를 버려요. `cond && h(A)`와 `list.map(...)`을 쓰기 위해서예요.
2. 남은 자식이 텍스트 하나면 `children`은 문자열이고 `TEXT_CHILDREN`이에요. 숫자는 문자열로 바꿔요.
3. 남은 자식이 그 밖이면 `children`은 배열이고 `ARRAY_CHILDREN`이에요. 요소와 섞인 텍스트는 텍스트 VNode로 감싸요.
4. 남은 자식이 없으면 `children`은 `null`이에요.
5. `props`에서 `key`를 꺼내 최상위 필드로 옮겨요. `class`가 없으면 `className`을 `class`로 바꿔요. 남은 속성이 없으면 `props`는 `null`이에요.
6. `type`이 문자열이면 `ELEMENT`, 함수면 `COMPONENT`를 `flags`에 합쳐요.

| 호출 | 결과 |
|---|---|
| `h("li", null, "하나")` | `{ type: "li", props: null, key: null, children: "하나", flags: 9 }` |
| `h("p", null, "a", h("b"))` | `children`은 텍스트 VNode와 `b` VNode의 배열, `flags: 17` |
| `h("li", { key: "a", className: "x" })` | `{ type: "li", props: { class: "x" }, key: "a", children: null, flags: 1 }` |
| `h("ul", null, false, null, [h("li"), [h("li")]])` | `children`은 `li` 2개의 배열 |

## DOM → VNode

`toVNode`, `readArea`, `fromHTML`은 아래 규칙으로 읽어요.

| 대상 | 처리 | 이유 |
|---|---|---|
| 공백뿐인 텍스트 노드 | 버려요. `pre`, `textarea` 안에서는 유지해요 | 줄바꿈과 들여쓰기가 자식 인덱스를 어긋나게 해요 |
| 내용이 있는 텍스트 | 다듬지 않고 그대로 둬요 | 앞뒤 공백도 화면에 보이는 내용이에요 |
| 주석 등 요소·텍스트가 아닌 노드 | 버려요 | VNode로 표현하지 않아요 |
| `script` 요소 | 버려요 | 테스트 영역에 적은 코드가 Patch 순간 실행되는 것을 막아요 |
| 이름이 `on`으로 시작하는 속성 | 버려요 | 값이 실행될 코드예요. `on*`은 함수만 받아요 |
| `data-key` 속성 | `key`로 쓰고 `props`에도 남겨요 | 왕복해도 key가 사라지지 않아요 |
| 그 밖의 속성 | 문자열 그대로 `props`에 넣어요 | 불리언 속성(`checked`)의 값은 빈 문자열이에요 |

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

- 값이 `null`, `undefined`, `false`이거나 함수, 객체인 속성은 쓰지 않아요. 그래서 객체로 넣은 `style`은 `toHTML`과 Patch 로그에 나오지 않아요.
- 값이 `true`나 빈 문자열인 속성은 이름만 써요. (예: `<input checked>`)
- 속성 값과 텍스트의 `&`, `<`, `>`, `"`를 이스케이프해요.
- `style`, `xmp`, `iframe`, `noembed`, `noframes`의 내용은 이스케이프하지 않아요. 파서가 이 내용의 문자 참조를 풀지 않아서, 이스케이프하면 Patch할 때마다 내용이 바뀌어요.
- `area`, `base`, `br`, `col`, `embed`, `hr`, `img`, `input`, `link`, `meta`, `source`, `track`, `wbr`은 닫는 태그를 쓰지 않아요.

`sourceOf`는 루트 안쪽만 만들어요. 자식이 모두 요소일 때만 두 칸씩 들여써 줄을 바꾸고, 텍스트가 섞이거나 `pre`, `textarea`면 한 줄로 둬요. 요소 사이에 넣은 공백은 다시 읽을 때 버려지므로 내용이 바뀌지 않아요.

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

`mountArea`는 영역의 `textContent`를 비우고 `createDOM(vnode)`를 붙여요. 첫 렌더와 실패 복구에만 써요.

## `setProp`

위에서부터 먼저 맞는 줄 **하나**를 적용해요. `off`는 `next`가 `null`, `undefined`, `false`인 경우예요.

| `key` | 처리 | 이유 |
|---|---|---|
| `on`으로 시작 | **Phase 1:** 아무것도 하지 않아요. 속성으로도 리스너로도 붙이지 않아요. **Phase 2:** 아래 invoker 규칙을 따라요 | 문자열로 넣어도 실행 코드가 들어가지 않아요 |
| `class` | `off`면 속성 제거, 아니면 `className` 대입 | 비우기만 하면 `class=""`가 남아요 |
| `style` | `off`면 속성 제거. 문자열이면 `cssText` 대입. 객체면 `cssText`를 비우고 `el.style`에 복사(키는 camelCase) | DOM에서 읽은 스타일은 문자열이에요 |
| 그 밖 | `off`면 `removeAttribute`. 아니면 `setAttribute`, 값이 `true`면 빈 문자열이에요. 객체 값은 속성으로 쓰지 않아요 | DOM을 다시 읽었을 때 VNode와 같아야 해요 |

"그 밖" 줄을 적용한 뒤 아래 경우에는 프로퍼티도 함께 바꿔요.

| `key`와 조건 | 처리 | 이유 |
|---|---|---|
| `checked`, `selected` (`el`에 그 프로퍼티가 있을 때) | 프로퍼티에 `!off`를 대입 | 사용자가 바꾼 뒤에는 프로퍼티가 현재 상태예요. 읽어 온 값 `""`도 켜짐이에요 |
| `value` (`el`이 `input`, `select`, `textarea`일 때) | 프로퍼티에 대입, `off`면 빈 문자열 | 이 요소들의 현재값은 프로퍼티예요. 다른 요소에는 대입하지 않아요. `output`은 자식이 지워져 경로가 어긋나고, `li`는 값이 `0`으로 바뀌고, `progress`는 예외가 나요 |

**invoker 규칙** (Phase 2에서 구현해요. Phase 1에는 함수 리스너를 쓰는 곳이 없어요): 이벤트 이름은 `key.slice(2).toLowerCase()`예요. 요소마다 "이벤트 이름 → invoker" 맵을 `WeakMap<Element, Record<string, Invoker>>`에 둬요. invoker는 현재 함수(`fn`)를 호출하는 리스너예요. 처음 한 번만 `addEventListener`하고, 이후에는 `fn`만 바꿔요. 값이 함수가 아니면 있던 리스너를 떼요. 렌더마다 새로 생기는 화살표 함수 때문에 매번 붙였다 떼지 않기 위해서예요.

## 엣지 케이스

| 입력 | 결과 |
|---|---|
| 빈 영역, 빈 문자열 | `children`이 `null`인 루트 |
| `<p>a<!--c-->b</p>` | 텍스트 VNode 2개. 주석은 버려져요 |
| `<p><b>a</b> <i>b</i></p>` | **요소 사이 공백이 사라져요.** 공백뿐인 텍스트로 보기 때문이에요. 띄어쓰기가 필요하면 텍스트에 붙여 써요 |
| `<div key="a">` | `key` 속성은 `h`가 `key`로 가져가 DOM에 남지 않아요. 저장은 `data-key`로 해요 |
| `<template><p>x</p></template>` | 내용을 읽지 않아요. 내용은 `childNodes`가 아니라 `content`에 있어요 |
| `<pre>\n\nabc</pre>` | 왕복하면 맨 앞 줄바꿈이 하나 줄어요. 파서가 `pre` 첫 줄바꿈을 버리기 때문이에요 |
| `<svg>` | 미지원. HTML 요소로 만들어져 그림이 그려지지 않아요. 네임스페이스가 필요해요 |
| `iframe srcdoc`, `href="javascript:..."` | 막지 않아요. 입력하는 사람이 사용자 자신이라 범위 밖이에요 |
| `h("script", ...)` | 막지 않아요. 개발자가 쓴 코드예요 |

## 테스트

`src/dom.test.ts`에서 `node:test`와 `jsdom`으로 확인해요. 모듈이 전역 `document`를 쓰므로 테스트 파일 안에서 `globalThis.document`를 설정해요. 설정 코드를 별도 파일로 빼면 `tsconfig.build.json`의 제외 대상(`src/**/*.test.ts`)에서 벗어나 빌드에 들어가요.

- `h` 정규화: 위 표의 네 호출.
- 읽기: 위 입력·출력 표, 공백 제거, `pre` 유지, `data-key`.
- 왕복: [무작위 입력](#무작위-입력)에서 `fromHTML(sourceOf(v))`가 `v`와 같은지.
- 다양한 태그: 아래 [HTML](#다양한-태그)로 왕복과 자가 검사를 해요.
- `createDOM`: `select`의 `value`, `range`의 `min`/`max`/`value`, 읽어 온 `checked`.
- `setProp`: 빈 `class` 없음, 문자열과 함수 `on*`이 모두 붙지 않음, `output`의 자식과 `li`의 `value`가 그대로임, `progress`에 잘못된 값을 넣어도 예외가 없음.
- Phase 2에서 추가: 핸들러를 교체해도 `addEventListener`는 1회, 새 핸들러 호출, 제거 시 해제.

### 다양한 태그

요소 사이의 공백과 줄바꿈은 읽을 때 버려져요. 줄을 바꿔 적어도 결과는 같아요.

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
| 크기 | 최상위 0–3개, 요소마다 자식 0–3개, 깊이는 5층까지 | 2026-11-07 측정에서 왕복, 쌍 비교, key 목록을 합쳐 약 6초가 걸렸어요 |
| 속성 | `id`, `class`, `data-x`만. 값은 영문자와 숫자 | `key`는 DOM에 남지 않고, `style`은 브라우저가 고쳐 써요 |
| 텍스트 | 영문자와 숫자만. 텍스트를 연달아 넣지 않고 주석도 넣지 않아요 | `<p>a<!--c-->b</p>`는 텍스트 2개지만 소스는 `<p>ab</p>`라 다시 읽으면 1개예요 |

## 실제 React와 다른 점

- React 앱은 보통 JSX에서 요소를 만들고, DOM을 읽어 만들지 않아요. DOM 읽기는 이 과제의 Phase 1 요구사항이에요.
- 속성 이름이 달라요. React는 `className`을 쓰고, 이 구현은 HTML 이름 `class`를 써요. `h`는 `className`을 받으면 `class`로 바꿔요.
