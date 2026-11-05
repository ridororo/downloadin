const express = require('express');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const router = express.Router();

const { validateInput } = require('../services/validator');
const extractor = require('../services/extractor');
const { streamZipArchive } = require('../services/archiver');
const { safeFilename } = require('../utils/helpers');

/**
 * GET /api/health
 * System diagnostics, yt-dlp & ffmpeg check, public mode status
 */
router.get('/health', async (req, res) => {
  try {
    const runner = await extractor.findYtDlp();
    const ffmpegPath = extractor.findFfmpeg();

    res.json({
      status: 'ok',
      service: 'DownloadIn API',
      version: '1.2.0',
      mode: 'public_no_login',
      note: 'Dikhususkan untuk konten publik tanpa login atau cookies.',
      extractor: {
        command: runner.cmd,
        args: runner.args,
        available: true
      },
      ffmpeg: {
        available: !!ffmpegPath,
        path: ffmpegPath || 'Not found (menggunakan pre-muxed format fallback)'
      },
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    res.status(500).json({
      status: 'degraded',
      error: err.message,
      extractorAvailable: false
    });
  }
});

/**
 * POST /api/extract
 * Extracts metadata and format options from social media URL
 */
router.post('/extract', async (req, res) => {
  const { url, platform, forceIgnoreMismatch } = req.body;

  // 1. Validation
  const validation = validateInput(url, platform);
  if (!validation.valid) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_INPUT',
        title: 'Tautan Tidak Valid',
        message: validation.error
      }
    });
  }

  // 2. Mismatch warning (unless user confirmed switch or auto-detect is used)
  if (validation.mismatch && !forceIgnoreMismatch) {
    return res.status(409).json({
      success: false,
      mismatch: true,
      detectedPlatform: validation.detectedPlatform,
      detectedName: validation.detectedName,
      selectedPlatform: platform,
      message: validation.mismatchMessage,
      action: 'SWITCH_PLATFORM_PROMPT'
    });
  }

  // 3. Extraction via yt-dlp
  try {
    const metadata = await extractor.extractInfo(url);
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const encodedSourceUrl = encodeURIComponent(metadata.sourceUrl);
    const encodedTitle = encodeURIComponent(metadata.title);

    // Build backend download URLs with distinct HD/SD quality parameters
    // If format has cdnUrl (from scraper), route through /api/proxy-download for instant streaming
    // If format is DASH from yt-dlp, route through /api/download-file for FFmpeg merging
    if (metadata.downloads.videos) {
      metadata.downloads.videos = metadata.downloads.videos.map((v) => {
        let dlUrl = '';
        if (v.cdnUrl) {
          const fn = encodeURIComponent(`${safeFilename(metadata.title || 'DownloadIn_Video', 'DownloadIn_Video', 55)}.mp4`);
          dlUrl = `${baseUrl}/api/proxy-download?url=${encodeURIComponent(v.cdnUrl)}&filename=${fn}&type=video`;
        } else {
          dlUrl = `${baseUrl}/api/download-file?sourceUrl=${encodedSourceUrl}&type=video&quality=${v.qualityKey || 'hd'}&height=${v.height || ''}&ext=mp4&title=${encodedTitle}`;
        }
        return {
          ...v,
          downloadUrl: dlUrl
        };
      });
    }

    if (metadata.downloads.audios) {
      metadata.downloads.audios = metadata.downloads.audios.map((a) => {
        let dlUrl = '';
        if (a.cdnUrl) {
          const fn = encodeURIComponent(`${safeFilename(metadata.title || 'DownloadIn_Audio', 'DownloadIn_Audio', 55)}.${a.ext || 'mp3'}`);
          dlUrl = `${baseUrl}/api/proxy-download?url=${encodeURIComponent(a.cdnUrl)}&filename=${fn}&type=audio`;
        } else {
          dlUrl = `${baseUrl}/api/download-file?sourceUrl=${encodedSourceUrl}&type=audio&ext=${a.ext || 'mp3'}&title=${encodedTitle}`;
        }
        return {
          ...a,
          downloadUrl: dlUrl
        };
      });
    }

    if (metadata.downloads.images) {
      const referer = encodeURIComponent(extractor.getPlatformReferer(metadata.sourceUrl));
      metadata.downloads.images = metadata.downloads.images.map((img) => {
        let dlUrl = '';
        const fn = encodeURIComponent(`${safeFilename(metadata.title || 'DownloadIn_Photo', 'DownloadIn_Photo', 50)}_${img.index}.jpg`);
        if (img.cdnUrl) {
          dlUrl = `${baseUrl}/api/proxy-download?url=${encodeURIComponent(img.cdnUrl)}&filename=${fn}&type=image`;
        } else {
          dlUrl = `${baseUrl}/api/download?url=${encodeURIComponent(img.url)}&title=${encodeURIComponent(
            `${metadata.title}_${img.index}`
          )}&ext=jpg&type=image&referer=${referer}`;
        }
        return {
          ...img,
          downloadUrl: dlUrl
        };
      });
    }

    if (metadata.downloads.stories && metadata.downloads.stories.length > 0) {
      metadata.downloads.stories = metadata.downloads.stories.map((item) => {
        const ext = item.type === 'photo' ? 'jpg' : 'mp4';
        const fn = encodeURIComponent(
          `${safeFilename(metadata.title || 'DownloadIn_Story', 'DownloadIn_Story', 50)}_item_${item.index}.${ext}`
        );
        return {
          ...item,
          downloadUrl: `${baseUrl}/api/proxy-download?url=${encodeURIComponent(item.cdnUrl || item.url)}&filename=${fn}&type=${item.type}`
        };
      });
    }

    return res.json({
      success: true,
      data: metadata
    });
  } catch (err) {
    if (err.code === 'PRIVATE_OR_RESTRICTED' || err.errorType === 'PRIVATE_OR_RESTRICTED' || err.status === 403) {
      return res.status(403).json({
        success: false,
        errorType: 'PRIVATE_OR_RESTRICTED',
        message: 'Tidak dapat mengunduh konten ini karena berasal dari Akun Private, Story yang dibatasi, atau tautan sudah tidak tersedia. Pastikan akun dan postingan bersifat Publik.',
        error: {
          code: 'PRIVATE_OR_RESTRICTED',
          title: 'Konten Privat atau Dibatasi',
          message: 'Tidak dapat mengunduh konten ini karena berasal dari Akun Private, Story yang dibatasi, atau tautan sudah tidak tersedia. Pastikan akun dan postingan bersifat Publik.',
          retryable: false
        }
      });
    }

    const statusCode = err.status || 500;
    return res.status(statusCode).json({
      success: false,
      error: {
        code: err.code || 'EXTRACTION_FAILED',
        title: err.title || 'Gagal Mengambil Konten',
        message: err.message || 'Terjadi gangguan saat mengambil data media.',
        retryable: err.retryable !== false,
        detail: err.detail || null
      }
    });
  }
});

