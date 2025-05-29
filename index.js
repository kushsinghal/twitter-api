require("dotenv").config(); // Load environment variables from .env

const express = require("express");
const axios = require("axios");

const app = express();
const PORT = process.env.PORT || 3000;
const BEARER_TOKEN = process.env.BEARER_TOKEN;

const cache = {}; // In-memory caching

// ----------------------
// ✅ GET /latest-tweet route
// ----------------------
app.get("/latest-tweet", async (req, res) => {
  const { username, userid } = req.query;
  const cacheKey = `tweets_${username || userid}`;

  if (!username && !userid) {
    return res.status(400).json({ error: "Provide either username or userid" });
  }

  // ✅ Check cache
  if (cache[cacheKey]) {
    console.log(`⚡ Serving cached tweets for ${cacheKey}`);
    return res.json(cache[cacheKey]);
  }

  try {
    let userId = userid;

    // 🔁 Step 1: Get user ID from username
    if (username) {
      const userRes = await axios.get(
        `https://api.twitter.com/2/users/by/username/${username}`,
        {
          headers: {
            Authorization: `Bearer ${BEARER_TOKEN}`,
          },
        }
      );
      userId = userRes.data.data.id;
    }

    // 🐦 Step 2: Get last 6 tweets with media
    const tweetsRes = await axios.get(
      `https://api.twitter.com/2/users/${userId}/tweets`,
      {
        headers: {
          Authorization: `Bearer ${BEARER_TOKEN}`,
        },
        params: {
          max_results: 6,
          "tweet.fields": "attachments,created_at,text",
          expansions: "attachments.media_keys",
          "media.fields": "url,preview_image_url,type",
        },
      }
    );

    // 🐛 Debug log: RAW Twitter API data
    console.log("🧾 RAW Twitter API Response:");
    console.dir(tweetsRes.data, { depth: null });

    const tweets = tweetsRes.data.data || [];
    const mediaIncludes = tweetsRes.data.includes?.media || [];

    // 🎯 Step 3: Build map of media keys to URLs
    const mediaMap = {};
    mediaIncludes.forEach((mediaItem) => {
      const mediaUrl = mediaItem.url || mediaItem.preview_image_url;
      if (mediaUrl) {
        mediaMap[mediaItem.media_key] = mediaUrl;
      }
    });

    // 📦 Step 4: Prepare cleaned tweet data
    const tweetData = tweets.map((tweet) => {
      const media = [];

      if (tweet.attachments?.media_keys) {
        tweet.attachments.media_keys.forEach((key) => {
          if (mediaMap[key]) {
            media.push(mediaMap[key]);
          }
        });
      }

      return {
        text: tweet.text,
        media,
        link: `https://twitter.com/${username || "user"}/status/${tweet.id}`,
        date: tweet.created_at,
      };
    });

    // 💾 Step 5: Cache and return
    cache[cacheKey] = tweetData;
    console.log(`✅ Cached tweets for ${cacheKey}`);

    setTimeout(() => {
      delete cache[cacheKey];
      console.log(`🧹 Cache expired for ${cacheKey}`);
    }, 2 * 60 * 1000); // Clear cache in 2 min

    res.json(tweetData);
  } catch (error) {
    console.error("❌ Twitter API Error:", error.response?.data || error.message);
    res.status(500).json({ error: "Something went wrong" });
  }
});

// ----------------------
// ✅ Start Server
// ----------------------
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
