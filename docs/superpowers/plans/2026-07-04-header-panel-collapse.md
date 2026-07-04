# ヘッダー／側面パネルのしまい込み Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ヘッダーを折りたたみ、側面パネルをかぶせ型ドロワー化して、タブレットで盤面を最大化できるようにする。

**Architecture:** バニラHTML/CSS/JSの既存構成に、①ヘッダー折りたたみ（`.is-collapsed` クラス）、②側面パネルの右スライドドロワー（`position: fixed` ＋ `transform`）、③選択連動の自動開閉（`selectPlayer`/`clearSelection` フック）を、既存の「クラス付け替え＋aria更新」パターン（`applyOrientation` 等）に倣って追加する。パネルをレイアウトグリッドから外すため、盤面が全幅を使えるようになる。

**Tech Stack:** HTML / CSS / Vanilla JS（ビルド無し・依存追加無し）。配信は `node dev-server.js 4173`。検証はブラウザ実挙動（Playwright / claude-in-chrome でのスクショ）。

## Global Constraints

- ビルドステップ・npm依存の追加は禁止（純粋な静的アプリのまま）。
- `:has()` などに機能依存しない。開閉はJSのクラス付与ベースで実装する。
- 永続化するのは `ui.headerCollapsed` のみ。既存の `localStorage` payload（`saveState`/`loadState`）に相乗りする。
- パネルの開閉 `panelOpen` は非永続（モジュールスコープ変数）。リロード時は選択なし＝閉で開始。
- タッチ操作のボタン当たり判定は最低 38〜44px を確保。
- スライドは CSS `transition`。`@media (prefers-reduced-motion: reduce)` でアニメ無効。
- 既存の「クラス付け替え＋aria更新」パターン（`applyOrientation()` 等）に倣う。
- 検証は毎回 `node dev-server.js 4173` を起動し、`http://127.0.0.1:4173/` をブラウザで開いて実挙動を確認する。

---

## File Structure

- `index.html` — ヘッダーにトグルボタン、パネルにid付与、末尾にパネルトグル＋スクリムを追加。
- `styles.css` — ヘッダー折りたたみ、パネルのドロワー化、盤面全幅化＋最大幅キャップ、スクリム、reduced-motion。
- `app.js` — `els` 追加、`state.ui` 追加、`loadState`/`saveState` 相乗り、`applyHeaderCollapsed()`/`applyPanelOpen()` 追加、`bindEvents`・`init`・`selectPlayer`・`clearSelection` にフック。

新規ファイルは無し。全て既存3ファイルへの追記・改変。

---

### Task 1: ヘッダーの折りたたみ

**Files:**
- Modify: `index.html`（header ブロック 11-37行）
- Modify: `styles.css`（`.brand` 付近 80行、`.app-header` 66-78行）
- Modify: `app.js`（`els` 85-120、`state` 122-132、`bindEvents` 148、`loadState` 277-279付近、`saveState` 288-298、`init` 142-146）

**Interfaces:**
- Produces:
  - `state.ui = { headerCollapsed: boolean }`（`saveState` の payload に `ui` として保存、`loadState` で復元）
  - `applyHeaderCollapsed()`: 引数なし。`.app-header` に `is-collapsed` をトグルし、`#toggleHeaderBtn` の `textContent`/`aria-expanded`/`aria-label` を更新する。
  - `els.appHeader`, `els.toggleHeaderBtn`

- [ ] **Step 1: index.html — ヘッダーにトグルを追加し brand をラップ**

`index.html` の header ブロック（11-37行）を次に置き換える（`.toolbar` の中身は現状のまま維持し、`id="headerToolbar"` だけ追加）:

