# ゲームロビー 設計ドキュメント

> 最終更新: 2026-10-18

---

## 概要

合言葉（ルームID）を使って複数人でオンライン対戦できるゲームロビー。  
WebRTC の P2P 通信（PeerJS）を使い、サーバーレスで動作する。

---

## ファイル構成

```
room/
├── index.html   # 全画面の HTML・CSS・エントリポイント
├── lobby.js     # 共通ロビー（部屋作成・参加・メッセージルーティング）
├── poker.js     # 文字ポーカー ゲームロジック
├── bingo.js     # しりとりビンゴ ゲームロジック
├── mine.js      # 五十音マインスイーパー ゲームロジック
└── word.csv     # マインスイーパー問題集（ジャンル,ワード）
```

スクリプトは `?v=YYYYMMDDhhmm` 形式のクエリパラメータでキャッシュバスティングを行う。  
バージョン番号はロビー画面の右下に自動表示される。

---

## 通信アーキテクチャ

```
[ホスト]  ←──PeerJS DataConnection──→  [ゲスト1]
         ←──PeerJS DataConnection──→  [ゲスト2]
         ←──PeerJS DataConnection──→  [ゲストN]
```

- **ホスト** がゲームの状態を管理し、全員に配信する（スター型トポロジー）
- ゲスト同士は直接通信しない。全てホスト経由
- PeerJS の PeerID は `"gamelobby-" + encodeURIComponent(合言葉)` で固定

---

## 画面遷移

```
lobby-screen（ロビー）
  ├── [ホスト] 部屋を作る → 参加者待機 → ゲーム選択
  │     ├── 🃏 文字ポーカー   → poker-screen
  │     ├── 🎯 しりとりビンゴ  → bingo-screen
  │     └── 💣 マインスイーパー → mine-screen
  └── [ゲスト] 部屋に参加 → ホストがゲームを選ぶまで待機
                             → GAME_SELECTED を受信して各ゲーム画面へ
```

各ゲーム画面の「← ロビーへ」ボタンで `lobby-screen` に戻る。

---

## 共通ロビー (lobby.js)

### 主要変数

| 変数 | 型 | 説明 |
|------|-----|------|
| `lobbyPeer` | Peer | 自分の PeerJS インスタンス |
| `lobbyConns` | `{ peerId: { conn, name } }` | ホスト用：接続中のゲスト一覧 |
| `lobbyHostConn` | DataConnection | ゲスト用：ホストへの接続 |
| `lobbyMyName` | string | 自分の名前（部屋作成・参加時に prompt で入力） |
| `lobbyIsHost` | boolean | ホストかどうか |
| `lobbyRoomName` | string | 合言葉 |
| `lobbyLang` | `"ja"` \| `"en"` | 文字ポーカーの言語設定 |

### 主要関数

| 関数 | 説明 |
|------|------|
| `lobbyCreateRoom()` | ホストとして部屋を作成（PeerID を合言葉から生成） |
| `lobbyJoinRoom()` | ゲストとして部屋に参加 |
| `lobbyBroadcast(msg)` | 全ゲストに一斉送信（ホスト自身には届かない） |
| `lobbySelectGame(game)` | ゲームを選択して全員にゲーム開始を通知 |
| `lobbyHostReceive(peerId, data)` | ホスト側のメッセージルーター |
| `lobbyGuestReceive(data)` | ゲスト側のメッセージルーター |
| `lobbyCleanupPeer()` | 既存 Peer を破棄してリセット |

### 接続フロー

```
ゲスト接続
  → ホスト: connection イベント
  → ホスト→ゲスト: { type: "ASK_NAME" }
  → ゲスト→ホスト: { type: "GIVE_NAME", name: "..." }   ※open時にも自動送信
  → ホスト: lobbyConns[peerId].name を更新・参加者リスト再描画

ゲーム開始
  → ホスト: lobbySelectGame("poker" | "bingo" | "mine")
  → ホスト→全ゲスト: { type: "GAME_SELECTED", game: "...", ...初期データ }
  → 各クライアント: 対応するゲームの start 関数を呼び出し
```

### メッセージルーティング

`lobbyHostReceive` / `lobbyGuestReceive` がメッセージの `type` を見て各ゲームの受信関数に振り分ける。

