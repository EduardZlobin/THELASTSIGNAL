import fs from "fs/promises";

const TOKEN = process.env.DISCORD_TOKEN;
const CHANNEL_ID = process.env.DISCORD_CHANNEL_ID;

if (!TOKEN) throw new Error("DISCORD_TOKEN missing");
if (!CHANNEL_ID) throw new Error("DISCORD_CHANNEL_ID missing");

const API = "https://discord.com/api/v10";

async function discordFetch(endpoint) {
  const res = await fetch(`${API}${endpoint}`, {
    headers: { Authorization: `Bot ${TOKEN}` }
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Discord API error ${res.status}: ${text}`);
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

// ====== MODE A: Forum (threads/posts) ======
async function fetchForumPosts(forumId) {
  const posts = [];

  // активные треды
  const active = await discordFetch(`/channels/${forumId}/threads/active`);
  const activeThreads = active?.threads || [];

  // архивные публичные треды (часто именно там всё лежит)
  let archivedThreads = [];
  try {
    let before = null;
    for (let i = 0; i < 3; i++) {
      const url = before
        ? `/channels/${forumId}/threads/archived/public?limit=50&before=${encodeURIComponent(before)}`
        : `/channels/${forumId}/threads/archived/public?limit=50`;
      const arch = await discordFetch(url);
      const chunk = arch?.threads || [];
      archivedThreads.push(...chunk);
      if (!arch?.has_more || chunk.length === 0) break;
      before = chunk[chunk.length - 1].archive_timestamp;
    }
  } catch (e) {
    console.warn("Archived threads fetch failed:", e.message);
  }

  // уникальные треды
  const uniq = new Map();
  for (const t of [...activeThreads, ...archivedThreads]) uniq.set(t.id, t);
  const threads = [...uniq.values()];

  for (const thread of threads) {
    // starter message: id треда == id стартового сообщения
    let starter;
    try {
      starter = await discordFetch(`/channels/${thread.id}/messages/${thread.id}`);
    } catch (e) {
      console.warn("Starter fetch failed for thread", thread.id, e.message);
      continue;
    }

    let msgs = [];
    try {
      msgs = await discordFetch(`/channels/${thread.id}/messages?limit=50`);
    } catch (e) {
      console.warn("Messages fetch failed for thread", thread.id, e.message);
      msgs = [];
    }

    const comments = (msgs || [])
      .filter(m => m.id !== starter.id)
      .map(m => ({
        id: m.id,
        author_name: m.author?.username || "user",
        text: m.content || "",
        created_at: m.timestamp
      }));

    posts.push({
      id: `discord:${thread.id}`,
      source: "discord",
      public_id: 123, // <-- ВПИШИ СЮДА ID паблика из Supabase (ты уже выбрал)
      public_name: "DISCORD",
      public_avatar_url: "https://cdn-icons-png.flaticon.com/512/2111/2111370.png",
      title: thread.name,
      content: starter.content || "",
      image_url: pickImageFromMessage(starter),
      created_at: starter.timestamp,
      author_name: starter.author?.username || "user",
      comments
    });
  }

  return posts;
}

// ====== MODE B: Text channel (messages) ======
async function fetchTextChannelPosts(channelId) {
  const msgs = await discordFetch(`/channels/${channelId}/messages?limit=50`);
  // превращаем последние 50 сообщений в "посты" (каждое сообщение = пост)
  // Если хочешь иначе (группировать, только с картинками, только с #tag) — скажешь.
  return (msgs || []).map(m => ({
    id: `discord:${m.id}`,
    source: "discord",
    public_id: 123, // <-- ТАКОЙ ЖЕ public_id
    public_name: "DISCORD",
    public_avatar_url: "https://cdn-icons-png.flaticon.com/512/2111/2111370.png",
    title: (m.content || "DISCORD MESSAGE").slice(0, 60),
    content: m.content || "",
    image_url: pickImageFromMessage(m),
    created_at: m.timestamp,
    author_name: m.author?.username || "user",
    comments: [] // комменты для обычного канала отдельно не тянем
  }));
}

async function main() {
  console.log("Fetching Discord posts...");

  // 1) Проверяем что ID — это канал
  const ch = await discordFetch(`/channels/${CHANNEL_ID}`);
  console.log("Channel type:", ch?.type, "name:", ch?.name);

  // Discord channel types (часто используемые):
  // 0 = GUILD_TEXT
  // 5 = GUILD_NEWS
  // 15 = GUILD_FORUM
  // 16 = GUILD_MEDIA (новый тип, похож на форум)
  let posts = [];

  if (ch?.type === 15 || ch?.type === 16) {
    posts = await fetchForumPosts(CHANNEL_ID);
  } else if (ch?.type === 0 || ch?.type === 5) {
    posts = await fetchTextChannelPosts(CHANNEL_ID);
  } else {
    throw new Error(`Unsupported channel type: ${ch?.type}`);
  }

  await fs.writeFile("discord_posts.json", JSON.stringify(posts, null, 2));
  console.log(`Saved discord_posts.json (${posts.length} items)`);
}

main();
