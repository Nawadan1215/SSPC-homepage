const fetch = require('node-fetch');

module.exports = async (req, res) => {
  const { token, channelId, content } = req.body;
  if (!token || !channelId || !content) {
    return res.status(400).json({ error: 'トークン、チャンネルID、コンテンツは必須です' });
  }

  try {
    const response = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ content })
    });
    const data = await response.json();
    if (response.ok) {
      res.json({ message: 'Message sent!' });
    } else {
      res.status(response.status).json({ error: data.message || 'Failed to send message' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
