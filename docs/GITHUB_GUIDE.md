# 깃허브 처음이어도 되는 가이드

> 깃허브를 처음 쓰는 팀원을 위해 **우리 프로젝트에서 실제로 하게 될 일만** 순서대로 정리했어요.
> 규칙 전체는 [CONTRIBUTING.md](../CONTRIBUTING.md)를 봐 주세요.

## 0. 최초 1회 준비

Node.js 26이 필요해요.

```bash
# 1) git 설치 확인 (버전이 나오면 OK)
git --version

# 2) 내 정보 등록 (커밋에 찍히는 이름/이메일)
git config --global user.name "내이름"
git config --global user.email "깃허브가입이메일"

# 3) 프로젝트 내려받기
git clone https://github.com/NARi3040/KJG-SW-AI-W11-React.git
cd KJG-SW-AI-W11-React

# 4) 의존성 설치 후 검사 실행
npm ci
npm run format:check
npm run typecheck
npm run build
npm test
```

## 1. 우리 팀의 한 사이클

```text
이슈 만들기 → 브랜치 만들기 → 설계 → AI 구현 → 검증 → 커밋 → 푸시 → PR → 리뷰 받기 → 머지
```

### ① 이슈 만들기

1. 저장소 **Issues** 탭 → **New issue** → **작업 이슈** 또는 **버그 제보** 템플릿을 골라요. 저장소 설정이나 문서를 바꿀 때는 **설정·문서 변경** 템플릿을 골라요.
2. 오른쪽 메뉴에서 **Assignees**에 나를 넣고, **Labels**에서 종류·영역 라벨을 골라요. 마일스톤은 영역 라벨에 맞춰 자동으로 연결돼요. 설정·문서 변경 이슈에는 종류 라벨만 골라요. 라벨 기준은 [CONTRIBUTING.md](../CONTRIBUTING.md#라벨)에 있어요.
3. 만들어진 이슈 번호를 기억해요. (예: `#12`)

### ② 브랜치 만들기

`main`에서 직접 작업하지 않아요. 항상 최신 `main`에서 새 브랜치를 만들어요. 이름은 `GitHub사용자명/이슈번호` 형식이에요. 아래 예시의 `octocat`을 내 GitHub 사용자명으로 바꿔 써요.

```bash
git switch main
git pull origin main
git switch -c octocat/12
```

### ③ 설계 → AI 구현 → 검증 → 커밋

`docs/design/`에 설계 문서를 쓰고 AI로 구현한 뒤, 결과를 직접 검증해요. 작업 단위가 하나 끝날 때마다 커밋해요.

```bash
git status                 # 뭐가 바뀌었는지 확인
git add src/index.ts       # 커밋할 파일 지정
git commit -m "feat: VNode 생성 함수 추가"
```

커밋 메시지는 `타입: 한 일 요약` 형식으로 한국어로 써요. 타입은 `feat` `fix` `docs` `test` `refactor` `chore` 중 하나예요.

### ④ 푸시

푸시 전에 코드를 정리하고 CI와 같은 검사를 돌려요. `npm run format`으로 파일이 바뀌면 커밋에 포함해요.

```bash
npm run format
npm run format:check
npm run typecheck
npm run build
npm test
git push -u origin octocat/12
```

`-u`는 브랜치의 첫 푸시에만 붙여요. 그다음부터는 `git push`만 쓰면 돼요.

### ⑤ PR 만들기

1. 저장소 상단의 **Compare & pull request**를 눌러요.
   (안 뜨면: **Pull requests** 탭 → **New pull request** → `main ← 내 브랜치`)
2. 제목은 커밋 메시지와 같은 형식으로 써요. (예: `feat: VNode 생성 함수 추가`)
3. 자동으로 뜨는 템플릿을 채우고 **`closes #12`** 를 남겨요. 머지되면 이슈가 자동으로 닫혀요.
4. 오른쪽 **Reviewers**에서 리뷰어를 지정해요.

저장소 설정이나 문서만 바꾸는 PR은 아래 주소로 열면 설정·문서 템플릿이 채워져요. `octocat/12`는 내 브랜치로 바꿔 써요.

```text
https://github.com/NARi3040/KJG-SW-AI-W11-React/compare/main...octocat/12?quick_pull=1&template=setting.md
```

### ⑥ CI와 리뷰

- PR 아래쪽에서 `check`가 통과했는지 봐요. 실패하면 **Details**로 로그를 확인해요.
- `.md` 파일을 바꿨다면 Claude가 [문서 작성 원칙](technical-writing-principles.md)으로 리뷰하고, 리뷰 봇(`giga-deepseek[bot]`)이 결과를 PR 리뷰로 남겨요. 인라인 코멘트와 리뷰 본문을 모두 확인하고 고칠지 정해요. Claude 리뷰를 다시 받으려면 PR을 닫았다가 다시 열어요.
- CodeRabbit(`coderabbitai[bot]`)이 모든 PR에 요약과 리뷰 코멘트를 남겨요. 코멘트에 답글로 질문할 수 있고, `@coderabbitai review`로 다시 리뷰를 요청할 수 있어요.
- 수정은 같은 브랜치에 커밋하고 `git push`하면 PR에 자동으로 쌓여요.
- 리뷰 반영이 끝나면 **Re-request review**를 눌러요.

### ⑦ 머지

- `check`가 통과하고 작성자를 제외한 1명 이상이 승인하면 머지 버튼이 활성화돼요.
- **Squash and merge**로 머지해요.
- 머지하면 GitHub의 브랜치는 자동으로 삭제돼요. 내 컴퓨터의 브랜치는 PR이 **Merged**인지 확인한 뒤 지워요. Squash 머지는 커밋이 하나로 합쳐져 `-d`로는 지워지지 않으므로 `-D`를 써요.

```bash
git switch main
git pull origin main
git branch -D octocat/12
```

### 매일 할 일

- 저장소 **Discussions** 탭 → **New discussion** → **Daily Scrum** 카테고리를 골라 스크럼을 써요.
- 회의할 때는 **Core Time** 카테고리에 글을 만들고, 끝나면 결정사항을 본문에 정리해요.

## 2. 자주 겪는 문제

| 증상 | 해결 |
|---|---|
| `main`에서 수정했어요 (커밋 전) | `git switch -c octocat/12` — 수정 내용이 새 브랜치로 그대로 따라와요 |
| `main`에서 커밋까지 했어요 (푸시 전) | `git switch -c octocat/12` → `git switch main` → `git reset --hard origin/main` — 커밋은 새 브랜치에 남아요 |
| `main` 푸시가 `protected branch`로 거부돼요 | 위 방법으로 커밋을 브랜치로 옮기고 PR을 만들어요 |
| 내 브랜치 푸시가 `rejected`로 거부돼요 | 다른 곳에서 먼저 푸시한 상태예요. `git pull --rebase origin 내브랜치` 후 다시 푸시해요 |
| 최신 `main`을 내 브랜치로 가져오고 싶어요 | `git pull --no-rebase origin main` |
| PR에 충돌(conflict)이 표시돼요 | 내 브랜치에서 `git pull --no-rebase origin main` → 충돌 파일에서 `<<<<<<<`, `=======`, `>>>>>>>` 표시를 정리 → `git add 파일` → `git commit` → `git push` |
| 커밋 메시지를 잘못 썼어요 (푸시 전) | `git commit --amend -m "고친 메시지"` |
| CI의 `check`가 실패해요 | **Details**에서 실패한 단계를 찾아 로컬에서 같은 명령(`npm run format:check`, `npm run typecheck`, `npm run build`, `npm test`)으로 재현한 뒤 고쳐요. 포맷 오류는 `npm run format`으로 고치고 커밋해요 |

## 3. 하지 말아야 할 것

- `main`에 직접 푸시하기
- 팀에 공유하지 않고 `git push --force` 하기
- PR 하나에 여러 이슈의 작업을 섞기
- 키, 비밀번호 같은 비밀 정보를 커밋하기 (올라갔다면 바로 팀에 공유해요)

## 4. 용어 사전

| 용어 | 뜻 |
|---|---|
| 저장소(repo) | 프로젝트 코드가 있는 깃허브 공간 |
| 브랜치 | 작업 공간을 분리한 코드 흐름 |
| 커밋 | 되돌아올 수 있는 저장 지점 |
| 푸시 / 풀 | 내 커밋을 깃허브에 올리기 / 깃허브의 커밋을 받아오기 |
| PR | 내 브랜치를 `main`에 합쳐 달라는 요청이자 리뷰하는 곳 |
| 머지 | PR을 `main`에 합치는 것 |
| 이슈 | 할 일 티켓. 브랜치, PR과 번호로 연결돼요 |
| 라벨 | 이슈의 종류와 영역을 나타내는 표시 |
| 마일스톤 | 같은 기능에 속한 이슈 묶음 |
| CI | PR마다 타입 검사와 테스트를 자동으로 실행하는 기능 |
| 충돌(conflict) | 같은 줄을 두 명이 고쳐서 git이 결정하지 못한 상태. 사람이 골라야 해요 |
