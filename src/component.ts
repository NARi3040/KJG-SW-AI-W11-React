import type { Component, Patch, Props, VNode } from "./vnode.ts";

export type Memo = {
  type: Component;
  props: Props | null;
  children: VNode[] | string | null;
  result: VNode;
};

export function expand(
  v: VNode,
  prev?: Map<string, Memo>,
  next?: Map<string, Memo>,
): VNode {
  throw new Error("미구현");
}

export class FunctionComponent {
  static current: FunctionComponent | null = null;

  type: Component;
  props: Record<string, unknown> | null;
  container: Element;
  tree: VNode | null = null;
  hooks: unknown[] = [];
  hookIndex = 0;
  effects: Array<() => void> = [];
  flushing = false;
  memo: Map<string, Memo> = new Map();

  constructor(
    container: Element,
    type: Component,
    props: Record<string, unknown> | null = null,
  ) {
    throw new Error("미구현");
  }

  mount(): void {
    throw new Error("미구현");
  }

  update(): Patch[] {
    throw new Error("미구현");
  }
}

export function createRoot(
  container: Element,
  type: Component,
  props: Record<string, unknown> | null = null,
): FunctionComponent {
  throw new Error("미구현");
}
