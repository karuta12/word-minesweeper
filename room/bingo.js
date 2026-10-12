// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ■ しりとりビンゴ（オンライン対応）
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const BINGO_FREQ_CHARS = [
  "の",
  "に",
  "た",
  "い",
  "は",
  "を",
  "と",
  "る",
  "が",
  "し",
  "で",
  "て",
  "な",
  "か",
  "れ",
  "ら",
  "も",
  "う",
  "す",
  "り",
  "こ",
  "だ",
  "ま",
  "さ",
  "き",
  "め",
  "く",
  "あ",
  "け",
  "ど",
  "ん",
  "え",
  "よ",
  "つ",
  "や",
  "そ",
  "わ",
  "ち",
  "み",
  "せ",
  "ろ",
  "ば",
  "お",
  "じ",
  "べ",
  "ず",
  "げ",
  "ほ",
  "へ",
  "び",
  "む",
  "ご",
  "ね",
  "ぶ",
  "ぐ",
  "ぎ",
  "ひ",
  "づ",
  "ぼ",
  "ざ",
  "ふ",
  "ぞ",
  "ゆ",
  "ぜ",
  "ぬ",
  "ぱ",
  "ぴ",
  "ぽ",
  "ぷ",
  "ぺ",
  "ぢ",
  "ー",
];

let bingoWordHistory = [];
let bingoLastChar = null;
let bingoCurrentTurn = 0; // 現在のターンプレイヤーインデックス
let bingoPlayerNames = [];
let bingoGameFinished = false;
let bingoMyIndex = 0; // 自分は何番目か
let bingoMyPlayerCount = 1;
let bingoAllCards = []; // 全プレイヤーのカード（2次元配列）
// bingo状態追跡：各プレイヤーのチェック済みセル
let bingoCheckedChars = []; // bingoCheckedChars[playerIndex] = Set of chars

