import assert from "node:assert/strict";
import { test } from "node:test";
import { JSDOM } from "jsdom";
import { applyPatches, resolve } from "./patch.ts";
import type { Patch } from "./vnode.ts";

function createArea(html: string): HTMLElement {
  return createAreaFromHTML(`<div class="vdom-root">${html}</div>`);
}

function createEmptyArea(): HTMLElement {
  return createAreaFromHTML("");
}

function createAreaFromHTML(html: string): HTMLElement {
  const dom = new JSDOM(
    `<!doctype html><html><body><div id="area">${html}</div></body></html>`,
  );
  const area = dom.window.document.getElementById("area");
  assert.ok(area);
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

test("applyPatches: 독립 텍스트 노드에도 TEXT를 적용해요", () => {
  const area = createArea("a");

  applyPatches(area, [{ type: "TEXT", path: [0], value: "b" }]);

  assert.equal(area.textContent, "b");
});

test("applyPatches: textarea의 TEXT는 textContent와 value에 모두 반영해요", () => {
  const area = createArea("<textarea>메모</textarea>");
  const textarea = area.querySelector("textarea");
  assert.ok(
    textarea instanceof area.ownerDocument.defaultView!.HTMLTextAreaElement,
  );
  textarea.value = "메모안녕";

  const { mutations } = countMutations(area, () => {
    applyPatches(area, [{ type: "TEXT", path: [0], value: "할 일" }]);
  });

  assert.equal(textarea.value, "할 일");
  assert.equal(textarea.textContent, "할 일");
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

test("applyPatches: 아직 지원하지 않는 Patch는 DOM을 고치기 전에 Error를 던져요", () => {
  const area = createArea("<p>a</p>");
  const patches: Patch[] = [
    { type: "REMOVE", path: [0] },
    {
      type: "CREATE",
      parentPath: [],
      index: 0,
      node: { type: "p", props: null, key: null, children: "b", flags: 9 },
    },
  ];

  assert.throws(() => applyPatches(area, patches), /CREATE/);
  assert.equal(area.innerHTML, '<div class="vdom-root"><p>a</p></div>');
});
