import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { diff } from "./diff.ts";
import { createTextVNode, h } from "./vnode.ts";
import type { Child, Patch, Props, VNode } from "./vnode.ts";

function deepFreeze(v: VNode): VNode {
  if (v.props) Object.freeze(v.props);
  if (Array.isArray(v.children)) {
    for (const c of v.children) deepFreeze(c);
    Object.freeze(v.children);
  }
  return Object.freeze(v);
}

// <div class="vdom-root">를 루트로 둔 영역이에요. 경로 [0]이 그 안의 첫 자식이에요.
function root(...children: Child[]): VNode {
  return h("div", { class: "vdom-root" }, ...children);
}

describe("diff: 변경 없음", () => {
  test("모양이 같은 다른 객체면 []", () => {
    const make = () =>
      root(
        h("ul", { class: "list" }, h("li", null, "a"), h("li", null, "b")),
        h("p", null, "x ", h("b", null, "y")),
      );
    assert.deepEqual(diff(make(), make()), []);
  });

  test("같은 VNode 객체면 []", () => {
    const v = root(h("p", null, "a"));
    assert.deepEqual(diff(v, v), []);
  });

  test("이전 트리의 서브트리를 그대로 재사용하면 그 아래는 비교하지 않아요", () => {
    const shared = h("ul", null, h("li", null, "a"));
    const patches = diff(
      root(shared, h("p", null, "x")),
      root(shared, h("p", null, "y")),
    );
    assert.deepEqual(patches, [{ type: "TEXT", path: [1], value: "y" }]);
  });
});

describe("diff: vnode-spec.md 위치 비교 예시", () => {
  // 이전: <ul><li>a</li><li class="x">b</li></ul>
  // 새것: <ul><li class="y">A</li></ul>
  const oldV = root(
    h("ul", null, h("li", null, "a"), h("li", { class: "x" }, "b")),
  );
  const newV = root(h("ul", null, h("li", { class: "y" }, "A")));

  test("예시의 세 Patch와 정확히 같아요", () => {
    assert.deepEqual(diff(oldV, newV), [
      { type: "TEXT", path: [0, 0], value: "A" },
      { type: "PROPS", path: [0, 0], set: { class: "y" }, remove: [] },
      { type: "REMOVE", path: [0, 1] },
    ]);
  });

  test("경로는 Patch마다 따로 복사돼요", () => {
    const [a, b] = diff(oldV, newV) as [
      Extract<Patch, { path: unknown }>,
      Extract<Patch, { path: unknown }>,
    ];
    assert.notEqual(a.path, b.path);
  });
});

describe("diff: 노드 비교 (isSame, 교체)", () => {
  test("같은 태그에 다른 key면 REPLACE", () => {
    const n = h("li", { key: "b" }, "a");
    assert.deepEqual(diff(root(h("li", { key: "a" }, "a")), root(n)), [
      { type: "REPLACE", path: [0], node: n },
    ]);
  });

  test("key가 null과 0이면 다른 노드예요", () => {
    const n = h("li", { key: 0 }, "a");
    assert.deepEqual(diff(root(h("li", null, "a")), root(n)), [
      { type: "REPLACE", path: [0], node: n },
    ]);
  });

  test("key가 같으면 같은 노드로 보고 안쪽을 비교해요", () => {
    assert.deepEqual(
      diff(root(h("li", { key: "k" }, "a")), root(h("li", { key: "k" }, "b"))),
      [{ type: "TEXT", path: [0], value: "b" }],
    );
  });

  test("태그가 다르면 REPLACE만 내고 안쪽은 보지 않아요", () => {
    const n = h("ol", { class: "y" }, h("li", null, "b"));
    assert.deepEqual(
      diff(root(h("ul", { class: "x" }, h("li", null, "a"))), root(n)),
      [{ type: "REPLACE", path: [0], node: n }],
    );
  });

  test("루트끼리 태그가 다르면 경로 []의 REPLACE", () => {
    const n = h("section", null, "a");
    assert.deepEqual(diff(h("div", null, "a"), n), [
      { type: "REPLACE", path: [], node: n },
    ]);
  });

  test("텍스트 VNode ↔ 요소는 REPLACE", () => {
    const b = h("b", null, "x");
    assert.deepEqual(
      diff(root(h("p", null, "x", h("i"))), root(h("p", null, b, h("i")))),
      [{ type: "REPLACE", path: [0, 0], node: b }],
    );
    assert.deepEqual(
      diff(root(h("p", null, b, h("i"))), root(h("p", null, "x", h("i")))),
      [{ type: "REPLACE", path: [0, 0], node: createTextVNode("x") }],
    );
  });

  test("독립 텍스트 VNode의 내용이 다르면 그 텍스트 노드 경로로 TEXT", () => {
    assert.deepEqual(
      diff(
        root(h("p", null, "a", h("b", null, "x"))),
        root(h("p", null, "c", h("b", null, "x"))),
      ),
      [{ type: "TEXT", path: [0, 0], value: "c" }],
    );
  });

  test("자식 Patch가 자기 PROPS보다 먼저 나와요", () => {
    assert.deepEqual(
      diff(
        root(h("ul", { class: "a" }, h("li", { id: "1" }, "x"))),
        root(h("ul", { class: "b" }, h("li", { id: "2" }, "y"))),
      ),
      [
        { type: "TEXT", path: [0, 0], value: "y" },
        { type: "PROPS", path: [0, 0], set: { id: "2" }, remove: [] },
        { type: "PROPS", path: [0], set: { class: "b" }, remove: [] },
      ],
    );
  });
});

