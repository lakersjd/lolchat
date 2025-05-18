const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("."));

let waiting = null;

io.on("connection", (socket) => {
  if (waiting) {
    waiting.partner = socket;
    socket.partner = waiting;
    waiting = null;
  } else {
    waiting = socket;
  }

  socket.on("message", (msg) => {
    if (socket.partner) {
      socket.partner.emit("message", msg);
    }
  });

  socket.on("disconnect", () => {
    if (socket.partner) {
      socket.partner.partner = null;
    }
    if (waiting === socket) {
      waiting = null;
    }
  });
});

server.listen(3000, () => {
  console.log("Server running on http://localhost:3000");
});
