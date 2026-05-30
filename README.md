# Twitter Mindset Bot

Auto-generates motivation threads using Claude AI and posts to Twitter/X 3x daily.
Posts at: **9am, 3pm, 8pm IST** every day — forever, automatically.

---

## Deploy in 5 minutes

### Step 1 — Get a free Anthropic API key
1. Go to https://console.anthropic.com
2. Sign up → API Keys → Create Key
3. Copy it

### Step 2 — Push to GitHub
1. Go to https://github.com → New repository → name it `twitter-bot` → Create
2. Upload all these files (drag and drop)

### Step 3 — Deploy on Railway
1. Go to https://railway.app → Sign up with GitHub (free)
2. Click **"New Project"** → **"Deploy from GitHub repo"**
3. Select your `twitter-bot` repo
4. Click **"Variables"** tab → Add these one by one:

| Key | Value |
|-----|-------|
| `ANTHROPIC_API_KEY` | your Claude API key |
| `TWITTER_API_KEY` | from developer.twitter.com |
| `TWITTER_API_SECRET` | from developer.twitter.com |
| `TWITTER_ACCESS_TOKEN` | from developer.twitter.com |
| `TWITTER_ACCESS_TOKEN_SECRET` | from developer.twitter.com |

5. Railway auto-deploys. Done. Bot is live 24/7.

---

## Check your bot

- Visit `https://YOUR-APP.railway.app/` → see if it's running
- Visit `https://YOUR-APP.railway.app/posts` → see all posted threads
- POST to `https://YOUR-APP.railway.app/post-now` → trigger a post manually

---

## Customize topics

Edit the `TOPICS` array in `index.js` — add your own angles.
The bot rotates through them automatically.

---

## Earn money

Add your Amazon affiliate link inside the last tweet prompt in `index.js`.
Search for `Last tweet` in the code and add your link naturally.
