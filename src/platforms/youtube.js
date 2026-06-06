require("dotenv").config();
const { google } = require("googleapis");
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const ENV_PATH = path.join(__dirname, "../../.env");
const FONT_PATH = path.join(__dirname, "../../fonts/Roboto-Bold.ttf");

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

// ─── Windows PowerShell TTS — no internet, no API, works forever ───
async function generateVoiceover(script, audioPath) {
  console.log("[YouTube] Generating voiceover...");
  try {
    const wavPath = audioPath.replace(".mp3", ".wav");

    // Clean script for PowerShell
    const cleanScript = script
      .replace(/'/g, " ")
      .replace(/"/g, " ")
      .replace(/[^\x20-\x7E]/g, "")
      .substring(0, 500);

    // Step 1: Generate WAV using Windows built-in TTS
    const psCmd = `powershell -Command "Add-Type -AssemblyName System.Speech; $s = New-Object System.Speech.Synthesis.SpeechSynthesizer; $s.Rate = 1; $s.Volume = 100; $s.SetOutputToWaveFile('${wavPath.replace(/\\/g, "/")}'); $s.Speak('${cleanScript}'); $s.Dispose()"`;
    execSync(psCmd, { stdio: "pipe" });

    // Step 2: Convert WAV to MP3
    execSync(`ffmpeg -y -i "${wavPath}" "${audioPath}"`, { stdio: "pipe" });

    // Cleanup WAV
    if (fs.existsSync(wavPath)) fs.unlinkSync(wavPath);

    console.log("[YouTube] ✅ Voiceover ready");
    return audioPath;
  } catch (err) {
    console.log("[YouTube] TTS failed:", err.message);
    return null;
  }
}

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
  return lines.slice(0, 7);
}

async function createVideo(script, outputPath) {
  console.log("[YouTube] Creating video...");

  const base = path.join(__dirname, "../../");
  const audioPath = path.join(base, "voiceover.mp3");
  const silentVideoPath = path.join(base, "silent_video.mp4");
  const fontForFFmpeg = FONT_PATH.replace(/\\/g, "/").replace("C:/", "C\\:/");

  const cleanScript = script
    .substring(0, 350)
    .replace(/[^a-zA-Z0-9 .,!?'\-]/g, "");
  const lines = wrapText(cleanScript, 25);

  const lineHeight = 75;
  const totalHeight = lines.length * lineHeight;

  const drawtextFilters = lines.map((line, i) => {
    const safe = line.replace(/'/g, "").replace(/:/g, " ");
    const yOffset = i * lineHeight;
    return `drawtext=fontfile='${fontForFFmpeg}':text='${safe}':fontcolor=white:fontsize=56:x=(w-text_w)/2:y=((h-${totalHeight})/2)+${yOffset}:box=1:boxcolor=black@0.5:boxborderw=12`;
  }).join(",");

  // Step 1: Generate voiceover
  const hasAudio = await generateVoiceover(script, audioPath);

  // Step 2: Get audio duration
  let duration = 30;
  if (hasAudio) {
    try {
      const probe = execSync(
        `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${audioPath}"`,
        { encoding: "utf8" }
      );
      duration = Math.ceil(parseFloat(probe.trim())) + 1;
    } catch { duration = 30; }
  }

  // Step 3: Create silent video with background + text
  const silentCmd = [
    "ffmpeg -y",
    `-f lavfi -i "color=c=0x0d0d2b:s=1080x1920:d=${duration}:r=30"`,
    `-vf "${drawtextFilters}"`,
    "-c:v libx264 -pix_fmt yuv420p",
    `"${silentVideoPath}"`,
  ].join(" ");

  execSync(silentCmd, { stdio: "pipe" });

  // Step 4: Combine video + audio
  if (hasAudio && fs.existsSync(audioPath)) {
    const combineCmd = [
      "ffmpeg -y",
      `"-i" "${silentVideoPath}"`,
      `"-i" "${audioPath}"`,
      "-c:v copy -c:a aac -shortest",
      `"${outputPath}"`,
    ].join(" ");
    execSync(combineCmd, { stdio: "pipe" });
    fs.unlinkSync(audioPath);
  } else {
    fs.renameSync(silentVideoPath, outputPath);
  }

  if (fs.existsSync(silentVideoPath)) fs.unlinkSync(silentVideoPath);

  console.log("[YouTube] ✅ Video ready");
  return outputPath;
}

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
