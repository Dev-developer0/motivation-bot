require("dotenv").config();
const { generateContent } = require("./src/generator");
const { uploadToYouTube } = require("./src/platforms/youtube");

async function test() {
  console.log("🧪 Testing YouTube upload...\n");

  // Step 1: Generate content
  console.log("Step 1: Generating content with Gemini...");
  const content = await generateContent("Discipline over motivation");
  console.log("✅ Content generated:");
  console.log("  Topic:", content.topic);
  console.log("  Title:", content.title);
  console.log("  Script preview:", content.script.substring(0, 80) + "...");
  console.log();

  // Step 2: Upload to YouTube
  console.log("Step 2: Creating video and uploading to YouTube Shorts...");
  const result = await uploadToYouTube(content);
  console.log("✅ YouTube upload success!");
  console.log("  Video URL:", result.videoUrl);
  console.log("  Video ID:", result.videoId);
}

test().catch(console.error);
