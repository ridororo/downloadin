const archiver = require('archiver');
const axios = require('axios');
const { safeFilename } = require('../utils/helpers');

/**
 * Creates and streams a ZIP file containing multiple image URLs
 * @param {Array<{ url: string, index: number, title?: string }>} items
 * @param {string} zipName
 * @param {import('express').Response} res
 */
async function streamZipArchive(items, zipName, res) {
  const archive = archiver('zip', {
    zlib: { level: 6 } // Good compression / speed balance
  });

  const sanitizedZip = `${safeFilename(zipName, 'DownloadIn_Photos')}.zip`;

  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="${sanitizedZip}"`);

  archive.pipe(res);

  archive.on('error', (err) => {
    console.error('Archive error:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Gagal membuat file arsip ZIP' });
    }
  });

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const itemIndex = String(i + 1).padStart(2, '0');
    const filename = `photo_${itemIndex}.jpg`;

    try {
      const response = await axios({
        method: 'get',
        url: item.url,
        responseType: 'stream',
        timeout: 15000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      });

      archive.append(response.data, { name: filename });
    } catch (fetchErr) {
      console.warn(`Gagal mengunduh gambar slide #${i + 1}:`, fetchErr.message);
    }
  }

  await archive.finalize();
}

module.exports = {
  streamZipArchive
};

