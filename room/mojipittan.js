// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ■ 逆もじぴったん（オンライン対応）
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//
// グリッド配置（五十音表レイアウト・右上があ）：
//   列0=わ行  列1=ら行  列2=や行  列3=ま行  列4=は行
//   列5=な行  列6=た行  列7=さ行  列8=か行  列9=あ行  ← 10列では広すぎるので5×5に絞る
//
//   5×5 = あ行・か行・さ行・た行・な行 の5行を使用
//   右上(col=4,row=0) = あ、その列を縦に あいうえお
//
//   表示インデックス（左→右, 上→下）:
//     col: 0=な行 1=た行 2=さ行 3=か行 4=あ行
//     row: 0=段（あ/か/さ/た/な）, 1=段（い/き/し/ち/に）, ...
//
//   index = row * 5 + col
//   (col=4,row=0) = index 4  → あ
//   (col=4,row=1) = index 9  → い
//   ...
//
// ターンの流れ：
//   自分のターン開始
//     ├── [任意・繰り返し可] 指摘
//     │     ├── 成功 → 文字数ポイント獲得 → また指摘可
//     │     └── 失敗 → 以降指摘権なし
//     └── 隣接空きマスに文字を1つ置く → 相手のターンへ
//
// 制約：
//   - グリッドが空 → 全マス選択可能
//   - 1文字以上置かれた後 → 既置文字の縦/横隣接マスのみ選択可能
//   - 既にグリッドに存在する文字はパレットでdisabled
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// 清音のみ（濁点・半濁点・小文字は各自でつけ外し）
// 五十音表と同じ縦並び・右からあ行（グリッドと対応）
// 表示は10列×5行で右列があ行、末尾にん・ーを追加
const MOJIPIT_KANA = [
  // わ行  ら行  や行  ま行  は行  な行  た行  さ行  か行  あ行
  "わ",  "ら",  "や",  "ま",  "は",  "な",  "た",  "さ",  "か",  "あ",
  "ゐ",  "り",  "ゆ",  "み",  "ひ",  "に",  "ち",  "し",  "き",  "い",
  "　",  "る",  "よ",  "む",  "ふ",  "ぬ",  "つ",  "す",  "く",  "う",
  "ゑ",  "れ",  "　",  "め",  "へ",  "ね",  "て",  "せ",  "け",  "え",
  "を",  "ろ",  "　",  "も",  "ほ",  "の",  "と",  "そ",  "こ",  "お",
  // 追加行
  "ん",  "ー",  "　",  "　",  "　",  "　",  "　",  "　",  "　",  "　",
];

// 五十音表レイアウト（5×5、右上があ）
// index = row*5+col, col=4が「あ行」, col=0が「な行」
// row=0が「あ段」, row=4が「お段」
//
//  な た さ か あ   (row=0)
//  に ち し き い   (row=1)
//  ぬ つ す く う   (row=2)
//  ね て せ け え   (row=3)
//  の と そ こ お   (row=4)
//

// ── 状態変数 ──
let mojipGrid        = Array(25).fill(null); // null or ひらがな1文字
let mojipTurn        = 0;   // 0=P1, 1=P2
let mojipMyIndex     = 0;   // 自分は0か1か
let mojipNames       = ["", ""];
let mojipScores      = [0, 0];
let mojipCanAccuse   = [true, true]; // 指摘権
let mojipFinished    = false;
let mojipSelectedCell = null; // 文字を置く対象のセルインデックス
let mojipPhase       = "place"; // "place" | "accuse"

// ── 隣接マス取得（縦・横のみ）──
function mojipGetAdjacentIndices(idx) {
  const row = Math.floor(idx / 5);
  const col = idx % 5;
  const result = [];
  if (row > 0) result.push((row - 1) * 5 + col); // 上
  if (row < 4) result.push((row + 1) * 5 + col); // 下
  if (col > 0) result.push(row * 5 + (col - 1)); // 左
  if (col < 4) result.push(row * 5 + (col + 1)); // 右
  return result;
}

// ── 選択可能マスの集合を返す ──
function mojipSelectableIndices() {
  const hasAny = mojipGrid.some(c => c !== null);
  if (!hasAny) {
    // グリッドが空 → 全マス
    return new Set(mojipGrid.map((_, i) => i));
  }
  // 既置文字の縦横隣接で空きのみ
  const result = new Set();
  mojipGrid.forEach((ch, idx) => {
    if (ch !== null) {
      mojipGetAdjacentIndices(idx).forEach(adj => {
        if (mojipGrid[adj] === null) result.add(adj);
      });
    }
  });
  return result;
}

