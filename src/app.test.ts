import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { JSDOM } from "jsdom";
import { canGo, countMutations, go, history, load, onPatch } from "./app.ts";
import { readArea, sourceOf } from "./dom.ts";
import type { Patch } from "./vnode.ts";

const SAMPLE_HTML = `<section id="profile" class="card">
  <h2>프로필</h2>
  <p>이름: <b>정글러</b> · 기수: <i>13기</i></p>
  <ul class="todo">
    <li data-key="vdom">Virtual DOM</li>
    <li data-key="diff">Diff</li>
    <li data-key="patch">Patch</li>
  </ul>
  <label><input type="checkbox" checked /> 알림 받기</label>
  <select name="track">
    <option value="fe">프론트</option>
    <option value="be" selected>백엔드</option>
  </select>
</section>`;

let dom: JSDOM;
let real: HTMLElement;
let editor: { value: string };

beforeEach(() => {
  dom = new JSDOM(
    `<!doctype html><html><body><div id="real"></div></body></html>`,
  );
  globalThis.document = dom.window.document;

  const area = document.getElementById("real");
  assert.ok(area);
  area.innerHTML = SAMPLE_HTML;
  real = area;
  editor = { value: "" };

  history.stack = [];
  history.index = -1;
});

afterEach(() => dom.window.close());

test("history: 로드, Patch, 뒤로·앞으로, 앞으로 기록 자르기", () => {
  load(real, editor);
  const initial = history.stack[0];
  assert.equal(history.index, 0);
  assert.equal(history.stack.length, 1);
  assert.equal(editor.value, sourceOf(initial));
  assert.equal(canGo(-1), false);
  assert.equal(canGo(1), false);
  assertAreaMatchesCurrent();

  editor.value = editor.value.replace("정글러", "나리");
  assert.equal(onPatch(real, editor).length, 1);
  const first = history.stack[1];
  assert.equal(history.index, 1);
  assert.equal(history.stack.length, 2);
  assert.equal(canGo(-1), true);
  assert.equal(canGo(1), false);
  assertAreaMatchesCurrent();

  editor.value = editor.value.replace('class="card"', 'class="card dark"');
  assert.equal(onPatch(real, editor).length, 1);
  const second = history.stack[2];
  assert.equal(history.index, 2);
  assert.equal(history.stack.length, 3);
  assertAreaMatchesCurrent();

  const back = go(real, editor, -1);
  assert.ok(back);
  assert.equal(history.index, 1);
  assert.equal(history.stack[1], first);
  assert.equal(editor.value, sourceOf(first));
  assert.equal(canGo(1), true);
  assertAreaMatchesCurrent();

  const forward = go(real, editor, 1);
  assert.ok(forward);
  assert.equal(history.index, 2);
  assert.equal(history.stack[2], second);
  assert.equal(editor.value, sourceOf(second));
  assertAreaMatchesCurrent();

  assert.ok(go(real, editor, -1));
  assert.equal(history.index, 1);
  assert.equal(history.stack[1], first);

  editor.value = editor.value.replace(
    "</section>",
    "  <p>추가</p>\n</section>",
  );
  assert.equal(onPatch(real, editor).length, 1);
  assert.equal(history.index, 2);
  assert.equal(history.stack.length, 3);
  assert.equal(history.stack[1], first);
  assert.equal(history.stack.includes(second), false);
  assert.equal(canGo(1), false);
  assertAreaMatchesCurrent();

  const html = real.innerHTML;
  const value = editor.value;
  assert.equal(go(real, editor, 1), null);
  assert.equal(real.innerHTML, html);
  assert.equal(editor.value, value);
});

test("시연 시나리오 1–7단계: Patch, DOM 변경 횟수, 처음 상태로 뒤로가기", () => {
  load(real, editor);
  const initial = history.stack[0];

  const steps: {
    edit: (source: string) => string;
    shapes: string[];
    mutations: number;
  }[] = [
    {
      edit: (source) => source.replace("정글러", "나리"),
      shapes: ["TEXT [0,1,1] 나리"],
      mutations: 1,
    },
    {
      edit: (source) => source.replace('class="card"', 'class="card dark"'),
      shapes: ["PROPS [0]"],
      mutations: 1,
    },
    {
      edit: (source) =>
        source.replace("</section>", "  <p>추가</p>\n</section>"),
      shapes: ["CREATE [0] 5"],
      mutations: 1,
    },
    {
      edit: (source) => source.replace("  <h2>프로필</h2>\n", ""),
      shapes: [
        "REPLACE [0,0]",
        "REPLACE [0,1]",
        "REPLACE [0,2]",
        "REPLACE [0,3]",
        "REPLACE [0,4]",
        "REMOVE [0,5]",
      ],
      mutations: 6,
    },
    {
      edit: (source) => source.replace("<b>나리</b>", "<u>나리</u>"),
      shapes: ["REPLACE [0,0,1]"],
      mutations: 1,
    },
    {
      edit: (source) =>
        source
          .replace('    <li data-key="patch">Patch</li>\n', "")
          .replace(
            '<ul class="todo">\n',
            '<ul class="todo">\n    <li data-key="patch">Patch</li>\n',
          ),
      shapes: ["MOVE [0,1] 2->0"],
      mutations: 2,
    },
  ];

  for (const [index, step] of steps.entries()) {
    editor.value = step.edit(editor.value);
    const { result: patches, mutations } = countMutations(real, () =>
      onPatch(real, editor),
    );

    assert.deepEqual(shapesOf(patches), step.shapes, `${index + 1}단계 Patch`);
    assert.equal(mutations, step.mutations, `${index + 1}단계 DOM 변경`);
    assert.equal(editor.value, sourceOf(history.stack[history.index]));
    assertAreaMatchesCurrent();
  }

  assert.equal(history.index, 6);
  assert.equal(history.stack.length, 7);

  for (let expected = 5; expected >= 0; expected--) {
    const patches = go(real, editor, -1);
    assert.ok(patches, "뒤로가기는 null이 아니어야 해요");
    assert.equal(history.index, expected);
    assert.equal(editor.value, sourceOf(history.stack[expected]));
    assertAreaMatchesCurrent();
  }

  assert.equal(history.stack[history.index], initial);
  assert.equal(canGo(-1), false);
  assert.equal(canGo(1), true);

  const checkbox = real.querySelector<HTMLInputElement>(
    'input[type="checkbox"]',
  );
  const select = real.querySelector<HTMLSelectElement>("select");
  assert.ok(checkbox);
  assert.ok(select);
  assert.equal(checkbox.checked, true);
  assert.equal(select.value, "be");
});

