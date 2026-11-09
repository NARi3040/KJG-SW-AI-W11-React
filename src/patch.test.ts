import assert from "node:assert/strict";
import { test } from "node:test";
import { JSDOM } from "jsdom";
import { diff } from "./diff.ts";
import { fromHTML, readArea } from "./dom.ts";
import { applyPatches, formatPatches, resolve } from "./patch.ts";
import { h } from "./vnode.ts";
import type { Patch } from "./vnode.ts";

function createArea(html: string): HTMLElement {
  return createAreaFromHTML(`<div class="vdom-root">${html}</div>`);
}

function createEmptyArea(): HTMLElement {
  return createAreaFromHTML("");
}

function createAreaFromHTML(html: string): HTMLElement {
  const dom = new JSDOM(
    `<!doctype html><html><body><div id="area"></div></body></html>`,
  );
  globalThis.document = dom.window.document;

  const area = document.getElementById("area");
  assert.ok(area);
  area.innerHTML = html;
  return area;
}

function countMutations<T>(
  target: Node,
  fn: () => T,
): { result: T; mutations: number } {
  const view = target.ownerDocument?.defaultView;
  assert.ok(view);

  const observer = new view.MutationObserver(() => {});
  observer.observe(target, {
    childList: true,
    subtree: true,
    characterData: true,
  });

  try {
    return { result: fn(), mutations: observer.takeRecords().length };
  } finally {
    observer.disconnect();
  }
}

test("resolve: []는 container.firstChild예요", () => {
  const area = createArea("<ul><li>a</li></ul>");

  assert.equal(resolve(area, []), area.firstChild);
  assert.equal((area.firstChild as Element).className, "vdom-root");
});

test("resolve: 경로는 영역의 루트부터 내려가요", () => {
  const area = createArea("<ul><li>a</li></ul>");
  const root = area.firstElementChild;
  assert.ok(root);
  const list = root.firstElementChild;
  const item = list?.firstElementChild;
  assert.ok(item);

  assert.notEqual(resolve(area, []), resolve(area, [0]));
  assert.equal(resolve(area, [0]), list);
  assert.equal(resolve(area, [0, 0]), item);
  assert.equal(resolve(area, [0, 0, 0]), item.firstChild);
});

test("resolve: 없는 인덱스는 path와 깊이를 담은 Error를 던져요", () => {
  const area = createArea("<ul><li>a</li><li>b</li></ul>");

  assert.throws(() => resolve(area, [5]), /\[5\].*깊이 0의 인덱스 5/);
  assert.throws(() => resolve(area, [0, 5]), /\[0, 5\].*깊이 1의 인덱스 5/);
});

test("resolve: 빈 영역의 []는 Error를 던져요", () => {
  const area = createEmptyArea();

  assert.throws(() => resolve(area, []), /resolve\(\[\]\).*깊이 0/);
});

test("applyPatches: 형제 여러 개를 동시에 삭제해도 인덱스가 밀리지 않아요", () => {
  const area = createArea("<ul><li>a</li><li>b</li><li>c</li></ul>");

  applyPatches(area, [
    { type: "REMOVE", path: [0, 2] },
    { type: "REMOVE", path: [0, 1] },
  ]);

  assert.equal(
    area.innerHTML,
    '<div class="vdom-root"><ul><li>a</li></ul></div>',
  );
});

test("applyPatches: 삭제 Patch가 오름차순이어도 대상을 먼저 찾아 두므로 같아요", () => {
  const area = createArea("<ul><li>a</li><li>b</li><li>c</li></ul>");

  applyPatches(area, [
    { type: "REMOVE", path: [0, 1] },
    { type: "REMOVE", path: [0, 2] },
  ]);

  assert.equal(
    area.innerHTML,
    '<div class="vdom-root"><ul><li>a</li></ul></div>',
  );
});

test("applyPatches: key가 있는 형제 여러 개를 동시에 삭제해도 인덱스가 밀리지 않아요", () => {
  const area = createArea(
    '<ul><li data-key="a">a</li><li data-key="b">b</li><li data-key="c">c</li><li data-key="d">d</li><li data-key="e">e</li></ul>',
  );
  const newV = fromHTML(
    '<ul><li data-key="a">a</li><li data-key="c">c</li><li data-key="e">e</li></ul>',
  );

  applyPatches(area, [
    { type: "REMOVE", path: [0, 1] },
    { type: "REMOVE", path: [0, 3] },
  ]);

  const root = area.firstElementChild;
  assert.ok(root);
  assert.deepStrictEqual(readArea(root), newV);
});

