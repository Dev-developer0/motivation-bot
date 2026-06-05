require("dotenv").config();
const { google } = require("googleapis");
const readline = require("readline");

const oauth2Client = new google.auth.OAuth2(
  process.env.YOUTUBE_CLIENT_ID,
  process.env.YOUTUBE_CLIENT_SECRET,
  "urn:ietf:wg:oauth:2.0:oob"
);

const scopes = [
  "https://www.googleapis.com/auth/youtube.upload"
];

const authUrl = oauth2Client.generateAuthUrl({
  access_type: "offline",
  scope: scopes,
});

console.log("\nOpen this URL in your browser:\n");
console.log(authUrl);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

rl.question("\nPaste the authorization code here: ", async (code) => {
  try {
    const { tokens } = await oauth2Client.getToken(code);

    console.log("\nACCESS TOKEN:");
    console.log(tokens.access_token);

    console.log("\nREFRESH TOKEN:");
    console.log(tokens.refresh_token);

    rl.close();
  } catch (err) {
    console.error(err);
    rl.close();
  }
});