describe("diff: 속성 비교 (diffProps)", () => {
  const propsPatch = (oldP: Props | null, newP: Props | null) =>
    diff(root(h("p", oldP)), root(h("p", newP)));

  test("값이 같으면 PROPS를 내지 않아요", () => {
    assert.deepEqual(propsPatch({ a: "1", b: "2" }, { b: "2", a: "1" }), []);
    assert.deepEqual(propsPatch(null, null), []);
  });

  test('null → { a: "1" }이면 set: { a: "1" }, remove: []', () => {
    assert.deepEqual(propsPatch(null, { a: "1" }), [
      { type: "PROPS", path: [0], set: { a: "1" }, remove: [] },
    ]);
  });

  test('{ a: "1" } → null이면 remove: ["a"]', () => {
    assert.deepEqual(propsPatch({ a: "1" }, null), [
      { type: "PROPS", path: [0], set: {}, remove: ["a"] },
    ]);
  });

  test("바뀐 값은 set, 이전에만 있는 이름은 remove", () => {
    assert.deepEqual(
      propsPatch({ a: "1", b: "2", c: "3" }, { a: "1", b: "9", d: "4" }),
      [{ type: "PROPS", path: [0], set: { b: "9", d: "4" }, remove: ["c"] }],
    );
  });

  test('!==로 비교해요: 숫자 1과 문자열 "1"은 달라요', () => {
    assert.deepEqual(propsPatch({ a: "1" }, { a: 1 }), [
      { type: "PROPS", path: [0], set: { a: 1 }, remove: [] },
    ]);
  });

  test("!==로 비교해요: 내용이 같아도 다른 style 객체면 set", () => {
    const style = { color: "red" };
    assert.deepEqual(propsPatch({ style }, { style }), []);
    assert.deepEqual(propsPatch({ style }, { style: { color: "red" } }), [
      {
        type: "PROPS",
        path: [0],
        set: { style: { color: "red" } },
        remove: [],
      },
    ]);
  });

  test("값이 undefined여도 새 props에 이름이 있으면 remove가 아니에요", () => {
    assert.deepEqual(propsPatch({ a: "1" }, { a: undefined }), [
      { type: "PROPS", path: [0], set: { a: undefined }, remove: [] },
    ]);
  });

  test("key는 props가 아니라서 속성 비교에 나오지 않아요", () => {
    assert.deepEqual(
      diff(
        root(h("ul", null, h("li", { key: "k", id: "1" }, "a"))),
        root(h("ul", null, h("li", { key: "k", id: "2" }, "a"))),
      ),
      [{ type: "PROPS", path: [0, 0], set: { id: "2" }, remove: [] }],
    );
  });
});

