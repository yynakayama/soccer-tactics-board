# キーボードショートカット実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 移動=V / ペン=P / 矢印=A / ボードリセット=R / 1つ戻す=Ctrl+Z / 選択解除=Esc をキー一発で実行でき、入力欄では発火せず、対象ボタンにキーが常時表示される。

**Architecture:** `window` に `keydown` リスナー1つ（`handleShortcut`）を追加し、入力欄・IME・修飾キーをガードして既存処理を呼ぶだけにする。ボタン押下とキーで挙動を完全一致させるため、undo と選択解除のインライン処理を共通関数 `undoDrawing()` / `clearSelection()` に切り出す（`setDrawTool` / `resetBoard` は既存関数をそのまま利用）。発見性はボタンラベル末尾の `<kbd class="kbd-hint">` バッジで担保し、色は `currentColor` で明背景・暗背景の両方に自動追従させる。

**Tech Stack:** バニラ HTML / CSS / JavaScript（ビルド・依存追加なし）。ローカル確認は `node dev-server.js`（http://127.0.0.1:4173/）+ ブラウザ（Playwright MCP 利用可）。

**Spec:** `docs/superpowers/specs/2026-07-04-keyboard-shortcuts-design.md`（承認済み）

## Global Constraints

- 依存ライブラリ・ビルドステップを増やさない（バニラ HTML/CSS/JS のまま）。
- ショートカットは `INPUT` / `TEXTAREA` / `SELECT` / `isContentEditable` にフォーカス中は一切発火しない。`event.isComposing`（IME変換中）も無視。
- 単キー（V/P/A/R/Esc）は `ctrlKey` / `metaKey` / `altKey` のいずれかが押されていれば無視する。`shiftKey` は問わない。文字キーは大小どちらでも動作。
- `Ctrl+Z` / `Cmd+Z`（Shift・Alt なし）のみ描画undo。入力欄内では発火させずブラウザ標準のテキストundoに委ねる。Redo（Ctrl+Shift+Z）・全消去のショートカットは対象外。
- ボードリセット（R）は確認ダイアログを追加せず、既存ボタンと同じく `resetBoard()` を即実行する。
- 既存の矢印キーによる選手ニアッジ（`nudgeSelectedPlayer`）は変更しない。今回のショートカットに矢印キーは使わない。
- キーを表示するボタンは 移動 / ペン / 矢印 / ボードリセット / 1つ戻す / 解除 の6つのみ。色スウォッチ・全消去・配置select・ガイドトグルには付けない。
- リファクタ（Task 1）は挙動不変であること。ボタン押下時の保存・再描画経路を変えない。

---

## File Structure

- `app.js` — `undoDrawing()` / `clearSelection()` の共通関数化、`handleShortcut()` の追加、`bindEvents` での `keydown` 登録とボタンハンドラの差し替え。
- `index.html` — 6つのボタンに `<kbd class="kbd-hint">` バッジと `aria-keyshortcuts` 属性を追加。
- `styles.css` — `.kbd-hint`（キーバッジ）クラスを追加。

タスク分割: Task 1 = 共通関数抽出（挙動不変リファクタ）、Task 2 = グローバルキーハンドラ、Task 3 = ボタンへのキー表示。各タスクは独立して確認・レビュー可能。

---

## Task 1: undo・選択解除の共通関数抽出（挙動不変リファクタ）

現在 `bindEvents` 内にインライン記述されている「1つ戻す」と「選択解除」の処理を、named function に切り出す。ボタンからはその関数を呼ぶだけにし、挙動は完全に同一に保つ。後続タスクのショートカットが同じ関数を呼べるようにするのが目的。

**Files:**
- Modify: `app.js`（`clearSelectionBtn` ハンドラ 172-179、`undoDrawBtn` ハンドラ 238-243、`resetBoard` 直後 425 付近、`setDrawColor` 直後 827 付近）

**Interfaces:**
- Produces:
  - `undoDrawing(): void` — `state.drawings` が空なら何もしない。あれば末尾を1本 pop → `saveState()` → `renderDrawings()`。
  - `clearSelection(): void` — `state.selected = null` にして選択/交代/味方/相手の各パネルを再描画し `syncSelectedTokens()` を呼ぶ。

