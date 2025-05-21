
const socket = io();
let localStream;
let peerConnection;
let currentRoom = null;
let skipCooldown = false;

const servers = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

document.getElementById('preferences').onsubmit = async (e) => {
  e.preventDefault();
  document.getElementById('home').classList.add('hidden');
  document.getElementById('searching').classList.remove('hidden');
  const username = document.getElementById('username').value;
  socket.emit('joinQueue', { username });

  localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
  document.getElementById('localVideo').srcObject = localStream;

  const audioContext = new AudioContext();
  const micSource = audioContext.createMediaStreamSource(localStream);
  const analyser = audioContext.createAnalyser();
  analyser.fftSize = 64;
  const dataArray = new Uint8Array(analyser.frequencyBinCount);
  micSource.connect(analyser);

  function detectMicActivity() {
    analyser.getByteFrequencyData(dataArray);
    const volume = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
    const isTalking = volume > 15;
    document.getElementById('localMicIndicator').style.opacity = isTalking ? 1 : 0.3;
    requestAnimationFrame(detectMicActivity);
  }
  detectMicActivity();
};

document.getElementById('skipBtn').onclick = () => {
  if (skipCooldown) return;

  skipCooldown = true;
  document.getElementById('skipBtn').textContent = "Skipping...";
  socket.emit('leaveRoom', { roomId: currentRoom });

  setTimeout(() => {
    socket.emit('joinQueue', { username: document.getElementById('username').value });
    document.getElementById('skipBtn').textContent = "Skip";
    skipCooldown = false;
  }, 3000);

  document.getElementById('connectedStatus').textContent = "Waiting for user...";
  document.getElementById('chat').classList.add('fade-out');
  setTimeout(() => {
    resetChat();
    document.getElementById('chat').classList.remove('fade-out');
    document.getElementById('chat').classList.add('hidden');
    document.getElementById('searching').classList.remove('hidden');
  }, 300);
};

socket.on('match', ({ roomId, partnerInfo }) => {
  currentRoom = roomId;
  const status = document.getElementById('connectedStatus');
  status.textContent = "Matched with a stranger!";
  status.style.opacity = 1;
  setTimeout(() => {
    status.style.opacity = 0;
  }, 3000);
  document.getElementById('searching').classList.add('hidden');
  document.getElementById('chat').classList.remove('hidden');
});

function resetChat() {
  document.getElementById('remoteVideo').srcObject = null;
  document.getElementById('messages').innerHTML = '';
  if (peerConnection) peerConnection.close();
}