// ── ゲーム開始（ホスト） ──
function mojipHostStart(names) {
  mojipMyIndex   = 0;
  mojipNames     = names;
  mojipGrid      = Array(25).fill(null);
  mojipScores    = [0, 0];
  mojipCanAccuse = [true, true];
  mojipFinished  = false;
  mojipTurn      = 0;
  mojipSelectedCell = null;
  mojipPhase     = "place";
  showScreen("mojipittan-screen");
  mojipRender();
  mojipUpdateStatus();
}

// ── ゲーム開始（ゲスト） ──
function mojipGuestStart(data) {
  mojipMyIndex   = data.myIndex;
  mojipNames     = data.names;
  mojipGrid      = Array(25).fill(null);
  mojipScores    = [0, 0];
  mojipCanAccuse = [true, true];
  mojipFinished  = false;
  mojipTurn      = 0;
  mojipSelectedCell = null;
  mojipPhase     = "place";
  showScreen("mojipittan-screen");
  mojipRender();
  mojipUpdateStatus();
}

// ── グリッド描画 ──
function mojipRender() {
  const grid = document.getElementById("mojipit-grid");
  if (!grid) return;
  grid.innerHTML = "";

  const isMyTurn = !mojipFinished && mojipTurn === mojipMyIndex && mojipPhase === "place";
  const selectable = isMyTurn ? mojipSelectableIndices() : new Set();

  mojipGrid.forEach((ch, idx) => {
    const cell = document.createElement("div");
    cell.className = "mojipit-cell";

    if (ch) {
      cell.textContent = ch;
      cell.classList.add("filled");
    } else {
      cell.classList.add("empty");
      if (isMyTurn && selectable.has(idx)) {
        cell.classList.add("selectable");
        cell.onclick = () => mojipSelectCell(idx);
      }
    }
    if (idx === mojipSelectedCell) cell.classList.add("selected");
    grid.appendChild(cell);
  });

  // 文字パレット更新
  mojipRenderPalette();

  // スコア更新
  const s0 = document.getElementById("mojipit-score-0");
  const s1 = document.getElementById("mojipit-score-1");
  if (s0) s0.textContent = mojipScores[0];
  if (s1) s1.textContent = mojipScores[1];

  // 名前更新
  const n0 = document.getElementById("mojipit-name-0");
  const n1 = document.getElementById("mojipit-name-1");
  if (n0) n0.textContent = mojipNames[0];
  if (n1) n1.textContent = mojipNames[1];

  // アクティブターンの枠色
  const b0 = document.getElementById("mojipit-player-box-0");
  const b1 = document.getElementById("mojipit-player-box-1");
  if (b0) b0.classList.toggle("active-turn", mojipTurn === 0);
  if (b1) b1.classList.toggle("active-turn", mojipTurn === 1);
}

// ── 文字パレット描画 ──
function mojipRenderPalette() {
  const palette = document.getElementById("mojipit-palette");
  if (!palette) return;
  const isMyTurn = !mojipFinished && mojipTurn === mojipMyIndex && mojipPhase === "place";
  const cellSelected = mojipSelectedCell !== null;

  // 既にグリッドに置かれている文字のセット
  const usedChars = new Set(mojipGrid.filter(c => c !== null));

  palette.innerHTML = "";
  MOJIPIT_KANA.forEach(ch => {
    const btn = document.createElement("button");
    // 空白・旧仮名（ゐゑ）は空セルとして表示するだけ
    const isBlank = (ch === "　" || ch === "ゐ" || ch === "ゑ");
    btn.className = "mojipit-kana-btn";
    btn.textContent = isBlank ? "" : ch;

    if (isBlank) {
      btn.disabled = true;
      btn.style.visibility = "hidden";
    } else {
      const alreadyUsed = usedChars.has(ch);
      if (isMyTurn && cellSelected && !alreadyUsed) {
        btn.onclick = () => mojipPlaceChar(ch);
      } else {
        btn.disabled = true;
        if (alreadyUsed) btn.classList.add("used");
      }
    }
    palette.appendChild(btn);
  });
}

