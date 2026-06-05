require("dotenv").config();
const { google } = require("googleapis");
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const https = require("https");

const ENV_PATH = path.join(__dirname, "../../.env");

// ─── Save refreshed token to .env ───────────────────────────
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

// ─── OAuth client ────────────────────────────────────────────
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

// ─── ElevenLabs TTS voiceover ────────────────────────────────
async function generateVoiceover(script, audioPath) {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    console.log("[YouTube] No ElevenLabs key — skipping audio");
    return null;
  }

  console.log("[YouTube] Generating voiceover with ElevenLabs...");

  const voiceId = "pNInz6obpgDQGcFmaJgB"; // Adam — deep motivational voice

  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      text: script,
      model_id: "eleven_monolingual_v1",
      voice_settings: { stability: 0.5, similarity_boost: 0.75 },
    });

    const options = {
      hostname: "api.elevenlabs.io",
      path: `/v1/text-to-speech/${voiceId}`,
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
    };

    const req = https.request(options, (res) => {
      if (res.statusCode !== 200) {
        console.log("[YouTube] ElevenLabs error:", res.statusCode);
        resolve(null);
        return;
      }
      const file = fs.createWriteStream(audioPath);
      res.pipe(file);
      file.on("finish", () => {
        file.close();
        console.log("[YouTube] ✅ Voiceover generated");
        resolve(audioPath);
      });
    });

    req.on("error", (err) => {
      console.log("[YouTube] ElevenLabs request failed:", err.message);
      resolve(null);
    });

    req.write(body);
    req.end();
  });
}

// ─── Word wrap helper ────────────────────────────────────────
function wrapText(text, maxCharsPerLine) {
  const words = text.split(" ");
  const lines = [];
  let current = "";

  for (const word of words) {
    if ((current + " " + word).trim().length <= maxCharsPerLine) {
      current = (current + " " + word).trim();
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines.slice(0, 6); // max 6 lines on screen
}

// ─── Create video ────────────────────────────────────────────
async function createVideo(script, outputPath) {
  console.log("[YouTube] Creating video...");

  const base = path.join(__dirname, "../../").replace(/\\/g, "/");
  const audioPath = base + "voiceover.mp3";
  const silentVideoPath = base + "silent_video.mp4";
  const outputForFFmpeg = outputPath.replace(/\\/g, "/");

  // Clean script for display
  const displayScript = script
    .substring(0, 300)
    .replace(/[^a-zA-Z0-9 .,!?'\-]/g, "");

  // Wrap into lines
  const lines = wrapText(displayScript, 28);

  // Build drawtext filters — one per line, centered vertically as a block
  const lineHeight = 80;
  const totalHeight = lines.length * lineHeight;
  const startY = `(h-${totalHeight})/2`;

  const drawtextFilters = lines.map((line, i) => {
    const safeText = line.replace(/'/g, "").replace(/:/g, " ");
    const y = i === 0 ? startY : `${startY}+${i * lineHeight}`;
    return `drawtext=text='${safeText}':fontcolor=white:fontsize=52:x=(w-text_w)/2:y=${y}:box=1:boxcolor=black@0.4:boxborderw=10`;
  }).join(",");

  // Step 1: Generate voiceover
  const hasAudio = await generateVoiceover(script, audioPath.replace(/\//g, path.sep));

  // Step 2: Get audio duration or default to 30s
  let duration = 30;
  if (hasAudio) {
    try {
      const probe = execSync(
        `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${audioPath.replace(/\//g, path.sep)}"`,
        { encoding: "utf8" }
      );
      duration = Math.ceil(parseFloat(probe.trim())) + 1;
    } catch { duration = 30; }
  }

  // Step 3: Create silent video with gradient background + text
  const gradientAndText = [
    // Dark gradient background (deep purple to black — motivational feel)
    `gradients=s=1080x1920:c0=0x1a0533:c1=0x000000:x0=0:y0=0:x1=1080:y1=1920`,
    drawtextFilters,
  ].join(",");

  const silentCmd = [
    "ffmpeg -y",
    `-f lavfi -i "color=c=black:s=1080x1920:d=${duration}:r=30"`,
    `-vf "${drawtextFilters}"`,
    "-c:v libx264 -pix_fmt yuv420p",
    `"${silentVideoPath}"`,
  ].join(" ");

  execSync(silentCmd, { stdio: "inherit" });

  // Step 4: Combine video + audio (or keep silent if no audio)
  if (hasAudio && fs.existsSync(audioPath.replace(/\//g, path.sep))) {
    const combineCmd = [
      "ffmpeg -y",
      `"-i" "${silentVideoPath}"`,
      `"-i" "${audioPath}"`,
      "-c:v copy -c:a aac -shortest",
      `"${outputForFFmpeg}"`,
    ].join(" ");
    execSync(combineCmd, { stdio: "inherit" });
    fs.unlinkSync(audioPath.replace(/\//g, path.sep));
  } else {
    fs.renameSync(silentVideoPath.replace(/\//g, path.sep), outputPath);
  }

  if (fs.existsSync(silentVideoPath.replace(/\//g, path.sep))) {
    fs.unlinkSync(silentVideoPath.replace(/\//g, path.sep));
  }

  console.log("[YouTube] ✅ Video ready:", outputPath);
  return outputPath;
}

// ─── Upload to YouTube Shorts ────────────────────────────────
async function uploadToYouTube(content) {
  const auth = await getFreshAuth();
  const youtube = google.youtube({ version: "v3", auth });

  const videoPath = path.join(__dirname, "../../output_video.mp4");
  await createVideo(content.script, videoPath);

  console.log("[YouTube] Uploading...");

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
