import { canGo, countMutations, go, history, load, onPatch } from "./app.ts";
import { fromHTML, sourceOf } from "./dom.ts";
import { formatPatches } from "./patch.ts";
import type { Editor } from "./app.ts";
import { CASES } from "./verify-cases.ts";
import type { Case } from "./verify-cases.ts";
import type { Patch } from "./vnode.ts";

// 0.53 이후는 빌드 구조가 바뀌어 workerMain.js가 없어요
const MONACO = "https://cdn.jsdelivr.net/npm/monaco-editor@0.52.2/min";
export const MONACO_TIMEOUT_MS = 10_000;

type Position = { lineNumber: number; column: number };
type ContentChange = {
  changes: { text: string }[];
  isUndoing: boolean;
  isRedoing: boolean;
  isFlush: boolean;
};
type MonacoEditor = {
  getValue(): string;
  setValue(value: string): void;
  getPosition(): Position | null;
  setPosition(position: Position): void;
  pushUndoStop(): boolean;
  getModel(): {
    getValueInRange(range: Record<string, number>): string;
  } | null;
  executeEdits(
    source: string,
    edits: { range: Record<string, number>; text: string }[],
  ): boolean;
  onDidChangeModelContent(listener: (event: ContentChange) => void): unknown;
};
type Monaco = {
  editor: {
    create(host: Element, options: Record<string, unknown>): MonacoEditor;
  };
};
type AmdRequire = {
  (
    deps: string[],
    ok: (monaco: Monaco) => void,
    fail: (error: unknown) => void,
  ): void;
  config(options: { paths: Record<string, string> }): void;
};
type PageWindow = { require?: unknown; MonacoEnvironment?: unknown };

export function startPage(doc: Document): void {
  const view = doc.defaultView as PageWindow | null;
  const amd = view?.require;
  if (!view || typeof amd !== "function") {
    start(doc);
    return;
  }
  view.MonacoEnvironment = { getWorkerUrl: monacoWorkerUrl };
  let started = false;
  const once = (editor?: () => Editor | undefined): void => {
    if (started) return;
    started = true;
    clearTimeout(timer);
    start(doc, editor?.());
  };
  // 느린 망에서 페이지가 멈추지 않게 기다리는 시간을 정해요
  const timer = setTimeout(() => once(), MONACO_TIMEOUT_MS);
  const load = amd as AmdRequire;
  load.config({ paths: { vs: `${MONACO}/vs` } });
  load(
    ["vs/editor/editor.main"],
    (monaco) => once(() => mountMonaco(doc, monaco)),
    () => once(),
  );
}

function mountMonaco(doc: Document, monaco: Monaco): Editor | undefined {
  const textarea = byId(doc, "editor", "TEXTAREA") as HTMLTextAreaElement;
  const host = byId(doc, "monaco", "DIV") as HTMLElement;
  let editor: MonacoEditor;
  try {
    editor = monaco.editor.create(host, {
      language: "html",
      ariaLabel: "테스트 영역",
      automaticLayout: true,
      minimap: { enabled: false },
      fontSize: 13,
      tabSize: 2,
      wordWrap: "on",
    });
  } catch {
    return undefined; // textarea로 계속해요
  }
  editor.onDidChangeModelContent((event) => autoClose(editor, event));
  textarea.hidden = true;
  host.hidden = false;
  return {
    get value() {
      return editor.getValue();
    },
    set value(next: string) {
      editor.setValue(next);
    },
  };
}

// Monaco는 HTML 닫는 태그를 자동으로 넣지 않아서 >를 칠 때 직접 넣어요
function autoClose(editor: MonacoEditor, event: ContentChange): void {
  if (event.isUndoing || event.isRedoing || event.isFlush) return;
  if (event.changes.length !== 1 || event.changes[0].text !== ">") return;
  const at = editor.getPosition();
  const model = editor.getModel();
  if (!at || !model) return;
  const before = model.getValueInRange({
    startLineNumber: 1,
    startColumn: 1,
    endLineNumber: at.lineNumber,
    endColumn: at.column,
  });
  const closing = closingTagFor(before);
  if (!closing) return;
  const here = {
    startLineNumber: at.lineNumber,
    startColumn: at.column,
    endLineNumber: at.lineNumber,
    endColumn: at.column,
  };
  // 되돌리기 한 번에 넣은 닫는 태그만 지워지게 직접 친 입력과 나눠요
  editor.pushUndoStop();
  editor.executeEdits("auto-close", [{ range: here, text: closing }]);
  editor.setPosition(at);
}

