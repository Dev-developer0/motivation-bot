require("dotenv").config();
const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });

const TOPICS = [
  "a psychology trick that makes you more disciplined",
  "why your brain resists new habits",
  "the 2-minute rule that fixes procrastination",
  "what happens to your brain when you wake up early",
  "a Japanese technique for building habits",
  "why willpower doesn't work (and what does)",
  "the real reason you procrastinate",
  "how Navy SEALs build mental toughness",
  "a study that proves consistency beats motivation",
  "why successful people wake up at the same time every day",
  "the science of why habits stick",
  "a simple trick to stop overthinking",
  "what billionaires do differently every morning",
  "why multitasking is destroying your focus",
  "the 5 second rule for beating laziness",
  "how to trick your brain into wanting to work out",
  "why comparing yourself to others is rewiring your brain wrong",
  "the real cost of scrolling social media for 2 hours",
  "a mindset shift that changed how I see failure",
  "why doing hard things first changes your whole day",
];

let topicIndex = 0;

async function generateContent(customTopic) {
  const topic = customTopic || TOPICS[topicIndex % TOPICS.length];
  topicIndex++;

  const prompt = `You are writing text for a YouTube Shorts video that teaches something useful.

Topic: "${topic}"

STRUCTURE (this is critical):
Line 1 = HOOK. Must make someone stop scrolling. Use curiosity, a number, or a bold claim. Examples of hook styles: "Most people don't know this about...", "This one habit changed everything", "Here's why you keep failing at..."
Line 2-5 = VALUE. Explain the actual insight/trick/fact. Be specific. Give real information, not vague motivation.
Line 6 = TAKEAWAY. One sentence that sums up what to do with this info.

Rules:
- Each line under 12 words
- Sound like a smart friend explaining something cool they learned
- Use contractions
- Be specific — name actual studies, techniques, numbers if relevant
- No clichés like "unlock your potential" or "level up"
- This should feel like the person LEARNED something, not just got motivated

Pick mood: "dark" "uplifting" or "intense"

Return ONLY raw JSON no markdown:
{
  "topic": "${topic}",
  "mood": "dark",
  "lines": ["hook line", "value line 1", "value line 2", "value line 3", "value line 4", "takeaway line"],
  "title": "YouTube title under 60 chars — curiosity driven, like a hook",
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
