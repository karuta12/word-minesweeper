// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ■ しりとりビンゴ（オンライン対応）
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
let bingoCurrentTurn = 0;   // 現在のターンプレイヤーインデックス
let bingoPlayerNames = [];
let bingoGameFinished = false;
let bingoMyIndex = 0;        // 自分は何番目か
let bingoMyPlayerCount = 1;
let bingoMyCard = [];        // 自分のカード文字配列（25文字）

// ── カード生成（ホストが全員分生成して配布） ──
function bingoGenerateAllCards(playerCount) {
  function shuffle(arr) {
    let a = [...arr];
    for (let i = a.length-1; i > 0; i--) {
      const j = Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]];
    }
    return a;
  }
  let charsWithoutRi = BINGO_FREQ_CHARS.filter(c => c !== 'り');
  let playerCharLists = Array.from({ length: playerCount }, () => []);
  let forward = true, p = 0;
  for (let i = 0; i < charsWithoutRi.length; i++) {
    playerCharLists[p].push(charsWithoutRi[i]);
    if (forward) { p++; if (p >= playerCount) { p = playerCount-1; forward = false; } }
    else         { p--; if (p < 0)            { p = 0;             forward = true;  } }
  }
  return playerCharLists.map(list => {
    const cards = shuffle(list).slice(0, 24);
    cards.splice(12, 0, 'り');
    return cards;
  });
}

// ── ゲーム開始（ホスト） ──
function bingoHostStart(playerCount, names, myCard) {
  bingoMyIndex      = 0;
  bingoMyPlayerCount = playerCount;
  bingoPlayerNames  = names;
  bingoMyCard       = myCard;
  bingoWordHistory  = [];
  bingoLastChar     = null;
  bingoCurrentTurn  = 0;
  bingoGameFinished = false;
  showScreen('bingo-screen');
  bingoRenderBoard();
  bingoUpdateTurnDisplay();
}

// ── ゲーム開始（ゲスト） ──
function bingoGuestStart(data) {
  bingoMyIndex       = data.myIndex;
  bingoMyPlayerCount = data.playerCount;
  bingoPlayerNames   = data.names;
  bingoMyCard        = data.myCard;
  bingoWordHistory   = [];
  bingoLastChar      = null;
  bingoCurrentTurn   = 0;
  bingoGameFinished  = false;
  showScreen('bingo-screen');
  bingoRenderBoard();
  bingoUpdateTurnDisplay();
}

