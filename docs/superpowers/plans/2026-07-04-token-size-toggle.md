# 選手・ボールの表示サイズ3段階切り替え 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ツールバーの1ボタンで選手トークン（円・背番号・名前ラベル・方向マーカー）とボールの表示サイズを 小(0.7) / 中(1.0) / 大(1.4) の3段階に切り替え、選択を localStorage に永続化する。

**Architecture:** CSSカスタムプロパティ `--token-scale` を `#field` の `data-token-scale` 属性で切り替え、子孫の `.player-token` / `.ball-token` が既存の `--token` / `--ball` に倍率を掛けて参照する（位置は割合基準なのでズレない）。状態は `state.ui.tokenScale` に持たせ、`applyOrientation()` に倣う `applyTokenScale()` で属性付与とボタンラベル更新を行う。

**Tech Stack:** 素のHTML/CSS/JavaScript（フレームワーク・バンドラ・依存パッケージなし・ビルド不要）。テストフレームワークは無いため、検証は `node dev-server.js` → ブラウザで手動（Playwright可）。

## Global Constraints

- ゼロ依存・ビルド不要・相対パス参照を維持（パッケージ/バンドラを増やさない）。
- i18n: 表示文言は必ず翻訳キー経由。辞書 `MESSAGES.ja` / `.en` はキー一致を保つ（`assertLocaleParity` が不一致を警告）。文言を足したら両言語に追加。
- 既存の localStorage キー `soccer-board-state-v1` と保存構造は互換を保つ（`ui` にキー追加のみ、旧データは `tokenScale` 欠落 → `"medium"` にフォールバック）。
- 既存機能を壊さない: フォーメーション反映／ペン・矢印描画／戦術ガイド（5レーン・ビエルサライン・3ゾーン）／退場／ヘッダー折りたたみ／ドロワー／キーボードショートカット／盤面フィット／ダブルタップ／縦表示／空白クリック解除。
- 「中」（scale=1）は現状（背番号調整済み・コミット `6f33473`）と完全一致させる。倍率は 小=0.7 / 中=1.0 / 大=1.4。
- 背番号（`.player-token .number` の `font-size: calc(var(--token) * 0.5)`）と方向マーカー（`.dir-arc` / `.dir-handle`、`--token` 基準）は既に `--token` 基準なので、`--token` に倍率を掛ければ自動追従する（追加のスケール項は付けない）。

## 実装メモ（設計からの微修正）

設計書（`docs/superpowers/specs/2026-07-04-token-size-toggle-design.md`）ではボタン内を「ラベル語 + `#tokenSizeValue`」の2分割、i18nに `toolbar.tokenSize`「サイズ」を挙げていた。本計画では**ボタン内を単一 `<span id="tokenSizeLabel">` にまとめ、`t("toolbar.tokenSizeLabel", { size })` で全文（例「サイズ：中」）をJSから設定**する方式に一本化する。理由: 区切り文字「：」をHTMLに直書きせず全文をi18n化でき、可視テキスト自体がボタンのアクセシブル名になる（別途 aria-label 不要）。この結果 `toolbar.tokenSize`「サイズ」単独キーと `#tokenSizeValue` は使わない。設計の受け入れ基準（現在サイズ表示・言語切替でラベル切替・永続化・一括スケール）はすべて満たす。

---

### Task 1: CSSのサイズ倍率機構（`styles.css`）

`#field` の `data-token-scale` 属性で `--token-scale` を切り替え、`--token` / `--ball` / 名前ラベルにその倍率を掛ける。この時点では属性を手で付けて拡縮を確認できる（JS配線はTask 3）。

**Files:**
- Modify: `styles.css`（`.players-layer` 直後に倍率ルール追加／`--token`・`--ball`・`.name-tag` の各 font/size を calc化。PC・モバイル両方）

**Interfaces:**
- Produces: セレクタ `.field[data-token-scale="small|medium|large"]` が定義する CSS変数 `--token-scale`（0.7 / 1 / 1.4）。子孫トークン/ボールが継承して `--token` / `--ball` に乗算する。属性未設定時は `var(--token-scale, 1)` の既定1で中サイズ。

- [ ] **Step 1: 倍率ルールを追加**

`styles.css` の `.players-layer { … }` ブロック（`z-index: 2;` で閉じる、`611` 行目の `}`）の直後、`.player-token {`（`613` 行目）の**前**に、次を挿入する。

