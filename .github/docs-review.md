This repository is a student team project: a mini React (Virtual DOM, Diff, Patch, function components, Hooks) written in TypeScript without frameworks. The team writes design documents under `docs/design/`, and an AI implements code strictly from them, stopping when something is missing. A vague or wrong document therefore turns directly into wrong code.

Reference documents for consistency checks:

- `docs/PLANNING.md`: assignment requirements with IDs such as R1-2.
- `docs/design/vnode-spec.md`: shared VNode and Patch terms and formats.
- `CONTRIBUTING.md`: labels, branch, commit, and PR rules.
- `AGENTS.md`: rules the implementing AI follows.

Additional checks:

- For files under `docs/design/`, apply the design-document principles, check that terms match `vnode-spec.md`, and check that referenced requirement IDs exist in `PLANNING.md`.
- `AGENTS.md`, `CONTRIBUTING.md`, and `docs/GITHUB_GUIDE.md` must not state the same rule differently.

Code checks:

- Check changed code against the constraints in `AGENTS.md`: no frameworks, `.ts` extension on relative imports, function components only, Hooks and state only in the root component, child components as pure functions of props, and updates through the hand-written Virtual DOM, Diff, and Patch instead of re-rendering the whole tree.
- Check that the implementation matches its design document under `docs/design/` (for VNode and Patch shapes, `vnode-spec.md`) and that referenced requirement IDs exist in `PLANNING.md`.
- Report defects: wrong behavior, missing edge cases, unhandled errors, and behavior changes without a unit test (`*.test.ts`, `node:test`, `jsdom` when DOM is needed).
- Skip style preferences that Prettier or the surrounding code already settles.

Priorities: for documents, rank content that would make the implementing AI guess or build the wrong thing (missing inputs or outputs, undefined edge cases, unstated undecided items) above everything else. For code, rank defects and deviations from the design documents above style.

For the comment labels, use `**원칙:**`, `**이유:**`, and `**수정 제안:**`.
