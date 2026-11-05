/**
 * Human-friendly error categorizer for social media downloads
 * Translates yt-dlp & network exceptions into clear, actionable Indonesian messages
 * Extracts real stderr messages so users and developers see the exact underlying issue.
 */

function extractCleanStderr(rawError) {
  if (!rawError) return '';
  const stderr = rawError.stderr || (typeof rawError === 'string' ? rawError : '') || rawError.message || '';
  const lines = stderr.split('\n').map((l) => l.trim()).filter(Boolean);
  const errorLines = lines.filter((l) => l.startsWith('ERROR:') || l.includes('Error:'));
  if (errorLines.length > 0) {
    return errorLines.map((l) => l.replace(/^ERROR:\s*/i, '')).join('; ');
  }
  return lines.length > 0 ? lines[lines.length - 1] : stderr;
}

function categorizeError(rawError) {
  const stderrText = (rawError && rawError.stderr) || '';
  const messageText = (rawError && rawError.message) || '';
  const combinedText = `${stderrText} ${messageText} ${rawError && rawError.stdout || ''}`;
  const lower = combinedText.toLowerCase();
  const cleanStderr = extractCleanStderr(rawError);

  // 1. Missing yt-dlp executable
  if (
    lower.includes('enoent') ||
    lower.includes('not recognized') ||
    lower.includes('command not found') ||
    lower.includes('yt-dlp is not installed')
  ) {
    return {
      status: 500,
      code: 'EXTRACTOR_MISSING',
      title: 'Ekstraktor Belum Terpasang',
      message: 'Modul yt-dlp belum terpasang di server. Jalankan perintah "npm run setup" atau letakkan yt-dlp.exe di folder bin/.',
      retryable: false,
      detail: cleanStderr || messageText
    };
  }

  // 2. Private Account / Restricted Content / Login or Cookies Required
  if (
    lower.includes('private account') ||
    lower.includes('this account is private') ||
    lower.includes('private video') ||
    lower.includes('is a private video') ||
    lower.includes('this content is private') ||
    lower.includes('this content is unreachable') ||
    lower.includes('content is unreachable') ||
    lower.includes('login required') ||
    lower.includes('requires login') ||
    lower.includes('sign in to confirm') ||
    lower.includes('sign in to view') ||
    lower.includes('please provide cookies') ||
    lower.includes('use --cookies') ||
    lower.includes('use --cookies-from-browser') ||
    lower.includes('cookies are required') ||
    lower.includes('cookie expired') ||
    lower.includes('cookies expired') ||
    lower.includes('session expired') ||
    lower.includes('checkpoint_required') ||
    lower.includes('only available to registered users') ||
    lower.includes('restricted video') ||
    lower.includes('restricted content') ||
    lower.includes('members only') ||
    lower.includes('close friends')
  ) {
    return {
      status: 403,
      code: 'PRIVATE_OR_RESTRICTED',
      errorType: 'PRIVATE_OR_RESTRICTED',
      title: 'Konten Privat atau Dibatasi',
      message: 'Tidak dapat mengunduh konten ini karena berasal dari Akun Private, Story yang dibatasi, atau tautan sudah tidak tersedia. Pastikan akun dan postingan bersifat Publik.',
      retryable: false,
      detail: cleanStderr || messageText
    };
  }

  // 5. Expired Story or Deleted Story (>24 Hours)
  if (
    lower.includes('story has expired') ||
    lower.includes('story is no longer available') ||
    lower.includes('unavailable_story') ||
    lower.includes('story expired') ||
    lower.includes('highlight expired')
  ) {
    return {
      status: 410,
      code: 'STORY_EXPIRED',
      title: 'Story Telah Kedaluwarsa',
      message: 'Story ini telah melewati batas waktu 24 jam atau telah dihapus oleh pengunggah.',
      retryable: false,
      detail: cleanStderr || 'Story expired or deleted.'
    };
  }

  // 6. Content Deleted or Not Found (404)
  if (
    lower.includes('404') ||
    lower.includes('not found') ||
    lower.includes('video unavailable') ||
    lower.includes('post not found') ||
    lower.includes('content is not available') ||
    lower.includes('this post is unavailable') ||
    lower.includes('deleted by the user')
  ) {
    return {
      status: 404,
      code: 'NOT_FOUND',
      title: 'Konten Tidak Ditemukan',
      message: 'Postingan, video, atau foto tidak ditemukan. Kemungkinan besar konten telah dihapus oleh pemiliknya atau URL salah.',
      retryable: false,
      detail: cleanStderr || 'Resource not found (404).'
    };
  }

  // 7. Rate Limit, Captcha, or Bot Block
  if (
    lower.includes('rate limit') ||
    lower.includes('429') ||
    lower.includes('too many requests') ||
    lower.includes('bot detection') ||
    lower.includes('captcha') ||
    lower.includes('sign in to confirm you’re not a bot') ||
    lower.includes('sign in to confirm your age') ||
    lower.includes('challenge_required')
  ) {
    return {
      status: 429,
      code: 'RATE_LIMITED',
      title: 'Permintaan Dibatasi Platform',
      message: 'Platform sosial media mendeteksi lonjakan permintaan (Rate Limit) atau verifikasi bot. Silakan tunggu 1-2 menit lalu klik Coba Lagi.',
      retryable: true,
      detail: cleanStderr || 'Rate limit or captcha required.'
    };
  }

  // 8. Network Timeout / Connection Interrupted
  if (
    lower.includes('etimedout') ||
    lower.includes('connection reset') ||
    lower.includes('econnrefused') ||
    lower.includes('socket hang up') ||
    lower.includes('timeout')
  ) {
    return {
      status: 504,
      code: 'NETWORK_TIMEOUT',
      title: 'Koneksi Server Terputus',
      message: 'Waktu koneksi ke platform sosial media habis. Server tidak menerima respon dalam waktu yang ditentukan.',
      retryable: true,
      detail: cleanStderr || 'Network timeout.'
    };
  }

  // 9. Invalid URL or Unsupported Platform
  if (
    lower.includes('unsupported url') ||
    lower.includes('is not a valid url') ||
    lower.includes('no video formats found')
  ) {
    return {
      status: 422,
      code: 'UNSUPPORTED_URL',
      title: 'Tautan Tidak Didukung / Format Kosong',
      message: 'Tautan tidak dikenali atau platform belum menyediakan format media yang dapat diunduh.',
      retryable: false,
      detail: cleanStderr || 'Unsupported URL.'
    };
  }

  // Default Fallback: show the actual clean stderr instead of generic exit code
  return {
    status: 500,
    code: 'EXTRACTION_ERROR',
    title: 'Gagal Memproses Konten',
    message: cleanStderr ? `Platform error: ${cleanStderr}` : 'Terjadi kesalahan saat memproses tautan media.',
    retryable: true,
    detail: cleanStderr || messageText
  };
}

module.exports = {
  categorizeError,
  extractCleanStderr
};