```
type: "GIVE_NAME"          → ホスト: 参加者名を記録
type: "GAME_SELECTED"      → ゲスト: 各ゲームの GuestStart へ
type: "BINGO_WORD"         → bingoHostReceive / bingoGuestReceive
type: "BINGO_WIN"          → bingoGuestReceive
type: "MINE_OPEN"          → mineHostReceive
type: "MINE_GUESS"         → mineHostReceive
type: "MINE_HINT_REQUEST"  → mineHostReceive
type: "MINE_CELL_OPENED"   → mineGuestReceive
type: "MINE_TURN_CHANGE"   → mineGuestReceive
type: "MINE_GUESS_RESULT"  → mineGuestReceive
type: "MINE_HINT_REVEAL"   → mineGuestReceive
type: "MINE_TIMER"         → mineGuestReceive
type: "EXCHANGE_DONE"      → pokerHostReceive
type: "SCORE"              → pokerHostReceive
type: "REMATCH_REQUEST"    → pokerHostReceive
type: "ALL_EXCHANGED"      → pokerGuestReceive
type: "RESULT"             → pokerGuestReceive
type: "REMATCH_START"      → pokerGuestReceive
```

---

## 文字ポーカー (poker.js)

### ゲーム概要

7枚の文字カードを使って単語を作り、得点を競う。

### ゲームフロー

```
1. カード配布（ホストが全員分のデッキを生成して配布）
2. カード交換フェーズ（1回のみ）
   - 全員が交換完了 → ホストが ALL_EXCHANGED をブロードキャスト
3. 単語入力フェーズ
   - 手札の文字のみ使用可（英語モードは辞書 API で検証）
   - 終了ボタンで得点送信
4. 結果表示（ホストが集計してランキングを全員に送信）
5. 再戦（全員が再戦ボタンを押すと新しい手札で再開）
```

### カードの色と得点

| 色 | インデックス範囲 | 枚数/種 | 得点 |
|----|----------------|---------|------|
| 黒 | 0 〜 14 (高頻度) | 3枚 | 1点 |
| 青 | 15 〜 34 (中頻度) | 2枚 | 2点 |
| 赤 | 35 〜 (低頻度) | 1枚 | 3点 |

### 主要メッセージ

| type | 方向 | 内容 |
|------|------|------|
| `GAME_SELECTED` | ホスト→ゲスト | `{ lang, hand: Card[] }` |
| `EXCHANGE_DONE` | ゲスト→ホスト | 交換完了通知 |
| `ALL_EXCHANGED` | ホスト→全員 | 単語入力フェーズ開始 |
| `SCORE` | ゲスト→ホスト | `{ total, detail }` |
| `RESULT` | ホスト→全員 | `{ ranking: [] }` |
| `REMATCH_REQUEST` | ゲスト→ホスト | 再戦希望 |
| `REMATCH_START` | ホスト→ゲスト | `{ hand: Card[] }` 新しい手札 |

---

## しりとりビンゴ (bingo.js)

### ゲーム概要

しりとりをしながら 5×5 ビンゴカードのマスを埋める。2列ビンゴで勝利。  
プレイヤー人数はロビーの参加者数で自動決定（`bingo-player-count-display` に表示）。

### ゲームフロー

```
1. ホストが全員分のカードを生成して配布
2. ターン制でしりとりの単語を入力
   - 「ん」で終わる単語は禁止
   - 入力した単語に含まれる文字がすべてのカードに反映される
3. 2列ビンゴ達成でゲーム終了
   → ホストが BINGO_WIN をブロードキャスト
```

### カード生成ルール

- 全頻出ひらがな（72文字）から「り」を除いた文字をプレイヤー数で均等分配（蛇行順）
- 各プレイヤーのカードはシャッフルして 24 枚を選択
- 中央（インデックス12）は必ず「り」（FREE マス、最初からチェック済み）

### チェックロジック

入力された単語に含まれる文字（正規化後）が **全プレイヤーのカード** に反映される。  
`bingoCheckedChars[playerIndex]` が各プレイヤーのチェック済み文字の Set。  
DOM の `.bingo-cell` には `data-player-index` と `data-char` 属性があり、`bingoApplyWord` でチェック済みクラスを付与する。

### ビンゴ判定

`bingoEvaluateCard(cardEl)` が DOM の `.checked` クラスを見て行・列・斜めの完成列数を返す。  
`bingoUpdateCardStatus` が全カードを走査し、`bingos >= 2` で `bingoTriggerWin` を呼ぶ。

### 文字正規化

小書き仮名を大書きに統一して照合する。

| 変換前 | 変換後 |
|--------|--------|
| ぁぃぅぇぉ | あいうえお |
| っゃゅょ | つやゆよ |
| ゎ | わ |

### 主要メッセージ

