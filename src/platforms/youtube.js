require("dotenv").config();
const { google } = require("googleapis");
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

// ─── OAuth2 Client ───────────────────────────────────────────
function getOAuthClient() {
  const oauth2Client = new google.auth.OAuth2(
    process.env.YOUTUBE_CLIENT_ID,
    process.env.YOUTUBE_CLIENT_SECRET,
    "urn:ietf:wg:oauth:2.0:oob"
  );

  oauth2Client.setCredentials({
    access_token: process.env.YOUTUBE_ACCESS_TOKEN,
    refresh_token: process.env.YOUTUBE_REFRESH_TOKEN,
  });

  return oauth2Client;
}

// ─── Create a simple text video using ffmpeg ─────────────────
function createVideo(script, outputPath) {
  console.log("[YouTube] Creating video with ffmpeg...");

  // Create temp text file for ffmpeg drawtext
  const textFile = path.join(__dirname, "../../temp_script.txt");

  // Shorten script to fit on screen (first 100 chars as preview)
  const displayText = script.substring(0, 120).replace(/['"]/g, "");
  fs.writeFileSync(textFile, displayText);

  // Build a 30-second black background video with white text (vertical 9:16)
  const cmd = [
    "ffmpeg -y",
    "-f lavfi -i color=black:s=1080x1920:d=30:r=30",
    `-vf "drawtext=textfile='${textFile}':fontcolor=white:fontsize=48:x=(w-text_w)/2:y=(h-text_h)/2:line_spacing=20:fix_bounds=true"`,
    "-c:v libx264 -pix_fmt yuv420p",
    outputPath,
  ].join(" ");

  execSync(cmd, { stdio: "inherit" });

  // Cleanup
  if (fs.existsSync(textFile)) fs.unlinkSync(textFile);

  console.log("[YouTube] Video created:", outputPath);
  return outputPath;
}

// ─── Upload to YouTube Shorts ────────────────────────────────
async function uploadToYouTube(content) {
  const auth = getOAuthClient();
  const youtube = google.youtube({ version: "v3", auth });

  const videoPath = path.join(__dirname, "../../output_video.mp4");

  // Create video
  createVideo(content.script, videoPath);

  console.log("[YouTube] Uploading to YouTube Shorts...");

  const response = await youtube.videos.insert({
    part: ["snippet", "status"],
    requestBody: {
      snippet: {
        title: content.title + " #Shorts",
        description: content.caption,
        tags: content.hashtags,
        categoryId: "26", // Howto & Style
      },
      status: {
        privacyStatus: "public",
        selfDeclaredMadeForKids: false,
      },
    },
    media: {
      body: fs.createReadStream(videoPath),
    },
  });

  // Cleanup video file
  if (fs.existsSync(videoPath)) fs.unlinkSync(videoPath);

  const videoId = response.data.id;
  const videoUrl = `https://www.youtube.com/shorts/${videoId}`;

  console.log("[YouTube] ✅ Uploaded:", videoUrl);
  return { videoId, videoUrl };
}

module.exports = { uploadToYouTube };
