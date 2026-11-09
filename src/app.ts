import type { Patch, VNode } from "./vnode.ts";

export type Editor = { value: string };

export const history: { stack: VNode[]; index: number } = {
  stack: [],
  index: -1,
};

export function load(real: Element, editor: Editor): void {
  throw new Error("미구현");
}

export function onPatch(real: Element, editor: Editor): Patch[] {
  throw new Error("미구현");
}

export function canGo(delta: -1 | 1): boolean {
  throw new Error("미구현");
}

export function go(
  real: Element,
  editor: Editor,
  delta: -1 | 1,
): Patch[] | null {
  throw new Error("미구현");
}

export function countMutations<T>(
  target: Node,
  fn: () => T,
): { result: T; mutations: number } {
  throw new Error("미구현");
}
