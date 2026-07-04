# タッチ操作の磨き込み（ダブルタップ判定・タップハイライト） — 設計

作成日: 2026-07-04

## 背景・目的

スマホ実機で「選手トークンをダブルタップしても管理パネルが開かない」「トークンをタッチ
すると周囲に青い四角が出る」という2点のフィードバックがあった。Playwright による実測で
根本原因を切り分けた結果、**独立した2つの問題**であることが確定した。

### 問題1: ダブルタップでパネルが開かない（機能バグ）

- 選手トークンは `<button>`。`startDrag`（pointerdown）で即 `selectPlayer()` が走り、
  `endDrag`（pointerup）で移動を伴わないタップのみ `registerTokenTap()`（ダブルタップ判定→
  パネルオープン）が走る。
- タップ/ドラッグの判別しきい値が `moveDrag` 内で **`> 2px`** と小さすぎる。指のタッチは
  接地点が数px揺れるため、揺れが 2px を超えると `activeDrag.moved = true` となり、
  `registerTokenTap()` が呼ばれない → ダブルタップが成立しない。
- 選択は pointerdown で走るため揺れと無関係 →「選択はできるがパネルが開かない」症状に一致。
- Playwright 実測（デスクトップ Chromium・合成 pointer イベント）で境目を確認:

  | タップの揺れ | 結果 |
  |---|---|
  | 0 / 1 / 2px | パネル OPENS |
  | 3px 以上 | パネル FAILS |

  実際の指タップの揺れは 4〜10px が普通（プラットフォーム標準の touch slop も
  Android ≈ 8dp / iOS ≈ 10pt）。よってしきい値を 3 に上げるだけでは不十分。

### 問題2: タッチ時の青い四角（見た目のみ）

- CSS のどこにも `-webkit-tap-highlight-color` を設定しておらず、ブラウザ既定の
  **タップハイライト**（タップ可能要素にモバイルが被せる標準オーバーレイ）が出ている。
  実測で `.player-token` の `webkitTapHighlightColor` は既定値 `rgba(0,0,0,0.18)` のまま。
- マウスには「タップ」がないため PC では出ない。要素の矩形に沿うので「青い四角」に見える。
- これは**描画上のオーバーレイ**で pointer イベントや `moved` 判定には一切関与しない。
  問題1（タップハイライトの無い合成イベント環境）でも同じ失敗が再現したことから、
  **問題1の原因ではない**ことが確定している。両者は独立。

## スコープ

1. タップ/ドラッグ判別しきい値を `event.pointerType` で分岐（マウス=2px、タッチ/ペン=10px）。
2. しきい値未満の微小移動ではトークンを動かさない（タップのたびの微ズレを解消）。
3. タップ可能要素のタップハイライトを透明化（`-webkit-tap-highlight-color: transparent`）。

### 非スコープ（YAGNI）

- 「パネルを開くジェスチャ」の仕様変更（ダブルタップ→単タップ／長押し等）。今回は
  **既存のダブルタップを確実に動かす**ことに集中し、ジェスチャ自体は変えない。
- 選手トークン／方向ハンドルのサイズ変更。
- ドラッグ開始時に slop 分のオフセットを差し引く追従補正（体感差は僅少、過剰実装）。

## 機能仕様

### ① しきい値の pointerType 分岐

- `startDrag` で `activeDrag` に **`pointerType: event.pointerType`** を保持する。
- `moveDrag` の判別しきい値（slop）を分岐:
  - `pointerType === "mouse"` → **2px**（従来どおり。精密で誤爆しない）。
  - それ以外（`"touch"` / `"pen"` / 空文字・未定義）→ **10px**（安全側に倒す）。
- slop を超えるまでは `activeDrag.moved` を `false` に保つ。超えた時点で `moved = true`。
- 結果、10px 以内の指の揺れはタップとして扱われ、`registerTokenTap()` が走り
  ダブルタップでパネルが開く。マウスは 2px のまま変わらない。

### ② 微小移動ではトークンを動かさない

- 現状の `moveDrag` は毎回 `player.x/y` を更新しトークンを再配置するため、slop 未満の
  揺れでもコマが僅かにズレる（in-memory state が変わり、その位置で再描画される）。
- **slop を超えるまでは位置更新・再配置を行わない**よう `moveDrag` を早期 return する。
  - slop 内: 何もしない（タップ候補として保持）。
  - slop 超過: `moved = true` にしてから位置反映（従来の移動処理）。
- これによりダブルタップ成立と「タップのたびの微ズレ解消」を同一修正で満たす。
- 副作用: ドラッグ開始時、slop（最大10px）分だけ初期ジャンプが生じるが、一般的な
  ドラッグしきい値挙動であり許容範囲。

### ③ タップハイライトの透明化

- タップ可能要素に `-webkit-tap-highlight-color: transparent;` を指定して青い四角を消す。
- 適用範囲は **`html` に1ルール**置く（`-webkit-tap-highlight-color` は継承するため、
  ルートに置けば全要素に波及し、要素ごとの列挙が不要）。
