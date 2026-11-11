import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { JSDOM } from "jsdom";
import { expand } from "./component.ts";
import { diff } from "./diff.ts";
import { mountArea } from "./dom.ts";
import { applyPatches } from "./patch.ts";
import { COMPONENT, h } from "./vnode.ts";
import type { VNode } from "./vnode.ts";

function hasComponent(v: VNode): boolean {
  if (v.flags & COMPONENT) return true;
  return Array.isArray(v.children) && v.children.some(hasComponent);
}

function deepFreeze(v: VNode): VNode {
  if (Array.isArray(v.children)) {
    for (const child of v.children) deepFreeze(child);
    Object.freeze(v.children);
  }
  return Object.freeze(v);
}

const Item = (props: { label: string }) => h("li", null, props.label);

describe("expand: 컴포넌트 없음", () => {
  test("요소만 있는 트리는 입력과 같은 객체", () => {
    const tree = h(
      "div",
      { class: "root" },
      h("ul", null, h("li", { key: "a" }, "a"), h("li", null, "b")),
      "텍스트",
    );
    assert.equal(expand(tree), tree);
  });

  test("텍스트 자식, 자식 없음도 입력과 같은 객체", () => {
    const text = h("p", null, "글");
    const empty = h("br");
    assert.equal(expand(text), text);
    assert.equal(expand(empty), empty);
  });
});

describe("expand: 컴포넌트 펼치기", () => {
  test("설계 문서 예시: 컴포넌트 결과가 key를 물려받아요", () => {
    const result = expand(h("ul", null, h(Item, { key: "a", label: "x" })));
    assert.deepStrictEqual(result, h("ul", null, h("li", { key: "a" }, "x")));
  });

  test("중첩: A가 h(B)를 돌려줘도 COMPONENT 플래그가 남지 않아요", () => {
    const B = () => h("p", null, "b");
    const A = () => h(B);
    const result = expand(h("div", null, h(A), h("span", null, h(A))));
    assert.equal(hasComponent(result), false);
    assert.deepStrictEqual(
      result,
      h("div", null, h("p", null, "b"), h("span", null, h("p", null, "b"))),
    );
  });

  test("루트가 컴포넌트여도 요소 VNode가 나와요", () => {
    const App = () => h("main", null, h(Item, { label: "x" }));
    assert.deepStrictEqual(expand(h(App)), h("main", null, h("li", null, "x")));
  });

  test('h(Box, {}, "x")에서 Box가 props.children === "x"를 받아요', () => {
    let received: unknown;
    const Box = (props: { children?: VNode[] | string | null }) => {
      received = props.children;
      return h("div", null);
    };
    expand(h(Box, {}, "x"));
    assert.equal(received, "x");
  });

  test("배열 자식은 같은 VNode 배열로, 자식이 없으면 null로 받아요", () => {
    const received: unknown[] = [];
    const Box = (props: { children?: VNode[] | string | null }) => {
      received.push(props.children);
      return h("div", null);
    };
    const inner = h(Box, {}, h("b"), h("i"));
    expand(inner);
    expand(h(Box, {}));
    assert.equal(received[0], inner.children);
    assert.equal(received[1], null);
  });

  test("props의 children은 자식 인자가 없을 때만 넘어가요", () => {
    const received: unknown[] = [];
    const Box = (props: { children?: VNode[] | string | null }) => {
      received.push(props.children);
      return h("div", null);
    };
    expand(h(Box, { children: "y" }));
    expand(h(Box, { children: "y" }, "x"));
    assert.deepStrictEqual(received, ["y", "x"]);
  });

  test("받은 자식을 props로 넘기는 감싸기 컴포넌트에서도 자식이 남아요", () => {
    const Box = (props: { children?: VNode[] | string | null }) =>
      h("section", null, props.children);
    const Card = (props: { children?: VNode[] | string | null }) =>
      h(Box, { children: props.children });
    assert.deepStrictEqual(
      expand(h(Card, {}, h("p", null, "내용"))),
      h("section", null, h("p", null, "내용")),
    );
  });

  test("props를 그대로 넘겨요", () => {
    let received: unknown;
    const onAdd = (text: string) => text;
    const Input = (props: {
      items: string[];
      onAdd: (t: string) => string;
    }) => {
      received = props;
      return h("input");
    };
    const items = ["a"];
    expand(h(Input, { items, onAdd }));
    assert.deepStrictEqual(received, { items, onAdd, children: null });
  });
});

