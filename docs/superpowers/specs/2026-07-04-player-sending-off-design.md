# 退場機能（レッドカード）設計

日付: 2026-07-04
ステータス: 承認済み（2026-07-04）

## 目的

作戦盤で、ピッチ上の選手を「退場」させられるようにする。退場した選手はピッチから外れ、そのチームは数的不利（例: 10対11）のまま配置を検討できる。誤操作や「もし退場したら」の検討のため、退場者は専用リストに残り、手動で復帰できる。

- 味方・相手の**両チーム**が対象。
- 退場者は交代（`swapHomePlayers`）では戻せない。控えとは区別し、専用「退場」リスト（赤カード履歴）に残す。
- 復帰は「退場」リストの `復帰` ボタンからのみ行う。

## 決定事項（ブレスト結果）

| 論点 | 決定 |
|---|---|
| 対象チーム | 味方・相手の両方 |
| 退場後の扱い | 専用「退場」リストに残す（赤カード履歴）。交代では戻さない |
| 退場の操作起点 | 「選択中」パネルの `退場させる` ボタン（味方・相手共通のUI） |
| 確認ダイアログ | なし（退場リストから即復帰できる可逆操作のため。交代と同じ手触り） |
| ボードリセット連携 | 全退場者を復帰させフル11対11に戻す |
| データモデル | 既存の選手オブジェクトに `sentOff` フラグを追加（案A）。別配列への移動（案B）は不採用 |

## データモデル

選手オブジェクトに `sentOff: boolean` を追加する。

**味方 `homePlayers`（`{id, number, name, onField, x, y, dir, sentOff}`）の状態は3つ:**

| 状態 | onField | sentOff |
|---|---|---|
| ピッチ | true | false |
| 控え | false | false |
| 退場 | false | true |

**相手 `opponentPlayers`（`{id, number, name, x, y, dir, sentOff}`）の状態は2つ:**

| 状態 | sentOff |
|---|---|
| ピッチ | false |
| 退場 | true |

- 不変条件: **`sentOff=true` の味方は必ず `onField=false`**。退場処理と読み込み時の sanitize の両方で保証する。

### 導出ヘルパー

- `getHomeFieldPlayers()` = `onField && !sentOff`（現状 `onField` のみ。退場者は `onField=false` なので実害はないが、安全のため `!sentOff` を明示）
- `getHomeBenchPlayers()` = `!onField && !sentOff` に変更（**退場者を控えから除外**＝交代候補に出さない・交代で戻せない）
- 新規 `getHomeSentOffPlayers()` = `sentOff`
- 新規 `getActiveOpponents()` = `!sentOff`（フィールド描画・カウント・相手登録リストで使用）
- 新規 `getOpponentSentOffPlayers()` = `sentOff`

## 操作

### 退場させる

- 「選択中」パネルの選択カードに `退場させる`（danger系）ボタンを追加する。
- 表示条件: **ピッチ上の選手のときのみ**（味方は `onField===true`、相手は選択できる時点で常にピッチ）。控えの味方選手・ボールには出さない。
- 新設 `sendOffPlayer(team, id)`:
  - 味方: `player.onField = false; player.sentOff = true`。控えの自動昇格は**しない**（数的不利のまま）。
  - 相手: `player.sentOff = true`。
  - `state.selected = null`（選択解除）、`saveState()`、`renderAll()`。
- 確認ダイアログは出さない。

### 復帰

- 新設「退場」セクションの各行に `復帰`（`mini-button primary`）ボタンを置く。
- 新設 `restorePlayer(team, id)`:
  - 味方: `player.sentOff = false`（`onField` は false のまま＝控えに戻る。再度交代でピッチへ）。
  - 相手: `player.sentOff = false`（保持していた位置でピッチに復帰）。
  - `saveState()`、`renderAll()`。

## UI仕様

### 「退場」セクション（新設）

- `index.html` のサイドパネル、**「交代」セクションの直後**に追加する。

```html
<section class="panel-section">
  <div class="section-title">
    <h2>退場</h2>
  </div>
  <div id="sentOffPanel"></div>
</section>
```

- `renderSentOffPanel()` を新設し `renderAll()` から呼ぶ。味方・相手の退場者を**1つのリスト**にまとめて表示する（味方→相手の順）。
- 各行: チームpill（`味方`/`相手`）＋ **赤カードバッジ** ＋ 背番号/名前 ＋ `復帰` ボタン。
- 退場者ゼロなら `emptyState("退場者なし")`。
- 既存の `createPlayerRow` は味方の onField 前提の文言（「ピッチ/控え」「名前未登録」）を含むため、退場行は専用の小さな描画関数で組む（`pill` + `.red-card` + 番号/名前 + 復帰ボタン）。相手は名前が空なら「相手」と表示。

### 「選択中」パネル

- 選択カード（`renderSelectionPanel`）の末尾に `退場させる` ボタンを追加。ピッチ上の選手のときのみ表示。
- ボタン押下で `sendOffPlayer(selected.team, selected.player.id)`。

