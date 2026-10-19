# エージェント向け指示

## JS 修正時の手順

JS ファイルを修正した場合は、以下を自動的に実行してください：

1. `room/index.html` のスクリプトタグの日付を修正する
2. 現在の日時を `YYYYMMDDHHmm` 形式で取得して、すべてのスクリプトタグのバージョンを更新する

### 対象スクリプトタグ

```html
<script src="lobby.js?v=YYYYMMDDHHmm"></script>
<script src="poker.js?v=YYYYMMDDHHmm"></script>
<script src="bingo.js?v=YYYYMMDDHHmm"></script>
<script src="mine.js?v=YYYYMMDDHHmm"></script>
<script src="mojipittan.js?v=YYYYMMDDHHmm"></script>
```

**例:** 2026年10月19日23時47分の場合 → `v=202610192347`
