# 選手の向き表示＋フリー描画 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 選手コマに「体の向き」（背中側の弧＋回転ハンドル）を追加し、ピッチ上にフリーハンドの線・矢印を4色で描けるようにする。

**Architecture:** 向きは選手オブジェクトの `dir`（ピッチ座標系の度数、0°=相手ゴール方向・時計回り）として保存し、CSS変数 `--dir-screen` で弧とハンドルを回転させる。線は `state.drawings`（ピッチ座標0〜100の点列）として保存し、`#field` 内の SVG レイヤーにピクセル座標へ変換して描画する。どちらも既存の `toScreenPosition` / `fromScreenFraction` と同じ縦横変換を通すため、縦表示でも自動で正しく回る。

**Tech Stack:** バニラ HTML / CSS / JavaScript（ビルド・依存追加なし）。ローカル確認は `node dev-server.js`（http://127.0.0.1:4173/）+ ブラウザ（Playwright MCP 利用可）。

## Global Constraints

- 依存ライブラリ・ビルドステップを増やさない（バニラ HTML/CSS/JS のまま）。
- 既存の localStorage データ（`dir`・`drawings` なし）はそのまま読めること（後方互換）。`dir` は味方 `0`・相手 `180` で補完、`drawings` は `[]` で補完。
- `dir` はピッチ座標系: 0°=+x（相手ゴール方向、横表示の右）、時計回り（yは下向きが正）、0〜360 に正規化。画面角度は横表示 `dir` そのまま、縦表示 `dir − 90°`。
- 線の座標はピッチ座標（0〜100）。色は `yellow` / `red` / `blue` / `white` の4値、ツールは `pen` / `arrow` の2値のみ。
- 上限: ストローク300本・1本600点。不正データは読み込み時に除外。
- ボールに向き・回転ハンドルは付けない。
- 既存機能（配置反映・交代・登録・ドラッグ・キー移動・縦横切替・保存）を壊さない。

---

## File Structure

- `index.html` — `#field` 内に `<svg id="drawLayer">`（Task 3）、スコア帯とフィールドの間に描画ツールバー（Task 4）を追加。
- `app.js` — `dir` のデータ層と弧の描画（Task 1）、回転ハンドルのドラッグ（Task 2）、`drawings` の state/保存/SVG描画（Task 3）、ツールバーと描画操作（Task 4）。
- `styles.css` — `.dir-arc`（Task 1）、`.dir-handle`（Task 2）、`.draw-layer`（Task 3）、ツールバーと `draw-mode`（Task 4）。

各タスクは独立してブラウザで確認・コミットできる。

---

## Task 1: 選手の向き — データ層と背中側の弧

選手（味方・相手）が `dir` を持ち、コマの円の背中側に濃い色の弧（三日月）が表示される。この時点では向きは初期値（味方0°・相手180°）のまま変えられない（回転操作は Task 2）。

**Files:**
- Modify: `app.js`（`sanitizeHomePlayers` 234-245、`createDefaultHomePlayers` 247-261、`createDefaultOpponents` 263-272、`sanitizeOpponents` 274-289、`applyFormationToHome` 339-346、`applyFormationToOpponents` 348-355、`createPlayerToken` 393-417、ファイル末尾のヘルパー群）
- Modify: `styles.css`（`.player-token` 群 439-499 の付近に追記）

**Interfaces:**
- Produces:
  - 選手オブジェクトの `dir: number`（0〜360、ピッチ座標系）
  - `normalizeDir(value, fallback): number` — 数値でなければ `fallback`、それ以外は 0〜360 に正規化。
  - `toScreenAngle(dir): number` — ピッチ角度→画面角度（縦表示は `dir - 90`）。
  - `applyTokenDirection(token, player): void` — トークンの CSS 変数 `--dir-screen` を `toScreenAngle(player.dir)` に設定。
  - トークン内の `<span class="dir-arc">`（弧。CSS のみで描画、`pointer-events: none` 相当の装飾）

- [ ] **Step 1: normalizeDir ヘルパーを追加**

`app.js` 末尾の `clamp` 関数の直前に追加する。

```js
function normalizeDir(value, fallback) {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return ((num % 360) + 360) % 360;
}
```

- [ ] **Step 2: 角度の画面変換と CSS 変数設定のヘルパーを追加**

`setTokenPosition` 関数（918行付近）の直後に追加する。

```js
function applyTokenDirection(token, player) {
  token.style.setProperty("--dir-screen", `${toScreenAngle(player.dir)}deg`);
}

function toScreenAngle(dir) {
  return state.orientation === "vertical" ? dir - 90 : dir;
}
```

- [ ] **Step 3: データ層に dir を追加（サニタイズ・デフォルト・フォーメーション適用）**

`sanitizeHomePlayers` の map に1行追加。