```css
/* 選手・ボールの表示サイズ3段階。#field の data-token-scale で切り替える倍率。
   子孫の .player-token / .ball-token が継承して --token / --ball に乗算する。 */
.field[data-token-scale="small"] {
  --token-scale: 0.7;
}
.field[data-token-scale="medium"] {
  --token-scale: 1;
}
.field[data-token-scale="large"] {
  --token-scale: 1.4;
}
```

- [ ] **Step 2: 選手トークンの `--token` を倍率込みに（PC）**

`styles.css` の `.player-token {` ブロック内（`614` 行目）を変更する。

変更前:
```css
.player-token {
  --token: 46px;
```
変更後:
```css
.player-token {
  --token: calc(46px * var(--token-scale, 1));
```

- [ ] **Step 3: 名前ラベルの font-size を倍率込みに（PC）**

`styles.css` の `.player-token .name-tag {` ブロック内（`657` 行目）を変更する。

変更前（このブロックは `max-width: 92px;` で始まる方）:
```css
  font-size: 0.7rem;
```
変更後:
```css
  font-size: calc(0.7rem * var(--token-scale, 1));
```

- [ ] **Step 4: ボールの `--ball` を倍率込みに（PC）**

`styles.css` の `.ball-token {` ブロック内（`728` 行目）を変更する。

変更前:
```css
.ball-token {
  --ball: 26px;
```
変更後:
```css
.ball-token {
  --ball: calc(26px * var(--token-scale, 1));
```

- [ ] **Step 5: モバイル（`@media (max-width: 680px)`）の基準も倍率込みに**

`styles.css` の `@media (max-width: 680px) {`（`1036` 行目）内で、次の3箇所を変更する。

`.player-token` の `--token`（`1062` 行目付近）:
```css
  .player-token {
    --token: calc(38px * var(--token-scale, 1));
  }
```

`.ball-token` の `--ball`（`1066` 行目付近）:
```css
  .ball-token {
    --ball: calc(22px * var(--token-scale, 1));
  }
```

`.player-token .name-tag` の font-size（`1071` 行目付近、`max-width: 70px;` を含むブロック）:
```css
  .player-token .name-tag {
    max-width: 70px;
    font-size: calc(0.64rem * var(--token-scale, 1));
  }
```

- [ ] **Step 6: ローカルで配信して開く**

Run: `node dev-server.js`
Expected: `http://127.0.0.1:4173/` で配信開始。ブラウザで同URLを開く。

- [ ] **Step 7: 属性を手で切り替えて拡縮を確認（devtools / Playwright）**

ブラウザのコンソール（または Playwright `browser_evaluate`）で以下を実行し、選手円とボールが倍率どおり変化することを確認する。

```js
const field = document.querySelector('#field');
const token = document.querySelector('.player-token .number');
const read = () => getComputedStyle(token).width;
field.setAttribute('data-token-scale', 'large');  // 46 * 1.4 = 64.4px
console.log('large', read());
field.setAttribute('data-token-scale', 'small');  // 46 * 0.7 = 32.2px
console.log('small', read());
field.setAttribute('data-token-scale', 'medium'); // 46px
console.log('medium', read());
field.removeAttribute('data-token-scale');         // 既定1 → 46px（後方互換）
console.log('none', read());
```

Expected: `large ≈ 64.4px` / `small ≈ 32.2px` / `medium = 46px` / `none = 46px`。目視でも large で円・ボール・背番号・名前ラベル・方向は一緒に拡大、small で縮小、中/未設定は現状どおり。選手/ボールの中心位置はどのサイズでもズレない。

- [ ] **Step 8: コミット**

```bash
git add styles.css
git commit -m "表示サイズ倍率の機構をCSSに追加（data-token-scale）"
```

---

### Task 2: i18n 辞書にサイズ文言を追加（`i18n.js`）

ボタンラベル用のキーを ja/en 両方に追加する（キー一致を保つ）。ボタン配線はTask 3。

**Files:**
- Modify: `i18n.js`（`MESSAGES.ja` の `toolbar.reset` 直後／`MESSAGES.en` の `toolbar.reset` 直後）

