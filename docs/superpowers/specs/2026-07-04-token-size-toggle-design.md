# 選手・ボールの表示サイズ3段階切り替え — 設計

## 背景 / 問題

盤面上の選手トークン（`.player-token` の円 `--token`）とボール（`.ball-token` の `--ball`）の
表示サイズは固定で、利用者が調整できない。画面や用途（全体を俯瞰したい／細部を見せたい、
プロジェクタ投影、スマホ）によって「もう少し大きく／小さく」したい要望がある。

トークンとボールのサイズを **小 / 中 / 大** の3段階で切り替えられるボタンを追加する。

## 事前対応（実施済み・本設計の「中」基準）

本設計に入る前段として、**背番号の文字サイズ**を円に比例させて調整済み。円の直径
（`--token`）は変えず、文字だけを大きくして視認性を上げた。これを「中」の基準とする。

- `.player-token .number` に `font-size: calc(var(--token) * 0.5)` を追加。
  - PC: 円46px → 文字 約23px / モバイル: 円38px → 文字 約19px。
  - 円径（`--token`）基準なので、後述のサイズ切替でも**文字は円と一緒に自動追従**する
    （番号用の追加スケール項は不要）。
- 円のサイズ（`--token` = 46px / 38px）は不変。

## 決定事項（ブレストで確定）

- **UI**: 1つのボタンで循環。内部の並びは 小 → 中 → 大（循環）で、押すたびに次段へ進む。
  既定は「中」なので**初回押下は 中 → 大**、以降 大 → 小 → 中 … と巡る。既存「縦表示」トグルと同じ
  `.secondary-button` でツールバーに並べ、現在サイズをラベル表示。
- **倍率**: 小 = 0.7 / 中 = 1.0 / 大 = 1.4。中は現状（事前対応後）と完全一致。
- **対象**: 選手トークン（円・背番号・名前ラベル・方向マーカー）とボールを**一括**でスケール。
- **保存**: `state.ui.tokenScale` に永続化（localStorage）。**ボードリセットでは維持**（`resetBoard()`
  は `state.ui` を触らないため自然に残る）。ビュー設定（縦表示・ガイド）と同じ扱い。
- **方式**: 倍率（乗算）方式。絶対px指定にせず、PC/モバイルの各基準px（46/38・26/22）に倍率を
  掛ける。これによりモバイルの縮小表示でも3段階が正しく効く。

## 変更内容

素のHTML/CSS/JS + i18n辞書。ゼロ依存・相対パス・ビルド不要を維持。

### 1. 状態と永続化（`app.js`）

`state.ui` に `tokenScale`（`"small" | "medium" | "large"`、既定 `"medium"`）を追加する。

- 初期 `state` オブジェクト（`ui: { headerCollapsed: false }`）に `tokenScale: "medium"` を追加。
- `loadState()`: `state.ui` の組み立て時に、保存値が3種のいずれかなら採用、それ以外は `"medium"`。
  ```js
  const scale = ["small", "medium", "large"].includes(saved?.ui?.tokenScale)
    ? saved.ui.tokenScale
    : "medium";
  state.ui = { headerCollapsed: Boolean(saved?.ui?.headerCollapsed), tokenScale: scale };
  ```
- `saveState()`: payload の `ui` に `tokenScale: state.ui.tokenScale` を追加。
- `resetBoard()` は変更しない（`state.ui` に触れないので `tokenScale` は維持される）。

### 2. CSS（倍率方式・`styles.css`）

盤面 `#field` に `data-token-scale="small|medium|large"` を付け、倍率変数 `--token-scale` を定義。

```css
.field[data-token-scale="small"]  { --token-scale: 0.7; }
.field[data-token-scale="medium"] { --token-scale: 1; }
.field[data-token-scale="large"]  { --token-scale: 1.4; }
```

トークン／ボールの基準pxに倍率を掛ける（PC・モバイル両方）。

- PC（既存 `--token: 46px` / `--ball: 26px`）:
  - `.player-token { --token: calc(46px * var(--token-scale, 1)); }`
  - `.ball-token   { --ball:  calc(26px * var(--token-scale, 1)); }`
- モバイル（`@media (max-width: 680px)` の既存 `--token: 38px` / `--ball: 22px`）:
  - `.player-token { --token: calc(38px * var(--token-scale, 1)); }`
  - `.ball-token   { --ball:  calc(22px * var(--token-scale, 1)); }`
- `var(--token-scale, 1)` の既定 1 により、属性未設定でも中サイズで表示（後方互換）。

追従する要素（追加作業の要否）:

- **背番号の円・文字**: `--token` 基準なので自動追従（追加不要）。
- **方向マーカー** `.dir-arc` / `.dir-handle`: 既に `--token` 基準なので自動追従（追加不要）。
- **名前ラベル** `.name-tag`: 現状 `font-size: 0.7rem`（モバイル `0.64rem`）固定。円と釣り合うよう
  倍率を掛ける:
  - `.player-token .name-tag { font-size: calc(0.7rem * var(--token-scale, 1)); }`
  - モバイル: `calc(0.64rem * var(--token-scale, 1))`。
  - `max-width`（92px / 70px）はそのまま（過度に伸ばさない）。
- **ボール** `.ball-token`: `--ball` 基準（本体・`::before` の模様も `inset` 基準）で自動追従。

### 3. UI（1ボタン循環・`index.html`）

ツールバー（`#toggleOrientationBtn` の隣）にボタンを追加する。

```html
<button id="toggleTokenSizeBtn" class="secondary-button" type="button"
        aria-label="表示サイズ：中" title="表示サイズ：中">
  <span data-i18n="toolbar.tokenSize">サイズ</span>：<span id="tokenSizeValue">中</span>
</button>
```

