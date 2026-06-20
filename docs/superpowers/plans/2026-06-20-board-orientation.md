# ボード 縦/横表示切り替え 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** サッカーボードを横表示に加えて縦表示（味方が下・相手が上）にも切り替えられるようにする。

**Architecture:** 選手・ボールの座標データ（`x`=長辺/ゴール方向, `y`=短辺/幅方向）は不変のまま、`state.orientation`（horizontal/vertical）を追加し、描画・ドラッグ・キーボード移動の「データ座標↔画面位置」変換だけを向きに応じて切り替える。ピッチのラインは `.field.vertical` 用CSSで縦向きに描き直す。

**Tech Stack:** バニラ HTML / CSS / JavaScript（ビルド・依存追加なし）。ローカル確認は `node dev-server.js`（http://127.0.0.1:4173/）+ ブラウザ（Playwright MCP 利用可）。

## Global Constraints

- 依存ライブラリ・ビルドステップを増やさない（バニラ HTML/CSS/JS のまま）。
- 選手・ボールの座標 `x`/`y` の意味は変えない。既存の localStorage データはそのまま読めること（後方互換）。
- `state.orientation` のデフォルトは `"horizontal"`。不正値は `"horizontal"` にフォールバック。
- 縦表示は「味方（青）が下・相手（赤）が上」。自陣ゴールが下。左右反転しない。
- 既存の機能（配置反映・交代・登録・ドラッグ・キーボード移動・保存）は両向きで動くこと。

---

## File Structure

- `index.html` — ツールバーに向き切り替えボタンを1つ追加。
- `app.js` — orientation の state/保存、ボタンのイベント、座標変換ヘルパー、トークン配置・ドラッグ・キーボード移動の向き対応、orientation 適用処理。
- `styles.css` — `.field.vertical` のアスペクト比・芝ストライプ・各マーキング・縦時の最大幅/中央寄せ。

各タスクは独立して確認可能。最終的な見た目の正しさは Task 3 完了時にブラウザで確認する。

---

## Task 1: orientation の state・永続化・切り替えボタン

ボタンを押すと `state.orientation` が反転し、保存され、`#field` に `vertical` クラスが付き、ボタンのラベルが切り替わる（座標変換・CSSは後続タスク）。

**Files:**
- Modify: `index.html`（ツールバー、現状 20-32 行付近）
- Modify: `app.js`（`els` 59-79、`state` 81-88、`bindEvents` 100-173、`loadState` 175-206、`saveState` 208-222、`renderAll` 347-357）

**Interfaces:**
- Produces:
  - `state.orientation: "horizontal" | "vertical"`
  - `els.toggleOrientationBtn: HTMLButtonElement`
  - `applyOrientation(): void` — `#field` の `vertical` クラスとボタンラベル/`aria-pressed` を現在の `state.orientation` に同期する。

- [ ] **Step 1: index.html にボタンを追加**

`index.html` のツールバー、`applyFormationBtn` と `resetBoardBtn` の間に追加する。

変更前:
```html
          <button id="applyFormationBtn" class="secondary-button" type="button">反映</button>
          <button id="resetBoardBtn" class="primary-button" type="button">ボードリセット</button>
```
変更後:
```html
          <button id="applyFormationBtn" class="secondary-button" type="button">反映</button>
          <button id="toggleOrientationBtn" class="secondary-button" type="button" aria-pressed="false">縦表示</button>
          <button id="resetBoardBtn" class="primary-button" type="button">ボードリセット</button>
```

- [ ] **Step 2: app.js の `els` にボタン参照を追加**

`els` オブジェクト内、`applyFormationBtn` の次の行に追加する。

変更前:
```js
  applyFormationBtn: document.querySelector("#applyFormationBtn"),
  resetBoardBtn: document.querySelector("#resetBoardBtn"),
```
変更後:
```js
  applyFormationBtn: document.querySelector("#applyFormationBtn"),
  toggleOrientationBtn: document.querySelector("#toggleOrientationBtn"),
  resetBoardBtn: document.querySelector("#resetBoardBtn"),
```

- [ ] **Step 3: state に orientation を追加**