変更前:
```js
      onField: Boolean(player.onField),
      x: clamp(Number(player.x) || 50, 4, 96),
      y: clamp(Number(player.y) || 50, 6, 94),
```
変更後:
```js
      onField: Boolean(player.onField),
      x: clamp(Number(player.x) || 50, 4, 96),
      y: clamp(Number(player.y) || 50, 6, 94),
      dir: normalizeDir(player.dir, 0),
```

`createDefaultHomePlayers` の return に1行追加。

変更前:
```js
      onField: isStarter,
      x: position[0],
      y: position[1],
```
変更後:
```js
      onField: isStarter,
      x: position[0],
      y: position[1],
      dir: 0,
```

`createDefaultOpponents` の map に1行追加。

変更前:
```js
    x: 100 - x,
    y,
  }));
```
変更後:
```js
    x: 100 - x,
    y,
    dir: 180,
  }));
```

`sanitizeOpponents` の return に1行追加。

変更前:
```js
      x: clamp(Number(player.x) || 100 - fallback[0], 4, 96),
      y: clamp(Number(player.y) || fallback[1], 6, 94),
    };
```
変更後:
```js
      x: clamp(Number(player.x) || 100 - fallback[0], 4, 96),
      y: clamp(Number(player.y) || fallback[1], 6, 94),
      dir: normalizeDir(player.dir, 180),
    };
```

`applyFormationToHome` に1行追加（配置し直し＝向きも初期化）。

変更前:
```js
    player.x = position[0];
    player.y = position[1];
  });
```
変更後:
```js
    player.x = position[0];
    player.y = position[1];
    player.dir = 0;
  });
```

`applyFormationToOpponents` に1行追加。

変更前:
```js
    player.x = 100 - position[0];
    player.y = position[1];
  });
```
変更後:
```js
    player.x = 100 - position[0];
    player.y = position[1];
    player.dir = 180;
  });
```

- [ ] **Step 4: createPlayerToken で向きを適用し、弧の要素を追加**

変更前:
```js
  token.dataset.id = player.id;
  setTokenPosition(token, player);
  token.setAttribute("aria-label", `${team === "home" ? "味方" : "相手"} ${displayNumber(player)}`);
```
変更後:
```js
  token.dataset.id = player.id;
  setTokenPosition(token, player);
  applyTokenDirection(token, player);
  token.setAttribute("aria-label", `${team === "home" ? "味方" : "相手"} ${displayNumber(player)}`);
```

同じ関数内、name-tag ブロックの直後（`token.addEventListener("pointerdown", startDrag);` の直前）に追加:

```js
  const arc = document.createElement("span");
  arc.className = "dir-arc";
  token.appendChild(arc);
```

- [ ] **Step 5: 弧の CSS を追加**

`styles.css` の `.player-token .name-tag { ... }` ルール（476-488行付近）の直後に追加する。

```css
.player-token .dir-arc {
  position: absolute;
  top: calc(var(--token) / 2);
  left: 50%;
  width: calc(var(--token) + 10px);
  height: calc(var(--token) + 10px);
  border-radius: 50%;
  background: conic-gradient(
    from 180deg,
    var(--arc-color, rgba(23, 33, 27, 0.85)) 0 180deg,
    transparent 180deg 360deg
  );
  transform: translate(-50%, -50%) rotate(var(--dir-screen, 0deg));
  pointer-events: none;
  z-index: -1;
}

.player-token.home .dir-arc {
  --arc-color: var(--home-deep);
}

.player-token.away .dir-arc {
  --arc-color: var(--away-deep);
}
```

設計意図（実装の参考）:
- `conic-gradient(from 180deg, 色 0 180deg, ...)` は円の**左半分**を塗る。`--dir-screen: 0deg`（右向き）のとき左半分＝背中側になり、`rotate()` で向きに追従する。
- `.player-token` は `transform` を持つためスタッキングコンテキストになり、`z-index: -1` の弧は円（`.number`）の背後・フィールドの手前に入る。円より 10px 大きい半円が背中側だけ 5px はみ出し、三日月に見える。
- 弧の中心は円の中心（トークン上端から `--token`/2）。name-tag の位置は変えない。

- [ ] **Step 6: ブラウザで確認**

`node dev-server.js` を起動し、http://127.0.0.1:4173/ を開く（Playwright MCP 可）。**開始前に DevTools か `browser_evaluate` で `localStorage.clear()` してからリロードすると初期状態で確認できる**（既存データ確認は後述）。

- 横表示: 味方コマの**左側**（自陣側）に濃い青の三日月、相手コマの**右側**に濃い赤の三日月が見える（互いに向き合っている）。
- 縦表示に切り替え: 味方の三日月が**下側**（味方は上向き）、相手の三日月が**上側**になる。
- ドラッグ移動・選択・交代・リロード後の保持が従来どおり動く。
- 後方互換: `browser_evaluate` で `JSON.parse(localStorage.getItem("soccer-board-state-v1")).homePlayers[0].dir` が数値（0）であること。Task 1 より前に保存された `dir` なしデータでも開けること（`localStorage` の payload から `dir` キーを消して reload しても壊れない）。