/**
 * GET /api/download-file
 * Core backend download engine:
 * 1. Downloads file in temp/ using yt-dlp with absolute FFmpeg (No login / cookies needed).
 * 2. Enforces HD vs SD differentiation:
 *    - HD: -f "bestvideo+bestaudio/best" -S "res:1080,fps,vcodec:h264,br" --merge-output-format mp4
 *    - SD: -f "bestvideo[height<=540]+bestaudio/best[height<=540]/worst" -S "vcodec:h264,acodec:m4a" --merge-output-format mp4
 * 3. Always forces MP4 extension for video.
 * 4. Sanitizes filename (max 55 chars, Windows safe).
 * 5. Streams to user and automatically cleans up temp file on completion.
 */
router.get('/download-file', async (req, res) => {
  const { sourceUrl, type = 'video', quality = 'hd', height, ext = 'mp4', title } = req.query;

  if (!sourceUrl) {
    return res.status(400).send('Parameter sourceUrl wajib disertakan.');
  }

  const isAudio = type === 'audio' || type === 'music';
  const targetExt = isAudio ? 'mp3' : 'mp4'; // Always enforce mp4 for video, mp3 for audio!

  let cleanTitle = (title ? decodeURIComponent(title) : 'DownloadIn_Media')
    .replace(/[^\w\s.-]/gi, '_')
    .replace(/\s+/g, '_')
    .slice(0, 50)
    .trim()
    .replace(/^[._]+|[._]+$/g, '');

  if (!cleanTitle) cleanTitle = 'DownloadIn_Media';
  if (cleanTitle.toLowerCase().endsWith(`.${targetExt}`)) {
    cleanTitle = cleanTitle.slice(0, -(targetExt.length + 1));
  }

  let downloadResult = null;

  try {
    downloadResult = await extractor.downloadMediaFile({
      sourceUrl: decodeURIComponent(sourceUrl),
      type,
      quality: quality || 'hd',
      height: height ? parseInt(height, 10) : null,
      ext: targetExt,
      title: cleanTitle
    });

    const { filePath } = downloadResult;
    const finalFilename = `${cleanTitle}.${targetExt}`;

    // Stream file with Content-Disposition attachment and auto-cleanup callback
    res.download(filePath, finalFilename, (err) => {
      if (err) {
        console.warn('Download transfer finished or aborted by client:', err.message);
      }
      if (downloadResult && typeof downloadResult.cleanup === 'function') {
        downloadResult.cleanup();
        downloadResult = null;
      }
    });
  } catch (err) {
    console.error('Download-file backend error:', err);
    if (downloadResult && typeof downloadResult.cleanup === 'function') {
      downloadResult.cleanup();
    }
    if (!res.headersSent) {
      const errMsg = err.message || err.detail || 'Gagal memproses file media untuk diunduh.';
      res.status(err.status || 500).send(`Error: ${errMsg}`);
    }
  }
});

