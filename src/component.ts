import { COMPONENT } from "./vnode.ts";
import type { Component, Patch, Props, VNode } from "./vnode.ts";

export type Memo = {
  type: Component;
  props: Props | null;
  children: VNode[] | string | null;
  result: VNode;
};

// 컴포넌트 VNode를 실행해 요소 VNode만 남은 트리로 펼쳐요.
// 규칙은 docs/design/component-hooks.md의 expand를 따라요.
// prev, next는 결과 캐시(#71)에서 써요. 지금은 넘겨도 쓰지 않아요.
export function expand(
  v: VNode,
  prev?: Map<string, Memo>,
  next?: Map<string, Memo>,
): VNode {
  return expandAt(v, "", prev, next);
}

// slot은 트리 안의 자리 이름이에요. 결과 캐시가 이 이름으로 지난 결과를 찾아요.
// 루트는 "", 요소의 i번째 자식은 "부모/i", key가 있으면 "부모/k" + JSON.stringify(key),
// 컴포넌트의 결과는 "컴포넌트 slot>"예요.
function expandAt(
  v: VNode,
  slot: string,
  prev?: Map<string, Memo>,
  next?: Map<string, Memo>,
): VNode {
  if (v.flags & COMPONENT) {
    const type = v.type as Component;
    // key는 h가 props에서 꺼내 두었으므로 컴포넌트에 넘어가지 않아요.
    const rendered = type({ ...v.props, children: v.children });
    const result = expandAt(rendered, slot + ">", prev, next);
    // 컴포넌트의 key로 결과의 key를 덮어써요. 목록 재정렬 때 key 비교가 동작하고,
    // 두 컴포넌트가 같은 key의 요소를 돌려줘도 형제 key가 겹치지 않아요.
    if (v.key == null || result.key === v.key) return result;
    return { ...result, key: v.key };
  }

  const children = v.children;
  if (!Array.isArray(children)) return v;

  // 바뀐 자식이 있을 때만 새 배열을 만들어요. VNode는 불변이라 원래 것을 고치지 않아요.
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
  // 자식이 하나도 바뀌지 않으면 원래 VNode를 그대로 돌려줘요.
  // 그래야 diff가 o === n에서 바로 끝나요.
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
