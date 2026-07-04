# Soccer Board OSS公開（英日UI + GitHub Pages）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** サッカー戦術ホワイトボードを英日UI対応にし、MITライセンス・SEO/OGP付きでGitHub Pagesに無料公開する。

**Architecture:** 既存のゼロ依存・ビルド不要・バニラJSの構成を維持する。新規 `i18n.js`（辞書 + `t()` + ロケール管理）を `app.js` の前に読み込み、静的テキストは `data-i18n` 属性で、動的テキストは `t()` 関数で差し替える。言語切替時は既存の `renderAll()` を再実行して動的パネルを再描画する。公開はGitHub Pages（静的配信・サブパス）で、専用サーバーは立てない。

**Tech Stack:** HTML5 / CSS / バニラJavaScript（モジュール・バンドラ・依存パッケージなし）、GitHub Pages。

## Global Constraints

- ランタイム依存パッケージ・ビルドツール・バンドラを追加しない。`index.html` を開くだけで動く性質を維持する。
- スクリプト読込順序は固定: `i18n.js` を `app.js` より前に `<script>` で読み込む（両者はクラシックスクリプトでグローバルスコープを共有）。
- ロケール保存キー: `soccer-board-locale-v1`（既存の `soccer-board-state-v1` と同じ命名規則）。
- 既定ロケール `ja` / サポート `["ja", "en"]` / フォールバック `ja`。
- `<title>` は英語固定（i18n切替の対象外）。
- リポジトリ名: `soccer-tactics-board`。ライセンス: MIT、年 `2026`。
- **確認が必要な外部パラメータ（Task 4以降で使用、実装開始時に確定させること）:**
  - `GITHUB_USERNAME` … GitHubのユーザー名。公開URL `SITE_URL = https://<GITHUB_USERNAME>.github.io/soccer-tactics-board/` を構成する。`og:url` / `og:image` / `sitemap.xml` / README のデモリンクにそのまま使う。
  - `COPYRIGHT_HOLDER` … MITライセンスの著作権者表記（既定案: `nakayama`）。
- 相対パス参照（`./styles.css` `./app.js` `./i18n.js`）のみを使う。Pages のサブパス配信でも動くよう、新たに絶対パスのアセット参照を増やさない（OGP等クローラ向けメタURLを除く）。

---

## File Structure

- **Create `i18n.js`** — i18n基盤。`MESSAGES`辞書（ja/en 全キー）、`t()`、`getLocale()`、`initLocale()`、`setLocale()`、`registerLocaleChange()`、`applyStaticTranslations()`、`assertLocaleParity()`。グローバル関数として公開。
- **Modify `index.html`** — `i18n.js` の読込追加、静的要素への `data-i18n` / `data-i18n-attr` 付与、言語切替ボタン追加、`<head>` にSEO/OGPメタタグ追加、`<title>` 英語固定化。
- **Modify `app.js`** — ハードコード日本語（約29箇所）を `t()` 経由に置換、`els.langToggleBtn` 追加、`init()` に `initLocale()` / `registerLocaleChange(renderAll)` / `applyStaticTranslations()` 追加、言語切替とラベル更新の配線。
- **Create `LICENSE`** — MIT。
- **Modify `README.md`** — 英日併記に全面改稿。
- **Create `.gitignore`** — `node_modules/` / OS生成物。
- **Create `robots.txt`** — 全許可 + Sitemap行。
- **Create `sitemap.xml`** — トップURL1件。
- **Create `assets/screenshot.png`** — READMEトップ用スクリーンショット（OGP画像も兼ねられる）。

---

## Task 1: i18n基盤モジュール（i18n.js）

**Files:**
- Create: `i18n.js`
- Modify: `index.html`（`<script src="./i18n.js">` を `app.js` の前に追加。この段階では画面は変わらない）
- Test: なし（テストフレームワーク未導入。ブラウザのコンソールで検証）

**Interfaces:**
- Consumes: なし
- Produces（後続タスクが依存するグローバル関数）:
  - `t(key: string, vars?: object): string`
  - `getLocale(): "ja" | "en"`
  - `initLocale(): void`（保存ロケールを読み `currentLocale` と `document.documentElement.lang` を設定）
  - `setLocale(locale: "ja" | "en"): void`（保存・lang更新・`applyStaticTranslations()`・登録コールバック実行）
  - `registerLocaleChange(handler: () => void): void`
  - `applyStaticTranslations(root?: ParentNode): void`（`[data-i18n]` を走査し `textContent` か `data-i18n-attr` の属性を差し替え）

- [ ] **Step 1: `i18n.js` を作成（辞書と全API）**

