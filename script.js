const socket = io();
const urlParams = new URLSearchParams(window.location.search);
const mode = urlParams.get("mode");

const gender = localStorage.getItem("gender");
const interest = localStorage.getItem("interest");
let localStream;
let peerConnection;

// Show waiting message before matched
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

socket.on("ready", () => {
  document.getElementById("matchStatus").remove();

  if (mode === "text") {
    document.getElementById("textChat").style.display = "block";
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
  }
});

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

// WebRTC for video
socket.on("offer", async (offer) => {
  peerConnection = new RTCPeerConnection();
  addTracks();
  peerConnection.ontrack = (e) => document.getElementById("remoteVideo").srcObject = e.streams[0];
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
  if (mode === "video") {
    peerConnection = new RTCPeerConnection();
    addTracks();
    peerConnection.ontrack = (e) => document.getElementById("remoteVideo").srcObject = e.streams[0];
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    socket.emit("offer", offer);
    peerConnection.onicecandidate = (e) => {
      if (e.candidate) socket.emit("ice-candidate", e.candidate);
    };
  }
});

function addTracks() {
  localStream.getTracks().forEach(track => {
    peerConnection.addTrack(track, localStream);
  });
}

// Buttons
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