- [ ] **Step 7: コミット**

```bash
git add app.js styles.css
git commit -m "選手に向き（dir）を追加し背中側の弧を表示"
```

---

## Task 2: 回転ハンドル

選択中の選手コマに、向いている方向の少し外側に金色の丸ハンドルが表示され、ドラッグすると向きが回る。

**Files:**
- Modify: `app.js`（`activeDrag` 宣言 92行付近、`createPlayerToken`、`endDrag` の後ろに回転処理3関数、`toScreenAngle` の隣に逆変換）
- Modify: `styles.css`（`.dir-arc` ルールの直後）

**Interfaces:**
- Consumes: `applyTokenDirection` / `normalizeDir`（Task 1）、`selectPlayer` / `findPlayer` / `saveState`（既存）
- Produces:
  - `fromScreenAngle(angle): number` — 画面角度→ピッチ角度（縦表示は `+90`）、0〜360 に正規化。
  - `startRotate(event): void` — `.dir-handle` の pointerdown ハンドラ。`stopPropagation` で本体の移動ドラッグと分離。
  - トークン内の `<span class="dir-handle">`（選択中のみ表示）

- [ ] **Step 1: activeRotate 変数を追加**

変更前:
```js
let activeDrag = null;
```
変更後:
```js
let activeDrag = null;
let activeRotate = null;
```

- [ ] **Step 2: fromScreenAngle を追加**

`toScreenAngle` 関数の直後に追加する。

```js
function fromScreenAngle(angle) {
  const dir = state.orientation === "vertical" ? angle + 90 : angle;
  return normalizeDir(dir, 0);
}
```

- [ ] **Step 3: 回転ドラッグの処理を追加**

`endDrag` 関数の直後に追加する。

```js
function startRotate(event) {
  if (event.button !== undefined && event.button > 0) return;
  event.preventDefault();
  event.stopPropagation();

  const token = event.currentTarget.closest(".player-token");
  if (!token) return;
  selectPlayer(token.dataset.team, token.dataset.id);

  activeRotate = {
    team: token.dataset.team,
    id: token.dataset.id,
    token,
    circle: token.querySelector(".number"),
  };
  window.addEventListener("pointermove", moveRotate);
  window.addEventListener("pointerup", endRotate, { once: true });
}

function moveRotate(event) {
  if (!activeRotate) return;
  const player = findPlayer(activeRotate.team, activeRotate.id);
  if (!player || !activeRotate.circle) return;

  const rect = activeRotate.circle.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;
  const screenAngle =
    (Math.atan2(event.clientY - centerY, event.clientX - centerX) * 180) / Math.PI;
  player.dir = fromScreenAngle(screenAngle);
  applyTokenDirection(activeRotate.token, player);
}

function endRotate() {
  if (activeRotate) saveState();
  activeRotate = null;
  window.removeEventListener("pointermove", moveRotate);
}
```

- [ ] **Step 4: createPlayerToken にハンドルを追加**

Task 1 で追加した弧のブロックの直後（`token.addEventListener("pointerdown", startDrag);` の直前）に追加:

```js
  const handle = document.createElement("span");
  handle.className = "dir-handle";
  handle.addEventListener("pointerdown", startRotate);
  token.appendChild(handle);
```

- [ ] **Step 5: ハンドルの CSS を追加**

`styles.css` の `.player-token.away .dir-arc { ... }` の直後に追加する。

```css
.player-token .dir-handle {
  position: absolute;
  top: calc(var(--token) / 2);
  left: 50%;
  width: 16px;
  height: 16px;
  margin: -8px 0 0 -8px;
  border-radius: 50%;
  background: var(--gold);
  border: 2px solid #fff;
  box-shadow: 0 2px 8px rgba(10, 20, 14, 0.4);
  transform: rotate(var(--dir-screen, 0deg)) translateX(calc(var(--token) / 2 + 14px));
  display: none;
  cursor: grab;
  z-index: 2;
}

.player-token .dir-handle::before {
  content: "";
  position: absolute;
  inset: -8px;
}

.player-token.selected .dir-handle {
  display: block;
}
```

設計意図（実装の参考）:
- ハンドル自身の中心を円の中心に置き（`top`/`left`＋負マージン）、`rotate() translateX()` で「円の中心から `--dir-screen` の方向へ半径＋14px」の位置に出す。transform-origin は要素中心＝円の中心なので、回転の中心がずれない。
- `::before` の `inset: -8px` はタッチ用の当たり判定拡大（見た目は 16px のまま）。
- 表示は `.player-token.selected` のときのみ。`syncSelectedTokens` がクラスを付け外しするだけで表示が切り替わるので、JS 側の追加処理は不要。

