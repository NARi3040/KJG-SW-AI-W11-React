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
  throw new Error("미구현");
}

export function h(
  type: string | Component,
  props?: Props | null,
  ...children: Child[]
): VNode {
  throw new Error("미구현");
}
