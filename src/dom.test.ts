import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it, test } from "node:test";
import { JSDOM } from "jsdom";
import {
  applyProps,
  createDOM,
  fromHTML,
  listen,
  mountArea,
  readArea,
  setProp,
  sourceOf,
  toHTML,
} from "./dom.ts";
import { createTextVNode, h } from "./vnode.ts";
import type { Child, Props, VNode } from "./vnode.ts";

let dom: JSDOM;
beforeEach(() => {
  dom = new JSDOM("<!doctype html><html><body></body></html>");
  globalThis.document = dom.window.document;
});
afterEach(() => dom.window.close());

test("createDOM: 객체 style의 cssFloat를 float로 반영해요", () => {
  const el = createDOM(h("p", { style: { cssFloat: "left" } })) as HTMLElement;
  assert.equal(el.style.cssFloat, "left");
  assert.equal(el.style.getPropertyValue("float"), "left");
});

test("setProp: 일반 속성과 true, 빈 문자열, 숫자 0을 반영해요", () => {
  const el = document.createElement("input");
  setProp(el, "title", "설명");
  setProp(el, "disabled", true);
  setProp(el, "data-empty", "");
  setProp(el, "data-count", 0);
  assert.equal(el.getAttribute("title"), "설명");
  assert.equal(el.getAttribute("disabled"), "");
  assert.equal(el.disabled, true);
  assert.equal(el.getAttribute("data-empty"), "");
  assert.equal(el.getAttribute("data-count"), "0");

  setProp(el, "data-object", { x: "y" });
  assert.equal(el.hasAttribute("data-object"), false);
});

test("setProp: 일반 속성을 객체 값으로 바꾸면 기존 속성을 제거해요", () => {
  const el = document.createElement("div");
  const next = Object.freeze({ x: "y" });
  for (const key of ["title", "data-x"]) {
    setProp(el, key, "이전 값");
    setProp(el, key, next);
    assert.equal(el.hasAttribute(key), false, key);

    applyProps(el, { [key]: "이전 값" });
    applyProps(el, { [key]: next });
    assert.equal(el.hasAttribute(key), false, key);

    setProp(el, key, next);
    assert.equal(el.hasAttribute(key), false, key);
  }
});

for (const off of [null, undefined, false]) {
  test(`setProp: ${String(off)}는 class, style과 일반 속성을 제거해요`, () => {
    const el = document.createElement("div");
    setProp(el, "class", "a b");
    setProp(el, "style", "color: red");
    setProp(el, "title", "설명");
    assert.equal(el.className, "a b");
    for (const key of ["class", "style", "title"]) {
      setProp(el, key, off);
      assert.equal(el.hasAttribute(key), false);
    }
    assert.equal(el.className, "");
    assert.equal(el.style.cssText, "");
  });
}

test("setProp: style 문자열과 객체는 이전 스타일을 교체해요", () => {
  const el = document.createElement("div");
  setProp(el, "style", "color: red; margin-top: 2px");
  assert.equal(el.style.color, "red");
  assert.equal(el.style.marginTop, "2px");

  const next = Object.freeze({ backgroundColor: "blue", fontSize: "12px" });
  setProp(el, "style", next);
  assert.equal(el.style.color, "");
  assert.equal(el.style.marginTop, "");
  assert.equal(el.style.backgroundColor, "blue");
  assert.equal(el.style.fontSize, "12px");
  assert.deepEqual(next, { backgroundColor: "blue", fontSize: "12px" });

  setProp(el, "style", "padding: 3px");
  assert.equal(el.style.backgroundColor, "");
  assert.equal(el.style.padding, "3px");
});

test("setProp: 문자열과 함수 on*은 속성도 리스너도 붙이지 않아요", (t) => {
  const el = document.createElement("button");
  const addListener = t.mock.method(el, "addEventListener");
  let calls = 0;
  for (const key of ["onclick", "onClick", "onerror"]) {
    setProp(el, key, "throw new Error('실행되면 안 돼요')");
    assert.equal(el.hasAttribute(key), false);
    setProp(el, key, () => calls++);
    assert.equal(el.hasAttribute(key), false);
  }
  el.dispatchEvent(new dom.window.Event("click"));
  el.dispatchEvent(new dom.window.Event("error"));
  assert.equal(el.onclick, null);
  assert.equal(calls, 0);
  assert.equal(addListener.mock.callCount(), 0);
});

