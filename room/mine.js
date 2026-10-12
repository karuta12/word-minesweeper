// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ■ 五十音マインスイーパー対戦（オンライン対応）
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const MINE_DEFAULT_CSV = `ジャンル,ワード
生き物,おおさんしょううお
地理・観光,ふじさん
作品・物語,せんとちひろのかみかくし
食べ物,すきやき
歴史・人物,おだのぶなが`;

const MINE_KANA_GRID = [
  ["わ", "ら", "や", "ま", "は", "な", "た", "さ", "か", "あ"],
  ["を", "り", "", "み", "ひ", "に", "ち", "し", "き", "い"],
  ["ん", "る", "ゆ", "む", "ふ", "ぬ", "つ", "す", "く", "う"],
  ["ー", "れ", "", "め", "へ", "ね", "て", "せ", "け", "え"],
  ["", "ろ", "よ", "も", "ほ", "の", "と", "そ", "こ", "お"],
];
const MINE_DAKUTEN_MAP = {
  が: "か",
  ぎ: "き",
  ぐ: "く",
  げ: "け",
  ご: "こ",
  ざ: "さ",
  じ: "し",
  ず: "す",
  ぜ: "せ",
  ぞ: "そ",
  だ: "た",
  ぢ: "ち",
  づ: "つ",
  で: "て",
  ど: "と",
  ば: "は",
  び: "ひ",
  ぶ: "ふ",
  べ: "へ",
  ぼ: "ほ",
  ぱ: "は",
  ぴ: "ひ",
  ぷ: "ふ",
  ぺ: "へ",
  ぽ: "ほ",
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
  ゔ: "う",
};

let mineQuestionsDB = [];
let mineCurrent = {}; // { genre, word }  ホストのみ word を持つ
let mineTurn = 1; // 現在のターン（1 or 2）
let mineSkipped = null;
let minePhase = "choose";
let mineCellsData = {};
let mineCanAnswer = { 1: true, 2: true };
let minePlayerNames = { 1: "プレイヤー1", 2: "プレイヤー2" };
let mineMyPlayerNum = 1; // 自分は P1(1) か P2(2) か
let mineWordLength = 0; // ゲスト用：答えの文字数
let mineGenre = ""; // ゲスト用：ジャンル

const MINE_TURN_TIME = 180;
let mineTimeLeft = MINE_TURN_TIME;
let mineTimerInterval = null;

let mineP1HintUsed = false;
let mineP2HintUsed = false;
let mineRevealedPos = {};

// ━━ CSV 読み込み（ホスト用） ━━
function mineParseCSV(text) {
  return text
    .trim()
    .split(/\r?\n/)
    .reduce((acc, line) => {
      const parts = line.split(",");
      if (parts.length >= 2) {
        const genre = parts[0].trim(),
          word = parts[1].trim();
        if (genre !== "ジャンル" && word !== "ワード" && genre && word)
          acc.push({ genre, word });
      }
      return acc;
    }, []);
}

async function mineInit() {
  try {
    const res = await fetch("word.csv");
    if (res.ok) {
      const loaded = mineParseCSV(await res.text());
      mineQuestionsDB =
        loaded.length > 0 ? loaded : mineParseCSV(MINE_DEFAULT_CSV);
    } else {
      mineQuestionsDB = mineParseCSV(MINE_DEFAULT_CSV);
    }
  } catch {
    mineQuestionsDB = mineParseCSV(MINE_DEFAULT_CSV);
  }
}

function mineHandleCSVFileSelect(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    const q = mineParseCSV(e.target.result);
    if (q.length > 0) {
      mineQuestionsDB = q;
      mineAddLog(`CSV から ${q.length} 件読み込みました。`);
      mineInitGame();
    } else {
      alert("CSVの読み込みに失敗しました。");
    }
  };
  reader.readAsText(file, "UTF-8");
  event.target.value = "";
}

// ━━ 問題選択・盤面生成（ホスト） ━━
function minePickQuestion() {
  if (mineQuestionsDB.length === 0)
    mineQuestionsDB = mineParseCSV(MINE_DEFAULT_CSV);
  return mineQuestionsDB[Math.floor(Math.random() * mineQuestionsDB.length)];
}