// ── セル選択 ──
function mojipSelectCell(idx) {
  if (mojipFinished || mojipTurn !== mojipMyIndex || mojipPhase !== "place") return;
  if (mojipGrid[idx] !== null) return;
  // 選択可能マスかチェック
  if (!mojipSelectableIndices().has(idx)) return;
  mojipSelectedCell = idx;
  mojipRender();
}

// ── 文字を置く ──
function mojipPlaceChar(ch) {
  if (mojipFinished) return;
  if (mojipTurn !== mojipMyIndex) return;
  if (mojipPhase !== "place") return;
  if (mojipSelectedCell === null) { alert("マスを選んでください"); return; }
  if (mojipGrid[mojipSelectedCell] !== null) return;
  // 使用済み文字チェック
  if (mojipGrid.includes(ch)) { alert("その文字はすでに置かれています"); return; }

  const msg = { type: "MOJIPIT_PLACE", index: mojipSelectedCell, char: ch };
  if (lobbyIsHost) {
    lobbyBroadcast(msg);
    mojipApplyPlace(mojipSelectedCell, ch);
  } else {
    lobbyHostConn.send(msg);
  }
  mojipSelectedCell = null;
}

// ── 文字置きを適用（全員共通） ──
function mojipApplyPlace(index, ch) {
  mojipGrid[index] = ch;
  mojipTurn = 1 - mojipTurn;  // ターン交代
  mojipPhase = "place";
  mojipSelectedCell = null;
  mojipRender();
  mojipUpdateStatus();
  // 25マス埋まったら終了
  if (mojipGrid.every(c => c !== null)) {
    mojipFinish();
  }
}

// ── 指摘フェーズ開始 ──
function mojipStartAccuse() {
  if (mojipFinished) return;
  if (mojipTurn !== mojipMyIndex) return;
  if (!mojipCanAccuse[mojipMyIndex]) {
    alert("指摘権がありません");
    return;
  }
  mojipPhase = "accuse";
  mojipRender();
  mojipUpdateStatus();
  setTimeout(() => {
    const inp = document.getElementById("mojipit-accuse-input");
    if (inp) inp.focus();
  }, 50);
}

// ── 指摘キャンセル ──
function mojipCancelAccuse() {
  mojipPhase = "place";
  mojipRender();
  mojipUpdateStatus();
}

// ── 指摘判定（成功・失敗） ──
function mojipJudgeAccuse(success) {
  const input = document.getElementById("mojipit-accuse-input");
  const word = input ? input.value.trim() : "";
  if (!word) { alert("単語を入力してください"); return; }

  const len = [...word].length;

  const result = success ? "success" : "fail";
  const msg = { type: "MOJIPIT_ACCUSE", result, word, len: success ? len : 0, playerIndex: mojipMyIndex };
  if (lobbyIsHost) {
    lobbyBroadcast(msg);
    mojipApplyAccuse(result, word, success ? len : 0, mojipMyIndex);
  } else {
    lobbyHostConn.send(msg);
  }
  if (input) input.value = "";
  mojipUpdateWeblioLink();
}

// ── 指摘結果を適用（全員共通） ──
function mojipApplyAccuse(result, word, len, playerIndex) {
  if (result === "success") {
    mojipScores[playerIndex] += len;
    mojipAddLog(`✅ ${mojipNames[playerIndex]} が「${word}」（${len}文字）の指摘成功！ +${len}点`);
    if (playerIndex === mojipMyIndex) mojipPhase = "accuse";
  } else {
    mojipCanAccuse[playerIndex] = false;
    mojipAddLog(`❌ ${mojipNames[playerIndex]} が「${word}」の指摘失敗。指摘権を失った`);
    if (playerIndex === mojipMyIndex) mojipPhase = "place";
  }
  mojipRender();
  mojipUpdateStatus();
}