describe("expand: key 승계", () => {
  test('key가 "a", "b"인 두 Item이 key "inner"인 li를 돌려줘도 펼친 li의 key가 "a", "b"', () => {
    const Inner = (props: { label: string }) =>
      h("li", { key: "inner" }, props.label);
    const result = expand(
      h(
        "ul",
        null,
        h(Inner, { key: "a", label: "x" }),
        h(Inner, { key: "b", label: "y" }),
      ),
    );
    const keys = (result.children as VNode[]).map((child) => child.key);
    assert.deepStrictEqual(keys, ["a", "b"]);
  });

  test("Item이 받은 props에 key가 없어요", () => {
    let received: object | undefined;
    const Spy = (props: { label: string }) => {
      received = props;
      return h("li", null, props.label);
    };
    expand(h(Spy, { key: "a", label: "x" }));
    assert.ok(received);
    assert.equal("key" in received, false);
  });

  test("컴포넌트에 key가 없으면 결과의 key를 그대로 둬요", () => {
    const Inner = () => h("li", { key: "inner" });
    assert.equal(expand(h(Inner)).key, "inner");
  });

  test("key 0과 빈 문자열도 물려받아요", () => {
    const result = expand(
      h(
        "ul",
        null,
        h(Item, { key: 0, label: "x" }),
        h(Item, { key: "", label: "y" }),
      ),
    );
    const keys = (result.children as VNode[]).map((child) => child.key);
    assert.deepStrictEqual(keys, [0, ""]);
  });

  test("중첩 컴포넌트에서는 가장 바깥 컴포넌트의 key가 남아요", () => {
    const B = () => h("li", { key: "inner" });
    const A = () => h(B, { key: "b" });
    assert.equal(expand(h(A, { key: "a" })).key, "a");
    assert.equal(expand(h(A)).key, "b");
  });

  test("key가 있는 Item 목록을 재정렬하면 Patch는 MOVE뿐이고 DOM 노드가 같은 객체예요", () => {
    globalThis.document = new JSDOM(
      "<!doctype html><html><body></body></html>",
    ).window.document;
    const list = (labels: string[]) =>
      expand(
        h(
          "ul",
          null,
          labels.map((label) => h(Item, { key: label, label })),
        ),
      );
    const before = list(["a", "b", "c"]);
    const after = list(["c", "a", "b"]);
    const area = document.createElement("div");
    mountArea(area, before);
    const [a, b, c] = Array.from(area.firstChild!.childNodes);

    const patches = diff(before, after);
    applyPatches(area, patches);

    assert.deepStrictEqual(patches, [
      { type: "MOVE", parentPath: [], from: 2, to: 0 },
    ]);
    assert.deepStrictEqual(Array.from(area.firstChild!.childNodes), [c, a, b]);
    assert.equal(area.textContent, "cab");
  });
});

describe("expand: 불변", () => {
  test("얼린 입력을 고치지 않고, 바뀐 자식이 있는 요소만 새 객체로 만들어요", () => {
    const fixed = h("p", null, "고정");
    const item = h(Item, { label: "x" });
    const tree = deepFreeze(h("div", null, fixed, h("ul", null, item)));

    const result = expand(tree);
    const [first, list] = result.children as VNode[];

    assert.notEqual(result, tree);
    assert.equal(first, fixed);
    assert.notEqual(list, (tree.children as VNode[])[1]);
    assert.equal(((tree.children as VNode[])[1].children as VNode[])[0], item);
    assert.equal(hasComponent(result), false);
  });
});
