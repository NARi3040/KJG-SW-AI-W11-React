import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, test } from "node:test";
import { JSDOM } from "jsdom";
import { diff } from "./diff.ts";
import { fromHTML, readArea, sourceOf } from "./dom.ts";
import { history } from "./app.ts";
import { formatPatches } from "./patch.ts";
import { CASES } from "./verify-cases.ts";
import {
  closingTagFor,
  MONACO_TIMEOUT_MS,
  monacoWorkerUrl,
  start,
  startPage,
} from "./verify-page.ts";

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

// 한 줄짜리 문서만 다루는 가짜 Monaco 에디터예요
function fakeMonaco() {
  const calls: { paths?: Record<string, string>; options?: object } = {};
  const editor = {
    text: "",
    column: 1,
    listener: null as ((event: object) => void) | null,
    getValue() {
      return this.text;
    },
    setValue(next: string) {
      this.text = next;
    },
    getPosition() {
      return { lineNumber: 1, column: this.column };
    },
    setPosition(at: { column: number }) {
      this.column = at.column;
    },
    getModel() {
      return {
        getValueInRange: (range: { endColumn: number }) =>
          editor.text.slice(0, range.endColumn - 1),
      };
    },
    executeEdits(
      _source: string,
      edits: { range: { startColumn: number }; text: string }[],
    ) {
      for (const { range, text } of edits) {
        const i = range.startColumn - 1;
        this.text = this.text.slice(0, i) + text + this.text.slice(i);
        this.column = i + 1 + text.length;
      }
      return true;
    },
    undoStops: 0,
    pushUndoStop() {
      this.undoStops++;
      return true;
    },
    onDidChangeModelContent(listener: (event: object) => void) {
      this.listener = listener;
    },
    type(text: string, flags: Record<string, boolean> = {}) {
      const i = this.column - 1;
      this.text = this.text.slice(0, i) + text + this.text.slice(i);
      this.column += text.length;
      this.listener?.({
        changes: [{ text }],
        isUndoing: false,
        isRedoing: false,
        isFlush: false,
        ...flags,
      });
    },
  };
  const monaco = {
    editor: {
      create(_host: Element, options: Record<string, unknown>) {
        calls.options = options;
        return editor;
      },
    },
  };
  return { calls, editor, monaco };
}

function setRequire(
  fn: (deps: string[], ok: (m: unknown) => void, fail: () => void) => void,
  calls: { paths?: Record<string, string> },
): void {
  const amd = Object.assign(fn, {
    config(options: { paths: Record<string, string> }) {
      calls.paths = options.paths;
    },
  });
  (dom.window as unknown as { require: unknown }).require = amd;
}

test("startPage: 로더가 없으면 textarea로 시작해요", () => {
  startPage(document);

  assert.equal(
    el<HTMLTextAreaElement>("editor").value,
    sourceOf(history.stack[0]),
  );
  assert.equal(el<HTMLTextAreaElement>("editor").hidden, false);
  assert.equal(el<HTMLDivElement>("monaco").hidden, true);
});

test("startPage: Monaco를 불러오면 그 에디터로 Patch해요", () => {
  const { calls, editor, monaco } = fakeMonaco();
  setRequire((deps, ok) => {
    assert.deepEqual(deps, ["vs/editor/editor.main"]);
    ok(monaco);
  }, calls);

  startPage(document);

  assert.match(calls.paths?.vs ?? "", /monaco-editor@0\.52\.2\/min\/vs$/);
  assert.equal((calls.options as { language: string }).language, "html");
  assert.equal(el<HTMLTextAreaElement>("editor").hidden, true);
  assert.equal(el<HTMLDivElement>("monaco").hidden, false);
  assert.equal(editor.text, sourceOf(history.stack[0]));

  editor.text = editor.text.replace("정글러", "나리");
  click("patch");

  assert.match(el("log").textContent ?? "", /"type":"TEXT"/);
  assert.equal(el("real").querySelector("b")?.textContent, "나리");
  assert.equal(editor.text, sourceOf(history.stack[1]));
  assert.notEqual(el<HTMLTextAreaElement>("editor").value, editor.text);

  click("back");

  assert.equal(editor.text, sourceOf(history.stack[0]));
});

test("startPage: Monaco에서 >를 치면 닫는 태그를 넣고 커서는 그 앞에 둬요", () => {
  const { calls, editor, monaco } = fakeMonaco();
  setRequire((_deps, ok) => ok(monaco), calls);
  startPage(document);
  editor.setValue("");
  editor.column = 1;

  editor.type("<p");
  editor.type(">");

  assert.equal(editor.text, "<p></p>");
  assert.equal(editor.column, 4);
  assert.equal(editor.undoStops, 1);

  editor.type("<br>");

  assert.equal(editor.text, "<p><br></p>");
});