**Interfaces:**
- Produces: 翻訳キー `toolbar.tokenSizeLabel`（`{size}` 補間、ja「サイズ：{size}」/ en「Size: {size}」）、`toolbar.sizeSmall`（ja「小」/ en「S」）、`toolbar.sizeMedium`（ja「中」/ en「M」）、`toolbar.sizeLarge`（ja「大」/ en「L」）。Task 3 の `applyTokenScale()` が `t("toolbar.tokenSizeLabel", { size: t("toolbar.size<Scale>") })` で参照する。

- [ ] **Step 1: 日本語キーを追加**

`i18n.js` の `MESSAGES.ja` 内、`"toolbar.reset": "ボードリセット",`（`15` 行目）の直後に追加する。

```js
    "toolbar.tokenSizeLabel": "サイズ：{size}",
    "toolbar.sizeSmall": "小",
    "toolbar.sizeMedium": "中",
    "toolbar.sizeLarge": "大",
```

- [ ] **Step 2: 英語キーを追加**

`i18n.js` の `MESSAGES.en` 内、`"toolbar.reset": "Reset board",`（`92` 行目）の直後に追加する。

```js
    "toolbar.tokenSizeLabel": "Size: {size}",
    "toolbar.sizeSmall": "S",
    "toolbar.sizeMedium": "M",
    "toolbar.sizeLarge": "L",
```

- [ ] **Step 3: 配信して parity と補間を確認**

Run: `node dev-server.js`（起動済みならスキップ）。ブラウザで `http://127.0.0.1:4173/` を開き、コンソールで確認する。

```js
// キー欠落・parity 警告が出ていないこと（[i18n] の警告がコンソールに無い）
t("toolbar.tokenSizeLabel", { size: t("toolbar.sizeMedium") }); // → "サイズ：中"
```

言語を EN に切り替えてから（`#langToggleBtn` をクリック）:
```js
t("toolbar.tokenSizeLabel", { size: t("toolbar.sizeSmall") }); // → "Size: S"
```

Expected: それぞれ「サイズ：中」「Size: S」を返す。`[i18n] missing key` / parity 警告が出ない。

- [ ] **Step 4: コミット**

```bash
git add i18n.js
git commit -m "表示サイズ切替のi18n文言を追加（ja/en）"
```

---

### Task 3: 状態・ボタン・配線（`app.js` + `index.html`）

`state.ui.tokenScale` を追加・永続化し、ツールバーに循環ボタンを置き、`applyTokenScale()` で属性とラベルを更新する。ここで機能が通しで動く。

**Files:**
- Modify: `index.html:63`（縦表示ボタンの直後にサイズボタンを追加）
- Modify: `app.js`（`els` に参照2つ追加 `95`行付近／`TOKEN_SCALES` 定数追加 `128`行付近／初期 `state.ui` `140`行／`loadState` `335`行／`saveState` `355`行／`bindEvents` の click 追加 `198`行付近／`applyTokenScale()` 新設 `565`行付近／`init` に2箇所呼び出し `154`-`170`行）

**Interfaces:**
- Consumes: 既存 `state.ui`（`{ headerCollapsed }`）、既存 `els.field`（`#field`）、既存 `t(key, vars)`（`{name}` 補間）、既存 `saveState()`、既存 `registerLocaleChange(cb)`、Task 1 の `data-token-scale` 機構、Task 2 の翻訳キー。
- Produces: `TOKEN_SCALES = ["small", "medium", "large"]`（循環順）、`state.ui.tokenScale`（`"small"|"medium"|"large"`、既定 `"medium"`）、`applyTokenScale()`（`#field` に `data-token-scale` 付与＋ボタンラベル更新、戻り値なし）、DOM `#toggleTokenSizeBtn` / `#tokenSizeLabel`。

- [ ] **Step 1: ツールバーにボタンを追加（`index.html`）**

`index.html` の縦表示ボタン閉じタグ `</button>`（`63` 行目）の直後、`<button id="toggleLanesBtn" …>`（`64` 行目）の**前**に挿入する。

```html
          <button id="toggleTokenSizeBtn" class="secondary-button" type="button">
            <span id="tokenSizeLabel">サイズ：中</span>
          </button>
```

（`#tokenSizeLabel` はJSが `applyTokenScale()` で上書きするため `data-i18n` は付けない。初期テキストはJS実行前のフォールバック。）

