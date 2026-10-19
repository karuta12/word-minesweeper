// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ■ 共通ロビー（修正版）
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

let lobbyPeer = null;
let lobbyConns = {}; // { peerId: { conn, name } }  ホスト用
let lobbyHostConn = null; // ゲスト用
let lobbyMyName = "";
let lobbyIsHost = false;
let lobbyRoomName = "";
let lobbyLang = "ja"; // ポーカー用言語

// ゲームオプション
let lobbyGameOptions = {
  mine_prereveal: false, // マインスイーパー：先攻前に1個開く
  mine_layout: "fixed", // マインスイーパー配置："fixed" or "random"
};

// ── 言語選択（ポーカー用、ホストのみ） ──
function lobbySelectLang(l) {
  lobbyLang = l;
  document
    .getElementById("lobby-btn-ja")
    .classList.toggle("active", l === "ja");
  document
    .getElementById("lobby-btn-en")
    .classList.toggle("active", l === "en");
}

// ── ゲームオプション更新（ホストのみ） ──
function lobbyUpdateMineOptions() {
  if (!lobbyIsHost) return;
  const checkbox = document.getElementById("lobby-option-mine-prereveal");
  if (checkbox) {
    lobbyGameOptions.mine_prereveal = checkbox.checked;
    minePreRevealMode = checkbox.checked;
  }
  
  const layoutRadio = document.querySelector('input[name="lobby-option-mine-layout"]:checked');
  if (layoutRadio) {
    lobbyGameOptions.mine_layout = layoutRadio.value;
    mineBoardLayout = layoutRadio.value;
  }
}

// ── 参加者リスト表示 ──
function lobbyUpdatePlayerList() {
  const ul = document.getElementById("lobby-player-list");
  if (!ul) return;
  ul.innerHTML = `<li>👑 ${lobbyMyName}（ホスト）</li>`;
  Object.values(lobbyConns).forEach((g) => {
    ul.innerHTML += `<li>👤 ${g.name}</li>`;
  });
}

// ── 全ゲスト一斉送信 ──
function lobbyBroadcast(msg) {
  Object.values(lobbyConns).forEach((g) => {
    if (g.conn && g.conn.open) {
      g.conn.send(msg);
    }
  });
}

// ── 古いPeerの破棄処理（安全対策） ──
function lobbyCleanupPeer() {
  if (lobbyPeer) {
    try {
      lobbyPeer.destroy();
    } catch (e) {
      console.error(e);
    }
    lobbyPeer = null;
  }
  lobbyConns = {};
  lobbyHostConn = null;
}

// ── 部屋を作る（ホスト） ──
function lobbyCreateRoom() {
  lobbyRoomName = document.getElementById("lobby-room-input").value.trim();
  if (!lobbyRoomName) return alert("合言葉を入力してください");
  lobbyMyName = prompt("名前を入力してください", "ホスト") || "ホスト";
  lobbyIsHost = true;

  // 既存のPeerがあれば破棄してから新規作成
  lobbyCleanupPeer();

  const peerId = "gamelobby-" + encodeURIComponent(lobbyRoomName);

  // デバッグ用および接続安定化のためのオプション（必要に応じてクラウドサーバー等）
  lobbyPeer = new Peer(peerId, {
    debug: 2,
  });

  lobbyPeer.on("error", (e) => {
    console.error(e);
    if (e.type === "unavailable-id") {
      alert(
        "その合言葉の部屋はすでに存在するか、前回の接続が残っています。少し時間を置くか別の合言葉をお試しください。",
      );
    } else {
      alert("接続エラー: " + e.message);
    }
    document.getElementById("lobby-status").innerText =
      "部屋の作成に失敗しました";
  });

  lobbyPeer.on("open", (id) => {
    document.getElementById("lobby-status").innerText =
      `部屋「${lobbyRoomName}」を作りました（待機中...）`;
    document.getElementById("host-lobby").style.display = "block";
    lobbyUpdatePlayerList();

    const saved = typeof mineLoadState === "function" ? mineLoadState() : null;
    if (saved && confirm(`部屋「${lobbyRoomName}」の前回のマインスイーパーのゲームデータが見つかりました。続きから再開しますか？`)) {
      mineResumeHostState(saved);
    }
  });

  lobbyPeer.on("connection", (c) => {
    const pid = c.peer;
    lobbyConns[pid] = { conn: c, name: "接続中…" };
    lobbyUpdatePlayerList(); // 接続直後に「接続中…」として表示

    c.on("open", () => {
      // 接続が確立したら名前を要求
      c.send({ type: "ASK_NAME" });
    });

    c.on("data", (data) => lobbyHostReceive(pid, data));

    c.on("close", () => {
      const playerName = lobbyConns[pid]?.name;
      delete lobbyConns[pid];
      lobbyUpdatePlayerList();
      if (playerName && typeof minePlayerNames !== "undefined" && playerName === minePlayerNames[2]) {
        mineAddLog(`⚠️ ${playerName} の接続が切れました（再接続待ち...）`, true);
      }
    });

    c.on("error", (err) => {
      console.error("Connection error with client:", err);
    });
  });
}

