import fs from "fs/promises";

const TOKEN = process.env.DISCORD_TOKEN;
const CHANNEL_ID = process.env.DISCORD_CHANNEL_ID;

if (!TOKEN) throw new Error("DISCORD_TOKEN missing");
if (!CHANNEL_ID) throw new Error("DISCORD_CHANNEL_ID missing");

const API = "https://discord.com/api/v10";

async function discordFetch(endpoint) {
  const res = await fetch(`${API}${endpoint}`, {
    headers: {
      Authorization: `Bot ${TOKEN}`
    }
  });

  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Discord API error ${res.status}: ${t}`);
  }

  return res.json();
}

// Если это Forum Channel → берём треды
async function fetchForumPosts() {
  const threads = await discordFetch(
    `/channels/${CHANNEL_ID}/threads/active`
  );

  const posts = [];

  for (const thread of threads.threads) {
    const messages = await discordFetch(
      `/channels/${thread.id}/messages?limit=50`
    );

    if (!messages.length) continue;

    const starter = messages[messages.length - 1]; // стартовое сообщение

    const comments = messages
      .slice(0, -1)
      .map(m => ({
        id: m.id,
        author_name: m.author?.username || "user",
        text: m.content,
        created_at: m.timestamp
      }));

    posts.push({
      id: `discord:${thread.id}`,
      source: "discord",
      public_id: 1, // ⬅️ ВПИШИ ID паблика из Supabase
      public_name: "DISCORD",
      public_avatar_url: "https://cdn-icons-png.flaticon.com/512/2111/2111370.png",
      title: thread.name,
      content: starter.content,
      image_url: starter.attachments?.[0]?.url || null,
      created_at: starter.timestamp,
      author_name: starter.author?.username || "user",
      comments
    });
  }

  return posts;
}

async function main() {
  console.log("Fetching Discord posts...");
  const posts = await fetchForumPosts();

  await fs.writeFile(
    "discord_posts.json",
    JSON.stringify(posts, null, 2)
  );

  console.log("Saved discord_posts.json");
}

main();
