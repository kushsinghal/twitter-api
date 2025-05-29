// index.js
require("dotenv").config(); // ✅ This must be first!

const express = require("express");
const axios = require("axios");


const app = express();
const PORT = process.env.PORT || 3000;

const BEARER_TOKEN = process.env.BEARER_TOKEN;
console.log("Bearer Token Loaded:", BEARER_TOKEN);


app.get("/latest-tweet", async (req, res) => {
  const username = req.query.username;

  if (!username) {
    return res.status(400).json({ error: "Username is required" });
  }

  try {
    const userRes = await axios.get(
      `https://api.twitter.com/2/users/by/username/${username}`,
      {
        headers: {
          Authorization: `Bearer ${BEARER_TOKEN}`,
        },
      }
    );

    const userId = userRes.data.data.id;

    const tweetsRes = await axios.get(
      `https://api.twitter.com/2/users/${userId}/tweets`,
      {
        headers: {
          Authorization: `Bearer ${BEARER_TOKEN}`,
        },
        params: {
          max_results: 5,
          "tweet.fields": "created_at",
        },
      }
    );

    const latestTweet = tweetsRes.data.data?.[0];

    if (!latestTweet) {
      return res.status(404).json({ error: "No tweets found" });
    }

    res.json({
      username,
      tweet: latestTweet.text,
      date: latestTweet.created_at,
    });
  } catch (error) {
    console.error(error.response?.data || error.message);
    res.status(500).json({ error: "Something went wrong" });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
