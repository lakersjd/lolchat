const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("."));

let queue = [];
let reports = {};
let blocks = {};

io.on("connection", (socket) => {
  socket.on("joinQueue", (prefs) => {
    socket.prefs = prefs;

    // Try to find a match
    let matchIndex = queue.findIndex(other =>
      !isBlocked(socket, other) &&
      (prefs.gender === "any" || prefs.gender === other.prefs.gender || other.prefs.gender === "any") &&
      (prefs.interest === "" || prefs.interest.toLowerCase() === other.prefs.interest.toLowerCase())
    );

    if (matchIndex !== -1) {
      let partner = queue.splice(matchIndex, 1)[0];
      socket.partner = partner;
      partner.partner = socket;
      socket.emit("ready");
      partner.emit("ready");
    } else {
      queue.push(socket);
    }
  });

  socket.on("message", (msg) => {
    if (socket.partner) socket.partner.emit("message", msg);
  });

  socket.on("offer", (offer) => {
    if (socket.partner) socket.partner.emit("offer", offer);
  });

  socket.on("answer", (answer) => {
    if (socket.partner) socket.partner.emit("answer", answer);
  });

  socket.on("ice-candidate", (candidate) => {
    if (socket.partner) socket.partner.emit("ice-candidate", candidate);
  });

  socket.on("disconnect", () => {
    queue = queue.filter(s => s !== socket);
    if (socket.partner) {
      socket.partner.partner = null;
    }
  });

  socket.on("report", () => {
    if (socket.partner) {
      const id = socket.partner.id;
      reports[id] = (reports[id] || 0) + 1;
      socket.partner.disconnect();
    }
  });

  socket.on("block", () => {
    if (socket.partner) {
      const blocker = socket.id;
      const blocked = socket.partner.id;
      if (!blocks[blocker]) blocks[blocker] = new Set();
      blocks[blocker].add(blocked);
      socket.partner.disconnect();
    }
  });
});

function isBlocked(a, b) {
  return (blocks[a.id] && blocks[a.id].has(b.id)) || (blocks[b.id] && blocks[b.id].has(a.id));
}

server.listen(3000, () => {
  console.log("Server running on http://localhost:3000");
});