| type | 方向 | 内容 |
|------|------|------|
| `GAME_SELECTED` | ホスト→ゲスト | `{ myIndex, playerCount, names, allCards }` |
| `BINGO_WORD` | 双方向 | `{ word, playerIndex }` |
| `BINGO_WIN` | ホスト→ゲスト | `{ winner: name }` |

---

## 五十音マインスイーパー (mine.js)

### ゲーム概要

五十音表をボードにしたマインスイーパー型ワード推理ゲーム（2人対戦）。  
爆弾マス（答えの文字を含むマス）を手がかりに、お題のワードを当てる。

### ゲームフロー

```
1. ホストがお題を選択（word.csv または MINE_DEFAULT_CSV から）
2. ホストがセルデータを生成してゲスト（P2）に送信
3. ターン制で交互に操作（自分のターンは直接マスをクリック or ワードを答える）
   - マスをクリック: 五十音表のマスを1つ選んで開ける
     - 爆弾マス: 答えの文字が含まれる → 1回休み（SKIP）
     - 安全マス (neighborBombs=0): 隣接セルを連鎖展開
     - 安全マス (neighborBombs>0): 周囲の爆弾数を表示
   - 「ワードを答える」ボタン: 正解すれば勝利、不正解で回答権喪失
4. 位置ヒント（各プレイヤー1回のみ）
   - 開いている爆弾マスの中から1つを選び、その文字がお題の何文字目かを表示
5. タイマー（180秒）切れで強制的にランダムマスを開放
```

### フェーズ管理

`minePhase` 変数で UI の状態を管理する。

| フェーズ | 説明 |
|---------|------|
| `"choose"` | 自分のターン: マスをクリックするか「ワードを答える」を選ぶ |
| `"guess"` | ワード入力中 |

> `"open"` フェーズは廃止。`choose` 状態のまま直接マスをクリックできる。

### セルデータ構造

```js
cells[char] = {
  char: "あ",            // 五十音の文字
  isOpen: boolean,       // 開いているか
  bombs: number,         // この文字がお題に含まれる回数（爆弾数）
  neighborBombs: number  // 隣接8マスの爆弾総数
}
```

### 連鎖展開ロジック

```
mineProcessCellOpen(char)
  → isOpen = true
  → neighborBombs === 0 なら mineRevealNeighbors(char) を呼ぶ

mineRevealCellRecursive(char)
  → 未開放・爆弾なし のセルを isOpen = true にする
  → neighborBombs === 0 なら mineRevealNeighbors(char) を呼ぶ

mineRevealNeighbors(char)
  → 隣接8マスを走査し、未開放・爆弾なし のセルに mineRevealCellRecursive を再帰
```

### 濁点・小書きマッピング

爆弾配置時に濁点・半濁点・小書き文字を五十音表の基底文字に変換して照合。  
例: `が → か`, `っ → つ`, `ぱ → は`

### 役割分担

| 処理 | ホスト | ゲスト |
|------|--------|--------|
| セル開放の正誤判定 | ✅ 実行 | ホストに送信して委譲 |
| ワード正誤判定 | ✅ 実行（word を知っている） | ホストに送信して委譲 |
| ヒント計算 | ✅ 実行 | ホストに送信して委譲 |
| タイマー制御 | ✅ 実行（毎秒同期） | クライアント側で毎秒計算＋ホストから毎秒同期 |
| 問題変更 | ✅ 実行 | 待機（ホストからの GAME_SELECTED を受信） |

### 主要メッセージ

| type | 方向 | 内容 |
|------|------|------|
| `GAME_SELECTED` | ホスト→ゲスト | `{ playerNum, names, genre, wordLength, cellsData, firstTurn }` |
| `MINE_OPEN` | ゲスト→ホスト | `{ char }` 開けたいマス |
| `MINE_CELL_OPENED` | ホスト→全員 | `{ cellsData, skipped }` 更新後の盤面 |
| `MINE_TURN_CHANGE` | ホスト→全員 | `{ turn, skipped }` ターン変更 |
| `MINE_GUESS` | ゲスト→ホスト | `{ answer }` ワード回答 |
| `MINE_GUESS_RESULT` | ホスト→全員 | `{ correct, winner?, word?, playerNum?, answer }` 正誤判定・回答内容・正解ワード連携 |
| `MINE_HINT_REQUEST` | ゲスト→ホスト | ヒント要求 |
| `MINE_HINT_REVEAL` | ホスト→全員 | `{ revealedPositions, hintPlayer }` |
| `MINE_TIMER` | ホスト→全員 | `{ timeLeft }` タイマー同期（毎秒） |

---

## 終了時の動作・盤面確認

