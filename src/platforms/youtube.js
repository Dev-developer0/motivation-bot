require("dotenv").config();
const { google } = require("googleapis");
const fs = require("fs");
const path = require("path");

const ENV_PATH = path.join(__dirname, "../../.env");

function updateEnvToken(newAccessToken) {
  try {
    let envContent = fs.readFileSync(ENV_PATH, "utf8");
    envContent = envContent.includes("YOUTUBE_ACCESS_TOKEN=")
      ? envContent.replace(/YOUTUBE_ACCESS_TOKEN=.*/, `YOUTUBE_ACCESS_TOKEN=${newAccessToken}`)
      : envContent + `\nYOUTUBE_ACCESS_TOKEN=${newAccessToken}`;
    fs.writeFileSync(ENV_PATH, envContent, "utf8");
    process.env.YOUTUBE_ACCESS_TOKEN = newAccessToken;
    console.log("[YouTube] ✅ Token saved to .env");
  } catch (err) {
    console.error("[YouTube] Could not save token:", err.message);
  }
}

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
  oauth2Client.on("tokens", (tokens) => {
    if (tokens.access_token) updateEnvToken(tokens.access_token);
  });
  return oauth2Client;
}

async function getFreshAuth() {
  const auth = getOAuthClient();
  try {
    const { credentials } = await auth.refreshAccessToken();
    auth.setCredentials(credentials);
    updateEnvToken(credentials.access_token);
    console.log("[YouTube] Token refreshed ✅");
  } catch (err) {
    console.error("[YouTube] Token refresh failed:", err.message);
  }
  return auth;
}

async function uploadToYouTube(content) {
  const auth = await getFreshAuth();
  const youtube = google.youtube({ version: "v3", auth });

  // Use pre-made base video stored in repo
  const videoPath = path.join(__dirname, "../../base_video.mp4");

  if (!fs.existsSync(videoPath)) {
    throw new Error("base_video.mp4 not found. Please add it to the project root.");
  }

  console.log("[YouTube] Uploading base video with AI-generated title + description...");

  // Full text goes into description — visible on YouTube
  const fullText = content.lines.join("\n\n");

  const response = await youtube.videos.insert({
    part: ["snippet", "status"],
    requestBody: {
      snippet: {
        title: content.title + " #Shorts",
        description: fullText + "\n\n" + content.caption,
        tags: ["motivation", "mindset", "shorts", "selfimprovement"],
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

  const videoId = response.data.id;
  const videoUrl = `https://www.youtube.com/shorts/${videoId}`;
  console.log("[YouTube] ✅ Uploaded:", videoUrl);
  return { videoId, videoUrl };
}

module.exports = { uploadToYouTube };
