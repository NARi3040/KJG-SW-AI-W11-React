import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { JSDOM } from "jsdom";
import { createRoot } from "./component.ts";
import { useEffect, useMemo, useState } from "./hooks.ts";
import type { SetState } from "./hooks.ts";
import { h } from "./vnode.ts";
import type { VNode } from "./vnode.ts";

function createContainer(): HTMLElement {
  globalThis.document = new JSDOM(
    '<!doctype html><html><body><div id="root"></div></body></html>',
  ).window.document;
  const container = document.getElementById("root");
  assert.ok(container);
  return container;
}

describe("Hook 호출 위치", () => {
  test("렌더 밖에서 Hook을 부르면 오류를 던져요", () => {
    const message = /Hook은 컴포넌트를 렌더하는 중에만 부를 수 있어요/;
    assert.throws(() => useState(0), message);
    assert.throws(() => useEffect(() => {}), message);
    assert.throws(() => useMemo(() => 1, []), message);
  });
});

describe("useState", () => {
  function counter(initial: number | (() => number)) {
    const container = createContainer();
    const state = {
      renders: 0,
      value: 0,
      setters: [] as SetState<number>[],
    };
    const App = () => {
      state.renders++;
      const [value, setValue] = useState(initial);
      state.value = value;
      state.setters.push(setValue);
      return h("p", null, value);
    };
    const root = createRoot(container, App);
    return { container, root, state, set: state.setters[0] };
  }

  test("set(1) 다음 줄에서 DOM이 이미 바뀌어 있어요", () => {
    const { container, set } = counter(0);

    set(1);

    assert.equal(container.textContent, "1");
  });

  test("같은 값으로 set하면 다시 그리지 않아요", () => {
    const { state, set } = counter(0);

    set(0);

    assert.equal(state.renders, 1);
  });

  test("함수형 업데이트가 같은 값을 돌려줘도 다시 그리지 않아요", () => {
    const { state, set } = counter(0);

    set((p) => p);

    assert.equal(state.renders, 1);
  });

  test("setter는 자기를 만든 루트만 다시 그려요", () => {
    globalThis.document = new JSDOM(
      '<!doctype html><html><body><div id="a"></div><div id="b"></div></body></html>',
    ).window.document;
    const containerA = document.getElementById("a");
    const containerB = document.getElementById("b");
    assert.ok(containerA && containerB);
    const renders = { a: 0, b: 0 };
    let setA: SetState<number> = () => {};
    createRoot(containerA, () => {
      renders.a++;
      const [value, set] = useState(0);
      setA = set;
      return h("p", null, value);
    });
    createRoot(containerB, () => {
      renders.b++;
      const [value] = useState(0);
      return h("p", null, value);
    });

    setA(1);

    assert.equal(containerA.textContent, "1");
    assert.equal(containerB.textContent, "0");
    assert.deepStrictEqual(renders, { a: 2, b: 1 });
  });

  test("set(c + 1) 3번은 렌더 1번, set((p) => p + 1) 3번은 렌더 3번이에요", () => {
    const { container, state, set } = counter(0);
    const c = state.value;

    set(c + 1);
    set(c + 1);
    set(c + 1);
    assert.equal(state.value, 1);
    assert.equal(state.renders, 2);

    set((p) => p + 1);
    set((p) => p + 1);
    set((p) => p + 1);
    assert.equal(state.value, 4);
    assert.equal(state.renders, 5);
    assert.equal(container.textContent, "4");
  });

  test("setter는 렌더마다 같은 함수예요", () => {
    const { root, state } = counter(0);

    root.update();

    assert.equal(state.setters.length, 2);
    assert.equal(state.setters[1], state.setters[0]);
  });

  test("함수 초깃값은 렌더 3번 동안 1번만 불려요", () => {
    let calls = 0;
    const { root, state } = counter(() => {
      calls++;
      return 7;
    });

    root.update();
    root.update();

    assert.equal(calls, 1);
    assert.equal(state.renders, 3);
    assert.equal(state.value, 7);
  });

  test("상태로 함수를 넣으려면 set(() => fn)처럼 감싸요", () => {
    const container = createContainer();
    const fn = () => "x";
    let current: unknown;
    let setFn: SetState<() => string> = () => {};
    createRoot(container, () => {
      const [value, set] = useState<() => string>(() => () => "처음");
      current = value;
      setFn = set;
      return h("p");
    });

    setFn(() => fn);

    assert.equal(current, fn);
  });

  test("배열을 직접 고치고 같은 참조로 set하면 다시 그리지 않아요", () => {
    const container = createContainer();
    let renders = 0;
    let items: string[] = [];
    let setItems: SetState<string[]> = () => {};
    createRoot(container, () => {
      renders++;
      [items, setItems] = useState<string[]>([]);
      return h("p", null, items.length);
    });

    items.push("a");
    setItems(items);
    assert.equal(renders, 1);

    setItems([...items]);
    assert.equal(renders, 2);
    assert.equal(container.textContent, "1");
  });

  test("Hook 여러 개는 호출 순서로 각자 칸을 가져요", () => {
    const container = createContainer();
    let setB: SetState<string> = () => {};
    createRoot(container, () => {
      const [a] = useState(1);
      const [b, set] = useState("b");
      setB = set;
      return h("p", null, a, b);
    });

    setB("B");

    assert.equal(container.textContent, "1B");
  });
});