test("closingTagFor: 여는 태그 뒤에서만 닫는 태그를 돌려줘요", () => {
  assert.equal(closingTagFor("<ul>\n  <li>"), "</li>");
  assert.equal(closingTagFor('<a href="#x" class="a b">'), "</a>");
  assert.equal(closingTagFor("<DIV>"), "</div>");
  assert.equal(closingTagFor("<my-tag>"), "</my-tag>");
  for (const before of [
    "<br>",
    '<input type="text">',
    "<b/>",
    "<b />",
    "</b>",
    "<!-- x -->",
    "a > b",
    "<>",
    "",
  ]) {
    assert.equal(closingTagFor(before), null, before);
  }
});

test("startPage: 에디터 모듈을 못 불러오면 textarea로 시작해요", () => {
  const { calls } = fakeMonaco();
  setRequire((_deps, _ok, fail) => fail(), calls);

  startPage(document);

  assert.equal(
    el<HTMLTextAreaElement>("editor").value,
    sourceOf(history.stack[0]),
  );
  assert.equal(el<HTMLDivElement>("monaco").hidden, true);
});

test("startPage: create가 던지면 textarea로 시작해요", () => {
  const calls = {};
  const monaco = {
    editor: {
      create() {
        throw new Error("create 실패");
      },
    },
  };
  setRequire((_deps, ok) => ok(monaco), calls);

  startPage(document);

  assert.equal(
    el<HTMLTextAreaElement>("editor").value,
    sourceOf(history.stack[0]),
  );
  assert.equal(el<HTMLTextAreaElement>("editor").hidden, false);
  assert.equal(el<HTMLDivElement>("monaco").hidden, true);
});

test("monacoWorkerUrl: CDN의 workerMain.js를 불러오는 data: URL이에요", () => {
  const url = monacoWorkerUrl();

  assert.match(url, /^data:text\/javascript;charset=utf-8,/);
  assert.match(
    decodeURIComponent(url),
    /importScripts\("https:\/\/cdn\.jsdelivr\.net\/npm\/monaco-editor@0\.52\.2\/min\/vs\/base\/worker\/workerMain\.js"\)/,
  );
});

test("테스트 케이스: 버튼을 만들고 누르면 테스트 영역과 기대 결과를 바꿔요", () => {
  start(document);
  const buttons = [...el("cases").querySelectorAll("button")];
  assert.deepEqual(
    buttons.map((b) => b.textContent),
    CASES.map((c) => c.name),
  );
  const various = buttons.find((b) => b.textContent === "다양한 태그");
  assert.ok(various);

  various.click();

  assert.match(el<HTMLTextAreaElement>("editor").value, /<h1>제목<\/h1>/);
  assert.match(el("case-note").textContent ?? "", /^다양한 태그: 오류 없음/);
  assert.equal(history.index, 0);
});

test("테스트 케이스: 시연 시나리오 1–6단계를 버튼과 Patch로 진행해요", () => {
  start(document);
  const expected = [
    ["TEXT", 1],
    ["PROPS", 1],
    ["CREATE", 1],
    ["REPLACE,REPLACE,REPLACE,REPLACE,REPLACE,REMOVE", 6],
    ["REPLACE", 1],
    ["MOVE", 2],
  ] as const;

  for (const [index, [types, count]] of expected.entries()) {
    const button = el("cases").querySelectorAll("button")[index];
    button.click();
    click("patch");

    const lines = (el("log").textContent ?? "").split("\n");
    assert.equal(
      lines.map((line) => JSON.parse(line).type).join(","),
      types,
      `${index + 1}단계`,
    );
    assert.equal(el("mutations").textContent, String(count));
    assert.equal(el("error").textContent, "");
  }
});

test("테스트 케이스: 적용할 곳이 없으면 내용을 두고 오류를 써요", () => {
  start(document);
  const editor = el<HTMLTextAreaElement>("editor");
  const before = editor.value;

  el("cases").querySelectorAll("button")[4].click(); // 5. 태그 교체는 1단계 뒤에 써요

  assert.equal(editor.value, before);
  assert.match(el("error").textContent ?? "", /적용할 곳이 없어요/);

  el("cases").querySelectorAll("button")[0].click();

  assert.equal(el("error").textContent, "");
});