- [ ] **Step 1: `clearSelection()` を追加**

`resetBoard()` 関数の閉じ括弧（425 行）の直後に新規追加する。

```js
function clearSelection() {
  state.selected = null;
  renderSelectionPanel();
  renderSubstitutionPanel();
  renderHomeRoster();
  renderOpponentRoster();
  syncSelectedTokens();
}
```

- [ ] **Step 2: `undoDrawing()` を追加**

`setDrawColor()` 関数の閉じ括弧（827 行）の直後、`startDrawStroke` の直前に新規追加する。

```js
function undoDrawing() {
  if (!state.drawings.length) return;
  state.drawings.pop();
  saveState();
  renderDrawings();
}
```

- [ ] **Step 3: `clearSelectionBtn` ハンドラを共通関数呼び出しに置き換え**

変更前:
```js
  els.clearSelectionBtn.addEventListener("click", () => {
    state.selected = null;
    renderSelectionPanel();
    renderSubstitutionPanel();
    renderHomeRoster();
    renderOpponentRoster();
    syncSelectedTokens();
  });
```
変更後:
```js
  els.clearSelectionBtn.addEventListener("click", clearSelection);
```

- [ ] **Step 4: `undoDrawBtn` ハンドラを共通関数呼び出しに置き換え**

変更前:
```js
  els.undoDrawBtn.addEventListener("click", () => {
    if (!state.drawings.length) return;
    state.drawings.pop();
    saveState();
    renderDrawings();
  });
```
変更後:
```js
  els.undoDrawBtn.addEventListener("click", undoDrawing);
```

- [ ] **Step 5: ブラウザで挙動不変を確認**

`node dev-server.js` を起動し http://127.0.0.1:4173/ を開く（Playwright MCP の `browser_navigate` 可）。
- ペンで線を2本引き、「1つ戻す」ボタンを2回押すと1本ずつ消え、3回目は何も起きない。
- 選手を1人クリックして選択 → 「解除」ボタンで選択が外れる（選択パネルとトークンのハイライトが消える）。
- リロードしても線の状態が保存されている（`undoDrawing` 内の `saveState()` が効いている）。

期待: リファクタ前と同じ挙動。コンソールエラーなし（`browser_console_messages` で確認）。

- [ ] **Step 6: コミット**

```bash
git add app.js
git commit -m "undo・選択解除を共通関数に抽出（挙動不変）"
```

---

## Task 2: グローバルキーボードショートカット

`window` の `keydown` を1つ購読し、ガードを通過したキーに応じて既存処理／共通関数を呼ぶ。

**Files:**
- Modify: `app.js`（`undoDrawing` の直後にハンドラ追加、`bindEvents` 末尾の `window.addEventListener("resize", ...)` 256 行の直後に登録）

**Interfaces:**
- Consumes: `undoDrawing()` / `clearSelection()`（Task 1）、`setDrawTool(tool)` / `resetBoard()`（既存）
- Produces:
  - `handleShortcut(event: KeyboardEvent): void` — ガード判定後、V/P/A→`setDrawTool`、R→`resetBoard`、Esc→`clearSelection`、Ctrl/Cmd+Z→`undoDrawing`。

- [ ] **Step 1: `handleShortcut()` を追加**

`undoDrawing()` 関数の直後に新規追加する。

```js
function handleShortcut(event) {
  if (event.isComposing) return;

  const target = event.target;
  const tag = target && target.tagName;
  const isTextField =
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    (target && target.isContentEditable);

  // Ctrl/Cmd+Z: 描画を1つ戻す（入力欄では標準のテキストundoに任せる）
  if (
    (event.ctrlKey || event.metaKey) &&
    !event.altKey &&
    !event.shiftKey &&
    event.key.toLowerCase() === "z"
  ) {
    if (isTextField) return;
    event.preventDefault();
    undoDrawing();
    return;
  }

  // 単キー系（修飾キーなしのみ、入力欄では無効）
  if (event.ctrlKey || event.metaKey || event.altKey) return;
  if (isTextField) return;

  switch (event.key) {
    case "v":
    case "V":
      setDrawTool("move");
      break;
    case "p":
    case "P":
      setDrawTool("pen");
      break;
    case "a":
    case "A":
      setDrawTool("arrow");
      break;
    case "r":
    case "R":
      resetBoard();
      break;
    case "Escape":
      clearSelection();
      break;
    default:
      return;
  }
  event.preventDefault();
}
```