変更前:
```js
let state = {
  formation: DEFAULT_FORMATION,
  homePlayers: [],
  opponentPlayers: [],
  ball: createDefaultBall(),
  selected: null,
  notes: "",
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
};
```

- [ ] **Step 4: loadState で orientation を読み込む**

`loadState` の `state.selected = null;`（206行付近、`state.ball = sanitizeBall(...)` の次）の直前に追加する。

変更前:
```js
  state.ball = sanitizeBall(saved?.ball);
  state.selected = null;
```
変更後:
```js
  state.ball = sanitizeBall(saved?.ball);
  state.orientation = saved?.orientation === "vertical" ? "vertical" : "horizontal";
  state.selected = null;
```

- [ ] **Step 5: saveState の payload に orientation を含める**

変更前:
```js
  const payload = {
    formation: state.formation,
    homePlayers: state.homePlayers,
    opponentPlayers: state.opponentPlayers,
    ball: state.ball,
    notes: state.notes,
  };
```
変更後:
```js
  const payload = {
    formation: state.formation,
    homePlayers: state.homePlayers,
    opponentPlayers: state.opponentPlayers,
    ball: state.ball,
    notes: state.notes,
    orientation: state.orientation,
  };
```

- [ ] **Step 6: bindEvents にトグルのイベントを追加**

`bindEvents` 内の `applyFormationBtn` ブロックと `resetBoardBtn` ブロックの間に挿入する。

変更前:
```js
  els.applyFormationBtn.addEventListener("click", () => {
    state.formation = getFormationValue();
    applyFormationToHome();
    saveState();
    renderAll();
  });

  els.resetBoardBtn.addEventListener("click", () => {
    resetBoard();
  });
```
変更後:
```js
  els.applyFormationBtn.addEventListener("click", () => {
    state.formation = getFormationValue();
    applyFormationToHome();
    saveState();
    renderAll();
  });

  els.toggleOrientationBtn.addEventListener("click", () => {
    state.orientation = state.orientation === "vertical" ? "horizontal" : "vertical";
    saveState();
    renderAll();
  });

  els.resetBoardBtn.addEventListener("click", () => {
    resetBoard();
  });
```

- [ ] **Step 7: applyOrientation 関数を追加**

`renderAll` 関数の直前に新規追加する。

```js
function applyOrientation() {
  const vertical = state.orientation === "vertical";
  els.field.classList.toggle("vertical", vertical);
  els.toggleOrientationBtn.textContent = vertical ? "横表示" : "縦表示";
  els.toggleOrientationBtn.setAttribute("aria-pressed", String(vertical));
}
```

- [ ] **Step 8: renderAll で applyOrientation を呼ぶ**

変更前:
```js
function renderAll() {
  validateSelection();
  els.formationSelect.value = state.formation;
  els.boardNotes.value = state.notes;
  renderFieldPlayers();
```
変更後:
```js
function renderAll() {
  validateSelection();
  applyOrientation();
  els.formationSelect.value = state.formation;
  els.boardNotes.value = state.notes;
  renderFieldPlayers();
```

- [ ] **Step 9: ブラウザで確認**

`node dev-server.js` を起動し、http://127.0.0.1:4173/ を開く（Playwright MCP の `browser_navigate` 可）。
- ツールバーに「縦表示」ボタンがある。
- ボタンを押すとラベルが「横表示」に変わり、`#field` に `vertical` クラスが付く（`browser_evaluate` で `document.querySelector('#field').className` を確認、または DevTools）。
- もう一度押すと「縦表示」に戻り、クラスが外れる。
- 縦表示にしてページを再読み込みしても縦のまま（`#field` に `vertical` クラスが残る／ボタンが「横表示」）。

期待: 上記すべて成立。この時点では座標変換・縦用CSSが未実装のため、見た目（マーキング・選手位置）はまだ正しくない。

- [ ] **Step 10: コミット**

```bash
git add index.html app.js
git commit -m "縦/横の状態・保存・切り替えボタンを追加"
```

---

## Task 2: 座標変換（トークン配置・ドラッグ・キーボード移動）

orientation に応じて、データ座標と画面位置(%)を相互変換する。これにより縦表示で選手・ボールが正しい位置に表示・移動できる。

