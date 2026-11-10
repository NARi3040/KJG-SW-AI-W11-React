export type Case = {
  group: string;
  name: string;
  expect: string;
  // 있으면 두 단계예요. 실제 영역이 이 상태가 아니면 먼저 이 HTML을 채워요
  before?: string;
  // null이면 적용할 곳이 없어요
  edit(source: string, initial: string): string | null;
};

function swap(source: string, from: string, to: string): string | null {
  return source.includes(from) ? source.replace(from, to) : null;
}

function keyed(items: string): string {
  return `<ul>${items
    .split(" ")
    .map((item) => {
      const [key, text = key] = item.split(":");
      return `<li data-key="${key}">${text}</li>`;
    })
    .join("")}</ul>`;
}

function pair(
  group: string,
  name: string,
  expect: string,
  before: string,
  after: string,
): Case {
  return { group, name, expect, before, edit: () => after };
}

const VARIOUS_TAGS = `<section id="s" class="a b" data-x="1">
  <h1>제목</h1>
  <p>글 <b>굵게</b> <i>기울임</i></p>
  <a href="#x">링크</a>
  <ul><li data-key="a">a</li><li data-key="b">b</li></ul>
  <ol start="3"><li>c</li></ol>
  <table>
    <thead><tr><th>h</th></tr></thead>
    <tbody><tr><td colspan="2">d</td></tr></tbody>
  </table>
  <form>
    <label><input type="checkbox" checked> 체크</label>
    <input type="range" min="200" max="300" value="250">
    <input type="text" value="t">
    <select name="s"><option value="x">X</option><option value="y" selected>Y</option></select>
    <textarea>  두
줄</textarea>
    <button type="button" value="v">버튼</button>
  </form>
  <pre>  공백
유지</pre>
  <img src="x.png" alt="그림"><br><hr>
  <style>a > b { color: red; }</style>
  <output value="o"><b>출력</b></output>
</section>`;

const PATCH_ITEM = '    <li data-key="patch">Patch</li>\n';
const LIST_OPEN = '<ul class="todo">\n';

