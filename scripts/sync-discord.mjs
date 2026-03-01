import fs from "fs/promises";

const TOKEN = process.env.DISCORD_TOKEN;
const CHANNEL_ID = process.env.DISCORD_CHANNEL_ID;

if (!TOKEN) throw new Error("DISCORD_TOKEN missing");
if (!CHANNEL_ID) throw new Error("DISCORD_CHANNEL_ID missing");

const API = "https://discord.com/api/v10";

// ====== CONFIG ======
const PUBLIC_ID = 9; // <-- твой publics.id из Supabase
const PUBLIC_NAME = "🅲🅽🅽-breaking-bad-news📰";
const PUBLIC_AVATAR_URL = "https://adzxwgaoozuoamqqwkcd.supabase.co/storage/v1/object/public/avatars/signal_1770110946500_z2pme";

const POSTS_LIMIT = 50;      // сколько постов форума тянуть
const COMMENTS_LIMIT = 100;  // сколько комментов на пост

async function discordFetch(endpoint) {
  const url = `${API}${endpoint}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bot ${TOKEN}` }
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Discord API error ${res.status} on ${endpoint}: ${text}`);
  }
  return text ? JSON.parse(text) : null;
}

function pickImageFromMessage(msg) {
  return (
    msg?.attachments?.[0]?.url ||
    msg?.embeds?.find(e => e?.image?.url)?.image?.url ||
    msg?.embeds?.find(e => e?.thumbnail?.url)?.thumbnail?.url ||
    null
  );
}

function normalizeComment(m) {
  return {
    id: m.id,
    author_name: m.author?.username || "user",
    text: m.content || "",
    created_at: m.timestamp
  };
}

// ====== FORUM: posts are messages in the forum channel ======
async function fetchForumPostsViaMessages(forumId) {
  // В форумах "посты" приходят как messages самого канала форума
  const forumMessages = await discordFetch(`/channels/${forumId}/messages?limit=${POSTS_LIMIT}`);
  const posts = [];

  for (const msg of forumMessages || []) {
    // Для форумов: msg.id == thread/channel id, где лежат комменты.
    // Но бывают случаи, когда thread ещё не доступен — тогда просто без комментов.
    const threadId = msg.id;

    let comments = [];
    try {
      const threadMessages = await discordFetch(`/channels/${threadId}/messages?limit=${COMMENTS_LIMIT}`);
      // Внутри треда обычно есть тот же стартовый пост (или нет).
      // Мы считаем "комментами" всё кроме самого msg.id
      comments = (threadMessages || [])
        .filter(m => m.id !== msg.id)
        .map(normalizeComment);
    } catch (e) {
      // Если комменты не достали — не валим весь sync
      console.warn("Comments fetch failed for post", msg.id, e.message);
      comments = [];
    }

    // Заголовок в forum post часто лежит в msg.embeds[0].title,
    // но не всегда. Иногда Discord отдаёт "content" пустой, а title в embed.
    const embedTitle =
      msg?.embeds?.find(e => typeof e?.title === "string" && e.title.trim())?.title || null;

    const title =
      embedTitle ||
      (msg.content ? msg.content.slice(0, 80) : `POST ${msg.id}`);

    posts.push({
      id: `discord:${msg.id}`,
      source: "discord",

      public_id: PUBLIC_ID,
      public_name: PUBLIC_NAME,
      public_avatar_url: PUBLIC_AVATAR_URL,

      title,
      content: msg.content || "",
      image_url: pickImageFromMessage(msg),

      created_at: msg.timestamp,
      author_name: msg.author?.username || "user",

      comments
    });
  }

  return posts;
}

// ====== TEXT CHANNEL fallback (if needed) ======
async function fetchTextChannelPosts(channelId) {
  const msgs = await discordFetch(`/channels/${channelId}/messages?limit=${POSTS_LIMIT}`);
  return (msgs || []).map(m => ({
    id: `discord:${m.id}`,
    source: "discord",

    public_id: PUBLIC_ID,
    public_name: PUBLIC_NAME,
    public_avatar_url: PUBLIC_AVATAR_URL,

    title: (m.content || "DISCORD MESSAGE").slice(0, 60),
    content: m.content || "",
    image_url: pickImageFromMessage(m),

    created_at: m.timestamp,
    author_name: m.author?.username || "user",

    comments: []
  }));
}

async function main() {
  console.log("Fetching Discord posts...");

  const ch = await discordFetch(`/channels/${CHANNEL_ID}`);
  console.log("Channel type:", ch?.type, "name:", ch?.name);

  let posts = [];

  // 15 = forum, 16 = media (обычно тоже как форум по messages)
  if (ch?.type === 15 || ch?.type === 16) {
    posts = await fetchForumPostsViaMessages(CHANNEL_ID);
  } else if (ch?.type === 0 || ch?.type === 5) {
    posts = await fetchTextChannelPosts(CHANNEL_ID);
  } else {
    throw new Error(`Unsupported channel type: ${ch?.type}`);
  }

  posts.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  await fs.writeFile("discord_posts.json", JSON.stringify(posts, null, 2));
  console.log(`Saved discord_posts.json (${posts.length} items)`);
}

main();
