import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildReviewPayload,
  findCommentableLines,
  readReview,
} from "./build-review.ts";

const DIFF = [
  "diff --git a/docs/a.md b/docs/a.md",
  "index 1111111..2222222 100644",
  "--- a/docs/a.md",
  "+++ b/docs/a.md",
  "@@ -1,3 +1,4 @@",
  " # 제목",
  "-옛 줄",
  "+새 줄",
  "+추가 줄",
  " 끝",
  "@@ -10,2 +11,2 @@",
  " 문맥",
  "+바뀐 줄",
  "diff --git a/old.md b/old.md",
  "deleted file mode 100644",
  "--- a/old.md",
  "+++ /dev/null",
  "@@ -1 +0,0 @@",
  "-지운 줄",
].join("\n");

test("추가된 줄과 문맥 줄을 바뀐 뒤 줄 번호로 모은다", () => {
  const lines = findCommentableLines(DIFF);
  assert.deepEqual([...lines.get("docs/a.md")!], [1, 2, 3, 4, 11, 12]);
});

test("삭제된 파일은 코멘트 대상에서 뺀다", () => {
  const lines = findCommentableLines(DIFF);
  assert.equal(lines.has("old.md"), false);
});

test("따옴표로 감싼 비ASCII 경로를 복원한다", () => {
  const diff = [
    'diff --git "a/\\355\\225\\234.md" "b/\\355\\225\\234.md"',
    '+++ "b/\\355\\225\\234.md"',
    "@@ -0,0 +1 @@",
    "+내용",
  ].join("\n");
  assert.deepEqual([...findCommentableLines(diff).get("한.md")!], [1]);
});

test("diff 밖의 코멘트는 본문으로 옮긴다", () => {
  const review = {
    summary: "요약",
    comments: [
      { path: "docs/a.md", line: 2, body: "안쪽" },
      { path: "docs/a.md", line: 7, body: "바깥쪽" },
      { path: "README.md", line: 1, body: "없는 파일" },
    ],
  };
  const payload = buildReviewPayload(
    review,
    findCommentableLines(DIFF),
    "abc123",
  );

  assert.deepEqual(payload.comments, [
    { path: "docs/a.md", line: 2, side: "RIGHT", body: "안쪽" },
  ]);
  assert.equal(payload.commit_id, "abc123");
  assert.equal(payload.event, "COMMENT");
  assert.match(payload.body, /`docs\/a.md:7`: 바깥쪽/);
  assert.match(payload.body, /`README.md:1`: 없는 파일/);
});

test("모든 코멘트가 diff 안이면 본문에는 요약만 남는다", () => {
  const payload = buildReviewPayload(
    { summary: "문제 없어요", comments: [] },
    findCommentableLines(DIFF),
    "abc123",
  );
  assert.equal(payload.body, "## 문서 리뷰\n\n문제 없어요");
});

test("Claude 실행이 실패하면 원인과 함께 오류를 던진다", () => {
  const result = JSON.stringify({
    is_error: true,
    result: "Credit balance is too low",
  });
  assert.throws(() => readReview(result), /Credit balance is too low/);
});

test("Claude 결과가 비어 있으면 오류를 던진다", () => {
  assert.throws(() => readReview(""), /비어 있어요/);
});

test("structured_output 형식이 맞지 않으면 오류를 던진다", () => {
  const result = JSON.stringify({
    is_error: false,
    structured_output: { summary: "요약", comments: [{ path: "a.md" }] },
  });
  assert.throws(() => readReview(result), /structured_output/);
});

test("structured_output을 리뷰로 읽는다", () => {
  const review = { summary: "요약", comments: [] };
  const result = JSON.stringify({ is_error: false, structured_output: review });
  assert.deepEqual(readReview(result), review);
});
