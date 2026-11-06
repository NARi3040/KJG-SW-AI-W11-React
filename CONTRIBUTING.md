# 협업 규칙

## 작업 흐름

1. 기능을 세부 이슈로 나눠요.
2. 이슈마다 `GitHub사용자명/이슈번호` 브랜치를 만들어요.
3. `docs/design/`에 설계 문서를 작성해요.
4. AI가 설계 문서를 바탕으로 구현해요.
5. 담당자가 결과를 검증하고 PR을 올려요.
6. 작성자를 제외한 1명 이상이 승인하면 `main`에 머지할 수 있어요.

과제 요구사항은 [PLANNING.md](docs/PLANNING.md)를 봐 주세요.

단계별 명령어는 [GitHub 가이드](docs/GITHUB_GUIDE.md)를 봐 주세요.

## 이슈

- 마일스톤은 기능 단위이고, 이슈는 세부 작업 단위로 작성해요. 이슈 간 부모-자식 연결(Sub-issue)은 쓰지 않아요.
- 이슈는 [작업](.github/ISSUE_TEMPLATE/task.yml), [버그](.github/ISSUE_TEMPLATE/bug.yml), [설정·문서 변경](.github/ISSUE_TEMPLATE/setting.yml) 템플릿으로 작성해요.
- 이슈에는 종류·영역 라벨을 하나씩 지정해요. Phase 라벨은 해당할 때 붙여요. 버그 템플릿에는 `bug` 라벨이 자동으로 붙어요.
- 설정·문서 변경 이슈에는 종류 라벨(`chore` 또는 `documentation`)만 지정해요. 영역 라벨과 마일스톤은 필요 없어요.
- 영역 라벨을 달면 이름이 같은 마일스톤이 자동으로 연결돼요. (예: `area: diff` → `diff`) 새 영역을 만들 때는 라벨과 마일스톤을 같은 이름으로 함께 만들어요.

### 라벨

**종류**

| 라벨 | 용도 | 커밋 타입 |
|---|---|---|
| `enhancement` | 새 기능 | `feat` |
| `bug` | 버그 수정 | `fix` |
| `documentation` | 문서 작성·수정 | `docs` |
| `test` | 테스트 추가·수정 | `test` |
| `refactor` | 동작 변경 없는 구조 개선 | `refactor` |
| `chore` | 빌드·설정 등 기타 작업 | `chore` |

`enhancement`, `bug`, `documentation`은 GitHub 기본 라벨을 그대로 써요.

**Phase**

| 라벨 | 범위 |
|---|---|
| `phase-1` | Virtual DOM, Diff, Patch |
| `phase-2` | Component, State, Hooks |

**영역**

| 라벨 | 범위 |
|---|---|
| `area: virtual-dom` | VNode 구조, DOM과 Virtual DOM 변환 |
| `area: diff` | Diff 알고리즘 |
| `area: patch` | Patch 객체 구조와 실제 DOM 반영 |
| `area: verify-page` | Phase 1 검증 페이지와 State History |
| `area: component` | FunctionComponent와 자식 컴포넌트 |
| `area: hooks` | `useState`, `useEffect`, `useMemo` |
| `area: test-page` | 최종 테스트 페이지 |

**공통 형식**

VNode 구조나 Patch 형식을 정하거나 바꾸는 이슈에는 위 라벨과 함께 `common-format`을 붙여요.

## 브랜치와 커밋

- 브랜치 이름: `GitHub사용자명/이슈번호` (예: `octocat/12`)
- 커밋 메시지: 한국어로 작성하고 Conventional Commits를 적용해요. 너무 상세하게 쓰지 않고 흐름을 알 수 있을 정도로 적어요. 제목은 50자 안팎을 권장해요.

```text
feat: VNode 생성 함수 추가
```

## PR과 리뷰

- 이슈를 해결하면 [PR 템플릿](.github/PULL_REQUEST_TEMPLATE.md)에 맞춰 PR을 올려요.
- 저장소 설정이나 문서만 바꾸는 PR은 [설정·문서 PR 템플릿](.github/PULL_REQUEST_TEMPLATE/setting.md)을 써요. PR 화면에는 템플릿 선택 메뉴가 없어서, 비교 주소 끝에 `?quick_pull=1&template=setting.md`를 붙여 열어요.
- PR이 올라오면 바로 리뷰해요.
- 작성자를 제외한 1명 이상이 승인하면 머지할 수 있어요. 머지는 Squash만 허용해요.
- Squash 머지에서는 PR 제목이 `main`의 커밋 제목이 될 수 있으므로, PR 제목도 커밋 메시지 형식으로 써요.

### 문서 리뷰