```js
// i18n.js — ゼロ依存の軽量i18n。app.js より前に読み込むこと。
const LOCALE_STORAGE_KEY = "soccer-board-locale-v1";
const DEFAULT_LOCALE = "ja";
const SUPPORTED_LOCALES = ["ja", "en"];

const MESSAGES = {
  ja: {
    // --- 静的（index.html） ---
    "brand.tagline": "チーム戦術ホワイトボード",
    "toolbar.formationLabel": "配置",
    "toolbar.apply": "反映",
    "toolbar.lanes": "5レーン",
    "toolbar.bielsa": "ビエルサライン",
    "toolbar.thirds": "3ゾーン",
    "toolbar.reset": "ボードリセット",
    "score.home": "味方",
    "score.away": "相手",
    "draw.move": "移動",
    "draw.pen": "ペン",
    "draw.arrow": "矢印",
    "draw.colorYellow": "黄",
    "draw.colorRed": "赤",
    "draw.colorBlue": "青",
    "draw.colorWhite": "白",
    "draw.undo": "1つ戻す",
    "draw.clear": "全消去",
    "panel.selectedTitle": "選択中",
    "panel.clearSelection": "解除",
    "panel.subTitle": "交代",
    "panel.homeRosterTitle": "味方登録",
    "panel.sortByNumber": "番号順",
    "form.numberPlaceholder": "No.",
    "form.namePlaceholder": "名前",
    "form.add": "追加",
    "panel.resetHome": "味方登録を初期化",
    "panel.opponentTitle": "相手登録",
    "panel.resetOpponents": "リセット",
    "panel.notesTitle": "メモ",
    "notes.placeholder": "今日の狙い、交代案、セットプレーなど",
    // --- 動的ラベル（app.js が textContent を設定） ---
    "toolbar.orientationToVertical": "縦表示",
    "toolbar.orientationToHorizontal": "横表示",
    // --- 動的（app.js） ---
    "confirm.resetHome": "味方の登録と配置を初期状態に戻しますか？",
    "confirm.clearDrawings": "描いた線をすべて消しますか？",
    "confirm.deletePlayer": "{label}を削除しますか？",
    "team.home": "味方",
    "team.away": "相手",
    "token.ball": "ボール",
    "panel.noSelection": "選択なし",
    "status.onPitch": "ピッチ",
    "status.bench": "控え",
    "label.number": "背番号",
    "label.name": "名前",
    "sub.selectHome": "味方選手を選択",
    "sub.noBench": "控えなし",
    "sub.noField": "ピッチの選手なし",
    "action.sub": "交代",
    "roster.onFieldGroup": "ピッチ {count}",
    "roster.benchGroup": "控え {count}",
    "roster.none": "該当なし",
    "action.select": "選択",
    "action.delete": "削除",
    "player.noName": "名前未登録",
    "aria.opponentNumber": "相手 背番号",
    "aria.opponentName": "相手 名前",
  },
  en: {
    "brand.tagline": "Team tactics whiteboard",
    "toolbar.formationLabel": "Formation",
    "toolbar.apply": "Apply",
    "toolbar.lanes": "5 lanes",
    "toolbar.bielsa": "Bielsa line",
    "toolbar.thirds": "Thirds",
    "toolbar.reset": "Reset board",
    "score.home": "Home",
    "score.away": "Away",
    "draw.move": "Move",
    "draw.pen": "Pen",
    "draw.arrow": "Arrow",
    "draw.colorYellow": "Yellow",
    "draw.colorRed": "Red",
    "draw.colorBlue": "Blue",
    "draw.colorWhite": "White",
    "draw.undo": "Undo",
    "draw.clear": "Clear all",
    "panel.selectedTitle": "Selected",
    "panel.clearSelection": "Clear",
    "panel.subTitle": "Substitution",
    "panel.homeRosterTitle": "Home roster",
    "panel.sortByNumber": "By number",
    "form.numberPlaceholder": "No.",
    "form.namePlaceholder": "Name",
    "form.add": "Add",
    "panel.resetHome": "Reset home roster",
    "panel.opponentTitle": "Opponent roster",
    "panel.resetOpponents": "Reset",
    "panel.notesTitle": "Notes",
    "notes.placeholder": "Game plan, subs, set pieces…",
    "toolbar.orientationToVertical": "Vertical",
    "toolbar.orientationToHorizontal": "Horizontal",
    "confirm.resetHome": "Reset the home roster and positions to defaults?",
    "confirm.clearDrawings": "Erase all drawings?",
    "confirm.deletePlayer": "Delete {label}?",
    "team.home": "Home",
    "team.away": "Away",
    "token.ball": "Ball",
    "panel.noSelection": "No selection",
    "status.onPitch": "On pitch",
    "status.bench": "Bench",
    "label.number": "Number",
    "label.name": "Name",
    "sub.selectHome": "Select a home player",
    "sub.noBench": "No bench players",
    "sub.noField": "No players on pitch",
    "action.sub": "Sub",
    "roster.onFieldGroup": "On pitch {count}",
    "roster.benchGroup": "Bench {count}",
    "roster.none": "None",
    "action.select": "Select",
    "action.delete": "Delete",
    "player.noName": "Unnamed",
    "aria.opponentNumber": "Opponent number",
    "aria.opponentName": "Opponent name",
  },
};

let currentLocale = DEFAULT_LOCALE;
let localeChangeHandler = null;

function t(key, vars) {
  const table = MESSAGES[currentLocale] || MESSAGES[DEFAULT_LOCALE];
  let text = table[key];
  if (text === undefined) {
    text = MESSAGES[DEFAULT_LOCALE][key];
    if (text === undefined) {
      console.warn(`[i18n] missing key: ${key}`);
      return key;
    }
  }
  if (vars) {
    for (const name of Object.keys(vars)) {
      text = text.split(`{${name}}`).join(String(vars[name]));
    }
  }
  return text;
}

function getLocale() {
  return currentLocale;
}

function initLocale() {
  let saved = null;
  try {
    saved = window.localStorage.getItem(LOCALE_STORAGE_KEY);
  } catch {
    saved = null;
  }
  currentLocale = SUPPORTED_LOCALES.includes(saved) ? saved : DEFAULT_LOCALE;
  document.documentElement.lang = currentLocale;
}

function setLocale(locale) {
  if (!SUPPORTED_LOCALES.includes(locale)) return;
  currentLocale = locale;
  try {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    // ロケール保存に失敗してもアプリは動く
  }
  document.documentElement.lang = locale;
  applyStaticTranslations();
  if (localeChangeHandler) localeChangeHandler();
}

function registerLocaleChange(handler) {
  localeChangeHandler = handler;
}

function applyStaticTranslations(root = document) {
  root.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.getAttribute("data-i18n");
    const attr = el.getAttribute("data-i18n-attr");
    const value = t(key);
    if (attr) {
      el.setAttribute(attr, value);
    } else {
      el.textContent = value;
    }
  });
}

function assertLocaleParity() {
  const missingInEn = Object.keys(MESSAGES.ja).filter((k) => !(k in MESSAGES.en));
  const missingInJa = Object.keys(MESSAGES.en).filter((k) => !(k in MESSAGES.ja));
  if (missingInEn.length || missingInJa.length) {
    console.warn("[i18n] key parity mismatch", { missingInEn, missingInJa });
  }
}

assertLocaleParity();
```