test("setProp: 대소문자가 섞인 on*도 직접 호출과 VNode 렌더에서 차단해요", (t) => {
  const el = document.createElement("button");
  const addListener = t.mock.method(el, "addEventListener");
  let calls = 0;
  for (const key of ["OnClick", "oNclick", "ONCLICK", "OnError", "ONERROR"]) {
    for (const next of ["void 0", () => calls++]) {
      setProp(el, key, next);
      assert.equal(el.hasAttribute(key), false, key);
      const rendered = createDOM(h("button", { [key]: next })) as HTMLElement;
      assert.equal(rendered.hasAttribute(key), false, key);
      rendered.dispatchEvent(new dom.window.Event("click"));
      rendered.dispatchEvent(new dom.window.Event("error"));
    }
  }
  el.dispatchEvent(new dom.window.Event("click"));
  el.dispatchEvent(new dom.window.Event("error"));
  assert.equal(calls, 0);
  assert.equal(addListener.mock.callCount(), 0);
});

describe("이벤트 위임", () => {
  function setup() {
    const container = document.createElement("section");
    const parent = document.createElement("div");
    const button = document.createElement("button");
    parent.append(button);
    container.append(parent);
    listen(container);
    return { container, parent, button };
  }

  test("listen은 영역마다 이벤트 종류별 리스너를 한 번만 붙여요", (t) => {
    for (const container of [
      document.createElement("div"),
      document.createElement("div"),
    ]) {
      const addListener = t.mock.method(container, "addEventListener");
      listen(container);
      listen(container);
      assert.deepEqual(
        addListener.mock.calls.map(({ arguments: args }) => args[0]),
        [
          "click",
          "dblclick",
          "contextmenu",
          "input",
          "change",
          "submit",
          "keydown",
          "keyup",
          "focusin",
          "focusout",
        ],
      );
    }
  });

  test("click은 같은 이벤트로 한 번 호출하고 currentTarget은 영역이에요", (t) => {
    const { container, button } = setup();
    const addListener = t.mock.method(button, "addEventListener");
    const calls: Event[] = [];
    const currentTargets: (EventTarget | null)[] = [];
    let nativeEvent: Event | undefined;
    container.addEventListener("click", (event) => {
      nativeEvent = event;
    });
    setProp(button, "onClick", (event) => {
      calls.push(event);
      currentTargets.push(event.currentTarget);
    });
    button.click();
    assert.deepEqual(calls, [nativeEvent]);
    assert.deepEqual(currentTargets, [container]);
    assert.equal(addListener.mock.callCount(), 0);
    assert.equal(button.hasAttribute("onclick"), false);
  });

  test("자식 → 부모로 전달하고 영역 자신의 핸들러는 부르지 않아요", () => {
    const { container, parent, button } = setup();
    const calls: string[] = [];
    setProp(button, "onClick", () => calls.push("child"));
    setProp(parent, "onClick", () => calls.push("parent"));
    setProp(container, "onClick", () => calls.push("container"));
    button.click();
    container.click();
    assert.deepEqual(calls, ["child", "parent"]);
  });

  test("자식이 DOM에서 부모까지 지워도 미리 모은 경로를 전달해요", () => {
    const { parent, button } = setup();
    const calls: string[] = [];
    setProp(button, "onClick", () => {
      calls.push("child");
      button.remove();
      parent.remove();
    });
    setProp(parent, "onClick", () => calls.push("parent"));
    button.click();
    assert.deepEqual(calls, ["child", "parent"]);
  });

  test("stopPropagation 뒤에는 부모를 부르지 않아요", () => {
    const { parent, button } = setup();
    const calls: string[] = [];
    setProp(button, "onClick", (event) => {
      calls.push("child");
      event.stopPropagation();
    });
    setProp(parent, "onClick", () => calls.push("parent"));
    button.click();
    assert.deepEqual(calls, ["child"]);
  });

  test("대소문자와 무관하게 교체하고 함수가 아닌 값은 삭제해요", () => {
    const { button } = setup();
    const calls: string[] = [];
    setProp(button, "onClick", () => calls.push("old"));
    setProp(button, "ONCLICK", () => calls.push("new"));
    button.click();
    for (const next of [null, undefined, false, true, "code", 0, { x: "y" }]) {
      setProp(button, "onClick", () => calls.push("removed"));
      setProp(button, "onclick", next);
      button.click();
    }
    assert.deepEqual(calls, ["new"]);
  });

  test("부모 핸들러는 호출 직전에 조회해요", () => {
    const { parent, button } = setup();
    const calls: string[] = [];
    setProp(parent, "onClick", () => calls.push("old"));
    setProp(button, "onClick", () => {
      setProp(parent, "onClick", () => calls.push("new"));
    });
    button.click();
    assert.deepEqual(calls, ["new"]);
    setProp(button, "onClick", () => setProp(parent, "onClick", null));
    button.click();
    assert.deepEqual(calls, ["new"]);
  });

  test("contextmenu의 preventDefault는 원본 이벤트에 반영돼요", () => {
    const { button } = setup();
    setProp(button, "onContextMenu", (event) => event.preventDefault());
    const event = new dom.window.Event("contextmenu", {
      bubbles: true,
      cancelable: true,
    });
    assert.equal(button.dispatchEvent(event), false);
    assert.equal(event.defaultPrevented, true);
  });

  test("모든 지원 이벤트의 종류와 input target을 전달해요", () => {
    const { parent } = setup();
    const input = document.createElement("input");
    parent.append(input);
    const calls: Event[] = [];
    for (const name of [
      "click",
      "dblclick",
      "contextmenu",
      "input",
      "change",
      "submit",
      "keydown",
      "keyup",
      "focusin",
      "focusout",
    ]) {
      setProp(input, `on${name}`, (event) => {
        calls.push(event);
      });
      input.dispatchEvent(new dom.window.Event(name, { bubbles: true }));
      assert.equal(calls.at(-1)?.type, name);
      assert.equal(calls.at(-1)?.target, input);
    }
    assert.equal(calls.length, 10);
  });

  test("텍스트 target은 건너뛰고 부모 요소부터 전달해요", () => {
    const { button } = setup();
    const text = document.createTextNode("버튼");
    button.append(text);
    const calls: Event[] = [];
    setProp(button, "onClick", (event) => calls.push(event));
    const event = new dom.window.Event("click", { bubbles: true });
    text.dispatchEvent(event);
    assert.deepEqual(calls, [event]);
  });

  test("미지원 이벤트, 버블링 없는 이벤트, listen 없는 영역은 호출하지 않아요", () => {
    const { button } = setup();
    let calls = 0;
    for (const name of ["focus", "blur", "mouseenter"]) {
      setProp(button, `on${name}`, () => calls++);
      button.dispatchEvent(new dom.window.Event(name, { bubbles: true }));
    }
    setProp(button, "onClick", () => calls++);
    button.dispatchEvent(new dom.window.Event("click"));
    const unlistened = document.createElement("div");
    unlistened.append(button);
    button.click();
    assert.equal(calls, 0);
  });
});