- ゲーム終了時（正解判定時）、勝敗メッセージと共に「閉じる（盤面を見る）」ボタンがモーダルおよびアクションパネルに表示されます。
- モーダルを閉じることで、結果モーダルを非表示にし、最終的な盤面の状態を確認することができます。
- ホストはアクションパネルまたはモーダル内から「もう一度プレイする」ことで、先攻後攻を新たにランダム決定して次の問題を開始できます。

```csv
ジャンル,ワード
生き物,おおさんしょううお
地理・観光,ふじさん
作品・物語,せんとちひろのかみかくし
食べ物,すきやき
歴史・人物,おだのぶなが
```

- `word.csv` を `room/` ディレクトリに置くと自動読み込み
- ゲーム中に「CSV指定」ボタンでも変更可能（ホストのみ）
- ワードはすべてひらがな

---

## 逆もじぴったん (mojipittan.js)

### ゲーム概要

5×5 の五十音表グリッドに2人で交互に文字を1つずつ置いていく。  
指摘（相手の作った文字列が単語ではないと主張）で点数を稼ぎ、25マス埋まった時点で得点が多い方が勝ち。

### グリッドレイアウト

五十音表の見た目に合わせた配置（右上が「あ」、縦にあいうえお）。  
実際に置く文字はプレイヤーが自由に選ぶ（固定ではない）。

```
な た さ か あ   (row=0 / あ段)
に ち し き い   (row=1 / い段)
ぬ つ す く う   (row=2 / う段)
ね て せ け え   (row=3 / え段)
の と そ こ お   (row=4 / お段)
```

- `index = row * 5 + col`（左→右、上→下）
- 空きマスの右下にラベルを薄く表示

### ターンの流れ

```
自分のターン開始
  ├── [任意・繰り返し可] 指摘
  │     ├── 成功（単語ではなかった）→ 文字数ポイント獲得 → また指摘可
  │     └── 失敗（単語だった）      → 以降このゲーム中は指摘権なし
  └── 空きマスに文字を1つ置く → 相手のターンへ
```

### マス選択の制約

| 状況 | 選択可能なマス |
|------|--------------|
| グリッドが空（1手目） | 全25マス |
| 1文字以上置かれた後 | 既置文字の上下左右隣接の空きマスのみ（斜め不可） |

### 文字使用の制約

- パレットは清音46文字＋「ー」の47文字（濁点・半濁点・小文字は各自でつけ外し）
- **既にグリッドに置かれている文字は選択不可**（パレットで取り消し線付きdisabled表示）

### 指摘の仕組み

1. 「👆 指摘する」ボタンを押して指摘モードへ
2. 指摘したい文字列をテキスト入力（例: 「りんご」）
3. weblioリンクが入力に連動して更新 → 両者が辞書を確認
4. **自己申告**で「成功」か「失敗」を押す

weblioリンク: `https://www.weblio.jp/content/` + encodeURIComponent(入力文字列)

### 得点

- 指摘成功時の文字列の文字数分のみ加算
- 最終スコア = 指摘成功の累計点
- 25マス全て埋まったら終了・集計

### 2人専用

`lobbySelectGame` で2人以外はアラートを出して開始不可。

### 主要メッセージ

| type | 方向 | 内容 |
|------|------|------|
| `GAME_SELECTED` | ホスト→ゲスト | `{ game: "mojipittan", myIndex: 1, names }` |
| `MOJIPIT_PLACE` | 双方向 | `{ index, char }` マスに文字を置く |
| `MOJIPIT_ACCUSE` | 双方向 | `{ result: "success"\|"fail", word, len, playerIndex }` 指摘結果 |

ホスト側で `MOJIPIT_PLACE` 受信時に以下を検証して不正操作を弾く：
- 送信者のターンか
- 対象マスが空か
- 文字がパレットにある清音か
- 既にグリッドに存在する文字でないか
- 隣接制約を満たしているか

---

## 初期化順序

```html
<!-- index.html 末尾 -->
<script>
  function showScreen(id) { ... }
</script>
<script src="lobby.js?v=..."></script>        <!-- lobbyXxx 関数を定義 -->
<script src="poker.js?v=..."></script>         <!-- pokerXxx 関数を定義 -->
<script src="bingo.js?v=..."></script>         <!-- bingoXxx 関数を定義 -->
<script src="mine.js?v=..."></script>          <!-- mineXxx 関数を定義 -->
<script src="mojipittan.js?v=..."></script>    <!-- mojipXxx 関数を定義 -->
<script>
  mineInit();       // 問題DBをfetchで初期化
  // bingo.js の ?v= からビルド番号を取得してロビー画面に表示
</script>
```