- [ ] **Step 2: `index.html` に `i18n.js` を追加**

`index.html` の末尾、`<script src="./app.js"></script>` の直前に1行追加する:

```html
    <script src="./i18n.js"></script>
    <script src="./app.js"></script>
```

- [ ] **Step 3: ローカルサーバーで開いて検証**

Run: `node dev-server.js`（別ターミナルで起動したまま）→ ブラウザで `http://127.0.0.1:4173/` を開き、DevToolsのConsoleで以下を実行:

```js
assertLocaleParity();            // 何も警告が出なければ ja/en のキーは一致
t("toolbar.apply");              // → "反映"
setLocale("en"); t("toolbar.apply"); // → "Apply"
t("roster.onFieldGroup", { count: 3 }); // → "On pitch 3"
t("no.such.key");                // → 警告ログ + "no.such.key" を返す
setLocale("ja");                 // 戻す
```

Expected: パリティ警告なし・上記の戻り値が一致・存在しないキーはフォールバック警告。画面表示はまだ日本語のまま（配線は次タスク）。

- [ ] **Step 4: コミット**

```bash
git add i18n.js index.html
git commit -m "i18n基盤モジュール(i18n.js)を追加"
```

---

## Task 2: 静的UIの翻訳配線 + 言語切替ボタン

**Files:**
- Modify: `index.html`（`data-i18n` 属性付与、言語切替ボタン追加）
- Modify: `app.js`（`els.langToggleBtn` 追加、`init()` 配線、切替クリック、ラベル更新）

**Interfaces:**
- Consumes: Task 1 の `t()` / `initLocale()` / `setLocale()` / `getLocale()` / `registerLocaleChange()` / `applyStaticTranslations()`
- Produces: `els.langToggleBtn`（`#langToggleBtn`）、`renderAll()` 内で更新される言語切替ボタンのラベル

- [ ] **Step 1: `index.html` の静的テキストに `data-i18n` を付与**

対象箇所を以下のように変更する（属性のみ追加。テキストは初期表示用に残す）。

ブランドのタグライン:
```html
            <p data-i18n="brand.tagline">チーム戦術ホワイトボード</p>
```

