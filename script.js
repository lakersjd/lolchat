const socket = io();
const urlParams = new URLSearchParams(window.location.search);
const mode = urlParams.get("mode");

const gender = localStorage.getItem("gender");
const interest = localStorage.getItem("interest");
let localStream;
let peerConnection;
let countdownInterval;
let micEnabled = true;

socket.emit("joinQueue", { gender, interest });

socket.on("message", (msg) => {
  const div = document.createElement("div");
  div.textContent = "Stranger: " + msg;
  document.getElementById("messages").appendChild(div);
  document.getElementById("typingIndicator").style.display = "none";
});

function sendMessage() {
  const input = document.getElementById("input");
  const msg = input.value;
  if (msg.trim() === "") return;
  socket.emit("message", msg);
  const div = document.createElement("div");
  div.textContent = "You: " + msg;
  document.getElementById("messages").appendChild(div);
  input.value = "";
  document.getElementById("typingIndicator").style.display = "none";
}
window.sendMessage = sendMessage;

document.getElementById("input")?.addEventListener("input", () => {
  socket.emit("typing");
});

socket.on("typing", () => {
  const el = document.getElementById("typingIndicator");
  el.style.display = "block";
  el.textContent = "Stranger is typing...";
  clearTimeout(el._timeout);
  el._timeout = setTimeout(() => {
    el.style.display = "none";
  }, 2000);
});

if (mode === "text") {
  document.getElementById("textChat").style.display = "block";
  startCountdown();
}

if (mode === "video") {
  document.getElementById("videoChat").style.display = "block";
  const localVideo = document.getElementById("localVideo");
  const remoteVideo = document.getElementById("remoteVideo");

  navigator.mediaDevices.getUserMedia({ video: true, audio: true })
    .then((stream) => {
      localStream = stream;
      localVideo.srcObject = stream;
      socket.emit("ready");
    });

  socket.on("offer", async (offer) => {
    playSound("connect");
    peerConnection = new RTCPeerConnection();
    addTracks();
    peerConnection.ontrack = (e) => remoteVideo.srcObject = e.streams[0];
    await peerConnection.setRemoteDescription(offer);
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    socket.emit("answer", answer);
    peerConnection.onicecandidate = (e) => {
      if (e.candidate) socket.emit("ice-candidate", e.candidate);
    };
  });

  socket.on("answer", async (answer) => {
    await peerConnection.setRemoteDescription(answer);
  });

  socket.on("ice-candidate", (candidate) => {
    peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
  });

  socket.on("ready", async () => {
    playSound("connect");
    document.getElementById("systemMsg").innerText = "🔗 You're now connected to a stranger.";
    peerConnection = new RTCPeerConnection();
    addTracks();
    peerConnection.ontrack = (e) => remoteVideo.srcObject = e.streams[0];
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    socket.emit("offer", offer);
    peerConnection.onicecandidate = (e) => {
      if (e.candidate) socket.emit("ice-candidate", e.candidate);
    };
  });

  function addTracks() {
    localStream.getTracks().forEach(track => {
      peerConnection.addTrack(track, localStream);
    });
  }

  startCountdown();
}

document.getElementById("emojiBtn")?.addEventListener("click", () => {
  const input = document.getElementById("input");
  input.value += "😊";
  input.focus();
});

function startCountdown() {
  const timerDisplay = document.getElementById("countdown");
  let time = 180;
  function updateTimer() {
    const min = Math.floor(time / 60);
    const sec = time % 60;
    timerDisplay.textContent = `⏳ ${min}:${sec < 10 ? "0" + sec : sec}`;
    if (time <= 0) {
      clearInterval(countdownInterval);
      location.reload();
    }
    time--;
  }
  updateTimer();
  countdownInterval = setInterval(updateTimer, 1000);
}

document.getElementById("skipBtn")?.addEventListener("click", () => location.reload());
document.getElementById("reportBtn")?.addEventListener("click", () => {
  socket.emit("report");
  alert("User reported.");
  playSound("disconnect");
  location.reload();
});
document.getElementById("blockBtn")?.addEventListener("click", () => {
  socket.emit("block");
  alert("User blocked.");
  playSound("disconnect");
  location.reload();
});

socket.on("onlineCount", (count) => {
  document.getElementById("systemMsg").innerText = `👥 ${count} people online.`;
});

function playSound(type) {
  const audio = new Audio(type === "connect" ? "connect.mp3" : "disconnect.mp3");
  audio.play();
}

// Theme and Font Size Settings
const themeSelect = document.getElementById("themeSelect");
const fontSizeSelect = document.getElementById("fontSizeSelect");

themeSelect.addEventListener("change", () => {
  const theme = themeSelect.value;
  document.body.classList.toggle("dark", theme === "dark");
  localStorage.setItem("theme", theme);
});

fontSizeSelect.addEventListener("change", () => {
  document.body.style.fontSize = fontSizeSelect.value;
  localStorage.setItem("fontSize", fontSizeSelect.value);
});

// Load preferences
const savedTheme = localStorage.getItem("theme");
const savedFontSize = localStorage.getItem("fontSize");
if (savedTheme) {
  document.body.classList.toggle("dark", savedTheme === "dark");
  themeSelect.value = savedTheme;
}
if (savedFontSize) {
  document.body.style.fontSize = savedFontSize;
  fontSizeSelect.value = savedFontSize;
}
