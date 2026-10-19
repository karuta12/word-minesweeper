# エージェント向け指示

## JS/設計 修正時の手順

JS ファイルを修正した場合は、以下を自動的に実行してください：

1. `room/DESIGN.md` の「最終更新」日付を現在の日時に更新する
2. `room/index.html` のスクリプトタグの日付を修正する
3. 現在の日時を `YYYYMMDDHHmm` 形式で取得して、すべてのスクリプトタグのバージョンを更新する

### 対象ファイル

**DESIGN.md:**
```markdown
> 最終更新: YYYY-MM-DD
```

**index.html のスクリプトタグ:**
```html
<script src="lobby.js?v=YYYYMMDDHHmm"></script>
<script src="poker.js?v=YYYYMMDDHHmm"></script>
<script src="bingo.js?v=YYYYMMDDHHmm"></script>
<script src="mine.js?v=YYYYMMDDHHmm"></script>
<script src="mojipittan.js?v=YYYYMMDDHHmm"></script>
```

**例:** 2026年10月19日23時47分の場合
- DESIGN.md → `> 最終更新: 2026-10-19`
- index.html → `v=202610192347`
