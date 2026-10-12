// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ■ 五十音マインスイーパー対戦
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const MINE_DEFAULT_CSV = `ジャンル,ワード
生き物,おおさんしょううお
地理・観光,ふじさん
作品・物語,せんとちひろのかみかくし
食べ物,すきやき
歴史・人物,おだのぶなが`;

const MINE_KANA_GRID = [
  ["わ","ら","や","ま","は","な","た","さ","か","あ"],
  ["を","り","",  "み","ひ","に","ち","し","き","い"],
  ["ん","る","ゆ","む","ふ","ぬ","つ","す","く","う"],
  ["ー","れ","",  "め","へ","ね","て","せ","け","え"],
  ["",  "ろ","よ","も","ほ","の","と","そ","こ","お"]
];

const MINE_DAKUTEN_MAP = {
  'が':'か','ぎ':'き','ぐ':'く','げ':'け','ご':'こ',
  'ざ':'さ','じ':'し','ず':'す','ぜ':'せ','ぞ':'そ',
  'だ':'た','ぢ':'ち','づ':'つ','で':'て','ど':'と',
  'ば':'は','び':'ひ','ぶ':'ふ','べ':'へ','ぼ':'ほ',
  'ぱ':'は','ぴ':'ひ','ぷ':'ふ','ぺ':'へ','ぽ':'ほ',
  'ぁ':'あ','ぃ':'い','ぅ':'う','ぇ':'え','ぉ':'お',
  'っ':'つ','ゃ':'や','ゅ':'ゆ','ょ':'よ','ゎ':'わ','ゔ':'う'
};

let mineQuestionsDB = [];
let mineCurrent = {};
let mineTurn = 1;
let mineSkipped = null;
let minePhase = 'choose'; // 'choose' | 'open' | 'guess'
let mineCellsData = {};
let mineCanAnswer = { 1: true, 2: true };
let minePlayerNames = { 1: 'プレイヤー1', 2: 'プレイヤー2' };

const MINE_TURN_TIME = 180; // 秒
let mineTimeLeft = MINE_TURN_TIME;
let mineTimerInterval = null;

let mineP1HintUsed = false;
let mineP2HintUsed = false;
let mineRevealedPos = {};

// ── 初期化エントリポイント ──
function mineInit() {
  mineAutoLoadCSV();
}

// ── プレイヤー名変更 ──
function mineUpdatePlayerName(num) {
  const input = document.getElementById(`mine-p${num}-name-input`);
  if (!input) return;
  const name = input.value.trim();
  if (!name) { alert('プレイヤー名を入力してください。'); return; }
  minePlayerNames[num] = name;
  document.getElementById(`mine-p${num}-display-name`).textContent = name;
  mineAddLog(`プレイヤー${num}の名前が「${name}」に変更されました。`);
  mineUpdateUI();
}

// ── タイマー ──
function mineStartTimer() {
  mineStopTimer();
  mineTimeLeft = MINE_TURN_TIME;
  mineUpdateTimerDisplay();
  mineTimerInterval = setInterval(() => {
    mineTimeLeft--;
    mineUpdateTimerDisplay();
    if (mineTimeLeft <= 0) mineHandleTimeout();
  }, 1000);
}

function mineStopTimer() {
  if (mineTimerInterval) { clearInterval(mineTimerInterval); mineTimerInterval = null; }
}

function mineUpdateTimerDisplay() {
  const m = Math.floor(mineTimeLeft / 60);
  const s = mineTimeLeft % 60;
  const el  = document.getElementById('mine-timer-display');
  const box = document.getElementById('mine-timer-box');
  if (el)  el.textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  if (box) {
    if (mineTimeLeft <= 30) box.classList.add('timer-danger');
    else                    box.classList.remove('timer-danger');
  }
}

function mineHandleTimeout() {
  mineStopTimer();
  mineAddLog(`⏱️ ${minePlayerNames[mineTurn]}の制限時間が切れました！強制的にマスを開けます。`);
  const open = Object.keys(mineCellsData).filter(c => !mineCellsData[c].isOpen);
  if (open.length > 0) {
    const rc = open[Math.floor(Math.random() * open.length)];
    mineAddLog(`🎲 時間切れ強制開放: 「${rc}」が開かれました。`);
    mineProcessCellOpen(rc);
  } else {
    mineEndTurn();
  }
}