**Files:**
- Modify: `app.js`（`createPlayerToken` 375-400、`createBallToken` 402-415、`moveDrag` 438-460、`nudgeSelectedPlayer` 471-491、ヘルパー追加）

**Interfaces:**
- Consumes: `state.orientation`（Task 1）
- Produces:
  - `toScreenPosition(entity): { left: number, top: number }` — `entity` は `{x, y}` を持つ選手またはボール。画面位置(%)を返す。
  - `setTokenPosition(token, entity): void` — トークン要素の `style.left/top` を `toScreenPosition` で設定。
  - `fromScreenFraction(fx, fy): { x: number, y: number }` — フィールド矩形内のパーセント座標(0-100)をデータ座標に逆変換。

- [ ] **Step 1: 変換ヘルパーを追加**

`clamp` 関数（ファイル末尾付近）の直前など、ヘルパー群の近くに新規追加する。

```js
function toScreenPosition(entity) {
  if (state.orientation === "vertical") {
    return { left: entity.y, top: 100 - entity.x };
  }
  return { left: entity.x, top: entity.y };
}

function setTokenPosition(token, entity) {
  const position = toScreenPosition(entity);
  token.style.left = `${position.left}%`;
  token.style.top = `${position.top}%`;
}

function fromScreenFraction(fx, fy) {
  if (state.orientation === "vertical") {
    return { x: 100 - fy, y: fx };
  }
  return { x: fx, y: fy };
}
```

- [ ] **Step 2: createPlayerToken でヘルパーを使う**

変更前:
```js
  token.style.left = `${player.x}%`;
  token.style.top = `${player.y}%`;
```
変更後:
```js
  setTokenPosition(token, player);
```

- [ ] **Step 3: createBallToken でヘルパーを使う**

変更前:
```js
  token.style.left = `${state.ball.x}%`;
  token.style.top = `${state.ball.y}%`;
```
変更後:
```js
  setTokenPosition(token, state.ball);
```

- [ ] **Step 4: moveDrag を逆変換に対応**

変更前:
```js
  const rect = els.field.getBoundingClientRect();
  player.x = clampX(activeDrag.team, ((event.clientX - rect.left) / rect.width) * 100);
  player.y = clampY(activeDrag.team, ((event.clientY - rect.top) / rect.height) * 100);

  if (
    Math.abs(event.clientX - activeDrag.startX) > 2 ||
    Math.abs(event.clientY - activeDrag.startY) > 2
  ) {
    activeDrag.moved = true;
  }

  const token = findToken(activeDrag.team, activeDrag.id);
  if (token) {
    token.style.left = `${player.x}%`;
    token.style.top = `${player.y}%`;
    token.classList.add("dragging");
  }
```
変更後:
```js
  const rect = els.field.getBoundingClientRect();
  const fx = ((event.clientX - rect.left) / rect.width) * 100;
  const fy = ((event.clientY - rect.top) / rect.height) * 100;
  const data = fromScreenFraction(fx, fy);
  player.x = clampX(activeDrag.team, data.x);
  player.y = clampY(activeDrag.team, data.y);

  if (
    Math.abs(event.clientX - activeDrag.startX) > 2 ||
    Math.abs(event.clientY - activeDrag.startY) > 2
  ) {
    activeDrag.moved = true;
  }

  const token = findToken(activeDrag.team, activeDrag.id);
  if (token) {
    setTokenPosition(token, player);
    token.classList.add("dragging");
  }
```

- [ ] **Step 5: nudgeSelectedPlayer を画面方向に合わせる**

矢印キーは「画面上の方向」で動くようにする（縦表示では x/y の対応が入れ替わる）。

