# Soccer Board を OSS 公開する（英日UI + GitHub Pages）設計

日付: 2026-07-04
ステータス: ブレスト完了・レビュー待ち

## 目的

サッカー戦術ホワイトボードアプリ「Soccer Board」をオープンソースとして無料公開し、認知を広げる。運用負荷は最小限（サーバーを立てず、GitHub だけで完結）に保つ。

達成条件:

1. 誰でもソースを閲覧・再利用できる公開リポジトリがある
2. 誰でもブラウザで即触れるデモURLがある
3. UIが英日で切り替えられ、グローバルの指導者/ファンにも届く
4. 追加の運用コスト・保守負荷が実質ゼロ

## 決定事項（ブレスト結果）

| 論点 | 決定 |
|---|---|
| OSS化の目的 | 無料公開して認知が広がればOK。運用負荷は最小限、宣伝も最低限 |
| リーチ（言語） | UIを英日切替。辞書は将来 es/pt など多言語を足しやすい形にする |
| i18n実装方式 | A案（自前の軽量i18n：辞書オブジェクト + `data-i18n`属性 + 切替ボタン）。ライブラリ導入(B案)・全DOM再描画への書き換え(C案)は不採用 |
| 置き場所 | GitHub リポジトリ（ソース公開）+ GitHub Pages（デモURL）。専用サーバーは立てない |
| リポジトリ名 | `soccer-tactics-board`（検索キーワードを含む） |
| ライセンス | MIT |
| 宣伝の位置づけ | READMEの見栄え・Topics・About は必須。コミュニティ投稿やawesome系PRは任意 |
| 検索・SNS共有メタ | 追加する。純粋SEOより「共有時の見栄え（OGP/Twitterカード）」を重視。メタタグ + robots.txt + sitemap.xml を最小構成で用意 |

## スコープ

### やること

- UI英日切替（i18n, A案）
- OSS衛生ファイル一式（LICENSE / README英日 / .gitignore / デモ用スクリーンショットまたはGIF）
- 検索・SNS共有メタ（メタタグ / OGP・Twitterカード / robots.txt / sitemap.xml）
- GitHub Pages でのデモ公開
- 認知プレイブックの実施（必須項目）

### やらないこと（YAGNI）

- i18nライブラリの導入、ビルドツール/バンドラの導入
- 英日以外の言語の同時実装（設計は拡張可能にするが、実装は英日のみ）
- CONTRIBUTING.md / CI / テストフレームワーク導入（目的が低負荷・認知拡大のため今回は不要）
- 専用サーバー・独自ドメイン・ホスティング契約

## i18n 設計（A案の詳細）

### 全体像

- 「ゼロ依存・ビルド不要・`index.html`を開くだけで動く」現行の思想を維持する。
- 翻訳文言を1つの辞書オブジェクトに集約し、静的テキストは属性で、動的テキストは関数で差し替える。

### 辞書構造

```js
const MESSAGES = {
  ja: { "toolbar.formation": "配置", "toolbar.apply": "反映", /* ... */ },
  en: { "toolbar.formation": "Formation", "toolbar.apply": "Apply", /* ... */ },
};
```

- キーは `領域.用途` のドット区切り（例: `toolbar.apply` / `panel.selected` / `confirm.resetHome`）。
- 将来 `es` / `pt` を足す場合は `MESSAGES` にロケールキーを1つ追加するだけ。コード本体の変更は不要（拡張性の担保）。

### 翻訳関数とフォールバック

- `t(key, vars)` を用意する。
  - 現在ロケールに該当キーがあればそれを返す。
  - 無ければ既定ロケール `ja` にフォールバックし、`console.warn` でキー欠損を通知（画面は壊さない）。
  - `vars` で `{count}` などのプレースホルダを置換（例: `ピッチ {count}` / `On pitch {count}`）。

### 静的テキスト（HTML）