- [ ] **Step 6: ブラウザで確認**

- 選手をクリックで選択 → 向いている方向の外側に金色ハンドルが表示される。選択解除・別選手選択で消える/移る。
- ハンドルをドラッグ → コマ中心からポインタの方向に弧が滑らかに追従する。離してリロードしても向きが保持される。
- 味方・相手の両方で回せる。ボールにはハンドルが出ない。
- ハンドル以外（円本体）のドラッグは従来どおり**移動**になる（回転しない）。
- 縦表示に切り替えて回転 → ポインタの方向と弧の向きが一致する。縦で設定した向きが横に戻しても整合している（例: 縦で上向き＝横で右向き）。
- 「反映」を押すと味方の向きが初期値（右向き）に戻る。「ボードリセット」で味方・相手とも初期向きに戻る。

- [ ] **Step 7: コミット**

```bash
git add app.js styles.css
git commit -m "選手の回転ハンドルで向きを変更できるようにする"
```

---

## Task 3: 描画データ層と SVG レンダリング

`state.drawings` の保存・読み込み・検証と、SVG レイヤーへの描画（線＋矢印の頭）ができる。この時点では手描き入力の UI はなく、データを注入して確認する（入力は Task 4）。

**Files:**
- Modify: `index.html`（`#playersLayer` の直前）
- Modify: `app.js`（定数群 1-2行付近、`els` 59-80、`state` 82-90、`activeDrag` 宣言部、`loadState` 183-215、`saveState` 217-232、`sanitizeBall` の後ろ、`resetBoard` 302-312、`renderAll` 364-375、`renderFieldPlayers` の後ろ、`bindEvents`）
- Modify: `styles.css`（`.players-layer` ルール 433-437 の直前）

**Interfaces:**
- Consumes: `toScreenPosition` / `clamp` / `makeId`（既存）
- Produces:
  - `state.drawings: Array<{ id, tool: "pen"|"arrow", color: "yellow"|"red"|"blue"|"white", points: {x,y}[] }>`
  - `let activeStroke` — 描画中ストローク（Task 4 が設定。`renderDrawings` がプレビュー描画に使う）
  - `DRAW_COLORS: Record<color, string>`、`MAX_STROKES = 300`、`MAX_STROKE_POINTS = 600`、`SVG_NS`
  - `sanitizeDrawings(drawings): stroke[]`
  - `renderDrawings(): void` — viewBox をフィールド実寸に合わせ、全ストローク＋`activeStroke` を再描画。
  - `els.drawLayer: SVGSVGElement`

- [ ] **Step 1: index.html に SVG レイヤーを追加**

変更前:
```html
              <div class="field-marking goal right"></div>
              <div id="playersLayer" class="players-layer"></div>
```
変更後:
```html
              <div class="field-marking goal right"></div>
              <svg id="drawLayer" class="draw-layer" aria-hidden="true"></svg>
              <div id="playersLayer" class="players-layer"></div>
```

- [ ] **Step 2: app.js に定数を追加**

ファイル先頭、`const DEFAULT_FORMATION = "4-4-2";` の直後に追加する。

```js
const SVG_NS = "http://www.w3.org/2000/svg";
const DRAW_COLORS = {
  yellow: "#f5d90a",
  red: "#ef4444",
  blue: "#3b82f6",
  white: "#ffffff",
};
const MAX_STROKES = 300;
const MAX_STROKE_POINTS = 600;
```

- [ ] **Step 3: els・state・activeStroke を追加**

`els` の `playersLayer` の行の直後に追加:

```js
  drawLayer: document.querySelector("#drawLayer"),
```

`state` リテラルに追加（`orientation` の行の直後）:

```js
  drawings: [],
```

`let activeRotate = null;` の直後に追加:

```js
let activeStroke = null;
```

- [ ] **Step 4: sanitizeDrawings を追加し、load/save/reset に組み込む**

`sanitizeBall` 関数の直後に追加する。

```js
function sanitizeDrawings(drawings) {
  if (!Array.isArray(drawings)) return [];
  return drawings
    .filter((stroke) => stroke && typeof stroke === "object")
    .filter((stroke) => (stroke.tool === "pen" || stroke.tool === "arrow") && DRAW_COLORS[stroke.color])
    .map((stroke) => ({
      id: String(stroke.id || makeId("draw")),
      tool: stroke.tool,
      color: stroke.color,
      points: (Array.isArray(stroke.points) ? stroke.points : [])
        .slice(0, MAX_STROKE_POINTS)
        .map((point) => ({
          x: clamp(Number(point?.x) || 0, 0, 100),
          y: clamp(Number(point?.y) || 0, 0, 100),
        })),
    }))
    .filter((stroke) => stroke.points.length >= 2)
    .slice(0, MAX_STROKES);
}
```

