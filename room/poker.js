// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ■ 文字ポーカー（ゲームロジックのみ。ロビーは lobby.js）
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const POKER_LANG_DATA = {
  ja: {
    chars: [
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
    ],
    blackEnd: 15,
    blueEnd: 35,
    checkWord: null,
    ui: {
      title: "文字ポーカー ver1.4",
      roomLabel: (r) => `対戦ルーム: ${r}`,
      exchangeHint: "あなたの手札（クリックで選択して交換）",
      exchangeBtn: "選択したカードを交換する（1回のみ）",
      exchangeWait: "交換完了。全員が終わるまでお待ちください…",
      exchangeCount: (d, t) => `交換完了 ${d} / ${t} 人`,
      wordHint:
        "手札の文字を使って単語を入力 / 同じ文字を複数回使う場合は複数枚必要",
      handLabel: "あなたの手札",
      wordPlaceholder: "単語を入力",
      submitBtn: "確定",
      finishBtn: "終了→結果へ",
      wordRow: (w, s) => `✅ <strong>${w}</strong>：${s}点`,
      noWord: "単語なし",
      scoreUnit: "点",
      colName: "名前",
      colWords: "単語",
      colScore: "得点",
      rematchBtn: "🔄 再戦する",
      rematchWait: "再戦リクエストを送りました。全員が揃うまで待っています…",
      rematchCount: (n) => `再戦待ち：あと ${n} 人`,
      win: "🎉 あなたの勝ち！",
      last: "😢 最下位…",
      rank: (n) => `あなたは ${n} 位`,
      allUsed: "手札をすべて使いました！",
      invalidCard: (w) => `「${w}」は手札にない文字が含まれています。`,
      invalidWord: null,
      confirmNoExchange: "1枚も交換しませんか？",
    },
  },
  en: {
    chars: [
      "E",
      "T",
      "A",
      "O",
      "I",
      "N",
      "S",
      "H",
      "R",
      "D",
      "L",
      "C",
      "U",
      "M",
      "W",
      "F",
      "G",
      "Y",
      "P",
      "B",
      "V",
      "K",
      "J",
      "X",
      "Q",
      "Z",
    ],
    blackEnd: 9,
    blueEnd: 20,
    checkWord: async (word) => {
      try {
        const r = await fetch(
          `https://api.dictionaryapi.dev/api/v2/entries/en/${word.toLowerCase()}`,
        );
        return r.ok;
      } catch {
        return true;
      }
    },
    ui: {
      title: "文字ポーカー ver1.4",
      roomLabel: (r) => `対戦ルーム: ${r}`,
      exchangeHint: "あなたの手札（クリックで選択して交換）",
      exchangeBtn: "選択したカードを交換する（1回のみ）",
      exchangeWait: "交換完了。全員が終わるまでお待ちください…",
      exchangeCount: (d, t) => `交換完了 ${d} / ${t} 人`,
      wordHint:
        "手札の文字を使って単語を入力 / 同じ文字を複数回使う場合は複数枚必要",
      handLabel: "あなたの手札",
      wordPlaceholder: "単語を入力",
      submitBtn: "確定",
      finishBtn: "終了→結果へ",
      wordRow: (w, s) => `✅ <strong>${w}</strong>: ${s}点`,
      noWord: "単語なし",
      scoreUnit: "点",
      colName: "名前",
      colWords: "単語",
      colScore: "得点",
      rematchBtn: "🔄 再戦する",
      rematchWait: "再戦リクエストを送りました。全員が揃うまで待っています…",
      rematchCount: (n) => `再戦待ち：あと ${n} 人`,
      win: "🎉 あなたの勝ち！",
      last: "😢 最下位…",
      rank: (n) => `あなたは ${n} 位`,
      allUsed: "手札をすべて使いました！",
      invalidCard: (w) => `「${w}」は手札にない文字が含まれています。`,
      invalidWord: (w) => `「${w}」は辞書に見つかりませんでした。`,
      confirmNoExchange: "1枚も交換しませんか？",
    },
  },
};

