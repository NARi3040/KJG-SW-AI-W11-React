import type { Patch, Path } from "./vnode.ts";

export function resolve(container: Node, path: Path): Node {
  throw new Error("미구현");
}

export function applyPatches(container: Node, patches: Patch[]): void {
  throw new Error("미구현");
}

export function formatPatches(patches: Patch[]): string {
  throw new Error("미구현");
}
