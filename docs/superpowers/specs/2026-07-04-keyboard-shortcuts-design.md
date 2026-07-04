# キーボードショートカット設計

日付: 2026-07-04
ステータス: ブレスト完了・レビュー待ち

## 目的

作戦盤の主要操作をキーボードから素早く行えるようにする。マウス／タッチでのボタン操作に加えて、描画ツールの切替（移動・ペン・矢印）、ボードリセット、描画の取消、選択解除をキー一発で実行できるようにし、盤面を動かしながらの操作テンポを上げる。

## 決定事項（ブレスト結果）

| 論点 | 決定 |
|---|---|
| ツール切替の割り当て方式 | 単キー（文字）。V=移動 / P=ペン / A=矢印 |
| 追加で割り当てる操作 | 1つ戻す（Ctrl+Z）と 選択解除（Esc）のみ。色切替・縦表示トグルは今回入れない |
| ボードリセットのキー | R。確認ダイアログは追加せず、既存ボタンと同じく即実行 |
| 発見性（キーの気づかせ方） | 対象ボタンのラベルにキーを常時表示する |
| 矢印キー | 既存の選手ニアッジ（`nudgeSelectedPlayer`）専用のまま。今回のショートカットには使わない |

## キーマッピング

| キー | 操作 | 呼び出す処理 |
|---|---|---|
| `V` | 移動ツール | `setDrawTool("move")` |
| `P` | ペンツール | `setDrawTool("pen")` |
| `A` | 矢印ツール | `setDrawTool("arrow")` |
| `R` | ボードリセット | `resetBoard()`（確認なし・即実行） |
| `Ctrl+Z` / `Cmd+Z` | 1つ戻す（直近の描画を取消） | `undoDrawing()` |
| `Esc` | 選択解除 | `clearSelection()` |

- 文字キーは大文字・小文字どちらでも動作する（Shift併用時も可）。
- `Ctrl+Z` は Mac の `Cmd+Z`（metaKey）も同一に扱う。Redo（Ctrl+Shift+Z）は今回対象外。

## 発火条件（ガード）

グローバルな `window` の `keydown` リスナー1つ（`handleShortcut`）で判定する。以下の条件を満たすときのみショートカットを実行する。

1. **入力欄では発火しない** — `event.target` が `INPUT` / `TEXTAREA` / `SELECT`、または `isContentEditable` の要素の場合はスキップ。これによりメモ欄・選手名/番号入力欄・配置selectでの文字入力やキー操作を一切妨げない（「メモにR」「名前にV」を打っても盤面に影響しない）。
2. **Ctrl+Z も入力欄では無効** — メモ欄などにフォーカス中の `Ctrl+Z` はブラウザ標準のテキストundoに委ねる（描画undoは走らせない）。入力欄外の `Ctrl+Z` のみ `undoDrawing()` を実行し、`event.preventDefault()` する。
3. **単キー（V/P/A/R/Esc）は修飾キーなしのときだけ発火** — `ctrlKey` / `metaKey` / `altKey` のいずれかが押されている場合は無視する（`Ctrl+Z` だけは上記の別分岐で処理）。`shiftKey` は問わない。
4. **IME変換中は無視** — `event.isComposing` が true のときはスキップ。
5. **選手ニアッジとの非競合** — 既存の `nudgeSelectedPlayer` はトークン（div）フォーカス時に矢印キーだけを処理し、それ以外のキーは `preventDefault` せずバブリングさせる。今回のショートカットは矢印キーを使わないため競合しない。トークンフォーカス中に V/P/A/R/Esc を押すと、バブリングした `keydown` を `window` 側で受けて正しく発火する（トークンは入力欄ではないためガード1に掛からない）。

判定順序（擬似コード）:

```
handleShortcut(event):
  if event.isComposing: return
  isTextField = target が INPUT/TEXTAREA/SELECT または isContentEditable

  // Undo（Ctrl/Cmd+Z、Shift/Alt なし）
  if (event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey && key.toLowerCase()==="z":
    if isTextField: return          // 標準のテキストundoに任せる
    preventDefault(); undoDrawing(); return

  // 単キー系
  if event.ctrlKey || event.metaKey || event.altKey: return
  if isTextField: return
  switch key:
    "v"/"V": setDrawTool("move")
    "p"/"P": setDrawTool("pen")
    "a"/"A": setDrawTool("arrow")
    "r"/"R": resetBoard()
    "Escape": clearSelection()
    else: return
  preventDefault()
```

## コード構造

