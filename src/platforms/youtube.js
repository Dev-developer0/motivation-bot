require("dotenv").config();
const { google } = require("googleapis");
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

function getOAuthClient() {
  const oauth2Client = new google.auth.OAuth2(
    process.env.YOUTUBE_CLIENT_ID,
    process.env.YOUTUBE_CLIENT_SECRET,
    "urn:ietf:wg:oauth:2.0:oob"
  );

  // Set both tokens — OAuth2 client will auto-refresh using refresh_token
  oauth2Client.setCredentials({
    access_token: process.env.YOUTUBE_ACCESS_TOKEN,
    refresh_token: process.env.YOUTUBE_REFRESH_TOKEN,
  });

  // Auto-save new access token when it gets refreshed
  oauth2Client.on("tokens", (tokens) => {
    if (tokens.access_token) {
      console.log("[YouTube] Token auto-refreshed ✅");
      // Update the in-memory env so current session stays valid
      process.env.YOUTUBE_ACCESS_TOKEN = tokens.access_token;
    }
  });

  return oauth2Client;
}

function createVideo(outputPath) {
  console.log("[YouTube] Creating video with ffmpeg...");
  const cmd = `ffmpeg -y -f lavfi -i color=c=black:s=1080x1920:d=30:r=30 -c:v libx264 -pix_fmt yuv420p "${outputPath}"`;
  execSync(cmd, { stdio: "inherit" });
  console.log("[YouTube] Video created:", outputPath);
  return outputPath;
}

async function uploadToYouTube(content) {
  const auth = getOAuthClient();
  const youtube = google.youtube({ version: "v3", auth });

  const videoPath = path.join(__dirname, "../../output_video.mp4");
  createVideo(videoPath);

  console.log("[YouTube] Uploading to YouTube Shorts...");

  const response = await youtube.videos.insert({
    part: ["snippet", "status"],
    requestBody: {
      snippet: {
        title: content.title + " #Shorts",
        description: content.caption,
        tags: content.hashtags,
        categoryId: "26",
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

  if (fs.existsSync(videoPath)) fs.unlinkSync(videoPath);

  const videoId = response.data.id;
  const videoUrl = `https://www.youtube.com/shorts/${videoId}`;

  console.log("[YouTube] ✅ Uploaded:", videoUrl);
  return { videoId, videoUrl };
}

module.exports = { uploadToYouTube };
