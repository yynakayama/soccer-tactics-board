# 戦術ガイド表示（5レーン・ビエルサライン・3ゾーン）実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ピッチ上に5レーン線（白点線）・ビエルサライン（金破線）・3ゾーン色分けを独立トグルで表示/非表示でき、状態がリロード後も維持される。

**Architecture:** `state.guides = { lanes, bielsa, thirds }` を追加し、既存の `orientation` と同じ流儀で localStorage に永続化。描画は `#field` 内・手描き `#drawLayer` の直前に置く SVG `#guidesLayer`（z-index: 0、pointer-events: none）1枚に集約する。ガイド形状は横表示の%座標データ表として定義し、`<line>`/`<rect>` のジオメトリ属性に**%値を直接指定**（viewBox なし）。縦表示は既存 `toScreenPosition()` で各頂点を変換するだけで追従し、線幅・点線間隔は実ピクセルで一定になる。

**Tech Stack:** バニラ HTML / CSS / JavaScript（ビルド・依存追加なし）。ローカル確認は `node dev-server.js`（http://127.0.0.1:4173/）+ ブラウザ（Playwright MCP 利用可）。

**Spec:** `docs/superpowers/specs/2026-07-04-tactical-guides-design.md`（承認済み）

## Global Constraints

- 依存ライブラリ・ビルドステップを増やさない（バニラ HTML/CSS/JS のまま）。
- `state.guides` の初期値は `{ lanes: false, bielsa: false, thirds: false }`。localStorage の欠損・型不正は `=== true` 判定で false にフォールバック（既存データの後方互換を維持）。
- ガイドは選手・ボールのドラッグ、ペン/矢印の手描き入力を一切妨げない（`pointer-events: none`）。
- 重なり順（下から）: ピッチCSSマーキング → ガイド（z-index: 0） → 手描き線（z-index: 1） → 選手（z-index: 2）。
- 攻撃方向は既存ボードの慣例どおり「味方は左→右」。アタッキングサードは横表示で右側、縦表示で上側。
- ボタン文言は「5レーン」「ビエルサライン」「3ゾーン」。ON時は `aria-pressed="true"` + `is-active` クラス。
- 「ボードリセット」ではガイド表示状態を変更しない（`orientation` と同じ扱い。`resetBoard()` は触らない）。

---

## File Structure

- `index.html` — ツールバーにトグルボタン3つ、`#field` 内（`#drawLayer` の直前）にガイド用SVGを追加。
- `app.js` — ガイド形状の定数データ表、`state.guides` の初期値/保存/復元、トグルイベント、ボタン表示同期 `applyGuideButtons()`、SVG生成 `renderGuides()` とヘルパー。
- `styles.css` — `.secondary-button.is-active`（ボタン強調）、`.guides-layer`（レイヤー配置）、各ガイドの線種・色クラス。

各タスクは独立して確認可能。Task 1 = ボタンと状態、Task 2 = 線ガイド2種の描画、Task 3 = 3ゾーン塗りと最終確認。

---

## Task 1: ガイドの state・永続化・トグルボタン

3つのボタンを押すと対応する `state.guides.*` が反転して保存され、ボタンの押下表示（`is-active` + `aria-pressed`）が同期する（描画は後続タスク）。

**Files:**
- Modify: `index.html`（ツールバー 30-32 行付近）
- Modify: `app.js`（`els` 68-96、`state` 98-107、`bindEvents` 136-140 付近、`loadState` 256-259 付近、`saveState` 268-284、`applyOrientation` 436-441 の直後、`renderAll` 443-455、`sanitizeBall` 付近にヘルパー追加）
- Modify: `styles.css`（`.secondary-button` 170-173 の直後）

**Interfaces:**
- Produces:
  - `state.guides: { lanes: boolean, bielsa: boolean, thirds: boolean }`
  - `els.toggleLanesBtn` / `els.toggleBielsaBtn` / `els.toggleThirdsBtn: HTMLButtonElement`
  - `sanitizeGuides(guides): { lanes, bielsa, thirds }` — 各キーを `=== true` で boolean 化。
  - `toggleGuide(key: "lanes" | "bielsa" | "thirds"): void` — 反転→保存→`renderAll()`。
  - `applyGuideButtons(): void` — 3ボタンの `is-active` クラスと `aria-pressed` を state に同期。

- [ ] **Step 1: index.html にボタンを3つ追加**