const VOID_TAGS = new Set([
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
]);

export function closingTagFor(before: string): string | null {
  const match = /<([a-zA-Z][\w-]*)(?:\s[^<>]*)?>$/.exec(before);
  if (!match || match[0].endsWith("/>")) return null;
  const tag = match[1].toLowerCase();
  return VOID_TAGS.has(tag) ? null : `</${tag}>`;
}

// 다른 출처의 워커 스크립트는 바로 못 띄워서 data: URL에서 importScripts해요
export function monacoWorkerUrl(): string {
  const code = `self.MonacoEnvironment={baseUrl:"${MONACO}/"};importScripts("${MONACO}/vs/base/worker/workerMain.js");`;
  return `data:text/javascript;charset=utf-8,${encodeURIComponent(code)}`;
}

export function start(doc: Document, custom?: Editor): void {
  const real = byId(doc, "real", "DIV");
  const textarea = byId(doc, "editor", "TEXTAREA") as HTMLTextAreaElement;
  const editor: Editor = custom ?? textarea;
  const patchButton = byId(doc, "patch", "BUTTON") as HTMLButtonElement;
  const back = byId(doc, "back", "BUTTON") as HTMLButtonElement;
  const forward = byId(doc, "forward", "BUTTON") as HTMLButtonElement;
  const mutations = byId(doc, "mutations", "OUTPUT");
  const error = byId(doc, "error", "P");
  const log = byId(doc, "log", "PRE");
  const cases = byId(doc, "cases", "NAV");
  const note = byId(doc, "case-note", "P");

  function updateButtons(): void {
    back.disabled = !canGo(-1);
    forward.disabled = !canGo(1);
  }

  function run(action: () => Patch[] | null): void {
    try {
      const { result, mutations: count } = countMutations(real, action);
      if (result) {
        error.textContent = "";
        log.textContent = formatLog(result);
        mutations.textContent = String(count);
      }
    } catch (e) {
      error.textContent = e instanceof Error ? e.message : String(e);
    }
    updateButtons();
  }

  function pick(item: Case): void {
    const current = sourceOf(history.stack[history.index]);
    if (
      item.before !== undefined &&
      current !== sourceOf(fromHTML(item.before))
    ) {
      editor.value = item.before;
      error.textContent = "";
      note.textContent = `${item.name} (1/2): 시작 상태예요. Patch한 뒤 같은 버튼을 다시 눌러요`;
      return;
    }
    const next = item.edit(editor.value, initial);
    const step = item.before === undefined ? "" : " (2/2)";
    note.textContent = `${item.name}${step}: ${item.expect}`;
    if (next === null) {
      error.textContent = `${item.name}: 적용할 곳이 없어요. 시나리오는 앞 단계를 Patch한 뒤에 눌러요`;
      return;
    }
    editor.value = next;
    error.textContent = "";
  }

  load(real, editor);
  const initial = editor.value;
  updateButtons();
  const groups = new Map<string, Element>();
  for (const item of CASES) {
    let row = groups.get(item.group);
    if (!row) {
      row = doc.createElement("div");
      row.className = "case-group";
      row.setAttribute("role", "group");
      row.setAttribute("aria-label", item.group);
      const title = doc.createElement("span");
      title.className = "case-group-title";
      title.textContent = item.group;
      row.appendChild(title);
      cases.appendChild(row);
      groups.set(item.group, row);
    }
    const button = doc.createElement("button");
    button.type = "button";
    button.textContent = item.name;
    button.title = item.expect;
    button.addEventListener("click", () => pick(item));
    row.appendChild(button);
  }
  patchButton.addEventListener("click", () => run(() => onPatch(real, editor)));
  back.addEventListener("click", () => run(() => go(real, editor, -1)));
  forward.addEventListener("click", () => run(() => go(real, editor, 1)));
}

// formatPatches([p])의 바깥 []를 떼어 Patch 하나를 한 줄로 보여 줘요
function formatLog(patches: Patch[]): string {
  if (patches.length === 0) return "변경 없음";
  return patches.map((p) => formatPatches([p]).slice(1, -1)).join("\n");
}

function byId(doc: Document, id: string, tag: string): Element {
  const el = doc.getElementById(id);
  if (!el || el.tagName !== tag) {
    throw new Error(`검증 페이지에 <${tag.toLowerCase()} id="${id}">가 없어요`);
  }
  return el;
}
