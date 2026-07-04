# 退場機能（レッドカード） Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ピッチ上の味方・相手選手を「退場」させ、専用「退場」リスト（赤カード）に記録し、手動で復帰できるようにする。

**Architecture:** 選手オブジェクトに `sentOff: boolean` フラグを1つ足す（案A）。ピッチ描画・カウント・控えリストは「退場者を除外して導出」するヘルパー経由に切り替える。退場・復帰・リセットはフラグの付け外しのみ。既存の `render*` 関数群と localStorage 永続化にそのまま乗せる。

**Tech Stack:** バニラJS（`app.js`）+ 静的HTML（`index.html`）+ CSS（`styles.css`）。ビルド・依存なし。`node dev-server.js` で `http://127.0.0.1:4173/` に配信。

## Global Constraints

- テストフレームワークは未導入。検証は既存スペックの慣例どおり **`node dev-server.js` 起動 + ブラウザ（Playwright/手動）確認**で行う（単体テストは書かない）。
- 既存パターンを踏襲する: `state` 更新後は `saveState()` → 再描画（`renderAll()` もしくは対象の `render*`）。
- 派生ビューは「フィルタで導出」する既存流儀（`getHomeFieldPlayers()` 等）に合わせる。生配列 `state.opponentPlayers` の直接反復は退場者を含むため、描画系では使わない。
- 不変条件: **`sentOff === true` の味方選手は必ず `onField === false`**。
- 確認ダイアログ（`window.confirm`）は退場・復帰では**出さない**（可逆操作のため）。
- 色は既存 CSS 変数を使う: `--home #1f63d1` / `--away #d7423f` / `--away-deep #9d2927` / `--danger #b43a31` / `--line #d9e2dc`。

---

## File Structure

- `app.js` — 状態・ヘルパー・退場/復帰ロジック・描画。本機能の中心。
- `index.html` — サイドパネルに「退場」セクション追加、スコアストリップに赤カード枚数バッジ追加。
- `styles.css` — `.sent-off-row` / `.red-card` / `.sent-off-badge` を追加。
- `docs/superpowers/specs/2026-07-04-player-sending-off-design.md` — 承認済みスペック（参照のみ）。

---

## Task 1: データモデルと派生ヘルパー

`sentOff` フラグを全生成・復元経路に通し、派生ヘルパーを整える。この時点では全員 `sentOff=false` なので**画面の見た目は変わらない**。デリバラブルは「退場状態が localStorage を往復し、既存操作（ドラッグ・交代・追加・削除）が無回帰であること」。

**Files:**
- Modify: `app.js`（`createDefaultHomePlayers` / `createDefaultOpponents` / `addPlayerForm` の submit ハンドラ / `sanitizeHomePlayers` / `sanitizeOpponents` / `getHomeFieldPlayers` / `getHomeBenchPlayers` / `normalizeHomeFieldCount` / `swapHomePlayers`、および新規ヘルパー）

**Interfaces:**
- Consumes: 既存 `state.homePlayers` / `state.opponentPlayers`、`clamp` / `normalizeDir` / `sanitizeNumber` / `makeId` / `findPlayer`。
- Produces:
  - 各選手オブジェクトに `sentOff: boolean`。
  - `getHomeSentOffPlayers(): Player[]`（`sentOff === true` の味方）
  - `getActiveOpponents(): Player[]`（`sentOff !== true` の相手）
  - `getOpponentSentOffPlayers(): Player[]`（`sentOff === true` の相手）
  - `getHomeFieldPlayers()` = `onField && !sentOff`、`getHomeBenchPlayers()` = `!onField && !sentOff`。

- [ ] **Step 1: デフォルト生成に `sentOff: false` を追加**

`app.js` の `createDefaultHomePlayers` 内 `return { ... }` を次にする（`dir: 0,` の下に1行追加）:

```javascript
    return {
      id: `home-${index + 1}`,
      number: String(index + 1),
      name: "",
      onField: isStarter,
      x: position[0],
      y: position[1],
      dir: 0,
      sentOff: false,
    };
```

`createDefaultOpponents` の `return positions.map(...)` を次にする（`dir: 180,` の下に1行追加）:

```javascript
  return positions.map(([x, y], index) => ({
    id: `away-${index + 1}`,
    number: String(index + 1),
    name: "",
    x: 100 - x,
    y,
    dir: 180,
    sentOff: false,
  }));
```