test("테스트 케이스: 다양한 태그, script·on*, 처음 샘플이 Patch돼요", () => {
  start(document);
  const byName = (name: string) =>
    [...el("cases").querySelectorAll("button")].find(
      (b) => b.textContent === name,
    )!;
  const real = el("real");
  const initial = el<HTMLTextAreaElement>("editor").value;

  byName("다양한 태그").click();
  click("patch");

  assert.equal(el("error").textContent, "");
  assert.equal(
    real.querySelector<HTMLInputElement>('input[type="range"]')?.value,
    "250",
  );
  assert.equal(real.querySelector<HTMLSelectElement>("select")?.value, "y");

  byName("script·on*").click();
  click("patch");

  assert.equal(real.querySelector("script"), null);
  assert.equal(real.querySelector("p")?.hasAttribute("onclick"), false);
  assert.equal(el<HTMLTextAreaElement>("editor").value, "<p>a</p>");

  byName("처음 샘플").click();
  click("patch");

  assert.equal(el<HTMLTextAreaElement>("editor").value, initial);
  assert.deepEqual(readArea(real.firstElementChild!), history.stack[0]);
});

function caseButton(name: string): HTMLButtonElement {
  const found = [...el("cases").querySelectorAll("button")].find(
    (b) => b.textContent === name,
  );
  assert.ok(found, name);
  return found;
}

test("테스트 케이스: 묶음마다 제목과 버튼을 한 줄에 둬요", () => {
  start(document);

  const groups = [...el("cases").querySelectorAll(".case-group")];
  assert.deepEqual(
    groups.map((g) => g.getAttribute("aria-label")),
    ["시연", "Patch", "위치 비교", "key 비교", "읽기·속성", "기타"],
  );
  assert.equal(groups[0].querySelectorAll("button").length, 7);
});

test("테스트 케이스: 두 단계 케이스는 시작 상태를 먼저 채우고, 다시 누르면 바뀐 상태를 채워요", () => {
  start(document);
  const editor = el<HTMLTextAreaElement>("editor");

  caseButton("class 삭제").click();

  assert.equal(editor.value, '<p class="x">a</p>');
  assert.match(el("case-note").textContent ?? "", /\(1\/2\)/);
  assert.equal(history.index, 0);

  click("patch");
  caseButton("class 삭제").click();

  assert.equal(editor.value, "<p>a</p>");
  assert.match(
    el("case-note").textContent ?? "",
    /\(2\/2\): PROPS remove class/,
  );
});

test("테스트 케이스: 두 단계 케이스가 기대한 Patch와 DOM 변경 횟수를 내요", (t) => {
  const warn = t.mock.method(console, "warn", () => {});
  start(document);
  // [버튼, Patch 종류, DOM 변경, 두 번째 단계의 콘솔 경고]
  const expected: [string, string, number, number][] = [
    ["형제 여러 개 삭제", "REMOVE,REMOVE", 2, 0],
    ["이동 + 삭제", "REMOVE,REMOVE,MOVE", 4, 0],
    ["텍스트 → 요소", "TEXT,CREATE", 2, 0],
    ["요소 → 텍스트", "REMOVE,REMOVE,TEXT", 3, 0],
    ["요소 → 비어 있음", "REMOVE", 1, 0],
    ["비어 있음 → 텍스트", "TEXT", 1, 0],
    ["입력한 textarea", "TEXT", 1, 0],
    ["텍스트 ↔ 요소", "REPLACE", 1, 0],
    ["속성 값만 다름", "PROPS", 2, 0],
    ["key만 다름", "REMOVE,CREATE", 2, 0],
    ["같은 key, 다른 태그", "REMOVE,CREATE", 2, 0],
    ["옮긴 노드의 내용 변경", "TEXT,MOVE", 3, 0],
    ["key 있음·없음 섞임", "MOVE,MOVE", 4, 0],
    ["중복 key", "MOVE,CREATE", 3, 1],
    ["공통 구간의 중복 key", "REMOVE,MOVE", 3, 0],
    ["빈 data-key", "MOVE", 2, 0],
    ["file 입력 type 변경", "PROPS,CREATE", 2, 0],
    ["새 option + select 값", "PROPS,CREATE", 2, 0],
    ["class 삭제", "PROPS", 1, 0],
  ];

  for (const [name, types, count, warnings] of expected) {
    caseButton(name).click();
    click("patch");
    warn.mock.resetCalls();
    caseButton(name).click();
    click("patch");

    assert.equal(warn.mock.callCount(), warnings, `${name} 경고`);

    const lines = (el("log").textContent ?? "").split("\n");
    assert.equal(
      lines.map((line) => JSON.parse(line).type).join(","),
      types,
      name,
    );
    assert.equal(el("mutations").textContent, String(count), name);
    assert.equal(el("error").textContent, "", name);
    assert.deepEqual(
      readArea(el("real").firstElementChild!),
      history.stack[history.index],
      name,
    );
  }
});