ツールバー（`配置`ラベル・反映・各ガイド・リセット。**縦表示ボタンには付けない**＝ラベルは動的更新のためTask 3で扱う）:
```html
          <label class="select-control">
            <span data-i18n="toolbar.formationLabel">配置</span>
            <select id="formationSelect">
```
```html
          <button id="applyFormationBtn" class="secondary-button" type="button" data-i18n="toolbar.apply">反映</button>
          <button id="toggleOrientationBtn" class="secondary-button" type="button" aria-pressed="false">縦表示</button>
          <button id="langToggleBtn" class="secondary-button" type="button">EN</button>
          <button id="toggleLanesBtn" class="secondary-button" type="button" aria-pressed="false" data-i18n="toolbar.lanes">5レーン</button>
          <button id="toggleBielsaBtn" class="secondary-button" type="button" aria-pressed="false" data-i18n="toolbar.bielsa">ビエルサライン</button>
          <button id="toggleThirdsBtn" class="secondary-button" type="button" aria-pressed="false" data-i18n="toolbar.thirds">3ゾーン</button>
          <button id="resetBoardBtn" class="primary-button" type="button" data-i18n="toolbar.reset">ボードリセット</button>
```

スコア表示:
```html
            <div>
              <span class="team-dot home-dot"></span>
              <span data-i18n="score.home">味方</span> <strong id="homeFieldCount">0</strong>
            </div>
            <div>
              <span class="team-dot away-dot"></span>
              <span data-i18n="score.away">相手</span> <strong id="awayFieldCount">0</strong>
            </div>
```

描画ツール（モード・色aria-label・戻す/消去）:
```html
              <button id="toolMoveBtn" class="tool-button" type="button" aria-pressed="true" data-i18n="draw.move">移動</button>
              <button id="toolPenBtn" class="tool-button" type="button" aria-pressed="false" data-i18n="draw.pen">ペン</button>
              <button id="toolArrowBtn" class="tool-button" type="button" aria-pressed="false" data-i18n="draw.arrow">矢印</button>
```
```html
              <button class="color-swatch yellow" type="button" data-color="yellow" data-i18n="draw.colorYellow" data-i18n-attr="aria-label" aria-label="黄" aria-pressed="true"></button>
              <button class="color-swatch red" type="button" data-color="red" data-i18n="draw.colorRed" data-i18n-attr="aria-label" aria-label="赤" aria-pressed="false"></button>
              <button class="color-swatch blue" type="button" data-color="blue" data-i18n="draw.colorBlue" data-i18n-attr="aria-label" aria-label="青" aria-pressed="false"></button>
              <button class="color-swatch white" type="button" data-color="white" data-i18n="draw.colorWhite" data-i18n-attr="aria-label" aria-label="白" aria-pressed="false"></button>
```
```html
              <button id="undoDrawBtn" class="tool-button" type="button" data-i18n="draw.undo">1つ戻す</button>
              <button id="clearDrawBtn" class="tool-button" type="button" data-i18n="draw.clear">全消去</button>
```

サイドパネル各見出し・ボタン・プレースホルダ:
```html
              <h2 data-i18n="panel.selectedTitle">選択中</h2>
              <button id="clearSelectionBtn" class="text-button" type="button" data-i18n="panel.clearSelection">解除</button>
```
```html
              <h2 data-i18n="panel.subTitle">交代</h2>
```
```html
              <h2 data-i18n="panel.homeRosterTitle">味方登録</h2>
              <button id="sortRosterBtn" class="text-button" type="button" data-i18n="panel.sortByNumber">番号順</button>
```
```html
              <input id="newNumberInput" type="text" inputmode="numeric" autocomplete="off" data-i18n="form.numberPlaceholder" data-i18n-attr="placeholder" placeholder="No." maxlength="3" />
              <input id="newNameInput" type="text" autocomplete="off" data-i18n="form.namePlaceholder" data-i18n-attr="placeholder" placeholder="名前" maxlength="16" />
              <button class="secondary-button" type="submit" data-i18n="form.add">追加</button>
```
```html
            <button id="resetHomeBtn" class="danger-button" type="button" data-i18n="panel.resetHome">味方登録を初期化</button>
```
```html
              <h2 data-i18n="panel.opponentTitle">相手登録</h2>
              <button id="resetOpponentsBtn" class="text-button" type="button" data-i18n="panel.resetOpponents">リセット</button>
```
```html
              <h2 data-i18n="panel.notesTitle">メモ</h2>
```
```html
            <textarea id="boardNotes" rows="5" maxlength="400" data-i18n="notes.placeholder" data-i18n-attr="placeholder" placeholder="今日の狙い、交代案、セットプレーなど"></textarea>
```

- [ ] **Step 2: `app.js` の `els` に言語切替ボタンを追加**

`app.js` の `els` 定義（`resetBoardBtn` の近く、`C:\Users\nakayama\project\soccer\app.js:92` 付近）に追加:

```js
  resetBoardBtn: document.querySelector("#resetBoardBtn"),
  langToggleBtn: document.querySelector("#langToggleBtn"),
```

- [ ] **Step 3: `init()` にロケール初期化と再描画配線を追加**

`app.js:142` の `init()` を次のように変更:

```js
function init() {
  loadState();
  initLocale();
  bindEvents();
  registerLocaleChange(renderAll);
  applyStaticTranslations();
  renderAll();
}
```

- [ ] **Step 4: 言語切替ボタンのクリックを配線**

