import type { Props, PropValue, VNode } from "./vnode.ts";

export function readArea(parent: ParentNode): VNode {
  throw new Error("미구현");
}

export function fromHTML(html: string): VNode {
  throw new Error("미구현");
}

export function toHTML(v: VNode): string {
  throw new Error("미구현");
}

export function sourceOf(root: VNode): string {
  throw new Error("미구현");
}

export function setProp(el: Element, key: string, next: PropValue): void {
  throw new Error("미구현");
}

export function applyProps(el: Element, props: Props): void {
  throw new Error("미구현");
}

export function createDOM(v: VNode): Node {
  throw new Error("미구현");
}

export function mountArea(container: Element, vnode: VNode): void {
  throw new Error("미구현");
}