- 翻訳対象の要素に `data-i18n="key"` を付与する。テキストノード用と、`placeholder` / `aria-label` 用を区別できるようにする（例: `data-i18n-attr="placeholder"` を併用、無指定なら `textContent`）。
- 対象箇所（index.html）: ブランドのタグライン、ツールバー各ボタン（配置/反映/縦横表示/5レーン/ビエルサライン/3ゾーン/ボードリセット）、味方・相手カウント、描画ツール（移動/ペン/矢印/色のaria-label/1つ戻す/全消去）、サイドパネル各見出し・ボタン・プレースホルダ（選択中/解除/交代/味方登録/番号順/No./名前/追加/味方登録を初期化/相手登録/リセット/メモ/メモのplaceholder）。
- アプリ名 "Soccer Board" はブランド名として翻訳せず固定する。

### 動的テキスト（app.js）

- `app.js` 内でハードコードされている日本語（約29箇所）を `t("key")` 経由に置換する。対象例:
  - `window.confirm` 文言（味方初期化/線の全消去/選手削除）
  - 縦表示/横表示トグルのラベル
  - トークンの `aria-label`（味方/相手 + 背番号、ボール）
  - 選択パネル・交代パネル・ロスターの各状態文言（選択なし/味方/相手/ピッチ/控え/背番号/名前/味方選手を選択/控えなし/ピッチの選手なし/交代/該当なし/選択/削除/名前未登録/相手 背番号/相手 名前 など）
  - カウント付き文言（ピッチ N / 控え N）は `t("roster.onFieldCount", { count })` のように置換

### 切替UI・永続化・言語属性

- ヘッダー（ツールバー）に言語切替コントロールを1つ追加する。`JA` / `EN` のトグル、または `<select>`。既存のボタン群と同じ見た目に合わせる。
- 選択したロケールを `localStorage` に保存（既存の保存キーの流儀に合わせる）。起動時に復元し、未保存・不正値なら既定 `ja`。
- ロケール変更時の処理:
  1. `document.documentElement.lang` を `ja`/`en` に更新
  2. `data-i18n` を持つ静的要素をすべて再翻訳
  3. 動的パネル（選択中/交代/味方ロスター/相手ロスター）を再描画し、`t()` 経由で現在ロケールの文言にする
- 言語切替でボードの状態（選手配置・描画・メモ）は保持する。翻訳は表示層のみの差し替えで、データには触れない。

### エラーハンドリング

- キー欠損時は既定ロケールにフォールバックし警告ログのみ（クラッシュさせない）。
- `localStorage` が使えない環境では、既定ロケール `ja` でメモリ上のみ動作（既存の保存処理と同じ耐性方針に合わせる）。

## OSS 衛生ファイル

- `LICENSE` … MIT。著作権表示は「YYYY <ユーザー名/ハンドル>」。
- `README.md` … 英日併記。上に英語、下に日本語。構成:
  - 冒頭にデモGIFまたはスクリーンショット
  - 一行キャッチ（例: "A zero-install, browser-only soccer tactics whiteboard."）
  - デモURL（GitHub Pages）へのリンク/ボタン
  - 機能一覧、使い方（ブラウザで開くだけ / ローカルサーバー任意）、言語切替の説明
  - ライセンス表記
- `.gitignore` … `node_modules/`・OS生成ファイル（`.DS_Store`, `Thumbs.db`）等。
- デモ資産 … 操作GIF（推奨）または `screenshot.png`。READMEの一番上に配置。

## ホスティング（GitHub Pages）

- リポジトリ直下（ルート）に `index.html` があるため、Pages のソースを「ブランチ = 公開ブランチ / フォルダ = ルート」に設定するだけで公開できる。ビルド設定は不要。
- 公開URLは `https://<ユーザー名>.github.io/soccer-tactics-board/` 形式。
- `dev-server.js` はローカル確認用に残す（READMEに用途を明記）。Pages では使われない。
- パス依存: `index.html` は `./styles.css` `./app.js` と相対パス参照のため、サブパス配信（`/soccer-tactics-board/`）でもそのまま動く。絶対パス参照を新規に増やさないこと。

## 検索・SNS共有メタ（SEO / OGP）

方針: 純粋な検索順位狙いは効きにくいツールなので、**「共有された時の見栄え（OGP）」と「クロールされる最低限の情報」**を低コストで整える。