// ── ステータス表示更新 ──
function mojipUpdateStatus() {
  const el = document.getElementById("mojipit-status");
  if (!el) return;

  if (mojipFinished) {
    el.textContent = "🏆 ゲーム終了！";
    el.style.background = "#e9ecef";
    el.style.color = "#333";
    return;
  }

  const isMyTurn = mojipTurn === mojipMyIndex;
  const name = mojipNames[mojipTurn];

  if (!isMyTurn) {
    el.textContent = `⏳ ${name} のターン…`;
    el.style.background = "#e9ecef";
    el.style.color = "#666";
  } else if (mojipPhase === "accuse") {
    el.textContent = `👆 あなたのターン：指摘中`;
    el.style.background = "#fff3cd";
    el.style.color = "#856404";
  } else {
    el.textContent = `👉 あなたのターン：指摘するか、マスに文字を置いてください`;
    el.style.background = "#d1e7dd";
    el.style.color = "#0f5132";
  }

  const accuseBtn  = document.getElementById("mojipit-accuse-btn");
  const accuseArea = document.getElementById("mojipit-accuse-area");
  const placeHint  = document.getElementById("mojipit-place-hint");

  if (accuseBtn) accuseBtn.style.display =
    (isMyTurn && mojipPhase === "place" && mojipCanAccuse[mojipMyIndex]) ? "inline-block" : "none";
  if (accuseArea) accuseArea.style.display =
    (isMyTurn && mojipPhase === "accuse") ? "block" : "none";
  if (placeHint) placeHint.style.display =
    (isMyTurn && mojipPhase === "place") ? "block" : "none";

  // 指摘権バッジ
  const b0 = document.getElementById("mojipit-accuse-badge-0");
  const b1 = document.getElementById("mojipit-accuse-badge-1");
  if (b0) { b0.textContent = mojipCanAccuse[0] ? "指摘可" : "指摘不可"; b0.style.background = mojipCanAccuse[0] ? "#0d6efd" : "#aaa"; }
  if (b1) { b1.textContent = mojipCanAccuse[1] ? "指摘可" : "指摘不可"; b1.style.background = mojipCanAccuse[1] ? "#0d6efd" : "#aaa"; }
}

// ── ゲーム終了 ──
function mojipFinish() {
  mojipFinished = true;
  const modal = document.getElementById("mojipit-result-modal");
  const text  = document.getElementById("mojipit-result-text");
  if (!modal || !text) return;

  const [s0, s1] = mojipScores;
  let msg;
  if (s0 > s1)      msg = `🏆 ${mojipNames[0]} の勝ち！（${s0} vs ${s1}）`;
  else if (s1 > s0) msg = `🏆 ${mojipNames[1]} の勝ち！（${s1} vs ${s0}）`;
  else              msg = `🤝 引き分け！（${s0} vs ${s1}）`;

  text.textContent = msg;
  modal.style.display = "flex";
  mojipUpdateStatus();
}

function mojipCloseResult() {
  document.getElementById("mojipit-result-modal").style.display = "none";
}

// ── ログ追加 ──
function mojipAddLog(text) {
  const list = document.getElementById("mojipit-log");
  if (!list) return;
  const li = document.createElement("li");
  li.textContent = text;
  list.prepend(li);
}

// ── weblioリンクを入力と連動 ──
function mojipUpdateWeblioLink() {
  const input = document.getElementById("mojipit-accuse-input");
  const link  = document.getElementById("mojipit-weblio-link");
  if (!input || !link) return;
  const word = input.value.trim();
  link.href = word
    ? `https://www.weblio.jp/content/${encodeURIComponent(word)}`
    : "https://www.weblio.jp/";
}

// ── ホスト受信 ──
function mojipHostReceive(peerId, data) {
  if (data.type === "MOJIPIT_PLACE") {
    const senderIndex = 1;
    if (mojipTurn !== senderIndex) return;
    if (mojipGrid[data.index] !== null) return;
    if (!MOJIPIT_KANA.includes(data.char)) return;
    if (mojipGrid.includes(data.char)) return; // 使用済み文字
    if (!mojipSelectableIndices().has(data.index)) return; // 隣接制限
    lobbyBroadcast({ type: "MOJIPIT_PLACE", index: data.index, char: data.char });
    mojipApplyPlace(data.index, data.char);
  } else if (data.type === "MOJIPIT_ACCUSE") {
    const senderIndex = 1;
    if (mojipTurn !== senderIndex) return;
    lobbyBroadcast({ type: "MOJIPIT_ACCUSE", result: data.result, word: data.word, len: data.len, playerIndex: senderIndex });
    mojipApplyAccuse(data.result, data.word, data.len, senderIndex);
  }
}

// ── ゲスト受信 ──
function mojipGuestReceive(data) {
  if (data.type === "MOJIPIT_PLACE") {
    mojipApplyPlace(data.index, data.char);
  } else if (data.type === "MOJIPIT_ACCUSE") {
    mojipApplyAccuse(data.result, data.word, data.len, data.playerIndex);
  } else if (data.type === "MOJIPIT_FINISH") {
    mojipFinished = true;
    mojipScores = data.scores;
    mojipFinish();
  }
}
