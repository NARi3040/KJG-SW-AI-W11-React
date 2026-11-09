import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { JSDOM } from "jsdom";
import { applyProps, createDOM, mountArea, setProp } from "./dom.ts";
import { createTextVNode, h } from "./vnode.ts";

let dom: JSDOM;
beforeEach(() => {
  dom = new JSDOM("<!doctype html><html><body></body></html>");
  globalThis.document = dom.window.document;
});
afterEach(() => dom.window.close());

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
