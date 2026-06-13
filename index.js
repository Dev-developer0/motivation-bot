require("dotenv").config();
const express = require("express");
const cron = require("node-cron");
const fs = require("fs");
const path = require("path");

const { generateContent } = require("./src/generator");
const { uploadToYouTube } = require("./src/platforms/youtube");

const app = express();
app.use(express.json());

app.use(express.static(__dirname));
app.get("/dashboard", (req, res) => {
  res.sendFile(path.join(__dirname, "dashboard.html"));
});

const LOG_FILE = path.join(__dirname, "posts.json");

function loadLog() {
  try { return JSON.parse(fs.readFileSync(LOG_FILE, "utf8")); } catch { return []; }
}

function saveLog(data) {
  fs.writeFileSync(LOG_FILE, JSON.stringify(data, null, 2));
}

function log(msg) {
  console.log(`[${new Date().toISOString()}] ${msg}`);
}

// ─── Main run function with auto retry ──────────────────────
async function run(customTopic) {
  log("Starting content run...");
  try {
    // Retry up to 3 times if Gemini is overloaded
    let content;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        content = await generateContent(customTopic);
        break;
      } catch (err) {
        if (attempt === 3) throw err;
        log(`Gemini failed (attempt ${attempt}), retrying in 30s...`);
        await new Promise(r => setTimeout(r, 30000));
      }
    }

    log(`Content generated: "${content.topic}" — mood: ${content.mood}`);

    const youtube = await uploadToYouTube(content);
    log(`YouTube uploaded: ${youtube.videoUrl}`);

    const posts = loadLog();
    posts.unshift({
      topic: content.topic,
      mood: content.mood,
      title: content.title,
      youtubeUrl: youtube.videoUrl,
      postedAt: new Date().toISOString(),
      status: "success",
    });
    saveLog(posts.slice(0, 100));

    log(`✅ SUCCESS: "${content.topic}"`);
    return { success: true, topic: content.topic, youtube };
  } catch (err) {
    log(`❌ ERROR: ${err.message}`);
    const posts = loadLog();
    posts.unshift({
      error: err.message,
      postedAt: new Date().toISOString(),
      status: "failed",
    });
    saveLog(posts.slice(0, 100));
    return { success: false, error: err.message };
  }
}

// ─── Cron Schedule (IST = UTC+5:30) ─────────────────────────
// 9:00 AM IST  = 3:30 AM UTC
// 3:00 PM IST  = 9:30 AM UTC
// 8:00 PM IST  = 2:30 PM UTC
cron.schedule("30 3 * * *", () => run(), { timezone: "UTC" });
cron.schedule("30 9 * * *", () => run(), { timezone: "UTC" });
cron.schedule("30 14 * * *", () => run(), { timezone: "UTC" });

log("🤖 Motivation Bot started. Scheduled: 9am, 3pm, 8pm IST daily.");

// ─── Routes ─────────────────────────────────────────────────
app.get("/", (req, res) => {
  res.json({
    status: "running",
    message: "Motivation Bot is live 🚀",
    platforms: ["YouTube Shorts"],
    schedule: "9am, 3pm, 8pm IST daily",
  });
});

app.get("/posts", (req, res) => {
  res.json(loadLog());
});

app.post("/preview", async (req, res) => {
  try {
    const { topic } = req.body;
    const content = await generateContent(topic);
    res.json({ success: true, content });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

app.post("/post-now", async (req, res) => {
  const { topic } = req.body;
  log("Manual post triggered via /post-now");
  // Return immediately, run in background
  res.json({ success: true, message: "Posting in background... check /posts in 2 minutes" });
  run(topic);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => log(`Server running on port ${PORT}`));
