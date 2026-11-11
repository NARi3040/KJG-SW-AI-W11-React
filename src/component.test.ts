import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { JSDOM } from "jsdom";
import { FunctionComponent, createRoot, expand } from "./component.ts";
import type { Memo } from "./component.ts";
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

function createRenderer(): (tree: VNode) => VNode {
  let memo = new Map<string, Memo>();
  return (tree) => {
    const next = new Map<string, Memo>();
    const out = expand(tree, memo, next);
    memo = next;
    return out;
  };
}

function counted<P>(render: (props: P) => VNode): {
  fn: (props: P) => VNode;
  calls: { count: number };
} {
  const calls = { count: 0 };
  const fn = (props: P) => {
    calls.count++;
    return render(props);
  };
  return { fn, calls };
}

describe("expand: 결과 캐시", () => {
  test("같은 props면 자식 함수를 부르지 않고 지난 결과를 그대로 써요", () => {
    const { fn: Cell, calls } = counted((p: { n: number }) =>
      h("td", null, p.n),
    );
    const render = createRenderer();
    const tree = () => h("tr", null, h(Cell, { n: 1 }));

    const first = render(tree());
    const second = render(tree());
    const third = render(tree());

    assert.equal(calls.count, 1);
    const cell = (first.children as VNode[])[0];
    assert.equal((second.children as VNode[])[0], cell);
    assert.equal((third.children as VNode[])[0], cell);
    assert.deepStrictEqual(diff(first, second), []);
  });

  test("prop이 늘거나 줄면 다른 props로 봐요", () => {
    const { fn: Cell, calls } = counted((p: { a: number; b?: number }) =>
      h("td", null, p.a),
    );
    const render = createRenderer();

    render(h("tr", null, h(Cell, { a: 1 })));
    render(h("tr", null, h(Cell, { a: 1, b: 2 })));
    render(h("tr", null, h(Cell, { a: 1 })));

    assert.equal(calls.count, 3);
  });

  test("같은 자리에서 props는 같고 컴포넌트만 바뀌면 새 컴포넌트를 불러요", () => {
    const { fn: A, calls: aCalls } = counted((p: { n: number }) =>
      h("td", null, "A", p.n),
    );
    const { fn: B, calls: bCalls } = counted((p: { n: number }) =>
      h("td", null, "B", p.n),
    );
    const render = createRenderer();
    const tree = (flag: boolean) =>
      h("tr", null, flag ? h(A, { n: 1 }) : h(B, { n: 1 }));

    render(tree(true));
    const after = render(tree(false));

    assert.equal(aCalls.count, 1);
    assert.equal(bCalls.count, 1);
    assert.equal((after.children as VNode[])[0].children, "B1");
  });

  test("형제 하나를 다시 쓰는 동안 사라진 다른 형제는 다시 나타나면 다시 불러요", () => {
    const { fn: Row, calls } = counted((p: { label: string }) =>
      h("li", null, p.label),
    );
    const render = createRenderer();
    const one = h(Row, { key: 1, label: "x" });
    const twelve = () => h(Row, { key: 12, label: "y" });

    render(h("ul", null, one, twelve()));
    render(h("ul", null, one));
    render(h("ul", null, one, twelve()));

    assert.equal(calls.count, 3);
  });

  test("key 없는 컴포넌트가 key 있는 요소를 돌려줘도 같은 props면 다시 써요", () => {
    const { fn: Inner, calls } = counted((p: { label: string }) =>
      h("li", { key: "inner" }, p.label),
    );
    const render = createRenderer();

    render(h("ul", null, h(Inner, { label: "x" })));
    render(h("ul", null, h(Inner, { label: "x" })));

    assert.equal(calls.count, 1);
  });

  test("props가 바뀌거나 렌더마다 새 함수 prop이면 다시 불러요", () => {
    const { fn: Cell, calls } = counted((p: { n: number }) =>
      h("td", null, p.n),
    );
    const { fn: Button, calls: buttonCalls } = counted(
      (p: { onClick: () => void }) => h("button", { onClick: p.onClick }),
    );
    const render = createRenderer();
    const tree = (n: number) =>
      h("tr", null, h(Cell, { n }), h(Button, { onClick: () => {} }));

    render(tree(1));
    render(tree(2));

    assert.equal(calls.count, 2);
    assert.equal(buttonCalls.count, 2);
  });

  test("{ a: undefined } → { b: undefined }도 다른 props로 봐요", () => {
    const { fn: Spy, calls } = counted((_: { a?: undefined; b?: undefined }) =>
      h("p"),
    );
    const render = createRenderer();

    render(h("div", null, h(Spy, { a: undefined })));
    render(h("div", null, h(Spy, { b: undefined })));

    assert.equal(calls.count, 2);
  });

  test("props가 null과 {}면 다른 props로 봐요", () => {
    const calls = { count: 0 };
    const Spy = () => {
      calls.count++;
      return h("p");
    };
    const render = createRenderer();
    const withNull = h(Spy);

    render(h("div", null, withNull));
    render(h("div", null, { ...withNull, props: {} }));

    assert.equal(calls.count, 2);
  });

  test("children이 같은 문자열이면 다시 쓰고, 렌더마다 새 VNode 배열이면 다시 불러요", () => {
    const { fn: Box, calls } = counted(
      (p: { children?: VNode[] | string | null }) =>
        h("section", null, p.children),
    );
    const render = createRenderer();

    render(h("div", null, h(Box, {}, "x")));
    render(h("div", null, h(Box, {}, "x")));
    assert.equal(calls.count, 1);

    render(h("div", null, h(Box, {}, h("b"))));
    render(h("div", null, h(Box, {}, h("b"))));
    assert.equal(calls.count, 3);
  });

  test("key 목록을 재정렬해도 자식 함수를 부르지 않아요", () => {
    const { fn: Row, calls } = counted((p: { label: string }) =>
      h("li", null, p.label),
    );
    const render = createRenderer();
    const list = (labels: string[]) =>
      h(
        "ul",
        null,
        labels.map((label) => h(Row, { key: label, label })),
      );

    const before = render(list(["a", "b", "c"]));
    const after = render(list(["c", "a", "b"]));

    assert.equal(calls.count, 3);
    const [c, a, b] = after.children as VNode[];
    const [a0, b0, c0] = before.children as VNode[];
    assert.ok(a === a0 && b === b0 && c === c0);
    assert.deepStrictEqual(diff(before, after), [
      { type: "MOVE", parentPath: [], from: 2, to: 0 },
    ]);
  });

  test("자식 81개 중 1개만 바꾸면 자식 함수를 1번 불러요", () => {
    const { fn: Cell, calls } = counted((p: { n: number }) =>
      h("td", null, p.n),
    );
    const render = createRenderer();
    const board = (values: number[]) =>
      h(
        "tr",
        null,
        values.map((n) => h(Cell, { n })),
      );
    const values = Array.from({ length: 81 }, (_, i) => i);

    render(board(values));
    const changed = values.slice();
    changed[40] = -1;
    render(board(changed));

    assert.equal(calls.count, 82);
  });

  test("바깥만 다시 쓴 뒤 안쪽 1개만 바꾸면 항목 함수를 1번 불러요", () => {
    const { fn: Row, calls } = counted((p: { label: string }) =>
      h("li", null, p.label),
    );
    const List = (p: { items: string[] }) =>
      h(
        "ul",
        null,
        p.items.map((label) => h(Row, { label })),
      );
    const render = createRenderer();
    const items = ["a", "b", "c"];

    render(h("main", null, h(List, { items })));
    render(h("main", null, h(List, { items })));
    assert.equal(calls.count, 3);

    render(h("main", null, h(List, { items: ["a", "B", "c"] })));
    assert.equal(calls.count, 4);
  });

  test("자리 이름이 같고 key만 바뀌면 다시 불러서 결과 key가 새 key예요", () => {
    const { fn: B, calls } = counted((p: { label: string }) =>
      h("li", null, p.label),
    );
    const A = (p: { id: string }) => h(B, { key: p.id, label: "x" });
    const render = createRenderer();

    render(h("ul", null, h(A, { id: "a" })));
    const after = render(h("ul", null, h(A, { id: "b" })));

    assert.equal(calls.count, 2);
    assert.equal((after.children as VNode[])[0].key, "b");
  });

  test("Infinity → -Infinity처럼 자리 이름이 같은 key로 바꿔도 다시 불러요", () => {
    const { fn: Row, calls } = counted((p: { label: string }) =>
      h("li", null, p.label),
    );
    const render = createRenderer();

    render(h("ul", null, h(Row, { key: Infinity, label: "x" })));
    const after = render(h("ul", null, h(Row, { key: -Infinity, label: "x" })));

    assert.equal(calls.count, 2);
    assert.equal((after.children as VNode[])[0].key, -Infinity);
  });

  test("prev, next 없이 부르면 캐시를 쓰지 않아요", () => {
    const { fn: Cell, calls } = counted((p: { n: number }) =>
      h("td", null, p.n),
    );
    const tree = () => h("tr", null, h(Cell, { n: 1 }));

    expand(tree());
    expand(tree());

    assert.equal(calls.count, 2);
  });

  test("이번 렌더에 없던 자리는 사라져서, 다시 나타나면 다시 불러요", () => {
    const { fn: Cell, calls } = counted((p: { n: number }) =>
      h("td", null, p.n),
    );
    const render = createRenderer();

    render(h("tr", null, h(Cell, { n: 1 })));
    render(h("tr", null));
    render(h("tr", null, h(Cell, { n: 1 })));

    assert.equal(calls.count, 2);
  });

  test("같은 부모 아래 key가 중복돼도 결과는 캐시 없이 펼친 것과 같아요", () => {
    const tree = (second: string) =>
      h(
        "ul",
        null,
        h(Item, { key: "a", label: "x" }),
        h(Item, { key: "a", label: second }),
      );
    const render = createRenderer();

    render(tree("y"));
    const after = render(tree("z"));

    assert.deepStrictEqual(after, expand(tree("z")));
  });
});

