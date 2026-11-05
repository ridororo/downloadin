/**
 * URL Validator and Platform Identifier Service
 */

const PLATFORM_RULES = [
  {
    id: 'tiktok',
    name: 'TikTok',
    domains: [/tiktok\.com/i, /douyin\.com/i],
    storyPattern: /\/(story|stories)\//i
  },
  {
    id: 'instagram',
    name: 'Instagram',
    domains: [/instagram\.com/i, /instagr\.am/i],
    storyPattern: /\/stories\/([a-zA-Z0-9_\.]+)\/([0-9]+)/i
  },
  {
    id: 'facebook',
    name: 'Facebook',
    domains: [/facebook\.com/i, /fb\.watch/i, /fb\.com/i, /fb\.me/i],
    storyPattern: /\/stories\/|\/story\.php/i
  },
  {
    id: 'twitter',
    name: 'X (Twitter)',
    domains: [/x\.com/i, /twitter\.com/i, /t\.co/i],
    storyPattern: null
  },
  {
    id: 'youtube',
    name: 'YouTube',
    domains: [/youtube\.com/i, /youtu\.be/i],
    storyPattern: null
  },
  {
    id: 'threads',
    name: 'Threads',
    domains: [/threads\.net/i],
    storyPattern: null
  },
  {
    id: 'reddit',
    name: 'Reddit',
    domains: [/reddit\.com/i, /redd\.it/i],
    storyPattern: null
  },
  {
    id: 'pinterest',
    name: 'Pinterest',
    domains: [/pinterest\.com/i, /pin\.it/i],
    storyPattern: null
  }
];

/**
 * Validate URL structure
 * @param {string} urlString
 * @returns {boolean}
 */
function isValidUrl(urlString) {
  if (!urlString || typeof urlString !== 'string') return false;
  try {
    const parsed = new URL(urlString.trim());
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch (e) {
    return false;
  }
}

/**
 * Detect social media platform from URL
 * @param {string} urlString
 * @returns {{ id: string, name: string, isStory: boolean }}
 */
function detectPlatform(urlString) {
  if (!isValidUrl(urlString)) {
    return { id: 'unknown', name: 'Tidak Diketahui', isStory: false };
  }

  const url = urlString.trim();

  for (const platform of PLATFORM_RULES) {
    const isMatched = platform.domains.some((domainRegex) => domainRegex.test(url));
    if (isMatched) {
      const isStory = platform.storyPattern ? platform.storyPattern.test(url) : false;
      return {
        id: platform.id,
        name: platform.name,
        isStory
      };
    }
  }

  return { id: 'other', name: 'Platform Lainnya', isStory: false };
}

/**
 * Validate input and verify platform match
 * @param {string} url
 * @param {string} selectedPlatform (e.g. 'auto', 'tiktok', 'instagram', 'facebook', 'twitter', 'youtube', 'other')
 * @returns {{ valid: boolean, error?: string, mismatch: boolean, detectedPlatform: string, detectedName: string, isStory: boolean }}
 */
function validateInput(url, selectedPlatform = 'auto') {
  if (!url || typeof url !== 'string' || !url.trim()) {
    return {
      valid: false,
      error: 'Tautan URL tidak boleh kosong. Silakan masukkan atau tempel link postingan/Story.',
      mismatch: false,
      detectedPlatform: 'unknown',
      detectedName: '',
      isStory: false
    };
  }

  const trimmed = url.trim();

  if (!isValidUrl(trimmed)) {
    return {
      valid: false,
      error: 'Format URL tidak valid. Pastikan tautan diawali dengan http:// atau https://',
      mismatch: false,
      detectedPlatform: 'unknown',
      detectedName: '',
      isStory: false
    };
  }

  const detected = detectPlatform(trimmed);

  // Check platform mismatch if user specified a concrete platform (not 'auto' and not 'other')
  let mismatch = false;
  let mismatchMessage = null;

  if (selectedPlatform && selectedPlatform !== 'auto' && selectedPlatform !== 'other') {
    if (detected.id !== selectedPlatform && detected.id !== 'unknown' && detected.id !== 'other') {
      mismatch = true;
      mismatchMessage = `Anda memilih kategori "${selectedPlatform.toUpperCase()}", tetapi tautan yang dimasukkan terdeteksi berasal dari ${detected.name}.`;
    }
  }

  return {
    valid: true,
    mismatch,
    mismatchMessage,
    detectedPlatform: detected.id,
    detectedName: detected.name,
    isStory: detected.isStory
  };
}

module.exports = {
  isValidUrl,
  detectPlatform,
  validateInput,
  PLATFORM_RULES
};