function mineExtractBombCounts(word) {
  const valid = MINE_KANA_GRID.flat().filter((c) => c !== "");
  return [...word].reduce((acc, ch) => {
    const c = MINE_DAKUTEN_MAP[ch] || ch;
    if (valid.includes(c)) acc[c] = (acc[c] || 0) + 1;
    return acc;
  }, {});
}

function mineBuildCellsData(word) {
  const cells = {};
  MINE_KANA_GRID.forEach((row) =>
    row.forEach((char) => {
      if (char)
        cells[char] = { char, isOpen: false, bombs: 0, neighborBombs: 0 };
    }),
  );
  Object.entries(mineExtractBombCounts(word)).forEach(([ch, n]) => {
    if (cells[ch]) cells[ch].bombs = n;
  });
  // 隣接爆弾数計算
  for (let r = 0; r < MINE_KANA_GRID.length; r++) {
    for (let c = 0; c < MINE_KANA_GRID[r].length; c++) {
      const ch = MINE_KANA_GRID[r][c];
      if (!ch) continue;
      let total = 0;
      for (let dr = -1; dr <= 1; dr++)
        for (let dc = -1; dc <= 1; dc++) {
          if (!dr && !dc) continue;
          const nr = r + dr,
            nc = c + dc;
          if (
            nr >= 0 &&
            nr < MINE_KANA_GRID.length &&
            nc >= 0 &&
            nc < MINE_KANA_GRID[nr].length
          ) {
            const n2 = MINE_KANA_GRID[nr][nc];
            if (n2 && cells[n2]) total += cells[n2].bombs;
          }
        }
      cells[ch].neighborBombs = total;
    }
  }
  return cells;
}

// ━━ ゲーム開始（ホスト） ━━
function mineHostStart(names, question, cellsData) {
  mineMyPlayerNum = 1;
  minePlayerNames = names;
  mineCurrent = question;
  mineCellsData = cellsData;
  mineGenre = question.genre;
  mineWordLength = question.word.length;
  mineTurn = 1;
  mineSkipped = null;
  minePhase = "choose";
  mineP1HintUsed = false;
  mineP2HintUsed = false;
  mineRevealedPos = {};
  mineCanAnswer = { 1: true, 2: true };

  document.getElementById("mine-genre-badge").textContent =
    `ジャンル: ${question.genre}`;
  document.getElementById("mine-target-length").textContent =
    question.word.length;
  document.getElementById("mine-result-modal").classList.add("hidden");
  showScreen("mine-screen");
  mineRenderBoard();
  mineRenderWordSlots();
  mineUpdateUI();
  mineAddLog(`新しい問題が開始されました。（文字数: ${question.word.length}）`);
  mineStartTimer();
}

// ━━ ゲーム開始（ゲスト） ━━
function mineGuestStart(data) {
  mineMyPlayerNum = data.playerNum;
  minePlayerNames = data.names;
  mineCellsData = data.cellsData;
  mineGenre = data.genre;
  mineWordLength = data.wordLength;
  mineCurrent = { genre: data.genre, word: null }; // word はゲストは知らない
  mineTurn = 1;
  mineSkipped = null;
  minePhase = "choose";
  mineP1HintUsed = false;
  mineP2HintUsed = false;
  mineRevealedPos = {};
  mineCanAnswer = { 1: true, 2: true };

  document.getElementById("mine-genre-badge").textContent =
    `ジャンル: ${data.genre}`;
  document.getElementById("mine-target-length").textContent = data.wordLength;
  const modal = document.getElementById("mine-result-modal");
  modal.classList.add("hidden");
  // ゲスト待機メッセージを削除
  const waitMsg = document.getElementById("mine-guest-wait-msg");
  if (waitMsg) waitMsg.remove();
  // ボタンを非表示に戻す（次の勝利時に再制御）
  const btn = modal.querySelector("button");
  if (btn) btn.style.display = "";
  showScreen("mine-screen");
  mineRenderBoard();
  mineRenderWordSlots();
  mineUpdateUI();
  mineAddLog(`新しい問題が開始されました。（文字数: ${data.wordLength}）`);
  // ゲストはタイマーを表示するが制御しない（ホストが管理）
  mineUpdateTimerDisplay();
}

