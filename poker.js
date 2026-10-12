// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ■ 文字ポーカー
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const POKER_LANG_DATA = {
  ja: {
    chars: ["の","に","た","い","は","を","と","る","が","し","で","て","な","か","れ","ら","も","う","す","り","こ","だ","ま","さ","き","め","く","あ","け","ど","ん","え","よ","つ","や","そ","わ","ち","み","せ","ろ","ば","お","じ","べ","ず","げ","ほ","へ","び","む","ご","ね","ぶ","ぐ","ぎ","ひ","づ","ぼ","ざ","ふ","ぞ","ゆ","ぜ","ぬ","ぱ","ぴ","ぽ","ぷ","ぺ","ぢ","ー"],
    blackEnd: 15, blueEnd: 35,
    checkWord: null,
    ui: {
      title: "文字ポーカー ver1.4",
      roomLabel: r => `対戦ルーム: ${r}`,
      exchangeHint: "あなたの手札（クリックで選択して交換）",
      exchangeBtn: "選択したカードを交換する（1回のみ）",
      exchangeWait: "交換完了。全員が終わるまでお待ちください…",
      exchangeCount: (d,t) => `交換完了 ${d} / ${t} 人`,
      wordHint: "手札の文字を使って単語を入力 / 同じ文字を複数回使う場合は複数枚必要",
      handLabel: "あなたの手札",
      wordPlaceholder: "単語を入力",
      submitBtn: "確定", finishBtn: "終了→結果へ",
      wordRow: (w,s) => `✅ <strong>${w}</strong>：${s}点`,
      noWord: "単語なし", scoreUnit: "点",
      colName: "名前", colWords: "単語", colScore: "得点",
      rematchBtn: "🔄 再戦する",
      rematchWait: "再戦リクエストを送りました。全員が揃うまで待っています…",
      rematchCount: n => `再戦待ち：あと ${n} 人`,
      win: "🎉 あなたの勝ち！", last: "😢 最下位…", rank: n => `あなたは ${n} 位`,
      allUsed: "手札をすべて使いました！",
      invalidCard: w => `「${w}」は手札にない文字が含まれています。`,
      invalidWord: null,
      confirmNoExchange: "1枚も交換しませんか？",
      confirmOnlyYou: "参加者があなただけですが開始しますか？",
      namePromptDefault: "ホスト", namePromptGuest: "プレイヤー",
      playersLabel: "参加者：",
      waitingMsg: "ホストがゲームを開始するまでお待ちください…",
      statusCreated: r => `部屋「${r}」を作りました`,
      statusJoined:  r => `部屋「${r}」に参加しました`,
      statusPlayers: names => `参加者：${names.join("、")}`,
    }
  },
  en: {
    chars: ["E","T","A","O","I","N","S","H","R","D","L","C","U","M","W","F","G","Y","P","B","V","K","J","X","Q","Z"],
    blackEnd: 9, blueEnd: 20,
    checkWord: async (word) => {
      try {
        const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${word.toLowerCase()}`);
        return res.ok;
      } catch { return true; }
    },
    ui: {
      title: "文字ポーカー ver1.4",
      roomLabel: r => `対戦ルーム: ${r}`,
      exchangeHint: "あなたの手札（クリックで選択して交換）",
      exchangeBtn: "選択したカードを交換する（1回のみ）",
      exchangeWait: "交換完了。全員が終わるまでお待ちください…",
      exchangeCount: (d,t) => `交換完了 ${d} / ${t} 人`,
      wordHint: "手札の文字を使って単語を入力 / 同じ文字を複数回使う場合は複数枚必要",
      handLabel: "あなたの手札",
      wordPlaceholder: "単語を入力",
      submitBtn: "確定", finishBtn: "終了→結果へ",
      wordRow: (w,s) => `✅ <strong>${w}</strong>: ${s}点`,
      noWord: "単語なし", scoreUnit: "点",
      colName: "名前", colWords: "単語", colScore: "得点",
      rematchBtn: "🔄 再戦する",
      rematchWait: "再戦リクエストを送りました。全員が揃うまで待っています…",
      rematchCount: n => `再戦待ち：あと ${n} 人`,
      win: "🎉 あなたの勝ち！", last: "😢 最下位…", rank: n => `あなたは ${n} 位`,
      allUsed: "手札をすべて使いました！",
      invalidCard: w => `「${w}」は手札にない文字が含まれています。`,
      invalidWord: w => `「${w}」は辞書に見つかりませんでした。`,
      confirmNoExchange: "1枚も交換しませんか？",
      confirmOnlyYou: "参加者があなただけですが開始しますか？",
      namePromptDefault: "ホスト", namePromptGuest: "プレイヤー",
      playersLabel: "参加者：",
      waitingMsg: "ホストがゲームを開始するまでお待ちください…",
      statusCreated: r => `部屋「${r}」を作りました`,
      statusJoined:  r => `部屋「${r}」に参加しました`,
      statusPlayers: names => `参加者：${names.join("、")}`,
    }
  }
};

// ── 状態変数 ──
let pokerLang = 'ja';
let pokerL = POKER_LANG_DATA.ja;
let pokerDeck = [], pokerMyHand = [], pokerMyName = '', pokerHasExchanged = false;
let pokerMyWords = [], pokerMyTotalScore = 0, pokerIFinished = false, pokerIWantRematch = false;
let pokerIsHost = false, pokerConns = {}, pokerHostConn = null;
let pokerPlayerCount = 0, pokerExchangeDoneCount = 0, pokerScoreDoneCount = 0, pokerRematchCount = 0;
let pokerPeer, pokerRoomName = '';

function showPokerLobby() {
  showScreen('poker-screen');
  document.getElementById('poker-lobby').style.display = 'block';
  document.getElementById('poker-game').style.display  = 'none';
}

function pokerDestroy() {
  if (pokerPeer) { try { pokerPeer.destroy(); } catch(e){} pokerPeer = null; }
  pokerConns = {}; pokerHostConn = null;
  document.getElementById('poker-lobby').style.display = 'block';
  document.getElementById('poker-game').style.display  = 'none';
  document.getElementById('poker-host-lobby').style.display = 'none';
  document.getElementById('poker-waiting-msg').style.display = 'none';
  document.getElementById('poker-status').innerText = '';
  document.getElementById('poker-lang-section').style.display = 'block';
}

function pokerSelectLang(l) {
  pokerLang = l; pokerL = POKER_LANG_DATA[l];
  document.getElementById('btn-ja').classList.toggle('active', l === 'ja');
  document.getElementById('btn-en').classList.toggle('active', l === 'en');
}

function pokerApplyLangUI() {
  document.getElementById('poker-page-title').textContent = pokerL.ui.title;
  document.getElementById('poker-exchange-hint').textContent = pokerL.ui.exchangeHint;
  document.getElementById('poker-exchange-btn').textContent  = pokerL.ui.exchangeBtn;
  document.getElementById('poker-word-hint').textContent     = pokerL.ui.wordHint;
  document.getElementById('poker-hand-label').textContent    = pokerL.ui.handLabel;
  document.getElementById('poker-word-input').placeholder    = pokerL.ui.wordPlaceholder;
  document.getElementById('poker-submit-btn').textContent    = pokerL.ui.submitBtn;
  document.getElementById('poker-finish-btn').textContent    = pokerL.ui.finishBtn;
  document.getElementById('poker-col-name').textContent      = pokerL.ui.colName;
  document.getElementById('poker-col-words').textContent     = pokerL.ui.colWords;
  document.getElementById('poker-col-score').textContent     = pokerL.ui.colScore;
  document.getElementById('poker-rematch-btn').textContent   = pokerL.ui.rematchBtn;
  document.getElementById('poker-waiting-msg').textContent   = pokerL.ui.waitingMsg;
  document.getElementById('poker-players-label').textContent = pokerL.ui.playersLabel;
}

function pokerCardProps(index) {
  if (index < pokerL.blackEnd) return { count: 3, color: 'black', score: 1 };
  if (index < pokerL.blueEnd)  return { count: 2, color: 'blue',  score: 2 };
  return { count: 1, color: 'red', score: 3 };
}

function pokerInitDeck() {
  pokerDeck = [];
  pokerL.chars.forEach((char, index) => {
    const { count, color, score } = pokerCardProps(index);
    for (let i = 0; i < count; i++) pokerDeck.push({ char, color, score });
  });
  pokerDeck.sort(() => Math.random() - 0.5);
}

function pokerDealCards(n) {
  if (pokerDeck.length >= n) return pokerDeck.splice(0, n);
  const result = [];
  for (let i = 0; i < n; i++) result.push(pokerDrawRandom());
  return result;
}

function pokerDrawRandom() {
  const pool = [];
  pokerL.chars.forEach((char, index) => {
    const { count, color, score } = pokerCardProps(index);
    for (let i = 0; i < count; i++) pool.push({ char, color, score });
  });
  return pool[Math.floor(Math.random() * pool.length)];
}

function pokerResetGameState() {
  pokerDeck = []; pokerMyHand = []; pokerHasExchanged = false;
  pokerMyWords = []; pokerMyTotalScore = 0; pokerIFinished = false; pokerIWantRematch = false;
  pokerExchangeDoneCount = 0; pokerScoreDoneCount = 0; pokerRematchCount = 0;
  Object.values(pokerConns).forEach(g => { g.exchanged=false; g.score=null; g.detail=null; g.wantsRematch=false; });
  document.getElementById('poker-result-section').style.display  = 'none';
  document.getElementById('poker-word-section').style.display    = 'none';
  document.getElementById('poker-exchange-section').style.display = 'block';
  document.getElementById('poker-exchange-btn').disabled = false;
  document.getElementById('poker-exchange-status').innerText = '';
  document.getElementById('poker-word-list').innerHTML = '';
  document.getElementById('poker-word-input').value = '';
  document.getElementById('poker-word-input').disabled = false;
  document.getElementById('poker-submit-btn').disabled = false;
  document.getElementById('poker-finish-btn').disabled = false;
  document.getElementById('poker-loading-msg').style.display = 'none';
  document.getElementById('poker-rematch-status').innerText = '';
  document.getElementById('poker-rematch-btn').disabled = false;
  document.getElementById('poker-my-hand').innerHTML = '';
  document.getElementById('poker-my-hand-final').innerHTML = '';
}

function pokerCreateRoom() {
  pokerRoomName = document.getElementById('poker-room-input').value.trim();
  if (!pokerRoomName) return alert('合言葉を入力してください');
  pokerMyName = prompt('名前を入力してください', pokerL.ui.namePromptDefault) || pokerL.ui.namePromptDefault;
  pokerIsHost = true;
  document.getElementById('poker-lang-section').style.display = 'none';
  pokerPeer = new Peer('wordpoker-' + pokerRoomName);
  pokerPeer.on('open', () => {
    document.getElementById('poker-status').innerText = pokerL.ui.statusCreated(pokerRoomName);
    document.getElementById('poker-host-lobby').style.display = 'block';
    pokerUpdatePlayerList();
  });
  pokerPeer.on('connection', c => {
    const guestId = c.peer;
    pokerConns[guestId] = { conn: c, name: '…', exchanged: false, score: null, detail: null, wantsRematch: false };
    c.on('open', () => c.send({ type: 'ASK_NAME', lang: pokerLang }));
    c.on('data', data => pokerHostReceive(guestId, data));
    c.on('close', () => { delete pokerConns[guestId]; pokerUpdatePlayerList(); });
  });
}

function pokerUpdatePlayerList() {
  const ul = document.getElementById('poker-player-list');
  ul.innerHTML = `<li>👑 ${pokerMyName}</li>`;
  Object.values(pokerConns).forEach(g => { ul.innerHTML += `<li>👤 ${g.name}</li>`; });
}

function pokerJoinRoom() {
  pokerRoomName = document.getElementById('poker-room-input').value.trim();
  if (!pokerRoomName) return alert('合言葉を入力してください');
  pokerMyName = prompt('名前を入力してください', 'プレイヤー') || 'プレイヤー';
  pokerIsHost = false;
  document.getElementById('poker-lang-section').style.display = 'none';
  pokerPeer = new Peer();
  pokerPeer.on('open', () => {
    pokerHostConn = pokerPeer.connect('wordpoker-' + pokerRoomName);
    pokerHostConn.on('open', () => {
      document.getElementById('poker-status').innerText = `部屋「${pokerRoomName}」に参加しました`;
      document.getElementById('poker-waiting-msg').style.display = 'block';
    });
    pokerHostConn.on('data', data => pokerGuestReceive(data));
  });
}

function pokerHostReceive(guestId, data) {
  const guest = pokerConns[guestId];
  if (!guest) return;
  if (data.type === 'MY_NAME') {
    guest.name = data.name; pokerUpdatePlayerList(); pokerBroadcastPlayerList();
  } else if (data.type === 'EXCHANGE_DONE') {
    guest.exchanged = true; pokerExchangeDoneCount++; pokerUpdateExchangeStatus(); pokerCheckAllExchanged();
  } else if (data.type === 'SCORE') {
    guest.score = data.total; guest.detail = data.detail; pokerScoreDoneCount++; pokerCheckAllScored();
  } else if (data.type === 'REMATCH_REQUEST') {
    guest.wantsRematch = true; pokerRematchCount++; pokerCheckAllRematch();
  }
}

function pokerGuestReceive(data) {
  if (data.type === 'ASK_NAME') {
    pokerLang = data.lang; pokerL = POKER_LANG_DATA[pokerLang]; pokerApplyLangUI();
    pokerHostConn.send({ type: 'MY_NAME', name: pokerMyName });
  } else if (data.type === 'PLAYER_LIST') {
    document.getElementById('poker-status').innerText = pokerL.ui.statusPlayers(data.names);
  } else if (data.type === 'HAND') {
    document.getElementById('poker-lobby').style.display = 'none';
    document.getElementById('poker-game').style.display  = 'block';
    document.getElementById('poker-room-id-display').innerText = pokerL.ui.roomLabel(pokerRoomName);
    pokerMyHand = data.hand; pokerRenderHand();
  } else if (data.type === 'ALL_EXCHANGED') {
    document.getElementById('poker-exchange-section').style.display = 'none';
    document.getElementById('poker-word-section').style.display = 'block';
    pokerRenderHandFinal(); document.getElementById('poker-word-input').focus();
  } else if (data.type === 'RESULT') {
    pokerShowResult(data.ranking);
  } else if (data.type === 'REMATCH_START') {
    pokerResetGameState(); pokerMyHand = data.hand; pokerRenderHand();
  }
}

function pokerBroadcast(msg) { Object.values(pokerConns).forEach(g => g.conn.send(msg)); }

function pokerBroadcastPlayerList() {
  const names = [pokerMyName, ...Object.values(pokerConns).map(g => g.name)];
  pokerBroadcast({ type: 'PLAYER_LIST', names });
}

function pokerHostStartGame() {
  const guestList = Object.values(pokerConns);
  if (guestList.length === 0 && !confirm(pokerL.ui.confirmOnlyYou)) return;
  pokerPlayerCount = 1 + guestList.length;
  pokerExchangeDoneCount = 0; pokerScoreDoneCount = 0;
  pokerApplyLangUI();
  document.getElementById('poker-lobby').style.display = 'none';
  document.getElementById('poker-game').style.display  = 'block';
  document.getElementById('poker-room-id-display').innerText = pokerL.ui.roomLabel(pokerRoomName);
  pokerInitDeck();
  pokerMyHand = pokerDealCards(7); pokerRenderHand();
  guestList.forEach(g => g.conn.send({ type: 'HAND', hand: pokerDealCards(7) }));
}

function pokerRenderHand() {
  const container = document.getElementById('poker-my-hand');
  container.innerHTML = '';
  pokerMyHand.forEach((card, index) => {
    const div = document.createElement('div');
    div.className = `card-tile ${card.color}`;
    div.innerText = card.char;
    div.onclick = () => div.classList.toggle('selected');
    div.dataset.index = index;
    container.appendChild(div);
  });
}

function pokerRenderHandFinal() {
  const container = document.getElementById('poker-my-hand-final');
  container.innerHTML = '';
  pokerMyHand.forEach(card => {
    const div = document.createElement('div');
    div.className = `card-tile ${card.color}` + (card.used ? ' used' : '');
    div.innerText = card.char;
    container.appendChild(div);
  });
}

function pokerExchangeCards() {
  if (pokerHasExchanged) return;
  const selectedDivs = document.querySelectorAll('#poker-my-hand .selected');
  const indicesToReplace = Array.from(selectedDivs).map(div => parseInt(div.dataset.index));
  if (indicesToReplace.length === 0 && !confirm(pokerL.ui.confirmNoExchange)) return;
  indicesToReplace.forEach(index => { pokerMyHand[index] = pokerDrawRandom(); });
  pokerHasExchanged = true;
  document.getElementById('poker-exchange-btn').disabled = true;
  pokerRenderHand();
  if (pokerIsHost) {
    pokerExchangeDoneCount++; pokerUpdateExchangeStatus(); pokerCheckAllExchanged();
  } else {
    pokerHostConn.send({ type: 'EXCHANGE_DONE' });
    document.getElementById('poker-exchange-status').innerText = pokerL.ui.exchangeWait;
  }
}

function pokerUpdateExchangeStatus() {
  document.getElementById('poker-exchange-status').innerText =
    pokerL.ui.exchangeCount(pokerExchangeDoneCount, pokerPlayerCount);
}

function pokerCheckAllExchanged() {
  if (pokerExchangeDoneCount < pokerPlayerCount) return;
  pokerBroadcast({ type: 'ALL_EXCHANGED' });
  document.getElementById('poker-exchange-section').style.display = 'none';
  document.getElementById('poker-word-section').style.display = 'block';
  pokerRenderHandFinal(); document.getElementById('poker-word-input').focus();
}

async function pokerSubmitWord() {
  const input = document.getElementById('poker-word-input');
  let word = input.value.trim();
  if (!word) return;
  if (pokerLang === 'en') word = word.toUpperCase();

  const handCopy = pokerMyHand.map(c => ({ ...c }));
  let score = 0, valid = true;
  const usedIndices = [];
  for (const ch of word) {
    const idx = handCopy.findIndex(c => c.char === ch && !c._tmpUsed && !c.used);
    if (idx === -1) { valid = false; break; }
    handCopy[idx]._tmpUsed = true;
    score += handCopy[idx].score;
    usedIndices.push(idx);
  }
  if (!valid) { alert(pokerL.ui.invalidCard(word)); input.focus(); return; }

  if (pokerL.checkWord) {
    pokerSetLoading(true);
    const exists = await pokerL.checkWord(word);
    pokerSetLoading(false);
    if (!exists) { alert(pokerL.ui.invalidWord(word)); input.focus(); return; }
  }

  input.value = '';
  usedIndices.forEach(i => { pokerMyHand[i].used = true; });
  pokerMyTotalScore += score;
  pokerMyWords.push({ word, score });
  pokerRenderHandFinal(); pokerUpdateWordList(); input.focus();
  if (pokerMyHand.filter(c => !c.used).length === 0) {
    alert(pokerL.ui.allUsed); pokerFinishWords();
  }
}

function pokerSetLoading(on) {
  document.getElementById('poker-loading-msg').style.display = on ? 'block' : 'none';
  document.getElementById('poker-submit-btn').disabled = on;
  document.getElementById('poker-word-input').disabled = on;
}

function pokerUpdateWordList() {
  document.getElementById('poker-word-list').innerHTML =
    pokerMyWords.map(w => pokerL.ui.wordRow(w.word, w.score)).join('<br>');
}

function pokerFinishWords() {
  if (pokerIFinished) return;
  pokerIFinished = true;
  document.getElementById('poker-word-input').disabled = true;
  document.getElementById('poker-submit-btn').disabled = true;
  document.getElementById('poker-finish-btn').disabled = true;
  const detail = pokerMyWords.map(w => `${w.word}(${w.score}${pokerL.ui.scoreUnit})`)
    .join(pokerLang === 'ja' ? '、' : ', ') || pokerL.ui.noWord;
  if (pokerIsHost) { pokerScoreDoneCount++; pokerCheckAllScored(); }
  else { pokerHostConn.send({ type: 'SCORE', total: pokerMyTotalScore, detail }); }
}

function pokerCheckAllScored() {
  if (pokerScoreDoneCount < pokerPlayerCount) return;
  const myDetail = pokerMyWords.map(w => `${w.word}(${w.score}${pokerL.ui.scoreUnit})`)
    .join(pokerLang === 'ja' ? '、' : ', ') || pokerL.ui.noWord;
  const allScores = [
    { name: pokerMyName, total: pokerMyTotalScore, detail: myDetail },
    ...Object.values(pokerConns).map(g => ({
      name: g.name, total: g.score ?? 0, detail: g.detail || pokerL.ui.noWord
    }))
  ];
  allScores.sort((a, b) => b.total - a.total);
  pokerBroadcast({ type: 'RESULT', ranking: allScores });
  pokerShowResult(allScores);
}

function pokerShowResult(ranking) {
  document.getElementById('poker-word-section').style.display     = 'none';
  document.getElementById('poker-exchange-section').style.display = 'none';
  document.getElementById('poker-result-section').style.display   = 'block';
  const tbody = document.getElementById('poker-ranking-body');
  tbody.innerHTML = '';
  ranking.forEach((p, i) => {
    const tr = document.createElement('tr');
    const rankClass = ['rank1','rank2','rank3'][i] || '';
    const isMe = p.name === pokerMyName;
    tr.className = (rankClass + (isMe ? ' me' : '')).trim();
    tr.innerHTML = `<td>${p.name}</td><td style="font-size:13px">${p.detail}</td><td>${p.total}${pokerL.ui.scoreUnit}</td>`;
    tbody.appendChild(tr);
  });
  const label = document.getElementById('poker-result-label');
  const myRank = ranking.findIndex(p => p.name === pokerMyName) + 1;
  const top = ranking[0].total, bot = ranking[ranking.length - 1].total;
  if (myRank === 1 && ranking.filter(p => p.total === top).length === 1) {
    label.textContent = pokerL.ui.win; label.style.color = '#cc0000';
  } else if (myRank === ranking.length && ranking.filter(p => p.total === bot).length === 1) {
    label.textContent = pokerL.ui.last; label.style.color = '#0066cc';
  } else {
    label.textContent = pokerL.ui.rank(myRank); label.style.color = '#333';
  }
}

function pokerRequestRematch() {
  pokerIWantRematch = true;
  document.getElementById('poker-rematch-btn').disabled = true;
  document.getElementById('poker-rematch-status').innerText = pokerL.ui.rematchWait;
  if (pokerIsHost) { pokerRematchCount++; pokerCheckAllRematch(); }
  else { pokerHostConn.send({ type: 'REMATCH_REQUEST' }); }
}

function pokerCheckAllRematch() {
  const waiting = pokerPlayerCount - pokerRematchCount;
  if (waiting > 0) {
    document.getElementById('poker-rematch-status').innerText = pokerL.ui.rematchCount(waiting);
    return;
  }
  pokerResetGameState();
  pokerInitDeck();
  pokerMyHand = pokerDealCards(7); pokerRenderHand();
  Object.values(pokerConns).forEach(g => g.conn.send({ type: 'REMATCH_START', hand: pokerDealCards(7) }));
}
