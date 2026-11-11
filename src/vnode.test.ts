import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ARRAY_CHILDREN,
  COMPONENT,
  ELEMENT,
  TEXT,
  TEXT_CHILDREN,
  TEXT_TYPE,
  createTextVNode,
  h,
} from "./vnode.ts";
import type { Child, Component, Props } from "./vnode.ts";

describe("createTextVNode", () => {
  for (const text of ["하나", "", 1, 0, -1, 1.5]) {
    it(`${JSON.stringify(text)}를 TEXT VNode로 만든다`, () => {
      assert.deepStrictEqual(createTextVNode(text), {
        type: TEXT_TYPE,
        props: null,
        key: null,
        children: String(text),
        flags: TEXT,
      });
    });
  }
});

describe("h: 설계 문서의 호출 표", () => {
  it("문자열 하나를 TEXT_CHILDREN으로 저장한다", () => {
    assert.deepStrictEqual(h("li", null, "하나"), {
      type: "li",
      props: null,
      key: null,
      children: "하나",
      flags: ELEMENT | TEXT_CHILDREN,
    });
  });

  it("이웃한 문자열과 숫자를 합친다", () => {
    const node = h("p", null, "a", 1);
    assert.equal(node.children, "a1");
    assert.equal(node.flags, ELEMENT | TEXT_CHILDREN);
  });

  it("요소와 섞인 텍스트를 TEXT VNode로 감싼다", () => {
    const bold = h("b");
    assert.deepStrictEqual(h("p", null, "a", bold), {
      type: "p",
      props: null,
      key: null,
      children: [createTextVNode("a"), bold],
      flags: ELEMENT | ARRAY_CHILDREN,
    });
  });

  it("key를 분리하고 요소의 className을 class로 바꾼다", () => {
    assert.deepStrictEqual(h("li", { key: "a", className: "x" }), {
      type: "li",
      props: { class: "x" },
      key: "a",
      children: null,
      flags: ELEMENT,
    });
  });

  it("컴포넌트를 실행하지 않고 className을 유지한다", () => {
    let calls = 0;
    const Item: Component = () => {
      calls++;
      return h("li");
    };
    assert.deepStrictEqual(h(Item, { className: "x" }), {
      type: Item,
      props: { className: "x" },
      key: null,
      children: null,
      flags: COMPONENT,
    });
    assert.equal(calls, 0);
  });

  it("중첩 배열을 평탄화하고 false와 null을 버린다", () => {
    const first = h("li");
    const second = h("li");
    const node = h("ul", null, false, null, [first, [second]]);
    assert.deepStrictEqual(node.children, [first, second]);
    assert.equal(node.flags, ELEMENT | ARRAY_CHILDREN);
  });
});

describe("h: 자식 정규화의 경계 조건", () => {
  const emptyCases: Child[][] = [
    [],
    [[]],
    [null, undefined, true, false],
    [[null, [undefined, true, false, []]]],
  ];
  for (const children of emptyCases) {
    it(`${JSON.stringify(children)}에서 남은 자식이 없으면 null이다`, () => {
      const node = h("div", null, ...children);
      assert.equal(node.children, null);
      assert.equal(node.flags, ELEMENT);
    });
  }

  it("배열 경계와 버린 값 사이에서도 인접 텍스트를 합친다", () => {
    const node = h("p", null, ["a", [null, true, 1]], false, undefined, "b");
    assert.equal(node.children, "a1b");
    assert.equal(node.flags, ELEMENT | TEXT_CHILDREN);
  });

  for (const text of ["", " ", "\n", 0]) {
    it(`${JSON.stringify(text)}는 빈 자식으로 버리지 않는다`, () => {
      const node = h("p", null, text);
      assert.equal(node.children, String(text));
      assert.equal(node.flags, ELEMENT | TEXT_CHILDREN);
    });
  }

  it("요소를 사이에 둔 텍스트는 각각 합쳐서 감싼다", () => {
    const bold = h("b");
    const node = h("p", null, ["a", 1], bold, [2, false, "b"]);
    assert.deepStrictEqual(node.children, [
      createTextVNode("a1"),
      bold,
      createTextVNode("2b"),
    ]);
    assert.equal(node.flags, ELEMENT | ARRAY_CHILDREN);
    assert.ok(Array.isArray(node.children));
    assert.strictEqual(node.children[1], bold);
  });

  it("요소 하나도 배열로 저장한다", () => {
    const child = h("span");
    const node = h("div", null, child);
    assert.deepStrictEqual(node.children, [child]);
    assert.equal(node.flags, ELEMENT | ARRAY_CHILDREN);
  });

  it("입력 배열과 VNode를 변경하지 않는다", () => {
    const child = h("b", null, "원래 값");
    Object.freeze(child);
    const nested: Child[] = ["a", 1, child];
    const raw: Child[] = [nested, "b"];
    Object.freeze(nested);
    Object.freeze(raw);

    const node = h("p", null, raw);

    assert.deepStrictEqual(raw, [["a", 1, child], "b"]);
    assert.equal(child.children, "원래 값");
    assert.ok(Array.isArray(node.children));
    assert.strictEqual(node.children[1], child);
    assert.notStrictEqual(node.children, raw);
    assert.notStrictEqual(node.children, nested);
  });
});