test("변경 없는 Patch: []를 돌려주고 history에는 항목을 추가해요", () => {
  load(real, editor);

  const patches = onPatch(real, editor);

  assert.deepEqual(patches, []);
  assert.equal(history.index, 1);
  assert.equal(history.stack.length, 2);
  assert.equal(canGo(-1), true);
  assert.equal(canGo(1), false);
  assertAreaMatchesCurrent();
});

test("실패 복구: 예외를 다시 던지고 history, 실제 영역, textarea를 그대로 둬요", () => {
  load(real, editor);
  const beforeStack = [...history.stack];
  const beforeIndex = history.index;
  // 실제 영역을 VNode와 어긋나게 만들어요. TEXT가 적용된 뒤 PROPS에서 예외가 나요
  const select = real.querySelector("select");
  assert.ok(select);
  select.replaceWith(document.createTextNode("바꿔치기"));
  const invalid = sourceOf(history.stack[history.index])
    .replace("프로필", "나리 프로필")
    .replace('name="track"', 'name="t"');

  editor.value = invalid;
  assert.throws(() => onPatch(real, editor), /PROPS 대상이 요소가 아니에요/);

  assert.equal(history.index, beforeIndex);
  assert.deepEqual(history.stack, beforeStack);
  assert.equal(editor.value, invalid);
  assertAreaMatchesCurrent();

  editor.value = sourceOf(history.stack[history.index]).replace(
    "정글러",
    "나리",
  );
  const patches = onPatch(real, editor);
  assert.deepEqual(shapesOf(patches), ["TEXT [0,1,1] 나리"]);
  assert.equal(history.index, beforeIndex + 1);
  assertAreaMatchesCurrent();
});

test("파일 입력: value가 있어도 Patch하고 뒤로·앞으로 이동해요", () => {
  real.innerHTML = `<input type="text" value="a">`;
  load(real, editor);

  editor.value = `<input type="file" value="a">`;
  onPatch(real, editor);
  editor.value = `<p>A</p><input type="file" value="a">`;
  onPatch(real, editor);
  assert.equal(history.stack.length, 3);
  assertAreaMatchesCurrent();
  const file = real.querySelector("input");
  assert.equal(file?.value, "");
  assert.equal(file?.getAttribute("value"), "a");

  go(real, editor, -1);
  go(real, editor, -1);
  assert.equal(history.index, 0);
  assertAreaMatchesCurrent();
  assert.equal(real.querySelector("input")?.value, "a");
});

test("잘못된 중첩: 파서가 고친 구조로 비교하고 textarea를 다시 채워요", () => {
  load(real, editor);

  editor.value = "<p>a<div>b</div></p>";
  onPatch(real, editor);

  assert.equal(editor.value, "<p>a</p>\n<div>b</div>\n<p></p>");
  assert.equal(editor.value, sourceOf(history.stack[history.index]));
  assertAreaMatchesCurrent();
});

test("countMutations: 속성, 자식, 텍스트 변경을 세고 결과를 돌려줘요", () => {
  const target = document.createElement("div");
  document.body.appendChild(target);
  const text = document.createTextNode("a");
  target.appendChild(text);

  const { result, mutations } = countMutations(target, () => {
    target.setAttribute("data-x", "1");
    target.appendChild(document.createElement("b"));
    text.data = "b";
    return "결과";
  });

  assert.equal(result, "결과");
  assert.equal(mutations, 3);
});

test("countMutations: fn이 던져도 예외를 그대로 전달해요", () => {
  const target = document.createElement("div");
  document.body.appendChild(target);

  assert.throws(
    () =>
      countMutations(target, () => {
        target.setAttribute("data-x", "1");
        throw new Error("실패");
      }),
    /실패/,
  );
});

function assertAreaMatchesCurrent(): void {
  const root = real.firstElementChild;
  assert.ok(root);
  assert.deepEqual(readArea(root), history.stack[history.index]);
}

function shapesOf(patches: Patch[]): string[] {
  return patches.map((patch) => {
    switch (patch.type) {
      case "CREATE":
        return `CREATE ${formatPath(patch.parentPath)} ${patch.index}`;
      case "REMOVE":
        return `REMOVE ${formatPath(patch.path)}`;
      case "REPLACE":
        return `REPLACE ${formatPath(patch.path)}`;
      case "TEXT":
        return `TEXT ${formatPath(patch.path)} ${patch.value}`;
      case "PROPS":
        return `PROPS ${formatPath(patch.path)}`;
      case "MOVE":
        return `MOVE ${formatPath(patch.parentPath)} ${patch.from}->${patch.to}`;
    }
  });
}

function formatPath(path: number[]): string {
  return `[${path.join(",")}]`;
}