function createContainer(): HTMLElement {
  globalThis.document = new JSDOM(
    '<!doctype html><html><body><div id="root"></div></body></html>',
  ).window.document;
  const container = document.getElementById("root");
  assert.ok(container);
  return container;
}

describe("FunctionComponent: 생성과 mount", () => {
  test("생성자는 필드만 채우고 렌더하지 않아요", () => {
    const container = createContainer();
    let calls = 0;
    const App = () => {
      calls++;
      return h("p");
    };
    const props = { title: "x" };

    const root = new FunctionComponent(container, App, props);

    assert.equal(calls, 0);
    assert.equal(root.container, container);
    assert.equal(root.type, App);
    assert.equal(root.props, props);
    assert.equal(root.tree, null);
    assert.deepStrictEqual(root.hooks, []);
    assert.deepStrictEqual(root.effects, []);
    assert.equal(root.flushing, false);
    assert.equal(container.childNodes.length, 0);
  });

  test("mount는 영역에 루트 하나를 그리고 펼친 tree를 저장해요", () => {
    const container = createContainer();
    const App = () => h("ul", null, h(Item, { label: "a" }));

    const root = new FunctionComponent(container, App);
    root.mount();

    assert.equal(container.childNodes.length, 1);
    assert.equal(container.innerHTML, "<ul><li>a</li></ul>");
    assert.ok(root.tree);
    assert.equal(hasComponent(root.tree), false);
  });

  test("루트 함수는 props를 받고, props가 없으면 빈 객체를 받아요", () => {
    const received: unknown[] = [];
    const App = (props: object) => {
      received.push(props);
      return h("p");
    };

    createRoot(createContainer(), App, { title: "x" });
    createRoot(createContainer(), App);

    assert.deepStrictEqual(received, [{ title: "x" }, {}]);
  });

  test("mount 뒤 핸들러를 단 버튼을 누르면 불려요", () => {
    const container = createContainer();
    let clicked = 0;
    const App = () =>
      h(
        "button",
        {
          onClick: () => {
            clicked++;
          },
        },
        "누르기",
      );

    createRoot(container, App);
    (container.querySelector("button") as HTMLElement).click();

    assert.equal(clicked, 1);
  });

  test("createRoot는 mount한 인스턴스를 돌려줘요", () => {
    const container = createContainer();
    const root = createRoot(container, () => h("p", null, "x"));

    assert.ok(root instanceof FunctionComponent);
    assert.notEqual(root.tree, null);
    assert.equal(container.innerHTML, "<p>x</p>");
  });
});

