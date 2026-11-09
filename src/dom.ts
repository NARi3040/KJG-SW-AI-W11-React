import { ARRAY_CHILDREN, COMPONENT, TEXT, TEXT_CHILDREN } from "./vnode.ts";
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

function setStyle(el: Element, next: PropValue): void {
  const style = (el as HTMLElement).style;
  if (typeof next === "string") {
    style.cssText = next;
  } else if (next !== null && typeof next === "object") {
    style.cssText = "";
    Object.assign(style, next);
  }
}

export function setProp(el: Element, key: string, next: PropValue): void {
  if (key.startsWith("on")) return;

  const off = next === null || next === undefined || next === false;
  if (key === "class") {
    if (off) el.removeAttribute(key);
    else el.className = String(next);
    return;
  }
  if (key === "style") {
    if (off) el.removeAttribute(key);
    else setStyle(el, next);
    return;
  }
  if (off) el.removeAttribute(key);
  else if (typeof next === "object") return;
  else el.setAttribute(key, next === true ? "" : String(next));

  if (key === "checked" && "checked" in el) el.checked = !off;
  if (key === "selected" && "selected" in el) el.selected = !off;
  if (
    key === "value" &&
    (el.tagName === "INPUT" ||
      el.tagName === "SELECT" ||
      el.tagName === "TEXTAREA")
  ) {
    (el as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement).value =
      off ? "" : String(next);
  }
}

export function applyProps(el: Element, props: Props): void {
  for (const key of Object.keys(props)) {
    if (key !== "value") setProp(el, key, props[key]);
  }
  if ("value" in props) setProp(el, "value", props.value);
}

export function createDOM(v: VNode): Node {
  if (v.flags & COMPONENT) {
    throw new Error("컴포넌트 VNode는 먼저 expand로 펼쳐야 해요");
  }
  if (v.flags & TEXT) return document.createTextNode(v.children as string);

  const el = document.createElement(v.type as string);
  if (v.flags & TEXT_CHILDREN) {
    el.textContent = v.children as string;
  } else if (v.flags & ARRAY_CHILDREN) {
    for (const child of v.children as VNode[]) el.appendChild(createDOM(child));
  }
  if (v.props !== null) applyProps(el, v.props);
  return el;
}

export function mountArea(container: Element, vnode: VNode): void {
  container.textContent = "";
  container.appendChild(createDOM(vnode));
}