`bindEvents()` 内（`app.js:171` の `resetBoardBtn` 配線の近く）に追加:

```js
  els.langToggleBtn.addEventListener("click", () => {
    setLocale(getLocale() === "ja" ? "en" : "ja");
  });
```

- [ ] **Step 5: 言語切替ボタンのラベルを `renderAll()` で更新**

`app.js:513` の `renderAll()` の先頭付近（`applyOrientation();` の後）に追加:

```js
  els.langToggleBtn.textContent = getLocale() === "ja" ? "EN" : "日本語";
```

- [ ] **Step 6: ブラウザで検証**

Run: `node dev-server.js` → `http://127.0.0.1:4173/`

確認:
- 初期表示は日本語。ツールバーの「EN」ボタンを押すと、タグライン・配置/反映・5レーン/ビエルサライン/3ゾーン・ボードリセット・スコアの味方/相手・描画ツール・サイドパネル各見出し/ボタン/プレースホルダが英語に切り替わる。
- ボタン表記が「日本語」に変わる。もう一度押すと日本語に戻る。
- リロードすると最後に選んだ言語で表示される（`<html lang>` も一致）。
- 縦表示ボタンと動的パネル（選択中/交代/ロスター）はまだ日本語のまま（Task 3で対応）。

- [ ] **Step 7: コミット**

```bash
git add index.html app.js
git commit -m "静的UIの英日切替と言語切替ボタンを追加"
```

---

## Task 3: 動的テキストの翻訳（app.js）

**Files:**
- Modify: `app.js`（ハードコード日本語を `t()` 経由へ置換）

**Interfaces:**
- Consumes: Task 1 の `t()`、Task 2 で配線済みの `renderAll()` 再実行フロー
- Produces: なし（既存の描画関数の文言が `t()` 化される）

各置換は「現在こう書かれている → こう変える」形式。`app.js` 内の対応行を検索して置換すること。

- [ ] **Step 1: confirmダイアログ3件を置換**

```js
// resetHomeBtn（現 app.js:184）
const ok = window.confirm(t("confirm.resetHome"));
```
```js
// clearDrawBtn（現 app.js:239）
const ok = window.confirm(t("confirm.clearDrawings"));
```
```js
// 選手削除（現 app.js:1201）
const ok = window.confirm(t("confirm.deletePlayer", { label }));
```

- [ ] **Step 2: 縦横表示ボタンのラベルを置換**

現 `app.js:475`:
```js
  els.toggleOrientationBtn.textContent = vertical
    ? t("toolbar.orientationToHorizontal")
    : t("toolbar.orientationToVertical");
```
（`vertical` が真＝現在縦なので「横表示」ラベル、の既存論理を維持）

- [ ] **Step 3: トークンの aria-label を置換**

現 `app.js:664`（味方/相手 + 背番号）:
```js
  token.setAttribute(
    "aria-label",
    `${team === "home" ? t("team.home") : t("team.away")} ${displayNumber(player)}`
  );
```
現 `app.js:699`（ボール）:
```js
  token.setAttribute("aria-label", t("token.ball"));
```

- [ ] **Step 4: 選択パネルの文言を置換**

現 `app.js:923`〜:
```js
    els.selectionPanel.appendChild(emptyState(t("panel.noSelection")));
```
チーム表示（現 `app.js:934`）:
```js
  pill.textContent = selected.team === "home" ? t("team.home") : t("team.away");
```
状態表示（現 `app.js:937`）:
```js
  const statusText =
    selected.team === "home"
      ? selected.player.onField
        ? t("status.onPitch")
        : t("status.bench")
      : t("status.onPitch");
```
（既存の三項の分岐構造に合わせ、各リテラルを `t()` に置換する）
ラベル（現 `app.js:944` / `app.js:953`）:
```js
  numberLabel.textContent = t("label.number");
```
```js
  nameLabel.textContent = t("label.name");
```

- [ ] **Step 5: 交代パネルの文言を置換**

現 `app.js:993` / `1000` / `1011`:
```js
    els.substitutionPanel.appendChild(emptyState(t("sub.selectHome")));
```
```js
      els.substitutionPanel.appendChild(emptyState(t("sub.noBench")));
```
```js
      els.substitutionPanel.appendChild(emptyState(t("sub.noField")));
```
交代ボタンラベル（現 `app.js:1028` 付近、`label: "交代"`）:
```js
          label: t("action.sub"),
```

- [ ] **Step 6: ロスターのグループ見出しとアクションを置換**

