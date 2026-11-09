import { TEXT_TYPE } from "./vnode.ts";
import type { Patch, Path, Props, VNode } from "./vnode.ts";

// 두 VNode 트리를 비교해 Patch 목록을 만들어요. 규칙은 docs/design/diff.md를 따라요.
// path는 배열 하나를 push/pop으로 재사용하고, Patch를 낼 때만 복사해요.
export function diff(oldV: VNode, newV: VNode): Patch[] {
  const out: Patch[] = [];
  diffNode(oldV, newV, [], out);
  return out;
}

export function lis(arr: number[]): number[] {
  throw new Error("미구현");
}

// type과 key가 모두 같아야 같은 노드로 봐요. 다르면 REPLACE예요.
function isSame(a: VNode, b: VNode): boolean {
  return a.type === b.type && a.key === b.key;
}

// null과 undefined만 key 없음이에요. 0과 ""도 key예요.
// 단계 5에서는 diffChildren이 아직 부르지 않아요. key 비교(단계 9, #39)에서 써요.
function hasKey(list: VNode[]): boolean {
  return list.some((v) => v.key != null);
}

// 새 props에서 !==로 다른 값은 set에, 이전에만 있는 이름은 remove에 넣어요.
// 둘 다 비면 null이에요.
function diffProps(
  oldP: Props | null,
  newP: Props | null,
): { set: Props; remove: string[] } | null {
  const set: Props = {};
  const remove: string[] = [];
  let changed = false;

  if (newP) {
    for (const name of Object.keys(newP)) {
      if (!oldP || !Object.hasOwn(oldP, name) || oldP[name] !== newP[name]) {
        set[name] = newP[name];
        changed = true;
      }
    }
  }
  if (oldP) {
    for (const name of Object.keys(oldP)) {
      if (!newP || !Object.hasOwn(newP, name)) {
        remove.push(name);
        changed = true;
      }
    }
  }
  return changed ? { set, remove } : null;
}

// 위치 비교: 같은 위치끼리 diffNode, 남는 쪽은 REMOVE(뒤 인덱스부터) 또는 CREATE.
// 한 부모 아래에 REMOVE와 CREATE가 함께 나오지 않아요.
function diffUnkeyed(c1: VNode[], c2: VNode[], path: Path, out: Patch[]): void {
  const common = Math.min(c1.length, c2.length);
  for (let i = 0; i < common; i++) {
    path.push(i);
    diffNode(c1[i], c2[i], path, out);
    path.pop();
  }
  if (c1.length > common) {
    removeRange(common, c1.length, path, out);
  } else {
    createRange(c2, common, path, out);
  }
}

// 자식 비교의 9가지 조합이에요(diff.md의 표).
// 단계 5에서는 배열끼리 항상 위치 비교를 해요.
function diffChildren(o: VNode, n: VNode, path: Path, out: Patch[]): void {
  const c1 = o.children;
  const c2 = n.children;

  if (Array.isArray(c1)) {
    if (Array.isArray(c2)) {
      diffUnkeyed(c1, c2, path, out);
      return;
    }
    // 배열 → 없음, 배열 → 텍스트: REMOVE를 TEXT보다 먼저 내요.
    removeRange(0, c1.length, path, out);
    if (typeof c2 === "string") pushText(c2, path, out);
    return;
  }

  if (typeof c1 === "string") {
    if (typeof c2 === "string") {
      if (c1 !== c2) pushText(c2, path, out);
      return;
    }
    // 텍스트 → 없음, 텍스트 → 배열: 이전 텍스트가 빈 문자열이면 TEXT("")를 내지 않아요.
    if (c1 !== "") pushText("", path, out);
    if (Array.isArray(c2)) createRange(c2, 0, path, out);
    return;
  }

  // 이전 자식 없음
  if (typeof c2 === "string") {
    pushText(c2, path, out);
  } else if (Array.isArray(c2)) {
    createRange(c2, 0, path, out);
  }
}

// 같은 객체 → 교체 → 텍스트 → 자식 → 속성 순서로 비교해요.
function diffNode(o: VNode, n: VNode, path: Path, out: Patch[]): void {
  // VNode는 불변이라 같은 객체면 서브트리 전체가 같아요.
  if (o === n) return;

  if (!isSame(o, n)) {
    out.push({ type: "REPLACE", path: path.slice(), node: n });
    return;
  }

  if (o.type === TEXT_TYPE) {
    const value = textOf(n);
    if (textOf(o) !== value) pushText(value, path, out);
    return;
  }

  // 자식의 Patch를 먼저 내고, 자기 PROPS를 나중에 내요.
  diffChildren(o, n, path, out);
  const props = diffProps(o.props, n.props);
  if (props) {
    out.push({
      type: "PROPS",
      path: path.slice(),
      set: props.set,
      remove: props.remove,
    });
  }
}

function textOf(v: VNode): string {
  return typeof v.children === "string" ? v.children : "";
}

function pushText(value: string, path: Path, out: Patch[]): void {
  out.push({ type: "TEXT", path: path.slice(), value });
}

// path 부모의 자식 [start, end)를 뒤 인덱스부터 REMOVE해요.
function removeRange(
  start: number,
  end: number,
  path: Path,
  out: Patch[],
): void {
  for (let i = end - 1; i >= start; i--) {
    out.push({ type: "REMOVE", path: [...path, i] });
  }
}

// c2의 start번부터 끝까지를 새 인덱스 오름차순으로 CREATE해요.
function createRange(
  c2: VNode[],
  start: number,
  path: Path,
  out: Patch[],
): void {
  for (let i = start; i < c2.length; i++) {
    out.push({
      type: "CREATE",
      parentPath: path.slice(),
      index: i,
      node: c2[i],
    });
  }
}
