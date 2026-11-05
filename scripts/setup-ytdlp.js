const fs = require('fs');
const path = require('path');
const https = require('https');
const { execSync } = require('child_process');

async function checkSystemYtDlp() {
  const localBin = path.resolve(__dirname, '..', 'bin', process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp');
  if (fs.existsSync(localBin)) {
    console.log(`✅ yt-dlp ditemukan di folder lokal bin/ (${localBin})`);
    return true;
  }

  try {
    const version = execSync('yt-dlp --version', { stdio: 'pipe' }).toString().trim();
    console.log(`✅ yt-dlp terpasang di sistem global (Versi: ${version})`);
    return true;
  } catch (e) {
    try {
      const pyVer = execSync('python -m yt_dlp --version', { stdio: 'pipe' }).toString().trim();
      console.log(`✅ yt-dlp terdeteksi melalui Python module (Versi: ${pyVer})`);
      return true;
    } catch (err) {
      return false;
    }
  }
}

async function checkFfmpeg() {
  try {
    const ffmpegStatic = require('ffmpeg-static');
    if (ffmpegStatic && fs.existsSync(ffmpegStatic)) {
      console.log(`✅ FFmpeg terdeteksi via package ffmpeg-static (${ffmpegStatic})`);
      return true;
    }
  } catch (e) {}

  const localFfmpeg = path.resolve(__dirname, '..', 'bin', process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg');
  if (fs.existsSync(localFfmpeg)) {
    console.log(`✅ FFmpeg ditemukan di folder lokal bin/ (${localFfmpeg})`);
    return true;
  }

  try {
    execSync('ffmpeg -version', { stdio: 'pipe' });
    console.log('✅ FFmpeg terdeteksi di sistem (Video+Audio muxing & MP3 320k aktif)');
    return true;
  } catch (e) {
    console.log('ℹ️ FFmpeg belum terpasang.');
    console.log('💡 Saran: Pasang FFmpeg agar video YouTube 1080p+ dapat digabung otomatis dengan audio:');
    if (process.platform === 'win32') {
      console.log('   - Windows Winget: winget install Gyan.FFmpeg');
      console.log('   - Atau unduh ffmpeg.exe dan letakkan di folder ./bin');
    } else {
      console.log('   - Ubuntu/Debian: sudo apt install ffmpeg');
      console.log('   - macOS: brew install ffmpeg');
    }
    return false;
  }
}

function downloadBinary(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);

    const getWithRedirects = (currentUrl) => {
      https
        .get(currentUrl, (response) => {
          if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
            getWithRedirects(response.headers.location);
            return;
          }

          if (response.statusCode !== 200) {
            reject(new Error(`Gagal mengunduh: HTTP Status ${response.statusCode}`));
            return;
          }

          const totalBytes = parseInt(response.headers['content-length'] || '0', 10);
          let downloaded = 0;

          response.on('data', (chunk) => {
            downloaded += chunk.length;
            if (totalBytes > 0) {
              const percent = ((downloaded / totalBytes) * 100).toFixed(1);
              process.stdout.write(`\r📥 Mengunduh yt-dlp: ${percent}% (${(downloaded / 1024 / 1024).toFixed(1)} MB)`);
            } else {
              process.stdout.write(`\r📥 Mengunduh yt-dlp: ${(downloaded / 1024 / 1024).toFixed(1)} MB`);
            }
          });

          response.pipe(file);

          file.on('finish', () => {
            file.close(() => {
              console.log('\n✅ Pengunduhan selesai!');
              resolve();
            });
          });
        })
        .on('error', (err) => {
          fs.unlink(dest, () => {});
          reject(err);
        });
    };

    getWithRedirects(url);
  });
}

async function main() {
  console.log('====================================================');
  console.log('   🔍 Memeriksa Dependensi DownloadIn (yt-dlp & FFmpeg) ');
  console.log('====================================================');

  const ytdlpExists = await checkSystemYtDlp();
  await checkFfmpeg();

  if (ytdlpExists) {
    console.log('\n🎉 Dependensi utama siap! Anda dapat menjalankan: npm start');
    return;
  }

  console.log('\n⚠️ yt-dlp belum terpasang. Menyiapkan binary standalone ke folder ./bin ...');

  const binDir = path.resolve(__dirname, '..', 'bin');
  if (!fs.existsSync(binDir)) {
    fs.mkdirSync(binDir, { recursive: true });
  }

  const isWindows = process.platform === 'win32';
  const binaryName = isWindows ? 'yt-dlp.exe' : 'yt-dlp';
  const targetPath = path.join(binDir, binaryName);
  const downloadUrl = `https://github.com/yt-dlp/yt-dlp/releases/latest/download/${binaryName}`;

  try {
    console.log(`🌐 Sumber: ${downloadUrl}`);
    console.log(`📁 Lokasi tujuan: ${targetPath}`);
    await downloadBinary(downloadUrl, targetPath);

    if (!isWindows) {
      fs.chmodSync(targetPath, 0o755);
    }

    console.log(`\n🎉 Berhasil memasang yt-dlp di ${targetPath}`);
    console.log('👉 Sekarang jalankan: npm start');
  } catch (error) {
    console.error('\n❌ Gagal mengunduh otomatis:', error.message);
    console.log('\n💡 Alternatif manual:');
    console.log('1. Jalankan via pip: pip install yt-dlp');
    console.log('2. Atau via winget: winget install yt-dlp');
    console.log('3. Atau unduh yt-dlp.exe manual dan masukkan ke folder ./bin');
  }
}

main();