- [ ] **Step 2: `bindEvents` で `keydown` を登録**

`bindEvents` 末尾の `window.addEventListener("resize", renderDrawings);`（256 行）の直後に追加する。

変更前:
```js
  els.drawLayer.addEventListener("pointerdown", startDrawStroke);

  window.addEventListener("resize", renderDrawings);
}
```
変更後:
```js
  els.drawLayer.addEventListener("pointerdown", startDrawStroke);

  window.addEventListener("resize", renderDrawings);
  window.addEventListener("keydown", handleShortcut);
}
```

- [ ] **Step 3: ブラウザで全キーとガードを確認**

`node dev-server.js` を起動し http://127.0.0.1:4173/ を開く。まずフィールド上の空白（入力欄外）をクリックしてフォーカスを外してから検証する。

ツール切替:
- `V` / `P` / `A` を押すと該当ツールボタンが `aria-pressed="true"` になる（`browser_evaluate` で `document.querySelector('#toolPenBtn').getAttribute('aria-pressed')` 等を確認）。
- ペン選択中はフィールドが `draw-mode` になり手描きできる。

各アクション:
- ペンで線を1本引く → `Ctrl+Z` で消える。空なら何も起きない。
- 選手を選択 → `Esc` で解除。
- `R` で盤面リセット（配置が初期化され描画・メモが消える。ボタン押下と同結果）。

ガード（重要）:
- メモ欄（`#boardNotes`）をクリックしてフォーカスし、`v` `p` `a` `r` を打つ → 文字がそのまま入力され、ツール・盤面は変化しない。
- メモ欄フォーカス中の `Ctrl+Z` はメモのテキスト取消に効き、描画undoは走らない。
- 選手名（`#newNameInput`）/番号（`#newNumberInput`）入力欄、配置select（`#formationSelect`）でも `v`/`r` 等が文字入力・選択操作になり盤面に影響しない。
- 入力欄外の `Ctrl+Z` は描画undoに効く。
- 選手トークンにフォーカスがある状態で矢印キーを押すと従来どおり選手が動き、`V`/`Esc` 等のショートカットも同時に効く（競合しない）。

期待: 上記すべて成立。`browser_console_messages` でエラーなし。

- [ ] **Step 4: コミット**

```bash
git add app.js
git commit -m "移動/ペン/矢印/リセット/undo/選択解除のキーボードショートカットを追加"
```

---

## Task 3: ボタンへのキー常時表示

対象6ボタンのラベル末尾にキーバッジ（`<kbd class="kbd-hint">`）を表示し、`aria-keyshortcuts` を付与する。バッジ色は `currentColor` で明・暗ボタン双方に追従させる。

**Files:**
- Modify: `index.html`（`resetBoardBtn` 35、`toolMoveBtn`/`toolPenBtn`/`toolArrowBtn` 54-56、`undoDrawBtn` 65、`clearSelectionBtn` 92）
- Modify: `styles.css`（`.tool-button[aria-pressed="true"]` ルール 262-265 の直後）

**Interfaces:**
- Consumes: 既存のボタンID・クラス（`.tool-button` / `.primary-button` / `.text-button`）と色トークン（`var(--ink)` / `var(--muted)` / `#fff`）。
- Produces: `.kbd-hint` クラス（装飾のみ、JSからは参照しない）。

- [ ] **Step 1: 描画ツールボタン3つにバッジと属性を追加**

変更前:
```html
              <button id="toolMoveBtn" class="tool-button" type="button" aria-pressed="true">移動</button>
              <button id="toolPenBtn" class="tool-button" type="button" aria-pressed="false">ペン</button>
              <button id="toolArrowBtn" class="tool-button" type="button" aria-pressed="false">矢印</button>
```
変更後:
```html
              <button id="toolMoveBtn" class="tool-button" type="button" aria-pressed="true" aria-keyshortcuts="v">移動 <kbd class="kbd-hint">V</kbd></button>
              <button id="toolPenBtn" class="tool-button" type="button" aria-pressed="false" aria-keyshortcuts="p">ペン <kbd class="kbd-hint">P</kbd></button>
              <button id="toolArrowBtn" class="tool-button" type="button" aria-pressed="false" aria-keyshortcuts="a">矢印 <kbd class="kbd-hint">A</kbd></button>
```