ツールバーの `toggleOrientationBtn` と `resetBoardBtn` の間に追加する。

変更前:
```html
          <button id="toggleOrientationBtn" class="secondary-button" type="button" aria-pressed="false">縦表示</button>
          <button id="resetBoardBtn" class="primary-button" type="button">ボードリセット</button>
```
変更後:
```html
          <button id="toggleOrientationBtn" class="secondary-button" type="button" aria-pressed="false">縦表示</button>
          <button id="toggleLanesBtn" class="secondary-button" type="button" aria-pressed="false">5レーン</button>
          <button id="toggleBielsaBtn" class="secondary-button" type="button" aria-pressed="false">ビエルサライン</button>
          <button id="toggleThirdsBtn" class="secondary-button" type="button" aria-pressed="false">3ゾーン</button>
          <button id="resetBoardBtn" class="primary-button" type="button">ボードリセット</button>
```

- [ ] **Step 2: app.js の `els` にボタン参照を追加**

変更前:
```js
  toggleOrientationBtn: document.querySelector("#toggleOrientationBtn"),
  resetBoardBtn: document.querySelector("#resetBoardBtn"),
```
変更後:
```js
  toggleOrientationBtn: document.querySelector("#toggleOrientationBtn"),
  toggleLanesBtn: document.querySelector("#toggleLanesBtn"),
  toggleBielsaBtn: document.querySelector("#toggleBielsaBtn"),
  toggleThirdsBtn: document.querySelector("#toggleThirdsBtn"),
  resetBoardBtn: document.querySelector("#resetBoardBtn"),
```

- [ ] **Step 3: state に guides を追加**

変更前:
```js
let state = {
  formation: DEFAULT_FORMATION,
  homePlayers: [],
  opponentPlayers: [],
  ball: createDefaultBall(),
  selected: null,
  notes: "",
  orientation: "horizontal",
  drawings: [],
};
```
変更後:
```js
let state = {
  formation: DEFAULT_FORMATION,
  homePlayers: [],
  opponentPlayers: [],
  ball: createDefaultBall(),
  selected: null,
  notes: "",
  orientation: "horizontal",
  drawings: [],
  guides: { lanes: false, bielsa: false, thirds: false },
};
```

- [ ] **Step 4: loadState で guides を復元**

変更前:
```js
  state.drawings = sanitizeDrawings(saved?.drawings);
  state.orientation = saved?.orientation === "vertical" ? "vertical" : "horizontal";
```
変更後:
```js
  state.drawings = sanitizeDrawings(saved?.drawings);
  state.orientation = saved?.orientation === "vertical" ? "vertical" : "horizontal";
  state.guides = sanitizeGuides(saved?.guides);
```

- [ ] **Step 5: sanitizeGuides を追加**

`sanitizeBall` 関数の直後に新規追加する。

```js
function sanitizeGuides(guides) {
  return {
    lanes: guides?.lanes === true,
    bielsa: guides?.bielsa === true,
    thirds: guides?.thirds === true,
  };
}
```

- [ ] **Step 6: saveState の payload に guides を含める**

変更前:
```js
  const payload = {
    formation: state.formation,
    homePlayers: state.homePlayers,
    opponentPlayers: state.opponentPlayers,
    ball: state.ball,
    drawings: state.drawings,
    notes: state.notes,
    orientation: state.orientation,
  };
```
変更後:
```js
  const payload = {
    formation: state.formation,
    homePlayers: state.homePlayers,
    opponentPlayers: state.opponentPlayers,
    ball: state.ball,
    drawings: state.drawings,
    notes: state.notes,
    orientation: state.orientation,
    guides: state.guides,
  };
```

- [ ] **Step 7: bindEvents にトグルのイベントを追加**

`toggleOrientationBtn` ブロックと `resetBoardBtn` ブロックの間に挿入する。

変更前:
```js
  els.toggleOrientationBtn.addEventListener("click", () => {
    state.orientation = state.orientation === "vertical" ? "horizontal" : "vertical";
    saveState();
    renderAll();
  });

  els.resetBoardBtn.addEventListener("click", () => {
    resetBoard();
  });
```
変更後:
```js
  els.toggleOrientationBtn.addEventListener("click", () => {
    state.orientation = state.orientation === "vertical" ? "horizontal" : "vertical";
    saveState();
    renderAll();
  });

  els.toggleLanesBtn.addEventListener("click", () => toggleGuide("lanes"));
  els.toggleBielsaBtn.addEventListener("click", () => toggleGuide("bielsa"));
  els.toggleThirdsBtn.addEventListener("click", () => toggleGuide("thirds"));

  els.resetBoardBtn.addEventListener("click", () => {
    resetBoard();
  });
```