// ── 状態 ──
let pokerLang = "ja";
let pokerL = POKER_LANG_DATA.ja;
let pokerDeck = [],
  pokerMyHand = [],
  pokerHasExchanged = false;
let pokerMyWords = [],
  pokerMyTotalScore = 0,
  pokerIFinished = false,
  pokerIWantRematch = false;
let pokerPlayerCount = 0,
  pokerExchangeDoneCount = 0,
  pokerScoreDoneCount = 0,
  pokerRematchCount = 0;
// ゲストの集計用（ホストのみ使用）
let pokerGuestScores = {}; // { peerId: { name, score, detail } }

// ── デッキ操作 ──
function pokerCardProps(index) {
  if (index < pokerL.blackEnd) return { count: 3, color: "black", score: 1 };
  if (index < pokerL.blueEnd) return { count: 2, color: "blue", score: 2 };
  return { count: 1, color: "red", score: 3 };
}
function pokerInitDeck() {
  pokerDeck = [];
  pokerL.chars.forEach((char, i) => {
    const { count, color, score } = pokerCardProps(i);
    for (let k = 0; k < count; k++) pokerDeck.push({ char, color, score });
  });
  pokerDeck.sort(() => Math.random() - 0.5);
}
function pokerDealCards(n) {
  if (pokerDeck.length >= n) return pokerDeck.splice(0, n);
  return Array.from({ length: n }, () => pokerDrawRandom());
}
function pokerDrawRandom() {
  const pool = [];
  pokerL.chars.forEach((char, i) => {
    const { count, color, score } = pokerCardProps(i);
    for (let k = 0; k < count; k++) pool.push({ char, color, score });
  });
  return pool[Math.floor(Math.random() * pool.length)];
}

// ── ゲーム開始（ホスト） ──
function pokerHostStart(lang, guestList, hostName) {
  pokerLang = lang;
  pokerL = POKER_LANG_DATA[lang];
  pokerPlayerCount = 1 + guestList.length;
  pokerExchangeDoneCount = 0;
  pokerScoreDoneCount = 0;
  pokerRematchCount = 0;
  pokerGuestScores = {};
  guestList.forEach((g) => {
    pokerGuestScores[g.conn.peer] = { name: g.name, score: null, detail: null };
  });

  pokerInitDeck();
  // 各ゲストに手札を送る
  guestList.forEach((g) => {
    g.conn.send({
      type: "GAME_SELECTED",
      game: "poker",
      lang,
      hand: pokerDealCards(7),
    });
  });
  // 自分の手札
  pokerMyHand = pokerDealCards(7);
  pokerApplyLangUI();
  showScreen("poker-screen");
  document.getElementById("poker-room-id-display").innerText =
    pokerL.ui.roomLabel(lobbyRoomName);
  pokerResetUI();
  pokerRenderHand();
}

// ── ゲーム開始（ゲスト） ──
function pokerGuestStart(data) {
  pokerLang = data.lang;
  pokerL = POKER_LANG_DATA[data.lang];
  pokerMyHand = data.hand;
  pokerApplyLangUI();
  showScreen("poker-screen");
  document.getElementById("poker-room-id-display").innerText =
    pokerL.ui.roomLabel(lobbyRoomName);
  pokerResetUI();
  pokerRenderHand();
}

