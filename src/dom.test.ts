import assert from "node:assert/strict";
import { after, describe, it } from "node:test";
import { JSDOM } from "jsdom";
import { fromHTML, readArea, sourceOf, toHTML } from "./dom.ts";
import { createTextVNode, h } from "./vnode.ts";
import type { Child, Props, VNode } from "./vnode.ts";

const dom = new JSDOM("");
globalThis.document = dom.window.document;
after(() => dom.window.close());

function root(...children: Child[]): VNode {
  return h("div", { class: "vdom-root" }, ...children);
}

describe("DOM 읽기", () => {
  it("빈 영역과 빈 소스는 자식이 null인 루트다", () => {
    assert.deepStrictEqual(readArea(document.createElement("div")), root());
    assert.deepStrictEqual(fromHTML(""), root());
  });

  const examples: [string, VNode][] = [
    ["<ul>\n  <li>a</li>\n</ul>", root(h("ul", null, h("li", null, "a")))],
    [
      '<li data-key="a">x</li>',
      root(h("li", { "data-key": "a", key: "a" }, "x")),
    ],
    ['<img src="x" onerror="f()">', root(h("img", { src: "x" }))],
    ["<p>y</p><script>f()</script>", root(h("p", null, "y"))],
    [
      '<li data-key="a" onclick="f()"></li>',
      root(h("li", { "data-key": "a", key: "a" })),
    ],
    ['<li key="x"></li>', root(h("li"))],
    [
      '<li data-key="y" key="x">a</li>',
      root(h("li", { "data-key": "y", key: "y" }, "a")),
    ],
    ['<li data-key=""></li>', root(h("li", { "data-key": "", key: "" }))],
    [
      '<DIV ONCLICK="f()" title="a&amp;b" hidden></DIV>',
      root(h("div", { title: "a&b", hidden: "" })),
    ],
    ["<p>\n</p>", root(h("p"))],
    ["<p> </p>", root(h("p", null, " "))],
    ["<p>\t\f</p>", root(h("p", null, "\t\f"))],
    ["<p>\t\f\r\n </p>", root(h("p"))],
    ["<p>&nbsp;</p>", root(h("p", null, "\u00a0"))],
    ["<p>\n&nbsp;\n</p>", root(h("p", null, "\n\u00a0\n"))],
    ["<p>a<!--c-->b</p>", root(h("p", null, "ab"))],
    [
      "<p>a<!--x-->\n<b>b</b></p>",
      root(h("p", null, "a\n", h("b", null, "b"))),
    ],
    ["<p>\n<!--x--> <b>b</b></p>", root(h("p", null, h("b", null, "b")))],
    [
      "<p>a<script>f()</script>\n<b>b</b></p>",
      root(h("p", null, "a\n", h("b", null, "b"))),
    ],
    [
      "<p><b>a</b> <i>b</i></p>",
      root(h("p", null, h("b", null, "a"), " ", h("i", null, "b"))),
    ],
    [
      "<p><b>a</b>\n<i>b</i></p>",
      root(h("p", null, h("b", null, "a"), h("i", null, "b"))),
    ],
    ["<pre>\n\n</pre>", root(h("pre", null, "\n"))],
    ["<textarea>\n\n</textarea>", root(h("textarea", null, "\n"))],
    [
      "<pre><div>\n <b>x</b>\n</div></pre>",
      root(h("pre", null, h("div", null, "\n ", h("b", null, "x"), "\n"))),
    ],
    ["<template><p>x</p></template>", root(h("template"))],
    ["<!--x--><script>f()</script>", root()],
  ];
  for (const [html, expected] of examples) {
    it(`${JSON.stringify(html)}를 규칙대로 읽는다`, () => {
      assert.deepStrictEqual(fromHTML(html), expected);
      const area = document.createElement("div");
      area.innerHTML = html;
      const before = area.innerHTML;
      assert.deepStrictEqual(readArea(area), expected);
      assert.equal(area.innerHTML, before);
    });
  }

  it("현재 폼 프로퍼티 대신 HTML 속성과 텍스트를 읽는다", () => {
    const area = document.createElement("div");
    area.innerHTML =
      '<input value="original" checked><textarea>original</textarea>';
    const input = area.querySelector("input")!;
    input.value = "edited";
    input.checked = false;
    area.querySelector("textarea")!.value = "edited";
    assert.deepStrictEqual(
      readArea(area),
      root(
        h("input", { value: "original", checked: "" }),
        h("textarea", null, "original"),
      ),
    );
  });

  it("__proto__ 속성도 일반 문자열 속성으로 읽는다", () => {
    const node = fromHTML('<div __proto__="x"></div>');
    assert.ok(Array.isArray(node.children));
    assert.deepStrictEqual(node.children[0].props, { ["__proto__"]: "x" });
  });
});