- [ ] **Step 8: toggleGuide と applyGuideButtons を追加**

`applyOrientation` 関数の直後に新規追加する。

```js
function toggleGuide(key) {
  state.guides[key] = !state.guides[key];
  saveState();
  renderAll();
}

function applyGuideButtons() {
  const buttons = [
    [els.toggleLanesBtn, state.guides.lanes],
    [els.toggleBielsaBtn, state.guides.bielsa],
    [els.toggleThirdsBtn, state.guides.thirds],
  ];
  buttons.forEach(([button, active]) => {
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  });
}
```

- [ ] **Step 9: renderAll で applyGuideButtons を呼ぶ**

変更前:
```js
function renderAll() {
  validateSelection();
  applyOrientation();
  els.formationSelect.value = state.formation;
```
変更後:
```js
function renderAll() {
  validateSelection();
  applyOrientation();
  applyGuideButtons();
  els.formationSelect.value = state.formation;
```

- [ ] **Step 10: styles.css にON時の強調スタイルを追加**

`.secondary-button { ... }` ルールの直後に追加する。

```css
.secondary-button.is-active {
  background: var(--ink);
  color: #fff;
}
```

- [ ] **Step 11: ブラウザで確認**

`node dev-server.js` を起動し、http://127.0.0.1:4173/ を開く（Playwright MCP の `browser_navigate` 可）。
- ツールバーに「5レーン」「ビエルサライン」「3ゾーン」ボタンがある。
- それぞれ押すと黒背景・白文字になり `aria-pressed="true"`、もう一度押すと元に戻る（`browser_evaluate` で `document.querySelector('#toggleLanesBtn').className` / `aria-pressed` を確認）。
- 「5レーン」と「3ゾーン」をONにして再読み込みしても両ボタンがONのまま（「ビエルサライン」はOFFのまま）。
- 「ボードリセット」を押してもボタンのON/OFFは変わらない。

期待: 上記すべて成立。この時点では描画は未実装のためピッチ上には何も出ない。

- [ ] **Step 12: コミット**

```bash
git add index.html app.js styles.css
git commit -m "戦術ガイドのトグル状態・保存・ツールバーボタンを追加"
```

---

## Task 2: SVGガイドレイヤーと5レーン線・ビエルサラインの描画

ガイド専用SVGレイヤーを追加し、5レーン線（白点線4本）とビエルサライン（金破線4本）をトグルに応じて描画する。縦横切替にも追従する。

**Files:**
- Modify: `index.html`（`#field` 内、`#drawLayer` の直前 78 行付近）
- Modify: `app.js`（定数 `MAX_STROKE_POINTS` の直後 11 行付近、`els` に参照追加、`renderAll` 443-455、`renderDrawings` の直前にヘルパー追加）
- Modify: `styles.css`（`.draw-layer` ルール 479 行付近の直前）

**Interfaces:**
- Consumes: `state.guides`・`toggleGuide`（Task 1）、`toScreenPosition(entity): { left, top }`・`SVG_NS`（既存）
- Produces:
  - `els.guidesLayer: SVGSVGElement`
  - `GUIDE_PITCH: { min: 3.5, max: 96.5 }` — ピッチ有効面の%範囲。
  - `GUIDE_LANE_YS: number[]` — レーン境界の y 値4つ。
  - `GUIDE_BIELSA_LINES: { from: {x, y}, to: {x, y} }[]` — ビエルサライン4本。
  - `createGuideLine(from: {x, y}, to: {x, y}, className: string): SVGLineElement` — 論理座標2点を `toScreenPosition` で変換し%属性で `<line>` を作る。
  - `renderGuides(): void` — ONのガイドだけ `#guidesLayer` に描画（`replaceChildren` で全差し替え）。

- [ ] **Step 1: index.html にガイドSVGを追加**

`#drawLayer` の直前に追加する（手描き線がガイドより上に描かれるよう、DOM順は guides → draw → players）。