### `<head>` に追加するメタタグ（`index.html`）

- `<title>` … 英語固定でキーワードを含む（例: `Soccer Tactics Board — free browser whiteboard`）。i18n切替の対象にはせず、SEOの一貫性のため言語に関わらず英語のまま。
- `<meta name="description">` … 一行英語説明（キーワード: soccer / football / tactics / whiteboard / formation）。
- OGP: `og:title` / `og:description` / `og:type=website` / `og:url`（Pages URL） / `og:image`（デモGIFの静止画。1200×630px 推奨、リポジトリ内の相対/絶対URL）。
- Twitter Card: `twitter:card=summary_large_image` / `twitter:title` / `twitter:description` / `twitter:image`。
- 注意: OGP/Twitter の `og:url` と `og:image` はクローラが解決できる**絶対URL**にする（相対パスは展開されない場合がある）。Pages 公開URL確定後に埋める。

### クロール補助ファイル

- `robots.txt` … 全許可 + `Sitemap:` 行（Pages URL の sitemap を指す）。
- `sitemap.xml` … トップURL 1件のみの最小構成。
- どちらもリポジトリ直下に置き、Pages のサブパスで配信されることを前提にURLを記述する。

### 静的な説明テキスト（クロール対象）

- ページ内に少量でも人間可読の説明文（アプリの用途）を残す。既存の `<h1>Soccer Board</h1>` + タグラインで最低限は満たすが、READMEにも同等の説明を置きクロール対象を確保する。

### やらないこと

- 構造化データ（JSON-LD）、多数のランディングページ、外部SEOツール導入は今回スコープ外（費用対効果が低い）。

## 認知プレイブック

労力対効果順。上から数個で十分効く。

- 必須:
  1. READMEの1画面目を魅せる（操作GIF + 一行キャッチ + デモURL）
  2. GitHub Topics 設定（例: `soccer` `football` `tactics` `whiteboard` `coaching` `vanilla-js` `no-build`）
  3. リポジトリ About 欄に一行英語説明 + デモURL
- 任意:
  4. デモURLを「使えるツール」として共有
  5. コミュニティ投稿（Reddit r/bootroom, r/coaching、国内のサッカー指導者SNS 等）
  6. awesome系リスト（awesome-selfhosted 等）へのPR

## 実装順序

1. i18n（英日切替）実装 → ローカルで動作確認
2. OSSファイル一式（LICENSE / README英日 / .gitignore）作成
3. 検索・SNS共有メタ追加（メタタグ / OGP / robots.txt / sitemap.xml）※URL依存部分は手順5でPages URL確定後に埋める
4. GitHubへpush → Pages有効化 → デモURL取得
5. OGP `og:url`/`og:image`・sitemap・README のデモURL/GIFを確定URLで反映、Topics/About設定
6. 共有時の展開を検証（後述）
7. （任意）コミュニティ投稿

## テスト・動作確認方針

- 現状テストフレームワークは無い。手動のブラウザ確認で検証する。
- 確認項目:
  - JA/EN 切替で、ツールバー・描画ツール・サイドパネルの全表示文言が切り替わる
  - リロード後も選択言語が維持される
  - 言語切替後も選手配置・描画・メモが保持される
  - 動的パネル（選択中/交代/ロスター）を操作しても現在ロケールの文言で描画される
  - EN 時に `<html lang="en">` になる
  - GitHub Pages のサブパスURLでスタイル・スクリプトが正しく読み込まれ動作する
  - デモURLを共有した時にOGP画像・タイトル・説明が展開される（Facebook Sharing Debugger / X Card Validator 等、または実際にDiscord/Slackへ貼って確認）
  - `robots.txt` / `sitemap.xml` が公開URLで200で取得できる

## 前提・未決事項

- MITの著作権者名に使うハンドル/表記は実装時に確定する。
- GitHubアカウント・リポジトリ作成は本人操作が必要（`gh` CLI 利用可なら補助可能）。
- デモGIFの作成方法（ブラウザ操作の録画）は実装フェーズで決める。
