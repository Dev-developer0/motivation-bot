require("dotenv").config();
const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

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
  "the day I almost gave up",
  "what broke people have in common",
  "why busy people get nothing done",
  "the lie you tell yourself every morning",
  "what changed when I stopped watching the news",
  "why your environment is controlling you",
  "the friend who always has excuses",
  "what happened when I deleted social media",
  "why talented people fail",
  "the one thing nobody wants to admit",
];

// Different script styles so every video feels unique
const STYLES = [
  "Tell a personal story in first person. Start with 'I remember when...'",
  "Write as a direct challenge to the viewer. Start with 'You're lying to yourself about...'",
  "Write as a hard truth nobody wants to hear. Start with 'Here's what nobody tells you...'",
  "Write as a contrast between two people. One who did it, one who didn't.",
  "Write as a short observation from real life. Something you noticed recently.",
  "Write as a question that makes people think. Then answer it brutally honestly.",
  "Write as a before and after. How life looked before vs after one change.",
];

let topicIndex = 0;
let styleIndex = 0;

async function generateContent(customTopic) {
  const topic = customTopic || TOPICS[topicIndex % TOPICS.length];
  const style = STYLES[styleIndex % STYLES.length];
  topicIndex++;
  styleIndex++;

  const prompt = `You are writing text for a YouTube Shorts video.

Topic: "${topic}"
Style: ${style}

Write 5 to 7 short punchy lines that will appear as a paragraph on screen.
Each line under 10 words.
Sound like a real person. Use contractions.
No motivational clichés. No generic advice.
Make it feel like something someone would screenshot and share.

Pick mood: "dark" "uplifting" or "intense" — based on the emotional tone.

Return ONLY raw JSON no markdown:
{
  "topic": "${topic}",
  "mood": "dark",
  "lines": ["line 1", "line 2", "line 3", "line 4", "line 5"],
  "title": "YouTube title under 60 chars — make it curious",
  "caption": "2 casual lines about the video. Atomic Habits changed how I think: AFFILIATE_LINK_HERE #shorts #mindset #motivation"
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