describe("HTML 직렬화", () => {
  const examples: [string, string][] = [
    [
      "<ul>\n  <li>a</li>\n</ul>",
      '<div class="vdom-root"><ul><li>a</li></ul></div>',
    ],
    [
      '<li data-key="a">x</li>',
      '<div class="vdom-root"><li data-key="a">x</li></div>',
    ],
    [
      '<img src="x" onerror="f()">',
      '<div class="vdom-root"><img src="x"></div>',
    ],
    ["<p>y</p><script>f()</script>", '<div class="vdom-root"><p>y</p></div>'],
  ];
  for (const [html, expected] of examples) {
    it(`${JSON.stringify(html)}가 설계 문서의 HTML 출력과 같다`, () => {
      assert.equal(toHTML(fromHTML(html)), expected);
    });
  }

  it("텍스트 VNode와 속성의 특수 문자를 이스케이프한다", () => {
    assert.equal(toHTML(createTextVNode("a<b")), "a&lt;b");
    assert.equal(
      toHTML(h("p", { title: '&<>"' }, '&<>"')),
      '<p title="&amp;&lt;&gt;&quot;">&amp;&lt;&gt;&quot;</p>',
    );
    assert.equal(sourceOf(root('&<>"')), "&amp;&lt;&gt;&quot;");
    assert.equal(sourceOf(root()), "");
  });

  it("불리언·빈 속성은 이름만 쓰고 직렬화할 수 없는 속성은 생략한다", () => {
    assert.equal(
      toHTML(
        h("input", {
          checked: "",
          disabled: true,
          value: 0,
          title: "",
          hidden: false,
          id: null,
          name: undefined,
          onClick: () => {},
          style: { color: "red" },
        }),
      ),
      '<input checked disabled value="0" title>',
    );
  });

  for (const tag of [
    "area",
    "base",
    "br",
    "col",
    "embed",
    "hr",
    "img",
    "input",
    "link",
    "meta",
    "source",
    "track",
    "wbr",
  ]) {
    it(`${tag}의 닫는 태그를 생략한다`, () => {
      assert.equal(toHTML(h(tag)), `<${tag}>`);
    });
  }

  for (const tag of ["style", "xmp", "iframe", "noembed", "noframes"]) {
    it(`${tag}의 원문 텍스트를 이스케이프하지 않는다`, () => {
      const text = 'a > b & c < d "x"';
      assert.equal(toHTML(h(tag, null, text)), `<${tag}>${text}</${tag}>`);
      const tree = fromHTML(`<${tag}>${text}</${tag}>`);
      assert.deepStrictEqual(fromHTML(sourceOf(tree)), tree);
    });
  }

  for (const tag of ["pre", "textarea"]) {
    it(`${tag}에서 파서가 버리는 첫 줄바꿈을 보충한다`, () => {
      assert.equal(toHTML(h(tag, null, "\nabc")), `<${tag}>\n\nabc</${tag}>`);
      assert.equal(toHTML(h(tag, null, "abc")), `<${tag}>abc</${tag}>`);
    });
  }

  it("요소만 있는 자식은 깊이마다 두 칸으로 들여쓴다", () => {
    assert.equal(
      sourceOf(fromHTML("<ul><li>a</li><li>b</li></ul>")),
      "<ul>\n  <li>a</li>\n  <li>b</li>\n</ul>",
    );
    assert.equal(
      sourceOf(
        root(h("section", null, h("div", null, h("b", null, "x"))), h("br")),
      ),
      "<section>\n  <div>\n    <b>x</b>\n  </div>\n</section>\n<br>",
    );
  });

  for (const html of [
    "<section>text<div><b>x</b><i>y</i></div></section>",
    "<pre><div><b>x</b><i>y</i></div></pre>",
    "<textarea>  x\ny</textarea>",
    "a<div><b>x</b><i>y</i></div>",
    "<div>a</div> <div>b</div>",
  ]) {
    it(`${JSON.stringify(html)}의 서브트리는 들여쓰지 않는다`, () => {
      assert.equal(sourceOf(fromHTML(html)), html);
    });
  }
});