- [ ] **Step 2: 「1つ戻す」ボタンにバッジと属性を追加**

変更前:
```html
              <button id="undoDrawBtn" class="tool-button" type="button">1つ戻す</button>
```
変更後:
```html
              <button id="undoDrawBtn" class="tool-button" type="button" aria-keyshortcuts="Control+z">1つ戻す <kbd class="kbd-hint">Ctrl+Z</kbd></button>
```

- [ ] **Step 3: 「ボードリセット」ボタンにバッジと属性を追加**

変更前:
```html
          <button id="resetBoardBtn" class="primary-button" type="button">ボードリセット</button>
```
変更後:
```html
          <button id="resetBoardBtn" class="primary-button" type="button" aria-keyshortcuts="r">ボードリセット <kbd class="kbd-hint">R</kbd></button>
```

- [ ] **Step 4: 「解除」ボタンにバッジと属性を追加**

変更前:
```html
              <button id="clearSelectionBtn" class="text-button" type="button">解除</button>
```
変更後:
```html
              <button id="clearSelectionBtn" class="text-button" type="button" aria-keyshortcuts="Escape">解除 <kbd class="kbd-hint">Esc</kbd></button>
```

- [ ] **Step 5: `styles.css` に `.kbd-hint` を追加**

`.tool-button[aria-pressed="true"] { ... }` ルール（262-265 行）の直後に追加する。`currentColor` を使うことで、明るいボタン（未押下の `.tool-button`）では暗い枠、暗いボタン（`.primary-button` や押下中の `.tool-button`）では明るい枠になり、両方で視認できる。

```css
.kbd-hint {
  display: inline-block;
  margin-left: 6px;
  padding: 0 5px;
  min-width: 1.4em;
  font-size: 0.72em;
  font-weight: 700;
  line-height: 1.5;
  text-align: center;
  vertical-align: baseline;
  border: 1px solid currentColor;
  border-radius: 4px;
  opacity: 0.55;
  pointer-events: none;
}
```

- [ ] **Step 6: ブラウザで表示を確認**

`node dev-server.js` を起動し http://127.0.0.1:4173/ を開く。
- 6つのボタンにキーバッジが表示される（移動 `V` / ペン `P` / 矢印 `A` / ボードリセット `R` / 1つ戻す `Ctrl+Z` / 解除 `Esc`）。
- ツールボタンを押下状態（暗背景）にしてもバッジが読める。「ボードリセット」（暗背景）でも読める。
- レイアウトが崩れない（ツールバー・ヘッダーが折り返しても破綻しない。モバイル幅も `browser_resize` で確認）。
- `browser_evaluate` で `document.querySelector('#toolMoveBtn').getAttribute('aria-keyshortcuts')` が `'v'` を返す。

期待: 上記すべて成立。

- [ ] **Step 7: コミット**

```bash
git add index.html styles.css
git commit -m "ショートカットキーを対象ボタンに常時表示（kbdバッジ＋aria-keyshortcuts）"
```

---

## Self-Review（記入者確認済み）

- **Spec coverage:** キーマッピング6種 → Task 2 の switch と Ctrl+Z 分岐で全カバー。ガード（入力欄/IME/修飾キー/矢印非競合） → Task 2 Step 1 とその確認 Step 3。共通関数化 → Task 1。キー常時表示＋`aria-keyshortcuts` → Task 3。スタイル `.kbd-hint` → Task 3 Step 5。テスト計画8項目 → 各 Task の確認ステップに配分済み。
- **Placeholder scan:** TODO/TBD なし。全ステップに実コードまたは具体的な確認手順を記載。
- **Type consistency:** `undoDrawing()` / `clearSelection()` / `handleShortcut()` / `setDrawTool()` / `resetBoard()` の名称は Task 1〜2 で一貫。関数宣言（hoisting）のため `handleShortcut` が参照する共通関数の定義順序は問題にならない。
- **対象外（YAGNI）:** 色/縦表示/ガイドのショートカット、Redo、全消去のキー、キーのカスタマイズ、リセットの確認ダイアログは実装しない。
