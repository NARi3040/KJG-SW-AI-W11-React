import { COMPONENT } from "./vnode.ts";
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
  return expandAt(v, "", prev, next);
}

function expandAt(
  v: VNode,
  slot: string,
  prev?: Map<string, Memo>,
  next?: Map<string, Memo>,
): VNode {
  if (v.flags & COMPONENT) {
    const type = v.type as Component;
    const children = v.children ?? v.props?.children ?? null;
    const rendered = type({ ...v.props, children });
    const result = expandAt(rendered, slot + ">", prev, next);
    if (v.key == null || result.key === v.key) return result;
    return { ...result, key: v.key };
  }

  const children = v.children;
  if (!Array.isArray(children)) return v;

  let expanded: VNode[] | null = null;
  for (let i = 0; i < children.length; i++) {
    const child = children[i];
    const childSlot =
      child.key != null
        ? `${slot}/k${JSON.stringify(child.key)}`
        : `${slot}/${i}`;
    const out = expandAt(child, childSlot, prev, next);
    if (out !== child && expanded === null) expanded = children.slice(0, i);
    if (expanded !== null) expanded.push(out);
  }
  return expanded === null ? v : { ...v, children: expanded };
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
