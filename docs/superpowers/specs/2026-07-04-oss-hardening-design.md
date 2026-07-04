# OSS環境の総合整備（公開品質の底上げ）設計

日付: 2026-07-04
ステータス: ブレスト完了・レビュー待ち

## 目的

OSSとして公開済みの Soccer Tactics Board を、「共有した時に壊れていない・触った時に完成度が高い・貢献を招ける」状態に引き上げる。プロジェクトの核である **ゼロ依存・ビルド不要・低運用負荷** を維持したまま、公開品質の底上げを行う。

達成条件:

1. デモURLを共有した時、OGP/Twitterカードが正しく展開される（現状は壊れている）
2. README・favicon・PWA が揃い、製品として第一印象が整う
3. オフラインでも動作し、ホーム画面にインストールできる
4. Issue/貢献の受け皿（コミュニティ標準ファイル）がある
5. 追加の運用負荷が実質ゼロ（CIは導入しない／Service Workerは版数バンプ不要の戦略にする）

## 前提（現状の棚卸し）

すでに存在: MIT `LICENSE` / `.gitignore` / `robots.txt` / `sitemap.xml` / OGP・Twitterメタ（index.html）/ 英日i18n / GitHub Pages公開 / `CLAUDE.md`。

現状の問題:

- **`GITHUB_USERNAME` プレースホルダが未置換**（`index.html` のOGP×2 / `robots.txt` / `sitemap.xml`）。公開デモは動作するが、共有時の `og:image` / `og:url` が存在しないドメインを指す＝カードが壊れる。
- `README.md` が旧版（英語なし・デモURLなし・スクショなし）。
- `assets/screenshot.png` が未配置 → `og:image` が404。
- favicon / PWA / theme-color が一切ない。
- コミュニティ標準ファイル（Issue/PRテンプレ・CONTRIBUTING・CoC・SECURITY）がない。
- ランドマーク `aria-label` 7個が日本語ハードコード（i18n未対応）。

## スコープ

### やること（Phase順）

**Phase 0 — "壊れ"修正（ブロッカー・最優先）**
- `GITHUB_USERNAME` → `yynakayama` を全置換（`index.html` OGP×2 / `robots.txt` / `sitemap.xml`）。
- デモ資産を配置: `assets/screenshot.png`（1200×630、実アプリ画面をPlaywrightでキャプチャ）。
- `README.md` を英日併記に刷新（下記「README」節）。

**Phase 1 — ユーザー体験**
- favicon一式 + `theme-color`（下記「アイコン」節）。
- PWA: `manifest.webmanifest` + Service Worker によるオフライン動作（下記「PWA」節）。

**Phase 2 — コミュニティ標準（軽量版）**
- `.github/ISSUE_TEMPLATE/`（`bug_report.md` / `feature_request.md`）+ `.github/PULL_REQUEST_TEMPLATE.md`。
- `CONTRIBUTING.md`（最小・英日）/ `CODE_OF_CONDUCT.md`（Contributor Covenant 2.1）/ `SECURITY.md`。
- ランドマーク `aria-label` 7個を `nav.*` キーで i18n 化（ja/en 両辞書に追加、`data-i18n-attr` で配線）。

**Phase 3 — 品質**
- `.editorconfig`（依存ゼロで整形の一貫性）。
- `CHANGELOG.md`（Keep a Changelog形式）+ `v1.0.0` の git タグ / GitHub Release。
- README バッジ（License / Demo / Pages）。

**Phase 4 — 公開設定（本人操作）**
- GitHub Topics（例: `soccer` `football` `tactics` `whiteboard` `coaching` `vanilla-js` `no-build` `pwa`）。
- About欄に一行英語説明 + デモURL。
- OGPカード展開の実地検証（後述）。

### やらないこと（YAGNI / 思想維持）