- [ ] **Step 2: `els` に参照を追加（`app.js`）**

`app.js` の `els` 定義内、`toggleOrientationBtn: document.querySelector("#toggleOrientationBtn"),`（`95` 行目）の直後に追加する。

```js
  toggleTokenSizeBtn: document.querySelector("#toggleTokenSizeBtn"),
  tokenSizeLabel: document.querySelector("#tokenSizeLabel"),
```

- [ ] **Step 3: 循環順の定数を追加（`app.js`）**

`app.js` の `els` オブジェクト閉じ `};`（`128` 行目）の直後、`let state = {`（`130` 行目）の**前**に追加する。

```js
const TOKEN_SCALES = ["small", "medium", "large"];
```

- [ ] **Step 4: 初期 state に既定サイズを追加（`app.js`）**

`app.js` の初期 `state` オブジェクト内（`140` 行目）を変更する。

変更前:
```js
  ui: { headerCollapsed: false },
```
変更後:
```js
  ui: { headerCollapsed: false, tokenScale: "medium" },
```

- [ ] **Step 5: `loadState()` で保存値をサニタイズ（`app.js`）**

`app.js` の `loadState()` 内（`335` 行目）を変更する。

変更前:
```js
  state.ui = { headerCollapsed: Boolean(saved?.ui?.headerCollapsed) };
```
変更後:
```js
  const tokenScale = TOKEN_SCALES.includes(saved?.ui?.tokenScale) ? saved.ui.tokenScale : "medium";
  state.ui = { headerCollapsed: Boolean(saved?.ui?.headerCollapsed), tokenScale };
```

- [ ] **Step 6: `saveState()` に含める（`app.js`）**

`app.js` の `saveState()` の payload 内（`355` 行目）を変更する。

変更前:
```js
    ui: { headerCollapsed: state.ui.headerCollapsed },
```
変更後:
```js
    ui: { headerCollapsed: state.ui.headerCollapsed, tokenScale: state.ui.tokenScale },
```

- [ ] **Step 7: クリックで循環するリスナーを追加（`app.js`）**

`app.js` の `bindEvents()` 内、縦表示トグルの `addEventListener` ブロック（`194`-`198` 行目）の閉じ `});`（`198` 行目）の直後に追加する。

```js
  els.toggleTokenSizeBtn.addEventListener("click", () => {
    const i = TOKEN_SCALES.indexOf(state.ui.tokenScale);
    state.ui.tokenScale = TOKEN_SCALES[(i + 1) % TOKEN_SCALES.length];
    saveState();
    applyTokenScale();
  });
```

- [ ] **Step 8: `applyTokenScale()` を新設（`app.js`）**

`app.js` の `applyOrientation()` 関数の閉じ `}`（`565` 行目）の直後に追加する。

```js
function applyTokenScale() {
  const scale = state.ui.tokenScale;
  els.field.setAttribute("data-token-scale", scale);
  const sizeKey = {
    small: "toolbar.sizeSmall",
    medium: "toolbar.sizeMedium",
    large: "toolbar.sizeLarge",
  }[scale];
  els.tokenSizeLabel.textContent = t("toolbar.tokenSizeLabel", { size: t(sizeKey) });
}
```

- [ ] **Step 9: `init()` から呼ぶ（初期反映 + 言語切替）（`app.js`）**

`app.js` の `init()`（`154`-`170` 行目）を2箇所変更する。

(a) `registerLocaleChange` のコールバック（`158`-`162` 行目）に `applyTokenScale();` を足す。

変更前:
```js
  registerLocaleChange(() => {
    renderAll();
    applyHeaderCollapsed();
    applyPanelOpen();
  });
```
変更後:
```js
  registerLocaleChange(() => {
    renderAll();
    applyHeaderCollapsed();
    applyPanelOpen();
    applyTokenScale();
  });
```

(b) 初期反映として `applyPanelOpen();`（`166` 行目）の直後に `applyTokenScale();` を足す。

変更前:
```js
  applyHeaderCollapsed();
  applyPanelOpen();
  fitBoardSize();
```
変更後:
```js
  applyHeaderCollapsed();
  applyPanelOpen();
  applyTokenScale();
  fitBoardSize();
```

- [ ] **Step 10: 配信して受け入れ基準を手動検証**