describe("h: props 정규화", () => {
  it("생략하거나 null 또는 빈 객체인 props를 null로 만든다", () => {
    for (const node of [h("div"), h("div", null), h("div", {})]) {
      assert.equal(node.props, null);
      assert.equal(node.key, null);
    }
  });

  for (const key of ["a", 0, ""]) {
    it(`key=${JSON.stringify(key)}를 분리하고 빈 props를 null로 만든다`, () => {
      const node = h("li", { key });
      assert.equal(node.key, key);
      assert.equal(node.props, null);
    });
  }

  for (const key of [null, undefined]) {
    it(`key=${String(key)}는 key 없음으로 처리한다`, () => {
      const node = h("li", { key, id: "item" });
      assert.equal(node.key, null);
      assert.deepStrictEqual(node.props, { id: "item" });
    });
  }

  it("기존 class를 그대로 보존한다", () => {
    assert.deepStrictEqual(h("li", { class: "x" }).props, { class: "x" });
  });

  it("컴포넌트도 props에서 key를 분리한다", () => {
    const Item: Component = () => h("li");
    const node = h(Item, { key: 0, className: "x" }, "자식");
    assert.equal(node.key, 0);
    assert.deepStrictEqual(node.props, { className: "x" });
    assert.equal(node.children, "자식");
    assert.equal(node.flags, COMPONENT | TEXT_CHILDREN);
  });

  it("입력 props를 변경하지 않고 나머지 값과 참조를 보존한다", () => {
    const style = Object.freeze({ color: "red" });
    const listener = () => {};
    const props: Props = Object.freeze({
      key: "a",
      className: "x",
      style,
      onClick: listener,
      checked: false,
      value: 0,
      title: null,
      id: undefined,
    });

    const node = h("li", props);

    assert.deepStrictEqual(props, {
      key: "a",
      className: "x",
      style,
      onClick: listener,
      checked: false,
      value: 0,
      title: null,
      id: undefined,
    });
    assert.deepStrictEqual(node.props, {
      class: "x",
      style,
      onClick: listener,
      checked: false,
      value: 0,
      title: null,
      id: undefined,
    });
    assert.strictEqual(node.props?.style, style);
    assert.strictEqual(node.props?.onClick, listener);
    assert.notStrictEqual(node.props, props);
  });
});

describe("h: 오버로드 타입", () => {
  // 타입 검사가 확인해요. 실행은 오류 없이 VNode를 만드는지만 봐요
  const TodoList = (props: { items: string[] }) => h("ul", null, props.items);
  const Input = (props: { onAdd: (text: string) => void }) => h("input");
  const App = () => h("div");

  it("컴포넌트의 props 타입을 받는다", () => {
    h(TodoList, { items: ["a"] });
    h(TodoList, { items: [], key: 1 });
    h(Input, { onAdd: (t: string) => {} });
    h(App);
    h(App, null);
  });

  it("맞지 않는 props는 타입 오류다", () => {
    // @ts-expect-error props를 받는 컴포넌트는 props를 꼭 넘겨요
    h(TodoList);
    // @ts-expect-error props를 받는 컴포넌트는 null을 받지 않아요
    h(TodoList, null);
    // @ts-expect-error 컴포넌트의 props와 맞지 않아요
    h(TodoList, { wrong: 1 });
    // @ts-expect-error 요소에는 PropValue만 넣어요
    h("div", { items: [1] });
  });
});
