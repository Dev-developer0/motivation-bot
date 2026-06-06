require("dotenv").config();
const https = require("https");

const options = {
  hostname: "api.elevenlabs.io",
  path: "/v1/voices",
  method: "GET",
  headers: {
    "xi-api-key": process.env.ELEVENLABS_API_KEY,
  },
};

https.get(options, (res) => {
  let data = "";
  res.on("data", (chunk) => (data += chunk));
  res.on("end", () => {
    if (res.statusCode !== 200) {
      console.log("❌ Error:", res.statusCode, data);
      return;
    }
    const voices = JSON.parse(data).voices;
    console.log("✅ Available voices:\n");
    voices.forEach((v) => {
      console.log(`  Name: ${v.name} | ID: ${v.voice_id}`);
    });
  });
}).on("error", console.error);