Run: `node dev-server.js`（起動済みならスキップ）。ブラウザで `http://127.0.0.1:4173/` を開き、以下を順に確認する。

1. ツールバーに「サイズ：中」ボタンが表示される（縦表示アイコンの右）。押すごとに **中 → 大 → 小 → 中** とラベルと盤面が変化し、選手（円・背番号・名前・方向マーカー）とボールが 1.0 / 1.4 / 0.7 倍で一括変化する。
2. 「中」で見た目が現状（コミット `6f33473`）と一致。各サイズで背番号（1桁・2桁）が円内に収まり読める。大でも選手が過度に重ならない。
3. 選手を選択 → 金色ハイライト/回転ハンドルが各サイズで正しく出る。ドラッグ移動できる。同じ選手をダブルタップで管理パネルが開く。位置が各サイズでズレない。
4. サイズを「大」にして**リロード** → 大が維持される。**ボードリセット** → 選手配置は初期化されるが**サイズは大のまま維持**される。
5. `#langToggleBtn` で EN に切替 → ボタンが「Size: L」等に変わる。日本語に戻すと「サイズ：…」に戻る。
6. ブラウザ幅を 680px 以下に狭める → 3段階が効き、モバイル基準（38px/22px）に倍率が乗る。
7. 既存機能の抜き取り: フォーメーション反映／ペン・矢印描画／戦術ガイド3種／退場／ヘッダー折りたたみ／ドロワー／縦表示／空白クリック解除 が従来どおり。

Expected: 1〜7 すべて期待どおり。特に 4 の「ボードリセットでサイズ維持」、6 のモバイル追従、位置ズレなしを確認。

- [ ] **Step 11: コミット**

```bash
git add app.js index.html
git commit -m "選手・ボールの表示サイズ3段階切り替えボタンを追加"
```

---

## Self-Review

**1. Spec coverage（スペック各項目 → 対応タスク）:**
- 事前対応（背番号 `calc(var(--token) * 0.5)`）= 中基準 → 実施済み（コミット `6f33473`）。Task 1 で `--token` に倍率を掛け自動追従。
- UI 1ボタン循環（中→大→小） → Task 3 Step 1/7、検証 Step 10-1。
- 倍率 0.7/1.0/1.4 → Task 1 Step 1、検証 Step 7 / Step 10-1。
- 対象を一括スケール（円・背番号・名前・方向・ボール） → Task 1（背番号・方向は `--token` 基準で自動、名前は Step 3/5、ボールは Step 4/5）、検証 Step 10-1。
- 保存（`state.ui.tokenScale` 永続化） → Task 3 Step 4/5/6、検証 Step 10-4。
- ボードリセットで維持 → `resetBoard()` は未変更で `state.ui` に触れない。検証 Step 10-4。
- 倍率方式・モバイルでも有効 → Task 1 Step 5、検証 Step 10-6。
- i18n（ja/en、キー一致） → Task 2、検証 Step 3 / Step 10-5。
- 位置ズレなし・盤面フィット非影響 → `#field` 寸法不変・`translate(-50%,-50%)` 中心合わせ。検証 Step 10-3。
- 後方互換（旧localStorage） → Task 3 Step 5 のフォールバック。
- 非退行（既存機能） → 検証 Step 10-7。

**2. Placeholder scan:** TBD/TODO/「適切に処理」等なし。追加・変更コードは全文（before/after）で記載済み。

**3. Type consistency:**
- `TOKEN_SCALES`（定義 Task3 Step3、参照 Step5 の `.includes` / Step7 の `indexOf`）で名称一致。
- `state.ui.tokenScale`（初期 Step4 / load Step5 / save Step6 / click Step7 / apply Step8）で一貫。値は常に `"small"|"medium"|"large"`。
- `applyTokenScale`（定義 Step8、呼び出し Step7 click・Step9 init×2）で名称一致。
- DOM `#toggleTokenSizeBtn` / `#tokenSizeLabel`（HTML Step1、`els` Step2、参照 Step7/Step8）で一致。
- i18n キー `toolbar.tokenSizeLabel` / `toolbar.sizeSmall|Medium|Large`（定義 Task2、参照 Task3 Step8）で一致。ja/en 同一キー集合（parity）。
- CSS 変数 `--token-scale`（定義 Task1 Step1、参照 Step2/3/4/5 の calc）で一致。
