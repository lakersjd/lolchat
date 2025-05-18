const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const bodyParser = require("body-parser");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const db = new sqlite3.Database("./reports.db");
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
        db.all("SELECT country, language, COUNT(*) as count FROM user_logs GROUP BY country, language ORDER BY count DESC", (err3, logs) => {
        html += "<h2>User Region Logs</h2><ul>";
        logs.forEach(l => {
          html += `<li>${l.country.toUpperCase()} - ${l.language.toUpperCase()}: ${l.count} users</li>`;
        });
        html += "</ul>";
        res.send(html);
      });
      });
    });
  } else {
    res.send("Invalid credentials");
  }
});

let queue = [];

io.on("connection", (socket) => {
  io.emit("onlineCount", io.engine.clientsCount);

  socket.on("joinQueue", (prefs) => {
    db.run("INSERT INTO user_logs (socket_id, country, language) VALUES (?, ?, ?)", [socket.id, prefs.country || 'unknown', prefs.language || 'unknown']);
    prefs.language = prefs.language || "any";
    prefs.country = prefs.country || "any";
    socket.prefs = prefs;

    const tryMatch = (relaxed = false) => {
      const matchIndex = queue.findIndex(other => {
        const langMatch = relaxed || prefs.language === "any" || other.prefs.language === "any" || prefs.language === other.prefs.language;
        const countryMatch = relaxed || prefs.country === "any" || other.prefs.country === "any" || prefs.country === other.prefs.country;
        const interestMatch = relaxed || !prefs.interest || !other.prefs.interest ||
          prefs.interest.toLowerCase() === other.prefs.interest.toLowerCase();
        const genderMatch = relaxed || prefs.gender === "any" || other.prefs.gender === "any" || prefs.gender === other.prefs.gender;
        return langMatch && countryMatch && interestMatch && genderMatch;
      });

      if (matchIndex !== -1) {
        const partner = queue.splice(matchIndex, 1)[0];
        socket.partner = partner;
        partner.partner = socket;
        socket.emit("ready");
        partner.emit("ready");
      } else if (!relaxed) {
        setTimeout(() => tryMatch(true), 10000); // fallback after 10 seconds
        queue.push(socket);
      } else {
        queue.push(socket);
      }
    };

    tryMatch(false);
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

  socket.on("typing", () => {
    if (socket.partner) socket.partner.emit("typing");
  });

  socket.on("disconnect", () => {
    queue = queue.filter(s => s !== socket);
    if (socket.partner) socket.partner.partner = null;
    io.emit("onlineCount", io.engine.clientsCount);
  });
});

server.listen(3000, () => {
  console.log("✅ Server running at http://localhost:3000");
});