変更前:
```js
  if (team !== "ball") selectPlayer(team, id);
  const step = event.shiftKey ? 3 : 1;
  if (event.key === "ArrowUp") player.y -= step;
  if (event.key === "ArrowRight") player.x += step;
  if (event.key === "ArrowDown") player.y += step;
  if (event.key === "ArrowLeft") player.x -= step;
  player.x = clampX(team, player.x);
  player.y = clampY(team, player.y);
```
変更後:
```js
  if (team !== "ball") selectPlayer(team, id);
  const step = event.shiftKey ? 3 : 1;
  if (state.orientation === "vertical") {
    if (event.key === "ArrowUp") player.x += step;
    if (event.key === "ArrowDown") player.x -= step;
    if (event.key === "ArrowRight") player.y += step;
    if (event.key === "ArrowLeft") player.y -= step;
  } else {
    if (event.key === "ArrowUp") player.y -= step;
    if (event.key === "ArrowDown") player.y += step;
    if (event.key === "ArrowRight") player.x += step;
    if (event.key === "ArrowLeft") player.x -= step;
  }
  player.x = clampX(team, player.x);
  player.y = clampY(team, player.y);
```

- [ ] **Step 6: ブラウザで確認**

dev サーバを起動し、http://127.0.0.1:4173/ を開く。
- 横表示で従来どおり選手・ボールをドラッグ移動でき、位置が保存される（再読み込みで保持）。
- 縦表示に切り替えると、各選手・ボールの位置が変わる（味方が下側、相手が上側の領域に来る）。
  - 確認の目安: 横で味方GK（x≈8）は左端付近。縦に切り替えると下端付近（top≈92%）に来る。`browser_evaluate` で味方GKトークンの `style.top` がおおよそ `92%` 付近であることを確認。
- 縦表示でトークンをドラッグするとポインタに正しく追従し、離すと保存される。
- 縦表示で選手を選択し矢印キー: ↑で上（相手ゴール方向）へ、→で右へ動く（画面方向と一致）。
- 縦→横に戻すと、各選手の相対位置が保たれている（向きだけが変わる）。

注: この時点ではフィールドの形・マーキングは横用CSSのままなので、見た目の「縦のピッチ」感は Task 3 で完成する。位置関係が正しく変換されていることだけ確認する。

- [ ] **Step 7: コミット**

```bash
git add app.js
git commit -m "縦/横に応じた座標変換（配置・ドラッグ・キー移動）を追加"
```

---

## Task 3: 縦表示用CSS（アスペクト比・芝・マーキング・サイズ）

`.field.vertical` のときにフィールドを縦長にし、ハーフライン・PA・ゴールエリア・ゴールを縦向きに描き、デスクトップで間延びしないよう最大幅を制限して中央寄せする。

**Files:**
- Modify: `styles.css`（`.field`・各マーキング 241-346、`.field-shell` 234-239、メディアクエリ 677-735）

**Interfaces:**
- Consumes: `#field` に付与される `vertical` クラス（Task 1）

- [ ] **Step 1: 縦用のアスペクト比・芝・マーキングCSSを追加**

`styles.css` の `.goal.right { ... }` ルール（346行付近）の直後に、まとめて追加する。

```css
.field.vertical {
  aspect-ratio: 68 / 105;
  background: repeating-linear-gradient(
    0deg,
    var(--field-dark) 0 9.09%,
    var(--field-light) 9.09% 18.18%
  );
}

.field.vertical .half-line {
  top: 50%;
  bottom: auto;
  left: 3.5%;
  right: 3.5%;
  border-left: 0;
  border-top: 2px solid rgba(255, 255, 255, 0.86);
}

.field.vertical .center-circle {
  width: auto;
  height: 18%;
}

.field.vertical .penalty-box {
  top: auto;
  bottom: auto;
  left: 22%;
  right: auto;
  width: 56%;
  height: 15.5%;
  border: 2px solid rgba(255, 255, 255, 0.86);
}

.field.vertical .penalty-box.left {
  bottom: 3.5%;
  border-bottom: 0;
}

.field.vertical .penalty-box.right {
  top: 3.5%;
  border-top: 0;
}

.field.vertical .six-box {
  top: auto;
  bottom: auto;
  left: 36%;
  right: auto;
  width: 28%;
  height: 5.5%;
  border: 2px solid rgba(255, 255, 255, 0.86);
}

.field.vertical .six-box.left {
  bottom: 3.5%;
  border-bottom: 0;
}

.field.vertical .six-box.right {
  top: 3.5%;
  border-top: 0;
}

.field.vertical .goal {
  top: auto;
  bottom: auto;
  left: 44%;
  right: auto;
  width: 12%;
  height: 1.6%;
  border: 2px solid rgba(255, 255, 255, 0.86);
}

.field.vertical .goal.left {
  bottom: 0.8%;
  border-top: 0;
}

.field.vertical .goal.right {
  top: 0.8%;
  border-bottom: 0;
}
```

