import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { JSDOM } from "jsdom";
import { describePatch, startTicTacToe } from "./tictactoe-page.ts";
import {
  initialGame,
  jump,
  moveLabels,
  play,
  statusOf,
  turnOf,
  winnerOf,
} from "./tictactoe.ts";
import type { Cell } from "./tictactoe.ts";

const X = "X",
  O = "O",
  _ = null;

describe("winnerOf", () => {
  it("빈 판은 승자가 없다", () => {
    assert.equal(winnerOf(Array(9).fill(null)), null);
  });

  it("가로, 세로, 대각선 줄을 찾는다", () => {
    assert.deepEqual(winnerOf([X, X, X, O, O, _, _, _, _]), {
      player: "X",
      line: [0, 1, 2],
    });
    assert.deepEqual(winnerOf([O, X, _, O, X, _, O, _, _]), {
      player: "O",
      line: [0, 3, 6],
    });
    assert.deepEqual(winnerOf([_, _, X, _, X, _, X, O, O]), {
      player: "X",
      line: [2, 4, 6],
    });
  });

  it("가운데·아래 가로줄, 왼쪽 위 대각선과 O의 승리도 찾는다", () => {
    assert.deepEqual(winnerOf([_, _, _, O, O, O, X, X, _])?.line, [3, 4, 5]);
    assert.deepEqual(winnerOf([_, _, _, O, O, _, X, X, X])?.line, [6, 7, 8]);
    assert.deepEqual(winnerOf([X, O, _, _, X, O, _, _, X])?.line, [0, 4, 8]);
    assert.equal(winnerOf([_, _, _, O, O, O, X, X, _])?.player, "O");
  });

  it("꽉 찬 무승부 판은 승자가 없다", () => {
    const board: Cell[] = [X, O, X, X, O, O, O, X, X];
    assert.equal(winnerOf(board), null);
  });
});

describe("play", () => {
  it("X부터 번갈아 두고 기록을 쌓는다", () => {
    const g = play(play(initialGame, 4), 0);
    assert.equal(g.step, 2);
    assert.deepEqual(g.history[2], [O, _, _, _, X, _, _, _, _]);
    assert.equal(g.history.length, 3);
  });

  it("이미 둔 칸이나 끝난 판이면 같은 객체를 돌려준다", () => {
    const g = play(initialGame, 4);
    assert.equal(play(g, 4), g);

    let won = initialGame;
    for (const i of [0, 3, 1, 4, 2]) won = play(won, i);
    assert.equal(winnerOf(won.history[won.step])?.player, "X");
    assert.equal(play(won, 8), won);
  });

  it("되돌린 시점에서 두면 그 뒤 기록을 버린다", () => {
    const g = play(play(play(initialGame, 0), 1), 2);
    const branched = play(jump(g, 1), 8);
    assert.equal(branched.step, 2);
    assert.equal(branched.history.length, 3);
    assert.deepEqual(branched.history[2], [X, _, _, _, _, _, _, _, O]);
  });

  it("원래 기록을 바꾸지 않는다", () => {
    const g = play(initialGame, 0);
    play(g, 1);
    assert.deepEqual(g.history[1], [X, _, _, _, _, _, _, _, _]);
    assert.equal(initialGame.history.length, 1);
  });
});

describe("jump", () => {
  it("같은 step이면 같은 객체, 다르면 step만 바꾼다", () => {
    const g = play(initialGame, 0);
    assert.equal(jump(g, 1), g);
    const back = jump(g, 0);
    assert.equal(back.step, 0);
    assert.equal(back.history, g.history);
  });
});

describe("moveLabels", () => {
  it("각 수를 둔 사람과 행·열로 적는다", () => {
    const g = play(play(initialGame, 4), 2);
    assert.deepEqual(moveLabels(g.history), [
      "게임 시작",
      "X → 2행 2열",
      "O → 1행 3열",
    ]);
  });
});

