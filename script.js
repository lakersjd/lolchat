const socket = io();
const urlParams = new URLSearchParams(window.location.search);
const mode = urlParams.get("mode");

const gender = localStorage.getItem("gender");
const interest = localStorage.getItem("tags");
const language = localStorage.getItem("language");
const country = localStorage.getItem("country");

let localStream;
let peerConnection;
let micEnabled = true;
let messageCooldown = false;
let lastMsg = "";
let repeatCount = 0;

socket.emit("joinQueue", { gender, interest, language, country });

function sendMessage() {
  const input = document.getElementById("input");
  const msg = input.value.trim();
  if (msg === "" || messageCooldown) return;

  if (msg === lastMsg) {
    repeatCount++;
    if (repeatCount >= 3) {
      alert("You are sending the same message repeatedly. You have been disconnected.");
      location.reload();
      return;
    }
  } else {
    repeatCount = 0;
  }

  lastMsg = msg;
  messageCooldown = true;
  setTimeout(() => { messageCooldown = false; }, 1000);

  socket.emit("message", msg);
  const div = document.createElement("div");
  div.textContent = "You: " + msg;
  document.getElementById("messages").appendChild(div);
  input.value = "";
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

if (mode === "video") {
  document.getElementById("videoChat").style.display = "block";
  const localVideo = document.getElementById("localVideo");
  const remoteVideo = document.getElementById("remoteVideo");

  navigator.mediaDevices.getUserMedia({ video: true, audio: true })
    .then((stream) => {
      localStream = stream;
      localVideo.srcObject = stream;
      socket.emit("ready");
      runFaceDetection(); // hook in
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

  socket.on("answer", async (answer) => {
    await peerConnection.setRemoteDescription(answer);
  });

  socket.on("ice-candidate", (candidate) => {
    peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
  });

  function addTracks() {
    localStream.getTracks().forEach(track => {
      peerConnection.addTrack(track, localStream);
    });
  }
}

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
document.getElementById("homeBtn")?.addEventListener("click", () => {
  location.href = "index.html";
});

socket.on("message", (msg) => {
  const div = document.createElement("div");
  div.textContent = "Stranger: " + msg;
  document.getElementById("messages").appendChild(div);
});

socket.on("onlineCount", (count) => {
  document.getElementById("systemMsg").innerText = `👥 ${count} people online.`;
});

async function runFaceDetection() {
  if (!window.faceapiLoaded) {
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/@vladmandic/face-api/dist/face-api.min.js";
    script.onload = async () => {
      await faceapi.nets.tinyFaceDetector.loadFromUri("https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model");
      window.faceapiLoaded = true;
      detectFace();
    };
    document.head.appendChild(script);
  } else {
    detectFace();
  }
}

function detectFace() {
  const video = document.getElementById("localVideo");
  const interval = setInterval(async () => {
    if (!video || video.paused || video.ended) return;
    const detections = await faceapi.detectAllFaces(video, new faceapi.TinyFaceDetectorOptions());
    if (!detections.length) {
      console.warn("No face detected");
    }
  }, 3000);
}
