# タッチ操作の磨き込み 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** スマホ実機で「選手トークンのダブルタップでパネルが開かない」「タッチ時に青い四角（タップハイライト）が出る」の2点を解消する。

**Architecture:** タップ/ドラッグ判別しきい値を `event.pointerType` で分岐（マウス=2px／タッチ・ペン=10px）し、しきい値未満の微小移動ではコマを動かさない（early-return）。これでダブルタップ成立とタップ時の微ズレ解消を同一修正で満たす。加えて CSS でタップハイライトを透明化する。

**Tech Stack:** 素の HTML/CSS/JavaScript（フレームワーク・バンドラ・依存パッケージなし）。Pointer Events。検証は Playwright（テストフレームワークは無し）。

## Global Constraints

- **ゼロ依存・ビルド不要を維持**（パッケージ/バンドラを増やさない）。
- **相対パス参照を維持**（`./app.js` 等、絶対パスのアセット参照を増やさない）。
- **既存機能を壊さない**: フォーメーション反映／ペン・矢印描画／戦術ガイド／退場／ヘッダー折りたたみ／サイドパネルのドロワー／キーボードショートカット／盤面フィット／ダブルタップ。
- **i18n**: 表示文言を追加する場合は `data-i18n`/`t()` 経由・ja/en 両辞書に追加（本計画では文言追加なし）。
- **push は人が実行**（`main` への直 push はしない。ローカルコミットまで）。
- 動作確認サーバー: `node dev-server.js` → `http://127.0.0.1:4173/`。

## 前提（現状コード）

`app.js`:
- `startDrag(event)`（L818付近）: `activeDrag = { team, id, pointerId, startX, startY, moved: false }` を生成。`team !== "ball"` なら即 `selectPlayer()`。
- `moveDrag(event)`（L842付近）: 毎回 `player.x/y` を更新しトークン再配置。移動量が `> 2px` で `activeDrag.moved = true`。
- `endDrag(event)`（L868付近）: `moved` なら `saveState()`、そうでなく `pointerup` かつ非ボールなら `registerTokenTap()`（ダブルタップ判定→`setPanelOpen(true)`）。

`styles.css`:
- `html, body { min-height: 100%; }`（L29-32）。`-webkit-tap-highlight-color` は未設定（＝ブラウザ既定のタップハイライトが出る）。

---

### Task 1: タップ/ドラッグ判別を pointerType で分岐し、微小移動を抑制する

**Files:**
- Modify: `app.js`（`startDrag` L818付近、`moveDrag` L842付近）

**Interfaces:**
- Consumes: `activeDrag`（モジュールスコープ変数）、`event.pointerType`（PointerEvent）、既存 `findPlayer` / `findToken` / `clampX` / `clampY` / `fromScreenFraction` / `setTokenPosition`。
- Produces: `activeDrag.pointerType`（string: "mouse" | "touch" | "pen" | ""）。`endDrag` / `registerTokenTap` は無変更（`moved` の意味は同一）。

- [ ] **Step 1: 失敗する再現を確認（Playwright）**

dev-server 起動後、ブラウザで `http://127.0.0.1:4173/` を開き、以下を `browser_evaluate` で実行。現状コードでは **touch で 3px 揺らすとパネルが開かない**ことを確認する（これが「失敗するテスト」）。

```js
() => {
  const panel = document.querySelector('.side-panel');
  const r0 = document.querySelector('.player-token').getBoundingClientRect();
  const cx = r0.left + r0.width / 2, cy = r0.top + r0.height / 2; // 先頭選手の中心（固定）
  function tap(dx, type) {
    const el = document.querySelector('.player-token'); // endDrag で作り直されるので毎回取得
    el.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 1, button: 0, pointerType: type, clientX: cx, clientY: cy, bubbles: true }));
    if (dx) window.dispatchEvent(new PointerEvent('pointermove', { pointerId: 1, pointerType: type, clientX: cx + dx, clientY: cy, bubbles: true }));
    window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 1, pointerType: type, clientX: cx + (dx || 0), clientY: cy, bubbles: true }));
  }
  function close() { if (panel.classList.contains('is-open')) { document.querySelector('.panel-scrim')?.click(); if (panel.classList.contains('is-open')) document.querySelector('[aria-expanded]')?.click(); } }
  close(); tap(3, 'touch'); tap(3, 'touch');
  const out = { touch3px: panel.classList.contains('is-open') ? 'OPENS' : 'FAILS' };
  close();
  return out;
}
```

