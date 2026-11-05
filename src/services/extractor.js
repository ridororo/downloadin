const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { formatBytes, formatDuration, safeFilename } = require('../utils/helpers');
const { categorizeError } = require('../utils/errorHandler');
const { detectPlatform } = require('./validator');
const scraper = require('./scraper');

class ExtractorService {
  constructor() {
    this.cachedCommand = null;
    this.cachedFfmpeg = undefined;
    this.tempDir = process.env.TEMP_DIR || path.resolve(process.cwd(), 'temp');

    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
  }

  /**
   * Find available yt-dlp runner
   */
  async findYtDlp() {
    if (this.cachedCommand) {
      return this.cachedCommand;
    }

    // 1. Env path
    if (process.env.YT_DLP_PATH && fs.existsSync(process.env.YT_DLP_PATH)) {
      this.cachedCommand = { cmd: process.env.YT_DLP_PATH, args: [] };
      return this.cachedCommand;
    }

    // 2. Local ./bin/
    const localBinWin = path.resolve(process.cwd(), 'bin', 'yt-dlp.exe');
    const localBinUnix = path.resolve(process.cwd(), 'bin', 'yt-dlp');
    if (fs.existsSync(localBinWin)) {
      this.cachedCommand = { cmd: localBinWin, args: [] };
      return this.cachedCommand;
    }
    if (fs.existsSync(localBinUnix)) {
      this.cachedCommand = { cmd: localBinUnix, args: [] };
      return this.cachedCommand;
    }

    // 3. System yt-dlp in PATH
    try {
      execSync('yt-dlp --version', { stdio: 'pipe' });
      this.cachedCommand = { cmd: 'yt-dlp', args: [] };
      return this.cachedCommand;
    } catch (e) {
      // not in PATH
    }

    // 4. python -m yt_dlp
    try {
      execSync('python -m yt_dlp --version', { stdio: 'pipe' });
      this.cachedCommand = { cmd: 'python', args: ['-m', 'yt_dlp'] };
      return this.cachedCommand;
    } catch (e) {
      // not in python
    }

    return { cmd: 'yt-dlp', args: [] };
  }

  /**
   * Check if FFmpeg binary exists (Required for YouTube merging & MP3 320k)
   * Resolves absolute binary path
   */
  findFfmpeg() {
    if (this.cachedFfmpeg !== undefined) {
      return this.cachedFfmpeg;
    }

    // 1. Env path
    if (process.env.FFMPEG_PATH && fs.existsSync(process.env.FFMPEG_PATH)) {
      this.cachedFfmpeg = path.resolve(process.env.FFMPEG_PATH);
      return this.cachedFfmpeg;
    }

    // 2. ffmpeg-static npm module (Preferred in Node.js)
    try {
      const ffmpegStatic = require('ffmpeg-static');
      if (ffmpegStatic && fs.existsSync(ffmpegStatic)) {
        this.cachedFfmpeg = path.resolve(ffmpegStatic);
        return this.cachedFfmpeg;
      }
    } catch (e) {
      // ffmpeg-static not available
    }

    // 3. Local ./bin/ffmpeg.exe or ./bin/ffmpeg
    const localFfmpegWin = path.resolve(process.cwd(), 'bin', 'ffmpeg.exe');
    const localFfmpegUnix = path.resolve(process.cwd(), 'bin', 'ffmpeg');
    if (fs.existsSync(localFfmpegWin)) {
      this.cachedFfmpeg = localFfmpegWin;
      return this.cachedFfmpeg;
    }
    if (fs.existsSync(localFfmpegUnix)) {
      this.cachedFfmpeg = localFfmpegUnix;
      return this.cachedFfmpeg;
    }

    // 4. Check system PATH
    try {
      execSync('ffmpeg -version', { stdio: 'pipe' });
      this.cachedFfmpeg = 'ffmpeg';
      return this.cachedFfmpeg;
    } catch (e) {
      // not in PATH
    }

    this.cachedFfmpeg = null;
    return null;
  }

