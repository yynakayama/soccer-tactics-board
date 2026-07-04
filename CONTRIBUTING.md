# Contributing

Thanks for your interest in Soccer Tactics Board! This is a deliberately tiny,
zero-dependency project. Please keep contributions aligned with these principles.

## Principles

- **Zero dependencies, no build step.** Plain HTML/CSS/JavaScript only — no
  frameworks, bundlers, package managers or generated files.
- **Relative asset paths.** Reference files as `./app.js`, `./assets/…` so the app
  keeps working from the GitHub Pages sub-path. Don't add absolute-URL assets.
- **Bilingual UI.** All user-facing text goes through i18n keys. When you add or
  change text, update **both** `MESSAGES.ja` and `MESSAGES.en` in `i18n.js`
  (keys must match — `assertLocaleParity` warns in the console otherwise).
  Static HTML uses `data-i18n` (with `data-i18n-attr` for attributes); dynamic
  text uses `t(key, vars)`.
- **Don't break existing features:** formation apply, pen/arrow drawing, tactical
  guides (5 lanes / Bielsa line / thirds), sent-off, header collapse, side-panel
  drawer, keyboard shortcuts, board fit and double-tap.

## How to run and verify

There is no test framework — verify manually in a browser:

1. Open `index.html` directly, or run `node dev-server.js` and open
   `http://127.0.0.1:4173/`.
2. Confirm your change works, the browser console is free of errors, and there is
   no `[i18n] key parity mismatch` warning.
3. Switch EN/JA and confirm any text you touched is translated both ways.

## Pull requests

Keep PRs small and focused. Fill in the PR template checklist. That's it — thank you!

---

# コントリビューションガイド

Soccer Tactics Board への貢献に興味を持っていただきありがとうございます。
本プロジェクトは意図的に小さく、依存ゼロで保っています。以下の原則に沿ってご協力ください。

## 原則

- **ゼロ依存・ビルド不要。** 素の HTML/CSS/JavaScript のみ。フレームワーク・
  バンドラ・パッケージ・生成物は追加しません。
- **相対パス参照を維持。** `./app.js` や `./assets/…` のように参照し、GitHub Pages
  のサブパス配信で動くようにします。絶対URLのアセット参照は増やさないでください。
- **英日UI。** 表示文言は必ず i18n キー経由にします。文言を追加・変更したら
  `i18n.js` の `MESSAGES.ja` と `MESSAGES.en` の**両方**を更新してください
  （キー一致が必須。ずれると `assertLocaleParity` がコンソールに警告します）。
  静的HTMLは `data-i18n`（属性は `data-i18n-attr`）、動的は `t(key, vars)`。
- **既存機能を壊さない:** フォーメーション反映／ペン・矢印描画／戦術ガイド
  （5レーン・ビエルサライン・3ゾーン）／退場／ヘッダー折りたたみ／サイドパネルの
  ドロワー／キーボードショートカット／盤面フィット／ダブルタップ。

## 動作確認の方法

テストフレームワークはありません。ブラウザで手動確認してください:

1. `index.html` を直接開く、または `node dev-server.js` を実行して
   `http://127.0.0.1:4173/` を開く。
2. 変更が動作し、コンソールにエラーや `[i18n] key parity mismatch` の警告が
   出ないことを確認する。
3. EN/JA を切り替え、触った文言が両言語で翻訳されることを確認する。

## プルリクエスト

PR は小さく焦点を絞ってください。PRテンプレートのチェックリストを埋めてください。
ご協力ありがとうございます！