test("setProp: checked와 selected는 빈 문자열도 켜짐이고 off면 꺼져요", () => {
  const input = document.createElement("input");
  input.type = "checkbox";
  const option = document.createElement("option");
  for (const next of ["", true, "checked", 0]) {
    input.checked = false;
    option.selected = false;
    setProp(input, "checked", next);
    setProp(option, "selected", next);
    assert.equal(input.checked, true);
    assert.equal(option.selected, true);
  }
  for (const off of [null, undefined, false]) {
    input.checked = true;
    option.selected = true;
    setProp(input, "checked", off);
    setProp(option, "selected", off);
    assert.equal(input.checked, false);
    assert.equal(option.selected, false);
    assert.equal(input.hasAttribute("checked"), false);
    assert.equal(option.hasAttribute("selected"), false);
  }
  const div = document.createElement("div");
  setProp(div, "checked", "");
  setProp(div, "selected", "");
  assert.equal("checked" in div, false);
  assert.equal("selected" in div, false);
});

test("setProp: 객체 값이면 checked와 selected의 현재 상태도 꺼요", () => {
  const next = Object.freeze({ x: "y" });
  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  const select = document.createElement("select");
  select.multiple = true;
  const option = document.createElement("option");
  select.appendChild(option);
  for (const apply of [
    (el: Element, key: string) => setProp(el, key, next),
    (el: Element, key: string) => applyProps(el, { [key]: next }),
  ]) {
    setProp(checkbox, "checked", true);
    checkbox.checked = true;
    setProp(option, "selected", true);
    option.selected = true;
    apply(checkbox, "checked");
    apply(option, "selected");
    assert.equal(checkbox.hasAttribute("checked"), false);
    assert.equal(checkbox.checked, false);
    assert.equal(option.hasAttribute("selected"), false);
    assert.equal(option.selected, false);
  }
});

test("setProp: 객체 value는 input, select, textarea의 현재값도 비워요", () => {
  const select = document.createElement("select");
  select.innerHTML = '<option value="x">X</option><option value="y">Y</option>';
  const next = Object.freeze({ x: "y" });
  for (const field of [
    document.createElement("input"),
    select,
    document.createElement("textarea"),
  ]) {
    setProp(field, "value", "y");
    field.value = "x";
    setProp(field, "value", next);
    assert.equal(field.hasAttribute("value"), false);
    assert.equal(field.value, "");
    setProp(field, "value", "y");
    field.value = "x";
    applyProps(field, { value: next });
    assert.equal(field.hasAttribute("value"), false);
    assert.equal(field.value, "");
  }
});