describe("소스 왕복", () => {
  for (const html of [
    "<p>a<!--c-->b</p>",
    "<pre>\n\nabc</pre>",
    "<textarea>\n\n</textarea>",
    "<pre><div><b>x</b><i>y</i></div></pre>",
    '<ul><li key="x">a</li></ul>',
    '<li data-key="y" key="x">a</li>',
    "<p><b>a</b> <i>b</i></p>",
    "<p><b>a</b>\n<i>b</i></p>",
    "<p>a<!--x-->\n<b>b</b></p>",
    "<p>\n<!--x--> <b>b</b></p>",
    "<li> <b>x</b></li>",
    "<ul>\n  <li>a</li>\n  <li>b</li>\n</ul>",
  ]) {
    it(`${JSON.stringify(html)}를 다시 읽어도 VNode가 같다`, () => {
      const tree = fromHTML(html);
      assert.deepStrictEqual(fromHTML(sourceOf(tree)), tree);
    });
  }

  it("설계 문서의 다양한 태그 HTML을 왕복한다", () => {
    const html = `<section id="s" class="a b" data-x="1">
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
</section>`;
    const tree = fromHTML(html);
    assert.deepStrictEqual(fromHTML(sourceOf(tree)), tree);
    assert.deepStrictEqual(fromHTML(toHTML(tree)).children, [tree]);
    const template = document.createElement("template");
    template.innerHTML = sourceOf(tree);
    assert.equal(
      template.content.querySelector<HTMLInputElement>('input[type="range"]')!
        .value,
      "250",
    );
    assert.equal(
      template.content.querySelector<HTMLInputElement>(
        'input[type="checkbox"]',
      )!.checked,
      true,
    );
    assert.equal(template.content.querySelector("select")!.value, "y");
    assert.equal(
      template.content.querySelector("output b")!.textContent,
      "출력",
    );
  });
});

function randomTree(seed: number): () => VNode {
  function random(): number {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let value = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  }
  function count(): number {
    return Math.floor(random() * 4);
  }
  function text(): string {
    return Math.floor(random() * 0x1000000).toString(36);
  }
  function children(depth: number): Child[] {
    return Array.from({ length: count() }, () =>
      depth >= 5 || random() < 0.3 ? text() : element(depth + 1),
    );
  }
  function element(depth: number): VNode {
    const tags = ["div", "span", "section", "ul", "b", "i", "em", "br"];
    const tag = tags[Math.floor(random() * tags.length)];
    const props: Props = {};
    for (const key of ["id", "class", "data-x"]) {
      if (random() < 0.3) props[key] = text();
    }
    return h(tag, props, ...(tag === "br" ? [] : children(depth)));
  }
  return () => root(...children(0));
}

describe("무작위 VNode 왕복", () => {
  for (const seed of [1, 2, 3, 4, 5]) {
    it(`시드 ${seed}의 2,000개 트리에서 내용이 보존된다`, () => {
      const next = randomTree(seed);
      for (let index = 0; index < 2000; index++) {
        const tree = next();
        const source = sourceOf(tree);
        assert.deepStrictEqual(
          fromHTML(source),
          tree,
          `seed=${seed}, index=${index}, input=${source}`,
        );
      }
    });
  }
});
