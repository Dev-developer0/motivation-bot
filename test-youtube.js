require("dotenv").config();
const { generateContent } = require("./src/generator");
const { uploadToYouTube } = require("./src/platforms/youtube");

async function test() {
  console.log("🧪 Testing YouTube upload...\n");

  console.log("Step 1: Generating content with Gemini...");
  const content = await generateContent();
  console.log("✅ Content generated:");
  console.log("  Topic:", content.topic);
  console.log("  Mood:", content.mood);
  console.log("  Title:", content.title);
  console.log("  Lines:", content.lines);
  console.log();

  console.log("Step 2: Creating video and uploading...");
  const result = await uploadToYouTube(content);
  console.log("✅ Done!");
  console.log("  URL:", result.videoUrl);
}

test().catch(console.error);
