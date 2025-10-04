require('dotenv').config();
const fetch = require('node-fetch');
const fs = require('fs');

const username = process.env.TIKTOK_USERNAME;
const botToken = process.env.TELEGRAM_BOT_TOKEN;
const chatId = process.env.TELEGRAM_CHAT_ID;
const target = parseInt(process.env.TARGET_FOLLOWERS);

const admin = require("firebase-admin");

admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  })
});

// Step 1: Get secUid from username
async function getSecUid(username) {
  try {
    const res = await fetch(`https://www.tikwm.com/api/user/search?keywords=${username}`);
    const data = await res.json();
    const user = data.data?.user_list?.[0]?.user;
    return user?.secUid || null;
  } catch (err) {
    console.error("❌ Error fetching secUid:", err.message);
    return null;
  }
}

// Step 2: Get follower count using secUid
async function getFollowerCount(username) {
  try {
    const res = await fetch(`https://www.tikwm.com/api/user/info?unique_id=${username}`);
    const data = await res.json();
    console.log("🔎 Tikwm API response:", data);
    return data.data?.stats?.followerCount || data.data?.follower_count || 0;
  } catch (err) {
    console.error("❌ Error fetching follower count:", err.message);
    return 0;
  }
}

// Step 3: Read last saved count
function getLastCount() {
  try {
    const raw = fs.readFileSync('followers.json');
    const json = JSON.parse(raw);
    return json.last || 0;
  } catch {
    return 0;
  }
}

// Step 4: Save current count
function saveCount(count) {
  fs.writeFileSync('followers.json', JSON.stringify({ last: count }, null, 2));
}

// Step 5: Send Telegram message
async function sendTelegramMessage(message) {
  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text: message })
  });
}

// Step 6: Main logic
async function checkFollowers() {
  const secUid = await getSecUid(username);
  console.log("🔎 secUid:", secUid); // Add this line
  if (!secUid) {
    console.log("❌ Could not find secUid for username:", username);
    return;
  }

  const current = await getFollowerCount(username);
  const previous = getLastCount();
  const diff = current - previous;

  console.log(`📊 Current follower count: ${current}`);
  if (diff > 0) {
    console.log(`📈 ${diff} new follower(s) added`);
    await sendTelegramMessage(`🎉 Followers increased from ${previous} to ${current} (+${diff})`);
  }

  if (current >= target && previous < target) {
    await sendTelegramMessage(`🏆 Congratulations! You've reached ${current} followers on TikTok!`);
  }

  if ([100, 500, 1000, 5000].includes(current) && previous < current) {
    await sendTelegramMessage(`🎉 مبروك! وصلت إلى ${current} متابع على تيك توك!`);
  }

  saveCount(current);
}

// Run every hour
setInterval(checkFollowers, 10 * 1000); // كل 10 ثواني

checkFollowers(); // Initial run