// ── 部屋に参加（ゲスト） ──
function lobbyJoinRoom() {
  lobbyRoomName = document.getElementById("lobby-room-input").value.trim();
  if (!lobbyRoomName) return alert("合言葉を入力してください");
  lobbyMyName = prompt("名前を入力してください", "プレイヤー") || "プレイヤー";
  lobbyIsHost = false;

  lobbyCleanupPeer();

  lobbyPeer = new Peer({
    debug: 2,
  });

  lobbyPeer.on("error", (e) => {
    console.error(e);
    alert("Peer接続エラー: " + e.message);
  });

  lobbyPeer.on("open", () => {
    const hostPeerId = "gamelobby-" + encodeURIComponent(lobbyRoomName);
    lobbyHostConn = lobbyPeer.connect(hostPeerId);

    lobbyHostConn.on("open", () => {
      document.getElementById("lobby-status").innerText =
        `部屋「${lobbyRoomName}」に参加しました`;
      document.getElementById("lobby-waiting-msg").style.display = "block";
      // open 時に自分から名前を送信（ASK_NAME を待たずに確実に届ける）
      lobbyHostConn.send({ type: "GIVE_NAME", name: lobbyMyName });
    });

    lobbyHostConn.on("data", (data) => lobbyGuestReceive(data));

    lobbyHostConn.on("error", (err) => {
      console.error(err);
      alert(
        "部屋が見つからないか、接続が切断されました。合言葉を確認してください。",
      );
    });

    lobbyHostConn.on("close", () => {
      alert("ホストとの接続が切れました。");
      showScreen("lobby-screen");
    });
  });
}
// ── ホスト受信（ロビー＋ゲーム中メッセージを振り分け） ──
function lobbyHostReceive(peerId, data) {
  if (data.type === "GIVE_NAME") {
    const peerName = data.name;
    if (lobbyConns[peerId]) {
      lobbyConns[peerId].name = peerName;
      lobbyUpdatePlayerList();
    }
    // マインスイーパープレイ中の再接続チェック
    let matchedPlayerNum = null;
    if (typeof minePlayerNames !== "undefined" && minePlayerNames[2] === peerName) {
      matchedPlayerNum = 2;
    }
    if (matchedPlayerNum && typeof mineCellsData !== "undefined" && Object.keys(mineCellsData).length > 0) {
      if (lobbyConns[peerId]) {
        lobbyConns[peerId].conn.send({
          type: "GAME_SELECTED",
          game: "mine",
          playerNum: matchedPlayerNum,
          names: minePlayerNames,
          genre: mineGenre,
          wordLength: mineWordLength,
          cellsData: mineCellsData,
          firstTurn: mineTurn,
          revealedPos: mineRevealedPos,
          p1HintUsed: mineP1HintUsed,
          p2HintUsed: mineP2HintUsed,
          canAnswer: mineCanAnswer,
          skipped: mineSkipped,
          timeLeft: mineTimeLeft,
        });
        mineAddLog(`👤 ${peerName} がゲームに再接続しました。`, true);
      }
    }
  } else if (data.type === "BINGO_WORD") {
    bingoHostReceive(peerId, data);
  } else if (data.type === "MINE_OPEN" || data.type === "MINE_GUESS" || data.type === "MINE_HINT_REQUEST") {
    mineHostReceive(peerId, data);
  } else if (data.type === "EXCHANGE_DONE" || data.type === "SCORE" || data.type === "REMATCH_REQUEST") {
    pokerHostReceive(peerId, data);
  } else if (data.type === "MOJIPIT_PLACE" || data.type === "MOJIPIT_ACCUSE") {
    mojipHostReceive(peerId, data);
  }
}