- **CI（GitHub Actions）は導入しない**。低運用負荷を優先。品質チェックは `.editorconfig` と手動ブラウザ確認で担保。
- 依存パッケージ・バンドラ・テストフレームワークの追加はしない。
- 外部アナリティクス（ネットワーク送信が発生しオフライン思想と衝突するため不採用）。
- JSON-LD構造化データ（ROI低）。
- 英日以外の言語の実装（辞書拡張は容易な設計を維持するが今回は追加しない）。

## PWA（オフライン対応）設計

方針: オフラインを付けても **「deploy毎の版数バンプ」を不要にする**。これが低運用負荷の肝。

### manifest.webmanifest
- `name`: "Soccer Tactics Board" / `short_name`: "Soccer Board"。
- `start_url`: `./`（相対。Pagesサブパス配信で動くこと）、`scope`: `./`、`display`: `standalone`。
- `background_color` / `theme_color`: `#277747`（フィールド緑）。
- `icons`: 192 / 512 / maskable-512（下記アイコン節）。
- `lang`: `ja`（起動時のロケール復元はアプリ側が担うため参考値）。
- `index.html` の `<head>` に `<link rel="manifest" href="./manifest.webmanifest">` と `<meta name="theme-color" content="#277747">` を追加。

### Service Worker（`sw.js`）
- 登録: `app.js` 末尾で `navigator.serviceWorker.register('./sw.js')`（存在時のみ、失敗は握りつぶす＝既存の耐性方針に合わせる）。相対パス登録でサブパス配信に対応。
- **キャッシュ戦略 = network-first + キャッシュフォールバック**:
  - `install`: アプリシェル（`./`, `index.html`, `styles.css`, `app.js`, `i18n.js`, `manifest.webmanifest`, アイコン群）を precache。`self.skipWaiting()`。
  - `activate`: 単一キャッシュ名以外の旧キャッシュを削除。`clients.claim()`。
  - `fetch`（同一オリジンGETのみ）: まずネットワーク取得を試み、成功したらレスポンスをキャッシュへ書き戻して返す。ネットワーク失敗時のみキャッシュから返す。
- 効果: **オンライン時は常に最新**（版数バンプ不要でユーザーに更新が届く）、**オフライン時のみキャッシュ描画**。cache-first固定（更新が届かず版数管理必須）は不採用。
- キャッシュ名は単一の固定文字列でよい（network-firstのため中身は自動で新しくなる）。

## アイコン設計

- ソース画像は **生成AIで作成**（別途プロンプトを用意済み。緑ピッチ＋白ライン＋青赤ドット＋白矢印、または濃紺版）。
- 1枚（1024×1024・正方形・塗り背景）から以下を書き出してリポジトリ直下に配置:
  - `favicon.svg`（またはフォールバックに `favicon.ico` 32/16）
  - `apple-touch-icon.png`（180×180）
  - `icon-192.png` / `icon-512.png` / `icon-maskable-512.png`
- `index.html` `<head>` に配線: `icon`（svg）/ `apple-touch-icon` / `manifest`（icons参照）/ `theme-color`。
- 重要モチーフは中央80%の安全域に収める（maskableクロップ対策）。透過ではなく塗り背景（apple-touch / maskable が透過不可のため）。

## README（英日併記）設計

- 構成（上に英語、下に日本語）:
  1. 冒頭にデモスクリーンショット（`assets/screenshot.png`）。
  2. 一行キャッチ（例: "A zero-install, browser-only soccer tactics whiteboard."）。
  3. バッジ行（License MIT / Live Demo / GitHub Pages）。
  4. **Live Demo** リンク（`https://yynakayama.github.io/soccer-tactics-board/`）。
  5. Features（フォーメーション反映／ドラッグ移動／ペン・矢印描画／戦術ガイド／退場／英日切替／オフライン・インストール可）。
  6. Usage（`index.html` を開くだけ / 任意で `node dev-server.js`）。
  7. Tech（vanilla HTML/CSS/JS・ゼロ依存・ビルド不要）。
  8. License（MIT）。
