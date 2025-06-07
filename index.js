require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const express = require('express');
const session = require('express-session');
const app = express();
const port = process.env.PORT || 3000;

// セッション設定
app.use(session({
  secret: process.env.SESSION_SECRET || 'your_session_secret',
  resave: false,
  saveUninitialized: false
}));

// ミドルウェア
app.use(express.json());
app.use(express.static('public'));

// Discordクライアント（リクエストごとに新規作成）
let sendInterval = null;

// トークン設定
app.post('/set-token', async (req, res) => {
  const { token } = req.body;
  if (!token) return res.json({ error: 'トークンを入力してください' });

  const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });
  try {
    await client.login(token);
    req.session.token = token;
    client.destroy();
    res.json({ message: 'トークンが設定されました' });
  } catch (error) {
    res.json({ error: 'トークンが無効です' });
  }
});

// チャンネル取得
app.post('/get-channels', async (req, res) => {
  const { guildId } = req.body;
  const token = req.session.token;
  if (!token || !guildId) return res.json({ error: 'トークンまたはサーバーIDがありません' });

  const client = new Client({ intents: [GatewayIntentBits.Guilds] });
  try {
    await client.login(token);
    const guild = await client.guilds.fetch(guildId);
    const channels = await guild.channels.cache.filter(c => c.isTextBased()).map(c => ({ id: c.id, name: c.name }));
    client.destroy();
    res.json({ channels });
  } catch (error) {
    client.destroy();
    res.json({ error: 'チャンネル取得に失敗しました: ' + error.message });
  }
});

// ユーザー取得
app.post('/get-users', async (req, res) => {
  const { guildId } = req.body;
  const token = req.session.token;
  if (!token || !guildId) return res.json({ error: 'トークンまたはサーバーIDがありません' });

  const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers] });
  try {
    await client.login(token);
    const guild = await client.guilds.fetch(guildId);
    await guild.members.fetch();
    const users = guild.members.cache.map(m => ({ id: m.id, username: m.user.username }));
    client.destroy();
    res.json({ users });
  } catch (error) {
    client.destroy();
    res.json({ error: 'ユーザー取得に失敗しました: ' + error.message });
  }
});

// メッセージ送信
app.post('/send-message', async (req, res) => {
  const { channelIds, message, mentionUserIds, repeatCount, interval, createThread, threadName } = req.body;
  const token = req.session.token;
  if (!token || !channelIds || !message) return res.json({ error: 'トークン、チャンネルID、メッセージが必要です' });

  const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages] });
  try {
    await client.login(token);
    const channelIdList = channelIds.split(/[\n,]+/).map(id => id.trim()).filter(id => id);
    const mentionList = mentionUserIds ? mentionUserIds.split(/[\n,]+/).map(id => `<@${id.trim()}>`).filter(id => id) : [];
    const count = Math.min(parseInt(repeatCount) || 1, 100);
    const delay = Math.max(Math.min(parseFloat(interval) || 1000, 10000), 500);

    let sentCount = 0;
    sendInterval = setInterval(async () => {
      if (sentCount >= count || !sendInterval) {
        clearInterval(sendInterval);
        sendInterval = null;
        client.destroy();
        return;
      }

      for (const channelId of channelIdList) {
        try {
          const channel = await client.channels.fetch(channelId);
          let targetChannel = channel;

          if (createThread && channel.isTextBased()) {
            const thread = await channel.threads.create({
              name: threadName || `Thread-${Date.now()}`,
              autoArchiveDuration: 60
            });
            targetChannel = thread;
          }

          const content = mentionList.length ? `${mentionList.join(' ')} ${message}` : message;
          await targetChannel.send(content);
        } catch (error) {
          console.error(`チャンネル ${channelId} への送信失敗:`, error.message);
        }
      }
      sentCount++;
    }, delay);

    res.json({ message: `送信開始（${count}回、${delay/1000}秒間隔）` });
  } catch (error) {
    client.destroy();
    res.json({ error: '送信開始に失敗しました: ' + error.message });
  }
});

// 送信停止
app.post('/stop-sending', (req, res) => {
  if (sendInterval) {
    clearInterval(sendInterval);
    sendInterval = null;
    res.json({ message: '送信が停止されました' });
  } else {
    res.json({ message: '送信中のタスクはありません' });
  }
});

// サーバー起動
app.listen(port, () => {
  console.log(`サーバーが http://localhost:${port} で起動しました！`);
});