- [ ] **Step 2: 選手追加フォームにも `sentOff: false` を追加**

`app.js` の `els.addPlayerForm.addEventListener("submit", ...)` 内の `state.homePlayers.push({ ... })` を次にする:

```javascript
    state.homePlayers.push({
      id: makeId("home"),
      number,
      name,
      onField: false,
      x: 50,
      y: 50,
      dir: 0,
      sentOff: false,
    });
```

- [ ] **Step 3: sanitize に `sentOff` を追加し不変条件を強制**

`app.js` の `sanitizeHomePlayers` を次の実装で丸ごと置き換える（`sentOff` を読み、`sentOff` の時は `onField` を必ず false に）:

```javascript
function sanitizeHomePlayers(players) {
  return players
    .filter((player) => player && typeof player === "object")
    .map((player, index) => {
      const sentOff = Boolean(player.sentOff);
      return {
        id: String(player.id || makeId("home")),
        number: sanitizeNumber(player.number ?? String(index + 1)),
        name: String(player.name || "").slice(0, 16),
        onField: sentOff ? false : Boolean(player.onField),
        x: clamp(Number(player.x) || 50, 4, 96),
        y: clamp(Number(player.y) || 50, 6, 94),
        dir: normalizeDir(player.dir, 0),
        sentOff,
      };
    });
}
```

`sanitizeOpponents` の `return valid.map(...)` 内の返却オブジェクトに `sentOff` を追加する（`dir:` の下に1行）:

```javascript
    return {
      id: String(player.id || `away-${index + 1}`),
      number: sanitizeNumber(player.number ?? String(index + 1)),
      name: String(player.name || "").slice(0, 16),
      x: clamp(Number(player.x) || 100 - fallback[0], 4, 96),
      y: clamp(Number(player.y) || fallback[1], 6, 94),
      dir: normalizeDir(player.dir, 180),
      sentOff: Boolean(player.sentOff),
    };
```

- [ ] **Step 4: 派生ヘルパーを更新・追加**

`app.js` の `getHomeFieldPlayers` / `getHomeBenchPlayers`（現状は `onField` / `!onField` のみ）を次で置き換え、退場者を除外し、新ヘルパー3つを足す:

```javascript
function getHomeFieldPlayers() {
  return state.homePlayers.filter((player) => player.onField && !player.sentOff);
}

function getHomeBenchPlayers() {
  return state.homePlayers.filter((player) => !player.onField && !player.sentOff);
}

function getHomeSentOffPlayers() {
  return state.homePlayers.filter((player) => player.sentOff);
}

function getActiveOpponents() {
  return state.opponentPlayers.filter((player) => !player.sentOff);
}

function getOpponentSentOffPlayers() {
  return state.opponentPlayers.filter((player) => player.sentOff);
}
```

- [ ] **Step 5: 昇格ロジックと交代ガードを更新**

`app.js` の `normalizeHomeFieldCount` の bench 定義を退場者除外にする（退場者を誤ってピッチへ昇格させない）:

```javascript
function normalizeHomeFieldCount() {
  const starters = state.homePlayers.filter((player) => player.onField);
  const bench = state.homePlayers.filter((player) => !player.onField && !player.sentOff);

  if (starters.length > 11) {
    starters.slice(11).forEach((player) => {
      player.onField = false;
    });
  }

  while (state.homePlayers.filter((player) => player.onField).length < 11 && bench.length) {
    const next = bench.shift();
    next.onField = true;
  }
}
```

`swapHomePlayers` の早期return条件に `bench.sentOff` を追加する:

```javascript
  if (!starter || !bench || !starter.onField || bench.onField || bench.sentOff) return;
```

- [ ] **Step 6: ブラウザで無回帰を検証**

`node dev-server.js` を起動し `http://127.0.0.1:4173/` を開く。ブラウザのDevToolsコンソールでエラーが出ないこと、以下が従来どおり動くことを確認:
- 選手をドラッグ移動できる
- 味方を選択して控えと交代できる（交代候補に控えが並ぶ）
- 味方を追加・削除できる
- リロードすると配置が復元される

さらにコンソールで永続化を確認:

```javascript
JSON.parse(localStorage.getItem("soccer-board-state-v1")).homePlayers[0].sentOff
```

Expected: `false`（`undefined` ではなく boolean で保存されている）。

- [ ] **Step 7: コミット**

```bash
git add app.js
git commit -m "退場機能: 選手モデルにsentOffフラグと派生ヘルパーを追加"
```

---

## Task 2: 退場・復帰の中核（UI＋ロジック）

「退場」セクション・退場ボタン・退場/復帰ロジック・退場者を除外した描画を実装する。デリバラブルは「味方・相手を退場させると盤から消えて退場リストに赤カードで並び、復帰で戻る（リロード保持含む）」まで一気通貫で動くこと。

**Files:**
- Modify: `index.html`（サイドパネルの「交代」セクション直後に「退場」セクションを追加）
- Modify: `app.js`（`els` に `sentOffPanel`、`renderAll` に `renderSentOffPanel()`、`renderFieldPlayers` / `renderCounts` / `renderOpponentRoster` の相手参照を `getActiveOpponents()` に切替、`renderSelectionPanel` に退場ボタン、新規 `sendOffPlayer` / `restorePlayer` / `renderSentOffPanel` / `createSentOffRow`）
- Modify: `styles.css`（`.sent-off-row` / `.sent-off-row .player-name` / `.red-card` を追加）

**Interfaces:**
- Consumes: Task 1 の `getHomeSentOffPlayers` / `getActiveOpponents` / `getOpponentSentOffPlayers`、既存 `findPlayer` / `saveState` / `renderAll` / `emptyState` / `displayNumber` / `getSelectedPlayer`。
- Produces:
  - `sendOffPlayer(team: "home"|"away", id: string): void`
  - `restorePlayer(team: "home"|"away", id: string): void`
  - `renderSentOffPanel(): void`（`renderAll` から呼ばれる）
  - `createSentOffRow(team, player): HTMLElement`

- [ ] **Step 1: 「退場」セクションをHTMLに追加**

`index.html` の「交代」セクション（`<h2>交代</h2>` を含む `<section class="panel-section">` … `<div id="substitutionPanel"></div></section>`）の**直後**に次を挿入する:

```html
          <section class="panel-section">
            <div class="section-title">
              <h2>退場</h2>
            </div>
            <div id="sentOffPanel"></div>
          </section>
```

- [ ] **Step 2: `els` と `renderAll` に配線**

`app.js` の `els` オブジェクトに1行追加（`substitutionPanel` の下など任意の位置）:

```javascript
  substitutionPanel: document.querySelector("#substitutionPanel"),
  sentOffPanel: document.querySelector("#sentOffPanel"),
```

`renderAll` の `renderSubstitutionPanel();` の直後に1行追加:

```javascript
  renderSelectionPanel();
  renderSubstitutionPanel();
  renderSentOffPanel();
  renderHomeRoster();
  renderOpponentRoster();
```

- [ ] **Step 3: 相手描画を退場者除外に切替**

`app.js` の `renderFieldPlayers` の相手ループを `getActiveOpponents()` にする:

```javascript
  getActiveOpponents().forEach((player) => {
    els.playersLayer.appendChild(createPlayerToken("away", player));
  });
```

`renderCounts` の相手カウントを `getActiveOpponents()` にする:

```javascript
function renderCounts() {
  els.homeFieldCount.textContent = String(getHomeFieldPlayers().length);
  els.awayFieldCount.textContent = String(getActiveOpponents().length);
}
```

`renderOpponentRoster` の先頭ループを `getActiveOpponents()` にする（退場中の相手は登録リストに出さない）:

```javascript
function renderOpponentRoster() {
  els.opponentRoster.replaceChildren();
  getActiveOpponents().forEach((player) => {
```

（以降の行は変更なし）

- [ ] **Step 4: 退場・復帰ロジックを実装**

`app.js` に次の2関数を追加する（`swapHomePlayers` の近くなど、関数定義エリア）:

```javascript
function sendOffPlayer(team, id) {
  const player = findPlayer(team, id);
  if (!player || player.sentOff) return;
  if (team === "home") {
    if (!player.onField) return;
    player.onField = false;
  }
  player.sentOff = true;
  state.selected = null;
  saveState();
  renderAll();
}

function restorePlayer(team, id) {
  const player = findPlayer(team, id);
  if (!player || !player.sentOff) return;
  player.sentOff = false;
  saveState();
  renderAll();
}
```

