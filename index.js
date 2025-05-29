app.get("/latest-tweet", async (req, res) => {
  const { username, userid } = req.query;

  if (!username && !userid) {
    return res.status(400).json({ error: "Provide either username or userid" });
  }

  try {
    let userId = userid;

    // Step 1: Get User ID from Username (if needed)
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

    // Step 2: Get Latest Tweet with media and expanded info
    const tweetsRes = await axios.get(
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

    const tweet = tweetsRes.data.data?.[0];

    if (!tweet) {
      return res.status(404).json({ error: "No tweets found" });
    }

    // Step 3: Extract media URLs if present
    const media = [];
    const includes = tweetsRes.data.includes;

    if (tweet.attachments && tweet.attachments.media_keys && includes?.media) {
      const mediaKeys = tweet.attachments.media_keys;

      for (let key of mediaKeys) {
        const mediaObj = includes.media.find((m) => m.media_key === key);
        if (mediaObj) {
          if (mediaObj.url) {
            media.push(mediaObj.url);
          } else if (mediaObj.preview_image_url) {
            media.push(mediaObj.preview_image_url); // For video/animated gif
          }
        }
      }
    }

    // Step 4: Full Tweet URL
    const tweetUrl = `https://twitter.com/${username}/status/${tweet.id}`;

    res.json({
      username,
      tweet_id: tweet.id,
      text: tweet.text,
      media,
      link: tweetUrl,
      date: tweet.created_at,
    });
  } catch (error) {
    console.error(error.response?.data || error.message);
    res.status(500).json({ error: "Something went wrong" });
  }
});
