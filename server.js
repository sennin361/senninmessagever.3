const express = require("express");
const app = express();
const http = require("http").createServer(app);
const io = require("socket.io")(http);
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const PORT = process.env.PORT || 3000;

// ファイルアップロード設定
const uploadFolder = path.join(__dirname, "public", "uploads");
if (!fs.existsSync(uploadFolder)) fs.mkdirSync(uploadFolder, { recursive: true });
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadFolder),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, Date.now() + ext);
  }
});
const upload = multer({ storage });

// 静的ファイル公開
app.use(express.static("public"));

// 画像アップロードAPI
app.post("/upload", upload.single("image"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });
  // アップロードしたファイルのURLを返す
  const fileUrl = `/uploads/${req.file.filename}`;
  res.json({ url: fileUrl });
});

// チャット管理
let rooms = {}; // { roomName: { users: Map(socket.id=>nickname), messages: [] } }

// ルーム参加判定
function joinRoom(socket, roomName, nickname) {
  if (!rooms[roomName]) {
    rooms[roomName] = { users: new Map(), messages: [] };
  }
  rooms[roomName].users.set(socket.id, nickname);
  socket.join(roomName);
  // 履歴送信
  socket.emit("chatHistory", rooms[roomName].messages);
  // 入室通知
  io.to(roomName).emit("systemMessage", `${nickname} が入室しました`);
}

// ルーム退室処理
function leaveRoom(socket) {
  for (const roomName in rooms) {
    if (rooms[roomName].users.has(socket.id)) {
      const nickname = rooms[roomName].users.get(socket.id);
      rooms[roomName].users.delete(socket.id);
      socket.leave(roomName);
      io.to(roomName).emit("systemMessage", `${nickname} が退室しました`);
      // ユーザー0ならルーム削除
      if (rooms[roomName].users.size === 0) delete rooms[roomName];
      break;
    }
  }
}

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  socket.on("joinRoom", ({ roomName, nickname }) => {
    if (!roomName || !nickname) {
      socket.emit("errorMessage", "ルーム名とニックネームを指定してください");
      return;
    }
    leaveRoom(socket); // もし既にどこか入ってたら抜ける
    joinRoom(socket, roomName, nickname);
  });

  socket.on("sendMessage", ({ text, image }) => {
    // 送信者のルームとニックネームを特定
    let userRoom = null;
    let userNick = null;
    for (const roomName in rooms) {
      if (rooms[roomName].users.has(socket.id)) {
        userRoom = roomName;
        userNick = rooms[roomName].users.get(socket.id);
        break;
      }
    }
    if (!userRoom || !userNick) return;
    const msgObj = {
      nickname: userNick,
      text: text || null,
      image: image || null,
      timestamp: Date.now(),
    };
    rooms[userRoom].messages.push(msgObj);
    io.to(userRoom).emit("newMessage", msgObj);
  });

  socket.on("leaveRoom", () => {
    leaveRoom(socket);
  });

  socket.on("disconnect", () => {
    leaveRoom(socket);
    console.log("User disconnected:", socket.id);
  });
});

http.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
