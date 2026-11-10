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

### AI 리뷰

- 문서는 [문서 작성 원칙](docs/technical-writing-principles.md)에 맞춰 써요.
- 모든 PR은 Claude가 리뷰하고, 리뷰 봇(`giga-deepseek[bot]`)이 결과를 PR 리뷰로 남겨요. Draft PR은 Ready for review로 바꿀 때 리뷰해요.
- `.md` 파일이 바뀌면 문서 작성 원칙으로, 코드가 바뀌면 `AGENTS.md`의 구현 제약, `docs/design/` 설계 문서와의 일치, 버그와 엣지 케이스 누락, 테스트 없는 동작 변경을 봐요.
- 코드가 바뀐 PR은 CI가 끝나기를 최대 5분 기다리고, CI가 실패하면 로그 일부를 읽어서 이 PR 때문인지 판단해요.
- 코드와 CI 로그 일부도 Anthropic API로 전송돼요. CI 로그에 비밀 값을 출력하지 않아요.
- 의견마다 심각도(높음, 보통, 낮음)를 붙여요. 읽어서 확정하지 못한 의심은 인라인으로 달지 않고 리뷰 본문의 "확인이 필요한 의견"에 접어 둬요.
- 바뀐 줄에 대한 의견은 인라인 코멘트로, 바뀌지 않은 줄에 대한 의견은 리뷰 본문에 모아요.
- 리뷰는 [`NARi3040/docs-review`](https://github.com/NARi3040/docs-review) 액션으로 실행해요(비공개 저장소). 이 저장소에 맞춘 맥락과 추가 검사는 [`.github/docs-review.md`](.github/docs-review.md)에서, 실행 설정은 [`.github/workflows/docs-review.yml`](.github/workflows/docs-review.yml)과 멘션 답글용 [`.github/workflows/docs-review-reply.yml`](.github/workflows/docs-review-reply.yml)에서 고쳐요.
- PR을 열면 전체를 리뷰하고, push하면 마지막 리뷰 이후 바뀐 부분만 리뷰해요. 이전 리뷰의 스레드 중 이번 push로 반영된 것은 봇이 답글을 달고 닫아요.
- 전체를 다시 리뷰받으려면 PR에 `giga-deepseek` 라벨을 붙여요. 이미 붙어 있으면 뗐다가 다시 붙여요. PR 댓글에 `@giga-deepseek review`를 적어도 돼요.
- PR 댓글이나 리뷰 코멘트 답글에 `@giga-deepseek`와 질문을 적으면 봇이 답글을 달아요. 저장소 멤버의 댓글에만 답하고, 파일을 고치거나 스레드를 닫지는 않아요.
- 리뷰 코멘트 답글의 멘션은 PR 브랜치에 `.github/workflows/docs-review-reply.yml`이 있어야 동작해요. 이 파일이 `main`에 머지되기 전에 만든 브랜치는 `main`을 머지해요.
- 포크에서 온 PR은 리뷰하지 않고, 멘션에도 답하지 않아요.
- Claude의 코멘트는 참고용이에요. 반영 여부는 작성자와 리뷰어가 정하고, 사람 1명의 승인은 그대로 필요해요.

### CodeRabbit 리뷰

- 모든 PR은 [CodeRabbit](https://www.coderabbit.ai)이 한국어로 자동 리뷰해요. 코드와 `.md` 파일을 모두 봐요. Draft PR은 Ready for review로 바꿀 때 리뷰해요.
- 커밋을 push하면 바뀐 부분만 다시 리뷰해요. 커밋 5개를 리뷰하면 자동 리뷰가 멈추므로, 그 뒤에는 PR 코멘트에 `@coderabbitai review`를 남겨 직접 요청해요.
- 리뷰 기준은 `AGENTS.md`와 [`.coderabbit.yaml`](.coderabbit.yaml)이고, 문서는 [문서 작성 원칙](docs/technical-writing-principles.md)도 기준으로 봐요. 기준을 바꾸려면 이 파일들을 고쳐요.
- CodeRabbit의 코멘트도 참고용이에요. 사람 1명의 승인은 그대로 필요해요.

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

저장소 관리자가 한 번만 실행해요. 브랜치 보호는 `.github/workflows/ci.yml`이 포함된 첫 커밋을 `main`에 push한 뒤에 설정해요. `giga-deepseek` 라벨을 포함한 모든 라벨은 저장소에 이미 만들어져 있어요. 저장소를 새로 설정할 때 `giga-deepseek` 라벨은 아래 [AI 리뷰](#ai-리뷰-1)의 명령으로 만들어요.

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

### CodeRabbit

[CodeRabbit GitHub App](https://github.com/apps/coderabbitai)을 이 저장소에 설치해요. 공개 저장소라 무료예요. 설정은 저장소의 `.coderabbit.yaml`을 읽으므로 웹 대시보드에서 따로 바꿀 것은 없어요.

### AI 리뷰

Anthropic API 키를 저장소 시크릿으로 등록해요. 명령을 실행하면 키를 입력하라고 나와요. `NARi3040/docs-review` `v2.0.0-rc.4`는 Claude Code를 `claude -p`(Agent SDK CLI)로 실행해서 프로모션 크레딧으로도 동작해요.

```bash
gh secret set ANTHROPIC_API_KEY -R NARi3040/KJG-SW-AI-W11-React
```

리뷰 봇은 직접 만든 GitHub App(`giga-deepseek`)이에요. docs-review가 비공개 저장소라서, 앱 토큰으로 액션을 체크아웃하고 리뷰도 앱 이름으로 남겨요. 앱을 새로 만드는 절차는 [docs-review README](https://github.com/NARi3040/docs-review#봇-이름-바꾸기)에 있어요.

1. 앱의 Repository permissions를 **Contents: Read and write**, **Pull requests: Read and write**, **Checks: Read-only**, **Actions: Read-only**로 설정해요. 워크플로가 이 네 권한으로 토큰을 받아요. Contents 쓰기는 반영된 리뷰 스레드를 닫는 데만 쓰고, 이 저장소에 대한 토큰에만 줘요. `docs-review` 저장소는 읽기 토큰으로 체크아웃해요. 권한을 바꾸면 앱을 설치한 계정의 [Installed GitHub Apps](https://github.com/settings/installations)에서 Configure를 눌러 새 권한을 승인해야 적용돼요. 승인하기 전에는 토큰 발급이 실패해서 리뷰가 돌지 않을 수 있어요.
2. 앱을 **이 저장소와 `docs-review` 저장소 모두에** 설치해요.
3. private key 시크릿을 먼저 등록하고, 그다음 Client ID 변수를 등록해요. 워크플로는 Client ID 변수가 없으면 리뷰 작업을 건너뛰어요. 변수만 있고 시크릿이 없으면 작업이 실패해요.

```bash
gh secret set DOCS_REVIEW_APP_PRIVATE_KEY -R NARi3040/KJG-SW-AI-W11-React < 키파일.pem
gh variable set DOCS_REVIEW_APP_CLIENT_ID -R NARi3040/KJG-SW-AI-W11-React --body "Iv23..."
```

전체를 다시 리뷰받을 때 붙이는 `giga-deepseek` 라벨을 만들어요.

```bash
gh label create giga-deepseek -R NARi3040/KJG-SW-AI-W11-React -c 5319E7 -d "AI 리뷰를 처음부터 다시 받아요"
```
