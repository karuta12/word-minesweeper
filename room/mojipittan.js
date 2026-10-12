// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ■ 逆もじぴったん（オンライン対応）
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//
// ターンの流れ：
//   自分のターン開始
//     ├── [任意・繰り返し可] 指摘
//     │     ├── 成功 → 文字数ポイント獲得 → また指摘可
//     │     └── 失敗 → 以降指摘権なし
//     └── 空きマスに文字を1つ置く → 相手のターンへ
//
// 通信：ホストが状態管理。全操作をホストが検証してブロードキャスト。
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const MOJIPIT_KANA = [
  "あ","い","う","え","お",
  "か","き","く","け","こ",
  "さ","し","す","せ","そ",
  "た","ち","つ","て","と",
  "な","に","ぬ","ね","の",
  "は","ひ","ふ","へ","ほ",
  "ま","み","む","め","も",
  "や","ゆ","よ",
  "ら","り","る","れ","ろ",
  "わ","を","ん","ー",
];

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
  mojipGrid.forEach((ch, idx) => {
    const cell = document.createElement("div");
    cell.className = "mojipit-cell";
    if (ch) {
      cell.textContent = ch;
      cell.classList.add("filled");
    } else {
      cell.textContent = "";
      cell.classList.add("empty");
      // 自分のターンかつplaceフェーズなら選択可能
      if (!mojipFinished && mojipTurn === mojipMyIndex && mojipPhase === "place") {
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
}

// ── 文字パレット描画 ──
function mojipRenderPalette() {
  const palette = document.getElementById("mojipit-palette");
  if (!palette) return;
  const isMyTurn = !mojipFinished && mojipTurn === mojipMyIndex && mojipPhase === "place";
  const cellSelected = mojipSelectedCell !== null;

  palette.innerHTML = "";
  MOJIPIT_KANA.forEach(ch => {
    const btn = document.createElement("button");
    btn.className = "mojipit-kana-btn";
    btn.textContent = ch;
    if (isMyTurn && cellSelected) {
      btn.onclick = () => mojipPlaceChar(ch);
    } else {
      btn.disabled = true;
    }
    palette.appendChild(btn);
  });
}

// ── セル選択 ──
function mojipSelectCell(idx) {
  if (mojipFinished || mojipTurn !== mojipMyIndex || mojipPhase !== "place") return;
  if (mojipGrid[idx] !== null) return;
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
  // 指摘入力欄にフォーカス
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

  const len = [...word].length; // 文字数（サロゲート対応）

  if (success) {
    // 成功：文字数分ポイント
    const msg = { type: "MOJIPIT_ACCUSE", result: "success", word, len, playerIndex: mojipMyIndex };
    if (lobbyIsHost) {
      lobbyBroadcast(msg);
      mojipApplyAccuse("success", word, len, mojipMyIndex);
    } else {
      lobbyHostConn.send(msg);
    }
  } else {
    // 失敗：指摘権剥奪
    const msg = { type: "MOJIPIT_ACCUSE", result: "fail", word, len: 0, playerIndex: mojipMyIndex };
    if (lobbyIsHost) {
      lobbyBroadcast(msg);
      mojipApplyAccuse("fail", word, 0, mojipMyIndex);
    } else {
      lobbyHostConn.send(msg);
    }
  }
  if (input) input.value = "";
}

// ── 指摘結果を適用（全員共通） ──
function mojipApplyAccuse(result, word, len, playerIndex) {
  if (result === "success") {
    mojipScores[playerIndex] += len;
    mojipAddLog(`✅ ${mojipNames[playerIndex]} が「${word}」（${len}文字）の指摘成功！ +${len}点`);
    // 成功後は引き続き指摘フェーズ（自分のターンのみ）
    if (playerIndex === mojipMyIndex) {
      mojipPhase = "accuse";
    }
  } else {
    mojipCanAccuse[playerIndex] = false;
    mojipAddLog(`❌ ${mojipNames[playerIndex]} が「${word}」の指摘失敗。指摘権を失った`);
    // フェーズをplaceに戻す
    if (playerIndex === mojipMyIndex) {
      mojipPhase = "place";
    }
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

  // ボタン表示制御
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
  if (b0) b0.textContent = mojipCanAccuse[0] ? "指摘可" : "指摘不可";
  if (b0) b0.style.background = mojipCanAccuse[0] ? "#0d6efd" : "#aaa";
  if (b1) b1.textContent = mojipCanAccuse[1] ? "指摘可" : "指摘不可";
  if (b1) b1.style.background = mojipCanAccuse[1] ? "#0d6efd" : "#aaa";
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
  list.prepend(li); // 新しいものを上に
}

// ── ホスト受信 ──
function mojipHostReceive(peerId, data) {
  if (data.type === "MOJIPIT_PLACE") {
    // ゲストからの文字置き
    const senderIndex = 1; // 2人なのでゲストは常に1
    if (
      mojipTurn !== senderIndex ||
      mojipGrid[data.index] !== null ||
      !MOJIPIT_KANA.includes(data.char)
    ) return; // 不正操作は無視
    lobbyBroadcast({ type: "MOJIPIT_PLACE", index: data.index, char: data.char });
    mojipApplyPlace(data.index, data.char);
  } else if (data.type === "MOJIPIT_ACCUSE") {
    // ゲストからの指摘
    const senderIndex = 1;
    if (mojipTurn !== senderIndex) return;
    lobbyBroadcast({ type: "MOJIPIT_ACCUSE", result: data.result, word: data.word, len: data.len, playerIndex: senderIndex });
    mojipApplyAccuse(data.result, data.word, data.len, senderIndex);
  }
}

// ── weblioリンクを入力と連動 ──
function mojipUpdateWeblioLink() {
  const input = document.getElementById("mojipit-accuse-input");
  const link  = document.getElementById("mojipit-weblio-link");
  if (!input || !link) return;
  const word = input.value.trim();
  if (word) {
    link.href = `https://www.weblio.jp/content/${encodeURIComponent(word)}`;
  } else {
    link.href = "https://www.weblio.jp/";
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
