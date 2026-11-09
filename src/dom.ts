import {
  ARRAY_CHILDREN,
  COMPONENT,
  ELEMENT,
  TEXT,
  TEXT_CHILDREN,
  h,
} from "./vnode.ts";
import type { Props, PropValue, VNode } from "./vnode.ts";

const rawTextTags = new Set(["style", "xmp", "iframe", "noembed", "noframes"]);
const voidTags = new Set([
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

function readProps(el: Element): Props | null {
  const props: Props = Object.fromEntries(
    Array.from(el.attributes)
      .filter(({ name }) => name !== "key" && !name.startsWith("on"))
      .map(({ name, value }) => [name, value]),
  );
  if (Object.hasOwn(props, "data-key")) props.key = props["data-key"];
  return Object.keys(props).length === 0 ? null : props;
}

function readChildren(parent: ParentNode, keepWs: boolean): (VNode | string)[] {
  const children: (VNode | string)[] = [];
  let text = "";
  function flushText(): void {
    if (
      text !== "" &&
      (keepWs || !/^[ \t\n\f\r]*$/.test(text) || !/[\n\r]/.test(text))
    ) {
      children.push(text);
    }
    text = "";
  }
  for (const node of parent.childNodes) {
    if (node.nodeType === 3) {
      text += node.textContent;
    } else if (node.nodeType === 1) {
      const el = node as Element;
      if (el.tagName.toLowerCase() === "script") continue;
      flushText();
      children.push(toVNode(el, keepWs));
    }
  }
  flushText();
  return children;
}

function toVNode(el: Element, keepWs: boolean): VNode {
  const tag = el.tagName.toLowerCase();
  return h(
    tag,
    readProps(el),
    ...readChildren(el, keepWs || tag === "pre" || tag === "textarea"),
  );
}

export function readArea(parent: ParentNode): VNode {
  return h("div", { class: "vdom-root" }, ...readChildren(parent, false));
}

export function fromHTML(html: string): VNode {
  const template = document.createElement("template");
  template.innerHTML = html;
  return readArea(template.content);
}

function esc(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function openTag(v: VNode): string {
  let tag = `<${String(v.type)}`;
  for (const [key, value] of Object.entries(v.props ?? {})) {
    if (
      value == null ||
      value === false ||
      typeof value === "function" ||
      typeof value === "object"
    )
      continue;
    tag +=
      value === true || value === ""
        ? ` ${key}`
        : ` ${key}="${esc(String(value))}"`;
  }
  return tag + ">";
}

export function toHTML(v: VNode): string {
  if (v.flags & TEXT) return esc(String(v.children ?? ""));
  const tag = String(v.type);
  const opening = openTag(v);
  if (voidTags.has(tag)) return opening;
  let content =
    typeof v.children === "string"
      ? rawTextTags.has(tag)
        ? v.children
        : esc(v.children)
      : (v.children ?? []).map(toHTML).join("");
  // 파서가 pre/textarea 바로 뒤의 줄바꿈 하나를 버리므로 보충해요.
  if ((tag === "pre" || tag === "textarea") && content.startsWith("\n"))
    content = "\n" + content;
  return `${opening}${content}</${tag}>`;
}

function canIndent(v: VNode): boolean {
  return (
    v.type !== "pre" &&
    v.type !== "textarea" &&
    Array.isArray(v.children) &&
    v.children.every((child) => (child.flags & ELEMENT) !== 0)
  );
}

function toPrettyHTML(v: VNode, depth: number): string {
  const indent = "  ".repeat(depth);
  if (!canIndent(v) || !Array.isArray(v.children)) return indent + toHTML(v);
  const content = v.children
    .map((child) => toPrettyHTML(child, depth + 1))
    .join("\n");
  return `${indent}${openTag(v)}\n${content}\n${indent}</${String(v.type)}>`;
}

export function sourceOf(root: VNode): string {
  if (typeof root.children === "string") return esc(root.children);
  if (!root.children) return "";
  return canIndent(root)
    ? root.children.map((child) => toPrettyHTML(child, 0)).join("\n")
    : root.children.map(toHTML).join("");
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
  if (key.toLowerCase().startsWith("on")) return;

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