// ── CSV 読み込み ──
function mineParseCSV(text) {
  const lines = text.trim().split(/\r?\n/);
  const parsed = [];
  for (const line of lines) {
    const parts = line.split(',');
    if (parts.length >= 2) {
      const genre = parts[0].trim(), word = parts[1].trim();
      if (genre === 'ジャンル' || word === 'ワード') continue;
      if (genre && word) parsed.push({ genre, word });
    }
  }
  return parsed;
}

async function mineAutoLoadCSV() {
  try {
    const res = await fetch('word.csv');
    if (res.ok) {
      const text = await res.text();
      const loaded = mineParseCSV(text);
      if (loaded.length > 0) {
        mineQuestionsDB = loaded;
        mineAddLog(`word.csv から ${loaded.length} 件読み込みました。`);
      } else {
        mineQuestionsDB = mineParseCSV(MINE_DEFAULT_CSV);
      }
    } else {
      mineQuestionsDB = mineParseCSV(MINE_DEFAULT_CSV);
    }
  } catch (e) {
    mineQuestionsDB = mineParseCSV(MINE_DEFAULT_CSV);
  }
  mineInitGame();
}

function mineHandleCSVFileSelect(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    const q = mineParseCSV(e.target.result);
    if (q.length > 0) {
      mineQuestionsDB = q;
      mineAddLog(`CSV から ${q.length} 件読み込みました。`);
      mineInitGame();
    } else {
      alert('CSVの読み込みに失敗しました。「ジャンル,ワード」の形式か確認してください。');
    }
  };
  reader.readAsText(file, 'UTF-8');
  event.target.value = '';
}

// ── ログ ──
function mineAddLog(text) {
  const box = document.getElementById('mine-log-box');
  if (!box) return;
  const div = document.createElement('div');
  div.textContent = `[ターン${mineTurn}: ${minePlayerNames[mineTurn]}] ${text}`;
  box.prepend(div);
}

// ── ゲーム初期化 ──
function mineExtractBombCounts(word) {
  const counts = {};
  const valid = MINE_KANA_GRID.flat().filter(c => c !== '');
  for (const char of word) {
    const clean = MINE_DAKUTEN_MAP[char] || char;
    if (valid.includes(clean)) counts[clean] = (counts[clean] || 0) + 1;
  }
  return counts;
}

function mineInitGame() {
  mineStopTimer();
  if (mineQuestionsDB.length === 0) mineQuestionsDB = mineParseCSV(MINE_DEFAULT_CSV);

  const q = mineQuestionsDB[Math.floor(Math.random() * mineQuestionsDB.length)];
  mineCurrent = q;

  document.getElementById('mine-genre-badge').textContent   = `ジャンル: ${q.genre}`;
  document.getElementById('mine-target-length').textContent = q.word.length;

  mineTurn = 1; mineSkipped = null; minePhase = 'choose';
  mineP1HintUsed = false; mineP2HintUsed = false; mineRevealedPos = {};
  mineCanAnswer = { 1: true, 2: true };

  mineCellsData = {};
  MINE_KANA_GRID.forEach(row => row.forEach(char => {
    if (char) mineCellsData[char] = { char, isOpen: false, bombs: 0, neighborBombs: 0 };
  }));

  const bombCounts = mineExtractBombCounts(q.word);
  for (const [char, cnt] of Object.entries(bombCounts)) {
    if (mineCellsData[char]) mineCellsData[char].bombs = cnt;
  }

  mineCalcNeighbors();
  document.getElementById('mine-result-modal').classList.add('hidden');
  mineRenderBoard();
  mineRenderWordSlots();
  mineUpdateUI();
  mineAddLog(`新しい問題が開始されました。（文字数: ${q.word.length}）`);
  mineStartTimer();
}

function mineCalcNeighbors() {
  for (let r = 0; r < MINE_KANA_GRID.length; r++) {
    for (let c = 0; c < MINE_KANA_GRID[r].length; c++) {
      const char = MINE_KANA_GRID[r][c];
      if (!char) continue;
      let total = 0;
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue;
          const nr = r + dr, nc = c + dc;
          if (nr >= 0 && nr < MINE_KANA_GRID.length && nc >= 0 && nc < MINE_KANA_GRID[nr].length) {
            const nc2 = MINE_KANA_GRID[nr][nc];
            if (nc2 && mineCellsData[nc2]) total += mineCellsData[nc2].bombs;
          }
        }
      }
      mineCellsData[char].neighborBombs = total;
    }
  }
}