describe("diff: 위치 비교 (diffUnkeyed)", () => {
  const li = (s: string) => h("li", null, s);

  test("이전이 길면 남는 쪽을 뒤 인덱스부터 REMOVE", () => {
    assert.deepEqual(
      diff(
        root(h("ul", null, li("a"), li("b"), li("c"))),
        root(h("ul", null, li("a"))),
      ),
      [
        { type: "REMOVE", path: [0, 2] },
        { type: "REMOVE", path: [0, 1] },
      ],
    );
  });

  test("새것이 길면 남는 쪽을 새 인덱스 오름차순으로 CREATE", () => {
    const b = li("b");
    const c = li("c");
    assert.deepEqual(
      diff(root(h("ul", null, li("a"))), root(h("ul", null, li("a"), b, c))),
      [
        { type: "CREATE", parentPath: [0], index: 1, node: b },
        { type: "CREATE", parentPath: [0], index: 2, node: c },
      ],
    );
  });

  test("한 부모 아래에 REMOVE와 CREATE가 함께 나오지 않아요", () => {
    const patches = diff(
      root(h("ul", null, li("a"), li("b"), li("c"))),
      root(h("ul", null, li("x"), li("y"))),
    );
    assert.deepEqual(patches, [
      { type: "TEXT", path: [0, 0], value: "x" },
      { type: "TEXT", path: [0, 1], value: "y" },
      { type: "REMOVE", path: [0, 2] },
    ]);
  });

  test("한계: 맨 앞 형제가 사라지면 뒤 형제가 당겨져 전부 REPLACE", () => {
    const h2 = h("h2", null, "프로필");
    const p = h("p", null, "소개");
    const ul = h("ul", null, li("a"));
    const patches = diff(root(h2, p, ul), root(p, ul));
    assert.deepEqual(patches, [
      { type: "REPLACE", path: [0], node: p },
      { type: "REPLACE", path: [1], node: ul },
      { type: "REMOVE", path: [2] },
    ]);
  });
});

describe("diff: 자식 비교 9가지 조합 (diffChildren)", () => {
  // 대상 요소는 경로 [0]의 p예요. from, to는 h의 자식 인자로 넘겨요.
  const a = h("b", null, "a");
  const b = h("i", null, "b");
  const c = h("u", null, "c");
  const cases: {
    name: string;
    from: Child;
    to: Child;
    expected: Patch[];
  }[] = [
    { name: "없음 → 없음", from: null, to: null, expected: [] },
    {
      name: "없음 → 텍스트",
      from: null,
      to: "x",
      expected: [{ type: "TEXT", path: [0], value: "x" }],
    },
    {
      name: "없음 → 배열",
      from: null,
      to: [a, b],
      expected: [
        { type: "CREATE", parentPath: [0], index: 0, node: a },
        { type: "CREATE", parentPath: [0], index: 1, node: b },
      ],
    },
    {
      name: "텍스트 → 없음",
      from: "x",
      to: null,
      expected: [{ type: "TEXT", path: [0], value: "" }],
    },
    {
      name: "텍스트 → 텍스트 (다름)",
      from: "x",
      to: "y",
      expected: [{ type: "TEXT", path: [0], value: "y" }],
    },
    { name: "텍스트 → 텍스트 (같음)", from: "x", to: "x", expected: [] },
    {
      name: "텍스트 → 배열",
      from: "x",
      to: [a, b],
      expected: [
        { type: "TEXT", path: [0], value: "" },
        { type: "CREATE", parentPath: [0], index: 0, node: a },
        { type: "CREATE", parentPath: [0], index: 1, node: b },
      ],
    },
    {
      name: "배열 → 없음",
      from: [a, b, c],
      to: null,
      expected: [
        { type: "REMOVE", path: [0, 2] },
        { type: "REMOVE", path: [0, 1] },
        { type: "REMOVE", path: [0, 0] },
      ],
    },
    {
      name: "배열 → 텍스트",
      from: [a, b],
      to: "y",
      expected: [
        { type: "REMOVE", path: [0, 1] },
        { type: "REMOVE", path: [0, 0] },
        { type: "TEXT", path: [0], value: "y" },
      ],
    },
    {
      name: "배열 → 배열 (key 없음, 위치 비교)",
      from: [a, b],
      to: [a, c],
      expected: [{ type: "REPLACE", path: [0, 1], node: c }],
    },
    // 이전 텍스트가 빈 문자열이면 TEXT("")를 내지 않아요.
    { name: "빈 텍스트 → 없음", from: "", to: null, expected: [] },
    {
      name: "빈 텍스트 → 배열",
      from: "",
      to: [a],
      expected: [{ type: "CREATE", parentPath: [0], index: 0, node: a }],
    },
  ];

  for (const { name, from, to, expected } of cases) {
    test(name, () => {
      assert.deepEqual(
        diff(root(h("p", null, from)), root(h("p", null, to))),
        expected,
      );
    });
  }
});