describe("FunctionComponent: renderTree", () => {
  test("렌더 중에는 current가 자신이고 hookIndex가 0이며, 끝나면 이전 값으로 돌아와요", () => {
    const container = createContainer();
    const seen: unknown[] = [];
    const App = () => {
      seen.push(
        FunctionComponent.current,
        FunctionComponent.current?.hookIndex,
      );
      return h("p");
    };
    const root = new FunctionComponent(container, App);
    root.hookIndex = 5;

    root.mount();

    assert.deepStrictEqual(seen, [root, 0]);
    assert.equal(FunctionComponent.current, null);
  });

  test("루트 함수가 던져도 FunctionComponent.current가 이전 값이에요", () => {
    const other = new FunctionComponent(createContainer(), () => h("p"));
    const root = new FunctionComponent(createContainer(), () => {
      throw new Error("렌더 실패");
    });
    FunctionComponent.current = other;
    try {
      assert.throws(() => root.mount(), /렌더 실패/);
      assert.equal(FunctionComponent.current, other);
      assert.equal(root.tree, null);
    } finally {
      FunctionComponent.current = null;
    }
  });

  test("update는 결과 캐시를 써서 props가 같은 자식을 다시 부르지 않아요", () => {
    const { fn: Row, calls } = counted((p: { label: string }) =>
      h("li", null, p.label),
    );
    let extra = "a";
    const App = () =>
      h("ul", null, h(Row, { label: "고정" }), h("li", null, extra));
    const root = createRoot(createContainer(), App);

    extra = "b";
    root.update();

    assert.equal(calls.count, 1);
  });
});