// ── カード生成（ホストが全員分生成して配布） ──
// ── カード生成（ホストが全員分生成して配布） ──
function bingoGenerateAllCards(playerCount) {
  function shuffle(arr) {
    let a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
  const charsWithoutRi = BINGO_FREQ_CHARS.filter((c) => c !== "り");

  // 各プレイヤーごとに、プールから重複なしで24文字を選んでカードを作成する
  // （プレイヤー間での文字の重複はOK、1人の中には同じ文字が重複しない）
  return Array.from({ length: playerCount }, () => {
    const shuffled = shuffle(charsWithoutRi);
    const cards = shuffled.slice(0, 24);
    cards.splice(12, 0, "り");
    return cards;
  });
}

// ── ゲーム開始（ホスト） ──
function bingoHostStart(playerCount, names, allCards) {
  console.log(
    "[bingo] bingoHostStart playerCount:",
    playerCount,
    "names:",
    names,
    "allCards length:",
    allCards?.length,
  );
  bingoMyIndex = 0;
  bingoMyPlayerCount = playerCount;
  bingoPlayerNames = names;
  bingoAllCards = allCards;
  bingoWordHistory = [];
  bingoLastChar = null;
  bingoCurrentTurn = 0;
  bingoGameFinished = false;
  bingoCheckedChars = names.map(() => new Set(["り"]));
  const countEl = document.getElementById("bingo-player-count-display");
  if (countEl) countEl.innerText = `参加人数: ${playerCount}人`;
  showScreen("bingo-screen");
  bingoRenderBoard();
  bingoUpdateTurnDisplay();
}

// ── ゲーム開始（ゲスト） ──
function bingoGuestStart(data) {
  console.log("[bingo] bingoGuestStart data:", data);
  bingoMyIndex = data.myIndex;
  bingoMyPlayerCount = data.playerCount;
  bingoPlayerNames = data.names || [];
  bingoAllCards = data.allCards || [];
  bingoWordHistory = [];
  bingoLastChar = null;
  bingoCurrentTurn = 0;
  bingoGameFinished = false;
  bingoCheckedChars = data.names.map(() => new Set(["り"]));
  const countEl = document.getElementById("bingo-player-count-display");
  if (countEl) countEl.innerText = `参加人数: ${data.playerCount}人`;
  showScreen("bingo-screen");
  bingoRenderBoard();
  bingoUpdateTurnDisplay();
}

// ── ボード描画 ──
function bingoRenderBoard() {
  const container = document.getElementById("bingo-boards");
  container.innerHTML = "";
  document.getElementById("bingo-historyList").innerHTML = "";
  document.getElementById("bingo-errorMsg").innerText = "";

  console.log("[bingo] bingoRenderBoard called");
  console.log("[bingo] bingoPlayerNames:", bingoPlayerNames);
  console.log("[bingo] bingoAllCards:", bingoAllCards);

  if (!bingoPlayerNames.length) {
    container.innerHTML =
      '<p style="color:red">エラー: プレイヤー情報がありません</p>';
    return;
  }
  if (!bingoAllCards.length) {
    container.innerHTML =
      '<p style="color:red">エラー: カードデータがありません</p>';
    return;
  }

  bingoPlayerNames.forEach((name, pi) => {
    const isMe = pi === bingoMyIndex;
    const cardDiv = document.createElement("div");
    cardDiv.className = "bingo-player-card" + (pi === 0 ? " active-turn" : "");
    cardDiv.dataset.playerIndex = pi;

    cardDiv.innerHTML = `
      <h3>
        <span id="bingo-cardTitle_${pi}">${name}${isMe ? " 👈あなた" : ""}</span>
        <span style="display:flex;gap:5px;">
          <span class="reach-badge" id="bingo-reach_${pi}">リーチ: 0</span>
          <span class="bingo-badge" id="bingo-bingo_${pi}">ビンゴ: 0</span>
        </span>
      </h3>`;

    const gridDiv = document.createElement("div");
    gridDiv.className = "bingo-grid";
    const card = bingoAllCards[pi]; // 全員のカードを使って表示
    card.forEach((char, idx) => {
      const cell = document.createElement("div");
      cell.className = "bingo-cell";
      cell.innerText = char;
      cell.dataset.char = char;
      cell.dataset.playerIndex = pi;
      if (idx === 12) cell.classList.add("center", "checked");
      gridDiv.appendChild(cell);
    });
    cardDiv.appendChild(gridDiv);
    container.appendChild(cardDiv);
  });
  bingoUpdateCardStatus();
}

// ── ターン表示 ──
function bingoUpdateTurnDisplay() {
  if (!bingoPlayerNames.length) return;
  const el = document.getElementById("bingo-turnIndicator");
  if (bingoGameFinished) {
    el.innerText = "🏆 ゲーム終了！";
    return;
  }

  const isMyTurn = bingoCurrentTurn === bingoMyIndex;
  el.innerText = isMyTurn
    ? `👉 あなたの番です！言葉を入力してください`
    : `⏳ ${bingoPlayerNames[bingoCurrentTurn]} さんが入力中…`;
  el.style.background = isMyTurn ? "#fff3cd" : "#e9ecef";
  el.style.color = isMyTurn ? "#d9534f" : "#666";

  document.querySelectorAll(".bingo-player-card").forEach((card, idx) => {
    card.classList.toggle("active-turn", idx === bingoCurrentTurn);
  });

  // 入力フォームを自分のターンのみ有効化
  const form = document.getElementById("bingo-wordForm");
  const input = document.getElementById("bingo-wordInput");
  const btn = form ? form.querySelector("button") : null;
  if (input) input.disabled = !isMyTurn;
  if (btn) btn.disabled = !isMyTurn;
  if (isMyTurn && input) input.focus();
}

// ── 言葉送信（自分のターン） ──
function bingoSubmitWord(event) {
  event.preventDefault();
  if (bingoGameFinished) {
    alert("ゲームは既に終了しています。");
    return;
  }
  if (bingoCurrentTurn !== bingoMyIndex) return;

  const inputField = document.getElementById("bingo-wordInput");
  const word = inputField.value.trim();
  const errorMsg = document.getElementById("bingo-errorMsg");
  errorMsg.innerText = "";
  if (!word) return;

  const first = bingoNormalizeChar(word.charAt(0));
  const last = bingoNormalizeChar(word.slice(-1));

  if (last === "ん") {
    errorMsg.innerText = "「ん」で終わる言葉は使えません！";
    return;
  }
  if (bingoLastChar !== null && first !== bingoLastChar) {
    errorMsg.innerText = `🎵 「${bingoLastChar}」から始まる言葉を入力してください！（入力: ${first}）`;
    return;
  }

  if (lobbyIsHost) {
    // ホスト自身はそのまま適用してブロードキャスト
    const msg = { type: "BINGO_WORD", word, playerIndex: bingoMyIndex };
    lobbyBroadcast(msg);
    bingoApplyWord(word, bingoMyIndex);
  } else {
    // ゲストはホストに送って承認してもらう
    lobbyHostConn.send({ type: "BINGO_WORD", word });
    inputField.value = "";
    inputField.disabled = true;
    errorMsg.innerText = "送信中…";
  }
}

// ── 言葉を実際に適用（全員共通） ──
function bingoApplyWord(word, playerIndex) {
  const charsInWord = [...word].map((c) => bingoNormalizeChar(c));

  // 全プレイヤーのカードに対してチェック
  bingoPlayerNames.forEach((_, pi) => {
    const cardChecked = bingoCheckedChars[pi];
    charsInWord.forEach((ch) => cardChecked.add(ch));
    // DOM も更新
    document
      .querySelectorAll(
        `.bingo-player-card[data-player-index="${pi}"] .bingo-cell`,
      )
      .forEach((cell) => {
        const ch = bingoNormalizeChar(cell.dataset.char || "");
        if (ch && cardChecked.has(ch)) cell.classList.add("checked");
      });
  });

  bingoUpdateCardStatus();
  bingoLastChar = bingoNormalizeChar(word.slice(-1));

  const li = document.createElement("li");
  li.innerText = `[${bingoPlayerNames[playerIndex]}] ${word} （文字: ${charsInWord.join(", ")}）`;
  document.getElementById("bingo-historyList").appendChild(li);

  document.getElementById("bingo-wordInput").value = "";

  if (!bingoGameFinished) {
    bingoCurrentTurn = (bingoCurrentTurn + 1) % bingoMyPlayerCount;
    bingoUpdateTurnDisplay();
  }
}

// ── ホスト受信（ビンゴ） ──
function bingoHostReceive(peerId, data) {
  if (data.type === "BINGO_WORD") {
    const guestList = Object.keys(lobbyConns);
    const senderIndex = guestList.indexOf(peerId) + 1;
    // 全員にブロードキャスト（送信者含む）
    lobbyBroadcast({
      type: "BINGO_WORD",
      word: data.word,
      playerIndex: senderIndex,
    });
    bingoApplyWord(data.word, senderIndex);
  }
}

// ── ゲスト受信（ビンゴ） ──
function bingoGuestReceive(data) {
  if (data.type === "BINGO_WORD") {
    document.getElementById("bingo-errorMsg").innerText = "";
    bingoApplyWord(data.word, data.playerIndex);
  } else if (data.type === "BINGO_WIN") {
    bingoGameFinished = true;
    const modal = document.getElementById("bingo-winModal");
    document.getElementById("bingo-winnerText").innerText =
      `${data.winner} さんが ビンゴを達成して勝利しました！ 🎉`;
    modal.style.display = "flex";
    bingoUpdateTurnDisplay();
  }
}

// ── カード評価 ──
function bingoEvaluateCard(cardEl) {
  const cells = cardEl.querySelectorAll(".bingo-cell");
  const grid = [];
  for (let r = 0; r < 5; r++) {
    grid.push(
      Array.from({ length: 5 }, (_, c) =>
        cells[r * 5 + c].classList.contains("checked"),
      ),
    );
  }
  const lines = [
    ...grid,
    ...Array.from({ length: 5 }, (_, c) => grid.map((row) => row[c])),
    [grid[0][0], grid[1][1], grid[2][2], grid[3][3], grid[4][4]],
    [grid[0][4], grid[1][3], grid[2][2], grid[3][1], grid[4][0]],
  ];
  let bingos = 0,
    reaches = 0;
  lines.forEach((l) => {
    const n = l.filter(Boolean).length;
    if (n === 5) bingos++;
    else if (n === 4) reaches++;
  });
  return { bingos, reaches };
}

function bingoUpdateCardStatus() {
  document.querySelectorAll(".bingo-player-card").forEach((card, idx) => {
    const s = bingoEvaluateCard(card);
    const rb = document.getElementById(`bingo-reach_${idx}`);
    const bb = document.getElementById(`bingo-bingo_${idx}`);
    if (rb) rb.innerText = `リーチ: ${s.reaches}`;
    if (bb) bb.innerText = `ビンゴ: ${s.bingos}列`;
    if (s.bingos >= 2 && !bingoGameFinished) {
      bingoTriggerWin(bingoPlayerNames[idx]);
    }
  });
}

function bingoTriggerWin(name) {
  bingoGameFinished = true;
  const modal = document.getElementById("bingo-winModal");
  document.getElementById("bingo-winnerText").innerText =
    `${name} さんが ビンゴを達成して勝利しました！ 🎉`;
  modal.style.display = "flex";
  bingoUpdateTurnDisplay();
  if (lobbyIsHost) {
    lobbyBroadcast({ type: "BINGO_WIN", winner: name });
  }
}

function bingoCloseModal() {
  document.getElementById("bingo-winModal").style.display = "none";
}

function bingoNormalizeChar(ch) {
  const m = {
    ぁ: "あ",
    ぃ: "い",
    ぅ: "う",
    ぇ: "え",
    ぉ: "お",
    っ: "つ",
    ゃ: "や",
    ゅ: "ゆ",
    ょ: "よ",
    ゎ: "わ",
  };
  return m[ch] || ch;
}