// ── UI適用 ──
function pokerApplyLangUI() {
  document.getElementById("poker-page-title").textContent = pokerL.ui.title;
  document.getElementById("poker-exchange-hint").textContent =
    pokerL.ui.exchangeHint;
  document.getElementById("poker-exchange-btn").textContent =
    pokerL.ui.exchangeBtn;
  document.getElementById("poker-word-hint").textContent = pokerL.ui.wordHint;
  document.getElementById("poker-hand-label").textContent = pokerL.ui.handLabel;
  document.getElementById("poker-word-input").placeholder =
    pokerL.ui.wordPlaceholder;
  document.getElementById("poker-submit-btn").textContent = pokerL.ui.submitBtn;
  document.getElementById("poker-finish-btn").textContent = pokerL.ui.finishBtn;
  document.getElementById("poker-col-name").textContent = pokerL.ui.colName;
  document.getElementById("poker-col-words").textContent = pokerL.ui.colWords;
  document.getElementById("poker-col-score").textContent = pokerL.ui.colScore;
  document.getElementById("poker-rematch-btn").textContent =
    pokerL.ui.rematchBtn;
}
function pokerResetUI() {
  pokerMyWords = [];
  pokerMyTotalScore = 0;
  pokerIFinished = false;
  pokerIWantRematch = false;
  pokerHasExchanged = false;
  document.getElementById("poker-result-section").style.display = "none";
  document.getElementById("poker-word-section").style.display = "none";
  document.getElementById("poker-exchange-section").style.display = "block";
  document.getElementById("poker-exchange-btn").disabled = false;
  document.getElementById("poker-exchange-status").innerText = "";
  document.getElementById("poker-word-list").innerHTML = "";
  document.getElementById("poker-word-input").value = "";
  document.getElementById("poker-word-input").disabled = false;
  document.getElementById("poker-submit-btn").disabled = false;
  document.getElementById("poker-finish-btn").disabled = false;
  document.getElementById("poker-loading-msg").style.display = "none";
  document.getElementById("poker-rematch-status").innerText = "";
  document.getElementById("poker-rematch-btn").disabled = false;
  document.getElementById("poker-my-hand").innerHTML = "";
  document.getElementById("poker-my-hand-final").innerHTML = "";
}

// ── 手札描画 ──
function pokerRenderHand() {
  const c = document.getElementById("poker-my-hand");
  c.innerHTML = "";
  pokerMyHand.forEach((card, i) => {
    const div = document.createElement("div");
    div.className = `card-tile ${card.color}`;
    div.innerText = card.char;
    div.onclick = () => div.classList.toggle("selected");
    div.dataset.index = i;
    c.appendChild(div);
  });
}
function pokerRenderHandFinal() {
  const c = document.getElementById("poker-my-hand-final");
  c.innerHTML = "";
  pokerMyHand.forEach((card) => {
    const div = document.createElement("div");
    div.className = `card-tile ${card.color}` + (card.used ? " used" : "");
    div.innerText = card.char;
    c.appendChild(div);
  });
}

// ── カード交換 ──
function pokerExchangeCards() {
  if (pokerHasExchanged) return;
  const selected = Array.from(
    document.querySelectorAll("#poker-my-hand .selected"),
  ).map((d) => parseInt(d.dataset.index));
  if (selected.length === 0 && !confirm(pokerL.ui.confirmNoExchange)) return;
  selected.forEach((i) => {
    pokerMyHand[i] = pokerDrawRandom();
  });
  pokerHasExchanged = true;
  document.getElementById("poker-exchange-btn").disabled = true;
  pokerRenderHand();
  if (lobbyIsHost) {
    pokerExchangeDoneCount++;
    pokerUpdateExchangeStatus();
    pokerCheckAllExchanged();
  } else {
    lobbyHostConn.send({ type: "EXCHANGE_DONE" });
    document.getElementById("poker-exchange-status").innerText =
      pokerL.ui.exchangeWait;
  }
}
function pokerUpdateExchangeStatus() {
  document.getElementById("poker-exchange-status").innerText =
    pokerL.ui.exchangeCount(pokerExchangeDoneCount, pokerPlayerCount);
}
function pokerCheckAllExchanged() {
  if (pokerExchangeDoneCount < pokerPlayerCount) return;
  lobbyBroadcast({ type: "ALL_EXCHANGED" });
  pokerShowWordPhase();
}
function pokerShowWordPhase() {
  document.getElementById("poker-exchange-section").style.display = "none";
  document.getElementById("poker-word-section").style.display = "block";
  pokerRenderHandFinal();
  document.getElementById("poker-word-input").focus();
}

