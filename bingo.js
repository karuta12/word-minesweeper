// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ■ しりとりビンゴ
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const BINGO_FREQ_CHARS = [
  "の","に","た","い","は","を","と","る","が","し","で","て","な","か","れ",
  "ら","も","う","す","り","こ","だ","ま","さ","き","め","く","あ","け","ど",
  "ん","え","よ","つ","や","そ","わ","ち","み","せ","ろ","ば","お","じ","べ",
  "ず","げ","ほ","へ","び","む","ご","ね","ぶ","ぐ","ぎ","ひ","づ","ぼ","ざ",
  "ふ","ぞ","ゆ","ぜ","ぬ","ぱ","ぴ","ぽ","ぷ","ぺ","ぢ","ー"
];

let bingoWordHistory = [];
let bingoLastChar = null;
let bingoCurrentTurn = 0;
let bingoPlayerNames = [];
let bingoGameFinished = false;

function bingoInit() {
  bingoUpdateNameInputs();
  bingoGenerateBoards();
}

function bingoUpdateNameInputs() {
  const count = parseInt(document.getElementById('bingo-playerCount').value);
  const container = document.getElementById('bingo-nameInputsContainer');
  container.innerHTML = '';
  for (let i = 0; i < count; i++) {
    const label = document.createElement('label');
    label.style.cssText = 'font-weight:bold;display:flex;align-items:center;gap:5px;';
    label.innerHTML = `P${i + 1}: <input type="text" id="bingoPlayerName_${i}" value="プレイヤー ${i + 1}" oninput="bingoSyncPlayerNames()" style="width:100px;font-size:14px;padding:4px 8px;">`;
    container.appendChild(label);
  }
}

function bingoSyncPlayerNames() {
  const count = parseInt(document.getElementById('bingo-playerCount').value);
  bingoPlayerNames = [];
  for (let i = 0; i < count; i++) {
    const input = document.getElementById(`bingoPlayerName_${i}`);
    const name = input ? input.value.trim() || `プレイヤー ${i + 1}` : `プレイヤー ${i + 1}`;
    bingoPlayerNames.push(name);
    const titleEl = document.getElementById(`bingo-cardTitle_${i}`);
    if (titleEl) titleEl.innerText = name;
  }
  bingoUpdateTurnDisplay();
}

function bingoUpdateTurnDisplay() {
  if (!bingoPlayerNames.length) return;
  const el = document.getElementById('bingo-turnIndicator');
  if (bingoGameFinished) { el.innerText = '🏆 ゲーム終了！'; return; }
  el.innerText = `👉 現在の番： ${bingoPlayerNames[bingoCurrentTurn]} さん`;
  document.querySelectorAll('.bingo-player-card').forEach((card, idx) => {
    card.classList.toggle('active-turn', idx === bingoCurrentTurn);
  });
}