describe("diff: 다섯 경우", () => {
  test("CREATE, REMOVE, REPLACE, TEXT, PROPS가 각각 나와요", () => {
    const kinds = (o: VNode, n: VNode) => diff(o, n).map((p) => p.type);
    const li = (s: string) => h("li", null, s);

    assert.deepEqual(
      kinds(
        root(h("ul", null, li("a"))),
        root(h("ul", null, li("a"), li("b"))),
      ),
      ["CREATE"],
    );
    assert.deepEqual(
      kinds(
        root(h("ul", null, li("a"), li("b"))),
        root(h("ul", null, li("a"))),
      ),
      ["REMOVE"],
    );
    assert.deepEqual(kinds(root(h("b", null, "a")), root(h("u", null, "a"))), [
      "REPLACE",
    ]);
    assert.deepEqual(kinds(root(h("b", null, "a")), root(h("b", null, "c"))), [
      "TEXT",
    ]);
    assert.deepEqual(
      kinds(root(h("b", { id: "x" }, "a")), root(h("b", { id: "y" }, "a"))),
      ["PROPS"],
    );
  });
});

describe("diff: 깊은 중첩", () => {
  // div 아래 b 999겹, 맨 안쪽 i
  function nested(inner: string): VNode {
    let node = h("i", null, inner);
    for (let i = 0; i < 999; i++) node = h("b", null, node);
    return h("div", null, node);
  }

  test("맨 안쪽 텍스트만 바꾸면 TEXT 1개, path는 0이 1,000개", () => {
    const patches = diff(nested("a"), nested("z"));
    assert.deepEqual(patches, [
      { type: "TEXT", path: new Array<number>(1000).fill(0), value: "z" },
    ]);
  });

  test("바꾸지 않으면 []", () => {
    assert.deepEqual(diff(nested("a"), nested("a")), []);
  });
});

describe("diff: 직렬화", () => {
  test("함수 props와 텍스트 VNode가 없는 Patch 목록은 JSON 왕복 후 같아요", () => {
    const patches = diff(
      root(
        h("ul", { class: "x" }, h("li", null, "a"), h("li", null, "b")),
        h("p", null, "q"),
      ),
      root(
        h("ul", { class: "y" }, h("li", { id: "1" }, "A")),
        h("div", null, "r"),
        h("ol", null, h("li", null, "c")),
      ),
    );
    assert.deepEqual(
      patches.map((p) => p.type),
      ["TEXT", "PROPS", "REMOVE", "PROPS", "REPLACE", "CREATE"],
    );
    assert.deepEqual(JSON.parse(JSON.stringify(patches)), patches);
  });
});

describe("diff: 불변", () => {
  test("모든 VNode를 Object.freeze해도 오류 없이 같은 결과", () => {
    const make = () => ({
      oldV: root(
        h(
          "ul",
          { class: "x" },
          h("li", null, "a"),
          h("li", null, "b"),
          h("li", null, "c"),
        ),
        h("p", null, "t", h("b", null, "y")),
        h("span", null, "s"),
      ),
      newV: root(
        h("ul", { class: "y" }, h("li", null, "A")),
        h("p", null, "only text"),
        h("span", null, h("i", null, "n")),
        h("hr"),
      ),
    });
    const plain = make();
    const frozen = make();
    deepFreeze(frozen.oldV);
    deepFreeze(frozen.newV);
    const before = JSON.stringify([frozen.oldV, frozen.newV]);

    const patches = diff(frozen.oldV, frozen.newV);
    assert.deepEqual(patches, diff(plain.oldV, plain.newV));
    assert.equal(JSON.stringify([frozen.oldV, frozen.newV]), before);
  });
});
