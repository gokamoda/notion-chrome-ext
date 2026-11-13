# 開発ガイド

Chromeに読み込むのは `extension/` です。ビルドは不要です。JavaScriptはManifestに記載した順に読み込み、各ファイルの公開部分を `NotionLinks…` 名前空間にまとめています。

## ファイルの役割

| ファイル（extension/） | 役割 |
| --- | --- |
| content.js | 起動、設定反映、ページ移動・DOM監視、非同期取得のキャンセル |
| pane-view.js | Paneの生成、セクション開閉、高さ・幅のリサイズ、一覧描画 |
| toolbar.js / ui-elements.js | 上部バーへのアイコン配置、共通DOM生成 |
| panel-style.js | Pane内のCSS |
| outline-navigation.js | 未描画の見出しへの移動、現在の見出しの強調 |
| page-snapshot.js | APIの本文構造と描画済みの編集内容を統合・保持 |
| page-data.js | 本文の分割取得、未取得の子ブロックの追加取得、取得APIの窓口 |
| page-structure.js | ブロック構造から見出し・Forward links・行番号を解析 |
| backlinks.js | リンク元の取得、親ブロックからページを特定、重複排除 |
| notion-api.js / notion-records.js | 通信・タイムアウト、Notion応答の共通処理 |
| notion-dom.js / core.js | NotionのDOM判定、URL検証・正規化 |
| decorations.js / decoration-style.js | 行番号・見出しマーカー・コードブロックの行番号の適用、対応するCSS |
| code-numbers.js | コードブロックの行の分割と、折り返し後の表示行数の計測 |
| wide-blocks.js | Paneを開いている間、表・DBビューの幅と左右の余白をPaneの分だけ縮めるCSS |
| settings.js / popup.html / popup.js | 設定の検証・保存、設定画面 |

Notionからの読み取り方法の変更は `notion-api.js`・`page-data.js`・`backlinks.js`、応答の解析変更は `notion-records.js`・`page-structure.js`、DOM変更への追従は `notion-dom.js`・`decoration-style.js` を確認してください。

## 整形・テスト

```sh
npm ci
npm run format
npm run format:check
npm test
```

Prettierは開発時の整形にだけ使用します。拡張の実行時依存、バンドラー、ビルド処理はありません。テストはNode標準のテストランナーで実行します。

ブラウザ用の既存テストはローカルサーバーから開きます。

```sh
python3 -m http.server 8765 --bind 127.0.0.1
```

- `http://127.0.0.1:8765/tests/browser.html` — DOM判定
- `http://127.0.0.1:8765/tests/integration.html` — Pane・装飾・自動取得・リサイズの結合テスト
- `http://127.0.0.1:8765/tests/panel.html` — Paneの手動確認用

これらは合成データによる検証です。実際のNotionでの動作確認とは区別してください。スクリプトを追加・分割する際はManifestとブラウザ用テストHTMLの読み込み順も更新します。

変更後は `chrome://extensions` で拡張を再読み込みし、Notionのタブも再読み込みしてください。

## GitHub Releasesへの配布

`.github/workflows/release.yml` は `v*` タグのpushで起動します。整形チェックとNodeテストを通過し、タグがManifestのバージョンと一致した場合に、`extension/` の中身だけをZIP化してReleaseへ添付します。ZIPの直下に `manifest.json` が入ります。追加のSecret設定は不要です。

例えばManifestが `1.0.0` の場合、配布したい変更をコミットしてから次を実行します。

```sh
git tag v1.0.0
git push origin v1.0.0
```

配布物は `notion-page-navigator-v1.0.0.zip` です。利用者は解凍し、`chrome://extensions` の「パッケージ化されていない拡張機能を読み込む」で、`manifest.json` のあるフォルダを選択します。同じタグのワークフローを再実行すると既存ReleaseのZIPを置き換えます。