- 문서는 [문서 작성 원칙](docs/technical-writing-principles.md)에 맞춰 써요.
- `.md` 파일이 바뀐 PR은 Claude가 이 원칙으로 리뷰하고, `github-actions` 봇이 결과를 PR 리뷰로 남겨요. Draft PR은 Ready for review로 바꿀 때 리뷰해요.
- 바뀐 줄에 대한 의견은 인라인 코멘트로, 바뀌지 않은 줄에 대한 의견은 리뷰 본문에 모아요.
- 리뷰 방식은 [`.github/workflows/docs-review.yml`](.github/workflows/docs-review.yml)과 [`scripts/docs-review/`](scripts/docs-review/)에 있어요. 리뷰 지시는 `prompt.md`, 결과 형식은 `review-schema.json`에서 고쳐요.
- 리뷰는 PR을 열 때 한 번만 실행돼요. 수정 후 다시 받으려면 PR을 닫았다가 다시 열어요.
- Claude의 코멘트는 참고용이에요. 반영 여부는 작성자와 리뷰어가 정하고, 사람 1명의 승인은 그대로 필요해요.

## Discussions

- **Daily Scrum**: `Daily Scrum` 카테고리에 매일 각자 글을 하나씩 써요. 템플릿이 자동으로 채워져요.
- **Core Time**: `Core Time` 카테고리에 회의마다 글을 하나 만들고, 논의는 댓글로 남겨요. 끝나면 결정사항을 본문에 정리하고 반영할 이슈나 문서를 링크해요.

## `main` 브랜치 보호

- PR을 통해서만 머지하고, 승인 1명 이상을 요구해요.
- 관리자는 이 규칙을 우회할 수 있어요.
- CI(`check`)가 통과해야 머지할 수 있어요.

## CI

PR과 `main` push마다 GitHub Actions가 포맷 검사, 타입 검사, 빌드, 테스트를 실행해요. PR을 올리기 전에 로컬에서 같은 검사를 돌려요.

```bash
npm ci
npm run format        # Prettier로 코드 정리
npm run format:check
npm run typecheck
npm run build         # src를 dist의 JS로 변환
npm test
```

Prettier는 기본 설정을 쓰고, Markdown은 대상에서 제외해요.

테스트 파일은 `*.test.ts`로 작성하고 `node:test`를 사용해요. DOM이 필요한 테스트는 `jsdom`을 사용해요. `jsdom`은 테스트 전용이고 빌드 결과물에 들어가지 않아요.

상대 경로 import에는 `import { x } from "./a.ts"`처럼 `.ts` 확장자를 붙여요. 빠지면 타입 검사가 실패해요.

## AI 도구 공유 규칙

규칙은 [AGENTS.md](AGENTS.md)에 모아요. 저장소를 자동으로 읽지 않는 AI 도구에는 이 파일 내용을 직접 공유해요. `CLAUDE.md`는 Claude Code가 같은 규칙을 읽도록 `AGENTS.md`를 불러와요.

## 구현 언어

TypeScript를 사용해요.

## GitHub 초기 설정

저장소 관리자가 한 번만 실행해요. 브랜치 보호는 `.github/workflows/ci.yml`이 포함된 첫 커밋을 `main`에 push한 뒤에 설정해요. 라벨은 저장소에 이미 만들어져 있어요.

### `main` 브랜치 보호 설정

```bash
gh api -X PUT repos/NARi3040/KJG-SW-AI-W11-React/branches/main/protection --input - <<'JSON'
{
  "required_status_checks": { "strict": false, "contexts": ["check"] },
  "enforce_admins": false,
  "required_pull_request_reviews": { "required_approving_review_count": 1 },
  "restrictions": null
}
JSON
```

### Discussions 카테고리

Discussions 탭 → Categories 옆 연필 아이콘 → **New category**에서 아래 카테고리를 만들어요. API로는 만들 수 없어요. 템플릿은 slug가 `.github/DISCUSSION_TEMPLATE/`의 파일 이름과 같은 카테고리에만 적용돼요. slug는 이름에서 자동으로 만들어져요.

| 이름 | slug | 형식 |
|---|---|---|
| Daily Scrum | `daily-scrum` | Open-ended discussion |
| Core Time | `core-time` | Open-ended discussion |

### 문서 리뷰

Anthropic API 키를 저장소 시크릿으로 등록해요. 명령을 실행하면 키를 입력하라고 나와요. 리뷰는 Claude Code를 `claude -p`(Agent SDK CLI)로 실행하므로 프로모션 크레딧으로도 동작해요. `anthropics/claude-code-action`은 프로모션 크레딧이 적용되지 않아 쓰지 않아요.

```bash
gh secret set ANTHROPIC_API_KEY -R NARi3040/KJG-SW-AI-W11-React
```