test("setProp: input, select, textarea의 현재 value도 바꿔요", () => {
  const select = document.createElement("select");
  select.innerHTML = '<option value="x">X</option><option value="y">Y</option>';
  const fields = [
    document.createElement("input"),
    select,
    document.createElement("textarea"),
  ];
  for (const field of fields) {
    for (const off of [null, undefined, false]) {
      field.value = "x";
      setProp(field, "value", "y");
      assert.equal(field.value, "y");
      assert.equal(field.getAttribute("value"), "y");
      field.value = "x";
      setProp(field, "value", off);
      assert.equal(field.value, "");
      assert.equal(field.hasAttribute("value"), false);
    }
  }
});

test("setProp: output의 자식, li의 value와 progress의 잘못된 값을 보존해요", () => {
  const output = document.createElement("output");
  output.innerHTML = "<b>y</b>";
  const child = output.firstChild;
  setProp(output, "value", "x");
  assert.equal(output.getAttribute("value"), "x");
  assert.equal(output.innerHTML, "<b>y</b>");
  assert.equal(output.firstChild, child);
  setProp(output, "value", null);
  assert.equal(output.firstChild, child);

  const li = document.createElement("li");
  setProp(li, "value", "not-a-number");
  assert.equal(li.getAttribute("value"), "not-a-number");
  setProp(li, "value", "42");
  assert.equal(li.value, 42);
  assert.equal(li.getAttribute("value"), "42");

  const progress = document.createElement("progress");
  assert.doesNotThrow(() => setProp(progress, "value", "not-a-number"));
  assert.equal(progress.getAttribute("value"), "not-a-number");
});

test("applyProps: 속성 순서에 관계없이 range의 value를 마지막에 써요", () => {
  const el = document.createElement("input");
  el.type = "range";
  const props = Object.freeze({ value: "250", min: "200", max: "300" });
  applyProps(el, props);
  assert.equal(el.min, "200");
  assert.equal(el.max, "300");
  assert.equal(el.value, "250");
  applyProps(el, { value: "150", max: "175", min: "125" });
  assert.equal(el.value, "150");
  applyProps(el, {});
  assert.equal(el.value, "150");
});

test("createDOM: 텍스트, 빈 요소, 혼합 자식을 문서 밖에 만들어요", () => {
  for (const text of ["", "<b>&텍스트", "\n", 0]) {
    const node = createDOM(createTextVNode(text));
    assert.equal(node.nodeType, 3);
    assert.equal(node.textContent, String(text));
    assert.equal(node.parentNode, null);
  }
  const empty = createDOM(h("div"));
  assert.equal(empty.childNodes.length, 0);
  const bold = h("b", null, "굵게");
  const vnode = h("p", { id: "p", key: "k" }, "글 ", bold, " 끝");
  const before = h(
    "p",
    { id: "p", key: "k" },
    "글 ",
    h("b", null, "굵게"),
    " 끝",
  );
  const el = createDOM(vnode) as HTMLElement;
  assert.equal(el.outerHTML, '<p id="p">글 <b>굵게</b> 끝</p>');
  assert.equal(el.childNodes.length, 3);
  assert.equal(el.parentNode, null);
  assert.equal(document.body.childNodes.length, 0);
  assert.deepEqual(vnode, before);
  assert.notEqual(createDOM(vnode), el);
});

test("createDOM: 컴포넌트는 중첩된 경우에도 실행하지 않고 오류를 던져요", () => {
  let calls = 0;
  const component = h(() => {
    calls++;
    return h("p");
  });
  assert.throws(() => createDOM(component), /컴포넌트/);
  assert.throws(() => createDOM(h("div", null, component)), /컴포넌트/);
  assert.equal(calls, 0);
});

test("createDOM: 자식과 일반 속성을 먼저 만든 뒤 value를 반영해요", () => {
  const select = createDOM(
    h(
      "select",
      { value: "y" },
      h("option", { value: "x" }, "X"),
      h("option", { value: "y" }, "Y"),
    ),
  ) as HTMLSelectElement;
  assert.equal(select.value, "y");
  const range = createDOM(
    h("input", { value: "250", type: "range", min: "200", max: "300" }),
  ) as HTMLInputElement;
  assert.equal(range.value, "250");
  const checkbox = createDOM(
    h("input", { type: "checkbox", checked: "" }),
  ) as HTMLInputElement;
  assert.equal(checkbox.checked, true);
});