// ━━ タイマー（ホストのみ制御） ━━
function mineStartTimer() {
  mineStopTimer();
  mineTimeLeft = MINE_TURN_TIME;
  mineUpdateTimerDisplay();
  if (!lobbyIsHost) return; // ゲストはタイマーを動かさない
  mineTimerInterval = setInterval(() => {
    mineTimeLeft--;
    mineUpdateTimerDisplay();
    // ゲストにも時間を同期（毎秒は重いので10秒ごと）
    if (mineTimeLeft % 10 === 0)
      lobbyBroadcast({ type: "MINE_TIMER", timeLeft: mineTimeLeft });
    if (mineTimeLeft <= 0) mineHandleTimeout();
  }, 1000);
}
function mineStopTimer() {
  if (mineTimerInterval) {
    clearInterval(mineTimerInterval);
    mineTimerInterval = null;
  }
}
function mineUpdateTimerDisplay() {
  const m = Math.floor(mineTimeLeft / 60),
    s = mineTimeLeft % 60;
  const el = document.getElementById("mine-timer-display");
  const box = document.getElementById("mine-timer-box");
  if (el)
    el.textContent = `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  if (box) {
    mineTimeLeft <= 30
      ? box.classList.add("timer-danger")
      : box.classList.remove("timer-danger");
  }
}
function mineHandleTimeout() {
  // ホストのみ実行
  mineStopTimer();
  mineAddLog(
    `⏱️ ${minePlayerNames[mineTurn]}の制限時間が切れました！強制的にマスを開けます。`,
  );
  const open = Object.keys(mineCellsData).filter(
    (c) => !mineCellsData[c].isOpen,
  );
  if (open.length > 0) {
    const rc = open[Math.floor(Math.random() * open.length)];
    mineAddLog(`🎲 時間切れ強制開放: 「${rc}」`);
    mineProcessCellOpen(rc);
  } else {
    mineEndTurn();
  }
}

// ━━ 盤面描画 ━━
function mineRenderBoard() {
  const boardEl = document.getElementById("mine-board");
  if (!boardEl) return;
  boardEl.innerHTML = "";
  MINE_KANA_GRID.forEach((row) =>
    row.forEach((char) => {
      const div = document.createElement("div");
      if (!char) {
        div.className = "w-full aspect-square";
        boardEl.appendChild(div);
        return;
      }
      const data = mineCellsData[char];
      let bg =
        "bg-white hover:bg-indigo-50 text-indigo-900 border-indigo-200 cursor-pointer";
      if (data.isOpen)
        bg =
          data.bombs > 0
            ? "bg-rose-500 text-white border-rose-600 shadow-inner"
            : "bg-slate-200 text-slate-700 border-slate-300";
      div.className = `w-full aspect-square rounded-lg sm:rounded-xl flex flex-col items-center justify-center font-bold text-xs sm:text-base transition select-none shadow-sm border ${bg}`;
      if (data.isOpen) {
        if (data.bombs > 0) {
          div.innerHTML = `<span class="text-[9px] sm:text-xs font-black">${data.bombs > 1 ? `💣×${data.bombs}` : "💣"}</span><span class="text-[10px] sm:text-xs font-black">${char}</span>`;
        } else {
          div.innerHTML = `<span>${char}</span><span class="text-[10px] sm:text-xs text-indigo-600 font-black">${data.neighborBombs || ""}</span>`;
        }
      } else {
        div.innerHTML = `<span>${char}</span>`;
        div.onclick = () => mineHandleCellClick(char);
      }
      boardEl.appendChild(div);
    }),
  );
}

// ━━ スロット表示 ━━
function mineRenderWordSlots() {
  const container = document.getElementById("mine-word-slots");
  const label = document.getElementById("mine-hint-status-label");
  if (!container) return;
  container.innerHTML = "";
  const len = lobbyIsHost ? mineCurrent.word?.length : mineWordLength;
  if (!len) return;
  const hasRev = Object.keys(mineRevealedPos).length > 0;
  if (label) {
    label.textContent = hasRev
      ? "💡 ヒントで開示された文字を表示中"
      : "爆弾マスを開けるとヒントで位置を特定可能";
    label.className = hasRev ? "text-amber-400 font-bold" : "text-slate-400";
  }
  for (let i = 0; i < len; i++) {
    const slot = document.createElement("div");
    slot.className =
      "w-7 h-8 sm:w-8 sm:h-9 rounded-md flex items-center justify-center font-bold text-xs sm:text-sm shadow-sm transition border ";
    if (mineRevealedPos[i]) {
      slot.className +=
        "bg-amber-400 text-slate-900 border-amber-300 font-black";
      slot.textContent = mineRevealedPos[i];
    } else {
      slot.className += "bg-slate-700/80 text-slate-400 border-slate-600";
      slot.textContent = "＊";
    }
    container.appendChild(slot);
  }
}

// ━━ ログ ━━
function mineAddLog(text) {
  const box = document.getElementById("mine-log-box");
  if (!box) return;
  const div = document.createElement("div");
  div.textContent = `[ターン${mineTurn}: ${minePlayerNames[mineTurn]}] ${text}`;
  box.prepend(div);
}

// ━━ UI更新 ━━
function mineUpdateUI() {
  if (mineSkipped === mineTurn) {
    mineAddLog(`${minePlayerNames[mineTurn]}は1回休みです！`);
    mineSkipped = null;
    mineEndTurn();
    return;
  }
  const statusEl = document.getElementById("mine-status-turn");
  if (statusEl) statusEl.textContent = `${minePlayerNames[mineTurn]}のターン`;

  ["p1", "p2"].forEach((p, i) => {
    const num = i + 1,
      box = document.getElementById(`mine-${p}-box`);
    if (!box) return;
    box.className =
      mineTurn === num
        ? "p-2.5 rounded-xl bg-indigo-100 border-2 border-indigo-500 shadow flex flex-col items-center justify-between gap-1.5 opacity-100"
        : "p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex flex-col items-center justify-between gap-1.5 opacity-60";
  });

  // ヒントボタン
  [1, 2].forEach((num) => {
    const btn = document.getElementById(`mine-p${num}-hint-btn`);
    const used = num === 1 ? mineP1HintUsed : mineP2HintUsed;
    if (btn) {
      btn.disabled = used || mineTurn !== num || mineMyPlayerNum !== num;
      btn.textContent = used ? "💡 ヒント使用済" : "💡 位置ヒント (残り1回)";
    }
  });

  const promptEl = document.getElementById("mine-action-prompt");
  const controlsEl = document.getElementById("mine-action-controls");
  if (!promptEl || !controlsEl) return;

  const isMyTurn = mineTurn === mineMyPlayerNum;

  if (!isMyTurn) {
    promptEl.innerHTML = `<span class="text-base">⏳</span> <span>${minePlayerNames[mineTurn]}のターンです。お待ちください…</span>`;
    controlsEl.innerHTML = "";
    return;
  }

  if (minePhase === "choose") {
    const guessBtn = mineCanAnswer[mineTurn]
      ? `<button onclick="mineChooseAction('guess')" class="bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white px-3 py-1.5 rounded-xl font-bold text-xs sm:text-sm shadow transition whitespace-nowrap shrink-0">💡 ワードを答える</button>`
      : `<span class="text-xs text-slate-400 italic whitespace-nowrap shrink-0">💡 回答権なし（マスを開いてください）</span>`;
    promptEl.innerHTML = `<span class="text-base">🎮</span> <span>${minePlayerNames[mineTurn]}の番です。アクションを選択してください</span>`;
    controlsEl.innerHTML = `<button onclick="mineChooseAction('open')" class="bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white px-3 py-1.5 rounded-xl font-bold text-xs sm:text-sm shadow transition whitespace-nowrap shrink-0">🔍 マスを開く</button>${guessBtn}`;
  } else if (minePhase === "open") {
    promptEl.innerHTML = `<span class="text-base">🔍</span> <span>${minePlayerNames[mineTurn]}: 盤面のマスを1つ押してください</span>`;
    controlsEl.innerHTML = `<button onclick="mineCancelGuess()" class="bg-slate-200 hover:bg-slate-300 text-slate-700 px-3 py-1.5 rounded-xl font-bold text-xs sm:text-sm transition whitespace-nowrap shrink-0">↩ キャンセル</button>`;
  } else if (minePhase === "guess") {
    promptEl.innerHTML = `<span class="text-base">💡</span> <span>ひらがなで正解を入力:</span>`;
    controlsEl.innerHTML = `
      <input type="text" id="mine-guess-input" placeholder="ワードを入力"
        class="px-2.5 py-1 border border-slate-300 rounded-lg text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 w-32 sm:w-44">
      <button onclick="mineSubmitGuess()" class="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg font-bold text-xs sm:text-sm shadow transition whitespace-nowrap shrink-0">回答</button>
      <button onclick="mineCancelGuess()" class="bg-slate-200 hover:bg-slate-300 text-slate-700 px-2 py-1.5 rounded-lg font-bold text-xs transition whitespace-nowrap shrink-0">戻る</button>`;
    setTimeout(() => {
      const inp = document.getElementById("mine-guess-input");
      if (inp) inp.focus();
    }, 50);
  }
}

// ━━ アクション ━━
function mineChooseAction(action) {
  if (mineTurn !== mineMyPlayerNum) return;
  if (action === "open") {
    minePhase = "open";
    mineUpdateUI();
    mineAddLog(`${minePlayerNames[mineTurn]}: マスを選んでください`);
  } else {
    minePhase = "guess";
    mineUpdateUI();
  }
}
function mineCancelGuess() {
  minePhase = "choose";
  mineUpdateUI();
}

function mineHandleCellClick(char) {
  if (minePhase !== "open" || mineTurn !== mineMyPlayerNum) return;
  if (lobbyIsHost) {
    mineProcessCellOpen(char);
  } else {
    lobbyHostConn.send({ type: "MINE_OPEN", char });
    minePhase = "choose";
    mineUpdateUI();
  }
}

function mineProcessCellOpen(char) {
  const data = mineCellsData[char];
  if (!data || data.isOpen) return;
  data.isOpen = true;
  if (data.bombs > 0) {
    mineAddLog(
      `${minePlayerNames[mineTurn]}が爆弾（${char}・${data.bombs}個分）を踏んだ！ 1回休み！`,
    );
    mineSkipped = mineTurn;
  } else {
    if (data.neighborBombs === 0) {
      mineRevealCellRecursive(char);
      mineAddLog(
        `${minePlayerNames[mineTurn]}が「${char}」を開いた（連鎖展開）`,
      );
    } else {
      mineAddLog(
        `${minePlayerNames[mineTurn]}が「${char}」を開いた（周囲爆弾数: ${data.neighborBombs}）`,
      );
    }
  }
  // ホストが全員に盤面を送信
  lobbyBroadcast({
    type: "MINE_CELL_OPENED",
    cellsData: mineCellsData,
    skipped: mineSkipped,
  });
  mineRenderBoard();
  mineEndTurn();
}

function mineRevealCellRecursive(startChar) {
  if (
    !startChar ||
    !mineCellsData[startChar] ||
    mineCellsData[startChar].isOpen ||
    mineCellsData[startChar].bombs > 0
  )
    return;
  mineCellsData[startChar].isOpen = true;
  if (mineCellsData[startChar].neighborBombs === 0) {
    let rPos = -1,
      cPos = -1;
    for (let r = 0; r < MINE_KANA_GRID.length && rPos === -1; r++)
      for (let c = 0; c < MINE_KANA_GRID[r].length; c++)
        if (MINE_KANA_GRID[r][c] === startChar) {
          rPos = r;
          cPos = c;
          break;
        }
    if (rPos !== -1) {
      for (let dr = -1; dr <= 1; dr++)
        for (let dc = -1; dc <= 1; dc++) {
          if (!dr && !dc) continue;
          const nr = rPos + dr,
            nc = cPos + dc;
          if (
            nr >= 0 &&
            nr < MINE_KANA_GRID.length &&
            nc >= 0 &&
            nc < MINE_KANA_GRID[nr].length
          ) {
            const next = MINE_KANA_GRID[nr][nc];
            if (
              next &&
              mineCellsData[next] &&
              !mineCellsData[next].isOpen &&
              mineCellsData[next].bombs === 0
            )
              mineRevealCellRecursive(next);
          }
        }
    }
  }
}

function mineSubmitGuess() {
  if (mineTurn !== mineMyPlayerNum) return;
  const inputEl = document.getElementById("mine-guess-input");
  if (!inputEl) return;
  const val = inputEl.value.trim();
  if (!val) return;

  if (lobbyIsHost) {
    // ホストは自分で正誤判定
    mineJudgeAnswer(val, mineMyPlayerNum);
  } else {
    // ゲストはホストに送って判定してもらう
    lobbyHostConn.send({ type: "MINE_GUESS", answer: val });
    minePhase = "choose";
    mineUpdateUI();
  }
}

function mineJudgeAnswer(answer, playerNum) {
  if (answer === mineCurrent.word) {
    mineAddLog(`🎉 ${minePlayerNames[playerNum]}がワード「${answer}」を正解！`);
    lobbyBroadcast({
      type: "MINE_GUESS_RESULT",
      correct: true,
      winner: playerNum,
      word: mineCurrent.word,
    });
    mineTriggerVictory(playerNum);
  } else {
    mineAddLog(
      `❌ ${minePlayerNames[playerNum]}の回答「${answer}」は不正解。回答権を失います。`,
    );
    mineCanAnswer[playerNum] = false;
    lobbyBroadcast({ type: "MINE_GUESS_RESULT", correct: false, playerNum });
    minePhase = "choose";
    mineUpdateUI();
  }
}

function mineEndTurn() {
  mineStopTimer();
  minePhase = "choose";
  mineTurn = mineTurn === 1 ? 2 : 1;
  mineCanAnswer[mineTurn] = true;
  // ホストがターン交代を全員に通知
  if (lobbyIsHost) {
    lobbyBroadcast({
      type: "MINE_TURN_CHANGE",
      turn: mineTurn,
      skipped: !!mineSkipped,
    });
  }
  mineUpdateUI();
  mineStartTimer();
}

function mineTriggerPlayerHint(num) {
  if (mineTurn !== num || mineMyPlayerNum !== num) {
    mineAddLog(`現在は${minePlayerNames[mineTurn]}のターンです。`);
    return;
  }
  const used = num === 1 ? mineP1HintUsed : mineP2HintUsed;
  if (used) {
    mineAddLog(`${minePlayerNames[num]}は既にヒントを使用しています。`);
    return;
  }

  if (lobbyIsHost) {
    mineProcessHint(num);
  } else {
    lobbyHostConn.send({ type: "MINE_HINT_REQUEST" });
  }
}

function mineProcessHint(num) {
  const word = mineCurrent.word;
  const openBombs = Object.keys(mineCellsData).filter(
    (c) => mineCellsData[c].isOpen && mineCellsData[c].bombs > 0,
  );
  if (openBombs.length === 0) {
    mineAddLog("⚠️ 爆弾マスがまだ開いていません！");
    return;
  }
  const unrev = openBombs.filter((ch) => {
    for (let i = 0; i < word.length; i++) {
      const clean = MINE_DAKUTEN_MAP[word[i]] || word[i];
      if (clean === ch && !mineRevealedPos[i]) return true;
    }
    return false;
  });
  if (unrev.length === 0) {
    mineAddLog("⚠️ 現在開いている爆弾マスの位置はすべて開示済みです！");
    return;
  }
  const chosen = unrev[Math.floor(Math.random() * unrev.length)];
  for (let i = 0; i < word.length; i++) {
    const clean = MINE_DAKUTEN_MAP[word[i]] || word[i];
    if (clean === chosen) mineRevealedPos[i] = word[i];
  }
  if (num === 1) mineP1HintUsed = true;
  else mineP2HintUsed = true;
  let pattern = "";
  for (let i = 0; i < word.length; i++)
    pattern += mineRevealedPos[i] ? mineRevealedPos[i] : "＊";
  mineAddLog(
    `💡 ${minePlayerNames[num]}が位置ヒント使用！「${chosen}」の位置: [ ${pattern} ]`,
  );
  // 全員に同期
  lobbyBroadcast({
    type: "MINE_HINT_REVEAL",
    revealedPositions: mineRevealedPos,
    hintPlayer: num,
  });
  mineRenderWordSlots();
  mineUpdateUI();
}

function mineTriggerVictory(winner) {
  mineStopTimer();
  const word = mineCurrent.word || "（答え）";
  document.getElementById("mine-result-title").textContent =
    `${minePlayerNames[winner]}の勝利！`;
  document.getElementById("mine-result-message").textContent =
    `お題「${word}」を見事に当てました！`;
  // ホストのみ「もう一度プレイする」ボタンを表示
  const btn = document.querySelector("#mine-result-modal button");
  if (btn) {
    if (lobbyIsHost) {
      btn.style.display = "";
      btn.textContent = "もう一度プレイする";
    } else {
      btn.style.display = "none";
      const waitMsg = document.getElementById("mine-result-message");
      const waitDiv = document.createElement("p");
      waitDiv.id = "mine-guest-wait-msg";
      waitDiv.style.cssText = "margin-top:12px;color:#888;font-size:14px;";
      waitDiv.textContent = "⏳ ホストが次の問題を開始するまでお待ちください…";
      if (!document.getElementById("mine-guest-wait-msg")) {
        waitMsg.after(waitDiv);
      }
    }
  }
  document.getElementById("mine-result-modal").classList.remove("hidden");
}

// ━━ ホスト受信（マインスイーパーゲーム中） ━━
function mineHostReceive(peerId, data) {
  if (data.type === "MINE_OPEN") {
    mineProcessCellOpen(data.char);
  } else if (data.type === "MINE_GUESS") {
    mineJudgeAnswer(data.answer, 2); // ゲストは常にP2
  } else if (data.type === "MINE_HINT_REQUEST") {
    mineProcessHint(2);
  }
}

// ━━ ゲスト受信（マインスイーパーゲーム中） ━━
function mineGuestReceive(data) {
  if (data.type === "MINE_CELL_OPENED") {
    mineCellsData = data.cellsData;
    mineSkipped = data.skipped || null;
    mineRenderBoard();
  } else if (data.type === "MINE_TURN_CHANGE") {
    mineTurn = data.turn;
    mineCanAnswer[mineTurn] = true;
    if (data.skipped) mineSkipped = null;
    mineUpdateUI();
  } else if (data.type === "MINE_GUESS_RESULT") {
    if (data.correct) {
      mineTriggerVictory(data.winner);
    } else {
      mineCanAnswer[data.playerNum] = false;
      mineAddLog(`❌ ${minePlayerNames[data.playerNum]}の回答は不正解でした。`);
      minePhase = "choose";
      mineUpdateUI();
    }
  } else if (data.type === "MINE_HINT_REVEAL") {
    mineRevealedPos = data.revealedPositions;
    if (data.hintPlayer === 1) mineP1HintUsed = true;
    else mineP2HintUsed = true;
    mineRenderWordSlots();
    mineUpdateUI();
  } else if (data.type === "MINE_TIMER") {
    mineTimeLeft = data.timeLeft;
    mineUpdateTimerDisplay();
  }
}

// ━━ 問題変更（ホストのみ） ━━
function mineInitGame() {
  if (!lobbyIsHost) return;
  const q = minePickQuestion();
  const cells = mineBuildCellsData(q.word);
  const guestList = Object.values(lobbyConns);
  const names = { 1: lobbyMyName, 2: guestList[0]?.name || "P2" };
  guestList.forEach((g) => {
    g.conn.send({
      type: "GAME_SELECTED",
      game: "mine",
      playerNum: 2,
      names,
      genre: q.genre,
      wordLength: q.word.length,
      cellsData: cells,
    });
  });
  mineHostStart(names, q, cells);
}