describe("statusOf, turnOf", () => {
  it("짝수 step은 X, 홀수 step은 O 차례다", () => {
    assert.equal(turnOf(0), "X");
    assert.equal(turnOf(3), "O");
    assert.equal(statusOf(Array(9).fill(null), 0), "다음 차례: X");
  });

  it("9번째 수로 이기면 판이 꽉 차도 승리, 승자 없이 꽉 차면 무승부", () => {
    assert.equal(statusOf([X, O, X, O, X, O, O, X, X], 9), "X 승리!");
    assert.equal(statusOf([X, O, X, X, O, O, O, X, X], 9), "무승부");
  });
});

describe("moveLabels 되돌린 뒤", () => {
  it("되돌린 시점에서 새로 둔 수로 적는다", () => {
    const g = play(jump(play(play(initialGame, 0), 1), 1), 8);
    assert.deepEqual(moveLabels(g.history), [
      "게임 시작",
      "X → 1행 1열",
      "O → 3행 3열",
    ]);
  });
});

describe("describePatch", () => {
  it("종류마다 경로와 내용을 적는다", () => {
    assert.deepEqual(
      describePatch({ type: "TEXT", path: [1, 4], value: "X" }),
      ["[1,4]", '"X"'],
    );
    assert.deepEqual(
      describePatch({
        type: "PROPS",
        path: [0],
        set: { class: "a", onClick: () => {} },
        remove: ["title"],
      }),
      ["[0]", 'class="a"  onClick=ƒ  -title'],
    );
    assert.deepEqual(
      describePatch({ type: "MOVE", parentPath: [2], from: 3, to: 0 }),
      ["[2]", "3 → 0"],
    );
    assert.deepEqual(describePatch({ type: "REMOVE", path: [2, 1] }), [
      "[2,1]",
      "",
    ]);
  });
});

describe("틱택토 페이지", () => {
  function start() {
    globalThis.document = new JSDOM(
      '<!doctype html><html><body><div id="app"></div><button id="clear"></button><ol id="log"></ol></body></html>',
    ).window.document;
    startTicTacToe(document);
    const squares = () => [...document.querySelectorAll(".square")];
    const renders = () => document.querySelectorAll("#log .render");
    return { squares, renders };
  }

  it("칸 하나를 두면 그 칸, 상태, 수 기록에 대한 Patch만 나오고 다른 칸은 같은 DOM 노드다", () => {
    const { squares, renders } = start();
    const before = squares();
    (before[4] as HTMLElement).click();

    const after = squares();
    assert.equal(after[4].textContent, "X");
    after.forEach((node, i) => assert.equal(node, before[i]));
    assert.equal(
      document.querySelector(".status")?.textContent,
      "다음 차례: O",
    );
    assert.equal(document.title, "틱택토 - 다음 차례: O");

    const paths = [...renders()[0].querySelectorAll(".patch")].map(
      (row) => row.textContent,
    );
    assert.deepEqual(paths, [
      'TEXT[0]"다음 차례: O"',
      'TEXT[1,4]"X"',
      'PROPS[1,4]aria-disabled="true"  aria-label="5번 칸, X"  onClick=ƒ',
      'PROPS[3,0,0]class="move"  aria-current=null  onClick=ƒ',
      'CREATE[3] #1<li><button type="button" class="move current" aria-current="step"><span class="move-no">1</span>X → 2행 2열</button></li>',
    ]);
  });

  it("이미 둔 칸을 누르면 다시 그리지 않는다", () => {
    const { squares, renders } = start();
    (squares()[4] as HTMLElement).click();
    (squares()[4] as HTMLElement).click();
    assert.equal(renders().length, 1);
  });

  it("되돌린 뒤 두면 뒤 기록을 버린다", () => {
    const { squares } = start();
    for (const i of [0, 1, 2]) (squares()[i] as HTMLElement).click();
    (document.querySelectorAll(".move")[1] as HTMLElement).click();
    assert.deepEqual(
      squares().map((s) => s.textContent),
      ["X", "", "", "", "", "", "", "", ""],
    );
    (squares()[8] as HTMLElement).click();
    assert.equal(document.querySelectorAll(".move").length, 3);
    assert.equal(squares()[8].textContent, "O");
  });
});