describe("useEffect", () => {
  test("effect 안에서 읽은 DOM이 이미 새 값이에요", () => {
    const container = createContainer();
    const seen: (string | null)[] = [];
    let set: SetState<number> = () => {};
    createRoot(container, () => {
      const [value, setValue] = useState(0);
      set = setValue;
      useEffect(() => {
        seen.push(container.textContent);
      });
      return h("p", null, value);
    });

    set(1);

    assert.deepStrictEqual(seen, ["0", "1"]);
  });

  test("deps가 바뀌면 이전 cleanup을 부른 뒤 새 effect를 불러요", () => {
    const container = createContainer();
    const log: string[] = [];
    let set: SetState<number> = () => {};
    createRoot(container, () => {
      const [a, setA] = useState(0);
      set = setA;
      useEffect(() => {
        log.push(`effect ${a}`);
        return () => log.push(`cleanup ${a}`);
      }, [a]);
      return h("p");
    });

    set(1);

    assert.deepStrictEqual(log, ["effect 0", "cleanup 0", "effect 1"]);
  });

  test("deps 생략, [], [a]는 렌더 3번에 각각 3번, 1번, a가 바뀐 횟수 + 1번 실행해요", () => {
    const counts = { none: 0, empty: 0, a: 0 };
    let a = 0;
    const root = createRoot(createContainer(), () => {
      useEffect(() => {
        counts.none++;
      });
      useEffect(() => {
        counts.empty++;
      }, []);
      useEffect(() => {
        counts.a++;
      }, [a]);
      return h("p");
    });

    root.update();
    a = 1;
    root.update();

    assert.deepStrictEqual(counts, { none: 3, empty: 1, a: 2 });
  });

  test("deps는 Object.is로 비교해요: NaN은 같고 0과 -0은 달라요", () => {
    const counts = { nan: 0, zero: 0, length: 0 };
    let zero = 0;
    let list: number[] = [1];
    const root = createRoot(createContainer(), () => {
      useEffect(() => {
        counts.nan++;
      }, [NaN]);
      useEffect(() => {
        counts.zero++;
      }, [zero]);
      useEffect(() => {
        counts.length++;
      }, list);
      return h("p");
    });

    root.update();
    zero = -0;
    list = [1, 2];
    root.update();

    assert.deepStrictEqual(counts, { nan: 1, zero: 2, length: 2 });
  });

  test("effect 안에서 setState하면 다시 그린 뒤 DOM이 마지막 값이고 다른 effect도 한 번씩 실행돼요", () => {
    const container = createContainer();
    let other = 0;
    let renders = 0;
    createRoot(container, () => {
      renders++;
      const [value, setValue] = useState(0);
      useEffect(() => {
        if (value === 0) setValue(1);
      }, [value]);
      useEffect(() => {
        other++;
      }, []);
      return h("p", null, value);
    });

    assert.equal(container.textContent, "1");
    assert.equal(renders, 2);
    assert.equal(other, 1);
  });

  test("effect 재진입: 새 렌더의 effect만 1번 실행하고, cleanup은 마지막 effect가 돌려준 것을 불러요", () => {
    const log: string[] = [];
    let setRound: SetState<number> = () => {};
    createRoot(createContainer(), () => {
      const [n, setN] = useState(0);
      const [round, set] = useState(0);
      setRound = set;
      useEffect(() => {
        log.push(`A 시작 ${n}`);
        if (n === 0) setN(1);
        log.push(`A 끝 ${n}`);
        return () => log.push(`A cleanup ${n}`);
      }, [round]);
      useEffect(() => {
        log.push(`B ${n}`);
        return () => log.push(`B cleanup ${n}`);
      }, [n, round]);
      return h("p");
    });

    assert.deepStrictEqual(log, ["A 시작 0", "A 끝 0", "B 1"]);

    log.length = 0;
    setRound(1);

    assert.deepStrictEqual(log, [
      "A cleanup 0",
      "A 시작 1",
      "A 끝 1",
      "B cleanup 1",
      "B 1",
    ]);
  });

  test("deps가 바뀐 뒤 같은 deps로 다시 렌더하면 실행하지 않아요", () => {
    let calls = 0;
    let a = 0;
    const root = createRoot(createContainer(), () => {
      useEffect(() => {
        calls++;
      }, [a]);
      return h("p");
    });

    a = 1;
    root.update();
    root.update();

    assert.equal(calls, 2);
  });

  test("effect가 함수가 아닌 값을 돌려주면 cleanup을 비워요", () => {
    const log: string[] = [];
    let a = 0;
    const root = createRoot(createContainer(), () => {
      useEffect(() => {
        log.push(`effect ${a}`);
        if (a === 0) return () => log.push("cleanup 0");
      }, [a]);
      return h("p");
    });

    a = 1;
    root.update();
    a = 2;
    root.update();

    assert.deepStrictEqual(log, [
      "effect 0",
      "cleanup 0",
      "effect 1",
      "effect 2",
    ]);
  });
});