- [ ] **Step 5: 退場リストの描画を実装**

`app.js` に次の2関数を追加する（`renderSubstitutionPanel` の近く）:

```javascript
function renderSentOffPanel() {
  els.sentOffPanel.replaceChildren();
  const homeSentOff = getHomeSentOffPlayers();
  const awaySentOff = getOpponentSentOffPlayers();

  if (!homeSentOff.length && !awaySentOff.length) {
    els.sentOffPanel.appendChild(emptyState("退場者なし"));
    return;
  }

  const list = document.createElement("div");
  list.className = "roster-list";
  homeSentOff.forEach((player) => list.appendChild(createSentOffRow("home", player)));
  awaySentOff.forEach((player) => list.appendChild(createSentOffRow("away", player)));
  els.sentOffPanel.appendChild(list);
}

function createSentOffRow(team, player) {
  const row = document.createElement("div");
  row.className = "sent-off-row";

  const card = document.createElement("span");
  card.className = "red-card";
  card.setAttribute("aria-hidden", "true");

  const pill = document.createElement("span");
  pill.className = `pill ${team}`;
  pill.textContent = team === "home" ? "味方" : "相手";

  const badge = document.createElement("div");
  badge.className = `number-badge ${team}`;
  badge.textContent = displayNumber(player);

  const name = document.createElement("div");
  name.className = "player-name";
  const primary = document.createElement("strong");
  primary.textContent = team === "home" ? player.name || "名前未登録" : player.name || "相手";
  name.appendChild(primary);

  const actionWrap = document.createElement("div");
  actionWrap.className = "row-actions";
  const restoreBtn = document.createElement("button");
  restoreBtn.type = "button";
  restoreBtn.className = "mini-button primary";
  restoreBtn.textContent = "復帰";
  restoreBtn.addEventListener("click", () => restorePlayer(team, player.id));
  actionWrap.appendChild(restoreBtn);

  row.append(card, pill, badge, name, actionWrap);
  return row;
}
```

- [ ] **Step 6: 選択カードに「退場させる」ボタンを追加**

`app.js` の `renderSelectionPanel` 末尾、`card.append(meta, grid);` と `els.selectionPanel.appendChild(card);` の間に次を挿入する（ピッチ上の選手のときだけ表示）:

```javascript
  card.append(meta, grid);

  const canSendOff =
    selected.team === "away" || (selected.team === "home" && selected.player.onField);
  if (canSendOff) {
    const sendOffBtn = document.createElement("button");
    sendOffBtn.type = "button";
    sendOffBtn.className = "danger-button send-off-button";
    sendOffBtn.textContent = "退場させる";
    sendOffBtn.addEventListener("click", () => sendOffPlayer(selected.team, selected.player.id));
    card.appendChild(sendOffBtn);
  }

  els.selectionPanel.appendChild(card);
```

- [ ] **Step 7: 退場リストの見た目CSSを追加**

`styles.css` の末尾（`@media` ブロックより前、`.opponent-input.number { ... }` の後あたり）に次を追加する:

```css
.sent-off-row {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 44px;
  padding: 7px;
  background: #f8faf8;
  border: 1px solid var(--line);
  border-radius: 8px;
}

.sent-off-row .player-name {
  flex: 1;
}

.red-card {
  flex: none;
  width: 13px;
  height: 18px;
  border-radius: 2px;
  background: #e11d1d;
  box-shadow:
    inset 0 0 0 1px rgba(0, 0, 0, 0.12),
    0 1px 2px rgba(10, 20, 14, 0.25);
}
```

- [ ] **Step 8: ブラウザで一気通貫に検証**

`node dev-server.js` を起動し `http://127.0.0.1:4173/` を開く。「退場」セクションに初期状態で「退場者なし」が出ることを確認。続けて:

1. 味方のピッチ選手をクリック選択 → 「選択中」カードに「退場させる」が出る → クリック。
   - Expected: その選手が盤から消える／「ピッチ」カウントが 11→10／退場リストに「赤カード＋味方pill＋背番号＋名前＋復帰」の行が出る／選択は解除される。
