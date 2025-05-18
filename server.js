const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const bodyParser = require("body-parser");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// SQLite setup
const db = new sqlite3.Database("./reports.db");
db.run(`CREATE TABLE IF NOT EXISTS reports (id INTEGER PRIMARY KEY, reporter_id TEXT, reported_id TEXT, timestamp DATETIME DEFAULT CURRENT_TIMESTAMP)`);
db.run(`CREATE TABLE IF NOT EXISTS blocks (id INTEGER PRIMARY KEY, blocker_id TEXT, blocked_id TEXT, timestamp DATETIME DEFAULT CURRENT_TIMESTAMP)`);
db.run(`CREATE TABLE IF NOT EXISTS user_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  socket_id TEXT,
  country TEXT,
  language TEXT,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);`);

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("."));

const ADMIN_USER = "admin";
const ADMIN_PASS = "admin123";
app.get("/admin", (req, res) => res.sendFile(path.join(__dirname, "admin.html")));
app.post("/admin", (req, res) => {
  res.send("Admin access not implemented in this fallback version.");
});

let queue = [];

io.on("connection", (socket) => {
  io.emit("onlineCount", io.engine.clientsCount);

  socket.on("joinQueue", (prefs) => {
    const { gender, country, language, tags } = prefs;
    const tagList = tags?.toLowerCase().split(/[, ]+/).filter(Boolean) || [];

    db.run("INSERT INTO user_logs (socket_id, country, language) VALUES (?, ?, ?)", [socket.id, country, language]);

    socket.prefs = { gender, country, language, tagList };

    const matchIndex = queue.findIndex(other => {
      if (!other.prefs) return false;

      const genderMatch = gender === "any" || other.prefs.gender === "any" || gender === other.prefs.gender;
      const langMatch = language === "any" || other.prefs.language === "any" || language === other.prefs.language;
      const countryMatch = country === "any" || other.prefs.country === "any" || country === other.prefs.country;
      const tagMatch = tagList.some(tag => other.prefs.tagList.includes(tag));

      return genderMatch && langMatch && countryMatch && (tagMatch || tagList.length === 0);
    });

    if (matchIndex !== -1) {
      const partner = queue.splice(matchIndex, 1)[0];
      socket.partner = partner;
      partner.partner = socket;
      socket.emit("ready");
      partner.emit("ready");
    } else {
      queue.push(socket);
      setTimeout(() => {
        if (!socket.partner) {
          const fallback = queue.find(s => s !== socket);
          if (fallback) {
            queue = queue.filter(s => s !== socket && s !== fallback);
            socket.partner = fallback;
            fallback.partner = socket;
            socket.emit("ready");
            fallback.emit("ready");
          }
        }
      }, 10000);
    }
  });

  socket.on("message", msg => {
    if (socket.partner) socket.partner.emit("message", msg);
  });

  socket.on("offer", data => {
    if (socket.partner) socket.partner.emit("offer", data);
  });

  socket.on("answer", data => {
    if (socket.partner) socket.partner.emit("answer", data);
  });

  socket.on("ice-candidate", data => {
    if (socket.partner) socket.partner.emit("ice-candidate", data);
  });

  socket.on("typing", () => {
    if (socket.partner) socket.partner.emit("typing");
  });

  socket.on("report", () => {
    if (socket.partner) {
      db.run("INSERT INTO reports (reporter_id, reported_id) VALUES (?, ?)", [socket.id, socket.partner.id]);
      socket.partner.disconnect();
    }
  });

  socket.on("block", () => {
    if (socket.partner) {
      db.run("INSERT INTO blocks (blocker_id, blocked_id) VALUES (?, ?)", [socket.id, socket.partner.id]);
      socket.partner.disconnect();
    }
  });

  socket.on("disconnect", () => {
    queue = queue.filter(s => s !== socket);
    if (socket.partner) socket.partner.partner = null;
    io.emit("onlineCount", io.engine.clientsCount);
  });
});

server.listen(3000, () => console.log("✅ Server running at http://localhost:3000"));
