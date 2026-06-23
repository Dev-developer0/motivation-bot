require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });

const TOPICS = [
  "why you quit things (it's not you)",
  "why you keep quitting everything",
  "why you always feel like you're behind",
  "why you procrastinate even when you care",
  "why you compare yourself to people who don't matter",
  "why you feel guilty when you rest",
  "why you start strong then disappear",
  "why discipline feels impossible for you specifically",
  "why you know what to do but don't do it",
  "why you sabotage yourself right before success",
  "why your motivation disappears after day 3",
  "why you can't stick to a routine",
  "why being busy isn't the same as being productive",
  "why you avoid the things that actually matter",
  "why small wins matter more than big goals",
  "why you're not lazy, you're just stuck",
  "why willpower runs out by 3pm",
  "why you keep starting over",
  "why you feel behind everyone your age",
  "why nothing feels like enough lately",
  "why you overthink simple decisions",
  "why you say yes when you mean no",
  "why you work hard but stay in the same place",
  "why comfort is the real enemy",
  "why you need permission to rest",
];

// ─── Shuffle array randomly ───────────────────────────────────
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ─── Persist shuffled queue so it survives restarts ──────────
const QUEUE_FILE = path.join(__dirname, "../topic_queue.json");

function loadQueue() {
  try {
    const data = JSON.parse(fs.readFileSync(QUEUE_FILE, "utf8"));
    if (data.queue && data.queue.length > 0) return data.queue;
  } catch {}
  return shuffle(TOPICS);
}

function saveQueue(queue) {
  fs.writeFileSync(QUEUE_FILE, JSON.stringify({ queue }));
}

let topicQueue = loadQueue();

async function generateContent(customTopic) {
  let topic;

  if (customTopic) {
    topic = customTopic;
  } else {
    // Pop next topic from queue
    topic = topicQueue.shift();

    // If queue is empty, reshuffle all topics again
    if (topicQueue.length === 0) {
      topicQueue = shuffle(TOPICS);
      console.log("[Generator] All topics used — reshuffled queue");
    }

    saveQueue(topicQueue);
  }

  const prompt = `You are writing text for a YouTube Shorts video that explains a psychological pattern to someone.

Topic: "${topic}"

This style performs best — videos that explain "why you..." do something, making people feel understood, not judged.

STRUCTURE:
Line 1 = HOOK. Restate the topic as a relatable truth. Make them feel "this is about me."
Line 2-4 = EXPLANATION. Explain the real psychological reason behind it. Be specific and insightful.
Line 5 = RELIEF. Make it clear it's not their fault — it's a pattern, a system, brain wiring, etc.
Line 6 = TAKEAWAY. One small actionable shift, not generic advice.

Rules:
- Each line under 12 words
- Sound like a smart friend who finally explains why you do this thing
- Use contractions
- Be specific — reference real psychology concepts simply (dopamine, comfort zones, fear of failure) without sounding clinical
- No clichés like "unlock your potential" or "level up"
- Make the person feel SEEN, not lectured

Pick mood: "dark" "uplifting" or "intense"

Return ONLY raw JSON no markdown:
{
  "topic": "${topic}",
  "mood": "dark",
  "lines": ["hook line", "explanation 1", "explanation 2", "explanation 3", "relief line", "takeaway line"],
  "title": "YouTube title under 60 chars — use Why You... format",
  "caption": "2 casual lines about the video. Atomic Habits changed how I think: AFFILIATE_LINK_HERE #shorts #psychology #mindset"
}`;

  const result = await model.generateContent(prompt);
  const raw = result.response.text();
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("Failed to parse JSON from Gemini");

  const content = JSON.parse(match[0]);
  const affiliateLink = process.env.AFFILIATE_BOOK_LINK || "https://amzn.to/example";
  content.caption = content.caption.replace("AFFILIATE_LINK_HERE", affiliateLink);

  return content;
}

module.exports = { generateContent, TOPICS };