```html
      <header class="app-header">
        <div class="header-lead">
          <div class="brand">
            <div class="brand-mark" aria-hidden="true">SB</div>
            <div>
              <h1>Soccer Board</h1>
              <p>チーム戦術ホワイトボード</p>
            </div>
          </div>
          <button id="toggleHeaderBtn" class="header-toggle" type="button" aria-expanded="true" aria-controls="headerToolbar" aria-label="ツールバーを隠す">▾</button>
        </div>

        <div class="toolbar" id="headerToolbar" aria-label="ボード操作">
          <label class="select-control">
            <span>配置</span>
            <select id="formationSelect">
              <option value="4-4-2">4-4-2</option>
              <option value="4-3-3">4-3-3</option>
              <option value="4-2-3-1">4-2-3-1</option>
              <option value="3-5-2">3-5-2</option>
            </select>
          </label>
          <button id="applyFormationBtn" class="secondary-button" type="button">反映</button>
          <button id="toggleOrientationBtn" class="secondary-button" type="button" aria-pressed="false">縦表示</button>
          <button id="toggleLanesBtn" class="secondary-button" type="button" aria-pressed="false">5レーン</button>
          <button id="toggleBielsaBtn" class="secondary-button" type="button" aria-pressed="false">ビエルサライン</button>
          <button id="toggleThirdsBtn" class="secondary-button" type="button" aria-pressed="false">3ゾーン</button>
          <button id="resetBoardBtn" class="primary-button" type="button" aria-keyshortcuts="r">ボードリセット <kbd class="kbd-hint">R</kbd></button>
        </div>
      </header>
```

- [ ] **Step 2: styles.css — ヘッダー折りたたみのスタイル**

`styles.css` の `.brand { ... }`（80-85行）の直前に次を追加:

```css
.header-lead {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.header-toggle {
  flex: none;
  min-width: 38px;
  min-height: 38px;
  display: grid;
  place-items: center;
  border-radius: 8px;
  background: #e7eee9;
  color: var(--ink);
  font-size: 0.9rem;
  font-weight: 800;
}

.app-header.is-collapsed {
  padding-top: 10px;
  padding-bottom: 10px;
}

.app-header.is-collapsed .toolbar {
  display: none;
}

.app-header.is-collapsed .brand p {
  display: none;
}
```

- [ ] **Step 3: app.js — els にヘッダー要素を追加**

`app.js` の `els` オブジェクト（85行以降）に次の2行を追加（`formationSelect` の直前など先頭付近）:

```js
  appHeader: document.querySelector(".app-header"),
  toggleHeaderBtn: document.querySelector("#toggleHeaderBtn"),
```

- [ ] **Step 4: app.js — state.ui を追加**

`app.js` の `state` 初期化（122-132行）の `guides:` の次に追加:

```js
  ui: { headerCollapsed: false },
```

- [ ] **Step 5: app.js — loadState / saveState に相乗り**

`loadState()` 内、`state.selected = null;`（279行）の直前に追加:

```js
  state.ui = { headerCollapsed: Boolean(saved?.ui?.headerCollapsed) };
```

`saveState()` の payload（289-298行）、`guides: state.guides,` の次に追加:

```js
    ui: { headerCollapsed: state.ui.headerCollapsed },
```

- [ ] **Step 6: app.js — applyHeaderCollapsed() を追加**

`applyOrientation()`（488-493行）の直後に新規関数を追加:

```js
function applyHeaderCollapsed() {
  const collapsed = state.ui.headerCollapsed;
  els.appHeader.classList.toggle("is-collapsed", collapsed);
  els.toggleHeaderBtn.textContent = collapsed ? "▸" : "▾";
  els.toggleHeaderBtn.setAttribute("aria-expanded", String(!collapsed));
  els.toggleHeaderBtn.setAttribute(
    "aria-label",
    collapsed ? "ツールバーを表示" : "ツールバーを隠す",
  );
}
```

- [ ] **Step 7: app.js — クリックで開閉を配線 + 初期反映**

`bindEvents()` 内、`els.resetBoardBtn.addEventListener(...)` ブロック（171-173行）の直後に追加:

```js
  els.toggleHeaderBtn.addEventListener("click", () => {
    state.ui.headerCollapsed = !state.ui.headerCollapsed;
    applyHeaderCollapsed();
    saveState();
  });
```

`init()`（142-146行）の `renderAll();` の直後に追加:

```js
  applyHeaderCollapsed();
```

- [ ] **Step 8: ブラウザで検証**

Run: `node dev-server.js 4173`（バックグラウンド起動）
`http://127.0.0.1:4173/` を開く。
Expected:
- ブランド横に「▾」ボタンが表示される。
- クリックすると `.app-header` が細いバー1本になり（ツールバー非表示・サブタイトル非表示）、ボタンが「▸」に変わる。
- もう一度クリックで元に戻る。
- 盤面内の描画ツールバー（移動/ペン/矢印…）は折りたたみ中も表示されたまま。
- 折りたたんだ状態でリロードすると、折りたたみが復元される。