  /**
   * Get proper Referer header for platform anti-hotlinking
   */
  getPlatformReferer(url) {
    if (/tiktok\.com/i.test(url)) return 'https://www.tiktok.com/';
    if (/instagram\.com/i.test(url)) return 'https://www.instagram.com/';
    if (/facebook\.com|fb\.watch/i.test(url)) return 'https://www.facebook.com/';
    if (/twitter\.com|x\.com/i.test(url)) return 'https://twitter.com/';
    if (/youtube\.com|youtu\.be/i.test(url)) return 'https://www.youtube.com/';
    return 'https://www.google.com/';
  }

  /**
   * Execute yt-dlp with arguments and robust error/stderr capture
   */
  async runCommand(args) {
    const runner = await this.findYtDlp();
    const finalArgs = [...runner.args, ...args];

    return new Promise((resolve, reject) => {
      const child = spawn(runner.cmd, finalArgs, {
        windowsHide: true,
        maxBuffer: 60 * 1024 * 1024
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (chunk) => {
        stdout += chunk.toString();
      });

      child.stderr.on('data', (chunk) => {
        stderr += chunk.toString();
      });

      child.on('error', (err) => {
        console.error('[yt-dlp spawn error]:', err.message);
        reject(err);
      });

      child.on('close', (code) => {
        if (code === 0) {
          resolve(stdout);
        } else {
          console.error('====================================================');
          console.error(`❌ [yt-dlp process exited with code ${code}]`);
          if (stderr.trim()) console.error('[yt-dlp stderr]:', stderr.trim());
          console.error('====================================================');

          const error = new Error(`yt-dlp exited with code ${code}`);
          error.stderr = stderr;
          error.stdout = stdout;
          error.exitCode = code;
          reject(error);
        }
      });
    });
  }

  /**
   * Extract metadata and download formats from target URL
   * Hybrid Architecture:
   * 1. TikTok: Uses dedicated TikWM scraper (Instant HD/SD/MP3, No Watermark, No Login).
   * 2. Instagram: Uses SnapVideo/Public scraper (Zero cookies needed for Reels/Posts/Stories).
   * 3. Facebook: Uses specialized scraper (HD/SD MP4 with audio).
   * 4. Fallback & YouTube/X: yt-dlp + ffmpeg-static merging.
   */
  async extractInfo(targetUrl, options = {}) {
    const platformInfo = detectPlatform(targetUrl);

    // 1. TikTok Handler (TikWM Engine)
    if (platformInfo.id === 'tiktok') {
      try {
        const scraped = await scraper.scrapeTikTok(targetUrl);
        if (
          scraped &&
          ((scraped.downloads.videos && scraped.downloads.videos.length > 0) ||
            (scraped.downloads.images && scraped.downloads.images.length > 0))
        ) {
          return scraped;
        }
      } catch (err) {
        console.warn('[extractor] TikTok scraper error, falling back to yt-dlp:', err.message);
      }
    }

    // 2. Instagram Handler (SnapVideo / Scraper Engine - Zero cookies needed)
    if (platformInfo.id === 'instagram' || platformInfo.isStory) {
      try {
        const scraped = await scraper.scrapeInstagram(targetUrl);
        if (
          scraped &&
          ((scraped.downloads.videos && scraped.downloads.videos.length > 0) ||
            (scraped.downloads.images && scraped.downloads.images.length > 0) ||
            (scraped.downloads.stories && scraped.downloads.stories.length > 0))
        ) {
          return scraped;
        }
      } catch (err) {
        console.warn('[extractor] Instagram scraper error, falling back to yt-dlp:', err.message);
      }
    }

    // 3. Facebook Handler (Dedicated Scraper Engine)
    if (platformInfo.id === 'facebook') {
      try {
        const scraped = await scraper.scrapeFacebook(targetUrl);
        if (scraped && scraped.downloads.videos && scraped.downloads.videos.length > 0) {
          return scraped;
        }
      } catch (err) {
        console.warn('[extractor] Facebook scraper error, falling back to yt-dlp:', err.message);
      }
    }

    // 4. yt-dlp Core Engine (YouTube, X/Twitter, and General Fallback)
    const referer = this.getPlatformReferer(targetUrl);
    const ffmpegPath = this.findFfmpeg();

    const args = [
      '--dump-single-json',
      '--no-warnings',
      '--no-check-certificates',
      '--prefer-free-formats',
      '--socket-timeout', '20',
      '-S', 'vcodec:h264,res,acodec:m4a',
      '--referer', referer,
      '--user-agent',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'
    ];

    // Mandatory: inject ffmpeg location
    if (ffmpegPath) {
      args.unshift('--ffmpeg-location', ffmpegPath);
    }

    // For playlists / carousels: flat playlist for preview speed
    if (!platformInfo.isStory) {
      args.push('--no-playlist');
    }

    args.push(targetUrl);

    let rawJsonStr = '';
    try {
      rawJsonStr = await this.runCommand(args);
    } catch (err) {
      const categorized = categorizeError(err);
      throw categorized;
    }

    let data;
    try {
      data = JSON.parse(rawJsonStr);
    } catch (err) {
      throw {
        status: 500,
        code: 'PARSE_ERROR',
        title: 'Gagal Membaca Metadata',
        message: 'Respon dari ekstraktor tidak dapat diuraikan.',
        retryable: true,
        detail: err.message
      };
    }

    const normalized = this.normalizeMetadata(data, platformInfo, targetUrl);

    // If scraper/yt-dlp returned empty downloads on Instagram, Facebook, or Story
    const hasMedia =
      (normalized.downloads.videos && normalized.downloads.videos.length > 0) ||
      (normalized.downloads.images && normalized.downloads.images.length > 0) ||
      (normalized.downloads.stories && normalized.downloads.stories.length > 0) ||
      (normalized.downloads.audios && normalized.downloads.audios.length > 0);

    if (!hasMedia && (platformInfo.isStory || platformInfo.id === 'instagram' || platformInfo.id === 'facebook')) {
      throw {
        status: 403,
        code: 'PRIVATE_OR_RESTRICTED',
        errorType: 'PRIVATE_OR_RESTRICTED',
        title: 'Konten Privat atau Dibatasi',
        message: 'Tidak dapat mengunduh konten ini karena berasal dari Akun Private, Story yang dibatasi, atau tautan sudah tidak tersedia. Pastikan akun dan postingan bersifat Publik.',
        retryable: false
      };
    }

    return normalized;
  }

  /**
   * Normalize metadata and format outputs for the UI
   */
  normalizeMetadata(info, platformInfo, sourceUrl) {
    const title = info.title || info.description?.substring(0, 80) || 'DownloadIn Media';
    const description = info.description || '';
    const uploader = info.uploader || info.channel || info.creator || info.uploader_id || 'Pengguna';
    const uploaderId = info.uploader_id || '';
    const duration = info.duration || 0;
    const durationFormatted = formatDuration(duration);
    const thumbnail = this.findBestThumbnail(info);
    const viewCount = info.view_count || null;
    const likeCount = info.like_count || null;
    const isStory = platformInfo?.isStory || (info.webpage_url && /stories/i.test(info.webpage_url));

    const images = this.extractImages(info);
    const hasImages = images.length > 0;
    const videos = this.extractVideoFormats(info);
    const audios = this.extractAudioFormats(info);

    let contentType = 'video';
    if (hasImages && (!videos || videos.length === 0 || duration === 0)) {
      contentType = images.length > 1 ? 'carousel' : 'photo';
    } else if (hasImages && videos.length > 0) {
      contentType = 'video';
    } else if (!videos.length && audios.length > 0) {
      contentType = 'audio_only';
    }

    return {
      id: info.id || String(Date.now()),
      title,
      description,
      uploader,
      uploaderId,
      thumbnail,
      duration,
      durationFormatted,
      viewCount,
      likeCount,
      platform: platformInfo?.id || 'other',
      platformName: platformInfo?.name || 'Platform Terdeteksi',
      isStory,
      contentType,
      downloads: {
        videos,
        audios,
        images,
        stories: []
      },
      sourceUrl
    };
  }

  /**
   * Extract video qualities providing clear HD (1080p+) and SD (480p) options
   */
  extractVideoFormats(info) {
    const organized = [];

    // 1. HD Option (1080p+ / Kualitas Tertinggi)
    organized.push({
      formatId: 'video-hd',
      qualityKey: 'hd',
      quality: 'Video HD (1080p / Kualitas Terbaik)',
      resolution: '1080p / Full HD',
      height: 1080,
      fps: 60,
      ext: 'mp4',
      vcodec: 'H.264 (avc1)',
      filesizeFormatted: 'Kualitas Maksimal',
      isBest: true,
      badge: 'HD 1080p',
      hasAudio: true,
      noWatermark: true
    });

    // 2. SD Option (480p / Hemat Kuota)
    organized.push({
      formatId: 'video-sd',
      qualityKey: 'sd',
      quality: 'Video SD (480p / Hemat Kuota)',
      resolution: '480p / SD',
      height: 480,
      fps: 30,
      ext: 'mp4',
      vcodec: 'H.264',
      filesizeFormatted: 'Hemat Kuota',
      isBest: false,
      badge: 'SD 480p',
      hasAudio: true,
      noWatermark: true
    });

    return organized;
  }

  /**
   * Extract audio formats (MP3 / M4A)
   */
  extractAudioFormats(info) {
    return [
      {
        formatId: 'audio-mp3-320',
        qualityKey: 'mp3',
        quality: 'MP3 Audio (Kualitas Tinggi 320kbps)',
        ext: 'mp3',
        bitrate: '320kbps',
        filesizeFormatted: 'Kualitas Tinggi',
        isBest: true
      },
      {
        formatId: 'audio-m4a',
        qualityKey: 'm4a',
        quality: 'M4A / AAC Audio Original',
        ext: 'm4a',
        bitrate: '160kbps',
        filesizeFormatted: 'Audio Asli',
        isBest: false
      }
    ];
  }

  /**
   * Extract image items for photo posts, TikTok slides, or Instagram carousels
   */
  extractImages(info) {
    const images = [];

    if (info.entries && Array.isArray(info.entries)) {
      info.entries.forEach((entry, idx) => {
        const imgUrl = entry.url || this.findBestThumbnail(entry);
        if (imgUrl) {
          images.push({
            id: `photo-${idx + 1}`,
            index: idx + 1,
            url: imgUrl,
            width: entry.width || 1080,
            height: entry.height || 1080,
            title: entry.title || `Foto ${idx + 1}`
          });
        }
      });
      if (images.length > 0) return images;
    }

    if (info.formats && Array.isArray(info.formats)) {
      const photoFormats = info.formats.filter(
        (f) =>
          f.url &&
          (f.ext === 'jpg' ||
            f.ext === 'jpeg' ||
            f.ext === 'png' ||
            f.ext === 'webp' ||
            (f.format_note && f.format_note.toLowerCase().includes('image')))
      );

      if (photoFormats.length > 0) {
        photoFormats.forEach((pf, idx) => {
          images.push({
            id: `photo-${idx + 1}`,
            index: idx + 1,
            url: pf.url,
            width: pf.width || 1080,
            height: pf.height || 1080,
            title: `Slide Foto ${idx + 1}`
          });
        });
        return images;
      }
    }

    if (info.ext === 'jpg' || info.ext === 'jpeg' || info.ext === 'png' || info.ext === 'webp') {
      if (info.url) {
        images.push({
          id: 'photo-1',
          index: 1,
          url: info.url,
          width: info.width || 1080,
          height: info.height || 1080,
          title: info.title || 'Foto Resolusi Penuh'
        });
      }
    }

    return images;
  }

  /**
   * Find highest quality thumbnail
   */
  findBestThumbnail(info) {
    if (info.thumbnail) return info.thumbnail;

    if (info.thumbnails && Array.isArray(info.thumbnails) && info.thumbnails.length > 0) {
      const sorted = [...info.thumbnails].sort((a, b) => {
        const resA = (a.width || 0) * (a.height || 0) || a.preference || 0;
        const resB = (b.width || 0) * (b.height || 0) || b.preference || 0;
        return resB - resA;
      });
      return sorted[0].url;
    }

    return 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=600&q=80';
  }

  /**
   * BACKEND DOWNLOAD ENGINE (PUBLIC / NO LOGIN)
   * - Mandatory --ffmpeg-location passing.
   * - Distinct HD vs SD format arguments:
   *   - HD: -f "bestvideo+bestaudio/best" -S "res:1080,fps,vcodec:h264,br" --merge-output-format mp4 --remux-video mp4
   *   - SD: -f "bestvideo[height<=540]+bestaudio/best[height<=540]/worst" -S "vcodec:h264,acodec:m4a" --merge-output-format mp4 --remux-video mp4
   * - Always forces .mp4 container for videos.
   */
  async downloadMediaFile({ sourceUrl, type = 'video', quality = 'hd', height = null, ext = 'mp4', title = 'DownloadIn_Media' }) {
    const fileId = `download_${Date.now()}_${Math.floor(Math.random() * 1000000)}`;
    const outputTemplate = path.join(this.tempDir, `${fileId}.%(ext)s`);
    const referer = this.getPlatformReferer(sourceUrl);
    const ffmpegPath = this.findFfmpeg();

    const args = [
      '--no-warnings',
      '--no-check-certificates',
      '--no-playlist',
      '--no-part',
      '--no-mtime',
      '--force-overwrites',
      '--socket-timeout', '30',
      '--referer', referer,
      '--user-agent',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
    ];

    // Mandatory: FFmpeg location flag
    if (ffmpegPath) {
      args.push('--ffmpeg-location', ffmpegPath);
    }

    if (type === 'audio') {
      if (ext === 'mp3' && ffmpegPath) {
        // High quality MP3 transcode
        args.push('-x', '--audio-format', 'mp3', '--audio-quality', '0');
      } else {
        // Direct audio extraction
        args.push('-f', 'bestaudio/best');
        args.push('-S', 'acodec:m4a,abr');
      }
    } else {
      // VIDEO: Differentiate HD vs SD
      const isSd = quality === 'sd' || (height && Number(height) <= 540);

      if (isSd) {
        // SD Format: Limit to max 540p/480p to save mobile data
        args.push(
          '-f', 'bestvideo[height<=540]+bestaudio/best[height<=540]/worst',
          '-S', 'vcodec:h264,acodec:m4a',
          '--merge-output-format', 'mp4',
          '--remux-video', 'mp4'
        );
      } else {
        // HD Format: 1080p+ highest bitrate & fps, H.264
        args.push(
          '-f', 'bestvideo+bestaudio/best',
          '-S', 'res:1080,fps,vcodec:h264,br',
          '--merge-output-format', 'mp4',
          '--remux-video', 'mp4'
        );
      }
    }

    args.push('-o', outputTemplate, sourceUrl);

    try {
      await this.runCommand(args);
    } catch (err) {
      const categorized = categorizeError(err);
      throw categorized;
    }

    // Locate the downloaded file in temp/
    const files = fs.readdirSync(this.tempDir);
    const matched = files.find((f) => f.startsWith(fileId));

    if (!matched) {
      throw {
        status: 500,
        code: 'DOWNLOAD_FAILED',
        title: 'File Tidak Ditemukan',
        message: 'File media gagal diunduh atau diproses oleh server.',
        retryable: true
      };
    }

    const downloadedPath = path.join(this.tempDir, matched);
    const stat = fs.statSync(downloadedPath);

    if (stat.size === 0) {
      try { fs.unlinkSync(downloadedPath); } catch (e) {}
      throw {
        status: 500,
        code: 'EMPTY_FILE',
        title: 'File Kosong (0 Byte)',
        message: 'Platform membatasi pengunduhan atau koneksi terputus saat streaming.',
        retryable: true
      };
    }

    let actualExt = path.extname(downloadedPath).replace(/^\./, '').toLowerCase();

    // When user requests video, ensure it's mp4
    if (type === 'video' && actualExt !== 'mp4') {
      actualExt = 'mp4';
    }

    return {
      filePath: downloadedPath,
      ext: actualExt,
      filesize: stat.size,
      cleanup: () => {
        try {
          if (fs.existsSync(downloadedPath)) {
            fs.unlinkSync(downloadedPath);
          }
        } catch (cleanupErr) {
          console.warn('Gagal menghapus file sementara:', cleanupErr.message);
        }
      }
    };
  }
}

module.exports = new ExtractorService();