Expected（現状）: `{ "touch3px": "FAILS" }`

- [ ] **Step 2: `startDrag` に pointerType を保持**

`app.js` の `startDrag` の `activeDrag` 生成に `pointerType` を追加する。

```js
  activeDrag = {
    team,
    id,
    pointerId: event.pointerId,
    pointerType: event.pointerType,
    startX: event.clientX,
    startY: event.clientY,
    moved: false,
  };
```

- [ ] **Step 3: `moveDrag` を slop ベースの early-return に置換**

`moveDrag` 全体を以下に置き換える（`> 2` 固定判定を撤去し、pointerType 分岐の slop に。slop 以内は早期 return してコマを動かさない）。

```js
function moveDrag(event) {
  if (!activeDrag || event.pointerId !== activeDrag.pointerId) return;

  // タップ/ドラッグ判別のしきい値（slop）。指のタッチは接地点が数px揺れるため、
  // マウス以外は大きめに取り、微小な揺れをタップとして扱う（ダブルタップ成立のため）。
  const slop = activeDrag.pointerType === "mouse" ? 2 : 10;
  if (
    !activeDrag.moved &&
    Math.abs(event.clientX - activeDrag.startX) <= slop &&
    Math.abs(event.clientY - activeDrag.startY) <= slop
  ) {
    return; // slop 以内: タップ候補としてコマを動かさない
  }
  activeDrag.moved = true;

  const player = findPlayer(activeDrag.team, activeDrag.id);
  if (!player) return;

  const rect = els.field.getBoundingClientRect();
  const fx = ((event.clientX - rect.left) / rect.width) * 100;
  const fy = ((event.clientY - rect.top) / rect.height) * 100;
  const data = fromScreenFraction(fx, fy);
  player.x = clampX(activeDrag.team, data.x);
  player.y = clampY(activeDrag.team, data.y);

  const token = findToken(activeDrag.team, activeDrag.id);
  if (token) {
    setTokenPosition(token, player);
    token.classList.add("dragging");
  }
}
```

- [ ] **Step 4: 検証（Playwright スイープ）**

ブラウザをリロードし、以下を `browser_evaluate` で実行。

```js
() => {
  const panel = document.querySelector('.side-panel');
  const r0 = document.querySelector('.player-token').getBoundingClientRect();
  const cx = r0.left + r0.width / 2, cy = r0.top + r0.height / 2;
  function tap(dx, type) {
    const el = document.querySelector('.player-token'); // endDrag で作り直されるので毎回取得
    el.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 1, button: 0, pointerType: type, clientX: cx, clientY: cy, bubbles: true }));
    if (dx) window.dispatchEvent(new PointerEvent('pointermove', { pointerId: 1, pointerType: type, clientX: cx + dx, clientY: cy, bubbles: true }));
    window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 1, pointerType: type, clientX: cx + (dx || 0), clientY: cy, bubbles: true }));
  }
  function close() { if (panel.classList.contains('is-open')) { document.querySelector('.panel-scrim')?.click(); if (panel.classList.contains('is-open')) document.querySelector('[aria-expanded]')?.click(); } }
  const res = {};
  for (const j of [3, 8, 10, 11, 15]) { close(); tap(j, 'touch'); tap(j, 'touch'); res['touch_' + j + 'px'] = panel.classList.contains('is-open') ? 'OPENS' : 'FAILS'; }
  for (const j of [2, 3]) { close(); tap(j, 'mouse'); tap(j, 'mouse'); res['mouse_' + j + 'px'] = panel.classList.contains('is-open') ? 'OPENS' : 'FAILS'; }
  // 微ズレ抑制: 5px の touch タップ1回で先頭選手の位置が変わらない
  //（トークンは作り直されるので、state を反映するライブトークンの left/top を前後比較）
  close();
  const pos = () => { const el = document.querySelector('.player-token'); return el.style.left + '/' + el.style.top; };
  const posBefore = pos();
  tap(5, 'touch');
  res.microNudge_posUnchanged = (pos() === posBefore);
  close();
  return res;
}
```