test("테스트 케이스: 실제 영역 textarea에 입력한 값도 TEXT로 바뀌어요", () => {
  start(document);
  caseButton("입력한 textarea").click();
  click("patch");
  const area = el("real").querySelector("textarea");
  assert.ok(area);
  area.value = "사용자 입력";

  caseButton("입력한 textarea").click();
  click("patch");

  assert.equal(el("real").querySelector("textarea")?.value, "할 일");
});

test("테스트 케이스: 새 option을 넣으면 select 값이 B가 돼요", () => {
  start(document);
  caseButton("새 option + select 값").click();
  click("patch");
  caseButton("새 option + select 값").click();
  click("patch");

  assert.equal(el("real").querySelector("select")?.value, "b");
});

test("테스트 케이스: 한 단계 읽기 케이스가 문서대로 읽혀요", () => {
  start(document);
  const editor = el<HTMLTextAreaElement>("editor");

  caseButton("주석·&nbsp;").click();
  click("patch");
  // sourceOf는 &nbsp;를 엔티티가 아니라 U+00A0 문자로 써요
  assert.equal(editor.value, "<p>ab\u00a0c</p>");

  caseButton("key와 data-key").click();
  click("patch");
  assert.doesNotMatch(editor.value, /\skey=/);
  assert.match(editor.value, /data-key="y"/);

  caseButton("style·checked·progress").click();
  click("patch");
  assert.equal(el("error").textContent, "");
  assert.equal(
    el("real").querySelector<HTMLInputElement>("input")?.checked,
    true,
  );

  caseButton("이상한 속성 이름").click();
  click("patch");
  assert.equal(el("error").textContent, "");
  assert.equal(el("real").querySelector("p")?.getAttribute('x"y'), "1");
  assert.equal(editor.value, '<p x"y="1">a</p>');

  caseButton("변경 없음").click();
  const before = history.index;
  click("patch");
  assert.equal(el("log").textContent, "변경 없음");
  assert.equal(history.index, before + 1);
});

test("startPage: 되돌리기·다시 실행·setValue로 생긴 >에는 닫는 태그를 넣지 않아요", () => {
  const { calls, editor, monaco } = fakeMonaco();
  setRequire((_deps, ok) => ok(monaco), calls);
  startPage(document);

  for (const flag of ["isUndoing", "isRedoing", "isFlush"]) {
    editor.setValue("<p");
    editor.column = 3;
    editor.type(">", { [flag]: true });
    assert.equal(editor.text, "<p>", flag);
  }
  editor.setValue("<p");
  editor.column = 3;
  editor.listener?.({
    changes: [{ text: ">" }, { text: ">" }],
    isUndoing: false,
    isRedoing: false,
    isFlush: false,
  });
  assert.equal(editor.text, "<p");
});

test("startPage: Monaco가 10초 안에 오지 않으면 textarea로 시작하고 늦은 성공은 무시해요", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const { calls, monaco } = fakeMonaco();
  let late: ((m: unknown) => void) | undefined;
  setRequire((_deps, ok) => {
    late = ok;
  }, calls);

  startPage(document);
  assert.equal(el<HTMLTextAreaElement>("editor").value, "");

  t.mock.timers.tick(MONACO_TIMEOUT_MS);
  assert.equal(
    el<HTMLTextAreaElement>("editor").value,
    sourceOf(history.stack[0]),
  );

  late?.(monaco);
  assert.equal(el<HTMLDivElement>("monaco").hidden, true);
  assert.equal(el("cases").querySelectorAll("button").length, CASES.length);
});

test("테스트 케이스: 잘못된 중첩과 비우기가 문서대로 Patch돼요", () => {
  start(document);
  const editor = el<HTMLTextAreaElement>("editor");

  caseButton("잘못된 중첩").click();
  click("patch");
  assert.equal(editor.value, "<p>a</p>\n<div>b</div>\n<p></p>");

  caseButton("비우기").click();
  click("patch");
  assert.equal(editor.value, "");
  assert.equal(el("real").firstElementChild?.childNodes.length, 0);
});

test("테스트 케이스: 뒤로가기로 시작 상태를 벗어나면 두 단계 버튼은 다시 1/2부터예요", () => {
  start(document);
  caseButton("class 삭제").click();
  click("patch");
  click("back");

  caseButton("class 삭제").click();

  assert.equal(el<HTMLTextAreaElement>("editor").value, '<p class="x">a</p>');
  assert.match(el("case-note").textContent ?? "", /\(1\/2\)/);
});