// ── ゲスト受信（ロビー＋ゲーム中メッセージを振り分け） ──
function lobbyGuestReceive(data) {
  if (data.type === "ASK_NAME") {
    // ホストから名前を要求されたら返答
    lobbyHostConn.send({ type: "GIVE_NAME", name: lobbyMyName });
  } else if (data.type === "GAME_SELECTED") {
    if (data.game === "poker") {
      pokerGuestStart(data);
    } else if (data.game === "bingo") {
      bingoGuestStart(data);
    } else if (data.game === "mine") {
      mineGuestStart(data);
    } else if (data.game === "mojipittan") {
      mojipGuestStart(data);
    }
  } else if (data.type === "BINGO_WORD" || data.type === "BINGO_WIN") {
    bingoGuestReceive(data);
  } else if (
    data.type === "MINE_PRESET_OPEN" ||
    data.type === "MINE_CELL_OPENED" || data.type === "MINE_TURN_CHANGE" ||
    data.type === "MINE_GUESS_RESULT" || data.type === "MINE_HINT_REVEAL" ||
    data.type === "MINE_TIMER" || data.type === "MINE_LOG"
    ) {
    mineGuestReceive(data);
    }
 else if (data.type === "ALL_EXCHANGED" || data.type === "RESULT" || data.type === "REMATCH_START") {
    pokerGuestReceive(data);
  } else if (data.type === "MOJIPIT_PLACE" || data.type === "MOJIPIT_ACCUSE" || data.type === "MOJIPIT_FINISH") {
    mojipGuestReceive(data);
  }
}

// ── ゲーム選択（ホストのみ） ──
function lobbySelectGame(game) {
  const guestList = Object.values(lobbyConns);
  const names = [lobbyMyName, ...guestList.map((g) => g.name)];
  const playerCount = names.length;

  if (game === "poker") {
    pokerHostStart(lobbyLang, guestList, lobbyMyName);
  } else if (game === "bingo") {
    const allCards = bingoGenerateAllCards(playerCount);
    guestList.forEach((g, i) => {
      g.conn.send({
        type: "GAME_SELECTED",
        game: "bingo",
        myIndex: i + 1,
        playerCount,
        names,
        allCards: allCards,
      });
    });
    bingoHostStart(playerCount, names, allCards);
  } else if (game === "mine") {
    if (playerCount < 2) return alert("マインスイーパーは2人以上必要です");
    const mineNames = { 1: lobbyMyName, 2: guestList[0].name };
    const question = minePickQuestion();
    
    let cellsData;
    let randomGrid = null;
    if (lobbyGameOptions.mine_layout === "random") {
      const result = mineBuildCellsDataRandom(question.word);
      cellsData = result.cells;
      randomGrid = result.grid;
    } else {
      cellsData = mineBuildCellsData(question.word);
    }
    
    const firstTurn = Math.random() < 0.5 ? 1 : 2;
    guestList.forEach((g) => {
      g.conn.send({
        type: "GAME_SELECTED",
        game: "mine",
        playerNum: 2,
        names: mineNames,
        genre: question.genre,
        wordLength: question.word.length,
        cellsData: cellsData,
        firstTurn: firstTurn,
        preRevealMode: lobbyGameOptions.mine_prereveal,
        boardLayout: lobbyGameOptions.mine_layout,
        randomGrid: randomGrid,
      });
    });
    mineHostStart(mineNames, question, cellsData, firstTurn);
  } else if (game === "mojipittan") {
    if (playerCount < 2) return alert("逆もじぴったんは2人必要です");
    if (playerCount > 2) return alert("逆もじぴったんは2人専用です");
    guestList.forEach((g, i) => {
      g.conn.send({
        type: "GAME_SELECTED",
        game: "mojipittan",
        myIndex: i + 1,
        names,
      });
    });
    mojipHostStart(names);
  }
}