- 既存の短い日本語READMEは英日構成へ置換。

## コミュニティ標準ファイル設計

- `.github/ISSUE_TEMPLATE/bug_report.md`・`feature_request.md`: 最小の見出し（再現手順 / 期待 / 実際 / 環境、または 提案 / 動機）。英語ベース。
- `.github/PULL_REQUEST_TEMPLATE.md`: 概要 / 変更点 / 動作確認（ブラウザ手動）チェックリスト。
- `CONTRIBUTING.md`: ゼロ依存・ビルド不要の原則、i18n辞書（ja/en両方）更新ルール、相対パス維持、`index.html`を開くだけの確認手順を最小記載。英日。
- `CODE_OF_CONDUCT.md`: Contributor Covenant 2.1（連絡先はGitHub Issues/Discussions経由）。
- `SECURITY.md`: **個人・社用メールは記載しない**。GitHubの「Private vulnerability reporting」有効化を前提に、そこ or Issues への報告を案内。

## i18n（nav.* aria）設計

- 対象: ランドマーク7個の `aria-label`（例: `<main>` / `<section aria-label="サッカーフィールド">` / サイドパネル等の日本語ハードコード）。
- `MESSAGES.ja` / `.en` に `nav.*` キーを追加（キー一致を保つ＝`assertLocaleParity` 準拠）。
- 静的HTMLは `data-i18n` + `data-i18n-attr="aria-label"` で配線。言語切替時に `renderAll()` 経由で更新されることを確認。
- 既存の言語切替時aria更新（`registerLocaleChange`）と整合させる。

## エラーハンドリング / 互換性

- Service Worker 未対応・登録失敗時: 通常のWebアプリとしてそのままフォールバック（`register` を try/存在チェックで囲む）。
- `manifest` / アイコン欠損はアプリ動作に影響しない（プログレッシブエンハンスメント）。
- 相対パス参照を維持し、Pagesサブパス（`/soccer-tactics-board/`）でSW・manifest・アイコンが解決できること。

## テスト・動作確認方針（手動 + Playwright）

- OGP: プレースホルダ置換後、`og:url` / `og:image` が絶対URLで正しいこと。Discord/Slack貼付 or カードバリデータで展開確認。`assets/screenshot.png` が公開URLで200。
- favicon: タブにアイコン表示。`apple-touch-icon` 参照が200。
- PWA: Lighthouse/DevToolsで manifest 認識・インストール可能。**オフライン（DevToolsのOffline）でリロードしても描画される**。オンライン復帰後にファイルを更新→再訪で最新が反映される（network-first検証）。
- i18n: EN/JA切替でランドマーク `aria-label` も切り替わる。`assertLocaleParity` 警告なし。
- `robots.txt` / `sitemap.xml` が公開URLで200・正しいドメイン。
- 既存機能の非退行: フォーメーション反映／描画／戦術ガイド／退場／ヘッダー折りたたみ／ドロワー／ショートカット／盤面フィット／ダブルタップ。

## 実装順序

1. Phase 0（置換・スクショ・README）
2. Phase 1（favicon配線・manifest・SW）
3. Phase 2（コミュニティ標準・nav.* i18n）
4. Phase 3（editorconfig・CHANGELOG・タグ・バッジ）
5. Phase 4（Topics/About・OGP検証）※本人操作

## 未決事項 / 前提

- アイコンのソース画像は生成AIの出力を採用（緑版／濃紺版のどちらを正にするかは出力を見て確定）。
- `v1.0.0` タグ付け・Release作成・Topics/About・Private vulnerability reporting有効化・`main`へのpushは本人操作（自動実行モードはmain直pushを拒否）。
- OGP用スクショの撮影構図（初期配置＋戦術ガイド表示など見栄えする状態）は実装時に確定。