### スコアストリップ

- 退場者がいるチームに、赤カード枚数を `🟥N` の小バッジで表示する（0枚のときは非表示）。
- ピッチ人数（`#homeFieldCount` / `#awayFieldCount`）は既存カウントが自動で減る（味方は `getHomeFieldPlayers().length`、相手は `getActiveOpponents().length` に変更）。

## リセット連携

- `resetBoard()`（ボードリセット / R キー）:
  - 全味方 `sentOff=false`、全相手 `sentOff=false` にする。
  - 既存フロー（`normalizeHomeFieldCount()` → `applyFormationToHome()` → `applyFormationToOpponents()`）でピッチを11人に整える。結果はフル11対11。
- `味方登録を初期化`（`resetHomeBtn`）: `createDefaultHomePlayers()` を作り直し。`sentOff:false` を含める。
- `相手登録リセット`（`resetOpponentsBtn`）: `createDefaultOpponents()` を作り直し。`sentOff:false` を含める。

## 永続化・整合性

- `saveState()` は `homePlayers` / `opponentPlayers` を丸ごと保存するため、`sentOff` は自動的に保存される（payload変更は不要）。
- `sanitizeHomePlayers`: `sentOff: Boolean(player.sentOff)` を追加。さらに **`sentOff` が true なら `onField=false` を強制**。
- `sanitizeOpponents`: `sentOff: Boolean(player.sentOff)` を追加。
- `createDefaultHomePlayers` / `createDefaultOpponents`: `sentOff: false` を追加。
- `normalizeHomeFieldCount()`: 控え判定を `!onField && !sentOff` に変更し、**退場者を誤ってピッチへ昇格させない**。
- `swapHomePlayers()`: 交代先の bench に `!bench.sentOff` ガードを追加（安全策。退場者は控えリストに出ないので通常は到達しない）。
- 追加した選手フォーム（`addPlayerForm`）で作る選手にも `sentOff: false` を含める。

## 描画への波及

- `renderFieldPlayers()`: 相手は `getActiveOpponents()` を反復（退場者はトークンを描かない）。味方は `getHomeFieldPlayers()` のまま。
- `renderCounts()`: 相手カウントを `getActiveOpponents().length` に変更。スコアストリップの赤カードバッジも更新。
- `renderOpponentRoster()`: 「相手登録」リストは `getActiveOpponents()` を反復（退場中の相手は登録リストに出さず、退場リストにのみ表示）。
- `applyFormationToOpponents()`: 全件位置更新のままでOK（退場中は非表示なので影響なし）。
- `renderAll()` に `renderSentOffPanel()` を追加。
- `validateSelection()` は既存のまま（退場時に `selected=null` にするため、退場者が選択に残ることはない）。

## スタイル

`styles.css` に以下を追加（既存クラスを最大限流用）。

| クラス | 対象 | スタイル |
|---|---|---|
| `.red-card` | 赤カードバッジ | 赤い角丸の縦長方形（トランプの札状）。例: 幅約12px・高さ約16px、`background: var(--danger, #ef4444)`、`border-radius: 2px` |
| `退場させる` ボタン | 選択カード内 | 既存 `danger-button` を流用（サイズ調整が必要なら `mini-button danger`） |
| `復帰` ボタン | 退場行 | 既存 `mini-button primary` を流用 |
| `.sentoff-count`（仮） | スコアストリップの `🟥N` | 小さめ文字。0枚時は非表示 |

- pill（`味方`/`相手`）は既存 `.pill.home` / `.pill.away` を流用。

## エラー処理

- localStorage の `sentOff` が欠損・型不正でも `Boolean()` で安全に false 化する。
- 退場者ゼロ・控えゼロなど各リストの空状態は `emptyState` で表現する。
- ユーザー入力起因の失敗経路は増えない（フラグ操作のみ）。

## テスト計画

テストフレームワークは未導入のため、`node dev-server.js` で起動し Playwright でブラウザ確認する。

1. 味方をピッチ選択→`退場させる`で、フィールドから消え味方カウントが10、スコアに `🟥1`、退場リストに赤カード付きで表示される
2. 相手を選択→退場で、フィールドから消え相手カウントが10、退場リストに相手として表示される
3. 退場者は「交代」候補・控えリストに出ない（交代で戻せない）ことを確認
4. 退場リストの `復帰` で、味方は控えへ・相手はピッチへ戻り、カウントとバッジが更新される
5. リロード後も退場状態が保持される（不変条件: 退場中の味方は onField=false）
6. ボードリセットで全退場者が復帰しフル11対11に戻る
7. 「味方登録を初期化」「相手登録リセット」で退場状態がクリアされる

## 対象外（YAGNI）

- イエローカード（累積警告→退場）の管理
- 退場理由・時間の記録
- 退場者数に応じた自動再配置の提案
- 相手チームの控え・交代機能（相手は元々ピッチのみの管理）