現 `app.js:1042` / `1043`（カウント付き）:
```js
  els.homeRoster.appendChild(
    createRosterGroup(t("roster.onFieldGroup", { count: fieldPlayers.length }), fieldPlayers)
  );
  els.homeRoster.appendChild(
    createRosterGroup(t("roster.benchGroup", { count: benchPlayers.length }), benchPlayers)
  );
```
該当なし（現 `app.js:1056`）:
```js
    group.appendChild(emptyState(t("roster.none")));
```
アクションラベル（現 `app.js:1063` / `1072` / `1080` / `1088` の `label: "選択" / "交代" / "交代" / "削除"`）:
```js
        label: t("action.select"),
```
```js
        label: t("action.sub"),
```
```js
        label: t("action.delete"),
```
（`app.js:1072` と `app.js:1080` はいずれも「交代」→ `t("action.sub")`。文脈の該当行それぞれを置換する）

- [ ] **Step 7: ロスターカードの氏名/相手表示を置換**

現 `app.js:1162`（名前未登録／相手）:
```js
  primary.textContent =
    team === "home" ? player.name || t("player.noName") : t("team.away");
```
状態（現 `app.js:1164`）:
```js
  secondary.textContent = player.onField ? t("status.onPitch") : t("status.bench");
```

- [ ] **Step 8: 相手入力欄の aria-label を置換**

現 `app.js:1120` / `1136`:
```js
    numberInput.setAttribute("aria-label", t("aria.opponentNumber"));
```
```js
    nameInput.setAttribute("aria-label", t("aria.opponentName"));
```
相手 名前 の placeholder（現 `app.js:1135`）:
```js
    nameInput.placeholder = t("form.namePlaceholder");
```

- [ ] **Step 9: 残存日本語の全走査**

`app.js` 内に翻訳対象の日本語リテラルが残っていないか検索する（コメントは除外してよい）。見つかった表示用文字列は対応キーを `i18n.js` に追加して `t()` 化する。

Run（Grep/検索ツールで）: `app.js` を対象に正規表現 `[ぁ-んァ-ン一-龯]` で検索。ヒットがコメント（`//` 行）のみであることを確認。

- [ ] **Step 10: ブラウザで検証**

Run: `node dev-server.js` → `http://127.0.0.1:4173/`

確認:
- 「EN」に切替後、選手を選択→選択中パネル（背番号/名前/ピッチ・控え/チーム名）が英語。
- 交代パネル（味方選手を選択/控えなし/ピッチの選手なし/Subボタン）が英語。
- 味方ロスターのグループ見出し「On pitch N / Bench N」、選手カードの Select/Sub/Delete、未登録名 "Unnamed"、相手カードが英語。
- 各種 confirm（味方初期化/線の全消去/選手削除）が英語で出る。
- トークンの aria-label（DevToolsで確認）が "Home 10" / "Ball" 等になる。
- Consoleで `assertLocaleParity()` を実行し警告なし。
- 日本語に戻すと全て日本語表示に戻る。

- [ ] **Step 11: コミット**

```bash
git add app.js i18n.js
git commit -m "動的テキストを英日切替に対応"
```

---

## Task 4: 検索・SNS共有メタ（SEO/OGP）+ robots.txt + sitemap.xml

**Files:**
- Modify: `index.html`（`<head>` にメタタグ、`<title>` 英語固定）
- Create: `robots.txt`
- Create: `sitemap.xml`

**注意:** `SITE_URL`（= `https://<GITHUB_USERNAME>.github.io/soccer-tactics-board/`）と `og:image` の絶対URLはこの時点で確定していれば埋める。未確定なら Task 6 で確定URLに置換する（本タスクでは `SITE_URL` を仮に上記形式で記述し、Task 6 のStepで実URLへ差し替える）。

- [ ] **Step 1: `<head>` に `<title>` とメタタグを追加**

`index.html` の `<head>` 内、`<title>` を英語固定に変更し、その下にメタタグを追加:

```html
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Soccer Tactics Board — free browser whiteboard</title>
    <meta name="description" content="Free, install-free soccer/football tactics whiteboard. Drag players, draw arrows, switch formations and tactical guides, right in your browser." />

    <!-- Open Graph -->
    <meta property="og:type" content="website" />
    <meta property="og:title" content="Soccer Tactics Board" />
    <meta property="og:description" content="Free, install-free soccer/football tactics whiteboard — runs entirely in your browser." />
    <meta property="og:url" content="https://GITHUB_USERNAME.github.io/soccer-tactics-board/" />
    <meta property="og:image" content="https://GITHUB_USERNAME.github.io/soccer-tactics-board/assets/screenshot.png" />

    <!-- Twitter Card -->
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="Soccer Tactics Board" />
    <meta name="twitter:description" content="Free, install-free soccer/football tactics whiteboard — runs entirely in your browser." />
    <meta name="twitter:image" content="https://GITHUB_USERNAME.github.io/soccer-tactics-board/assets/screenshot.png" />

    <link rel="stylesheet" href="./styles.css" />
```

（`GITHUB_USERNAME` は実装開始時に確定した値へ置換。未確定なら文字列 `GITHUB_USERNAME` のまま残し Task 6 で一括置換する。）

- [ ] **Step 2: `robots.txt` を作成**