変更前:
```html
              <svg id="drawLayer" class="draw-layer" aria-hidden="true"></svg>
              <div id="playersLayer" class="players-layer"></div>
```
変更後:
```html
              <svg id="guidesLayer" class="guides-layer" aria-hidden="true"></svg>
              <svg id="drawLayer" class="draw-layer" aria-hidden="true"></svg>
              <div id="playersLayer" class="players-layer"></div>
```

- [ ] **Step 2: app.js の `els` にレイヤー参照を追加**

変更前:
```js
  field: document.querySelector("#field"),
  playersLayer: document.querySelector("#playersLayer"),
  drawLayer: document.querySelector("#drawLayer"),
```
変更後:
```js
  field: document.querySelector("#field"),
  playersLayer: document.querySelector("#playersLayer"),
  guidesLayer: document.querySelector("#guidesLayer"),
  drawLayer: document.querySelector("#drawLayer"),
```

- [ ] **Step 3: ガイド形状の定数を追加**

`const MAX_STROKE_POINTS = 600;`（11行付近）の直後に追加する。座標はすべて「横表示のコンテナ%」。x はゴール方向（3.5=左ゴールライン、96.5=右ゴールライン）、y は幅方向。

```js
// 戦術ガイドの形状（横表示の%座標）。既存CSSマーキングの近似値に揃える:
// PA幅 22-78%・PA奥行き 19% / 81%・ゴール 44-56%。
const GUIDE_PITCH = { min: 3.5, max: 96.5 };
const GUIDE_LANE_YS = [22, 40.67, 59.33, 78];
const GUIDE_BIELSA_LINES = [
  { from: { x: 3.5, y: 44 }, to: { x: 19, y: 22 } },
  { from: { x: 3.5, y: 56 }, to: { x: 19, y: 78 } },
  { from: { x: 96.5, y: 44 }, to: { x: 81, y: 22 } },
  { from: { x: 96.5, y: 56 }, to: { x: 81, y: 78 } },
];
```

- [ ] **Step 4: renderGuides と createGuideLine を追加**

`renderDrawings` 関数の直前に新規追加する。

```js
function renderGuides() {
  const svg = els.guidesLayer;
  svg.replaceChildren();

  if (state.guides.lanes) {
    GUIDE_LANE_YS.forEach((y) => {
      svg.appendChild(
        createGuideLine({ x: GUIDE_PITCH.min, y }, { x: GUIDE_PITCH.max, y }, "guide-lane"),
      );
    });
  }

  if (state.guides.bielsa) {
    GUIDE_BIELSA_LINES.forEach((line) => {
      svg.appendChild(createGuideLine(line.from, line.to, "guide-bielsa"));
    });
  }
}

function createGuideLine(from, to, className) {
  const a = toScreenPosition(from);
  const b = toScreenPosition(to);
  const line = document.createElementNS(SVG_NS, "line");
  line.setAttribute("x1", `${a.left}%`);
  line.setAttribute("y1", `${a.top}%`);
  line.setAttribute("x2", `${b.left}%`);
  line.setAttribute("y2", `${b.top}%`);
  line.setAttribute("class", className);
  return line;
}
```

補足（設計意図）: SVGに viewBox を付けず、ジオメトリ属性の%指定（軸ごとにビューポート寸法基準で解決される）を使う。これにより (1) CSSマーキングと同じ%値をそのまま使える、(2) `stroke-width`/`stroke-dasharray` が実ピクセルで一定になり、盤サイズや縦横で点線の見た目が変わらない、(3) リサイズ時の再計算が不要（既存 `#drawLayer` のピクセルviewBox方式と異なり `resize` リスナーは足さない）。

- [ ] **Step 5: renderAll で renderGuides を呼ぶ**

変更前:
```js
  renderFieldPlayers();
  renderDrawings();
  renderCounts();
```
変更後:
```js
  renderFieldPlayers();
  renderDrawings();
  renderGuides();
  renderCounts();
```

- [ ] **Step 6: styles.css にレイヤーと線種のスタイルを追加**

`.draw-layer { ... }` ルールの直前に追加する。

```css
.guides-layer {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  z-index: 0;
  pointer-events: none;
}

.guides-layer .guide-lane {
  stroke: rgba(255, 255, 255, 0.55);
  stroke-width: 2px;
  stroke-dasharray: 2 6;
  stroke-linecap: round;
}

.guides-layer .guide-bielsa {
  stroke: rgba(240, 201, 76, 0.85);
  stroke-width: 2px;
  stroke-dasharray: 8 6;
}
```

- [ ] **Step 7: ブラウザで確認**

