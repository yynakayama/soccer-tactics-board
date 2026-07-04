# 空白クリックで選手選択を解除 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 移動モード中にピッチ（`#field`）内の空白をクリック/タップしたら、既存の `clearSelection()` を呼んで選手の選択を解除する。

**Architecture:** `app.js` に空白クリック用のハンドラ関数を1つ追加し、`#field` に `click` リスナーを1つ登録する。ガード3条件（移動モード・選択あり・クリック先がトークン/ボールでない）を満たすときだけ既存の `clearSelection()` を再利用する。HTML/CSS/i18n の変更なし。

**Tech Stack:** 素のHTML/CSS/JavaScript（フレームワーク・バンドラ・依存パッケージなし・ビルド不要）。テストフレームワークは無いため、検証は `node dev-server.js` → ブラウザで手動（Playwright可）。

## Global Constraints

- ゼロ依存・ビルド不要・相対パス参照を維持（パッケージ/バンドラを増やさない）。
- 表示文言の追加・変更はしない（今回はi18n辞書・`data-i18n`・`t()` に触れない）。
- 既存機能を壊さない: フォーメーション反映／ペン・矢印描画／戦術ガイド／退場／ヘッダー折りたたみ／ドロワー／キーボードショートカット／盤面フィット／ダブルタップ。
- 既存の解除手段（Escキー `handleShortcut`、`#clearSelectionBtn`）の挙動は変えない。空白クリックはこれらと同じ `clearSelection()` を呼ぶ（挙動を一致させる）。

---

### Task 1: ピッチ空白クリックで選択解除

**Files:**
- Modify: `app.js`（ハンドラ関数を `clearSelection()`（498行目）の直後に追加）
- Modify: `app.js:298`（`els.drawLayer.addEventListener("pointerdown", startDrawStroke);` の直後にリスナー登録を追加）

**Interfaces:**
- Consumes: 既存 `clearSelection()`（引数なし、`state.selected = null` にして各パネル/トークンを再描画）、既存モジュール変数 `drawTool`（`"move" | "pen" | "arrow"`）、既存状態 `state.selected`（`{team, id} | null`）、既存DOM参照 `els.field`（`#field` 要素）。
- Produces: `handleFieldBackgroundClick(event)` — `#field` の `click` ハンドラ。戻り値なし。副作用は条件を満たす場合のみ `clearSelection()` を呼ぶこと。

- [ ] **Step 1: ハンドラ関数を追加**

`app.js` の `clearSelection()` 関数（`498` 行目の閉じ `}`）の直後に、次の関数を追加する。

```js
// 移動モードでピッチ内の空白をクリック/タップしたら選択を解除する。
// click はドラッグや描画では発火しないため、コマ操作・描画と干渉しない。
function handleFieldBackgroundClick(event) {
  if (drawTool !== "move") return; // 移動モードのみ（ペン/矢印は描画優先）
  if (!state.selected) return; // 選択が無ければ何もしない
  if (event.target.closest(".player-token, .ball-token")) return; // コマ/ボールは空白でない
  clearSelection();
}
```

- [ ] **Step 2: リスナーを登録**

`app.js:298` の

```js
  els.drawLayer.addEventListener("pointerdown", startDrawStroke);
```

の直後の行に、次の1行を追加する。

```js
  els.field.addEventListener("click", handleFieldBackgroundClick);
```

- [ ] **Step 3: ローカルで配信して開く**

Run: `node dev-server.js`
Expected: `http://127.0.0.1:4173/` で配信開始。ブラウザで同URLを開く。

- [ ] **Step 4: 手動検証（受け入れ基準を1つずつ確認）**

移動モード（ツールバーの「移動」＝既定、ショートカット `v`）で、以下を順に確認する。

1. 選手コマをクリックして選択 → サイドパネル「選択中」に反映される。→ **ピッチ内の芝の空白**をクリック → 選択が解除され、パネルが「選択なし」表示に戻る。
2. 選手Aを選択 → 別の選手Bをクリック → Bに選択が切り替わる（空白解除は走らない）。
3. 選手を選択 → **ボール**をクリック → 選択は解除されない（ボールはコマ扱い）。
4. ツールを「ペン」（`p`）に切替 → ピッチの空白をドラッグ/クリック → 選択は解除されず、線が描ける。「矢印」（`a`）でも同様に描ける。
5. 「移動」に戻す → 選手を選択 → **Escキー**で解除できる／**「選択解除」ボタン**で解除できる（従来どおり）。
6. 既存機能の抜き取り確認: コマのドラッグ移動ができる／同じ選手をダブルタップで管理パネルが開く／戦術ガイドのトグルが効く。

Expected: 1〜6 すべて期待どおり。特に 2〜4 で「空白クリック解除」が誤発火しないこと。

- [ ] **Step 5: コミット**

```bash
git add app.js
git commit -m "移動モードでピッチ空白クリック時に選手選択を解除"
```

---

## Self-Review

**1. Spec coverage（スペック各項目 → 対応タスク）:**
- 移動モードのみで解除（スコープ） → Step 1 の `drawTool !== "move"` ガード、Step 4-4 で検証。
- ピッチ内のみ対象 → `els.field`（`#field`）に登録、Step 4-1 で検証。ライン外余白/パネルは `#field` 外なので自然に対象外。
- コマ/ボールは空白でない → `closest(".player-token, .ball-token")` ガード、Step 4-2/4-3 で検証。
- 描画・ドラッグ・ダブルタップ非干渉 → `click` 使用＋モードガード、Step 4-4/4-6 で検証。
- Esc/ボタン解除は不変・挙動一致 → 同一の `clearSelection()` 再利用、Step 4-5 で検証。
- i18n/HTML/CSS 変更なし → 本計画は `app.js` のみ変更。

**2. Placeholder scan:** TBD/TODO/「適切に処理」等なし。追加コードは全文記載済み。

**3. Type consistency:** `handleFieldBackgroundClick`（定義＝登録で名称一致）、`clearSelection`（既存・引数なし）、`drawTool` / `state.selected` / `els.field`（いずれも既存参照）で整合。