Create `robots.txt`:
```
User-agent: *
Allow: /

Sitemap: https://GITHUB_USERNAME.github.io/soccer-tactics-board/sitemap.xml
```

- [ ] **Step 3: `sitemap.xml` を作成**

Create `sitemap.xml`:
```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://GITHUB_USERNAME.github.io/soccer-tactics-board/</loc>
  </url>
</urlset>
```

- [ ] **Step 4: ローカルで表示・取得を検証**

Run: `node dev-server.js` → 以下を確認:
- `http://127.0.0.1:4173/` を開き、DevToolsの Elements で `<head>` に title/description/og:*/twitter:* が入っている。ブラウザのタブ名が "Soccer Tactics Board — free browser whiteboard"。
- `http://127.0.0.1:4173/robots.txt` が200で内容を返す。
- `http://127.0.0.1:4173/sitemap.xml` が200でXMLを返す。
- 言語を切り替えても `<title>` は英語のまま。

- [ ] **Step 5: コミット**

```bash
git add index.html robots.txt sitemap.xml
git commit -m "SEO/OGPメタタグとrobots.txt・sitemap.xmlを追加"
```

---

## Task 5: OSS衛生ファイル（LICENSE / .gitignore / README英日 / スクリーンショット）

**Files:**
- Create: `LICENSE`
- Create: `.gitignore`
- Modify: `README.md`
- Create: `assets/screenshot.png`

- [ ] **Step 1: `LICENSE`（MIT）を作成**

Create `LICENSE`（`COPYRIGHT_HOLDER` は確定値へ置換。既定案 `nakayama`）:
```
MIT License

Copyright (c) 2026 COPYRIGHT_HOLDER

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

- [ ] **Step 2: `.gitignore` を作成**

Create `.gitignore`:
```
node_modules/
.DS_Store
Thumbs.db
*.log
```

- [ ] **Step 3: スクリーンショットを取得**

Run: `node dev-server.js` → ブラウザ自動化（Playwright MCP または Chrome MCP）で `http://127.0.0.1:4173/` を開き、選手を数体配置・矢印を1本描いた見栄えの良い状態でウィンドウ全体をキャプチャし、`assets/screenshot.png` として保存する（横長 1200×630 付近が望ましい。OGP画像も兼ねる）。

Expected: `assets/screenshot.png` が生成され、フィールドと選手・UIが写っている。

- [ ] **Step 4: `README.md` を英日併記に改稿**

Overwrite `README.md`（`GITHUB_USERNAME` は確定値へ置換。未確定なら Task 6 で置換）:
```markdown
# Soccer Tactics Board

A free, install-free soccer / football tactics whiteboard that runs entirely in your browser. No sign-up, no build step, no dependencies.

**▶ Live demo: https://GITHUB_USERNAME.github.io/soccer-tactics-board/**

![Screenshot](assets/screenshot.png)

## Features

- Drag home / opponent players around the pitch
- Manage the home roster: numbers, names, add players, bench & substitutions
- Apply formations: 4-4-2, 4-3-3, 4-2-3-1, 3-5-2
- Draw with pen & arrows in multiple colors; undo / clear
- Tactical guides: 5 lanes, Bielsa line, thirds (defensive / middle / attacking)
- Vertical / horizontal board orientation
- Board notes
- **English / Japanese UI toggle**
- Everything is saved locally in your browser (localStorage)

## Usage

Just open the live demo above — nothing to install.

To run it locally, either open `index.html` directly, or serve it:

```bash
node dev-server.js
# then open http://127.0.0.1:4173/
```

## Tech

Plain HTML, CSS and vanilla JavaScript. No framework, no bundler, no dependencies.

## License

MIT — see [LICENSE](LICENSE).

---

# サッカー戦術ボード

ブラウザだけで動く、無料の戦術ホワイトボードです。登録・ビルド・依存パッケージ不要。

**▶ デモ: https://GITHUB_USERNAME.github.io/soccer-tactics-board/**

## できること

- 味方・相手選手をピッチ上でドラッグ移動
- 味方ロスター管理：背番号・名前・選手追加・控え・交代
- フォーメーション反映：4-4-2 / 4-3-3 / 4-2-3-1 / 3-5-2
- ペン・矢印での描画（複数色）、1つ戻す／全消去
- 戦術ガイド：5レーン・ビエルサライン・3ゾーン（守備／中盤／攻撃）
- 縦／横のボード表示切替
- メモ
- **英語／日本語のUI切替**
- 内容はブラウザのローカル保存（localStorage）に保存

## 使い方

上のデモURLを開くだけ。インストール不要です。

ローカルで動かす場合は `index.html` を直接開くか、サーバーで配信します:

```bash
node dev-server.js
# その後 http://127.0.0.1:4173/ を開く
```

## ライセンス

MIT（[LICENSE](LICENSE) を参照）。
```

- [ ] **Step 5: コミット**