test("applyPatches: 어긋난 경로가 있으면 DOM을 고치기 전에 Error를 던져요", () => {
  const area = createArea("<ul><li>a</li><li>b</li></ul>");
  const before = area.innerHTML;

  assert.throws(
    () =>
      applyPatches(area, [
        { type: "REMOVE", path: [0, 0] },
        { type: "REMOVE", path: [0, 5] },
      ]),
    /\[0, 5\]/,
  );
  assert.equal(area.innerHTML, before);
});

test("applyPatches: TEXT는 요소와 텍스트 노드 모두에 적용해요", () => {
  const area = createArea("<p>a</p><p>b<b>x</b></p>");

  applyPatches(area, [
    { type: "TEXT", path: [0], value: "A" },
    { type: "TEXT", path: [1, 0], value: "B" },
  ]);

  assert.equal(
    area.innerHTML,
    '<div class="vdom-root"><p>A</p><p>B<b>x</b></p></div>',
  );
});

test("applyPatches: 텍스트만 바뀌어도 요소 노드는 같은 객체예요", () => {
  const area = createArea("<p>a</p>");
  const paragraph = area.querySelector("p");
  assert.ok(paragraph);

  applyPatches(area, [{ type: "TEXT", path: [0], value: "b" }]);

  assert.equal(area.querySelector("p"), paragraph);
});

test("applyPatches: 독립 텍스트 노드에도 TEXT를 적용해요", () => {
  const area = createArea("a");
  const text = area.firstElementChild?.firstChild;
  assert.ok(text);

  applyPatches(area, [{ type: "TEXT", path: [0], value: "b" }]);

  assert.equal(area.textContent, "b");
  assert.equal(area.firstElementChild?.firstChild, text);
});

test("applyPatches: textarea의 TEXT는 textContent와 value에 모두 반영해요", () => {
  const area = createArea("<textarea>메모</textarea>");
  const textarea = area.querySelector("textarea");
  assert.ok(textarea);
  assert.equal(textarea.tagName, "TEXTAREA");
  const field = textarea as HTMLTextAreaElement;
  field.value = "메모안녕";

  const { mutations } = countMutations(area, () => {
    applyPatches(area, [{ type: "TEXT", path: [0], value: "할 일" }]);
  });

  assert.equal(field.value, "할 일");
  assert.equal(field.textContent, "할 일");
  assert.equal(mutations, 1);
});

test("applyPatches: MOVE는 노드를 떼었다가 다시 넣어 같은 객체를 유지해요", () => {
  const area = createArea(
    '<ul><li data-key="a">a</li><li data-key="b">b</li><li data-key="c">c</li></ul>',
  );
  const list = area.firstElementChild?.firstElementChild;
  assert.ok(list);
  const moved = list.childNodes[2];

  applyPatches(area, [{ type: "MOVE", parentPath: [0], from: 2, to: 0 }]);

  assert.equal(list.childNodes[0], moved);
  assert.equal(
    area.innerHTML,
    '<div class="vdom-root"><ul><li data-key="c">c</li><li data-key="a">a</li><li data-key="b">b</li></ul></div>',
  );
});

test("applyPatches: key 비교 예시의 MOVE를 적용해요", () => {
  const area = createArea(
    "<ul><li>a</li><li>b</li><li>c</li><li>d</li><li>e</li><li>f</li><li>g</li></ul>",
  );

  applyPatches(area, [{ type: "MOVE", parentPath: [0], from: 4, to: 2 }]);

  assert.equal(
    area.innerHTML,
    '<div class="vdom-root"><ul><li>a</li><li>b</li><li>e</li><li>c</li><li>d</li><li>f</li><li>g</li></ul></div>',
  );
});

test("applyPatches: MOVE의 to가 범위를 넘으면 맨 뒤에 넣어요", () => {
  const area = createArea("<ul><li>a</li><li>b</li><li>c</li></ul>");

  applyPatches(area, [{ type: "MOVE", parentPath: [0], from: 0, to: 3 }]);

  assert.equal(
    area.innerHTML,
    '<div class="vdom-root"><ul><li>b</li><li>c</li><li>a</li></ul></div>',
  );
});