// ── 単語入力 ──
async function pokerSubmitWord() {
  const input = document.getElementById("poker-word-input");
  let word = input.value.trim();
  if (!word) return;
  if (pokerLang === "en") word = word.toUpperCase();

  const handCopy = pokerMyHand.map((c) => ({ ...c }));
  let score = 0,
    valid = true;
  const usedIdx = [];
  for (const ch of word) {
    const i = handCopy.findIndex(
      (c) => c.char === ch && !c._tmpUsed && !c.used,
    );
    if (i === -1) {
      valid = false;
      break;
    }
    handCopy[i]._tmpUsed = true;
    score += handCopy[i].score;
    usedIdx.push(i);
  }
  if (!valid) {
    alert(pokerL.ui.invalidCard(word));
    input.focus();
    return;
  }

  if (pokerL.checkWord) {
    pokerSetLoading(true);
    const ok = await pokerL.checkWord(word);
    pokerSetLoading(false);
    if (!ok) {
      alert(pokerL.ui.invalidWord(word));
      input.focus();
      return;
    }
  }

  input.value = "";
  usedIdx.forEach((i) => {
    pokerMyHand[i].used = true;
  });
  pokerMyTotalScore += score;
  pokerMyWords.push({ word, score });
  pokerRenderHandFinal();
  pokerUpdateWordList();
  input.focus();
  if (pokerMyHand.filter((c) => !c.used).length === 0) {
    alert(pokerL.ui.allUsed);
    pokerFinishWords();
  }
}
function pokerSetLoading(on) {
  document.getElementById("poker-loading-msg").style.display = on
    ? "block"
    : "none";
  document.getElementById("poker-submit-btn").disabled = on;
  document.getElementById("poker-word-input").disabled = on;
}
function pokerUpdateWordList() {
  document.getElementById("poker-word-list").innerHTML = pokerMyWords
    .map((w) => pokerL.ui.wordRow(w.word, w.score))
    .join("<br>");
}
function pokerFinishWords() {
  if (pokerIFinished) return;
  pokerIFinished = true;
  document.getElementById("poker-word-input").disabled = true;
  document.getElementById("poker-submit-btn").disabled = true;
  document.getElementById("poker-finish-btn").disabled = true;
  const sep = pokerLang === "ja" ? "、" : ", ";
  const detail =
    pokerMyWords
      .map((w) => `${w.word}(${w.score}${pokerL.ui.scoreUnit})`)
      .join(sep) || pokerL.ui.noWord;
  if (lobbyIsHost) {
    pokerScoreDoneCount++;
    pokerCheckAllScored();
  } else {
    lobbyHostConn.send({ type: "SCORE", total: pokerMyTotalScore, detail });
  }
}
function pokerCheckAllScored() {
  if (pokerScoreDoneCount < pokerPlayerCount) return;
  const sep = pokerLang === "ja" ? "、" : ", ";
  const myDetail =
    pokerMyWords
      .map((w) => `${w.word}(${w.score}${pokerL.ui.scoreUnit})`)
      .join(sep) || pokerL.ui.noWord;
  const all = [
    { name: lobbyMyName, total: pokerMyTotalScore, detail: myDetail },
    ...Object.values(pokerGuestScores).map((g) => ({
      name: g.name,
      total: g.score ?? 0,
      detail: g.detail || pokerL.ui.noWord,
    })),
  ];
  all.sort((a, b) => b.total - a.total);
  lobbyBroadcast({ type: "RESULT", ranking: all });
  pokerShowResult(all);
}
function pokerShowResult(ranking) {
  document.getElementById("poker-word-section").style.display = "none";
  document.getElementById("poker-exchange-section").style.display = "none";
  document.getElementById("poker-result-section").style.display = "block";
  const tbody = document.getElementById("poker-ranking-body");
  tbody.innerHTML = "";
  ranking.forEach((p, i) => {
    const tr = document.createElement("tr");
    tr.className =
      (["rank1", "rank2", "rank3"][i] || "") +
      (p.name === lobbyMyName ? " me" : "");
    tr.innerHTML = `<td>${p.name}</td><td style="font-size:13px">${p.detail}</td><td>${p.total}${pokerL.ui.scoreUnit}</td>`;
    tbody.appendChild(tr);
  });
  const label = document.getElementById("poker-result-label");
  const myRank = ranking.findIndex((p) => p.name === lobbyMyName) + 1;
  const top = ranking[0].total,
    bot = ranking[ranking.length - 1].total;
  if (myRank === 1 && ranking.filter((p) => p.total === top).length === 1) {
    label.textContent = pokerL.ui.win;
    label.style.color = "#cc0000";
  } else if (
    myRank === ranking.length &&
    ranking.filter((p) => p.total === bot).length === 1
  ) {
    label.textContent = pokerL.ui.last;
    label.style.color = "#0066cc";
  } else {
    label.textContent = pokerL.ui.rank(myRank);
    label.style.color = "#333";
  }
}
function pokerRequestRematch() {
  pokerIWantRematch = true;
  document.getElementById("poker-rematch-btn").disabled = true;
  document.getElementById("poker-rematch-status").innerText =
    pokerL.ui.rematchWait;
  if (lobbyIsHost) {
    pokerRematchCount++;
    pokerCheckAllRematch();
  } else {
    lobbyHostConn.send({ type: "REMATCH_REQUEST" });
  }
}
function pokerCheckAllRematch() {
  const waiting = pokerPlayerCount - pokerRematchCount;
  if (waiting > 0) {
    document.getElementById("poker-rematch-status").innerText =
      pokerL.ui.rematchCount(waiting);
    return;
  }
  // 再戦：デッキを再生成して配り直す
  pokerExchangeDoneCount = 0;
  pokerScoreDoneCount = 0;
  pokerRematchCount = 0;
  Object.keys(pokerGuestScores).forEach((pid) => {
    pokerGuestScores[pid].score = null;
    pokerGuestScores[pid].detail = null;
  });
  pokerInitDeck();
  pokerMyHand = pokerDealCards(7);
  Object.entries(pokerGuestScores).forEach(([pid, g]) => {
    const conn = lobbyConns[pid]?.conn;
    if (conn) conn.send({ type: "REMATCH_START", hand: pokerDealCards(7) });
  });
  pokerResetUI();
  pokerRenderHand();
}

