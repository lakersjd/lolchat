const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const bodyParser = require("body-parser");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// DB setup
const db = new sqlite3.Database("./reports.db");

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("."));

// Admin login (basic)
const ADMIN_USER = "admin";
const ADMIN_PASS = "admin123";

// Admin Panel
app.get("/admin", (req, res) => {
  res.sendFile(path.join(__dirname, "admin.html"));
});

app.post("/admin", (req, res) => {
  const { username, password } = req.body;
  if (username === ADMIN_USER && password === ADMIN_PASS) {
    db.all("SELECT reported_id, COUNT(*) as count FROM reports GROUP BY reported_id ORDER BY count DESC", (err, reports) => {
      db.all("SELECT blocker_id, blocked_id, timestamp FROM blocks ORDER BY timestamp DESC", (err2, blocks) => {
        let html = "<h2>Reports</h2><ul>";
        reports.forEach(r => {
          html += `<li>User ${r.reported_id}: ${r.count} reports</li>`;
        });
        html += "</ul><h2>Blocks</h2><ul>";
        blocks.forEach(b => {
          html += `<li>${b.blocker_id} blocked ${b.blocked_id} at ${b.timestamp}</li>`;
        });
        html += "</ul>";
        res.send(html);
      });
    });
  } else {
    res.send("Invalid credentials");
  }
});

// WebSocket logic
let queue = [];

io.on("connection", (socket) => {
  io.emit("onlineCount", io.engine.clientsCount);

  socket.on("joinQueue", (prefs) => {
    socket.prefs = prefs;

    let matchIndex = queue.findIndex(other =>
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

  socket.on("report", () => {
    if (socket.partner) {
    socket.partner.emit("partnerDisconnected");
      db.run("INSERT INTO reports (reporter_id, reported_id) VALUES (?, ?)", [socket.id, socket.partner.id]);
      socket.partner.disconnect();
    }
  });

  socket.on("block", () => {
    if (socket.partner) {
    socket.partner.emit("partnerDisconnected");
      db.run("INSERT INTO blocks (blocker_id, blocked_id) VALUES (?, ?)", [socket.id, socket.partner.id]);
      socket.partner.disconnect();
    }
  });

  socket.on("typing", () => {
    if (socket.partner) socket.partner.emit("strangerTyping");
  });
  socket.on("stopTyping", () => {
    if (socket.partner) socket.partner.emit("strangerStopTyping");
  });

  socket.on("disconnect" , () => {
    queue = queue.filter(s => s !== socket);
    if (socket.partner) socket.partner?.emit("strangerStopTyping");
      socket.partner.partner = null;
  });
});

server.listen(3000, () => {
  console.log("Server running on http://localhost:3000");
});
