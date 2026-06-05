require("dotenv").config();
const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

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

let topicIndex = 0;

async function generateContent(customTopic) {
  const topic = customTopic || TOPICS[topicIndex % TOPICS.length];
  topicIndex++;

  const prompt = `You are a viral short-form motivation content creator.

Topic: "${topic}"

Return ONLY a JSON object like this (no markdown, no code blocks, just raw JSON):
{
  "topic": "${topic}",
  "script": "A 30-45 second spoken voiceover script. Powerful, punchy, no filler words.",
  "title": "YouTube Shorts title under 60 chars",
  "caption": "Instagram/TikTok caption with 1 affiliate line: Check out Atomic Habits: AFFILIATE_LINK_HERE — then 5 hashtags",
  "hashtags": ["motivation", "mindset", "discipline", "selfimprovement", "success"]
}`;

  const result = await model.generateContent(prompt);
  const raw = result.response.text();

  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("Failed to parse content JSON from Gemini");

  const content = JSON.parse(match[0]);

  // Inject affiliate link
  const affiliateLink = process.env.AFFILIATE_BOOK_LINK || "https://amzn.to/example";
  content.caption = content.caption.replace("AFFILIATE_LINK_HERE", affiliateLink);

  return content;
}

module.exports = { generateContent, TOPICS };