test("applyPatches: MOVE와 REMOVE가 섞여도 이전 구조의 경로를 써요", () => {
  const area = createArea(
    "<ul><li>a</li><li>b</li><li>c</li><li>d</li><li>e</li></ul>",
  );

  applyPatches(area, [
    { type: "MOVE", parentPath: [0], from: 4, to: 1 },
    { type: "REMOVE", path: [0, 3] },
  ]);

  assert.equal(
    area.innerHTML,
    '<div class="vdom-root"><ul><li>a</li><li>e</li><li>b</li><li>c</li></ul></div>',
  );
});

test("applyPatches: 배열에서 없음으로 바뀌면 REMOVE해요", () => {
  const area = createArea("<p>a<b>x</b></p>");

  applyPatches(area, [{ type: "REMOVE", path: [0, 1] }]);

  assert.equal(area.innerHTML, '<div class="vdom-root"><p>a</p></div>');
});

test("applyPatches: 배열에서 텍스트로 바뀌면 REMOVE 후 TEXT해요", () => {
  const area = createArea("<p>a<b>x</b></p>");

  applyPatches(area, [
    { type: "REMOVE", path: [0, 1] },
    { type: "TEXT", path: [0], value: "b" },
  ]);

  assert.equal(area.innerHTML, '<div class="vdom-root"><p>b</p></div>');
});

test("applyPatches: 없음에서 텍스트로 바뀌면 TEXT해요", () => {
  const area = createArea("<p></p>");

  applyPatches(area, [{ type: "TEXT", path: [0], value: "a" }]);

  assert.equal(area.innerHTML, '<div class="vdom-root"><p>a</p></div>');
});

test("applyPatches: 텍스트에서 없음으로 바뀌면 빈 TEXT를 적용해요", () => {
  const area = createArea("<p>a</p>");

  applyPatches(area, [{ type: "TEXT", path: [0], value: "" }]);

  assert.equal(area.innerHTML, '<div class="vdom-root"><p></p></div>');
});

test("applyPatches: 한 영역을 고쳐도 다른 영역은 그대로예요", () => {
  const first = createArea("<ul><li>a</li><li>b</li></ul>");
  const second = createArea("<ul><li>a</li><li>b</li></ul>");

  applyPatches(first, [{ type: "REMOVE", path: [0, 1] }]);

  assert.equal(
    first.innerHTML,
    '<div class="vdom-root"><ul><li>a</li></ul></div>',
  );
  assert.equal(
    second.innerHTML,
    '<div class="vdom-root"><ul><li>a</li><li>b</li></ul></div>',
  );
});

test("applyPatches: CREATE는 index 자리에 새 서브트리를 넣어요", () => {
  const area = createArea("<ul><li>a</li><li>c</li></ul>");

  applyPatches(area, [
    { type: "CREATE", parentPath: [0], index: 1, node: h("li", null, "b") },
  ]);

  assert.equal(
    area.innerHTML,
    '<div class="vdom-root"><ul><li>a</li><li>b</li><li>c</li></ul></div>',
  );
});

test("applyPatches: CREATE의 index가 범위를 넘으면 맨 뒤에 넣어요", () => {
  const area = createArea("<ul><li>a</li></ul>");

  applyPatches(area, [
    { type: "CREATE", parentPath: [0], index: 9, node: h("li", null, "b") },
  ]);

  assert.equal(
    area.innerHTML,
    '<div class="vdom-root"><ul><li>a</li><li>b</li></ul></div>',
  );
});

test("applyPatches: REPLACE는 createDOM으로 새 서브트리로 교체해요", () => {
  const area = createArea("<p>a</p>");

  applyPatches(area, [
    {
      type: "REPLACE",
      path: [0],
      node: h("section", { class: "s" }, h("b", null, "x")),
    },
  ]);

  assert.equal(
    area.innerHTML,
    '<div class="vdom-root"><section class="s"><b>x</b></section></div>',
  );
});

test("applyPatches: 루트 REPLACE는 영역 안에서 바뀌어요", () => {
  const area = createArea("<p>a</p>");

  applyPatches(area, [
    { type: "REPLACE", path: [], node: h("main", null, "b") },
  ]);

  assert.equal(area.innerHTML, "<main>b</main>");
});