`loadState` に追加。

変更前:
```js
  state.ball = sanitizeBall(saved?.ball);
  state.orientation = saved?.orientation === "vertical" ? "vertical" : "horizontal";
```
変更後:
```js
  state.ball = sanitizeBall(saved?.ball);
  state.drawings = sanitizeDrawings(saved?.drawings);
  state.orientation = saved?.orientation === "vertical" ? "vertical" : "horizontal";
```

`saveState` の payload に追加。

変更前:
```js
    ball: state.ball,
    notes: state.notes,
    orientation: state.orientation,
```
変更後:
```js
    ball: state.ball,
    drawings: state.drawings,
    notes: state.notes,
    orientation: state.orientation,
```

`resetBoard` に追加（ボードリセットで線も全消去）。

変更前:
```js
  state.ball = createDefaultBall();
  state.selected = null;
  state.notes = "";
```
変更後:
```js
  state.ball = createDefaultBall();
  state.drawings = [];
  state.selected = null;
  state.notes = "";
```

- [ ] **Step 5: SVG 描画関数を追加**

`renderFieldPlayers` 関数の直後に追加する。

```js
function renderDrawings() {
  const svg = els.drawLayer;
  const rect = svg.getBoundingClientRect();
  const width = Math.max(1, rect.width);
  const height = Math.max(1, rect.height);
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.replaceChildren();
  state.drawings.forEach((stroke) => appendStrokeElements(svg, stroke, width, height));
  if (activeStroke && activeStroke.points.length >= 2) {
    appendStrokeElements(svg, activeStroke, width, height);
  }
}

function appendStrokeElements(svg, stroke, width, height) {
  const path = document.createElementNS(SVG_NS, "path");
  path.setAttribute("d", buildStrokePath(stroke.points, width, height));
  path.setAttribute("fill", "none");
  path.setAttribute("stroke", DRAW_COLORS[stroke.color]);
  path.setAttribute("stroke-width", "3");
  path.setAttribute("stroke-linecap", "round");
  path.setAttribute("stroke-linejoin", "round");
  path.setAttribute("opacity", "0.92");
  svg.appendChild(path);

  if (stroke.tool === "arrow" && stroke.points.length >= 2) {
    svg.appendChild(createArrowHead(stroke, width, height));
  }
}

function buildStrokePath(points, width, height) {
  return points
    .map((point, index) => {
      const pixel = strokePointToPixel(point, width, height);
      return `${index === 0 ? "M" : "L"}${pixel.x.toFixed(1)} ${pixel.y.toFixed(1)}`;
    })
    .join(" ");
}

function strokePointToPixel(point, width, height) {
  const position = toScreenPosition(point);
  return { x: (position.left / 100) * width, y: (position.top / 100) * height };
}

function createArrowHead(stroke, width, height) {
  const points = stroke.points;
  const tip = strokePointToPixel(points[points.length - 1], width, height);
  let baseIndex = points.length - 2;
  let base = strokePointToPixel(points[baseIndex], width, height);
  while (baseIndex > 0 && Math.hypot(tip.x - base.x, tip.y - base.y) < 6) {
    baseIndex -= 1;
    base = strokePointToPixel(points[baseIndex], width, height);
  }
  const angle = Math.atan2(tip.y - base.y, tip.x - base.x);
  const size = 11;
  const spread = 0.5;
  const left = {
    x: tip.x - size * Math.cos(angle - spread),
    y: tip.y - size * Math.sin(angle - spread),
  };
  const right = {
    x: tip.x - size * Math.cos(angle + spread),
    y: tip.y - size * Math.sin(angle + spread),
  };
  const polygon = document.createElementNS(SVG_NS, "polygon");
  polygon.setAttribute(
    "points",
    `${tip.x.toFixed(1)},${tip.y.toFixed(1)} ${left.x.toFixed(1)},${left.y.toFixed(1)} ${right.x.toFixed(1)},${right.y.toFixed(1)}`,
  );
  polygon.setAttribute("fill", DRAW_COLORS[stroke.color]);
  polygon.setAttribute("opacity", "0.92");
  return polygon;
}
```

設計意図（実装の参考）:
- viewBox をフィールドの実ピクセルに合わせるので、線幅・矢印サイズが縦横比の影響を受けず一定になる。
- 矢印の頭は、終点から 6px 以上離れた過去の点を基準に向きを計算する（最後の1区間だけだと手ぶれで向きが暴れるため）。
- `activeStroke` は Task 4 のなぞり中プレビュー用。Task 3 時点では常に `null`。

- [ ] **Step 6: renderAll とリサイズで再描画**

`renderAll` に追加。