- ラベルは「サイズ：<現在値>」。`<span data-i18n>` でラベル語を包み、値部分（`#tokenSizeValue`）は
  JSから現在サイズ名に更新（`<kbd>` 混在ボタンと同じく textContent 直書きを避ける方針に沿う）。
- `aria-label` / `title` も現在値を含めて更新。

### 4. i18n（`i18n.js`、ja/en 両方）

`MESSAGES.ja` / `.en` に以下キーを追加（キー一致を保つ）。

- `toolbar.tokenSize`: ja「サイズ」/ en「Size」
- `toolbar.sizeSmall`: ja「小」/ en「S」
- `toolbar.sizeMedium`: ja「中」/ en「M」
- `toolbar.sizeLarge`: ja「大」/ en「L」
- `toolbar.tokenSizeLabel`: ja「表示サイズ：{size}」/ en「Size: {size}」（aria-label/title 用、`{size}` 補間）

### 5. 配線（`app.js`）

`applyOrientation()` に倣い `applyTokenScale()` を新設する。

```js
const TOKEN_SCALES = ["small", "medium", "large"];

function applyTokenScale() {
  const scale = state.ui.tokenScale;
  els.field.setAttribute("data-token-scale", scale);
  const sizeKey = { small: "toolbar.sizeSmall", medium: "toolbar.sizeMedium", large: "toolbar.sizeLarge" }[scale];
  const sizeText = t(sizeKey);
  els.tokenSizeValue.textContent = sizeText;                 // ボタン内の値表示を更新
  const label = t("toolbar.tokenSizeLabel", { size: sizeText });
  els.toggleTokenSizeBtn.setAttribute("aria-label", label);
  els.toggleTokenSizeBtn.title = label;
}
```

- `els` に `toggleTokenSizeBtn` / `tokenSizeValue` を追加。
- クリックで次段へ循環し、保存して反映:
  ```js
  els.toggleTokenSizeBtn.addEventListener("click", () => {
    const i = TOKEN_SCALES.indexOf(state.ui.tokenScale);
    state.ui.tokenScale = TOKEN_SCALES[(i + 1) % TOKEN_SCALES.length];
    saveState();
    applyTokenScale();
  });
  ```
- `init()` で `applyTokenScale()` を呼ぶ（`applyHeaderCollapsed()` / `applyPanelOpen()` と並び）。
- 言語切替時にラベル語（小/中/大・サイズ）を訳し直すため、`registerLocaleChange` のコールバック
  内で `applyTokenScale()` を呼ぶ（`renderAll()` 等と並べる）。

## なぜトークン移動・盤面フィットに影響しないか（根拠）

- トークン位置は割合（`x`/`y` %）で `left`/`top` に反映し、`transform: translate(-50%, -50%)` で
  中心合わせ。円のサイズが変わっても**中心座標は不変**なので、選手/ボールの配置はズレない。
- トークン・ボールは `.players-layer` / 盤面内の絶対配置で、`#field` 自体の寸法（幅/高さ）は
  変えない。よって `fitBoardSize()`（盤面の外形フィット）に影響せず、再計算も不要。

## 触らないもの（非退行）

- 既存の localStorage キー（`soccer-board-state-v1`）と保存構造は互換（`ui` にキー追加のみ。
  旧データは `tokenScale` 欠落 → `"medium"` にフォールバック）。
- フォーメーション反映／ペン・矢印描画／戦術ガイド（5レーン・ビエルサライン・3ゾーン）／退場／
  ヘッダー折りたたみ／サイドパネルのドロワー／キーボードショートカット／盤面フィット／
  ダブルタップ／縦表示・空白クリック解除 は不変。
- ゼロ依存・ビルド不要・相対パス参照を維持。i18n はキー一致（`assertLocaleParity`）を保つ。

## アクセシビリティ

- ボタンは `aria-label` / `title` に現在サイズを反映し、循環後も読み上げが正しく更新される。
- 言語切替でラベル（サイズ・小/中/大）が英日で切り替わる。
- 視覚のみに依存しない（ラベル文字で状態を提示）。

## 受け入れ基準

1. ツールバーの「サイズ：中」ボタンを押すごとに 中 → 大 → 小 → 中 … と循環し、選手の円・背番号・
   名前ラベル・方向マーカーとボールが 1.0 / 1.4 / 0.7 倍で一括変化する。
2. 「中」は事前対応後の現状と完全一致（円46px、背番号 約23px）。
3. 各サイズで背番号（1桁・2桁とも）が円内に収まり読める。大でも選手同士が過度に重ならない。
4. 選択中トークンのハイライト・回転ハンドル、ドラッグ移動、ダブルタップでパネル、が各サイズで
   従来どおり動く（中心座標がズレない）。
5. リロードで選択サイズが維持される。ボードリセット後も維持される。
6. 言語を EN/日本語に切り替えると、ボタンのラベル（サイズ / 小中大）が対応言語で表示される。
7. スマホ幅（≤680px）でも3段階が効き、基準（38px/22px）に倍率が乗る。
8. 既存機能（フォーメーション・描画・ガイド・退場・ヘッダー折りたたみ・ドロワー・ショートカット・
   盤面フィット・縦表示・空白クリック解除）が従来どおり動く。

## やらないこと（スコープ外）

- 選手とボールを別々にスケールする独立コントロール（今回は一括）。
- 3段階を超える無段階（スライダー）調整や任意倍率入力。
- サイズごとの名前ラベル `max-width` の再設計（現状維持）。
- キーボードショートカットの割り当て（今回はボタンのみ）。
