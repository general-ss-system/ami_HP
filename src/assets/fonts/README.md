# フォント

魔導太丸ゴシック（Madou Futo Maru Gothic）。

- 配布元: https://booth.pm/ja/items/2993682 （TTF 版、無料）
- 利用条件: Web フォントとしての利用に問題が無いことを確認済み（2026-09-25）。
- 配信するファイル: `MadouFutoMaruGothic.woff2`（全グリフ、約 400KB）
- 元の TTF: `design-src/fonts/MadouFutoMaruGothic.ttf`（配信しない）
- 置き場所: `src/assets/fonts/`（公開先のベースパスをビルド時に解決させるため public ではなくここに置く）
- 読み込みの指定: `src/styles/global.css` の `@font-face` と `src/layouts/BaseLayout.astro` の preload

## woff2 の作り直し

```bash
pip install fonttools brotli
python -c "from fontTools.ttLib import TTFont; f=TTFont('design-src/fonts/MadouFutoMaruGothic.ttf'); f.flavor='woff2'; f.save('src/assets/fonts/MadouFutoMaruGothic.woff2')"
```