- [ ] **Step 9: Commit**

```bash
git add index.html styles.css app.js
git commit -m "ヘッダー折りたたみ機能を追加"
```

---

### Task 2: 側面パネルのかぶせ型ドロワー化 ＋ 盤面全幅化

**Files:**
- Modify: `index.html`（`<aside class="side-panel">` 90行、`</main>` 142行の直後）
- Modify: `styles.css`（`.layout` 194-200、`.field-shell` 301-306、`.side-panel` 716-724、末尾）
- Modify: `app.js`（`els` 85-120、モジュール変数 134-138、`bindEvents` 148以降、`init` 142-146）

**Interfaces:**
- Consumes: `els`（Task 1 で追加済みの構造）
- Produces:
  - モジュール変数 `let panelOpen = false`
  - `applyPanelOpen()`: 引数なし。`#sidePanel` に `is-open`、`#panelScrim` に `is-visible` をトグルし、`#togglePanelBtn` の `aria-expanded`/`aria-label` を更新、開いた時はドロワー先頭へスクロール。
  - `setPanelOpen(open: boolean)`: `panelOpen` を設定して `applyPanelOpen()` を呼ぶ。
  - `els.sidePanel`, `els.togglePanelBtn`, `els.panelScrim`

- [ ] **Step 1: index.html — aside に id 付与、末尾にトグル＋スクリム追加**

`index.html` の `<aside class="side-panel" aria-label="管理パネル">`（90行）を次に変更:

```html
        <aside id="sidePanel" class="side-panel" aria-label="管理パネル">
```

`</main>`（142行）の直後、`</div>`（143行、`.app` を閉じる行）の直前に追加:

```html

      <button id="togglePanelBtn" class="panel-toggle" type="button" aria-expanded="false" aria-controls="sidePanel" aria-label="管理パネルを開く">パネル</button>
      <div id="panelScrim" class="panel-scrim"></div>
```

- [ ] **Step 2: styles.css — 盤面を全幅化（レイアウトを単一カラムに）**

`styles.css` の `.layout`（194-200行）の `grid-template-columns` を単一カラムに変更:

```css
.layout {
  flex: 1;
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 18px;
  padding: 18px clamp(14px, 3vw, 32px) 28px;
}
```

- [ ] **Step 3: styles.css — 盤面の最大幅キャップ（縦に伸びすぎ防止・中央寄せ）**

`.field-shell`（301-306行）に `max-width` と `margin-inline` を追加:

```css
.field-shell {
  background: #20342a;
  border-radius: 8px;
  padding: clamp(8px, 1.4vw, 16px);
  box-shadow: var(--shadow);
  max-width: min(100%, calc((100vh - 200px) * 1.5441));
  margin-inline: auto;
}
```

（1.5441 = 105/68。ヘッダー＋スコア＋描画ツールバー分を 200px と見積もり、横フィールドの高さがビューポートに収まるよう横幅を制限。縦表示は既存の `.field-shell:has(.field.vertical)` ルール（1044-1050行）が上書きする。）

- [ ] **Step 4: styles.css — side-panel をドロワー化 + スクリム + トグルタブ + reduced-motion**

`.side-panel`（716-724行）を次に置き換える:

```css
.side-panel {
  position: fixed;
  top: 0;
  right: 0;
  z-index: 40;
  width: min(380px, 88vw);
  height: 100vh;
  min-width: 0;
  background: var(--panel);
  border-left: 1px solid var(--line);
  box-shadow: -14px 0 36px rgba(30, 46, 37, 0.22);
  overflow-y: auto;
  transform: translateX(100%);
  transition: transform 0.25s ease;
  pointer-events: none;
}

.side-panel.is-open {
  transform: translateX(0);
  pointer-events: auto;
}

.panel-scrim {
  position: fixed;
  inset: 0;
  z-index: 30;
  background: rgba(20, 28, 24, 0.4);
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.25s ease;
}

.panel-scrim.is-visible {
  opacity: 1;
  pointer-events: auto;
}

.panel-toggle {
  position: fixed;
  top: 50%;
  right: 0;
  z-index: 35;
  transform: translateY(-50%);
  writing-mode: vertical-rl;
  min-width: 40px;
  min-height: 96px;
  padding: 14px 9px;
  border-radius: 12px 0 0 12px;
  background: var(--ink);
  color: #fff;
  font-weight: 800;
  letter-spacing: 2px;
  box-shadow: var(--shadow);
}

@media (prefers-reduced-motion: reduce) {
  .side-panel,
  .panel-scrim {
    transition: none;
  }
}
```