// ── ホスト受信（ポーカーゲーム中メッセージ） ──
function pokerHostReceive(peerId, data) {
  if (data.type === "EXCHANGE_DONE") {
    pokerExchangeDoneCount++;
    pokerUpdateExchangeStatus();
    pokerCheckAllExchanged();
  } else if (data.type === "SCORE") {
    if (pokerGuestScores[peerId]) {
      pokerGuestScores[peerId].score = data.total;
      pokerGuestScores[peerId].detail = data.detail;
    }
    pokerScoreDoneCount++;
    pokerCheckAllScored();
  } else if (data.type === "REMATCH_REQUEST") {
    pokerRematchCount++;
    pokerCheckAllRematch();
  }
}

// ── ゲスト受信（ポーカーゲーム中メッセージ） ──
function pokerGuestReceive(data) {
  if (data.type === "ALL_EXCHANGED") {
    pokerShowWordPhase();
  } else if (data.type === "RESULT") {
    pokerShowResult(data.ranking);
  } else if (data.type === "REMATCH_START") {
    pokerMyHand = data.hand;
    pokerResetUI();
    pokerRenderHand();
  }
}

// ── 言語選択ボタン（ロビー内のポーカー用） ──
function pokerSelectLang(l) {
  lobbySelectLang(l); // lobby.js に委譲
}
// poker.js の末尾などに追加
function pokerDestroy() {
  // 必要に応じたポーカーの状態リセット
  pokerResetUI();
}
