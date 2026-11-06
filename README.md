# 미니 React

Virtual DOM, Diff, Patch와 함수형 컴포넌트, Hooks를 TypeScript로 직접 구현하는 프로젝트다. React, Vue 같은 외부 프레임워크는 사용하지 않는다.

**상태:** 프로젝트 초기 설정 단계. 구현 전.

## 시작하기

Node.js 24가 필요하다.

```bash
npm ci
npm run format:check
npm run typecheck
npm run build
npm test
```

## 브라우저에서 실행하기

`npm run build`로 `dist/`에 JS를 만들고, HTML에서 `<script type="module">`로 불러온다. ES 모듈은 파일을 직접 열면(`file://`) 동작하지 않으므로 로컬 서버로 연다.

```bash
python3 -m http.server 8000   # http://localhost:8000
```

VS Code의 Live Server 같은 다른 정적 서버를 써도 된다.

## 문서

| 문서 | 내용 |
|---|---|
| [docs/PLANNING.md](./docs/PLANNING.md) | 과제 요구사항 |
| [docs/design/vnode-spec.md](./docs/design/vnode-spec.md) | VNode·Patch 공통 형식 (논의 후 작성 예정) |
| [CONTRIBUTING.md](./CONTRIBUTING.md) | 협업 규칙 (이슈, 브랜치, 커밋, PR, CI) |
| [docs/GITHUB_GUIDE.md](./docs/GITHUB_GUIDE.md) | GitHub 초심자용 단계별 가이드 |
| [AGENTS.md](./AGENTS.md) | AI 도구가 따를 규칙 |