describe("useMemo", () => {
  test("deps가 같으면 factory를 다시 부르지 않고 같은 객체를 돌려줘요", () => {
    let calls = 0;
    let dep = 1;
    const values: object[] = [];
    const root = createRoot(createContainer(), () => {
      values.push(
        useMemo(() => {
          calls++;
          return { dep };
        }, [dep]),
      );
      return h("p");
    });

    root.update();
    assert.equal(calls, 1);
    assert.equal(values[1], values[0]);

    dep = 2;
    root.update();
    assert.equal(calls, 2);
    assert.deepStrictEqual(values[2], { dep: 2 });

    root.update();
    assert.equal(calls, 2);
    assert.equal(values[3], values[2]);
  });

  test("deps가 []면 첫 렌더에만 factory를 불러요", () => {
    let calls = 0;
    const root = createRoot(createContainer(), () => {
      useMemo(() => ++calls, []);
      return h("p");
    });

    root.update();
    root.update();

    assert.equal(calls, 1);
  });

  test("deps를 생략하면 매번 factory를 불러요", () => {
    let calls = 0;
    const root = createRoot(createContainer(), () => {
      useMemo(() => ++calls);
      return h("p");
    });

    root.update();
    root.update();

    assert.equal(calls, 3);
  });
});

describe("자식 컴포넌트에 setter 전달", () => {
  test("Counter의 버튼이 setCount(count + 1)을 부르면 DOM이 1이고 루트 렌더가 2번이에요", () => {
    const container = createContainer();
    let renders = 0;
    const Counter = (props: { count: number; setCount: SetState<number> }) =>
      h(
        "button",
        { onClick: () => props.setCount(props.count + 1) },
        props.count,
      );
    const App = (): VNode => {
      renders++;
      const [count, setCount] = useState(0);
      return h(Counter, { count, setCount });
    };

    createRoot(container, App);
    (container.querySelector("button") as HTMLElement).click();

    assert.equal(container.textContent, "1");
    assert.equal(renders, 2);
  });
});
