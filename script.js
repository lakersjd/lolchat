const socket = io();
const urlParams = new URLSearchParams(window.location.search);
const mode = urlParams.get("mode");

const gender = localStorage.getItem("gender");
const interest = localStorage.getItem("interest");
let localStream;
let peerConnection;
let countdownInterval;

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

function startCountdown() {
  const timerDisplay = document.getElementById("countdown");
  let time = 180; // 3 minutes
  function updateTimer() {
    const min = Math.floor(time / 60);
    const sec = time % 60;
    timerDisplay.textContent = `⏳ ${min}:${sec < 10 ? "0" + sec : sec}`;
    if (time <= 0) {
      clearInterval(countdownInterval);
      location.reload(); // auto-skip
    }
    time--;
  }
  updateTimer();
  countdownInterval = setInterval(updateTimer, 1000);
}

// Report/Block/Skip Buttons
document.getElementById("skipBtn")?.addEventListener("click", () => location.reload());
document.getElementById("reportBtn")?.addEventListener("click", () => {
  alert("User reported.");
  location.reload();
});
document.getElementById("blockBtn")?.addEventListener("click", () => {
  alert("User blocked.");
  location.reload();
});
