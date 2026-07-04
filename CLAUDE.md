# Soccer Tactics Board

ブラウザだけで動くサッカー戦術ホワイトボード。登録・ビルド・依存パッケージなしの静的Webアプリ。

- 公開URL: https://yynakayama.github.io/soccer-tactics-board/
- リポジトリ: `yynakayama/soccer-tactics-board`（public）

## 構成

素のHTML/CSS/JavaScript。**フレームワーク・バンドラ・依存パッケージなし・ビルド不要**。

- `index.html` … 画面構造。`<script>` は `i18n.js` → `app.js` の順で読み込む。
- `app.js` … 状態・描画・操作のすべて。データは localStorage 保存。
- `styles.css` … スタイル。
- `i18n.js` … 英日i18n（辞書 + `t()` + `data-i18n`）。
- `dev-server.js` … ローカル確認用の簡易配信サーバー（Pagesでは未使用）。
- `docs/superpowers/specs`・`docs/superpowers/plans` … 設計スペックと実装計画。

## 起動・動作確認

- `index.html` を直接開く、または `node dev-server.js` → http://127.0.0.1:4173/
- テストフレームワークは無し。確認はブラウザで手動（Playwright可）。

## 規約

- **ゼロ依存・ビルド不要を維持**（パッケージ/バンドラを増やさない）。
- **相対パス参照を維持**（`./app.js` 等）。Pagesのサブパス配信で動くよう、絶対パスのアセット参照を増やさない。
- **i18n**: 表示文言は必ず翻訳キー経由にする。
  - 静的HTML → `data-i18n="key"`（属性を訳す場合は `data-i18n-attr="placeholder"` 等）。
  - 動的 → `t(key, vars)`（`{count}`/`{label}` 補間）。
  - `<kbd>` 入りボタンはラベルだけ `<span data-i18n>` で包む（textContent直書きは kbd を消すので不可）。
  - 辞書 `MESSAGES.ja` / `.en` はキー一致を保つ（`assertLocaleParity` が警告）。文言を足したら両言語に追加。
  - 言語切替時は `renderAll()` + ヘッダー/パネルのaria更新が走る（`registerLocaleChange` に登録済み）。
- **既存機能を壊さない**: フォーメーション反映／ペン・矢印描画／戦術ガイド（5レーン・ビエルサライン・3ゾーン）／退場／ヘッダー折りたたみ／サイドパネルのドロワー／キーボードショートカット／盤面フィット／ダブルタップ。

## デプロイ（GitHub Pages）

- public リポジトリの **main / ルート** を Pages が配信（静的なのでビルド設定なし）。`main` に push すれば数分で反映。
- **push の注意**: 自動実行モードは `main`（デフォルトブランチ）への直pushを拒否する。push は人が実行する:
  ```powershell
  git push origin main
  ```
  PowerShell 5.1 では `&&` が使えないので、複数コマンドは**行を分ける**こと。

## これからの作業（整備・改修）

整備TODO（次回以降）:
- URLプレースホルダ `GITHUB_USERNAME` → `yynakayama` 置換（`index.html` のOGP/meta・`robots.txt`・`sitemap.xml`）
- `README.md` を英日併記に刷新（デモURL・機能・スクショ）
- `assets/screenshot.png` を配置し OGP画像に反映
- ランドマークaria-label 7個の翻訳（`nav.*` キーを追加）
- GitHub の Topics / About（デモURL）設定

改修の進め方:
- 機能追加は spec → plan → 実装 の流れ（Superpowers）。設計は `docs/superpowers/` に残す。
- 文言を追加/変更したら i18n 辞書（ja/en 両方）と `data-i18n` / `t()` を必ず更新する。