function mineRevealCell(startChar) {
  if (!startChar || !mineCellsData[startChar] || mineCellsData[startChar].isOpen || mineCellsData[startChar].bombs > 0) return;
  mineCellsData[startChar].isOpen = true;
  if (mineCellsData[startChar].neighborBombs === 0) {
    let rPos = -1, cPos = -1;
    for (let r = 0; r < MINE_KANA_GRID.length; r++) {
      for (let c = 0; c < MINE_KANA_GRID[r].length; c++) {
        if (MINE_KANA_GRID[r][c] === startChar) { rPos = r; cPos = c; break; }
      }
      if (rPos !== -1) break;
    }
    if (rPos !== -1) {
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue;
          const nr = rPos + dr, nc = cPos + dc;
          if (nr >= 0 && nr < MINE_KANA_GRID.length && nc >= 0 && nc < MINE_KANA_GRID[nr].length) {
            const next = MINE_KANA_GRID[nr][nc];
            if (next && mineCellsData[next] && !mineCellsData[next].isOpen && mineCellsData[next].bombs === 0) {
              mineRevealCell(next);
            }
          }
        }
      }
    }
  }
}

// ── 位置ヒント ──
function mineTriggerPlayerHint(num) {
  if (mineTurn !== num) { mineAddLog(`現在は${minePlayerNames[mineTurn]}のターンです。`); return; }
  if ((num === 1 && mineP1HintUsed) || (num === 2 && mineP2HintUsed)) {
    mineAddLog(`${minePlayerNames[num]}は既にヒントを使用しています。`); return;
  }
  const openBombs = Object.keys(mineCellsData).filter(c => mineCellsData[c].isOpen && mineCellsData[c].bombs > 0);
  if (openBombs.length === 0) { mineAddLog('⚠️ 爆弾マスがまだ開いていません！'); return; }
  const word = mineCurrent.word;
  const unrev = openBombs.filter(char => {
    for (let i = 0; i < word.length; i++) {
      const clean = MINE_DAKUTEN_MAP[word[i]] || word[i];
      if (clean === char && !mineRevealedPos[i]) return true;
    }
    return false;
  });
  if (unrev.length === 0) { mineAddLog('⚠️ 現在開いている爆弾マスの位置はすべて開示済みです！'); return; }
  const chosen = unrev[Math.floor(Math.random() * unrev.length)];
  for (let i = 0; i < word.length; i++) {
    const clean = MINE_DAKUTEN_MAP[word[i]] || word[i];
    if (clean === chosen) mineRevealedPos[i] = word[i];
  }
  if (num === 1) mineP1HintUsed = true; else mineP2HintUsed = true;
  let pattern = '';
  for (let i = 0; i < word.length; i++) pattern += mineRevealedPos[i] ? mineRevealedPos[i] : '＊';
  mineAddLog(`💡 ${minePlayerNames[num]}が位置ヒント使用！「${chosen}」の位置: [ ${pattern} ]`);
  mineRenderWordSlots(); mineUpdateUI();
}

// ── スロット表示 ──
function mineRenderWordSlots() {
  const container = document.getElementById('mine-word-slots');
  const statusLabel = document.getElementById('mine-hint-status-label');
  if (!container) return;
  container.innerHTML = '';
  if (!mineCurrent.word) return;
  const word = mineCurrent.word;
  const hasRev = Object.keys(mineRevealedPos).length > 0;
  if (statusLabel) {
    statusLabel.textContent = hasRev ? '💡 ヒントで開示された文字を表示中' : '爆弾マスを開けるとヒントで位置を特定可能';
    statusLabel.className   = hasRev ? 'text-amber-400 font-bold' : 'text-slate-400';
  }
  for (let i = 0; i < word.length; i++) {
    const slot = document.createElement('div');
    slot.className = 'w-7 h-8 sm:w-8 sm:h-9 rounded-md flex items-center justify-center font-bold text-xs sm:text-sm shadow-sm transition border ';
    if (mineRevealedPos[i]) {
      slot.className += 'bg-amber-400 text-slate-900 border-amber-300 font-black';
      slot.textContent = mineRevealedPos[i];
    } else {
      slot.className += 'bg-slate-700/80 text-slate-400 border-slate-600';
      slot.textContent = '＊';
    }
    container.appendChild(slot);
  }
}