describe("FunctionComponent: update", () => {
  test("바뀐 곳의 Patch만 돌려주고 나머지 노드는 같은 객체예요", () => {
    const container = createContainer();
    let count = 0;
    const App = () =>
      h("div", null, h("p", null, "고정"), h("span", null, count));
    const root = createRoot(container, App);
    const [p, span] = Array.from(container.firstChild!.childNodes);
    const before = root.tree;

    count = 1;
    const patches = root.update();

    assert.deepStrictEqual(patches, [{ type: "TEXT", path: [1], value: "1" }]);
    const [p2, span2] = Array.from(container.firstChild!.childNodes);
    assert.equal(p2, p);
    assert.equal(span2, span);
    assert.equal(container.textContent, "고정1");
    assert.notEqual(root.tree, before);
  });

  test("바뀐 것이 없으면 []를 돌려줘요", () => {
    const root = createRoot(createContainer(), () => h("p", null, "x"));
    assert.deepStrictEqual(root.update(), []);
  });

  test("key가 있는 Item 목록을 재정렬하면 Patch는 MOVE뿐이고 DOM 노드가 같은 객체예요", () => {
    const container = createContainer();
    let labels = ["a", "b", "c"];
    const App = () =>
      h(
        "ul",
        null,
        labels.map((label) => h(Item, { key: label, label })),
      );
    const root = createRoot(container, App);
    const [a, b, c] = Array.from(container.firstChild!.childNodes);

    labels = ["c", "a", "b"];
    const patches = root.update();

    assert.deepStrictEqual(patches, [
      { type: "MOVE", parentPath: [], from: 2, to: 0 },
    ]);
    assert.deepStrictEqual(Array.from(container.firstChild!.childNodes), [
      c,
      a,
      b,
    ]);
  });

  test("핸들러를 바꾸면 update 뒤 새 핸들러가 불려요", () => {
    const container = createContainer();
    const log: number[] = [];
    let version = 0;
    const App = () => {
      const current = version;
      return h("button", { onClick: () => log.push(current) }, "누르기");
    };
    const root = createRoot(container, App);
    const button = container.querySelector("button") as HTMLElement;

    button.click();
    version = 1;
    root.update();
    button.click();

    assert.deepStrictEqual(log, [0, 1]);
  });

  test("mount 전에 update를 부르면 오류를 던져요", () => {
    const root = new FunctionComponent(createContainer(), () => h("p"));
    assert.throws(() => root.update(), /mount를 먼저 불러야 해요/);
  });
});

describe("FunctionComponent: runEffects", () => {
  test("effects에 넣은 작업 2개가 차례로 1번씩 불리고 effects가 비어요", () => {
    const root = new FunctionComponent(createContainer(), () => h("p"));
    const order: number[] = [];
    root.effects.push(
      () => order.push(1),
      () => order.push(2),
    );

    root.runEffects();
    root.runEffects();

    assert.deepStrictEqual(order, [1, 2]);
    assert.deepStrictEqual(root.effects, []);
    assert.equal(root.flushing, false);
  });

  test("첫 작업이 작업을 더 넣고 runEffects를 다시 불러도, 넣은 작업은 두 번째 작업 뒤에 1번 불려요", () => {
    const root = new FunctionComponent(createContainer(), () => h("p"));
    const order: string[] = [];
    root.effects.push(
      () => {
        order.push("첫 시작");
        root.effects.push(() => order.push("추가"));
        root.runEffects();
        order.push("첫 끝");
      },
      () => order.push("둘째"),
    );

    root.runEffects();

    assert.deepStrictEqual(order, ["첫 시작", "첫 끝", "둘째", "추가"]);
  });

  test("작업이 던져도 flushing이 false로 돌아와요", () => {
    const root = new FunctionComponent(createContainer(), () => h("p"));
    root.effects.push(() => {
      throw new Error("effect 실패");
    });

    assert.throws(() => root.runEffects(), /effect 실패/);
    assert.equal(root.flushing, false);
  });

  test("mount와 update는 tree를 저장하고 DOM을 바꾼 뒤 effects를 실행해요", () => {
    const container = createContainer();
    let count = 0;
    const seen: string[] = [];
    const root = new FunctionComponent(container, () => {
      FunctionComponent.current?.effects.push(() => {
        const tree = root.tree;
        seen.push(`${container.textContent}:${tree?.children}`);
      });
      return h("p", null, count);
    });

    root.mount();
    count = 1;
    root.update();

    assert.deepStrictEqual(seen, ["0:0", "1:1"]);
  });
});
