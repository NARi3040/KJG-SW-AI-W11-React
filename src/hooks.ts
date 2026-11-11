import { FunctionComponent } from "./component.ts";

export type SetState<T> = (next: T | ((prev: T) => T)) => void;

type StateSlot<T> = { value: T; set: SetState<T> };
type EffectSlot = {
  deps: readonly unknown[] | undefined;
  cleanup: (() => void) | undefined;
  run: (() => void) | undefined;
};
type MemoSlot<T> = { value: T; deps: readonly unknown[] | undefined };

function nextHook(): { root: FunctionComponent; index: number } {
  const root = FunctionComponent.current;
  if (root === null) {
    throw new Error("Hook은 컴포넌트를 렌더하는 중에만 부를 수 있어요");
  }
  return { root, index: root.hookIndex++ };
}

function depsChanged(
  prev: readonly unknown[] | undefined,
  next: readonly unknown[] | undefined,
): boolean {
  if (prev === undefined || next === undefined) return true;
  if (prev.length !== next.length) return true;
  return prev.some((value, i) => !Object.is(value, next[i]));
}

export function useState<T>(init: T | (() => T)): [T, SetState<T>] {
  const { root, index } = nextHook();
  let slot = root.hooks[index] as StateSlot<T> | undefined;
  if (slot === undefined) {
    const created: StateSlot<T> = {
      value: typeof init === "function" ? (init as () => T)() : init,
      set: (next) => {
        const value =
          typeof next === "function"
            ? (next as (prev: T) => T)(created.value)
            : next;
        if (Object.is(value, created.value)) return;
        created.value = value;
        root.update();
      },
    };
    root.hooks[index] = created;
    slot = created;
  }
  return [slot.value, slot.set];
}

export function useEffect(
  create: () => void | (() => void),
  deps?: readonly unknown[],
): void {
  const { root, index } = nextHook();
  let slot = root.hooks[index] as EffectSlot | undefined;
  if (slot === undefined) {
    slot = { deps: undefined, cleanup: undefined, run: undefined };
    root.hooks[index] = slot;
  } else if (!depsChanged(slot.deps, deps)) {
    return;
  }
  const effect = slot;
  const task = () => {
    if (effect.run !== task) return;
    effect.run = undefined;
    effect.cleanup?.();
    const result = create();
    effect.cleanup = typeof result === "function" ? result : undefined;
  };
  effect.run = task;
  effect.deps = deps;
  root.effects.push(task);
}

export function useMemo<T>(factory: () => T, deps?: readonly unknown[]): T {
  const { root, index } = nextHook();
  const slot = root.hooks[index] as MemoSlot<T> | undefined;
  if (slot !== undefined && !depsChanged(slot.deps, deps)) return slot.value;
  const value = factory();
  root.hooks[index] = { value, deps } satisfies MemoSlot<T>;
  return value;
}