変更前:
```js
  renderFieldPlayers();
  renderCounts();
```
変更後:
```js
  renderFieldPlayers();
  renderDrawings();
  renderCounts();
```

`bindEvents` の末尾（`els.boardNotes` ブロックの直後）に追加:

```js
  window.addEventListener("resize", renderDrawings);
```

- [ ] **Step 7: .draw-layer の CSS を追加**

`styles.css` の `.players-layer { ... }` ルールの直前に追加する。

```css
.draw-layer {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  z-index: 1;
  pointer-events: none;
}
```

（`.players-layer` は `z-index: 2` なので線は**選手の下**に描かれる。DOM 上はマーキングの後なので芝・ラインより上。）

- [ ] **Step 8: ブラウザで確認（データ注入）**

dev サーバを起動し、http://127.0.0.1:4173/ を開き、`browser_evaluate`（または DevTools コンソール）で実行:

```js
const key = "soccer-board-state-v1";
const saved = JSON.parse(localStorage.getItem(key) || "{}");
saved.drawings = [
  { id: "d1", tool: "pen", color: "yellow", points: [{ x: 20, y: 20 }, { x: 40, y: 30 }, { x: 55, y: 25 }] },
  { id: "d2", tool: "arrow", color: "red", points: [{ x: 60, y: 70 }, { x: 75, y: 55 }] },
];
localStorage.setItem(key, JSON.stringify(saved));
location.reload();
```

- 黄色の折れ線と、赤の線＋終点に赤い三角の矢印が表示される。線は選手コマの**下**（コマが上に重なる）。
- 選手のドラッグが従来どおり動く（SVG がクリックを奪わない）。
- 縦表示に切り替えると線も一緒に回る（横で左下→右上の矢印が、縦では対応する向きになる）。ウィンドウリサイズしても線がピッチに追従する。
- リロードしても線が残る。「ボードリセット」で線が消える。
- 不正データ耐性: `saved.drawings = [{ tool: "zigzag", color: "yellow", points: [{x:1,y:1},{x:2,y:2}] }, { tool: "pen", color: "red", points: [{x:5,y:5}] }, "garbage"]` を保存してリロードしても壊れず、線が1本も表示されない（すべて除外される）。

- [ ] **Step 9: コミット**

```bash
git add index.html app.js styles.css
git commit -m "線データの保存とSVG描画レイヤーを追加"
```

---

## Task 4: 描画ツールバーと手描き入力

ツールバー（移動/ペン/矢印・色4つ・1つ戻す/全消去）で、フィールドに手描きで線・矢印を描ける。

**Files:**
- Modify: `index.html`（`.score-strip` と `.field-shell` の間）
- Modify: `app.js`（`els`、`activeStroke` 宣言部、`bindEvents`、`endDrag` の後ろに描画入力4関数＋モード切替2関数）
- Modify: `styles.css`（`.score-strip` 群の後ろ、`.field.draw-mode` ルール）

**Interfaces:**
- Consumes: `state.drawings` / `activeStroke` / `renderDrawings` / `MAX_STROKES` / `MAX_STROKE_POINTS`（Task 3）、`fromScreenFraction` / `clamp` / `makeId` / `saveState`（既存）
- Produces:
  - `let drawTool: "move" | "pen" | "arrow"`（初期値 `"move"`）、`let drawColor: "yellow" | "red" | "blue" | "white"`（初期値 `"yellow"`）
  - `setDrawTool(tool): void` / `setDrawColor(color): void` — ボタンの `aria-pressed` と `#field` の `draw-mode` クラスを同期。
  - `startDrawStroke(event): void` — `#drawLayer` の pointerdown ハンドラ。

- [ ] **Step 1: index.html にツールバーを追加**

変更前:
```html
          </div>

          <div class="field-shell">
```
変更後（`.score-strip` の閉じ `</div>` と `.field-shell` の間）:
```html
          </div>

          <div class="draw-toolbar" aria-label="描画ツール">
            <div class="tool-group" role="group" aria-label="モード">
              <button id="toolMoveBtn" class="tool-button" type="button" aria-pressed="true">移動</button>
              <button id="toolPenBtn" class="tool-button" type="button" aria-pressed="false">ペン</button>
              <button id="toolArrowBtn" class="tool-button" type="button" aria-pressed="false">矢印</button>
            </div>
            <div class="tool-group" role="group" aria-label="線の色">
              <button class="color-swatch yellow" type="button" data-color="yellow" aria-label="黄" aria-pressed="true"></button>
              <button class="color-swatch red" type="button" data-color="red" aria-label="赤" aria-pressed="false"></button>
              <button class="color-swatch blue" type="button" data-color="blue" aria-label="青" aria-pressed="false"></button>
              <button class="color-swatch white" type="button" data-color="white" aria-label="白" aria-pressed="false"></button>
            </div>
            <div class="tool-group">
              <button id="undoDrawBtn" class="tool-button" type="button">1つ戻す</button>
              <button id="clearDrawBtn" class="tool-button" type="button">全消去</button>
            </div>
          </div>

          <div class="field-shell">
```

