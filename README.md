# 🚀 DownloadIn - All-in-One Social Media Downloader

**DownloadIn** adalah aplikasi web full-stack modern, ringan, dan cepat yang berfungsi sebagai pengunduh media serbaguna (All-in-One Social Media Downloader). Mendukung pengunduhan dari **TikTok, Instagram, Facebook, X (Twitter), YouTube**, serta platform lainnya tanpa memerlukan login akun.

---

## ✨ Fitur Unggulan

- ⚡ **Tanpa Autentikasi (No Login):** Langsung gunakan saat halaman dibuka, tanpa registrasi atau login akun.
- 🎬 **Video Kualitas Tertinggi & Bebas Watermark:**
  - Mendukung resolusi hingga **4K, 1080p Full HD, 60fps**.
  - Otomatis menghapus watermark pada video TikTok dan Instagram Reels.
  - Pilihan resolusi fleksibel (1080p, 720p HD, 480p SD).
- 🎵 **Ekstraksi Audio MP3 / M4A:**
  - Unduh audio saja dengan bitrate tinggi (**320kbps**).
  - Sangat cocok untuk mengunduh background sound, podcast, atau lagu trending.
- 🖼️ **Dukungan Foto Slide TikTok & Instagram Carousel:**
  - Ekstraksi semua gambar resolusi penuh.
  - Tampilan galeri interaktif.
  - **Tombol "Unduh Semua (ZIP)"** untuk mengunduh seluruh slide dalam 1 file arsip ZIP secara instan.
- 📱 **Dukungan Stories (Instagram, Facebook, TikTok Stories Publik):**
  - Mengunduh Story publik langsung dari link tanpa perlu login atau cookies.
- 🧭 **Pill Selector & Auto-Detection Cerdas:**
  - Pilihan platform: Auto-detect, TikTok, Instagram, Facebook, X, YouTube, Lainnya.
  - Peringatan otomatis jika tautan tidak cocok dengan platform yang dipilih (*platform mismatch prompt*).
- 📋 **Tombol Tempel Cepat (Quick Paste):** Mengambil tautan langsung dari clipboard perangkat dalam satu klik.
- 🌙 **Desain Modern & Dark Mode:**
  - Tampilan antarmuka bersih (*clean glassmorphism*).
  - Nyaman di mata dengan dukungan Dark Mode & Light Mode toggle.
  - Animasi loading spinner dan skeleton placeholder selama metadata diproses.
- 🛡️ **Penanganan Error Komprehensif:** Pesan ramah pengguna berbahasa Indonesia untuk link salah, akun private, story kedaluwarsa (>24 jam), dan rate limit dengan tombol "Coba Lagi".

---

## 📁 Struktur Direktori Proyek

```text
DownloadIn/
├── public/                 # Frontend antarmuka pengguna (Ringan & Cepat)
│   ├── css/
│   │   └── style.css       # Animasi kustom, shimmer skeleton, efek glassmorphism
│   ├── js/
│   │   ├── app.js          # Logika frontend, state management, & API handler
│   │   └── toast.js        # Utilitas notifikasi toast modern
│   └── index.html          # Halaman utama aplikasi (HTML5 + Tailwind CSS CDN)
├── src/                    # Backend API (Node.js & Express)
│   ├── routes/
│   │   └── api.js          # Router API (/api/extract, /api/download, /api/download-zip, /api/health)
│   ├── services/
│   │   ├── extractor.js    # Wrapper yt-dlp & ekstraksi format resolusi tinggi
│   │   ├── validator.js    # Validasi URL & deteksi platform/Stories
│   │   └── archiver.js     # Pembuat arsip ZIP streaming untuk carousel/slide
│   ├── utils/
│   │   ├── errorHandler.js # Kategorisasi pesan error ramah pengguna (Private, Expired, dll.)
│   │   └── helpers.js      # Utilitas format ukuran byte, durasi, & sanitasi nama file
│   └── server.js           # Server Express utama, static hosting, & CORS
├── scripts/
│   └── setup-ytdlp.js      # Skrip otomatis untuk mengunduh binary yt-dlp
├── bin/                    # Lokasi binary yt-dlp standalone lokal (opsional)
├── temp/                   # Folder sementara untuk pengolahan unduhan
├── .gitignore              # Mengabaikan node_modules dan temp
├── package.json            # Konfigurasi dependensi npm
└── README.md               # Dokumentasi lengkap proyek
```

---

## 🛠️ Persyaratan Sistem

Sebelum menjalankan aplikasi, pastikan sistem Anda telah terpasang:

1. **Node.js:** Versi **18.x** atau yang lebih baru (unduh dari [nodejs.org](https://nodejs.org/)).
2. **Ekstraktor yt-dlp & FFmpeg:**
   - **yt-dlp:**
     ```bash
     pip install yt-dlp
     # atau letakkan yt-dlp.exe di folder ./bin
     ```
   - **FFmpeg (Sangat Disarankan untuk YouTube Muxing & MP3 320k):**
     - Otomatis disediakan oleh paket `ffmpeg-static` bawaan aplikasi.

---

## 🚀 Panduan Instalasi & Menjalankan Server

### 1. Salin / Buka Folder Proyek
Buka terminal (PowerShell / Command Prompt / Terminal) di dalam direktori `DownloadIn`:
```bash
cd DownloadIn
```

### 2. Pasang Dependensi Node.js
```bash
npm install
```

### 3. Jalankan Server
- **Mode Produksi:**
  ```bash
  npm start
  ```
- **Mode Pengembangan (Auto-reload):**
  ```bash
  npm run dev
  ```

Buka peramban (browser) Anda dan akses:
👉 **[http://localhost:3000](http://localhost:3000)**

---

## 🔒 Kebijakan Konten Publik (Tanpa Login & Tanpa Cookies)

DownloadIn didesain murni untuk mengunduh konten **Publik** secara cepat dan anonim:
- Tidak membutuhkan akun pengguna, session cookie, maupun konfigurasi file `cookies.txt`.
- Jika tautan berasal dari **Akun Private**, Story untuk **Close Friends**, atau konten yang dibatasi oleh platform, sistem akan langsung menampilkan pesan ramah:
  > *"Tidak dapat mengunduh konten ini karena berasal dari Akun Private, Story yang dibatasi, atau tautan sudah tidak tersedia. Pastikan akun dan postingan bersifat Publik."*

---

## 📡 Dokumentasi Endpoint API

Aplikasi menyediakan REST API internal yang dapat diintegrasikan dengan aplikasi lain:

### 1. `GET /api/health`
Memeriksa status server, ketersediaan modul `yt-dlp`, dan status mode publik.
- **Respon:**
  ```json
  {
    "status": "ok",
    "service": "DownloadIn API",
    "version": "1.2.0",
    "mode": "public_no_login",
    "extractor": { "available": true },
    "ffmpeg": { "available": true }
  }
  ```

### 2. `POST /api/extract`
Mengekstrak informasi metadata, format video/audio, dan slide gambar.
- **Request Body:**
  ```json
  {
    "url": "https://www.tiktok.com/@username/video/123456789",
    "platform": "auto",
    "forceIgnoreMismatch": false
  }
  ```
- **Respon Sukses (200 OK):**
  ```json
  {
    "success": true,
    "data": {
      "id": "123456789",
      "title": "Koleksi Video Keren",
      "uploader": "username",
      "thumbnail": "https://...",
      "duration": 45,
      "durationFormatted": "0:45",
      "platform": "tiktok",
      "platformName": "TikTok",
      "isStory": false,
      "contentType": "video",
      "downloads": {
        "videos": [
          {
            "quality": "Full HD (1080p)",
            "ext": "mp4",
            "filesizeFormatted": "12.4 MB",
            "downloadUrl": "http://localhost:3000/api/download?..."
          }
        ],
        "audios": [
          {
            "quality": "MP3 Audio (Kualitas Tinggi 320kbps)",
            "ext": "mp3",
            "downloadUrl": "http://localhost:3000/api/download?..."
          }
        ],
        "images": []
      }
    }
  }
  ```

### 3. `GET /api/download-file` (Core Downloader Engine)
Mengunduh dan menggabungkan media (muxing) di backend menggunakan `yt-dlp` dan `ffmpeg-static` dengan codec H.264 (avc1) & AAC (mp4a), lalu mengirimkannya ke user:
- **Query Params:**
  - `sourceUrl`: Tautan asli postingan (TikTok, YouTube, Facebook, X, IG)
  - `type`: `video` atau `audio`
  - `quality`: `hd` (1080p+ bitrate maksimal) atau `sd` (480p hemat data)
  - `height`: Batas resolusi (misal `1080`, `480`)
  - `ext`: `mp4` atau `mp3`
  - `title`: Judul file keluaran (otomatis disanitasi maksimal 55 karakter)
- **Fitur Otomatis:**
  - Integrasi otomatis `ffmpeg-static` via `--ffmpeg-location` untuk muxing YouTube 1080p tanpa mentok di 360p.
  - Memaksa container output video selalu `.mp4` (mencegah Facebook Reels jatuh ke `.m4a`).
  - Mengirim header `Referer` sesuai platform (mencegah error `download.htm` TikTok).
  - Mengonversi ke MP3 320kbps jika opsi musik dipilih.
  - Menghapus file sementara di folder `temp/` secara otomatis setelah selesai streaming.

### 4. `GET /api/download`
Streaming proxy khusus untuk gambar, slide foto, dan thumbnail dengan header referer anti-hotlinking.

### 5. `POST /api/download-zip`
Membuat file ZIP dinamis secara langsung (*stream on the fly*) untuk mengunduh semua foto carousel atau slide dalam satu paket.

---

## ❓ Troubleshooting (Tanya & Jawab)

**Q: Mengapa muncul pesan "Ekstraktor Belum Terpasang"?**  
A: Sistem belum menemukan program `yt-dlp`. Jalankan `npm run setup` atau letakkan `yt-dlp.exe` di folder `./bin`.

**Q: Mengapa postingan atau Story menampilkan pesan "Konten Privat atau Dibatasi"?**  
A: DownloadIn dikhususkan untuk konten publik. Jika postingan berasal dari akun private, Story yang dibatasi untuk *Close Friends*, atau sudah kedaluwarsa, platform tidak mengizinkan pengunduhan tanpa sesi akun pemilik/teman. Pastikan akun dan postingan bersifat publik.

**Q: Apakah aplikasi ini menyimpan file video pengguna di harddisk server?**  
A: Tidak. DownloadIn menggunakan arsitektur *streaming pipe* langsung dari sumber platform ke browser pengguna. Hal ini menghemat kapasitas penyimpanan server secara maksimal.

---

## 📄 Lisensi
Proyek ini dilisensikan di bawah lisensi **MIT License**. Bebas dimodifikasi dan dikembangkan untuk kebutuhan pembelajaran dan personal.

