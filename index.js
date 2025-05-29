require("dotenv").config(); // Load .env first

const express = require("express");
const axios = require("axios");

const app = express(); // ❗ This must be before app.get()
const PORT = process.env.PORT || 3000;
const BEARER_TOKEN = process.env.BEARER_TOKEN;

const cache = {}; // for in-memory caching

// --- Your app.get("/latest-tweet", ... comes below ---



app.get("/latest-tweet", async (req, res) => {
  const { username, userid } = req.query;
  const cacheKey = `tweets_${username || userid}`;

  if (!username && !userid) {
    return res.status(400).json({ error: "Provide either username or userid" });
  }

  // Return from cache if available
  if (cache[cacheKey]) {
    console.log(`⚡ Serving cached tweets for ${cacheKey}`);
    return res.json(cache[cacheKey]);
  }

  try {
    let userId = userid;

    // 🌐 Step 1: Get user ID if only username is provided
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

    // 🐦 Step 2: Get last 6 tweets from the user
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

    const tweets = tweetsRes.data.data;
    const mediaMap = {};
    const includes = tweetsRes.data.includes;

    // 🎥 Step 3: Prepare a map of media_key to media URL
    if (includes?.media?.length) {
      includes.media.forEach((media) => {
        const mediaUrl = media.url || media.preview_image_url;
        if (mediaUrl) {
          mediaMap[media.media_key] = mediaUrl;
        }
      });
    }

    // 📦 Step 4: Process tweets
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

    // 💾 Step 5: Cache the result
    cache[cacheKey] = tweetData;
    console.log(`✅ Cached 6 tweets for ${cacheKey}`);

    setTimeout(() => {
      delete cache[cacheKey];
      console.log(`🧹 Cache expired for ${cacheKey}`);
    }, 2 * 60 * 1000); // 2 minutes

    res.json(tweetData);
  } catch (error) {
    console.error("API Error:", error.response?.data || error.message);
    res.status(500).json({ error: "Something went wrong" });
  }
});