- [ ] **Step 2: els とモード変数を追加**

`els` の `drawLayer` の行の直後に追加:

```js
  toolMoveBtn: document.querySelector("#toolMoveBtn"),
  toolPenBtn: document.querySelector("#toolPenBtn"),
  toolArrowBtn: document.querySelector("#toolArrowBtn"),
  colorSwatches: document.querySelectorAll(".color-swatch"),
  undoDrawBtn: document.querySelector("#undoDrawBtn"),
  clearDrawBtn: document.querySelector("#clearDrawBtn"),
```

`let activeStroke = null;` の直後に追加:

```js
let drawTool = "move";
let drawColor = "yellow";
```

- [ ] **Step 3: モード切替と描画入力の関数を追加**

`endRotate` 関数（Task 2）の直後に追加する。

```js
function setDrawTool(tool) {
  drawTool = tool;
  els.toolMoveBtn.setAttribute("aria-pressed", String(tool === "move"));
  els.toolPenBtn.setAttribute("aria-pressed", String(tool === "pen"));
  els.toolArrowBtn.setAttribute("aria-pressed", String(tool === "arrow"));
  els.field.classList.toggle("draw-mode", tool !== "move");
}

function setDrawColor(color) {
  if (!DRAW_COLORS[color]) return;
  drawColor = color;
  els.colorSwatches.forEach((swatch) => {
    swatch.setAttribute("aria-pressed", String(swatch.dataset.color === color));
  });
}

function startDrawStroke(event) {
  if (drawTool === "move") return;
  if (event.button !== undefined && event.button > 0) return;
  event.preventDefault();

  activeStroke = {
    id: makeId("draw"),
    tool: drawTool,
    color: drawColor,
    points: [drawPointFromEvent(event)],
  };
  els.drawLayer.setPointerCapture(event.pointerId);
  els.drawLayer.addEventListener("pointermove", moveDrawStroke);
  els.drawLayer.addEventListener("pointerup", endDrawStroke);
  els.drawLayer.addEventListener("pointercancel", endDrawStroke);
}

function moveDrawStroke(event) {
  if (!activeStroke) return;
  if (activeStroke.points.length >= MAX_STROKE_POINTS) return;
  const point = drawPointFromEvent(event);
  const last = activeStroke.points[activeStroke.points.length - 1];
  if (Math.hypot(point.x - last.x, point.y - last.y) < 0.8) return;
  activeStroke.points.push(point);
  renderDrawings();
}

function endDrawStroke() {
  els.drawLayer.removeEventListener("pointermove", moveDrawStroke);
  els.drawLayer.removeEventListener("pointerup", endDrawStroke);
  els.drawLayer.removeEventListener("pointercancel", endDrawStroke);
  if (activeStroke && activeStroke.points.length >= 2 && state.drawings.length < MAX_STROKES) {
    state.drawings.push(activeStroke);
    saveState();
  }
  activeStroke = null;
  renderDrawings();
}

function drawPointFromEvent(event) {
  const rect = els.drawLayer.getBoundingClientRect();
  const fx = clamp(((event.clientX - rect.left) / rect.width) * 100, 0, 100);
  const fy = clamp(((event.clientY - rect.top) / rect.height) * 100, 0, 100);
  const data = fromScreenFraction(fx, fy);
  return { x: clamp(data.x, 0, 100), y: clamp(data.y, 0, 100) };
}
```

設計意図（実装の参考）:
- 点の間引きはピッチ座標で 0.8 未満の移動を無視（データ肥大防止）。
- `setPointerCapture` により、ポインタがフィールド外へ出ても pointermove/pointerup が `#drawLayer` に届く。
- 2点未満のストローク（クリックしただけ）は破棄。

- [ ] **Step 4: bindEvents にツールバーの配線を追加**

`bindEvents` 内、Task 3 で追加した `window.addEventListener("resize", renderDrawings);` の直前に追加する。

```js
  els.toolMoveBtn.addEventListener("click", () => setDrawTool("move"));
  els.toolPenBtn.addEventListener("click", () => setDrawTool("pen"));
  els.toolArrowBtn.addEventListener("click", () => setDrawTool("arrow"));

  els.colorSwatches.forEach((swatch) => {
    swatch.addEventListener("click", () => setDrawColor(swatch.dataset.color));
  });

  els.undoDrawBtn.addEventListener("click", () => {
    if (!state.drawings.length) return;
    state.drawings.pop();
    saveState();
    renderDrawings();
  });

  els.clearDrawBtn.addEventListener("click", () => {
    if (!state.drawings.length) return;
    const ok = window.confirm("描いた線をすべて消しますか？");
    if (!ok) return;
    state.drawings = [];
    saveState();
    renderDrawings();
  });

  els.drawLayer.addEventListener("pointerdown", startDrawStroke);
```

