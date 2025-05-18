const socket = io();
const urlParams = new URLSearchParams(window.location.search);
const mode = urlParams.get("mode");

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
  // WebRTC logic would go here
}
