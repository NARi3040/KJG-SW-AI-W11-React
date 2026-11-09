import { TEXT_TYPE } from "./vnode.ts";
import type { Key, Patch, Path, Props, VNode } from "./vnode.ts";

// 두 VNode 트리를 비교해 Patch 목록을 만들어요. 규칙은 docs/design/diff.md를 따라요.
// path는 배열 하나를 push/pop으로 재사용하고, Patch를 낼 때만 복사해요.
export function diff(oldV: VNode, newV: VNode): Patch[] {
  const out: Patch[] = [];
  diffNode(oldV, newV, [], out);
  return out;
}

// 최장 증가 부분수열의 인덱스를 오름차순으로 돌려줘요. 값 0(새 노드)은 건너뛰어요.
// tails[len]은 길이 len + 1인 증가수열 중 끝값이 가장 작은 원소의 인덱스예요.
// 끝값이 작을수록 뒤에 더 많은 원소를 이을 수 있어요.
export function lis(arr: number[]): number[] {
  const tails: number[] = [];
  const prev: number[] = new Array(arr.length);

  for (let i = 0; i < arr.length; i++) {
    const v = arr[i];
    if (v === 0) continue;

    // 끝값이 v 이상인 첫 자리를 이진 탐색해요.
    let lo = 0;
    let hi = tails.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (arr[tails[mid]] < v) lo = mid + 1;
      else hi = mid;
    }
    prev[i] = lo > 0 ? tails[lo - 1] : -1;
    tails[lo] = i;
  }

  // 마지막 원소부터 prev를 거꾸로 따라가 복원해요.
  const result: number[] = new Array(tails.length);
  let k = tails.length > 0 ? tails[tails.length - 1] : -1;
  for (let p = tails.length - 1; p >= 0; p--) {
    result[p] = k;
    k = prev[k];
  }
  return result;
}

// type과 key가 모두 같아야 같은 노드로 봐요. 다르면 REPLACE예요.
function isSame(a: VNode, b: VNode): boolean {
  return a.type === b.type && a.key === b.key;
}

// null과 undefined만 key 없음이에요. 0과 ""도 key예요.
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
    createRange(c2, common, c2.length, path, out);
  }
}

// key 비교의 4단계: 새 구간 [start, end)의 key → 새 인덱스 맵이에요.
// key 없는 노드는 넣지 않아요. 중복 key는 경고하고 먼저 나온 인덱스를 남겨요.
function keyIndexMap(
  c2: VNode[],
  start: number,
  end: number,
): Map<Key, number> {
  const map = new Map<Key, number>();
  for (let i = start; i < end; i++) {
    const key = c2[i].key;
    if (key == null) continue;
    if (map.has(key)) {
      console.warn(`diff: 같은 key가 여러 번 있어요: ${String(key)}`);
      continue;
    }
    map.set(key, i);
  }
  return map;
}

// 이전 노드 prev의 새 위치(절대 인덱스)를 찾아요.
// 없거나, 그 자리가 이미 찼거나, type이 다르면 undefined예요.
// key 없는 노드는 아직 짝이 없는 같은 type의 key 없는 새 노드를 앞에서부터 찾아요.
function findMatch(
  prev: VNode,
  c2: VNode[],
  start: number,
  end: number,
  keyToNew: Map<Key, number>,
  newToOld: number[],
): number | undefined {
  if (prev.key != null) {
    const j = keyToNew.get(prev.key);
    if (j === undefined) return undefined;
    if (newToOld[j - start] !== 0) return undefined;
    if (c2[j].type !== prev.type) return undefined;
    return j;
  }
  for (let j = start; j < end; j++) {
    if (newToOld[j - start] !== 0) continue;
    const next = c2[j];
    if (next.key == null && next.type === prev.type) return j;
  }
  return undefined;
}

