import { diff } from "./diff.ts";
import { listen, mountArea } from "./dom.ts";
import { applyPatches } from "./patch.ts";
import { COMPONENT } from "./vnode.ts";
import type { Component, Key, Patch, Props, VNode } from "./vnode.ts";

export type Memo = {
  type: Component;
  key: Key | null;
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
    if (prev && next) {
      const memo = prev.get(slot);
      if (
        memo &&
        memo.type === type &&
        Object.is(memo.key, v.key) &&
        Object.is(memo.children, v.children) &&
        sameProps(memo.props, v.props)
      ) {
        next.set(slot, memo);
        const inner = slot + ">";
        for (const [name, entry] of prev) {
          if (name.startsWith(inner)) next.set(name, entry);
        }
        return memo.result;
      }
    }
    const children = v.children ?? v.props?.children ?? null;
    const rendered = type({ ...v.props, children });
    const expanded = expandAt(rendered, slot + ">", prev, next);
    const result =
      v.key == null || expanded.key === v.key
        ? expanded
        : { ...expanded, key: v.key };
    next?.set(slot, {
      type,
      key: v.key,
      props: v.props,
      children: v.children,
      result,
    });
    return result;
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

function sameProps(a: Props | null, b: Props | null): boolean {
  if (a === null || b === null) return a === b;
  const keys = Object.keys(a);
  if (keys.length !== Object.keys(b).length) return false;
  return keys.every(
    (name) => Object.hasOwn(b, name) && Object.is(a[name], b[name]),
  );
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
    this.container = container;
    this.type = type;
    this.props = props;
  }

  renderTree(): VNode {
    const previous = FunctionComponent.current;
    this.hookIndex = 0;
    FunctionComponent.current = this;
    try {
      const rendered = this.type({ ...this.props });
      const next = new Map<string, Memo>();
      const tree = expand(rendered, this.memo, next);
      this.memo = next;
      return tree;
    } finally {
      FunctionComponent.current = previous;
    }
  }

  mount(): void {
    const tree = this.renderTree();
    listen(this.container);
    mountArea(this.container, tree);
    this.tree = tree;
    this.runEffects();
  }

  update(): Patch[] {
    if (this.tree === null) throw new Error("mount를 먼저 불러야 해요");
    const tree = this.renderTree();
    const patches = diff(this.tree, tree);
    applyPatches(this.container, patches);
    this.tree = tree;
    this.runEffects();
    return patches;
  }

  runEffects(): void {
    if (this.flushing) return;
    this.flushing = true;
    try {
      let task = this.effects.shift();
      while (task) {
        task();
        task = this.effects.shift();
      }
    } finally {
      this.flushing = false;
    }
  }
}

export function createRoot(
  container: Element,
  type: Component,
  props: Record<string, unknown> | null = null,
): FunctionComponent {
  const root = new FunctionComponent(container, type, props);
  root.mount();
  return root;
}
