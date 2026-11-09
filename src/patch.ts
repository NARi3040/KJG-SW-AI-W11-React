import { applyProps, createDOM, setProp, toHTML } from "./dom.ts";
import type { Patch, Path, VNode } from "./vnode.ts";

type Target = { parent: Node | null; node: Node | null };

export function resolve(container: Node, path: Path): Node {
  let node = requireFirstChild(container, path);
  for (let depth = 0; depth < path.length; depth += 1) {
    node = requireChild(node, path, depth);
  }
  return node;
}

export function applyPatches(container: Node, patches: Patch[]): void {
  const targets = locateTargets(container, patches);
  applyStructure(patches, targets);
  applyInsertions(patches, targets);
  applyPropPatches(patches, targets);
}

export function formatPatches(patches: Patch[]): string {
  return JSON.stringify(patches, (key, value) => {
    if (typeof value === "function") return "ƒ";
    if (key === "node" && isVNode(value)) return toHTML(value);
    return value;
  });
}

function locateTargets(container: Node, patches: Patch[]): Target[] {
  return patches.map((patch) => locateTarget(container, patch));
}

function locateTarget(container: Node, patch: Patch): Target {
  if (patch.type === "CREATE") {
    return { parent: resolve(container, patch.parentPath), node: null };
  }

  if (patch.type === "MOVE") {
    const parent = resolve(container, patch.parentPath);
    const path = [...patch.parentPath, patch.from];
    return {
      parent,
      node: requireChild(parent, path, patch.parentPath.length),
    };
  }

  return { parent: null, node: resolve(container, patch.path) };
}

function applyStructure(patches: Patch[], targets: Target[]): void {
  for (let index = 0; index < patches.length; index += 1) {
    const patch = patches[index];
    const target = targets[index];

    if (patch.type === "REMOVE") {
      removeNode(target.node);
    } else if (patch.type === "REPLACE") {
      replaceNode(target.node, patch.node);
    } else if (patch.type === "TEXT") {
      setText(target.node, patch.value);
    } else if (patch.type === "MOVE") {
      detachNode(target.parent, target.node);
    }
  }
}

function applyInsertions(patches: Patch[], targets: Target[]): void {
  for (let index = 0; index < patches.length; index += 1) {
    const patch = patches[index];
    const target = targets[index];

    if (patch.type === "CREATE") {
      insertNode(target.parent, createDOM(patch.node), patch.index);
    } else if (patch.type === "MOVE") {
      insertNode(target.parent, target.node, patch.to);
    }
  }
}

function applyPropPatches(patches: Patch[], targets: Target[]): void {
  for (let index = 0; index < patches.length; index += 1) {
    const patch = patches[index];
    if (patch.type !== "PROPS") {
      continue;
    }

    const element = requireElement(targets[index].node);
    for (const key of patch.remove) {
      setProp(element, key, null);
    }
    applyProps(element, patch.set);
  }
}

function requireFirstChild(container: Node, path: Path): Node {
  const child = container.firstChild;
  if (child === null) {
    throw missingNodeError(path, 0);
  }
  return child;
}

function requireChild(parent: Node, path: Path, depth: number): Node {
  const index = path[depth];
  const child = parent.childNodes.item(index);
  if (child === null) {
    throw missingNodeError(path, depth, index);
  }
  return child;
}

function requireElement(node: Node | null): Element {
  if (node === null || node.nodeType !== 1) {
    throw new Error("PROPS 대상이 요소가 아니에요");
  }
  return node as Element;
}

function missingNodeError(path: Path, depth: number, index?: number): Error {
  const at =
    index === undefined
      ? `깊이 ${depth}에`
      : `깊이 ${depth}의 인덱스 ${index}에`;
  return new Error(`resolve([${path.join(", ")}]): ${at} 노드가 없어요`);
}

function removeNode(node: Node | null): void {
  if (node === null || node.parentNode === null) {
    throw new Error("REMOVE 대상이 없어요");
  }
  node.parentNode.removeChild(node);
}

function replaceNode(node: Node | null, vnode: VNode): void {
  if (node === null || node.parentNode === null) {
    throw new Error("REPLACE 대상이 없어요");
  }
  node.parentNode.replaceChild(createDOM(vnode), node);
}

function detachNode(parent: Node | null, node: Node | null): void {
  if (parent === null || node === null) {
    throw new Error("MOVE 대상이 없어요");
  }
  parent.removeChild(node);
}

function insertNode(
  parent: Node | null,
  node: Node | null,
  index: number,
): void {
  if (parent === null || node === null) {
    throw new Error("삽입 대상이 없어요");
  }
  parent.insertBefore(node, parent.childNodes.item(index));
}

function setText(node: Node | null, value: string): void {
  if (node === null) {
    throw new Error("TEXT 대상이 없어요");
  }

  node.textContent = value;
  if (isTextarea(node)) {
    node.value = value;
  }
}

function isTextarea(node: Node): node is HTMLTextAreaElement {
  return node.nodeType === 1 && (node as Element).tagName === "TEXTAREA";
}

function isVNode(value: unknown): value is VNode {
  return (
    typeof value === "object" &&
    value !== null &&
    "type" in value &&
    "props" in value &&
    "key" in value &&
    "children" in value &&
    "flags" in value
  );
}