- `bindEvents()` の末尾に `window.addEventListener("keydown", handleShortcut)` を1行追加する（バブリング phase でよい）。
- ボタン押下とショートカットで**処理を単一情報源にする**ための小さなリファクタを行う:
  - `undoDrawing()` を新設し、現在 `els.undoDrawBtn` のクリックハンドラにインラインで書かれている undo 処理（`state.drawings` の pop → `saveState()` → `renderDrawings()`、空なら何もしない）を移す。ボタンとショートカット双方がこれを呼ぶ。
  - `clearSelection()` を新設し、現在 `els.clearSelectionBtn` のクリックハンドラにインラインで書かれている選択解除処理（`state.selected = null` → 選択/交代/ロスター各パネル再描画 → `syncSelectedTokens()`）を移す。ボタンと Esc 双方がこれを呼ぶ。
  - `setDrawTool()` / `resetBoard()` は既存関数をそのまま呼ぶ（変更不要）。
- `handleShortcut` はこれらの共通関数を呼ぶだけにし、保存・再描画の経路はボタン押下時と完全に同一にする。

## UI仕様（キーの常時表示）

対象ボタンのラベル末尾に、割り当てキーを小さなバッジ（`<kbd>`）として常時表示する。

| ボタン | id | 表示 |
|---|---|---|
| 移動 | `#toolMoveBtn` | 移動 `V` |
| ペン | `#toolPenBtn` | ペン `P` |
| 矢印 | `#toolArrowBtn` | 矢印 `A` |
| ボードリセット | `#resetBoardBtn` | ボードリセット `R` |
| 1つ戻す | `#undoDrawBtn` | 1つ戻す `Ctrl+Z` |
| 解除（選択解除） | `#clearSelectionBtn` | 解除 `Esc` |

- マークアップ例: `<button id="toolMoveBtn" ...>移動 <kbd class="kbd-hint">V</kbd></button>`
- 色スウォッチ・全消去・配置select・ガイドトグル（縦表示/5レーン/ビエルサライン/3ゾーン）にはキーを付けない（今回ショートカット未割当のため）。
- アクセシビリティ: 各対象ボタンに `aria-keyshortcuts` 属性を付与する（例 `aria-keyshortcuts="v"`、undoは `"Control+z"`、解除は `"Escape"`）。支援技術にショートカットを正しく伝えるため。
- モバイル幅では既存どおりツールバーが折り返す。`kbd` バッジは短いためレイアウトを崩さない。

## スタイル

`styles.css` に `.kbd-hint` クラスを追加する。

| クラス | スタイル方針 |
|---|---|
| `.kbd-hint` | ラベル文字より一回り小さいフォント、控えめな枠線＋薄い背景の小さなピル。ラベル文字色より低コントラストにして主従を保つ。`margin-left` で本文と間隔を空ける。`pointer-events: none` で装飾扱い |

- ツールボタンが押下状態（`aria-pressed="true"` / `is-active`）のときも `kbd-hint` が視認できる配色にする。
- 既存のボタン配色トークン（`var(--ink)` 等）を流用し、新規の色定義は最小限にする。

## エラー処理

- ガードにより、テキスト入力・IME変換・修飾キー付き入力では誤発火しない。
- `undoDrawing()` は `state.drawings` が空なら何もしない（既存挙動を踏襲）。
- `resetBoard()` は既存の即実行仕様のまま（確認ダイアログは追加しない、というブレスト決定）。
- ユーザー入力起因で例外が発生する経路はない（キー分岐は固定の switch）。

## テスト計画

テストフレームワークは未導入のため、Playwright によるブラウザ確認で検証する。

1. フィールド上（入力欄外）で `V`/`P`/`A` を押すと、該当ツールボタンが `aria-pressed="true"` になり `draw-mode` が切り替わること。
2. `R` を押すと盤面がリセットされること（配置が初期化され、描画・メモが消える。ボタン押下と同結果）。
3. 描画を1本引いた後、入力欄外で `Ctrl+Z` を押すと直近の1本だけ消えること。空の状態で押しても何も起きないこと。
4. 選手を選択した状態で `Esc` を押すと選択が解除されること（選択パネル・トークンのハイライトが解除）。
5. **入力欄ガード**: メモ欄にフォーカスして `v` `r` `a` `p` を打っても文字がそのまま入力され、盤面・ツールは変化しないこと。選手名/番号入力欄・配置selectでも同様。
6. **Ctrl+Z のすみ分け**: メモ欄フォーカス中の `Ctrl+Z` はテキストの取消に効き、描画undoは走らないこと。入力欄外の `Ctrl+Z` は描画undoに効くこと。
7. トークン（選手）にフォーカスがある状態でも `V/P/A/R/Esc` が発火し、矢印キーは従来どおり選手移動として機能すること（競合しない）。
8. 各対象ボタンにキーバッジが表示され、押下状態でも視認できること。

## 対象外（YAGNI）

- 色切替（1/2/3/4）・縦表示トグル・ガイドトグルへのショートカット割り当て（ブレストで今回見送りと決定）。
- Redo（Ctrl+Shift+Z）、全消去のショートカット。
- キー割り当てのユーザーカスタマイズ、ヘルプ／チートシート表示。
- ボードリセットの確認ダイアログ追加（現状の即実行を維持する決定）。