// ── ボード描画 ──
function bingoRenderBoard() {
  const container = document.getElementById('bingo-boards');
  container.innerHTML = '';
  document.getElementById('bingo-historyList').innerHTML = '';
  document.getElementById('bingo-errorMsg').innerText = '';

  bingoPlayerNames.forEach((name, pi) => {
    const isMe = (pi === bingoMyIndex);
    const cardDiv = document.createElement('div');
    cardDiv.className = 'bingo-player-card' + (pi === 0 ? ' active-turn' : '');
    cardDiv.dataset.playerIndex = pi;

    cardDiv.innerHTML = `
      <h3>
        <span id="bingo-cardTitle_${pi}">${name}${isMe ? ' 👈あなた' : ''}</span>
        <span style="display:flex;gap:5px;">
          <span class="reach-badge" id="bingo-reach_${pi}">リーチ: 0</span>
          <span class="bingo-badge" id="bingo-bingo_${pi}">ビンゴ: 0</span>
        </span>
      </h3>`;

    // 自分のカードだけ文字を表示、他人は裏面（他人カード表示は任意で「?」）
    const cardChars = isMe ? bingoMyCard : bingoMyCard.map(() => '?');
    // ただし他人のカードも確認できた方がゲームとして面白い
    // → 全員同じ文字リストで生成済みなので実際には自分のカードのみ持っている
    // ここでは「自分のカードだけ」表示する
    const gridDiv = document.createElement('div');
    gridDiv.className = 'bingo-grid';
    // 自分のカードは操作可能、他人は表示のみ
    (isMe ? bingoMyCard : Array(25).fill('？')).forEach((char, idx) => {
      const cell = document.createElement('div');
      cell.className = 'bingo-cell';
      cell.innerText = char;
      if (isMe) {
        cell.dataset.char = char;
        if (idx === 12) cell.classList.add('center', 'checked');
      } else {
        cell.classList.add('other-card');
        if (idx === 12) { cell.innerText = 'り'; cell.classList.add('center', 'checked'); }
      }
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
  const el = document.getElementById('bingo-turnIndicator');
  if (bingoGameFinished) { el.innerText = '🏆 ゲーム終了！'; return; }

  const isMyTurn = (bingoCurrentTurn === bingoMyIndex);
  el.innerText = isMyTurn
    ? `👉 あなたの番です！言葉を入力してください`
    : `⏳ ${bingoPlayerNames[bingoCurrentTurn]} さんが入力中…`;
  el.style.background = isMyTurn ? '#fff3cd' : '#e9ecef';
  el.style.color       = isMyTurn ? '#d9534f' : '#666';

  document.querySelectorAll('.bingo-player-card').forEach((card, idx) => {
    card.classList.toggle('active-turn', idx === bingoCurrentTurn);
  });

  // 入力フォームを自分のターンのみ有効化
  const form   = document.getElementById('bingo-wordForm');
  const input  = document.getElementById('bingo-wordInput');
  const btn    = form ? form.querySelector('button') : null;
  if (input) input.disabled = !isMyTurn;
  if (btn)   btn.disabled   = !isMyTurn;
  if (isMyTurn && input) input.focus();
}

// ── 言葉送信（自分のターン） ──
function bingoSubmitWord(event) {
  event.preventDefault();
  if (bingoGameFinished) { alert('ゲームは既に終了しています。'); return; }
  if (bingoCurrentTurn !== bingoMyIndex) return;

  const inputField = document.getElementById('bingo-wordInput');
  const word = inputField.value.trim();
  const errorMsg = document.getElementById('bingo-errorMsg');
  errorMsg.innerText = '';
  if (!word) return;

  const first = bingoNormalizeChar(word.charAt(0));
  const last  = bingoNormalizeChar(word.slice(-1));

  if (last === 'ん') { errorMsg.innerText = '「ん」で終わる言葉は使えません！'; return; }
  if (bingoLastChar !== null && first !== bingoLastChar) {
    errorMsg.innerText = `🎵 「${bingoLastChar}」から始まる言葉を入力してください！（入力: ${first}）`;
    return;
  }

  // ホスト経由で全員にブロードキャスト
  if (lobbyIsHost) {
    // ホスト自身はそのまま適用
    const msg = { type: 'BINGO_WORD', word, playerIndex: bingoMyIndex };
    lobbyBroadcast(msg);
    bingoApplyWord(word, bingoMyIndex);
  } else {
    // ゲストはホストに送って承認してもらう
    lobbyHostConn.send({ type: 'BINGO_WORD', word });
    inputField.value = '';
    inputField.disabled = true;
    document.getElementById('bingo-errorMsg').innerText = '送信中…';
  }
}

// ── 言葉を実際に適用（全員共通） ──
function bingoApplyWord(word, playerIndex) {
  const charsInWord = [...word].map(c => bingoNormalizeChar(c));

  // 自分のカードのみ更新
  document.querySelectorAll('#bingo-boards .bingo-player-card').forEach((card, idx) => {
    if (idx !== bingoMyIndex) return;
    card.querySelectorAll('.bingo-cell').forEach(cell => {
      if (cell.dataset.char && charsInWord.includes(cell.dataset.char)) {
        cell.classList.add('checked');
      }
    });
  });

  bingoUpdateCardStatus();
  bingoLastChar = bingoNormalizeChar(word.slice(-1));

  const li = document.createElement('li');
  li.innerText = `[${bingoPlayerNames[playerIndex]}] ${word} （文字: ${charsInWord.join(', ')}）`;
  document.getElementById('bingo-historyList').appendChild(li);

  document.getElementById('bingo-wordInput').value = '';

  if (!bingoGameFinished) {
    bingoCurrentTurn = (bingoCurrentTurn + 1) % bingoMyPlayerCount;
    bingoUpdateTurnDisplay();
  }
}

// ── ホスト受信（ビンゴ） ──
function bingoHostReceive(peerId, data) {
  if (data.type === 'BINGO_WORD') {
    const g = lobbyConns[peerId];
    if (!g) return;
    const senderIndex = Object.keys(lobbyConns).indexOf(peerId) + 1;
    // ブロードキャスト（送信者含む全員に）
    lobbyBroadcast({ type: 'BINGO_WORD', word: data.word, playerIndex: senderIndex });
    bingoApplyWord(data.word, senderIndex);
  }
}

// ── ゲスト受信（ビンゴ） ──
function bingoGuestReceive(data) {
  if (data.type === 'BINGO_WORD') {
    document.getElementById('bingo-errorMsg').innerText = '';
    bingoApplyWord(data.word, data.playerIndex);
  }
}

// ── カード評価 ──
function bingoEvaluateCard(cardEl) {
  const cells = cardEl.querySelectorAll('.bingo-cell');
  let grid = [];
  for (let r = 0; r < 5; r++) {
    grid.push(Array.from({ length: 5 }, (_, c) => cells[r*5+c].classList.contains('checked')));
  }
  let lines = [
    ...grid,
    ...Array.from({ length: 5 }, (_, c) => grid.map(row => row[c])),
    [grid[0][0],grid[1][1],grid[2][2],grid[3][3],grid[4][4]],
    [grid[0][4],grid[1][3],grid[2][2],grid[3][1],grid[4][0]],
  ];
  let bingos = 0, reaches = 0;
  lines.forEach(l => {
    const n = l.filter(Boolean).length;
    if (n === 5) bingos++; else if (n === 4) reaches++;
  });
  return { bingos, reaches };
}

function bingoUpdateCardStatus() {
  // 自分のカードのみ評価
  document.querySelectorAll('.bingo-player-card').forEach((card, idx) => {
    if (idx !== bingoMyIndex) return;
    const s = bingoEvaluateCard(card);
    const rb = document.getElementById(`bingo-reach_${idx}`);
    const bb = document.getElementById(`bingo-bingo_${idx}`);
    if (rb) rb.innerText = `リーチ: ${s.reaches}`;
    if (bb) bb.innerText = `ビンゴ: ${s.bingos}列`;
    if (s.bingos >= 2 && !bingoGameFinished) bingoTriggerWin(bingoPlayerNames[idx]);
  });
}

function bingoTriggerWin(name) {
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
  const m = { ぁ:'あ',ぃ:'い',ぅ:'う',ぇ:'え',ぉ:'お',っ:'つ',ゃ:'や',ゅ:'ゆ',ょ:'よ',ゎ:'わ' };
  return m[ch] || ch;
}