// ── ボード描画 ──
function mineRenderBoard() {
  const boardEl = document.getElementById('mine-board');
  if (!boardEl) return;
  boardEl.innerHTML = '';
  MINE_KANA_GRID.forEach(row => {
    row.forEach(char => {
      const cellDiv = document.createElement('div');
      if (!char) {
        cellDiv.className = 'w-full aspect-square';
        boardEl.appendChild(cellDiv);
        return;
      }
      const data = mineCellsData[char];
      let bgClass = 'bg-white hover:bg-indigo-50 text-indigo-900 border-indigo-200 cursor-pointer';
      if (data.isOpen) {
        bgClass = data.bombs > 0
          ? 'bg-rose-500 text-white border-rose-600 shadow-inner'
          : 'bg-slate-200 text-slate-700 border-slate-300';
      }
      cellDiv.className = `w-full aspect-square rounded-lg sm:rounded-xl flex flex-col items-center justify-center font-bold text-xs sm:text-base transition select-none shadow-sm border ${bgClass}`;
      if (data.isOpen) {
        if (data.bombs > 0) {
          const label = data.bombs > 1 ? `💣×${data.bombs}` : '💣';
          cellDiv.innerHTML = `<span class="text-[9px] sm:text-xs font-black">${label}</span><span class="text-[10px] sm:text-xs font-black">${char}</span>`;
        } else {
          cellDiv.innerHTML = `<span>${char}</span><span class="text-[10px] sm:text-xs text-indigo-600 font-black">${data.neighborBombs > 0 ? data.neighborBombs : ''}</span>`;
        }
      } else {
        cellDiv.innerHTML = `<span>${char}</span>`;
        cellDiv.onclick = () => mineHandleCellClick(char);
      }
      boardEl.appendChild(cellDiv);
    });
  });
}

// ── UI 更新 ──
function mineUpdateUI() {
  if (mineSkipped === mineTurn) {
    mineAddLog(`${minePlayerNames[mineTurn]}は1回休みです！`);
    mineSkipped = null; mineEndTurn(); return;
  }
  const statusEl = document.getElementById('mine-status-turn');
  if (statusEl) statusEl.textContent = `${minePlayerNames[mineTurn]}のターン`;

  ['p1', 'p2'].forEach((p, i) => {
    const num = i + 1;
    const box = document.getElementById(`mine-${p}-box`);
    if (!box) return;
    box.className = mineTurn === num
      ? 'p-2.5 rounded-xl bg-indigo-100 border-2 border-indigo-500 shadow flex flex-col items-center justify-between gap-1.5 opacity-100'
      : 'p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex flex-col items-center justify-between gap-1.5 opacity-60';
  });

  const p1Btn = document.getElementById('mine-p1-hint-btn');
  const p2Btn = document.getElementById('mine-p2-hint-btn');
  if (p1Btn) { p1Btn.disabled = mineP1HintUsed || mineTurn !== 1; p1Btn.textContent = mineP1HintUsed ? '💡 ヒント使用済' : '💡 位置ヒント (残り1回)'; }
  if (p2Btn) { p2Btn.disabled = mineP2HintUsed || mineTurn !== 2; p2Btn.textContent = mineP2HintUsed ? '💡 ヒント使用済' : '💡 位置ヒント (残り1回)'; }

  const promptEl   = document.getElementById('mine-action-prompt');
  const controlsEl = document.getElementById('mine-action-controls');
  if (!promptEl || !controlsEl) return;

  if (minePhase === 'choose') {
    const guessBtn = mineCanAnswer[mineTurn]
      ? `<button onclick="mineChooseAction('guess')" class="bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white px-3 py-1.5 rounded-xl font-bold text-xs sm:text-sm shadow transition whitespace-nowrap shrink-0">💡 ワードを答える</button>`
      : `<span class="text-xs text-slate-400 italic whitespace-nowrap shrink-0">💡 回答権なし（マスを開いてください）</span>`;
    promptEl.innerHTML  = `<span class="text-base">🎮</span> <span>${minePlayerNames[mineTurn]}の番です。アクションを選択してください</span>`;
    controlsEl.innerHTML = `<button onclick="mineChooseAction('open')" class="bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white px-3 py-1.5 rounded-xl font-bold text-xs sm:text-sm shadow transition whitespace-nowrap shrink-0">🔍 マスを開く</button>${guessBtn}`;
  } else if (minePhase === 'open') {
    promptEl.innerHTML  = `<span class="text-base">🔍</span> <span>${minePlayerNames[mineTurn]}: 盤面のマスを1つ押してください</span>`;
    controlsEl.innerHTML = `<button onclick="mineCancelGuess()" class="bg-slate-200 hover:bg-slate-300 text-slate-700 px-3 py-1.5 rounded-xl font-bold text-xs sm:text-sm transition whitespace-nowrap shrink-0">↩ キャンセル</button>`;
  } else if (minePhase === 'guess') {
    promptEl.innerHTML  = `<span class="text-base">💡</span> <span>ひらがなで正解を入力:</span>`;
    controlsEl.innerHTML = `
      <input type="text" id="mine-guess-input" placeholder="ワードを入力"
        class="px-2.5 py-1 border border-slate-300 rounded-lg text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 w-32 sm:w-44">
      <button onclick="mineSubmitGuess()" class="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg font-bold text-xs sm:text-sm shadow transition whitespace-nowrap shrink-0">回答</button>
      <button onclick="mineCancelGuess()" class="bg-slate-200 hover:bg-slate-300 text-slate-700 px-2 py-1.5 rounded-lg font-bold text-xs transition whitespace-nowrap shrink-0">戻る</button>`;
    setTimeout(() => { const inp = document.getElementById('mine-guess-input'); if (inp) inp.focus(); }, 50);
  }
}