/**
 * GET /api/proxy-download
 * Streaming proxy for CDN media URLs (Instagram scontent-*.cdninstagram.com, TikTok CDN, Facebook CDN)
 * Streams media directly to client with Content-Disposition: attachment without saving to disk.
 */
router.get('/proxy-download', async (req, res) => {
  const { url, filename, type = 'video', referer } = req.query;

  if (!url) {
    return res.status(400).send('Parameter URL unduhan wajib disertakan.');
  }

  const decodedUrl = decodeURIComponent(url);

  // 1. Determine guaranteed extension and Content-Type strictly by type
  const isAudio = type === 'audio' || type === 'music';
  const isImage = type === 'image' || type === 'photo';
  const ext = isAudio ? '.mp3' : (isImage ? '.jpg' : '.mp4');
  const contentType = isAudio ? 'audio/mpeg' : (isImage ? 'image/jpeg' : 'video/mp4');

  // 2. Clean filename and force append extension if missing
  let cleanName = (filename ? decodeURIComponent(filename) : 'DownloadIn_Media')
    .replace(/[^\w\s.-]/gi, '_')
    .replace(/\s+/g, '_')
    .replace(/\.(html?|php|txt|htm)$/i, '')
    .slice(0, 50)
    .trim()
    .replace(/^[._]+|[._]+$/g, '');

  if (!cleanName) cleanName = 'DownloadIn_Media';

  // Force append target extension if not ending with it
  if (!cleanName.toLowerCase().endsWith(ext)) {
    cleanName = cleanName.replace(new RegExp(`_${ext.slice(1)}$`, 'i'), '');
    cleanName += ext;
  }

  // 3. Automatic platform referer detection to satisfy Anti-Hotlinking
  let defaultReferer = 'https://www.google.com/';
  if (/instagram\.com|cdninstagram\.com/i.test(decodedUrl)) {
    defaultReferer = 'https://www.instagram.com/';
  } else if (/tiktok\.com|tikwm\.com|byteoversea\.com/i.test(decodedUrl)) {
    defaultReferer = 'https://www.tiktok.com/';
  } else if (/facebook\.com|fbcdn\.net/i.test(decodedUrl)) {
    defaultReferer = 'https://www.facebook.com/';
  }

  const targetReferer = referer ? decodeURIComponent(referer) : defaultReferer;

  const headers = {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
    'Referer': targetReferer,
    'Accept': '*/*'
  };

  try {
    const remoteResponse = await axios({
      method: 'get',
      url: decodedUrl,
      responseType: 'stream',
      timeout: 60000,
      headers
    });

    res.setHeader('Content-Disposition', `attachment; filename="${cleanName}"`);
    res.setHeader('Content-Type', contentType);

    if (remoteResponse.headers['content-length']) {
      res.setHeader('Content-Length', remoteResponse.headers['content-length']);
    }

    remoteResponse.data.pipe(res);
  } catch (err) {
    console.error('[proxy-download] stream error:', err.message);
    if (!res.headersSent) {
      res.status(502).send(`Gagal mengunduh file media dari CDN: ${err.message}`);
    }
  }
});

