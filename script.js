const socket = io();
const urlParams = new URLSearchParams(window.location.search);
const mode = urlParams.get("mode");

const gender = localStorage.getItem("gender");
const interest = localStorage.getItem("interest");
let localStream;
let peerConnection;
const emojiMap = {
  ":smile:": "😄",
  ":heart:": "❤️",
  ":fire:": "🔥",
  ":laughing:": "😂",
  ":thumbsup:": "👍",
  ":clap:": "👏",
  ":sob:": "😭",
  ":sunglasses:": "😎"
};

const matchSound = new Audio("https://actions.google.com/sounds/v1/cartoon/clang_and_wobble.ogg");

const statusDiv = document.createElement("div");
statusDiv.id = "matchStatus";
statusDiv.className = "status";
statusDiv.innerHTML = '🔍 Looking for a match... <button id="cancelSearch">Cancel</button>';
document.body.appendChild(statusDiv);

socket.emit("joinQueue", { gender, interest });

document.getElementById("cancelSearch").addEventListener("click", () => {
  socket.disconnect();
  window.location.href = "/";
});


const connectSound = new Audio("https://actions.google.com/sounds/v1/cartoon/clang_and_wobble.ogg");

socket.on("ready", () => {
  connectSound.play();
  document.getElementById("matchStatus")?.remove();
  document.body.classList.remove("blur");
  // rest continues...
});

  document.getElementById("matchStatus").remove();
  matchSound.play();
  if (navigator.vibrate) navigator.vibrate([200, 100, 200]);

  if (mode === "text") {
    document.getElementById("textChat").style.display = "block";
    document.getElementById("fileInput").style.display = "inline";
  }

  if (mode === "video") {
    document.getElementById("videoChat").style.display = "block";
    const localVideo = document.getElementById("localVideo");
    const remoteVideo = document.getElementById("remoteVideo");

    navigator.mediaDevices.getUserMedia({ video: true, audio: true }).then((stream) => {
      localStream = stream;
      localVideo.srcObject = stream;
      socket.emit("ready");
    });
  }
});

socket.on("message", (msg) => {
  const div = document.createElement("div");
  div.innerHTML = "<b>Stranger:</b> " + formatMessage(msg);
  document.getElementById("messages").appendChild(div);
});

function sendMessage() {
  const input = document.getElementById("input");
  const msg = input.value;
  if (!msg.trim()) return;
  socket.emit("message", msg);
  const div = document.createElement("div");
  div.innerHTML = "<b>You:</b> " + formatMessage(msg);
  document.getElementById("messages").appendChild(div);
  input.value = "";
}
window.sendMessage = sendMessage;

function formatMessage(text) {
  const urlRegex = /https?:\/\/[\w\-._~:/?#\[\]@!$&'()*+,;=]+/g;
  for (const [key, emoji] of Object.entries(emojiMap)) {
    text = text.replaceAll(key, emoji);
  }
  return text.replace(urlRegex, (url) => `<a href="\${url}" target="_blank">\${url}</a>`);
}

document.getElementById("fileInput")?.addEventListener("change", (event) => {
  const file = event.target.files[0];
  if (!file || file.size > 5 * 1024 * 1024) {
    alert("File too large or missing (max 5MB).");
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    const base64 = reader.result;
    const ext = file.name.split(".").pop().toLowerCase();
    socket.emit("file", { name: file.name, type: file.type, data: base64 });
    const div = document.createElement("div");
    if (file.type.startsWith("image/")) {
      div.innerHTML = '<b>You:</b><br><img src="' + base64 + '" style="max-width:200px;">';
    } else {
      div.innerHTML = '<b>You:</b> <a href="' + base64 + '" download="' + file.name + '">' + file.name + '</a>';
    }
    document.getElementById("messages").appendChild(div);
  };
  reader.readAsDataURL(file);
});

socket.on("file", ({ name, type, data }) => {
  const div = document.createElement("div");
  if (type.startsWith("image/")) {
    div.innerHTML = '<b>Stranger:</b><br><img src="' + data + '" style="max-width:200px;">';
  } else {
    div.innerHTML = '<b>Stranger:</b> <a href="' + data + '" download="' + name + '">' + name + '</a>';
  }
  document.getElementById("messages").appendChild(div);
});

// Mute mic and toggle cam
let micMuted = false;
let camOff = false;

document.getElementById("muteMicBtn")?.addEventListener("click", () => {
  if (!localStream) return;
  micMuted = !micMuted;
  localStream.getAudioTracks().forEach(track => track.enabled = !micMuted);
  document.getElementById("muteMicBtn").textContent = micMuted ? "🎙️ Unmute" : "🎙️ Mute";
});

document.getElementById("toggleCamBtn")?.addEventListener("click", () => {
  if (!localStream) return;
  camOff = !camOff;
  localStream.getVideoTracks().forEach(track => track.enabled = !camOff);
  document.getElementById("toggleCamBtn").textContent = camOff ? "📷 On" : "📷 Off";
});

document.getElementById("skipBtn")?.addEventListener("click", () => location.reload());
document.getElementById("reportBtn")?.addEventListener("click", () => {
  socket.emit("report");
  alert("User reported.");
  location.reload();
});
document.getElementById("blockBtn")?.addEventListener("click", () => {
  socket.emit("block");
  alert("User blocked.");
  location.reload();
});


// Online user count + typing indicator
const inputBox = document.getElementById("input");
let typingTimeout;
inputBox?.addEventListener("input", () => {
  socket.emit("typing");
  clearTimeout(typingTimeout);
  typingTimeout = setTimeout(() => socket.emit("stopTyping"), 1000);
});

socket.on("onlineCount", (count) => {
  document.getElementById("onlineCount").textContent = "🟢 Online: " + count;
});

socket.on("strangerTyping", () => {
  document.getElementById("typingIndicator").textContent = "✍️ Stranger is typing...";
});
socket.on("strangerStopTyping", () => {
  document.getElementById("typingIndicator").textContent = "";
});


let chatCount = localStorage.getItem("chatCount") || 0;

const connectSound = new Audio("https://actions.google.com/sounds/v1/cartoon/clang_and_wobble.ogg");

socket.on("ready", () => {
  connectSound.play();
  document.getElementById("matchStatus")?.remove();
  document.body.classList.remove("blur");
  // rest continues...
});

  chatCount++;
  localStorage.setItem("chatCount", chatCount);
  document.getElementById("chatCounter")?.textContent = `💬 Chats: ${chatCount}`;
});

socket.on("partnerDisconnected", () => {
  const msg = document.createElement("div");
  msg.innerHTML = "<i>❌ Stranger has disconnected.</i>";
  document.getElementById("messages")?.appendChild(msg);
});
