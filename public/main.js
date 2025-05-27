const socket = io();

const joinForm = document.getElementById("joinForm");
const roomNameInput = document.getElementById("roomName");
const nicknameInput = document.getElementById("nickname");
const chatArea = document.getElementById("chatArea");
const chatLog = document.getElementById("chatLog");
const chatInput = document.getElementById("chatInput");
const sendBtn = document.getElementById("sendBtn");
const imageBtn = document.getElementById("imageBtn");
const imageInput = document.getElementById("imageInput");
const leaveBtn = document.getElementById("leaveBtn");

let currentRoom = null;
let currentNick = null;

function addMessage({ nickname, text, image, timestamp }, isMe) {
  const div = document.createElement("div");
  div.classList.add("message");
  div.classList.add(isMe ? "me" : "other");

  if (nickname) {
    const nickDiv = document.createElement("div");
    nickDiv.className = "nickname";
    nickDiv.textContent = nickname;
    div.appendChild(nickDiv);
  }

  if (text) {
    const p = document.createElement("p");
    p.textContent = text;
    div.appendChild(p);
  }

  if (image) {
    const img = document.createElement("img");
    img.src = image;
    img.style.maxWidth = "200px";
    img.style.borderRadius = "8px";
    div.appendChild(img);
  }

  chatLog.appendChild(div);
  chatLog.scrollTop = chatLog.scrollHeight;
}

function addSystemMessage(text) {
  const div = document.createElement("div");
  div.className = "system-message";
  div.textContent = text;
  chatLog.appendChild(div);
  chatLog.scrollTop = chatLog.scrollHeight;
}

joinForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const room = roomNameInput.value.trim();
  const nick = nicknameInput.value.trim();
  if (!room || !nick) {
    alert("ルーム名とニックネームを入力してください");
    return;
  }
  socket.emit("joinRoom", { roomName: room, nickname: nick });
  currentRoom = room;
  currentNick = nick;
  joinForm.style.display = "none";
  chatArea.style.display = "flex";
  chatLog.innerHTML = "";
});

sendBtn.addEventListener("click", () => {
  const msg = chatInput.value.trim();
  if (!msg) return;
  socket.emit("sendMessage", { text: msg });
  chatInput.value = "";
});

chatInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") sendBtn.click();
});

imageBtn.addEventListener("click", () => {
  imageInput.click();
});

imageInput.addEventListener("change", () => {
  if (imageInput.files.length === 0) return;
  const file = imageInput.files[0];
  if (!file.type.startsWith("image/")) {
    alert("画像ファイルを選択してください");
    imageInput.value = "";
    return;
  }
  const formData = new FormData();
  formData.append("image", file);
  fetch("/upload", {
    method: "POST",
    body: formData,
  })
    .then(res => res.json())
    .then(data => {
      if (data.url) {
        socket.emit("sendMessage", { image: data.url });
      } else {
        alert("画像アップロードに失敗しました");
      }
    })
    .catch(() => alert("画像アップロードに失敗しました"))
    .finally(() => {
      imageInput.value = "";
    });
});

leaveBtn.addEventListener("click", () => {
  if (!currentRoom) return;
  socket.emit("leaveRoom");
  chatArea.style.display = "none";
  joinForm.style.display = "flex";
  roomNameInput.value = "";
  nicknameInput.value = "";
  chatLog.innerHTML = "";
  currentRoom = null;
  currentNick = null;
});

socket.on("chatHistory", (messages) => {
  chatLog.innerHTML = "";
  messages.forEach(msg => {
    addMessage(msg, msg.nickname === currentNick);
  });
});

socket.on("newMessage", (msg) => {
  addMessage(msg, msg.nickname === currentNick);
});

socket.on("systemMessage", (msg) => {
  addSystemMessage(msg);
});

socket.on("errorMessage", (msg) => {
  alert(msg);
});
