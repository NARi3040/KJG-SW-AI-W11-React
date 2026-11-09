export const ELEMENT = 1;
export const TEXT = 2;
export const COMPONENT = 4;
export const TEXT_CHILDREN = 8;
export const ARRAY_CHILDREN = 16;
export const TEXT_TYPE = Symbol("text");

export type Listener = (event: Event) => void;
export type PropValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | Listener
  | Record<string, string>;
export type Props = Record<string, PropValue>;
export type Key = string | number;
// 자식 컴포넌트의 props 모양은 컴포넌트마다 달라서 any로 둬요
export type Component = (props: any) => VNode;

export interface VNode {
  type: string | Component | typeof TEXT_TYPE;
  props: Props | null;
  key: Key | null;
  children: VNode[] | string | null;
  flags: number;
}

export type Child =
  VNode | string | number | boolean | null | undefined | Child[];

export type Path = number[];

export type Patch =
  | { type: "CREATE"; parentPath: Path; index: number; node: VNode }
  | { type: "REMOVE"; path: Path }
  | { type: "REPLACE"; path: Path; node: VNode }
  | { type: "TEXT"; path: Path; value: string }
  | { type: "PROPS"; path: Path; set: Props; remove: string[] }
  | { type: "MOVE"; parentPath: Path; from: number; to: number };

export function createTextVNode(text: string | number): VNode {
  return {
    type: TEXT_TYPE,
    props: null,
    key: null,
    children: String(text),
    flags: TEXT,
  };
}

function normalizeChildren(raw: Child[]): {
  children: VNode[] | string | null;
  childFlag: number;
} {
  const normalized: (VNode | string)[] = [];

  function append(child: Child): void {
    if (Array.isArray(child)) {
      for (const nested of child) append(nested);
    } else if (child == null || typeof child === "boolean") {
      return;
    } else if (typeof child === "string" || typeof child === "number") {
      const lastIndex = normalized.length - 1;
      const previous = normalized[lastIndex];
      if (typeof previous === "string") {
        normalized[lastIndex] = previous + String(child);
      } else {
        normalized.push(String(child));
      }
    } else {
      normalized.push(child);
    }
  }

  for (const child of raw) append(child);

  if (normalized.length === 0) {
    return { children: null, childFlag: 0 };
  }
  if (normalized.length === 1 && typeof normalized[0] === "string") {
    return { children: normalized[0], childFlag: TEXT_CHILDREN };
  }
  return {
    children: normalized.map((child) =>
      typeof child === "string" ? createTextVNode(child) : child,
    ),
    childFlag: ARRAY_CHILDREN,
  };
}

function normalizeProps(
  props: Props | null,
  isElement: boolean,
): { props: Props | null; key: Key | null } {
  if (props === null) return { props: null, key: null };

  const { key, ...normalized } = props;
  if (isElement && !("class" in normalized) && "className" in normalized) {
    normalized.class = normalized.className;
    delete normalized.className;
  }
  return {
    props: Object.keys(normalized).length === 0 ? null : normalized,
    key: (key as Key | null | undefined) ?? null,
  };
}

export function h(
  type: string | Component,
  props?: Props | null,
  ...children: Child[]
): VNode {
  const isElement = typeof type === "string";
  const normalizedProps = normalizeProps(props ?? null, isElement);
  const normalizedChildren = normalizeChildren(children);
  return {
    type,
    props: normalizedProps.props,
    key: normalizedProps.key,
    children: normalizedChildren.children,
    flags: (isElement ? ELEMENT : COMPONENT) | normalizedChildren.childFlag,
  };
}
