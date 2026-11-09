import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, test } from "node:test";
import { JSDOM } from "jsdom";
import { diff } from "./diff.ts";
import { fromHTML, readArea, sourceOf } from "./dom.ts";
import { history } from "./app.ts";
import { formatPatches } from "./patch.ts";
import { start } from "./verify-page.ts";

// 실제 페이지 마크업으로 확인해요. jsdom은 기본값으로 <script>를 실행하지 않아요
const PAGE = readFileSync(new URL("../verify.html", import.meta.url), "utf8");

let dom: JSDOM;

beforeEach(() => {
  dom = new JSDOM(PAGE);
  globalThis.document = dom.window.document;
});

afterEach(() => dom.window.close());

function el<T extends Element>(id: string): T {
  const found = document.getElementById(id);
  assert.ok(found, `#${id}`);
  return found as Element as T;
}

function click(id: string): void {
  el<HTMLButtonElement>(id).click();
}

test("start: 로드 직후 textarea를 채우고 이동 버튼을 비활성화해요", () => {
  start(document);

  const editor = el<HTMLTextAreaElement>("editor");
  assert.equal(editor.value, sourceOf(history.stack[0]));
  assert.match(editor.value, /<b>정글러<\/b>/);
  assert.equal(el<HTMLButtonElement>("back").disabled, true);
  assert.equal(el<HTMLButtonElement>("forward").disabled, true);
  assert.equal(el("log").textContent, "");
  assert.equal(el("error").textContent, "");
});

test("Patch: 로그, DOM 변경 횟수, 버튼 상태를 갱신해요", () => {
  start(document);
  const editor = el<HTMLTextAreaElement>("editor");
  const before = history.stack[0];
  editor.value = editor.value.replace("정글러", "나리");
  const patches = diff(before, fromHTML(editor.value));
  assert.equal(patches.length, 1);

  click("patch");

  assert.equal(el("log").textContent, formatPatches(patches).slice(1, -1));
  assert.match(el("log").textContent ?? "", /^\{"type":"TEXT".*\}$/);
  assert.equal(el("mutations").textContent, "1");
  assert.equal(el<HTMLButtonElement>("back").disabled, false);
  assert.equal(el<HTMLButtonElement>("forward").disabled, true);
  assert.equal(el("real").querySelector("b")?.textContent, "나리");
});

test("로그: Patch가 여러 개면 한 줄에 하나씩, 없으면 변경 없음", () => {
  start(document);
  const editor = el<HTMLTextAreaElement>("editor");
  editor.value = editor.value.replace("  <h2>프로필</h2>\n", "");

  click("patch");

  const lines = (el("log").textContent ?? "").split("\n");
  // 처음 상태의 자식 5개에서 h2가 빠져 4개가 당겨지고 마지막 자리는 REMOVE돼요
  assert.equal(lines.length, 5);
  assert.deepEqual(
    lines.map((line) => JSON.parse(line).type),
    ["REPLACE", "REPLACE", "REPLACE", "REPLACE", "REMOVE"],
  );

  click("patch");

  assert.equal(el("log").textContent, "변경 없음");
  assert.equal(el("mutations").textContent, "0");
});

test("뒤로가기·앞으로가기: 두 영역이 함께 바뀌고 끝에서 버튼이 비활성화돼요", () => {
  start(document);
  const editor = el<HTMLTextAreaElement>("editor");
  const initial = editor.value;
  editor.value = editor.value.replace("정글러", "나리");
  click("patch");
  const patched = editor.value;

  click("back");

  assert.equal(editor.value, initial);
  assert.equal(el("real").querySelector("b")?.textContent, "정글러");
  assert.equal(el("mutations").textContent, "1");
  assert.equal(el<HTMLButtonElement>("back").disabled, true);
  assert.equal(el<HTMLButtonElement>("forward").disabled, false);

  click("forward");

  assert.equal(editor.value, patched);
  assert.equal(el("real").querySelector("b")?.textContent, "나리");
  assert.equal(el<HTMLButtonElement>("back").disabled, false);
  assert.equal(el<HTMLButtonElement>("forward").disabled, true);
});

test("실패: 오류 메시지만 쓰고 로그를 두며, 다음 성공에서 오류를 지워요", () => {
  start(document);
  const editor = el<HTMLTextAreaElement>("editor");
  const real = el("real");
  editor.value = editor.value.replace("정글러", "나리");
  click("patch");
  const log = el("log").textContent;
  // 실제 영역을 VNode와 어긋나게 만들어 PROPS에서 예외가 나게 해요
  real.querySelector("select")?.replaceWith(document.createTextNode("x"));
  editor.value = editor.value.replace('name="track"', 'name="t"');

  click("patch");

  assert.match(el("error").textContent ?? "", /PROPS 대상이 요소가 아니에요/);
  assert.equal(el("log").textContent, log);
  assert.equal(el("mutations").textContent, "1");
  assert.equal(el<HTMLButtonElement>("back").disabled, false);
  assert.equal(el<HTMLButtonElement>("forward").disabled, true);
  assert.equal(history.index, 1);
  const root = real.firstElementChild;
  assert.ok(root);
  assert.deepEqual(readArea(root), history.stack[1]);

  click("patch");

  assert.equal(el("error").textContent, "");
  assert.equal(history.index, 2);
});

test("뒤로가기 실패: 오류를 쓰고 index와 버튼 상태를 그대로 둬요", () => {
  start(document);
  const editor = el<HTMLTextAreaElement>("editor");
  editor.value = editor.value.replace('name="track"', 'name="t"');
  click("patch");
  // 되돌릴 select가 사라져 뒤로가기의 PROPS에서 예외가 나요
  el("real").querySelector("select")?.replaceWith(document.createTextNode("x"));

  click("back");

  assert.match(el("error").textContent ?? "", /PROPS 대상이 요소가 아니에요/);
  assert.equal(history.index, 1);
  assert.equal(el<HTMLButtonElement>("back").disabled, false);
  assert.equal(el<HTMLButtonElement>("forward").disabled, true);
  assert.match(editor.value, /name="t"/);
});

test("start: 요소가 없으면 id를 담은 Error를 던져요", () => {
  el("log").remove();

  assert.throws(() => start(document), /id="log"/);
});

test("start: 태그가 다르면 id를 담은 Error를 던져요", () => {
  el("log").replaceWith(
    Object.assign(document.createElement("div"), { id: "log" }),
  );

  assert.throws(() => start(document), /<pre id="log">/);
});