```bash
git add LICENSE .gitignore README.md assets/screenshot.png
git commit -m "MITライセンス・.gitignore・英日READMEとスクリーンショットを追加"
```

---

## Task 6: GitHub公開 + Pages有効化 + URL確定

**Files:**
- Modify: `index.html` / `robots.txt` / `sitemap.xml` / `README.md`（`GITHUB_USERNAME` を実URLへ一括置換）

**前提:** GitHubアカウントと `GITHUB_USERNAME` が確定していること。`gh` CLI が使えるなら補助可能。

- [ ] **Step 1: `GITHUB_USERNAME` を実URLへ一括置換**

`index.html`・`robots.txt`・`sitemap.xml`・`README.md` 内の文字列 `GITHUB_USERNAME` を、確定したユーザー名に全置換する。`LICENSE` の `COPYRIGHT_HOLDER` も確定値へ。

Run（検索ツールで）: リポジトリ全体を `GITHUB_USERNAME` と `COPYRIGHT_HOLDER` で検索し、残っていないことを確認。

- [ ] **Step 2: コミット**

```bash
git add -A
git commit -m "公開URL・著作権者を確定値に差し替え"
```

- [ ] **Step 3: GitHubリポジトリ作成とpush**

`gh` CLI がある場合:
```bash
gh repo create soccer-tactics-board --public --source . --remote origin --push
```
（`gh` が無い場合は、GitHub上で `soccer-tactics-board` を作成し、`git remote add origin <URL>` → `git push -u origin <branch>` を本人が実施。公開ブランチは `main` を推奨。必要なら `git branch -M main` で改名して push。）

- [ ] **Step 4: GitHub Pages を有効化**

GitHubのリポジトリ Settings → Pages → Source = 「Deploy from a branch」、Branch = 公開ブランチ（例 `main`）/ フォルダ = `/ (root)` を選択して保存。数分後に `SITE_URL` が発行される。

- [ ] **Step 5: 公開URLで動作検証**

`SITE_URL`（`https://<GITHUB_USERNAME>.github.io/soccer-tactics-board/`）をブラウザで開き:
- スタイル・スクリプトが読み込まれ、アプリが動作する（サブパスでも相対パス参照が解決している）。
- 言語切替が動く。
- `SITE_URL` + `robots.txt` / `sitemap.xml` が200で取得できる。
- OGP検証: X Card Validator や Facebook Sharing Debugger に `SITE_URL` を入力、または Discord/Slack にURLを貼り、画像・タイトル・説明が展開されることを確認。

---

## Task 7（任意）: デモGIF・Topics・About・宣伝

**Files:**
- （任意）Modify: `README.md`（GIFに差し替え）、`assets/demo.gif`

- [ ] **Step 1: 操作GIFを作成（任意）**

ブラウザ自動化の録画（Chrome MCP の `gif_creator` 等）で、選手配置→矢印描画→ガイド表示→言語切替の一連を録画し `assets/demo.gif` として保存。READMEトップのスクリーンショットをGIFに差し替え、コミット・push。

- [ ] **Step 2: Topics と About を設定**

GitHubリポジトリのトップで About（歯車）を開き、Description に英語一行説明、Website に `SITE_URL` を設定。Topics に `soccer` `football` `tactics` `whiteboard` `coaching` `vanilla-js` `no-build` を追加。

- [ ] **Step 3（任意）: コミュニティ投稿**

Reddit（r/bootroom, r/coaching）、X、国内のサッカー指導者コミュニティ等に「無料・登録不要・ブラウザで動く戦術ボード」として `SITE_URL` を共有。必要なら awesome-selfhosted 等へのPRも検討。

---

## Self-Review

**Spec coverage:**
- i18n（A案・辞書・data-i18n・切替・永続化・拡張性・フォールバック・動的再描画）→ Task 1〜3 ✓
- OSS衛生ファイル（LICENSE/README英日/.gitignore/スクショ）→ Task 5 ✓
- 検索・SNS共有メタ（メタタグ/OGP/robots/sitemap）→ Task 4 ✓
- ホスティング（GitHub + Pages・サブパス・dev-server残置）→ Task 6 ✓
- 認知プレイブック（GIF/Topics/About/投稿）→ Task 7 ✓
- テスト方針（手動ブラウザ確認 + キーパリティ）→ 各Taskの検証Step ✓

**Placeholder scan:** `GITHUB_USERNAME` / `COPYRIGHT_HOLDER` は「実装開始時に確定させる外部パラメータ」としてGlobal Constraintsに明記し、Task 6 Step 1で残存ゼロを検証する運用。曖昧なTODOは無し。

**Type consistency:** `t()` / `getLocale()` / `setLocale()` / `initLocale()` / `registerLocaleChange()` / `applyStaticTranslations()` / `assertLocaleParity()` の名称は Task 1 定義と Task 2/3 使用で一致。ストレージキー `soccer-board-locale-v1`、要素ID `#langToggleBtn` / `els.langToggleBtn` も一貫。
