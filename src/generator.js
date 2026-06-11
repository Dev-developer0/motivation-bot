require("dotenv").config();
const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

const TOPICS = [
  "why you keep quitting things",
  "the night before everything changed",
  "what nobody tells you about starting over",
  "the guy who showed up every day",
  "why your friend got ahead and you didn't",
  "the habit that cost me two years",
  "what I learned from failing publicly",
  "the moment I stopped caring what people think",
  "why doing less actually works",
  "the conversation that changed how I work",
  "what happened when I woke up at 5am for 30 days",
  "why smart people stay stuck",
  "the small thing that compounds into everything",
  "what winners do the night before",
  "why most advice doesn't work for you",
];

let topicIndex = 0;

async function generateContent(customTopic) {
  const topic = customTopic || TOPICS[topicIndex % TOPICS.length];
  topicIndex++;

  const prompt = `You are writing text for a YouTube Shorts video about: "${topic}"

Write 6 to 8 short punchy lines that will appear one by one on screen.
Each line must be under 8 words.
Sound like a real person, not a motivational poster.
Use contractions. Be direct. No clichés.

Also pick a mood from: "dark", "uplifting", "intense"
Pick based on the emotional tone of the script.

Return ONLY raw JSON, no markdown:
{
  "topic": "${topic}",
  "mood": "dark" or "uplifting" or "intense",
  "lines": ["line 1", "line 2", "line 3", "line 4", "line 5", "line 6"],
  "title": "YouTube title under 60 chars",
  "caption": "2 casual lines. Then: Atomic Habits changed how I think: AFFILIATE_LINK_HERE #shorts #mindset #motivation"
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
