import { diff } from "./diff.ts";
import { fromHTML, mountArea, readArea, sourceOf } from "./dom.ts";
import { applyPatches } from "./patch.ts";
import type { Patch, VNode } from "./vnode.ts";

export type Editor = { value: string };

export const history: { stack: VNode[]; index: number } = {
  stack: [],
  index: -1,
};

export function load(real: Element, editor: Editor): void {
  const v0 = readArea(real);
  mountArea(real, v0);
  editor.value = sourceOf(v0);
  history.stack = [v0];
  history.index = 0;
}

export function onPatch(real: Element, editor: Editor): Patch[] {
  const cur = currentVNode();
  const next = fromHTML(editor.value);
  const patches = diff(cur, next);

  applyOrRestore(real, cur, patches);
  pushHistory(next);
  editor.value = sourceOf(next);
  return patches;
}

export function canGo(delta: -1 | 1): boolean {
  const nextIndex = history.index + delta;
  return nextIndex >= 0 && nextIndex < history.stack.length;
}

export function go(
  real: Element,
  editor: Editor,
  delta: -1 | 1,
): Patch[] | null {
  if (!canGo(delta)) return null;

  const cur = currentVNode();
  const nextIndex = history.index + delta;
  const target = history.stack[nextIndex];
  const patches = diff(cur, target);

  applyOrRestore(real, cur, patches);
  editor.value = sourceOf(target);
  history.index = nextIndex;
  return patches;
}

export function countMutations<T>(
  target: Node,
  fn: () => T,
): { result: T; mutations: number } {
  const view = target.ownerDocument?.defaultView;
  if (!view) {
    throw new Error("countMutations: target이 문서에 연결되어 있지 않아요");
  }

  const observer = new view.MutationObserver(() => {});
  observer.observe(target, {
    childList: true,
    attributes: true,
    characterData: true,
    subtree: true,
  });

  try {
    const result = fn();
    return { result, mutations: observer.takeRecords().length };
  } finally {
    observer.disconnect();
  }
}

function applyOrRestore(real: Element, cur: VNode, patches: Patch[]): void {
  try {
    applyPatches(real, patches);
  } catch (error) {
    mountArea(real, cur);
    throw error;
  }
}

function pushHistory(next: VNode): void {
  history.stack.splice(history.index + 1);
  history.stack.push(next);
  history.index = history.stack.length - 1;
}

function currentVNode(): VNode {
  if (history.index < 0 || history.index >= history.stack.length) {
    throw new Error("load를 먼저 불러야 해요");
  }
  return history.stack[history.index];
}
