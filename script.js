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
});

function sendMessage() {
  const input = document.getElementById("input");
  const msg = input.value;
  socket.emit("message", msg);
  const div = document.createElement("div");
  div.textContent = "You: " + msg;
  document.getElementById("messages").appendChild(div);
  input.value = "";
}
window.sendMessage = sendMessage;

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

// Mic Toggle
document.getElementById("micToggleBtn")?.addEventListener("click", () => {
  micEnabled = !micEnabled;
  localStream.getAudioTracks().forEach(track => {
    track.enabled = micEnabled;
  });
  document.getElementById("micToggleBtn").innerText = micEnabled ? "🎤 Mic On" : "🔇 Mic Off";
});

// Screen Share
document.getElementById("screenShareBtn")?.addEventListener("click", async () => {
  try {
    const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
    const videoTrack = screenStream.getVideoTracks()[0];
    const sender = peerConnection.getSenders().find(s => s.track.kind === "video");
    sender.replaceTrack(videoTrack);
  } catch (err) {
    alert("Screen share failed: " + err.message);
  }
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