- [ ] **Step 5: ツールバーと draw-mode の CSS を追加**

`styles.css` の `.team-dot` 群（219-232行付近、`.away-dot` ルール）の後ろに追加する。

```css
.draw-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 16px;
}

.tool-group {
  display: flex;
  align-items: center;
  gap: 6px;
}

.tool-button {
  min-height: 30px;
  border-radius: 7px;
  padding: 5px 10px;
  background: #e7eee9;
  color: var(--ink);
  font-size: 0.78rem;
  font-weight: 800;
}

.tool-button[aria-pressed="true"] {
  background: var(--ink);
  color: #fff;
}

.color-swatch {
  width: 22px;
  height: 22px;
  padding: 0;
  border-radius: 999px;
  border: 2px solid rgba(23, 33, 27, 0.18);
}

.color-swatch.yellow { background: #f5d90a; }
.color-swatch.red { background: #ef4444; }
.color-swatch.blue { background: #3b82f6; }
.color-swatch.white { background: #ffffff; }

.color-swatch[aria-pressed="true"] {
  outline: 3px solid var(--gold);
  outline-offset: 1px;
}
```

さらに、Task 3 で追加した `.draw-layer` ルールの直後に追加する。

```css
.field.draw-mode .draw-layer {
  pointer-events: auto;
  cursor: crosshair;
  touch-action: none;
}

.field.draw-mode .players-layer {
  pointer-events: none;
}
```

- [ ] **Step 6: ブラウザで確認（受け入れ確認）**

dev サーバで開き、以下を通す（Playwright の `browser_drag` / `browser_take_screenshot` 併用可）:

- ツールバーが表示され、初期状態は「移動」・黄が押下状態。
- 「ペン」を押してフィールドをなぞる → 黄色の線がなぞりに追従して描かれ、離すと確定。カーソルは crosshair。
- 「矢印」＋赤に切り替えて描く → 赤い線＋終点に三角の頭。
- 青・白でも描ける。色は新しい線にだけ効く。
- 描画モード中は選手コマがポインタで動かない。「移動」に戻すとドラッグ・選択が従来どおり（線の上からでも選手を掴める）。
- 「1つ戻す」で最後の線だけ消える。「全消去」は confirm 後に全部消える（キャンセルで残る）。線が0本のときはどちらも何も起きない（confirm も出ない）。
- リロードで線が残り、モードは「移動」・黄に戻る。
- 縦表示で描く → 横に切り替えても線の位置・形が正しい。
- 「ボードリセット」で線が全部消える。
- クリックしただけ（動かさない）では線が増えない（`JSON.parse(localStorage.getItem("soccer-board-state-v1")).drawings.length` で確認可）。

- [ ] **Step 7: コミット**

```bash
git add index.html app.js styles.css
git commit -m "描画ツールバーとペン/矢印の手描き入力を追加"
```

---

## 完了時の最終確認（受け入れ条件）

- [ ] 選手の背中側の弧で向きが一目でわかる（味方=濃青、相手=濃赤）。
- [ ] 選択中の選手だけに回転ハンドルが出て、ドラッグで向きを変えられ、リロード後も保持される。
- [ ] 縦横切替で向きも線も一緒に正しく回る。縦表示のまま回転・描画しても正しい。
- [ ] ペン/矢印×4色で描け、線は選手コマの下に表示される。1つ戻す/全消去/ボードリセットが仕様どおり。
- [ ] `dir`・`drawings` を含まない既存の保存データで開いても壊れない。
- [ ] 既存機能（配置反映・交代・登録・ドラッグ・キー移動・保存）が退行していない。

## Self-Review メモ

- Spec coverage: データモデル(T1/T3)、弧の表示(T1)、回転ハンドル(T2)、SVGレイヤーと矢印(T3)、ツールバー・モード・undo/全消去(T4)、縦横整合(T1-T4の確認手順)、リセット類(T1 Step3・T3 Step4)、エラー処理(T3 sanitizeDrawings・上限)、後方互換(T1/T3の確認手順) を網羅。
- 名称整合: `normalizeDir` / `toScreenAngle` / `fromScreenAngle` / `applyTokenDirection` / `sanitizeDrawings` / `renderDrawings` / `appendStrokeElements` / `buildStrokePath` / `strokePointToPixel` / `createArrowHead` / `setDrawTool` / `setDrawColor` / `startDrawStroke` / `moveDrawStroke` / `endDrawStroke` / `drawPointFromEvent` / `MAX_STROKE_POINTS` — 定義と使用箇所が一致していることを確認済み。
- プレースホルダなし: 全ステップに実コード・実手順を記載。
