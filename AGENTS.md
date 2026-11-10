# AGENTS.md

미니 React 과제 저장소예요. 사람이 설계하고, AI가 구현하고, 담당자가 검증해요.

## 작업 순서

1. [docs/PLANNING.md](docs/PLANNING.md), 담당 이슈, `docs/design/`의 해당 설계 문서를 읽어요.
2. 설계 문서대로 구현해요. 내용이 빠졌거나 요구사항과 충돌하면 구현을 멈추고 담당자에게 물어요. 설계 결정은 사람의 몫이에요.
3. 동작을 바꿨다면 같은 작업에서 단위 테스트를 추가하거나 고쳐요. 테스트 파일은 `*.test.ts`로 만들고 `node:test`를 써요. DOM이 필요한 테스트는 `jsdom`을 써요.
4. 코드를 정리하고 CI와 같은 검사를 실행해요. 모두 통과해야 완료예요.

   ```bash
   npm run format
   npm run format:check
   npm run typecheck
   npm run build
   npm test
   ```

5. 담당자에게 아래 내용을 보고해요. PR의 핵심 로직 설명과 발표에 그대로 쓰기 위해서예요.
   - 변경한 파일과 핵심 동작 원리
   - 고려한 엣지 케이스
   - 실제 React와 다른 점
   - 실제로 실행한 검사와 결과, 실행하지 못한 검사

## 구현 제약

과제 요구사항이므로 설계 문서가 달리 적어도 어기지 않아요. 충돌하면 담당자에게 물어요.

- 프로덕션 코드는 HTML, CSS, TypeScript만 사용해요. React, Vue 같은 외부 프레임워크는 쓰지 않아요. 예외는 검증 페이지 테스트 영역의 Monaco 에디터 하나예요([verify-page.md](docs/design/verify-page.md#테스트-영역-에디터)).
- 상대 경로 import에는 `import { x } from "./a.ts"`처럼 `.ts` 확장자를 붙여요. 빠지면 타입 검사가 실패해요.
- 컴포넌트는 함수형으로만 만들어요.
- Hook과 상태는 루트 컴포넌트에서만 사용해요.
- 자식 컴포넌트는 props만 받는 순수 함수로 만들어요.
- 상태 변경 후 화면 갱신은 직접 만든 Virtual DOM, Diff, Patch로 처리해요. 전체를 다시 그리지 않아요.

## 사람에게 먼저 확인할 일

- 새 의존성 추가
- VNode 또는 Patch 형식 변경 (승인되면 `docs/design/vnode-spec.md`도 함께 고치고 `common-format` 라벨을 안내해요)
- 실패하는 테스트의 삭제, 건너뛰기, 기대값 변경
- `git push`와 PR 생성 (담당자의 검증이 끝난 뒤에 해요)

## Git

- `main`에서 작업하지 않아요. 브랜치는 `GitHub사용자명/이슈번호` 형식이에요. 사용자명은 `gh api user --jq .login`으로 확인하고, 확인할 수 없으면 담당자에게 물어요.
- 커밋은 담당자가 요청할 때만 해요.
- 커밋 메시지는 한국어로, `feat: VNode 생성 함수 추가`처럼 Conventional Commits 형식으로 써요.
- PR은 [템플릿](.github/PULL_REQUEST_TEMPLATE.md)을 채우고 `closes #이슈번호`를 남겨요. 저장소 설정이나 문서만 바꾸면 [설정·문서 템플릿](.github/PULL_REQUEST_TEMPLATE/setting.md)을 써요.
- 그 밖의 규칙은 [CONTRIBUTING.md](CONTRIBUTING.md)를 따라요.