補足（設計意図、実装の参考）:
- 縦は横画像を反時計回り90°回転した向き。長辺方向(x)の寸法はCSSの縦(height)に、短辺方向(y)はCSSの横(width)になるため、各マーキングは横用の width↔height を入れ替えた値にしている。
- `.left`（横での自陣/左ゴール側）は縦では下端、`.right` は上端。ゴール側に開く辺（border 0）も下/上に読み替える。
- `.center-circle` は横で `width:18%`（長辺基準）+ `aspect-ratio:1`。縦では `height:18%`（同じく長辺基準）+ `width:auto` で同じ見た目を保つ。

- [ ] **Step 2: 縦表示のデスクトップ時の最大幅・中央寄せを追加**

`styles.css` の末尾（既存メディアクエリの後ろ）に追加する。デスクトップ（641px 以上）でのみフィールドの高さがビューポートを大きく超えないよう幅を制限し、中央寄せする。スマホ幅では幅いっぱい＋ページスクロールに任せる。

```css
@media (min-width: 681px) {
  .field-shell:has(.field.vertical) {
    max-width: min(460px, calc((100vh - 220px) * 0.6476));
    margin-inline: auto;
  }
}
```

- [ ] **Step 3: ブラウザで確認（デスクトップ幅）**

dev サーバを起動し、http://127.0.0.1:4173/ を広めのウィンドウ（例 1280x800、`browser_resize`）で開く。
- 縦表示に切り替えると、フィールドが縦長（ポートレート）になり、画面に収まる幅で中央に表示される（極端に縦長で画面外にはみ出さない）。
- ハーフラインが水平、センターサークルが中央。
- ペナルティエリア・ゴールエリア・ゴールが上端・下端に正しく描かれている（左右の余白が対称）。
- 芝のストライプが横方向の縞になっている。
- 選手・ボールが正しい位置（味方下・相手上）に表示され、ドラッグも追従する。
- スクリーンショット（`browser_take_screenshot`）で全体の見た目を確認。

- [ ] **Step 4: ブラウザで確認（スマホ幅）**

`browser_resize` で 390x844 にして縦表示を確認。
- フィールドが画面幅いっぱいに近い縦長で表示され、必要ならページが縦スクロールできる。
- マーキング・選手位置が崩れていない。
- 横表示にも切り替えられ、従来どおり表示される。

- [ ] **Step 5: コミット**

```bash
git add styles.css
git commit -m "縦表示用のピッチCSS（アスペクト比・マーキング・サイズ）を追加"
```

---

## 完了時の最終確認（受け入れ条件）

- [ ] 横→縦→横と切り替えても選手・ボールの相対位置が保たれる（向きだけ変わる）。
- [ ] 縦で味方が下・相手が上、自陣ゴールが下。
- [ ] 縦でドラッグ・矢印キー移動が画面方向どおりに動き、再読み込み後も位置と向きが保持される。
- [ ] 縦のピッチのライン（ハーフライン水平、PA・ゴールが上下）が正しい。
- [ ] デスクトップ幅でフィールドが画面に収まり中央寄せ、スマホ幅で幅いっぱい表示。
- [ ] 既存機能（配置反映・交代・登録・ボードリセット）が両向きで動作する。

## Self-Review メモ

- Spec coverage: 状態/保存(Task1) ・UIボタン(Task1) ・座標変換(Task2) ・ライン CSS(Task3) ・最大幅/中央寄せ(Task3) を網羅。矢印キーの向き対応は仕様の「描画＆ドラッグの向き変換」に含まれる挙動として Task2 に追加済み。
- 型/名称整合: `toScreenPosition` / `setTokenPosition` / `fromScreenFraction` / `applyOrientation` を Task で定義し、利用箇所と一致。
- プレースホルダなし: 各ステップに実コードを記載。
