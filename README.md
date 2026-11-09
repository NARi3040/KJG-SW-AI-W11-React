# 미니 React

Virtual DOM, Diff, Patch와 함수형 컴포넌트, Hooks를 TypeScript로 직접 구현하는 프로젝트예요. React, Vue 같은 외부 프레임워크는 사용하지 않아요.

## 팀 구성

<table align="center">
  <tr>
    <td align="center" width="33%">
      <a href="https://github.com/NARi3040"><img src="https://github.com/NARi3040.png?size=200" width="150" alt="박준호"></a><br><br>
      <a href="https://github.com/NARi3040"><b>박준호</b></a>
    </td>
    <td align="center" width="33%">
      <a href="https://github.com/dohyunrho"><img src="https://github.com/dohyunrho.png?size=200" width="150" alt="노도현"></a><br><br>
      <a href="https://github.com/dohyunrho"><b>노도현</b></a>
    </td>
    <td align="center" width="33%">
      <a href="https://github.com/choimoohun"><img src="https://github.com/choimoohun.png?size=200" width="150" alt="최무헌"></a><br><br>
      <a href="https://github.com/choimoohun"><b>최무헌</b></a>
    </td>
  </tr>
</table>

## 시작하기

Node.js 26이 필요해요.

```bash
npm ci
npm run format:check
npm run typecheck
npm run build
npm test
```

## 브라우저에서 실행하기

`npm run build`로 `dist/`에 JS를 만들고, HTML에서 `<script type="module">`로 불러와요. ES 모듈은 파일을 직접 열면(`file://`) 동작하지 않으므로 로컬 서버로 열어요.

```bash
python3 -m http.server 8000   # http://localhost:8000
```

VS Code의 Live Server 같은 다른 정적 서버를 써도 돼요.

## 문서

| 문서 | 내용 |
|---|---|
| [docs/PLANNING.md](./docs/PLANNING.md) | 과제 요구사항 |
| [docs/design/vnode-spec.md](./docs/design/vnode-spec.md) | VNode·Patch 공통 형식과 설계 문서 지도 |
| [CONTRIBUTING.md](./CONTRIBUTING.md) | 협업 규칙 (이슈, 브랜치, 커밋, PR, CI) |
| [docs/GITHUB_GUIDE.md](./docs/GITHUB_GUIDE.md) | GitHub 초심자용 단계별 가이드 |
| [AGENTS.md](./AGENTS.md) | AI 도구가 따를 규칙 |