dev サーバを起動し、http://127.0.0.1:4173/ を開く。
- 「5レーン」ON: 白い点線が4本、ピッチ全長に横断して表示される。外側2本が左右ペナルティエリアの上下辺の延長線上にぴったり重なる。
- 「ビエルサライン」ON: 金色の破線が各ゴール前に2本ずつ。端点がゴールポスト（ゴール枠の両端）とPA奥角に一致する。
- 「5レーン」だけOFFにするとレーン線だけ消える（ビエルサラインは残る）。
- 縦表示に切り替えると両ガイドが縦向きに追従する（レーン線は縦断4本、ビエルサラインは上下のゴール前）。
- ガイド表示中に選手・ボールをドラッグできる。ペンで線も描け、手描き線がガイドの上に表示される。
- 再読み込みでガイド表示が復元される。
- スクリーンショット（`browser_take_screenshot`）で横・縦それぞれの見た目を確認。

- [ ] **Step 8: コミット**

```bash
git add index.html app.js styles.css
git commit -m "SVGガイドレイヤーと5レーン線・ビエルサラインの描画を追加"
```

---

## Task 3: 3ゾーン（サード）の色分け塗りと境界線

「3ゾーン」ONでピッチを長さ方向に3等分し、ディフェンシブ=青・ミドル=黄・アタッキング=赤の薄い塗り＋境界線2本を表示する。

**Files:**
- Modify: `app.js`（ガイド定数 `GUIDE_BIELSA_LINES` の直後、`renderGuides` 冒頭、`createGuideLine` の直後にヘルパー追加）
- Modify: `styles.css`（`.guides-layer .guide-bielsa` ルールの直後）

**Interfaces:**
- Consumes: `renderGuides`・`createGuideLine`・`GUIDE_PITCH`・`els.guidesLayer`（Task 2）、`state.guides.thirds`（Task 1）、`toScreenPosition`・`SVG_NS`（既存）
- Produces:
  - `GUIDE_THIRDS: { from: number, to: number, className: string }[]` — 各サードの x 範囲とクラス。
  - `GUIDE_THIRD_LINE_XS: number[]` — 境界線の x 値2つ。
  - `createGuideRect(fromX: number, toX: number, className: string): SVGRectElement` — x 範囲（y はピッチ全幅）の矩形。縦横どちらでも正しい向きに変換される。

- [ ] **Step 1: 3ゾーンの定数を追加**

`GUIDE_BIELSA_LINES` の直後に追加する。ピッチ有効面（3.5〜96.5、幅93%）の3等分で、境界は x = 34.5 / 65.5。味方は左→右へ攻めるため右側1/3がアタッキングサード。

```js
const GUIDE_THIRDS = [
  { from: 3.5, to: 34.5, className: "guide-third defensive" },
  { from: 34.5, to: 65.5, className: "guide-third middle" },
  { from: 65.5, to: 96.5, className: "guide-third attacking" },
];
const GUIDE_THIRD_LINE_XS = [34.5, 65.5];
```

- [ ] **Step 2: renderGuides に3ゾーン描画を追加**

塗りが最背面になるよう、`renderGuides` の `replaceChildren()` 直後（レーン線より前）に挿入する。

変更前:
```js
function renderGuides() {
  const svg = els.guidesLayer;
  svg.replaceChildren();

  if (state.guides.lanes) {
```
変更後:
```js
function renderGuides() {
  const svg = els.guidesLayer;
  svg.replaceChildren();

  if (state.guides.thirds) {
    GUIDE_THIRDS.forEach((third) => {
      svg.appendChild(createGuideRect(third.from, third.to, third.className));
    });
    GUIDE_THIRD_LINE_XS.forEach((x) => {
      svg.appendChild(
        createGuideLine({ x, y: GUIDE_PITCH.min }, { x, y: GUIDE_PITCH.max }, "guide-third-line"),
      );
    });
  }

  if (state.guides.lanes) {
```

- [ ] **Step 3: createGuideRect を追加**

`createGuideLine` 関数の直後に新規追加する。対角2点を変換してから min/abs で正規化するため、縦表示（top = 100 − x で上下が反転する）でも矩形が正しく作られる。

