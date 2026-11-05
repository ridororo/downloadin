const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const apiRoutes = require('./routes/api');
const extractor = require('./services/extractor');

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

// Ensure temp directory exists
const tempDir = process.env.TEMP_DIR || path.resolve(process.cwd(), 'temp');
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

// Global middlewares
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// In-memory simple rate limiting for extraction to prevent platform IP bans
const rateLimits = new Map();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 30;

app.use('/api/extract', (req, res, next) => {
  const ip = req.ip || req.connection.remoteAddress || '127.0.0.1';
  const now = Date.now();

  const record = rateLimits.get(ip) || { count: 0, resetAt: now + RATE_LIMIT_WINDOW_MS };

  if (now > record.resetAt) {
    record.count = 1;
    record.resetAt = now + RATE_LIMIT_WINDOW_MS;
  } else {
    record.count++;
  }

  rateLimits.set(ip, record);

  if (record.count > MAX_REQUESTS_PER_WINDOW) {
    return res.status(429).json({
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        title: 'Batas Permintaan Terlampaui',
        message: 'Anda telah mencapai batas 30 permintaan per menit. Silakan tunggu beberapa detik.',
        retryable: true
      }
    });
  }

  next();
});

// Mount API routes
app.use('/api', apiRoutes);

// Serve static frontend files from 'public'
app.use(express.static(path.join(__dirname, '..', 'public')));

// SPA Fallback: send index.html for unmatched routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// Start Express Server
app.listen(PORT, HOST, async () => {
  console.log('====================================================');
  console.log('   🚀 DownloadIn - All-in-One Social Downloader   ');
  console.log('====================================================');
  console.log(`📡 Server berjalan di: http://localhost:${PORT}`);
  console.log(`🌐 Jaringan Lokal: http://${HOST}:${PORT}`);
  console.log(`📁 Static files: ${path.join(__dirname, '..', 'public')}`);

  try {
    const runner = await extractor.findYtDlp();
    console.log(`⚡ Ekstraktor Aktif: ${runner.cmd} ${runner.args.join(' ')}`);
  } catch (e) {
    console.warn(`⚠️ Ekstraktor yt-dlp belum terdeteksi. Letakkan yt-dlp.exe di folder bin/.`);
  }

  console.log('🔒 Mode Akses: Konten Publik (Tanpa Login & Tanpa Cookies)');
  console.log('====================================================');
});

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Menghentikan server DownloadIn...');
  process.exit(0);
});

