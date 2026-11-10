import { canGo, countMutations, go, load, onPatch } from "./app.ts";
import { formatPatches } from "./patch.ts";
import type { Patch } from "./vnode.ts";

export function start(doc: Document): void {
  const real = byId(doc, "real", "DIV");
  const editor = byId(doc, "editor", "TEXTAREA") as HTMLTextAreaElement;
  const patchButton = byId(doc, "patch", "BUTTON") as HTMLButtonElement;
  const back = byId(doc, "back", "BUTTON") as HTMLButtonElement;
  const forward = byId(doc, "forward", "BUTTON") as HTMLButtonElement;
  const mutations = byId(doc, "mutations", "OUTPUT");
  const error = byId(doc, "error", "P");
  const log = byId(doc, "log", "PRE");

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

  load(real, editor);
  updateButtons();
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