```js
function createGuideRect(fromX, toX, className) {
  const a = toScreenPosition({ x: fromX, y: GUIDE_PITCH.min });
  const b = toScreenPosition({ x: toX, y: GUIDE_PITCH.max });
  const rect = document.createElementNS(SVG_NS, "rect");
  rect.setAttribute("x", `${Math.min(a.left, b.left)}%`);
  rect.setAttribute("y", `${Math.min(a.top, b.top)}%`);
  rect.setAttribute("width", `${Math.abs(b.left - a.left)}%`);
  rect.setAttribute("height", `${Math.abs(b.top - a.top)}%`);
  rect.setAttribute("class", className);
  return rect;
}
```

- [ ] **Step 4: styles.css に3ゾーンのスタイルを追加**

`.guides-layer .guide-bielsa { ... }` ルールの直後に追加する。

```css
.guides-layer .guide-third {
  stroke: none;
}

.guides-layer .guide-third.defensive {
  fill: rgba(31, 99, 209, 0.13);
}

.guides-layer .guide-third.middle {
  fill: rgba(240, 201, 76, 0.1);
}

.guides-layer .guide-third.attacking {
  fill: rgba(215, 66, 63, 0.13);
}

.guides-layer .guide-third-line {
  stroke: rgba(255, 255, 255, 0.35);
  stroke-width: 1.5px;
}
```

- [ ] **Step 5: ブラウザで確認**

dev サーバを起動し、http://127.0.0.1:4173/ を開く。
- 「3ゾーン」ON: 横表示で左から青→黄→赤の薄い塗り3枚と白い細線2本。右側1/3（相手ゴール側）が赤。
- 縦表示に切り替えると上から赤→黄→青（上側=相手ゴール=アタッキングサードが赤）。
- 芝の縞・白いマーキング・選手番号が塗り越しにはっきり読める（濃すぎない）。
- 3ガイド全部ONでも判別できる: 塗りが最背面、白点線レーン・金破線ビエルサラインがその上。
- 3ゾーンだけOFFにすると塗りと境界線だけ消える。
- スクリーンショットで横・縦の見た目を確認。

- [ ] **Step 6: 最終受け入れ確認（スペックのテスト計画）**

1. 3つのトグルそれぞれのON/OFFで該当ガイドのみが表示/非表示になる。
2. 任意の組み合わせでONにして再読み込み→表示状態とボタン押下表示が復元される。
3. 縦⇔横切替でガイドが追従し、レーン外側線がPA辺の延長、ビエルサライン端点がポスト・PA奥角と一致する。
4. ガイド表示中に選手・ボールのドラッグ、ペン/矢印の手描き、Undo/全消去が従来どおり動く。
5. 「ボードリセット」でガイド表示状態が変わらない。
6. モバイル幅（`browser_resize` 390x844）でツールバーが折り返して3ボタンとも押せる。

- [ ] **Step 7: コミット**

```bash
git add app.js styles.css
git commit -m "3ゾーンの色分け塗りと境界線を追加"
```

---

## 完了時の最終確認（受け入れ条件）

- [ ] 5レーン=白点線4本・ビエルサライン=金破線4本（両ゴール）・3ゾーン=青黄赤の塗り＋境界線2本が、それぞれ独立トグルで表示/非表示できる。
- [ ] 表示状態がリロード後も維持される（localStorage、欠損時は全OFF）。
- [ ] 縦横どちらの表示でも形状・向きが正しい（アタッキングサード: 横=右、縦=上）。
- [ ] ガイドが選手ドラッグ・手描き入力を妨げず、手描き線・選手はガイドより上に表示される。
- [ ] 既存機能（配置反映・交代・登録・リセット・縦横切替・手描き）に退行がない。

## Self-Review メモ

- Spec coverage: UI/3ボタン(Task1)・状態と永続化(Task1)・SVGレイヤーと重なり順(Task2)・5レーン(Task2)・ビエルサライン(Task2)・3ゾーン塗り＋境界線(Task3)・スタイル値(Task2/3、スペックの表と同値)・テスト計画(Task3 Step6)を網羅。
- 型/名称整合: `sanitizeGuides` / `toggleGuide` / `applyGuideButtons`（Task1）、`renderGuides` / `createGuideLine` / `GUIDE_PITCH` / `GUIDE_LANE_YS` / `GUIDE_BIELSA_LINES`（Task2）、`createGuideRect` / `GUIDE_THIRDS` / `GUIDE_THIRD_LINE_XS`（Task3）— 定義と利用箇所が一致。
- プレースホルダなし: 各ステップに実コード・実コマンド・期待結果を記載。
