require('dotenv').config();
const fetch = require('node-fetch');
const puppeteer = require('puppeteer');
const fs = require('fs');

const username = process.env.TIKTOK_USERNAME;
const botToken = process.env.TELEGRAM_BOT_TOKEN;
const chatId = process.env.TELEGRAM_CHAT_ID;
const target = parseInt(process.env.TARGET_FOLLOWERS);

// Step 1: Scrape follower count from TokCounter
async function getFollowerCountTokCounter(username) {
  const url = `https://tokcount.com/?user=${username}`;
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: 'networkidle2' });

  await page.waitForSelector('#count');
  const count = await page.$eval('#count', el => parseInt(el.textContent.replace(/,/g, '')));
  await browser.close();
  return count;
}

// Step 2: Read last saved count
function getLastCount() {
  try {
    const raw = fs.readFileSync('followers.json');
    const json = JSON.parse(raw);
    return json.last || 0;
  } catch {
    return 0;
  }
}

// Step 3: Save current count
function saveCount(count) {
  fs.writeFileSync('followers.json', JSON.stringify({ last: count }, null, 2));
}

// Step 4: Send Telegram message
async function sendTelegramMessage(message) {
  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text: message })
  });
}

// Step 5: Main logic
async function checkFollowers() {
  const current = await getFollowerCountTokCounter(username);
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

  const milestones = [100, 500, 1000, 5000];
  for (const milestone of milestones) {
    if (previous < milestone && current >= milestone) {
      await sendTelegramMessage(`🎉 مبروك! وصلت إلى ${milestone} متابع على تيك توك!`);
    }
  }

  saveCount(current);
}

// Run every 10 seconds
setInterval(checkFollowers, 10 * 1000);
checkFollowers(); // Initial run
