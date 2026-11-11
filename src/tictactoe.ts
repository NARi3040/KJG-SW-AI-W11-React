import { useEffect, useMemo, useState } from "./hooks.ts";
import { h } from "./vnode.ts";

export type Cell = "X" | "O" | null;
export type Game = { history: Cell[][]; step: number };
export type Win = { player: "X" | "O"; line: number[] };

const LINES = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

export const initialGame: Game = { history: [Array(9).fill(null)], step: 0 };

export function winnerOf(board: Cell[]): Win | null {
  for (const line of LINES) {
    const [a, b, c] = line;
    const player = board[a];
    if (player && player === board[b] && player === board[c]) {
      return { player, line };
    }
  }
  return null;
}

export function turnOf(step: number): "X" | "O" {
  return step % 2 === 0 ? "X" : "O";
}

// 승리가 무승부보다 먼저예요. 9번째 수로 이기면 판이 꽉 차도 승리예요
export function statusOf(board: Cell[], step: number): string {
  const win = winnerOf(board);
  if (win) return `${win.player} 승리!`;
  if (board.every((cell) => cell !== null)) return "무승부";
  return `다음 차례: ${turnOf(step)}`;
}

// 둘 수 없는 칸이면 같은 객체를 돌려줘서 setState가 다시 그리지 않아요
export function play(game: Game, index: number): Game {
  const board = game.history[game.step];
  if (board[index] !== null || winnerOf(board)) return game;
  const next = board.slice();
  next[index] = turnOf(game.step);
  return {
    history: [...game.history.slice(0, game.step + 1), next],
    step: game.step + 1,
  };
}

export function jump(game: Game, step: number): Game {
  return game.step === step ? game : { ...game, step };
}

// 자식은 props만 받는 순수 함수예요. props가 같으면 지난 결과를 다시 써요
function Square(props: {
  value: Cell;
  index: number;
  win: boolean;
  over: boolean;
  onPlay: (index: number) => void;
}) {
  return h(
    "button",
    {
      type: "button",
      class: props.win ? "square win" : "square",
      // disabled 대신 써요. 눌러도 포커스가 남고, play가 같은 상태를 돌려줘 렌더가 없는 것을 보여 줘요
      "aria-disabled": props.value !== null || props.over ? "true" : null,
      "aria-label": `${props.index + 1}번 칸${props.value ? `, ${props.value}` : ""}${props.win ? ", 승리 줄" : ""}`,
      onClick: () => props.onPlay(props.index),
    },
    props.value ?? "",
  );
}

function Board(props: {
  board: Cell[];
  line: number[];
  over: boolean;
  onPlay: (index: number) => void;
}) {
  return h(
    "div",
    { class: "board" },
    props.board.map((value, index) =>
      h(Square, {
        value,
        index,
        win: props.line.includes(index),
        over: props.over,
        onPlay: props.onPlay,
      }),
    ),
  );
}

// 각 수를 "X → 2행 3열"처럼 적어요. 0번은 빈 판이에요
export function moveLabels(history: Cell[][]): string[] {
  return history.map((board, step) => {
    if (step === 0) return "게임 시작";
    const index = board.findIndex((cell, i) => cell !== history[step - 1][i]);
    return `${board[index]} → ${Math.floor(index / 3) + 1}행 ${(index % 3) + 1}열`;
  });
}

// 항목을 컴포넌트로 나눠야 props가 같은 항목은 캐시돼 핸들러 Patch가 나오지 않아요
function Move(props: {
  label: string;
  step: number;
  current: boolean;
  onJump: (step: number) => void;
}) {
  return h(
    "li",
    null,
    h(
      "button",
      {
        type: "button",
        class: props.current ? "move current" : "move",
        "aria-current": props.current ? "step" : null,
        onClick: () => props.onJump(props.step),
      },
      h("span", { class: "move-no" }, props.step),
      props.label,
    ),
  );
}

function Moves(props: {
  labels: string[];
  step: number;
  onJump: (step: number) => void;
}) {
  return h(
    "ol",
    { class: "moves" },
    props.labels.map((label, step) =>
      h(Move, {
        key: step,
        label,
        step,
        current: step === props.step,
        onJump: props.onJump,
      }),
    ),
  );
}

// Hook은 루트에서만 써요
export function App() {
  const [game, setGame] = useState(initialGame);
  // setGame이 고정이라 핸들러도 한 번만 만들어요. 그래서 Square의 props가 같게 유지돼요
  const onPlay = useMemo(
    () => (index: number) => setGame((g) => play(g, index)),
    [],
  );
  const onJump = useMemo(
    () => (step: number) => setGame((g) => jump(g, step)),
    [],
  );

  const board = game.history[game.step];
  // 수 기록으로 이동만 하면 history가 그대로라 다시 계산하지 않아요
  const labels = useMemo(() => moveLabels(game.history), [game.history]);
  const win = winnerOf(board);
  const status = statusOf(board, game.step);

  useEffect(() => {
    document.title = `틱택토 - ${status}`;
  }, [status]);

  return h(
    "main",
    { class: "game" },
    h("p", { class: "status", "aria-live": "polite" }, status),
    h(Board, {
      board,
      line: win ? win.line : [],
      over: win !== null,
      onPlay,
    }),
    h("h2", null, "수 기록"),
    h(Moves, { labels, step: game.step, onJump }),
  );
}