（既存の `@media (max-width: 1020px)` 内の `.side-panel { align-self: stretch }` と `.layout { grid-template-columns: 1fr }` は `position: fixed` 化と単一カラム化により冗長になるが、害はないので残す。）

- [ ] **Step 5: app.js — els にパネル要素を追加**

`els` に3行追加（Task 1 で足した `toggleHeaderBtn` の下など）:

```js
  sidePanel: document.querySelector("#sidePanel"),
  togglePanelBtn: document.querySelector("#togglePanelBtn"),
  panelScrim: document.querySelector("#panelScrim"),
```

- [ ] **Step 6: app.js — panelOpen 変数と適用関数を追加**

モジュール変数群（134-138行、`let drawColor = "yellow";` の直後）に追加:

```js
let panelOpen = false;
```

`applyHeaderCollapsed()`（Task 1 で追加した関数）の直後に追加:

```js
function applyPanelOpen() {
  els.sidePanel.classList.toggle("is-open", panelOpen);
  els.panelScrim.classList.toggle("is-visible", panelOpen);
  els.togglePanelBtn.setAttribute("aria-expanded", String(panelOpen));
  els.togglePanelBtn.setAttribute(
    "aria-label",
    panelOpen ? "管理パネルを閉じる" : "管理パネルを開く",
  );
  if (panelOpen) els.sidePanel.scrollTop = 0;
}

function setPanelOpen(open) {
  panelOpen = open;
  applyPanelOpen();
}
```

- [ ] **Step 7: app.js — トグル/スクリムを配線 + 初期反映**

`bindEvents()` 内、Task 1 で追加したヘッダートグルの配線の直後に追加:

```js
  els.togglePanelBtn.addEventListener("click", () => setPanelOpen(!panelOpen));
  els.panelScrim.addEventListener("click", () => setPanelOpen(false));
```

`init()` 内、`applyHeaderCollapsed();`（Task 1 で追加）の直後に追加:

```js
  applyPanelOpen();
```

- [ ] **Step 8: ブラウザで検証**

Run: `node dev-server.js 4173`
`http://127.0.0.1:4173/` を開く。
Expected:
- フィールドが横幅いっぱい（中央寄せ、縦に伸びすぎない）で表示され、右カラムのパネルは消えている。
- 右端中央に縦書きの「パネル」タブが常時表示される。
- 「パネル」タブをタップ → 右からドロワーがスライドイン、背後にスクリム。
- スクリム（パネル外の暗い領域）をタップ → ドロワーが閉じる。
- リロードするとパネルは閉じた状態で開始。

- [ ] **Step 9: Commit**

```bash
git add index.html styles.css app.js
git commit -m "側面パネルをかぶせ型ドロワー化し盤面を全幅表示に"
```

---

### Task 3: 選択連動の自動開閉

**Files:**
- Modify: `app.js`（`clearSelection` 433-440、`selectPlayer` 1385-1393）

**Interfaces:**
- Consumes: `setPanelOpen(open)`（Task 2）
- Produces: 選手選択でパネル自動オープン、選択解除で自動クローズ。

- [ ] **Step 1: app.js — selectPlayer でパネルを開く**

`selectPlayer()`（1385-1393行）の末尾、`syncSelectedTokens();` の直後に追加:

```js
  setPanelOpen(true);
```

変更後の関数:

```js
function selectPlayer(team, id) {
  if (!findPlayer(team, id)) return;
  state.selected = { team, id };
  renderSelectionPanel();
  renderSubstitutionPanel();
  renderHomeRoster();
  renderOpponentRoster();
  syncSelectedTokens();
  setPanelOpen(true);
}
```

- [ ] **Step 2: app.js — clearSelection でパネルを閉じる**

`clearSelection()`（433-440行）の末尾、`syncSelectedTokens();` の直後に追加:

```js
  setPanelOpen(false);
```

変更後の関数:

```js
function clearSelection() {
  state.selected = null;
  renderSelectionPanel();
  renderSubstitutionPanel();
  renderHomeRoster();
  renderOpponentRoster();
  syncSelectedTokens();
  setPanelOpen(false);
}
```

- [ ] **Step 3: ブラウザで検証**

Run: `node dev-server.js 4173`
`http://127.0.0.1:4173/` を開く。
Expected:
- フィールド上の選手トークンをタップ → ドロワーが自動で開き、「選択中」に選手情報が出る（ドロワーは先頭にスクロール）。
- パネル内のロスター行をタップ → 同様に開く／選択が切り替わる。
- Esc キー、「解除」ボタン、盤面の背景タップ → いずれもドロワーが自動で閉じる。
- 「パネル」タブで手動オープン中（無選択）は開いたまま。その状態から選手を選択→解除すると閉じる（仕様どおりの割り切り）。

- [ ] **Step 4: Commit**

```bash
git add app.js
git commit -m "選手の選択/解除に連動してパネルを自動開閉"
```

---

### Task 4: タブレット実寸での統合検証と微調整

**Files:**
- Modify（必要時のみ）: `styles.css`

**Interfaces:**
- Consumes: Task 1〜3 の成果すべて。

- [ ] **Step 1: タブレット横向きで検証**

Run: `node dev-server.js 4173`
ブラウザをビューポート **1024×768** にリサイズして `http://127.0.0.1:4173/` を開く。スクリーンショットを撮る。
Expected / チェック項目:
- 盤面が広く使え、ヘッダー折りたたみで縦の余白が増える。
- 「パネル」タブが指で押しやすい（縦96px以上）。
- ドロワーの開閉、スクリムでのクローズが滑らか。
- 選手タップでドロワーが開き、選択中が見える。

- [ ] **Step 2: タブレット縦向きで検証**

ビューポートを **820×1180** にリサイズしてスクリーンショットを撮る。
Expected:
- 盤面が横幅いっぱい、縦に伸びすぎない（最大幅キャップが効く）。
- ヘッダー・パネルの開閉が横向きと同様に動作。

- [ ] **Step 3: reduced-motion 検証**

OS/ブラウザで「視差効果を減らす（prefers-reduced-motion: reduce）」を有効にして、パネル開閉時にスライドアニメが無効になることを確認。

- [ ] **Step 4: 見つかった崩れを微修正（あれば）**

上記で崩れ・押しにくさがあれば `styles.css` を最小限修正する。修正した場合のみコミット:

```bash
git add styles.css
git commit -m "タブレット表示の微調整"
```

崩れが無ければコミット不要（このタスクは検証のみで完了）。

---

## Self-Review

**1. Spec coverage:**
- ①ヘッダー折りたたみ（細いバー・ツールバー非表示・Rショートカット維持・状態保存）→ Task 1。✓
- ②パネルのかぶせ型ドロワー（fixed/transform・トグルタブ・スクリム・全幅化）→ Task 2。✓
- ③選択連動（選択で開く・解除で閉じる・手動オープン維持）→ Task 3。✓
- ④タッチ配慮（44px・reduced-motion・閉時 pointer-events none）→ Task 2（CSS）＋ Task 4（検証）。✓
- ⑤状態・テスト（`ui.headerCollapsed` のみ保存・panelOpen 非永続・タブレット実寸検証）→ Task 1（保存）＋ Task 4（検証）。✓
- エッジケース（両立・手動オープン中の選択→解除で閉じる・localStorageブロック時も動作・:has非依存）→ 実装方針で担保。✓

**2. Placeholder scan:** TBD/TODO/「適切に処理」等は無し。各ステップに実コードを記載。✓

**3. Type consistency:** `state.ui.headerCollapsed`（Task 1 定義）、`applyHeaderCollapsed()`/`applyPanelOpen()`/`setPanelOpen()`（定義と参照が一致）、`els.appHeader`/`toggleHeaderBtn`/`sidePanel`/`togglePanelBtn`/`panelScrim`（定義と参照が一致）。id は `#sidePanel`/`#togglePanelBtn`/`#panelScrim`/`#toggleHeaderBtn`/`#headerToolbar` で HTML・CSS・JS 間で統一。✓
