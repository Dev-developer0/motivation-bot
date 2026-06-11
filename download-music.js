const https = require("https");
const http = require("http");
const fs = require("fs");
const path = require("path");

// Free royalty-free music from mixkit (no auth needed)
const TRACKS = {
  dark: "https://assets.mixkit.co/music/preview/mixkit-deep-urban-623.mp3",
  uplifting: "https://assets.mixkit.co/music/preview/mixkit-a-very-happy-christmas-897.mp3",
  intense: "https://assets.mixkit.co/music/preview/mixkit-games-worldbeat-466.mp3",
};

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const proto = url.startsWith("https") ? https : http;
    const file = fs.createWriteStream(dest);
    proto.get(url, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        file.close();
        if (fs.existsSync(dest)) fs.unlinkSync(dest);
        return download(res.headers.location, dest).then(resolve).catch(reject);
      }
      res.pipe(file);
      file.on("finish", () => { file.close(); resolve(); });
    }).on("error", reject);
  });
}

async function main() {
  const musicDir = path.join(__dirname, "music");
  if (!fs.existsSync(musicDir)) fs.mkdirSync(musicDir);

  for (const [mood, url] of Object.entries(TRACKS)) {
    const dest = path.join(musicDir, `${mood}.mp3`);
    console.log(`Downloading ${mood}...`);
    try {
      await download(url, dest);
      const size = fs.statSync(dest).size;
      if (size < 10000) {
        console.log(`❌ ${mood} failed — file too small (${size} bytes)`);
        fs.unlinkSync(dest);
      } else {
        console.log(`✅ ${mood} — ${(size/1024).toFixed(0)}KB`);
      }
    } catch (err) {
      console.log(`❌ ${mood} error:`, err.message);
    }
  }
}

main();