- キーボード操作者向けの金色フォーカス枠（既存 `:focus-visible` outline）は**残る**ので
  アクセシビリティは損なわない。選択中トークンは既存 `.selected` スタイルで視覚フィード
  バックが得られるため、タップハイライト除去による操作感の劣化はない。

## 実装ポイント（既存コードへの接続）

### app.js

- `startDrag`（現行 L818付近）: `activeDrag` オブジェクトに `pointerType: event.pointerType`
  を追加。
- `moveDrag`（現行 L842付近）: 先頭で slop を算出
  （`const slop = activeDrag.pointerType === "mouse" ? 2 : 10;`）。
  `activeDrag.moved` が未成立かつ両軸とも slop 以内なら早期 return。slop を超えたら
  `activeDrag.moved = true` にして従来どおり位置反映・`dragging` 付与。
  - 既存の `> 2` 固定判定は撤去し、上記 slop ベースに置換。
- `endDrag` / `registerTokenTap` は変更なし（`moved` の意味は同一）。ボールは従来どおり
  `registerTokenTap` の対象外。

### styles.css

- `html { -webkit-tap-highlight-color: transparent; }` を1ルール追加（継承で全体に波及）。
- 既存の `:focus-visible` outline・`.selected` スタイルはそのまま。

## テスト方針

手動確認（Playwright）:

- しきい値スイープ（合成 pointer イベント）で、**touch 相当は 10px 以内の揺れでダブル
  タップがパネルを開く**こと、mouse 相当（2px）は従来どおりであることを確認。
  - 具体的には `moveDrag` が pointerType を見て分岐するため、`PointerEvent` の
    `pointerType: "touch"` で 3〜10px 揺らしても OPENS、11px 以上で FAILS（=ドラッグ）
    になることを確認。`pointerType: "mouse"` は 3px で FAILS のまま（従来挙動維持）。
- 微小タップ後にトークン座標が変化しない（微ズレが出ない）ことを確認。
- スマホ幅（例 390×844）で `.player-token` の `-webkit-tap-highlight-color` が
  `transparent`（`rgba(0,0,0,0)`）になっていることを実測で確認。
- 既存機能の非回帰: 通常ドラッグでの移動、方向ハンドルでの回転、矢印キー nudge、
  ロスター行タップでの選択、キーボードフォーカス枠（金色）が維持されること。

## エッジケース

- `event.pointerType` が空文字/未定義の環境（古い実装）でも、mouse 以外は 10px 側に
  倒れるため誤ドラッグしにくい安全側の挙動になる。
- マウスの意図的な小ドラッグ（2px超）は従来どおり移動として扱われる（挙動不変）。
- ボールトークンは double-tap 対象外だが、しきい値分岐・微ズレ抑制は同様に効く（無害）。
- タッチデバイスでの意図的ドラッグは常に 10px を大きく超えるため、移動が阻害されない。

## 実装後の発見と追加修正（2026-07-04）: タッチ互換clickによる即クローズ

しきい値修正をデプロイしても実機（スマホ）でダブルタップが効かないという報告を受け、
Playwright の**実タッチ・エミュレーション（`hasTouch`/`isMobile`, DPR3）**で
イベント列を計測したところ、しきい値とは**別の根本原因**が判明した。

**症状の真相**: ダブルタップ自体は成立して `setPanelOpen(true)` でパネルは開いている。
しかしタッチでは、ブラウザが各タップの後に**同じ座標へ遅延した互換 `click`**（`MouseEvent`、
`pointerType: "touch"`）を発行する。2タップ目で開いた瞬間に画面を覆う**スクリム
（`.panel-scrim`）がその座標の最前面に来る**ため、遅延 click がスクリムにヒットテストされ
`setPanelOpen(false)` を呼び、開いた約2ms後に閉じていた（計測値: open t=310 → scrim click
t=312 → close t=312）。

- **PCで再現しない理由**: マウスの `click` は押下要素（トークン）へ配送されるため、後から
  現れたスクリムには当たらない。タッチの互換 click は発行時点の最前面要素へヒットテスト
  されるためスクリムに当たる。これが「PCでは動くがタッチでは動かない」の正体。
- **注意**: `touch-action: none`（トークンに設定済み）でも互換 click は抑止されない。
  `pointerdown`/`pointerup` への `preventDefault()` でも互換 click は止まらない。

**追加修正**: `setPanelOpen(true)` の時刻を `panelOpenedAt` に記録し、スクリムの click
ハンドラで **開いた直後（< 450ms）の click を無視**する。これによりゴーストクリックによる
即クローズを防ぐ。ガード窓を過ぎた通常のスクリムタップでの明示クローズは従来どおり有効。

**検証（実タッチ・エミュレーション）**:
- タッチのダブルタップ → 開いて維持（open 後の scrim ゴーストclickを無視）。
- ガード窓経過後のスクリムタップ → 正常にクローズ。
- PC 実マウス: ダブルクリックで開く／単クリックでは開かない（非回帰）。

**教訓**: 合成 `PointerEvent` の dispatch では互換 click が発生しないため、この不具合は
すり抜けた。タッチ操作の検証は `hasTouch` を有効にした実タッチ・エミュレーション
（`page.touchscreen.tap`）で行うこと。
