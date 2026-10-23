# エージェント向け指示

## JS/設計 修正時の手順

JS ファイルや仕様を修正した場合は、以下を自動的に実行してください：

1. `room/DESIGN.md` の「最終更新」日付を現在の日時に更新する
   - 関連する仕様説明も同時に修正・追加する
2. `room/index.html` のスクリプトタグのバージョンを更新する
3. 現在の日時を `YYYYMMDDHHmm` 形式で取得して、すべてのスクリプトタグのバージョンを統一する

### 対象ファイル

**DESIGN.md:**
- 日付更新: `> 最終更新: YYYY-MM-DD`
- 該当する仕様セクションの内容も修正・追加

例：ランダムレイアウト機能を修正した場合
→ 「五十音マインスイーパー」セクションの該当部分を同時に修正

**index.html のスクリプトタグ:**
```html
<script src="lobby.js?v=YYYYMMDDHHmm"></script>
<script src="poker.js?v=YYYYMMDDHHmm"></script>
<script src="bingo.js?v=YYYYMMDDHHmm"></script>
<script src="mine.js?v=YYYYMMDDHHmm"></script>
<script src="mojipittan.js?v=YYYYMMDDHHmm"></script>
```

**例:** 2026年10月20日00時26分の場合
- DESIGN.md → `> 最終更新: 2026-10-20`
- index.html → `v=202610200026`
- DESIGN.md の該当セクション → 仕様内容も修正
