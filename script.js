const socket = io();
const urlParams = new URLSearchParams(window.location.search);
const mode = urlParams.get("mode");

let localStream;
let remoteStream;
let peerConnection;
const servers = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

if (mode === "text") {
  document.getElementById("textChat").style.display = "block";
  const input = document.getElementById("input");
  const messages = document.getElementById("messages");

  socket.on("message", (msg) => {
    const div = document.createElement("div");
    div.textContent = "Stranger: " + msg;
    messages.appendChild(div);
  });

  function sendMessage() {
    const msg = input.value;
    socket.emit("message", msg);
    const div = document.createElement("div");
    div.textContent = "You: " + msg;
    messages.appendChild(div);
    input.value = "";
  }
  window.sendMessage = sendMessage;

} else if (mode === "video") {
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
    peerConnection = new RTCPeerConnection(servers);
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
    peerConnection = new RTCPeerConnection(servers);
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
}
