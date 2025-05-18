const socket = io();
let partnerId = null;

document.getElementById('startBtn').onclick = () => socket.emit('join');
document.getElementById('skipBtn').onclick = () => socket.emit('skip');
document.getElementById('stopBtn').onclick = () => socket.emit('stop');

socket.on('partner', (id) => {
  partnerId = id;
  console.log('Connected to:', id);
  // Setup WebRTC connection here
});

socket.on('left', () => {
  partnerId = null;
  console.log('Partner left');
});