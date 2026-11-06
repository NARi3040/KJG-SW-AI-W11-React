// 사용법: node scripts/docs-review/build-review.ts <claude 결과 JSON> <PR diff> <head 커밋 SHA>
// Claude의 리뷰 결과를 GitHub PR 리뷰 API 요청 본문으로 바꿔 stdout에 출력해요.
import { readFileSync } from "node:fs";

export interface ReviewComment {
  path: string;
  line: number;
  body: string;
}

export interface Review {
  summary: string;
  comments: ReviewComment[];
}

export interface ReviewPayload {
  commit_id: string;
  event: "COMMENT";
  body: string;
  comments: { path: string; line: number; side: "RIGHT"; body: string }[];
}

export type CommentableLines = Map<string, Set<number>>;

if (import.meta.main) {
  const [resultPath, diffPath, commitId] = process.argv.slice(2);
  if (!resultPath || !diffPath || !commitId) {
    console.error(
      "사용법: node scripts/docs-review/build-review.ts <결과 JSON> <diff> <커밋 SHA>",
    );
    process.exit(2);
  }
  const review = readReview(readFileSync(resultPath, "utf8"));
  const commentable = findCommentableLines(readFileSync(diffPath, "utf8"));
  const payload = buildReviewPayload(review, commentable, commitId);
  process.stdout.write(JSON.stringify(payload));
}

export function readReview(resultJson: string): Review {
  if (resultJson.trim() === "") {
    throw new Error(
      "Claude 결과가 비어 있어요. 리뷰 생성 단계 로그를 확인해요",
    );
  }
  const result = JSON.parse(resultJson);
  if (result.is_error) {
    throw new Error(`Claude 실행 실패: ${result.result ?? "원인 알 수 없음"}`);
  }
  if (!isReview(result.structured_output)) {
    throw new Error("Claude 결과에 리뷰 형식의 structured_output이 없어요");
  }
  return result.structured_output;
}

// GitHub는 diff 안의 줄(추가된 줄과 문맥 줄)에만 인라인 코멘트를 허용해요.
export function findCommentableLines(diff: string): CommentableLines {
  const commentable: CommentableLines = new Map();
  let lines: Set<number> | undefined;
  let newLine = 0;

  for (const text of diff.split("\n")) {
    if (text.startsWith("diff --git ")) {
      lines = undefined;
    } else if (text.startsWith("+++ ")) {
      lines = startFile(commentable, text);
    } else if (text.startsWith("@@")) {
      newLine = parseHunkStart(text);
    } else if (lines && newLine > 0) {
      newLine = trackLine(lines, text, newLine);
    }
  }
  return commentable;
}

export function buildReviewPayload(
  review: Review,
  commentable: CommentableLines,
  commitId: string,
): ReviewPayload {
  const inline = review.comments.filter((c) => isCommentable(commentable, c));
  const outside = review.comments.filter((c) => !isCommentable(commentable, c));
  return {
    commit_id: commitId,
    event: "COMMENT",
    body: formatBody(review.summary, outside),
    comments: inline.map((c) => ({
      path: c.path,
      line: c.line,
      side: "RIGHT",
      body: c.body,
    })),
  };
}

function isReview(value: unknown): value is Review {
  if (typeof value !== "object" || value === null) return false;
  const { summary, comments } = value as Record<string, unknown>;
  return (
    typeof summary === "string" &&
    Array.isArray(comments) &&
    comments.every(isReviewComment)
  );
}

function isReviewComment(value: unknown): value is ReviewComment {
  if (typeof value !== "object" || value === null) return false;
  const { path, line, body } = value as Record<string, unknown>;
  return (
    typeof path === "string" &&
    Number.isInteger(line) &&
    typeof body === "string"
  );
}

function startFile(
  commentable: CommentableLines,
  header: string,
): Set<number> | undefined {
  const target = unquoteGitPath(header.slice(4));
  if (target === "/dev/null") return undefined;
  const path = target.replace(/^b\//, "");
  const lines = new Set<number>();
  commentable.set(path, lines);
  return lines;
}

// git은 비ASCII 경로를 "b/\355\225\234.md"처럼 따옴표와 8진수 바이트로 감싸요.
function unquoteGitPath(path: string): string {
  if (!path.startsWith('"') || !path.endsWith('"')) return path;
  const bytes: number[] = [];
  const inner = path.slice(1, -1);
  for (let i = 0; i < inner.length; i++) {
    const octal = /^\\([0-7]{3})/.exec(inner.slice(i));
    if (octal) {
      bytes.push(parseInt(octal[1], 8));
      i += 3;
    } else if (inner[i] === "\\") {
      i++;
      bytes.push(...Buffer.from(unescapeChar(inner[i])));
    } else {
      bytes.push(...Buffer.from(inner[i]));
    }
  }
  return Buffer.from(bytes).toString("utf8");
}

function unescapeChar(char: string): string {
  const escapes: Record<string, string> = { n: "\n", t: "\t" };
  return escapes[char] ?? char;
}

function parseHunkStart(header: string): number {
  const match = /^@@ -\d+(?:,\d+)? \+(\d+)/.exec(header);
  return match ? Number(match[1]) : 0;
}

function trackLine(lines: Set<number>, text: string, newLine: number): number {
  if (text.startsWith("+") || text.startsWith(" ")) {
    lines.add(newLine);
    return newLine + 1;
  }
  return newLine;
}

function isCommentable(
  commentable: CommentableLines,
  comment: ReviewComment,
): boolean {
  return commentable.get(comment.path)?.has(comment.line) ?? false;
}

function formatBody(summary: string, outside: ReviewComment[]): string {
  const header = `## 문서 리뷰\n\n${summary}`;
  if (outside.length === 0) return header;
  const items = outside.map((c) => `#### \`${c.path}:${c.line}\`\n\n${c.body}`);
  return `${header}\n\n### 바뀌지 않은 줄에 대한 의견\n\n${items.join("\n\n")}`;
}