// ── アクション ──
function mineChooseAction(action) {
  if (action === 'open')  { minePhase = 'open';  mineUpdateUI(); mineAddLog(`${minePlayerNames[mineTurn]}: マスを選んでください`); }
  else if (action === 'guess') { minePhase = 'guess'; mineUpdateUI(); }
}

function mineCancelGuess() { minePhase = 'choose'; mineUpdateUI(); }

function mineHandleCellClick(char) {
  if (minePhase !== 'open') return;
  mineProcessCellOpen(char);
}

function mineProcessCellOpen(char) {
  const data = mineCellsData[char];
  if (!data || data.isOpen) return;
  if (data.bombs > 0) {
    data.isOpen = true;
    mineAddLog(`${minePlayerNames[mineTurn]}が爆弾（${char}・${data.bombs}個分）を踏んだ！ 1回休み！`);
    mineSkipped = mineTurn;
    mineRenderBoard(); mineEndTurn();
  } else {
    if (data.neighborBombs === 0) {
      mineRevealCell(char);
      mineAddLog(`${minePlayerNames[mineTurn]}が「${char}」を開いた（連鎖展開）`);
    } else {
      data.isOpen = true;
      mineAddLog(`${minePlayerNames[mineTurn]}が「${char}」を開いた（周囲爆弾数: ${data.neighborBombs}）`);
    }
    mineRenderBoard(); mineEndTurn();
  }
}

function mineSubmitGuess() {
  const inputEl = document.getElementById('mine-guess-input');
  if (!inputEl) return;
  const val = inputEl.value.trim();
  if (!val) return;
  if (val === mineCurrent.word) {
    mineAddLog(`🎉 ${minePlayerNames[mineTurn]}がワード「${val}」を正解！`);
    mineTriggerVictory(mineTurn);
  } else {
    mineAddLog(`❌ ${minePlayerNames[mineTurn]}の回答「${val}」は不正解。回答権を失います。`);
    mineCanAnswer[mineTurn] = false;
    minePhase = 'choose'; mineUpdateUI();
  }
}

function mineEndTurn() {
  mineStopTimer();
  minePhase = 'choose';
  mineTurn = mineTurn === 1 ? 2 : 1;
  mineCanAnswer[mineTurn] = true; // ターン交代で回答権回復
  mineUpdateUI();
  mineStartTimer();
}

function mineTriggerVictory(winner) {
  mineStopTimer();
  document.getElementById('mine-result-title').textContent   = `${minePlayerNames[winner]}の勝利！`;
  document.getElementById('mine-result-message').textContent = `お題「${mineCurrent.word}」を見事に当てました！`;
  document.getElementById('mine-result-modal').classList.remove('hidden');
}