// key 비교의 5단계예요. 새 인덱스 오름차순으로 MOVE, CREATE를 내요.
// newToOld[i]는 새 인덱스 start + i에 짝지은 "이전 인덱스 + 1"이고, 0이면 새 노드예요.
// LIS에 속한 노드는 그대로 두고 나머지만 옮겨요.
function emitPlacement(
  c2: VNode[],
  start: number,
  newToOld: number[],
  moved: boolean,
  path: Path,
  out: Patch[],
): void {
  const stable = moved ? lis(newToOld) : [];
  let k = 0;
  for (let i = 0; i < newToOld.length; i++) {
    const index = start + i;
    if (newToOld[i] === 0) {
      out.push({
        type: "CREATE",
        parentPath: path.slice(),
        index,
        node: c2[index],
      });
    } else if (moved) {
      if (k < stable.length && stable[k] === i) {
        k++;
      } else {
        out.push({
          type: "MOVE",
          parentPath: path.slice(),
          from: newToOld[i] - 1,
          to: index,
        });
      }
    }
  }
}

// key 비교예요(diff.md의 다섯 단계). 안쪽 비교의 경로는 항상 이전 인덱스예요.
function diffKeyed(c1: VNode[], c2: VNode[], path: Path, out: Patch[]): void {
  let i = 0;
  let e1 = c1.length - 1;
  let e2 = c2.length - 1;

  // 1. 앞 공통 구간
  while (i <= e1 && i <= e2 && isSame(c1[i], c2[i])) {
    path.push(i);
    diffNode(c1[i], c2[i], path, out);
    path.pop();
    i++;
  }

  // 2. 뒤 공통 구간
  while (i <= e1 && i <= e2 && isSame(c1[e1], c2[e2])) {
    path.push(e1);
    diffNode(c1[e1], c2[e2], path, out);
    path.pop();
    e1--;
    e2--;
  }

  // 3. 한쪽 소진
  if (i > e1) {
    createRange(c2, i, e2 + 1, path, out);
    return;
  }
  if (i > e2) {
    removeRange(i, e1 + 1, path, out);
    return;
  }

  // 4. 짝 찾기
  const start = i;
  const end = e2 + 1;
  const keyToNew = keyIndexMap(c2, start, end);
  const newToOld: number[] = new Array(end - start).fill(0);
  let patched = 0;
  let moved = false;
  let maxNewIndex = 0;

  for (let oi = i; oi <= e1; oi++) {
    // 새 구간이 모두 짝을 찾았으면 남은 이전 노드는 조회 없이 지워요.
    if (patched >= newToOld.length) {
      out.push({ type: "REMOVE", path: [...path, oi] });
      continue;
    }
    const prev = c1[oi];
    const j = findMatch(prev, c2, start, end, keyToNew, newToOld);
    if (j === undefined) {
      out.push({ type: "REMOVE", path: [...path, oi] });
      continue;
    }
    newToOld[j - start] = oi + 1;
    if (j >= maxNewIndex) maxNewIndex = j;
    else moved = true;
    path.push(oi);
    diffNode(prev, c2[j], path, out);
    path.pop();
    patched++;
  }

  // 5. 배치
  emitPlacement(c2, start, newToOld, moved, path, out);
}

// 자식 비교의 9가지 조합이에요(diff.md의 표).
// 배열끼리는 양쪽 모두 key가 없으면 위치 비교, 하나라도 있으면 key 비교예요.
function diffChildren(o: VNode, n: VNode, path: Path, out: Patch[]): void {
  const c1 = o.children;
  const c2 = n.children;

  if (Array.isArray(c1)) {
    if (Array.isArray(c2)) {
      if (hasKey(c1) || hasKey(c2)) diffKeyed(c1, c2, path, out);
      else diffUnkeyed(c1, c2, path, out);
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
    if (Array.isArray(c2)) createRange(c2, 0, c2.length, path, out);
    return;
  }

  // 이전 자식 없음
  if (typeof c2 === "string") {
    pushText(c2, path, out);
  } else if (Array.isArray(c2)) {
    createRange(c2, 0, c2.length, path, out);
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

// c2의 [start, end)를 새 인덱스 오름차순으로 CREATE해요.
function createRange(
  c2: VNode[],
  start: number,
  end: number,
  path: Path,
  out: Patch[],
): void {
  for (let i = start; i < end; i++) {
    out.push({
      type: "CREATE",
      parentPath: path.slice(),
      index: i,
      node: c2[i],
    });
  }
}
