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
  });

  lobbyPeer.on("connection", (c) => {
    const pid = c.peer;
    lobbyConns[pid] = { conn: c, name: "接続中…" };

    c.on("open", () => {
      // 接続が確立したら名前を要求
      c.send({ type: "ASK_NAME" });
    });

    c.on("data", (data) => lobbyHostReceive(pid, data));

    c.on("close", () => {
      delete lobbyConns[pid];
      lobbyUpdatePlayerList();
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