/**
 * GET /api/download
 * Streaming proxy for images & direct slides with proper Anti-Hotlinking Referer headers
 */
router.get('/download', async (req, res) => {
  const { url, title, filename, ext: requestedExt, type = 'image', referer } = req.query;

  if (!url) {
    return res.status(400).send('Parameter URL unduhan wajib disertakan.');
  }

  const isAudio = type === 'audio' || type === 'music';
  const isImage = type === 'image' || type === 'photo';
  const ext = isAudio ? '.mp3' : (isImage ? '.jpg' : '.mp4');
  const contentType = isAudio ? 'audio/mpeg' : (isImage ? 'image/jpeg' : 'video/mp4');

  const rawName = filename || title || 'DownloadIn_Photo';
  let cleanName = decodeURIComponent(rawName)
    .replace(/[^\w\s.-]/gi, '_')
    .replace(/\s+/g, '_')
    .replace(/\.(html?|php|txt|htm)$/i, '')
    .slice(0, 50)
    .trim()
    .replace(/^[._]+|[._]+$/g, '');

  if (!cleanName) cleanName = 'DownloadIn_Photo';

  if (!cleanName.toLowerCase().endsWith(ext)) {
    cleanName = cleanName.replace(new RegExp(`_${ext.slice(1)}$`, 'i'), '');
    cleanName += ext;
  }

  const headers = {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'
  };

  if (referer) {
    headers['Referer'] = decodeURIComponent(referer);
  }

  try {
    const remoteResponse = await axios({
      method: 'get',
      url: decodeURIComponent(url),
      responseType: 'stream',
      timeout: 30000,
      headers
    });

    res.setHeader('Content-Disposition', `attachment; filename="${cleanName}"`);
    res.setHeader('Content-Type', contentType);

    if (remoteResponse.headers['content-length']) {
      res.setHeader('Content-Length', remoteResponse.headers['content-length']);
    }

    remoteResponse.data.pipe(res);
  } catch (err) {
    console.error('Download stream proxy error:', err.message);
    if (!res.headersSent) {
      res.status(502).send(`Gagal mengunduh file media: ${err.message}`);
    }
  }
});

/**
 * POST /api/download-zip
 * Zip archive generator for carousel / slide photos
 */
router.post('/download-zip', async (req, res) => {
  const { items, title = 'DownloadIn_Carousel' } = req.body;

  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Daftar gambar tidak boleh kosong.' });
  }

  const cleanTitle = safeFilename(title, 'DownloadIn_Photos', 50);

  try {
    await streamZipArchive(items, cleanTitle, res);
  } catch (err) {
    console.error('ZIP generation error:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Gagal membuat arsip ZIP.' });
    }
  }
});

module.exports = router;
