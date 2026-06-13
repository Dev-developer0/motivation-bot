require("dotenv").config();
const { google } = require("googleapis");
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const ENV_PATH = path.join(__dirname, "../../.env");
const FONT_PATH = path.join(__dirname, "../../fonts/Roboto-Bold.ttf");
const MUSIC_DIR = path.join(__dirname, "../../music");

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

function wrapText(text, maxChars) {
  const words = text.split(" ");
  const lines = [];
  let current = "";
  for (const word of words) {
    if ((current + " " + word).trim().length <= maxChars) {
      current = (current + " " + word).trim();
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function createVideo(content, outputPath) {
  const mood = content.mood || "dark";
  const musicPath = path.join(MUSIC_DIR, `${mood}.mp3`).replace(/\\/g, "/");
  const hasMusicFile = fs.existsSync(musicPath);
  const fontForFFmpeg = FONT_PATH.replace(/\\/g, "/").replace("C:/", "C\\:/");

  const fullText = content.lines.join(" ");
  const wrappedLines = wrapText(fullText, 28);

  const fontSize = 52;
  const lineHeight = 65;
  const totalTextHeight = wrappedLines.length * lineHeight;
  const duration = 30;

  const filters = wrappedLines.map((line, i) => {
    const safe = line
      .replace(/'/g, "")
      .replace(/"/g, "")
      .replace(/[^\x20-\x7E]/g, "")
      .replace(/:/g, " ")
      .trim();
    const yPos = `(h-${totalTextHeight})/2+${i * lineHeight}`;
    return `drawtext=fontfile='${fontForFFmpeg}':text='${safe}':fontcolor=white:fontsize=${fontSize}:x=(w-text_w)/2:y=${yPos}`;
  }).join(",");

  let cmd;
  if (hasMusicFile) {
    console.log(`[YouTube] Using ${mood} music`);
    cmd = [
      "ffmpeg -y",
      `-f lavfi -i "color=c=black:s=1080x1920:d=${duration}:r=30"`,
      `-stream_loop -1 -i "${musicPath}"`,
      `-filter_complex "[0:v]${filters}[v];[1:a]volume=0.15,atrim=0:${duration}[a]"`,
      "-map [v] -map [a]",
      `-t ${duration}`,
      "-c:v libx264 -pix_fmt yuv420p -c:a aac",
      `"${outputPath}"`,
    ].join(" ");
  } else {
    console.log(`[YouTube] No music for mood: ${mood}`);
    cmd = [
      "ffmpeg -y",
      `-f lavfi -i "color=c=black:s=1080x1920:d=${duration}:r=30"`,
      `-vf "${filters}"`,
      "-c:v libx264 -pix_fmt yuv420p",
      `"${outputPath}"`,
    ].join(" ");
  }

  execSync(cmd, { stdio: "pipe" });
  console.log(`[YouTube] ✅ Video ready — ${duration}s mood: ${mood}`);
}

async function uploadToYouTube(content) {
  const auth = await getFreshAuth();
  const youtube = google.youtube({ version: "v3", auth });

  const videoPath = path.join(__dirname, "../../output_video.mp4");
  createVideo(content, videoPath);

  console.log("[YouTube] Uploading...");

  const response = await youtube.videos.insert({
    part: ["snippet", "status"],
    requestBody: {
      snippet: {
        title: content.title + " #Shorts",
        description: content.caption,
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

  if (fs.existsSync(videoPath)) fs.unlinkSync(videoPath);

  const videoId = response.data.id;
  const videoUrl = `https://www.youtube.com/shorts/${videoId}`;
  console.log("[YouTube] ✅ Uploaded:", videoUrl);
  return { videoId, videoUrl };
}

module.exports = { uploadToYouTube };
