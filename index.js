require("dotenv").config();
console.log("Gemini key exists:", !!process.env.GEMINI_API_KEY);
console.log("Gemini key starts with:", process.env.GEMINI_API_KEY?.substring(0, 10));
const express = require("express");
const cron = require("node-cron");
const { TwitterApi } = require("twitter-api-v2");
const fs = require("fs");
const path = require("path");

const app = express();
app.use(express.json());

// ─── Clients ───────────────────────────────────────────────
const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(
  process.env.GEMINI_API_KEY
);

const model = genAI.getGenerativeModel({
  model: "gemini-2.5-flash"
});

const twitter = new TwitterApi({
  appKey: process.env.TWITTER_API_KEY,
  appSecret: process.env.TWITTER_API_SECRET,
  accessToken: process.env.TWITTER_ACCESS_TOKEN,
  accessSecret: process.env.TWITTER_ACCESS_TOKEN_SECRET,
});

// ─── Topics (rotates automatically) ────────────────────────
const TOPICS = [
  "Discipline over motivation",
  "Morning routines that win",
  "Stop being comfortable",
  "The 1% mindset shift",
  "Why most people stay broke",
  "Building mental toughness",
  "Consistency beats talent",
  "Silence is a superpower",
  "Stop seeking validation",
  "Your habits define your future",
  "Embrace discomfort to grow",
  "Delayed gratification wins",
  "The power of saying no",
  "Why average people stay average",
  "What winners do differently",
];

const LOG_FILE = path.join(__dirname, "posts.json");

function loadLog() {
  try { return JSON.parse(fs.readFileSync(LOG_FILE, "utf8")); } catch { return []; }
}

function saveLog(data) {
  fs.writeFileSync(LOG_FILE, JSON.stringify(data, null, 2));
}

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
}

// ─── Generate thread with Gemini ───────────────────────────
async function generateThread(
  topic,
  tone = "Intense & powerful",
  length = 5,
  lang = "English"
) {
  log(`Generating thread: "${topic}" | ${tone} | ${lang}`);

  const prompt = `You are a world-class viral Twitter/X motivation content creator.

Write a ${length}-tweet thread about: "${topic}"

Tone: ${tone}
Language: ${lang}

Return ONLY a JSON array of strings.

Example:
["tweet 1","tweet 2","tweet 3"]

Rules:
- Tweet 1: shocking hook
- Middle tweets: one powerful insight each
- Last tweet: CTA + max 3 hashtags
- No markdown
- No code blocks
- No explanations
- Only return JSON array`;

  const result = await model.generateContent(prompt);

  const raw = result.response.text();

  const match = raw.match(/\[[\s\S]*\]/);

  if (!match) {
    throw new Error("Failed to parse thread JSON from Gemini");
  }

  return JSON.parse(match[0]);
}
// ─── Post thread to Twitter ─────────────────────────────────
async function postThread(tweets) {
  log(`Posting ${tweets.length}-tweet thread...`);
  const first = await twitter.v2.tweet(tweets[0]);
  let lastId = first.data.id;

  for (let i = 1; i < tweets.length; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    const reply = await twitter.v2.tweet(tweets[i], {
      reply: { in_reply_to_tweet_id: lastId },
    });
    lastId = reply.data.id;
  }

  log(`Thread posted! First tweet ID: ${first.data.id}`);
  return first.data.id;
}

// ─── Full run: generate + post ──────────────────────────────
let topicIndex = 0;

async function run(customTopic, tone, length, lang) {
  const topic = customTopic || TOPICS[topicIndex % TOPICS.length];
  topicIndex++;

  try {
    const tweets = await generateThread(topic, tone, length, lang);
    const tweetId = await postThread(tweets);

    const posts = loadLog();
    posts.unshift({
      topic,
      tweets,
      tweetId,
      postedAt: new Date().toISOString(),
      status: "success",
    });
    saveLog(posts.slice(0, 100));

    log(`SUCCESS: Posted "${topic}"`);
    return { success: true, topic, tweetId, tweets };
  } catch (err) {
    log(`ERROR: ${err.message}`);

    const posts = loadLog();
    posts.unshift({
      topic,
      error: err.message,
      postedAt: new Date().toISOString(),
      status: "failed",
    });
    saveLog(posts.slice(0, 100));

    return { success: false, error: err.message };
  }
}

// ─── Cron Schedule (IST = UTC+5:30) ────────────────────────
// 9:00 AM IST  = 3:30 AM UTC
// 3:00 PM IST  = 9:30 AM UTC
// 8:00 PM IST  = 2:30 PM UTC
cron.schedule("30 3 * * *", () => run(), { timezone: "UTC" });
cron.schedule("30 9 * * *", () => run(), { timezone: "UTC" });
cron.schedule("30 14 * * *", () => run(), { timezone: "UTC" });

log("Bot started. Scheduled: 9am, 3pm, 8pm IST daily.");

// ─── API Routes ─────────────────────────────────────────────

// Health check
app.get("/", (req, res) => {
  res.json({
    status: "running",
    message: "Mindset Twitter Bot is live",
    nextTopicIndex: topicIndex,
    totalTopics: TOPICS.length,
  });
});

// View all posts
app.get("/posts", (req, res) => {
  res.json(loadLog());
});

// Manually trigger a post (from your phone/browser)
app.post("/post-now", async (req, res) => {
  const { topic, tone, length, lang } = req.body;
  log(`Manual post triggered via API`);
  const result = await run(topic, tone, length, lang);
  res.json(result);
});

// Preview generated content without posting
app.post("/preview", async (req, res) => {
  try {
    const { topic, tone = "Intense & powerful", length = 5, lang = "English" } = req.body;
    const tweets = await generateThread(topic || TOPICS[0], tone, length, lang);
    res.json({ success: true, tweets });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => log(`Server running on port ${PORT}`));