test("applyPatches: PROPS는 새 option을 넣은 뒤 select 값을 맞춰요", () => {
  const area = createArea('<select><option value="a">A</option></select>');

  applyPatches(area, [
    {
      type: "CREATE",
      parentPath: [0],
      index: 1,
      node: h("option", { value: "b" }, "B"),
    },
    { type: "PROPS", path: [0], set: { value: "b" }, remove: [] },
  ]);

  const select = area.querySelector("select");
  assert.ok(select);
  assert.equal((select as HTMLSelectElement).value, "b");
  assert.equal(
    area.innerHTML,
    '<div class="vdom-root"><select value="b"><option value="a">A</option><option value="b">B</option></select></div>',
  );
});

test("applyPatches: PROPS에서 지운 class는 빈 속성으로 남지 않아요", () => {
  const area = createArea('<p class="x">a</p>');

  applyPatches(area, [
    { type: "PROPS", path: [0], set: {}, remove: ["class"] },
  ]);

  assert.equal(area.innerHTML, '<div class="vdom-root"><p>a</p></div>');
});

test("applyPatches: 위치 비교 예시의 Patch 목록을 적용하면 새 HTML과 같아요", () => {
  const area = createArea('<ul><li>a</li><li class="x">b</li></ul>');

  applyPatches(area, [
    { type: "TEXT", path: [0, 0], value: "A" },
    { type: "PROPS", path: [0, 0], set: { class: "y" }, remove: [] },
    { type: "REMOVE", path: [0, 1] },
  ]);

  assert.equal(
    area.innerHTML,
    '<div class="vdom-root"><ul><li class="y">A</li></ul></div>',
  );
});

test("applyPatches: key 비교 예시의 Patch 목록을 적용하면 새 HTML과 같아요", () => {
  const area = createArea(
    "<ul><li>a</li><li>b</li><li>c</li><li>d</li><li>e</li><li>f</li><li>g</li></ul>",
  );
  const patches: Patch[] = [
    { type: "MOVE", parentPath: [0], from: 4, to: 2 },
    { type: "CREATE", parentPath: [0], index: 5, node: h("li", null, "h") },
  ];

  applyPatches(area, patches);

  assert.equal(
    area.innerHTML,
    '<div class="vdom-root"><ul><li>a</li><li>b</li><li>e</li><li>c</li><li>d</li><li>h</li><li>f</li><li>g</li></ul></div>',
  );
});

test("applyPatches: 텍스트 하나만 바꾸면 Patch 1개와 DOM 변경 1건이에요", () => {
  const area = createArea("<p>a</p>");
  const oldV = fromHTML("<p>a</p>");
  const newV = fromHTML("<p>b</p>");
  const patches = diff(oldV, newV);

  assert.equal(patches.length, 1);

  const { mutations } = countMutations(area, () => {
    applyPatches(area, patches);
  });

  assert.equal(mutations, 1);
});

test("applyPatches: 텍스트에서 배열로 바뀌면 CREATE해요", () => {
  const area = createArea("<p>a</p>");
  const oldV = fromHTML("<p>a</p>");
  const newV = fromHTML("<p><b>x</b></p>");

  applyPatches(area, diff(oldV, newV));

  const root = area.firstElementChild;
  assert.ok(root);
  assert.deepStrictEqual(readArea(root), newV);
});

test("formatPatches: node는 HTML로, 함수는 ƒ로 바꿔요", () => {
  const f = () => {};

  assert.equal(
    formatPatches([
      {
        type: "CREATE",
        parentPath: [0],
        index: 5,
        node: h("p", null, "추가"),
      },
    ]),
    '[{"type":"CREATE","parentPath":[0],"index":5,"node":"<p>추가</p>"}]',
  );
  assert.equal(
    formatPatches([
      { type: "PROPS", path: [0], set: { onclick: f }, remove: [] },
    ]),
    '[{"type":"PROPS","path":[0],"set":{"onclick":"ƒ"},"remove":[]}]',
  );
  assert.equal(
    formatPatches([
      {
        type: "CREATE",
        parentPath: [],
        index: 0,
        node: h("button", { onclick: f }, "확인"),
      },
    ]),
    '[{"type":"CREATE","parentPath":[],"index":0,"node":"<button>확인</button>"}]',
  );
});
