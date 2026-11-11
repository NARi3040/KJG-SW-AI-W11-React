export type SetState<T> = (next: T | ((prev: T) => T)) => void;

export function useState<T>(init: T | (() => T)): [T, SetState<T>] {
  throw new Error("미구현");
}

export function useEffect(
  create: () => void | (() => void),
  deps?: readonly unknown[],
): void {
  throw new Error("미구현");
}

export function useMemo<T>(factory: () => T, deps?: readonly unknown[]): T {
  throw new Error("미구현");
}