Expected:
```
{
  "touch_3px": "OPENS", "touch_8px": "OPENS", "touch_10px": "OPENS",
  "touch_11px": "FAILS", "touch_15px": "FAILS",
  "mouse_2px": "OPENS", "mouse_3px": "FAILS",
  "microNudge_posUnchanged": true
}
```

- [ ] **Step 5: 非回帰の目視確認**

`browser_navigate` でリロードし、`browser_click`/ドラッグ相当で以下を確認（または `browser_take_screenshot`）:
- マウスで選手トークンをドラッグ → 通常どおり移動する（大きく動かせば `moved` 成立）。
- 方向ハンドルでの回転が従来どおり効く。
- ロスター行クリックで選択できる。
- キーボードフォーカス時に金色アウトラインが出る。

- [ ] **Step 6: コミット**

```bash
git add app.js
git commit -m "タップ/ドラッグ判別を pointerType で分岐し微小移動を抑制（スマホのダブルタップ対応）"
```

---

### Task 2: タップハイライト（青い四角）を透明化する

**Files:**
- Modify: `styles.css`（`html, body` ルール L29-32付近）

**Interfaces:**
- Consumes: なし。
- Produces: なし（純粋に見た目のみ。JS・pointer イベントに影響なし）。

- [ ] **Step 1: 失敗する状態を確認（Playwright）**

リロード後、以下を `browser_evaluate` で実行し、現状は既定値（透明でない）であることを確認。

```js
() => getComputedStyle(document.querySelector('.player-token')).webkitTapHighlightColor
```

Expected（現状）: `"rgba(0, 0, 0, 0.18)"`（＝透明でない＝タップ時に青い四角が出る）

- [ ] **Step 2: `html, body` に tap-highlight 透明化を追加**

`styles.css` の既存ルールを次のように変更する。

```css
html,
body {
  min-height: 100%;
  -webkit-tap-highlight-color: transparent;
}
```

- [ ] **Step 3: 検証（Playwright）**

リロード後、以下を `browser_evaluate` で実行。

```js
() => ({
  token: getComputedStyle(document.querySelector('.player-token')).webkitTapHighlightColor,
  rosterBtn: getComputedStyle(document.querySelector('button')).webkitTapHighlightColor,
})
```

Expected: `{ "token": "rgba(0, 0, 0, 0)", "rosterBtn": "rgba(0, 0, 0, 0)" }`（`rgba(0,0,0,0)` = transparent）

- [ ] **Step 4: フォーカス枠の非回帰確認**

`:focus-visible` の金色アウトラインが残っていることを確認（Tab キーでトークン/ボタンにフォーカスし、金色枠が出る）。`browser_press_key` で `Tab` を送るか、`browser_take_screenshot` で目視。

- [ ] **Step 5: コミット**

```bash
git add styles.css
git commit -m "タッチ時のタップハイライト（青い四角）を透明化"
```

---

## 検証まとめ（完了条件）

- Task 1: touch は 10px 以内の揺れでダブルタップがパネルを開く／11px 以上はドラッグ。mouse は 2px 維持（3px はドラッグ）。微小タップでコマがズレない。
- Task 2: `.player-token` ほかタップ可能要素の `-webkit-tap-highlight-color` が `transparent`。金色フォーカス枠は維持。
- 既存機能（ドラッグ移動・回転・描画・ガイド・退場・パネル開閉・ショートカット・盤面フィット）が非回帰。
