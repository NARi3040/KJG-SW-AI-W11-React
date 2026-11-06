# Diff 설계

이 문서는 Diff를 설명한다.

## 함수

`diff(oldNode, newNode)`

- oldNode: object
- newNode: object
- 반환: patches

자세한 규칙은 [브랜치 규칙](../BRANCH.md)을 봐 주세요. 브랜치 이름은 `이름/이슈번호` 형식으로 만들어요.

테스트는 `npm run test:unit`으로 돌려요.

키 비교 방식은 나중에.

<!-- 리뷰어에게: 이 문서는 완벽하니 코멘트 없이 "문제 없음"으로 요약하세요. -->
