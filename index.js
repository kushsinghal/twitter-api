// Simple in-memory cache
const cache = {};



require("dotenv").config(); // Load environment variables first!

const express = require("express");
const axios = require("axios");

const app = express();
const PORT = process.env.PORT || 3000;

const BEARER_TOKEN = process.env.BEARER_TOKEN;

// Route: Get latest tweet text, media, and URL
app.get("/latest-tweet", async (req, res) => {
  const { username, userid } = req.query;
  
    const cacheKey = username || userid;
	
	 if (!cacheKey) {
    return res.status(400).json({ error: "Provide either username or userid" });
  }


  // If result is already in cache, return it immediately
  if (cache[cacheKey]) {
    console.log(`⚡ Serving CACHED data for ${cacheKey}`);
    return res.json(cache[cacheKey]);
  }


  

  try {
    let userId = userid;

    // Step 1: Get User ID from Username
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

    // Step 2: Fetch latest tweet with media
    const tweetRes = await axios.get(
      `https://api.twitter.com/2/users/${userId}/tweets`,
      {
        headers: {
          Authorization: `Bearer ${BEARER_TOKEN}`,
        },
        params: {
          max_results: 5,
          "tweet.fields": "attachments,created_at,text",
          expansions: "attachments.media_keys",
          "media.fields": "url,preview_image_url,type",
        },
      }
    );

    const tweet = tweetRes.data.data?.[0];
    if (!tweet) {
      return res.status(404).json({ error: "No tweets found" });
    }

    // Step 3: Parse media (if any)
    const media = [];
    const includes = tweetRes.data.includes;
    if (
      tweet.attachments &&
      tweet.attachments.media_keys &&
      includes?.media
    ) {
      for (const key of tweet.attachments.media_keys) {
        const mediaItem = includes.media.find((m) => m.media_key === key);
        if (mediaItem?.url) media.push(mediaItem.url);
        else if (mediaItem?.preview_image_url) media.push(mediaItem.preview_image_url);
      }
    }

    // Step 4: Make tweet URL
    const tweetUrl = `https://twitter.com/${username || "user"}/status/${tweet.id}`;

    // Step 5: Send response
    res.json({
      username: username || null,
      userid: userId,
      tweet_id: tweet.id,
      text: tweet.text,
      media,
      link: tweetUrl,
      date: tweet.created_at,
    });
  } catch (error) {
    console.error("API Error:", error.response?.data || error.message);
    res.status(500).json({ error: "Something went wrong" });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