2. 控えの味方選手を選択したとき「退場させる」が**出ない**ことを確認。
3. 相手選手をクリック選択 → 「退場させる」 → 盤から消え「相手」カウントが減り、退場リストに相手行が出る。
4. 退場した味方が「交代」候補・控えリストに**出ない**ことを確認（別のピッチ選手を選択して控え一覧を見る）。
5. 退場リストの「復帰」をクリック → 味方は控えに戻る（交代候補に復活）／相手はピッチに戻る／カウントが戻る。
6. 味方1名・相手1名を退場させたままリロード → 退場状態が保持される。

コンソールで不変条件も確認（退場中の味方をリロード後に）:

```javascript
JSON.parse(localStorage.getItem("soccer-board-state-v1")).homePlayers.filter(p => p.sentOff).every(p => p.onField === false)
```

Expected: `true`。

- [ ] **Step 9: コミット**

```bash
git add index.html app.js styles.css
git commit -m "退場機能: 退場/復帰の操作・専用リスト・退場者除外の描画を実装"
```

---

## Task 3: スコアストリップの赤カード枚数バッジ

数的不利をひと目で分かるよう、スコアストリップに `🟥N`（退場枚数）を表示する。デリバラブルは「退場者のいるチームにだけ赤カード枚数が出て、復帰で消える」。

**Files:**
- Modify: `index.html`（`.score-strip` の各チーム `<div>` にバッジ span を追加）
- Modify: `app.js`（`els` に2バッジ、`renderCounts` にバッジ更新、新規 `updateSentOffBadge`）
- Modify: `styles.css`（`.sent-off-badge`）

**Interfaces:**
- Consumes: Task 1 の `getHomeSentOffPlayers` / `getOpponentSentOffPlayers`。
- Produces: `updateSentOffBadge(el: HTMLElement, count: number): void`。

- [ ] **Step 1: スコアストリップにバッジ要素を追加**

`index.html` の `.score-strip` を次にする（各チームのカウント `<strong>` の直後に span を追加）:

```html
          <div class="score-strip">
            <div>
              <span class="team-dot home-dot"></span>
              味方 <strong id="homeFieldCount">0</strong>
              <span id="homeSentOffBadge" class="sent-off-badge" hidden></span>
            </div>
            <div>
              <span class="team-dot away-dot"></span>
              相手 <strong id="awayFieldCount">0</strong>
              <span id="awaySentOffBadge" class="sent-off-badge" hidden></span>
            </div>
          </div>
```

- [ ] **Step 2: `els` にバッジを配線**

`app.js` の `els` に2行追加（`awayFieldCount` の下）:

```javascript
  homeFieldCount: document.querySelector("#homeFieldCount"),
  awayFieldCount: document.querySelector("#awayFieldCount"),
  homeSentOffBadge: document.querySelector("#homeSentOffBadge"),
  awaySentOffBadge: document.querySelector("#awaySentOffBadge"),
```

- [ ] **Step 3: `renderCounts` でバッジ更新**

`app.js` の `renderCounts` を次にし、`updateSentOffBadge` を直後に追加する:

```javascript
function renderCounts() {
  els.homeFieldCount.textContent = String(getHomeFieldPlayers().length);
  els.awayFieldCount.textContent = String(getActiveOpponents().length);
  updateSentOffBadge(els.homeSentOffBadge, getHomeSentOffPlayers().length);
  updateSentOffBadge(els.awaySentOffBadge, getOpponentSentOffPlayers().length);
}

function updateSentOffBadge(el, count) {
  if (count > 0) {
    el.textContent = `🟥${count}`;
    el.hidden = false;
  } else {
    el.textContent = "";
    el.hidden = true;
  }
}
```

- [ ] **Step 4: バッジのCSSを追加**

`styles.css` の末尾（`@media` ブロックより前）に追加:

```css
.sent-off-badge {
  font-weight: 700;
  color: var(--away-deep);
}

.sent-off-badge[hidden] {
  display: none;
}
```

- [ ] **Step 5: ブラウザで検証**

`http://127.0.0.1:4173/` で:
1. 初期状態で赤カードバッジが**表示されない**こと。
2. 味方を1名退場 → 味方側に `🟥1` が出る。もう1名退場 → `🟥2`。
3. 相手を退場 → 相手側に `🟥1` が出る。
4. すべて「復帰」させると両バッジが消える。

