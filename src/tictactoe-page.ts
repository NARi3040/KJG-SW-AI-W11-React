import { createRoot } from "./component.ts";
import { toHTML } from "./dom.ts";
import { App } from "./tictactoe.ts";
import type { Patch, PropValue } from "./vnode.ts";

const EMPTY =
  "칸을 누르면 그 렌더에서 실제 DOM에 반영한 Patch가 여기에 쌓여요.";

const show = (v: PropValue): string =>
  typeof v === "function" ? "ƒ" : JSON.stringify(v);

// 로그 한 줄의 [경로, 내용]
export function describePatch(p: Patch): [string, string] {
  switch (p.type) {
    case "CREATE":
      return [`[${p.parentPath}] #${p.index}`, toHTML(p.node)];
    case "REPLACE":
      return [`[${p.path}]`, toHTML(p.node)];
    case "REMOVE":
      return [`[${p.path}]`, ""];
    case "TEXT":
      return [`[${p.path}]`, JSON.stringify(p.value)];
    case "MOVE":
      return [`[${p.parentPath}]`, `${p.from} → ${p.to}`];
    case "PROPS":
      return [
        `[${p.path}]`,
        [
          ...Object.entries(p.set).map(([k, v]) => `${k}=${show(v)}`),
          ...p.remove.map((k) => `-${k}`),
        ].join("  "),
      ];
  }
}

export function startTicTacToe(doc: Document): void {
  const app = doc.getElementById("app");
  const log = doc.getElementById("log");
  const clear = doc.getElementById("clear");
  if (!app || !log || !clear) throw new Error("#app, #log, #clear가 필요해요");

  function el(tag: string, className: string, text = ""): HTMLElement {
    const node = doc.createElement(tag);
    node.className = className;
    node.textContent = text;
    return node;
  }

  const showEmpty = () => log.replaceChildren(el("li", "empty", EMPTY));

  let renders = 0;
  const record = (patches: Patch[]): void => {
    renders += 1;
    const head = el("div", "render-head");
    head.append(
      el("b", "", `렌더 #${renders}`),
      el("span", "", `Patch ${patches.length}개`),
    );
    const item = el("li", "render");
    item.append(head);
    for (const p of patches) {
      const [path, detail] = describePatch(p);
      const row = el("div", "patch");
      row.append(
        el("span", `badge ${p.type}`, p.type),
        el("span", "path", path),
        el("span", "detail", detail),
      );
      item.append(row);
    }
    if (log.querySelector(".empty")) log.replaceChildren();
    log.prepend(item);
  };

  showEmpty();
  clear.addEventListener("click", showEmpty);

  const root = createRoot(app, App);
  // setter가 root.update()를 부르므로, 인스턴스의 update를 감싸 반환한 Patch를 기록해요
  const update = root.update.bind(root);
  root.update = () => {
    const patches = update();
    record(patches);
    return patches;
  };
}