function bingoShuffle(arr) {
  let a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function bingoGenerateBoards() {
  const count = parseInt(document.getElementById('bingo-playerCount').value);
  bingoGameFinished = false;
  bingoUpdateNameInputs();
  bingoSyncPlayerNames();
  const container = document.getElementById('bingo-boards');
  container.innerHTML = '';
  bingoWordHistory = []; bingoLastChar = null; bingoCurrentTurn = 0;
  document.getElementById('bingo-historyList').innerHTML = '';
  document.getElementById('bingo-errorMsg').innerText = '';

  // スネークドラフト方式で文字を配分（「り」は除外してあとで中央に固定）
  let charsWithoutRi = BINGO_FREQ_CHARS.filter(c => c !== 'り');
  let playerCharLists = Array.from({ length: count }, () => []);
  let forward = true, p = 0;
  for (let i = 0; i < charsWithoutRi.length; i++) {
    playerCharLists[p].push(charsWithoutRi[i]);
    if (forward) { p++; if (p >= count) { p = count - 1; forward = false; } }
    else         { p--; if (p < 0)     { p = 0;         forward = true;  } }
  }
  for (let pp = 0; pp < count; pp++) {
    playerCharLists[pp] = bingoShuffle(playerCharLists[pp]).slice(0, 24);
  }

  for (let pp = 0; pp < count; pp++) {
    let cardChars = playerCharLists[pp];
    cardChars.splice(12, 0, 'り'); // 中央（12番目）に「り」を配置

    const cardDiv = document.createElement('div');
    cardDiv.className = 'bingo-player-card';
    cardDiv.dataset.playerIndex = pp;
    if (pp === 0) cardDiv.classList.add('active-turn');

    cardDiv.innerHTML = `
      <h3>
        <span id="bingo-cardTitle_${pp}">${bingoPlayerNames[pp]}</span>
        <span style="display:flex;gap:5px;">
          <span class="reach-badge" id="bingo-reach_${pp}">リーチ: 0</span>
          <span class="bingo-badge" id="bingo-bingo_${pp}">ビンゴ: 0</span>
        </span>
      </h3>`;

    const gridDiv = document.createElement('div');
    gridDiv.className = 'bingo-grid';
    cardChars.forEach((char, index) => {
      const cell = document.createElement('div');
      cell.className = 'bingo-cell';
      cell.innerText = char;
      cell.dataset.char = char;
      if (index === 12) cell.classList.add('center', 'checked');
      cell.addEventListener('click', () => { cell.classList.toggle('checked'); bingoUpdateCardStatus(); });
      gridDiv.appendChild(cell);
    });
    cardDiv.appendChild(gridDiv);
    container.appendChild(cardDiv);
  }
  bingoUpdateTurnDisplay();
  bingoUpdateCardStatus();
}

function bingoEvaluateCard(cardEl) {
  const cells = cardEl.querySelectorAll('.bingo-cell');
  let grid = [];
  for (let r = 0; r < 5; r++) {
    let row = [];
    for (let c = 0; c < 5; c++) row.push(cells[r * 5 + c].classList.contains('checked'));
    grid.push(row);
  }
  let lines = [];
  for (let r = 0; r < 5; r++) lines.push(grid[r]);
  for (let c = 0; c < 5; c++) lines.push([grid[0][c], grid[1][c], grid[2][c], grid[3][c], grid[4][c]]);
  lines.push([grid[0][0], grid[1][1], grid[2][2], grid[3][3], grid[4][4]]);
  lines.push([grid[0][4], grid[1][3], grid[2][2], grid[3][1], grid[4][0]]);
  let bingos = 0, reaches = 0;
  lines.forEach(line => {
    const cnt = line.filter(v => v).length;
    if (cnt === 5) bingos++; else if (cnt === 4) reaches++;
  });
  return { bingos, reaches };
}

function bingoUpdateCardStatus() {
  document.querySelectorAll('.bingo-player-card').forEach((card, idx) => {
    const s = bingoEvaluateCard(card);
    const rb = document.getElementById(`bingo-reach_${idx}`);
    const bb = document.getElementById(`bingo-bingo_${idx}`);
    if (rb) rb.innerText = `リーチ: ${s.reaches}`;
    if (bb) bb.innerText = `ビンゴ: ${s.bingos}列`;
    if (s.bingos >= 2 && !bingoGameFinished) bingotTriggerWin(bingoPlayerNames[idx]);
  });
}

function bingotTriggerWin(name) {
  bingoGameFinished = true;
  const modal = document.getElementById('bingo-winModal');
  document.getElementById('bingo-winnerText').innerText = `${name} さんが 2列ビンゴを達成して勝利しました！ 🎉`;
  modal.style.display = 'flex';
  bingoUpdateTurnDisplay();
}

function bingoCloseModal() {
  document.getElementById('bingo-winModal').style.display = 'none';
}

function bingoNormalizeChar(ch) {
  const m = { ぁ:'あ', ぃ:'い', ぅ:'う', ぇ:'え', ぉ:'お', っ:'つ', ゃ:'や', ゅ:'ゆ', ょ:'よ', ゎ:'わ' };
  return m[ch] || ch;
}

function bingoSubmitWord(event) {
  event.preventDefault();
  if (bingoGameFinished) { alert('ゲームは既に終了しています。'); return; }
  const inputField = document.getElementById('bingo-wordInput');
  let word = inputField.value.trim();
  const errorMsg = document.getElementById('bingo-errorMsg');
  errorMsg.innerText = '';
  if (!word) return;

  let first = bingoNormalizeChar(word.charAt(0));
  let last  = bingoNormalizeChar(word.slice(-1));

  if (last === 'ん') { errorMsg.innerText = '「ん」で終わる言葉は使えません！'; return; }
  if (bingoLastChar !== null && first !== bingoLastChar) {
    errorMsg.innerText = `🎵 「${bingoLastChar}」から始まる言葉を入力してください！（入力された先頭: ${first}）`;
    return;
  }

  const charsInWord = [...word].map(c => bingoNormalizeChar(c));
  document.querySelectorAll('.bingo-cell').forEach(cell => {
    if (charsInWord.includes(cell.dataset.char)) cell.classList.add('checked');
  });
  bingoUpdateCardStatus();

  bingoWordHistory.push({ name: bingoPlayerNames[bingoCurrentTurn], word });
  const li = document.createElement('li');
  li.innerText = `[${bingoPlayerNames[bingoCurrentTurn]}] ${word} （使った文字: ${charsInWord.join(', ')}）`;
  document.getElementById('bingo-historyList').appendChild(li);

  bingoLastChar = last;
  inputField.value = '';
  inputField.focus();

  if (!bingoGameFinished) {
    bingoCurrentTurn = (bingoCurrentTurn + 1) % bingoPlayerNames.length;
    bingoUpdateTurnDisplay();
  }
}
