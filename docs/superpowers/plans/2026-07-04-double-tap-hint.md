# ダブルタップのヒント表示 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 盤面直下に常設の小さなヒント行を追加し、「選手をダブルタップで管理パネルが開く」という隠れたジェスチャの発見性を上げる。

**Architecture:** 素のHTML/CSS/JS。`index.html` にヒント要素を1つ追加、`i18n.js` に翻訳キー `hint.doubleTap` を ja/en 両方へ追加、`styles.css` に `.board-hint` を新規追加。JSロジックには一切触れない。

**Tech Stack:** Plain HTML / CSS / JavaScript（フレームワーク・バンドラ・依存なし）。i18n は自作辞書 + `data-i18n`。

## Global Constraints

- ゼロ依存・ビルド不要を維持（パッケージ/バンドラを増やさない）。
- 相対パス参照を維持（絶対パスのアセット参照を増やさない）。
- 表示文言は必ず翻訳キー経由（静的HTMLは `data-i18n="key"`）。
- 辞書 `MESSAGES.ja` / `.en` はキー一致を保つ（`assertLocaleParity` が警告）。文言追加は両言語へ。
- テストフレームワークは無し。確認はブラウザで手動（Playwright可）。
- 既存機能を壊さない: フォーメーション反映／ペン・矢印描画／戦術ガイド／退場／ヘッダー折りたたみ／ドロワー／キーボードショートカット／盤面フィット／ダブルタップ。

---

### Task 1: 盤面直下にダブルタップのヒントを追加

**Files:**
- Modify: `i18n.js`（`MESSAGES.ja` と `MESSAGES.en` にキー追加）
- Modify: `index.html`（`.board-area` 内、`.field-shell` の直後にヒント行を追加）
- Modify: `styles.css`（`.board-hint` ルールを新規追加）

**Interfaces:**
- Consumes: 既存の i18n 機構（`data-i18n="key"` を `renderAll()` が翻訳）、CSS変数 `--muted`（`:root` に定義済み `#69726d`）。
- Produces: 翻訳キー `hint.doubleTap`（ja/en）、CSSクラス `.board-hint`。

- [ ] **Step 1: i18n 辞書に `hint.doubleTap` を ja/en 両方追加**

`i18n.js` の `MESSAGES.ja` 側、`"panel.close": "管理パネルを閉じる",` の直後に追加:

```javascript
    "panel.close": "管理パネルを閉じる",
    "hint.doubleTap": "選手をダブルタップで管理パネル",
```

`i18n.js` の `MESSAGES.en` 側、`"panel.close": "Close panel",` の直後に追加:

```javascript
    "panel.close": "Close panel",
    "hint.doubleTap": "Double-tap a player to open the panel",
```

- [ ] **Step 2: `index.html` にヒント行を追加**

`.field-shell` の閉じ `</div>` と `.board-area` の閉じ `</section>` の間に `<p>` を挿入する。
対象箇所（現状）:

```html
            </div>
          </div>
        </section>

        <aside id="sidePanel" class="side-panel" aria-label="管理パネル" data-i18n="nav.panel" data-i18n-attr="aria-label">
```

これを次に置き換える:

```html
            </div>
          </div>
          <p class="board-hint" data-i18n="hint.doubleTap">選手をダブルタップで管理パネル</p>
        </section>

        <aside id="sidePanel" class="side-panel" aria-label="管理パネル" data-i18n="nav.panel" data-i18n-attr="aria-label">
```

- [ ] **Step 3: `styles.css` に `.board-hint` を追加**

盤面（`.board-area` / `.field-shell`）まわりのルール付近に、次を追加する:

```css
.board-hint {
  margin: 0.5rem 0 0;
  text-align: center;
  color: var(--muted);
  font-size: 0.78rem;
}
```

- [ ] **Step 4: ブラウザで表示を確認**

`node dev-server.js` を起動し `http://127.0.0.1:4173/` を開く（または `index.html` を直接開く）。
確認する:
- 盤面の直下に「選手をダブルタップで管理パネル」が薄いグレーの小さな文字で1行表示される。
- 言語切替（EN/JA トグル）で文言が `Double-tap a player to open the panel` ↔ `選手をダブルタップで管理パネル` に切り替わる。
- ブラウザのコンソールに `assertLocaleParity` の警告（キー不一致）が出ない。
- 選手トークンをダブルタップ/ダブルクリックすると従来どおり管理パネルが開く（挙動非退行）。

Playwright を使う場合:
- `browser_navigate` → `http://127.0.0.1:4173/`
- `browser_snapshot` でヒント行の存在を確認
- 言語トグルを `browser_click` → 再度 `browser_snapshot` で英語表記を確認
- `browser_console_messages` で警告が無いことを確認

- [ ] **Step 5: コミット**

```powershell
git add index.html styles.css i18n.js
git commit -m "盤面直下に「選手をダブルタップで管理パネル」ヒントを追加"
```

（PowerShell 5.1 では `&&` を使わず行を分ける。`main` への push は人が実行する。）

---

## Self-Review

**1. Spec coverage（スペック各項目の実装先）**
- 配置＝盤面直下 → Step 2。
- i18n（`hint.doubleTap` を ja/en 両方） → Step 1。
- CSS `.board-hint`（小さめ・ミュート色・中央寄せ・上余白） → Step 3。
- 非退行（JSロジック無変更／DOM1要素＋CSS1クラス＋i18nキー1つ） → 全Stepが HTML/CSS/i18n のみで JS 不変更。
- 受け入れ基準（表示／言語切替／parity警告なし／既存挙動） → Step 4。
- スコープ外（トースト状態管理・README記載・他操作説明） → 本計画に含めない。

**2. Placeholder scan:** TBD/TODO・曖昧指示なし。各Stepに実コードあり。

**3. Type consistency:** キー名は全Stepで `hint.doubleTap`、クラス名は `board-hint` で一貫。CSS変数 `--muted` は `:root` 定義済み。