- [ ] **Step 6: コミット**

```bash
git add index.html app.js styles.css
git commit -m "退場機能: スコアストリップに赤カード枚数バッジを追加"
```

---

## Task 4: ボードリセットとの連携

「ボードリセット」（Rキー / ボタン）で全退場者を復帰させ、フル11対11に戻す。デリバラブルは「退場者がいてもリセットで両チーム満員に戻る」。

**Files:**
- Modify: `app.js`（`resetBoard`）

**Interfaces:**
- Consumes: 既存 `resetBoard` フロー（`normalizeHomeFieldCount` / `applyFormationToHome` / `applyFormationToOpponents`）。
- Produces: なし（`resetBoard` の挙動変更のみ）。

- [ ] **Step 1: `resetBoard` で全 `sentOff` をクリア**

`app.js` の `resetBoard` を次にする（`state.formation = getFormationValue();` の直後に復帰処理を挿入）:

```javascript
function resetBoard() {
  state.formation = getFormationValue();
  state.homePlayers.forEach((player) => {
    player.sentOff = false;
  });
  state.opponentPlayers.forEach((player) => {
    player.sentOff = false;
  });
  normalizeHomeFieldCount();
  applyFormationToHome();
  applyFormationToOpponents();
  state.ball = createDefaultBall();
  state.drawings = [];
  state.selected = null;
  state.notes = "";
  saveState();
  renderAll();
}
```

（`味方登録を初期化` / `相手登録リセット` は Task 1 で `createDefault*` に `sentOff:false` を入れたため、作り直しで自動的に退場が解除される。追加変更は不要。）

- [ ] **Step 2: ブラウザで検証**

`http://127.0.0.1:4173/` で:
1. 味方2名・相手1名を退場させる（ピッチが 9 / 10、退場リストに3件、`🟥` 表示）。
2. 「ボードリセット」をクリック（またはRキー）。
   - Expected: 味方11・相手11に戻る／退場リストが「退場者なし」／赤カードバッジが消える／配置がフォーメーション初期位置。
3. リロードしてもフル11対11のままであること（保存に退場者が残っていない）。

- [ ] **Step 3: コミット**

```bash
git add app.js
git commit -m "退場機能: ボードリセットで全退場者を復帰"
```

---

## Self-Review

**1. Spec coverage（スペック各節→タスク対応）:**

| スペック項目 | 対応タスク |
|---|---|
| データモデル `sentOff`（味方3状態/相手2状態）| Task 1 Step 1–3 |
| 不変条件（退場中の味方は onField=false）| Task 1 Step 3（sanitize）/ Task 2 Step 4（sendOffPlayer）|
| 派生ヘルパー（field/bench/sentOff/activeOpponents）| Task 1 Step 4 |
| normalize/swap ガード | Task 1 Step 5 |
| 退場させる（選択カード、ピッチ上のみ、確認なし）| Task 2 Step 6 + Step 4 |
| 復帰（退場リストの復帰ボタン）| Task 2 Step 5（行）+ Step 4（restorePlayer）|
| 「退場」セクション（味方→相手を1リスト、赤カード＋pill＋番号/名前）| Task 2 Step 1,5,7 |
| 退場者を除外した描画（field/counts/opponentRoster）| Task 2 Step 3 |
| スコア `🟥N` バッジ | Task 3 |
| ボードリセットで全員復帰 | Task 4 |
| 登録初期化系で退場クリア | Task 1 Step 1（createDefault に sentOff:false）|
| 永続化（saveStateは自動、sanitize追加）| Task 1 Step 3 / Task 2 Step 8（検証）|
| テスト計画（ブラウザ確認）| 各 Task の検証 Step |

ギャップなし。

**2. Placeholder scan:** TBD/TODO/「適宜」等なし。各コード変更は完全なコードブロックで提示済み。

**3. Type consistency:** `sendOffPlayer(team, id)` / `restorePlayer(team, id)` / `renderSentOffPanel()` / `createSentOffRow(team, player)` / `updateSentOffBadge(el, count)` / `getHomeSentOffPlayers()` / `getActiveOpponents()` / `getOpponentSentOffPlayers()` の名称・引数は全タスクで一致。`els.sentOffPanel` / `els.homeSentOffBadge` / `els.awaySentOffBadge` の id もHTMLと一致。