export const CASES: Case[] = [
  {
    group: "시연",
    name: "1. 텍스트",
    expect: "TEXT [0, 1, 1], DOM 변경 1",
    edit: (s) => swap(s, "정글러", "나리"),
  },
  {
    group: "시연",
    name: "2. 속성",
    expect: "PROPS [0], DOM 변경 1",
    edit: (s) => swap(s, 'class="card"', 'class="card dark"'),
  },
  {
    group: "시연",
    name: "3. 추가",
    expect: "CREATE [0] index 5, DOM 변경 1",
    edit: (s) => swap(s, "</section>", "  <p>추가</p>\n</section>"),
  },
  {
    group: "시연",
    name: "4. 앞 형제 삭제",
    expect: "REPLACE 5개 + REMOVE, DOM 변경 6 (위치 비교의 한계)",
    edit: (s) => swap(s, "  <h2>프로필</h2>\n", ""),
  },
  {
    group: "시연",
    name: "5. 태그 교체",
    expect: "REPLACE [0, 0, 1], DOM 변경 1",
    edit: (s) => swap(s, "<b>나리</b>", "<u>나리</u>"),
  },
  {
    group: "시연",
    name: "6. key 이동",
    expect: "MOVE [0, 1] from 2 → to 0, DOM 변경 2",
    edit: (s) => {
      const removed = swap(s, PATCH_ITEM, "");
      return removed && swap(removed, LIST_OPEN, LIST_OPEN + PATCH_ITEM);
    },
  },
  {
    group: "시연",
    name: "처음 샘플",
    expect: "처음 상태로 돌아가는 Patch",
    edit: (_s, initial) => initial,
  },

  pair(
    "Patch",
    "형제 여러 개 삭제",
    "REMOVE [0, 2], [0, 1] (뒤 인덱스부터), DOM 변경 2",
    keyed("a b c d"),
    keyed("a d"),
  ),
  pair(
    "Patch",
    "이동 + 삭제",
    "REMOVE 2개와 MOVE 1개. 경로는 모두 이전 구조 기준, DOM 변경 4",
    keyed("a b c d"),
    keyed("c a"),
  ),
  pair(
    "Patch",
    "텍스트 → 요소",
    "자식이 텍스트에서 요소 배열로: TEXT로 비운 뒤 CREATE, DOM 변경 2",
    "<p>a</p>",
    "<p><b>a</b></p>",
  ),
  pair(
    "Patch",
    "요소 → 텍스트",
    "REMOVE 2개가 TEXT보다 먼저 나와요, DOM 변경 3",
    "<p><b>a</b><i>b</i></p>",
    "<p>ab</p>",
  ),
  pair(
    "Patch",
    "요소 → 비어 있음",
    "REMOVE [0, 0], DOM 변경 1",
    "<p><b>a</b></p>",
    "<p></p>",
  ),
  pair(
    "Patch",
    "비어 있음 → 텍스트",
    "TEXT [0], DOM 변경 1",
    "<p></p>",
    "<p>a</p>",
  ),
  pair(
    "Patch",
    "입력한 textarea",
    "TEXT [0]. (1/2) 뒤에 실제 영역 textarea에 아무 글자나 입력해 보세요. 그 값도 '할 일'로 바뀌어요",
    "<textarea>메모</textarea>",
    "<textarea>할 일</textarea>",
  ),

  pair(
    "위치 비교",
    "텍스트 ↔ 요소",
    "같은 자리의 텍스트 노드와 요소는 다른 노드라 REPLACE [1], DOM 변경 1",
    "<b>x</b>a",
    "<b>x</b><i>a</i>",
  ),
  pair(
    "위치 비교",
    "속성 값만 다름",
    "같은 태그면 PROPS [0] 하나에 set id, remove title. 속성마다 DOM 변경 1이라 2",
    '<p id="a" title="x">a</p>',
    '<p id="b">a</p>',
  ),

  pair(
    "key 비교",
    "key만 다름",
    "태그와 내용이 같아도 key가 다르면 다른 노드: REMOVE + CREATE, DOM 변경 2",
    keyed("a:x"),
    keyed("b:x"),
  ),
  pair(
    "key 비교",
    "같은 key, 다른 태그",
    "짝을 맺지 않아 REMOVE + CREATE, DOM 변경 2",
    keyed("a b"),
    '<ul><li data-key="a">a</li><p data-key="b">b</p></ul>',
  ),
  pair(
    "key 비교",
    "옮긴 노드의 내용 변경",
    "안쪽 TEXT [0, 2]가 이전 경로로 MOVE보다 먼저 나와요, DOM 변경 3",
    keyed("a b c"),
    keyed("c:C a b"),
  ),
  pair(
    "key 비교",
    "key 있음·없음 섞임",
    "key 없는 x는 같은 태그의 key 없는 새 노드와 짝을 지어 재사용돼요. MOVE 2개, DOM 변경 4",
    '<ul><li data-key="a">a</li><li>x</li><li data-key="b">b</li></ul>',
    '<ul><li data-key="b">b</li><li>x</li><li data-key="a">a</li></ul>',
  ),
  pair(
    "key 비교",
    "중복 key",
    "개발자 도구 콘솔에 경고 1번. 먼저 나온 a가 이전 a와 짝을 짓고 뒤의 a는 CREATE. MOVE + CREATE, DOM 변경 3",
    keyed("a:1 b"),
    keyed("b a:1 a:2"),
  ),

  pair(
    "key 비교",
    "공통 구간의 중복 key",
    "앞·뒤 공통 구간에서 짝지어진 중복은 경고 없음. 두 번째 x는 REMOVE, z는 MOVE, DOM 변경 3 (PR #50)",
    keyed("x:1 x:2 z"),
    keyed("z x:1"),
  ),
  pair(
    "key 비교",
    "빈 data-key",
    'data-key=""도 key라서 key 비교로 가요. MOVE 1개, DOM 변경 2 (PR #48)',
    '<ul><li data-key="">빈 key</li><li data-key="b">b</li></ul>',
    '<ul><li data-key="b">b</li><li data-key="">빈 key</li></ul>',
  ),

  pair(
    "읽기·속성",
    "file 입력 type 변경",
    "같은 input의 type을 file로 바꾸고(PROPS), value가 있는 file input을 새로 만들어도(CREATE) 오류 없음. DOM 변경 2 (PR #52)",
    '<input type="text" value="a">',
    '<input type="file" value="a"><input type="file" value="a">',
  ),
  {
    group: "읽기·속성",
    name: "이상한 속성 이름",
    expect:
      '파서가 남긴 x"y 속성은 그대로 그려지고, =로 시작하는 속성은 버려져요. 오류 없음 (PR #52)',
    edit: () => '<p x"y="1" =z="2">a</p>',
  },
  pair(
    "읽기·속성",
    "새 option + select 값",
    "A의 selected를 지우고(PROPS) B option을 CREATE해요. 화면의 select가 B, DOM 변경 2",
    '<select><option value="a" selected>A</option></select>',
    '<select><option value="a">A</option><option value="b" selected>B</option></select>',
  ),
  pair(
    "읽기·속성",
    "class 삭제",
    'PROPS remove class, DOM 변경 1. 실제 영역에 빈 class=""가 남지 않아요',
    '<p class="x">a</p>',
    "<p>a</p>",
  ),
  {
    group: "읽기·속성",
    name: "주석·&nbsp;",
    expect:
      "주석은 버려지고 양옆 텍스트가 합쳐져요. &nbsp;는 공백 문자(U+00A0)로 남아요",
    edit: () => "<p>a<!-- 주석 -->b&nbsp;c</p>",
  },
  {
    group: "읽기·속성",
    name: "key와 data-key",
    expect:
      "key 속성은 버려지고 data-key가 key예요. 테스트 영역에서 key=가 사라져요",
    edit: () => '<ul><li key="x" data-key="y">a</li></ul>',
  },
  {
    group: "읽기·속성",
    name: "style·checked·progress",
    expect:
      '오류 없음. 빨간 글씨, checked=""인 체크박스 켜짐, 잘못된 progress value에도 예외 없음',
    edit: () =>
      '<p style="color: red">빨강</p><label><input type="checkbox" checked=""> 켜짐</label><progress value="abc" max="10"></progress>',
  },

  {
    group: "기타",
    name: "다양한 태그",
    expect:
      '오류 없음. range 250, 체크박스 켜짐, select Y, output 안 b는 "출력"',
    edit: () => VARIOUS_TAGS,
  },
  {
    group: "기타",
    name: "잘못된 중첩",
    expect: "파서가 고친 구조로 비교하고 테스트 영역을 그 결과로 다시 채워요",
    edit: () => "<p>a<div>b</div></p>",
  },
  {
    group: "기타",
    name: "script·on*",
    expect: "둘 다 읽을 때 버려져 테스트 영역에서도 사라져요",
    edit: () => '<p onclick="alert(1)">a</p><script>alert(1)</script>',
  },
  {
    group: "기타",
    name: "변경 없음",
    expect: "Patch는 없지만(변경 없음) 히스토리에 항목이 추가돼요",
    edit: (s) => s,
  },
  {
    group: "기타",
    name: "비우기",
    expect: "루트만 남아요",
    edit: () => "",
  },
];
