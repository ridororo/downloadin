# 🚀 DownloadIn - All-in-One Social Media Downloader

**DownloadIn** adalah aplikasi web full-stack modern, ringan, dan cepat yang berfungsi sebagai pengunduh media serbaguna (All-in-One Social Media Downloader). Mendukung pengunduhan dari **TikTok, Instagram, Facebook, X (Twitter), YouTube**, serta platform lainnya tanpa memerlukan login akun. Bebas Iklan dan biaya apapun, cukup install saja apa yang diperlukan. kalo ada eror benerin sendiri ya wkwkwkk.

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

Buka peramban (browser) Anda dan akses:
👉 **[http://localhost:3000](http://localhost:3000)**

---

## 🔒 Kebijakan Konten Publik (Tanpa Login & Tanpa Cookies)

DownloadIn didesain murni untuk mengunduh konten **Publik** secara cepat dan anonim.
- Jika tautan berasal dari **Akun Private**, Story untuk **Close Friends**, atau konten yang dibatasi oleh platform, sistem akan langsung menampilkan pesan ramah:
  > *"Tidak dapat mengunduh konten ini karena berasal dari Akun Private, Story yang dibatasi, atau tautan sudah tidak tersedia. Pastikan akun dan postingan bersifat Publik."*

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

