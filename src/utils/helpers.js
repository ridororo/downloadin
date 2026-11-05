const sanitize = require('sanitize-filename');

/**
 * Format bytes into human readable size
 * @param {number} bytes
 * @returns {string}
 */
function formatBytes(bytes, decimals = 1) {
  if (!bytes || bytes <= 0) return 'Ukuran Otomatis';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * Format duration in seconds into mm:ss or hh:mm:ss
 * @param {number} seconds
 * @returns {string}
 */
function formatDuration(seconds) {
  if (!seconds || isNaN(seconds) || seconds <= 0) return '';
  const sec = Math.floor(seconds);
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;

  const mStr = String(m).padStart(h > 0 ? 2 : 1, '0');
  const sStr = String(s).padStart(2, '0');

  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${sStr}`;
  }
  return `${mStr}:${sStr}`;
}

/**
 * Clean and sanitize filename for Windows, Android, and macOS
 * Removes emoji, special symbols, Windows reserved characters, and restricts length to 50-60 chars
 * @param {string} name
 * @param {string} fallback
 * @param {number} maxLength
 * @returns {string}
 */
function safeFilename(name, fallback = 'DownloadIn_Media', maxLength = 55) {
  if (!name || typeof name !== 'string') return fallback;

  // 1. Strip emojis and unicode symbols
  let cleaned = name
    .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FE0F}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}]/gu, '')
    // 2. Strip hashtags, mentions, URLs, or HTML entities
    .replace(/https?:\/\/\S+/gi, '')
    .replace(/&[a-z]+;/gi, '')
    .trim();

  // 3. Remove Windows illegal characters: < > : " / \ | ? * and ASCII control characters (0-31)
  cleaned = sanitize(cleaned);
  cleaned = cleaned.replace(/[<>:"/\\|?*\x00-\x1F]/g, '');

  // 4. Replace non-alphanumeric punctuation (except dash/underscore/dot) with space
  cleaned = cleaned.replace(/[^a-zA-Z0-9\-_.]/g, ' ');

  // 5. Collapse whitespace, underscores, and dots cleanly
  cleaned = cleaned
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/\.{2,}/g, '.')
    .replace(/^[._]+|[._]+$/g, '');

  // 6. Restrict length cleanly
  if (cleaned.length > maxLength) {
    cleaned = cleaned.substring(0, maxLength).replace(/[._]+$/, '');
  }

  // 7. Ensure not empty or Windows reserved device names (CON, PRN, AUX, NUL, COM1-9, LPT1-9)
  const reservedWindows = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;
  if (!cleaned || reservedWindows.test(cleaned)) {
    return fallback;
  }

  return cleaned;
}

/**
 * Clean URL string
 * @param {string} url
 * @returns {string}
 */
function normalizeUrl(url) {
  if (!url) return '';
  let trimmed = url.trim();
  try {
    const parsed = new URL(trimmed);
    return parsed.href;
  } catch (e) {
    return trimmed;
  }
}

module.exports = {
  formatBytes,
  formatDuration,
  safeFilename,
  normalizeUrl
};
