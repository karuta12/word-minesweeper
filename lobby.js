// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ■ 共通ロビー
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

let lobbyPeer = null;
let lobbyConns = {};        // { peerId: { conn, name } }  ホスト用
let lobbyHostConn = null;   // ゲスト用
let lobbyMyName = '';
let lobbyIsHost = false;
let lobbyRoomName = '';
let lobbyLang = 'ja';       // ポーカー用言語

// ── 言語選択（ポーカー用、ホストのみ） ──
function lobbySelectLang(l) {
  lobbyLang = l;
  document.getElementById('lobby-btn-ja').classList.toggle('active', l === 'ja');
  document.getElementById('lobby-btn-en').classList.toggle('active', l === 'en');
}

// ── 参加者リスト表示 ──
function lobbyUpdatePlayerList() {
  const ul = document.getElementById('lobby-player-list');
  ul.innerHTML = `<li>👑 ${lobbyMyName}（ホスト）</li>`;
  Object.values(lobbyConns).forEach(g => {
    ul.innerHTML += `<li>👤 ${g.name}</li>`;
  });
}

// ── 全ゲスト一斉送信 ──
function lobbyBroadcast(msg) {
  Object.values(lobbyConns).forEach(g => g.conn.send(msg));
}

// ── 部屋を作る（ホスト） ──
function lobbyCreateRoom() {
  lobbyRoomName = document.getElementById('lobby-room-input').value.trim();
  if (!lobbyRoomName) return alert('合言葉を入力してください');
  lobbyMyName = prompt('名前を入力してください', 'ホスト') || 'ホスト';
  lobbyIsHost = true;

  lobbyPeer = new Peer('gamelobby-' + lobbyRoomName);
  lobbyPeer.on('error', e => {
    if (e.type === 'unavailable-id') alert('その合言葉の部屋はすでに存在します');
    else alert('接続エラー: ' + e.message);
  });
  lobbyPeer.on('open', () => {
    document.getElementById('lobby-status').innerText = `部屋「${lobbyRoomName}」を作りました`;
    document.getElementById('host-lobby').style.display = 'block';
    lobbyUpdatePlayerList();
  });
  lobbyPeer.on('connection', c => {
    const pid = c.peer;
    lobbyConns[pid] = { conn: c, name: '…' };
    c.on('open', () => c.send({ type: 'ASK_NAME' }));
    c.on('data', data => lobbyHostReceive(pid, data));
    c.on('close', () => { delete lobbyConns[pid]; lobbyUpdatePlayerList(); });
  });
}

// ── 部屋に参加（ゲスト） ──
function lobbyJoinRoom() {
  lobbyRoomName = document.getElementById('lobby-room-input').value.trim();
  if (!lobbyRoomName) return alert('合言葉を入力してください');
  lobbyMyName = prompt('名前を入力してください', 'プレイヤー') || 'プレイヤー';
  lobbyIsHost = false;

  lobbyPeer = new Peer();
  lobbyPeer.on('open', () => {
    lobbyHostConn = lobbyPeer.connect('gamelobby-' + lobbyRoomName);
    lobbyHostConn.on('open', () => {
      document.getElementById('lobby-status').innerText = `部屋「${lobbyRoomName}」に参加しました`;
      document.getElementById('lobby-waiting-msg').style.display = 'block';
    });
    lobbyHostConn.on('data', data => lobbyGuestReceive(data));
    lobbyHostConn.on('error', () => alert('部屋が見つかりません。合言葉を確認してください'));
  });
}

// ── ホスト側受信 ──
function lobbyHostReceive(peerId, data) {
  const g = lobbyConns[peerId];
  if (!g) return;

  if (data.type === 'MY_NAME') {
    g.name = data.name;
    lobbyUpdatePlayerList();
    // 全員に参加者リストを通知
    const names = [lobbyMyName, ...Object.values(lobbyConns).map(x => x.name)];
    lobbyBroadcast({ type: 'PLAYER_LIST', names });
  }
  // ゲーム中メッセージをゲームごとに委譲
  else if (data.type.startsWith('BINGO_')) bingoHostReceive(peerId, data);
  else if (data.type.startsWith('MINE_'))  mineHostReceive(peerId, data);
  else pokerHostReceive(peerId, data);
}

// ── ゲスト側受信 ──
function lobbyGuestReceive(data) {
  if (data.type === 'ASK_NAME') {
    lobbyHostConn.send({ type: 'MY_NAME', name: lobbyMyName });
  }
  else if (data.type === 'PLAYER_LIST') {
    document.getElementById('lobby-status').innerText = `参加者：${data.names.join('、')}`;
  }
  else if (data.type === 'GAME_SELECTED') {
    if      (data.game === 'poker') pokerGuestStart(data);
    else if (data.game === 'bingo') bingoGuestStart(data);
    else if (data.game === 'mine')  mineGuestStart(data);
  }
  // ゲーム中メッセージをゲームごとに委譲
  else if (data.type.startsWith('BINGO_')) bingoGuestReceive(data);
  else if (data.type.startsWith('MINE_'))  mineGuestReceive(data);
  else pokerGuestReceive(data);
}

// ── ゲーム選択（ホストのみ） ──
function lobbySelectGame(game) {
  const guestList = Object.values(lobbyConns);
  const names = [lobbyMyName, ...guestList.map(g => g.name)];
  const playerCount = names.length;

  if (game === 'poker') {
    // ポーカー用デッキ・手札を生成してから各自に送る
    pokerHostStart(lobbyLang, guestList, lobbyMyName);

  } else if (game === 'bingo') {
    // ホストがカードを生成して全員に配布
    const allCards = bingoGenerateAllCards(playerCount);
    guestList.forEach((g, i) => {
      g.conn.send({
        type: 'GAME_SELECTED', game: 'bingo',
        myIndex: i + 1, playerCount, names,
        myCard: allCards[i + 1]
      });
    });
    bingoHostStart(playerCount, names, allCards[0]);

  } else if (game === 'mine') {
    if (playerCount < 2) return alert('マインスイーパーは2人以上必要です');
    const mineNames = { 1: lobbyMyName, 2: guestList[0].name };
    // 問題はホストが生成してゲストに送信
    const question = minePickQuestion();
    const cellsData = mineBuildCellsData(question.word);
    guestList.forEach(g => {
      g.conn.send({
        type: 'GAME_SELECTED', game: 'mine',
        playerNum: 2, names: mineNames,
        genre: question.genre, wordLength: question.word.length,
        cellsData: cellsData
      });
    });
    mineHostStart(mineNames, question, cellsData);
  }
}

// ── ロビーに戻る ──
function backToLobby() {
  mineStopTimer();
  // ゲーム状態をリセット（画面を戻すだけ）
  showScreen('lobby-screen');
}