test("mountArea: 기존 내용을 비우고 루트 하나만 붙여요", () => {
  const area = document.createElement("main");
  area.innerHTML = "이전 텍스트<p>이전 요소</p><!--주석-->";
  mountArea(area, h("div", { class: "vdom-root" }, h("p", null, "새 내용")));
  assert.equal(area.childNodes.length, 1);
  assert.equal(area.innerHTML, '<div class="vdom-root"><p>새 내용</p></div>');
  mountArea(area, h("div", { class: "vdom-root" }));
  assert.equal(area.childNodes.length, 1);
  assert.equal(area.firstChild?.childNodes.length, 0);
});

test("mountArea: 생성이 실패하면 기존 내용을 그대로 둬요", () => {
  const area = document.createElement("main");
  area.innerHTML = "<p>이전 요소</p>";
  const component = h(() => h("p", null), null);
  assert.throws(
    () => mountArea(area, h("div", { class: "vdom-root" }, component)),
    /expand/,
  );
  assert.equal(area.innerHTML, "<p>이전 요소</p>");
});

test("파일 입력: value 속성만 남기고 프로퍼티에는 대입하지 않아요", () => {
  const el = createDOM(
    h("input", { type: "file", value: "a" }),
  ) as HTMLInputElement;
  assert.equal(el.getAttribute("value"), "a");
  assert.equal(el.value, "");
  setProp(el, "value", "b");
  assert.equal(el.getAttribute("value"), "b");
});

test("fromHTML: =로 시작하는 속성 이름은 버려요", () => {
  const v = fromHTML(`<p =x="1" title="t">y</p><p /=1 =>z</p>`);
  assert.deepEqual(
    v,
    h(
      "div",
      { class: "vdom-root" },
      h("p", { title: "t" }, "y"),
      h("p", null, "z"),
    ),
  );
  assert.doesNotThrow(() => createDOM(v));
});

test("createDOM: 설계 문서의 다양한 태그를 그리고 폼 값과 자식을 보존해요", () => {
  const vnode = h(
    "section",
    { id: "s", class: "a b", "data-x": "1" },
    h("h1", null, "제목"),
    h("p", null, "글 ", h("b", null, "굵게"), " ", h("i", null, "기울임")),
    h("a", { href: "#x" }, "링크"),
    h(
      "ul",
      null,
      h("li", { "data-key": "a" }, "a"),
      h("li", { "data-key": "b" }, "b"),
    ),
    h("ol", { start: "3" }, h("li", null, "c")),
    h(
      "table",
      null,
      h("thead", null, h("tr", null, h("th", null, "h"))),
      h("tbody", null, h("tr", null, h("td", { colspan: "2" }, "d"))),
    ),
    h(
      "form",
      null,
      h("label", null, h("input", { type: "checkbox", checked: "" }), " 체크"),
      h("input", { type: "range", min: "200", max: "300", value: "250" }),
      h("input", { type: "text", value: "t" }),
      h(
        "select",
        { name: "s" },
        h("option", { value: "x" }, "X"),
        h("option", { value: "y", selected: "" }, "Y"),
      ),
      h("textarea", null, "  두\n줄"),
      h("button", { type: "button", value: "v" }, "버튼"),
    ),
    h("pre", null, "  공백\n유지"),
    h("img", { src: "x.png", alt: "그림" }),
    h("br"),
    h("hr"),
    h("style", null, "a > b { color: red; }"),
    h("output", { value: "o" }, h("b", null, "출력")),
  );
  const section = createDOM(vnode) as HTMLElement;
  assert.equal(
    section.querySelector<HTMLInputElement>('input[type="range"]')?.value,
    "250",
  );
  assert.equal(
    section.querySelector<HTMLInputElement>('input[type="checkbox"]')?.checked,
    true,
  );
  assert.equal(section.querySelector("select")?.value, "y");
  assert.equal(section.querySelector("output b")?.textContent, "출력");
  assert.equal(section.querySelector("textarea")?.value, "  두\n줄");
  assert.equal(section.querySelector("pre")?.textContent, "  공백\n유지");
  assert.equal(section.querySelector("p")?.textContent, "글 굵게 기울임");
  assert.equal(section.querySelector("td")?.colSpan, 2);
  assert.equal(section.querySelector("ol")?.start, 3);
  assert.equal(
    section.querySelector("style")?.textContent,
    "a > b { color: red; }",
  );
});

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
          data: { value: "생략" },
        }),
      ),
      '<input checked disabled value="0" title style="color: red">',
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
