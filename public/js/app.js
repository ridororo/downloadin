/**
 * DownloadIn - Main Frontend Application Logic
 */

document.addEventListener('DOMContentLoaded', () => {
  // Elements
  const urlInput = document.getElementById('url-input');
  const pasteBtn = document.getElementById('paste-btn');
  const clearBtn = document.getElementById('clear-btn');
  const downloadBtn = document.getElementById('download-btn');
  const downloadBtnText = document.getElementById('download-btn-text');
  const downloadBtnSpinner = document.getElementById('download-btn-spinner');

  const platformPills = document.querySelectorAll('.platform-pill');
  const mismatchBanner = document.getElementById('mismatch-banner');
  const mismatchText = document.getElementById('mismatch-text');
  const mismatchSwitchBtn = document.getElementById('mismatch-switch-btn');

  const storyBanner = document.getElementById('story-banner');

  const loadingSkeleton = document.getElementById('loading-skeleton');
  const loadingStageText = document.getElementById('loading-stage-text');

  const resultContainer = document.getElementById('result-container');
  const errorContainer = document.getElementById('error-container');
  const errorTitle = document.getElementById('error-title');
  const errorMessage = document.getElementById('error-message');
  const errorDetail = document.getElementById('error-detail');
  const retryBtn = document.getElementById('retry-btn');

  const serverStatusBadge = document.getElementById('server-status-badge');

  // App State
  let state = {
    platform: 'auto',
    url: '',
    isLoading: false,
    mediaData: null,
    activeTab: 'video',
    detectedMismatch: null
  };

  // Lock to Full Dark Mode
  document.documentElement.classList.add('dark');
  checkServerHealth();

  // ----------------------------------------------------------------------
  // Event Listeners
  // ----------------------------------------------------------------------
  if (urlInput) {
    urlInput.addEventListener('input', handleUrlInput);
    urlInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        startExtraction();
      }
    });
  }

  if (clearBtn) {
    clearBtn.addEventListener('click', clearInput);
  }

  if (pasteBtn) {
    pasteBtn.addEventListener('click', handlePaste);
  }

  if (downloadBtn) {
    downloadBtn.addEventListener('click', () => startExtraction());
  }

  if (retryBtn) {
    retryBtn.addEventListener('click', () => startExtraction());
  }

  if (mismatchSwitchBtn) {
    mismatchSwitchBtn.addEventListener('click', handleAutoSwitchPlatform);
  }

  // Platform pill selector clicks
  if (platformPills && platformPills.length > 0) {
    platformPills.forEach((pill) => {
      pill.addEventListener('click', () => {
        const selected = pill.dataset.platform || 'auto';
        setActivePlatform(selected);
        // Re-validate current URL against newly selected platform
        if (urlInput && urlInput.value && urlInput.value.trim()) {
          inspectUrl(urlInput.value.trim());
        }
      });
    });
  }

  // ----------------------------------------------------------------------
  // Platform Detection & Validation Rules
  // ----------------------------------------------------------------------
  const PLATFORMS = [
    { id: 'tiktok', name: 'TikTok', match: /(tiktok\.com|douyin\.com)/i, story: /\/(story|stories)\//i },
    { id: 'instagram', name: 'Instagram', match: /(instagram\.com|instagr\.am)/i, story: /\/stories\//i },
    { id: 'facebook', name: 'Facebook', match: /(facebook\.com|fb\.watch|fb\.com)/i, story: /\/stories\/|\/story\.php/i },
    { id: 'twitter', name: 'X / Twitter', match: /(x\.com|twitter\.com)/i, story: null },
    { id: 'youtube', name: 'YouTube', match: /(youtube\.com|youtu\.be)/i, story: null },
    { id: 'threads', name: 'Threads', match: /threads\.net/i, story: null },
    { id: 'reddit', name: 'Reddit', match: /(reddit\.com|redd\.it)/i, story: null },
    { id: 'pinterest', name: 'Pinterest', match: /(pinterest\.com|pin\.it)/i, story: null }
  ];

  function detectClientPlatform(url) {
    if (!url || typeof url !== 'string') {
      return { id: 'auto', name: 'Auto-detect', isStory: false };
    }
    for (const p of PLATFORMS) {
      if (p.match && p.match.test(url)) {
        return {
          id: p.id,
          name: p.name || 'Platform Terdeteksi',
          isStory: p.story ? p.story.test(url) : false
        };
      }
    }
    return { id: 'other', name: 'Platform Lainnya', isStory: false };
  }

  function handleUrlInput(e) {
    const val = (e && e.target && e.target.value ? e.target.value.trim() : '');
    state.url = val;

    if (val.length > 0) {
      if (clearBtn) clearBtn.classList.remove('hidden');
      inspectUrl(val);
    } else {
      if (clearBtn) clearBtn.classList.add('hidden');
      hideMismatchBanner();
      hideStoryBanner();
    }
  }

  function inspectUrl(val) {
    if (!val || typeof val !== 'string') {
      hideMismatchBanner();
      hideStoryBanner();
      return;
    }

    const detected = detectClientPlatform(val);

    // Check Story
    if (detected?.isStory) {
      showStoryBanner(detected?.name || 'Story');
    } else {
      hideStoryBanner();
    }

    // Check Mismatch
    if (state.platform && state.platform !== 'auto' && state.platform !== 'other') {
      if (detected?.id && detected.id !== 'other' && detected.id !== state.platform) {
        state.detectedMismatch = detected;
        showMismatchBanner(detected);
        return;
      }
    }

    hideMismatchBanner();
  }

  function showMismatchBanner(detected) {
    if (!mismatchBanner || !mismatchText || !mismatchSwitchBtn) return;
    const platformName = detected?.name || 'Platform Lain';
    mismatchText.textContent = `Tautan terdeteksi sebagai ${platformName}. Beralih ke kategori ${platformName}?`;
    mismatchSwitchBtn.textContent = `Beralih ke ${platformName}`;
    mismatchBanner.classList.remove('hidden');
  }

  function hideMismatchBanner() {
    state.detectedMismatch = null;
    if (mismatchBanner) mismatchBanner.classList.add('hidden');
  }

  function showStoryBanner(platformName) {
    if (storyBanner) storyBanner.classList.remove('hidden');
  }

  function hideStoryBanner() {
    if (storyBanner) storyBanner.classList.add('hidden');
  }

  function handleAutoSwitchPlatform() {
    // Null safe check
    const mismatch = state.detectedMismatch;
    if (mismatch && mismatch.id) {
      const targetId = mismatch.id || 'auto';
      const targetName = mismatch.name || 'Platform Terdeteksi';
      setActivePlatform(targetId);
      hideMismatchBanner();
      Toast.info(`Kategori dialihkan ke ${targetName}`);
    } else {
      hideMismatchBanner();
    }
  }

  function setActivePlatform(platformId) {
    state.platform = platformId || 'auto';

    if (platformPills) {
      platformPills.forEach((pill) => {
        const isTarget = pill.dataset.platform === platformId;
        if (isTarget) {
          pill.classList.remove('bg-slate-800/80', 'text-slate-300', 'border-slate-700/60');
          pill.classList.add('bg-indigo-600', 'text-white', 'border-indigo-500', 'shadow-lg', 'shadow-indigo-500/25');
        } else {
          pill.classList.remove('bg-indigo-600', 'text-white', 'border-indigo-500', 'shadow-lg', 'shadow-indigo-500/25');
          pill.classList.add('bg-slate-800/80', 'text-slate-300', 'border-slate-700/60');
        }
      });
    }
  }

  // ----------------------------------------------------------------------
  // Clipboard Paste Handler
  // ----------------------------------------------------------------------
  async function handlePaste() {
    try {
      if (navigator.clipboard && navigator.clipboard.readText) {
        const text = await navigator.clipboard.readText();
        if (text && text.trim()) {
          if (urlInput) {
            urlInput.value = text.trim();
            handleUrlInput({ target: urlInput });
            Toast.success('Tautan berhasil ditempel dari clipboard');
            urlInput.focus();
          }
        } else {
          Toast.warning('Papan klip kosong. Salin link terlebih dahulu.');
        }
      } else if (urlInput) {
        urlInput.focus();
        document.execCommand('paste');
      }
    } catch (err) {
      Toast.info('Gunakan pintasan keyboard (Ctrl+V) untuk menempel link.');
      if (urlInput) urlInput.focus();
    }
  }

  function clearInput() {
    if (urlInput) {
      urlInput.value = '';
      urlInput.focus();
    }
    state.url = '';
    if (clearBtn) clearBtn.classList.add('hidden');
    hideMismatchBanner();
    hideStoryBanner();
    hideResult();
    hideError();
  }

  // ----------------------------------------------------------------------
  // Extraction Workflow
  // ----------------------------------------------------------------------
  async function startExtraction(forceIgnoreMismatch = false) {
    const rawUrl = urlInput ? urlInput.value.trim() : '';

    if (!rawUrl) {
      Toast.warning('Silakan masukkan atau tempel tautan terlebih dahulu.');
      if (urlInput) urlInput.focus();
      return;
    }

    if (!rawUrl.startsWith('http://') && !rawUrl.startsWith('https://')) {
      Toast.error('URL harus diawali dengan http:// atau https://');
      if (urlInput) urlInput.focus();
      return;
    }

    setLoadingState(true);
    hideResult();
    hideError();

    let stageTimer = null;
    let step = 0;
    const stages = [
      'Menganalisis format tautan...',
      'Menghubungkan ke platform media...',
      'Mengekstrak stream video & audio resolusi tertinggi...',
      'Menyiapkan tautan unduhan tanpa watermark...'
    ];

    if (loadingStageText) loadingStageText.textContent = stages[0];
    stageTimer = setInterval(() => {
      step = (step + 1) % stages.length;
      if (loadingStageText) loadingStageText.textContent = stages[step];
    }, 1800);

    try {
      const response = await fetch('/api/extract', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          url: rawUrl,
          platform: state.platform,
          forceIgnoreMismatch
        })
      });

      const resData = await response.json();
      clearInterval(stageTimer);

      if (!response.ok) {
        // Check for mismatch prompt response
        if (response.status === 409 && resData.mismatch) {
          setLoadingState(false);
          showMismatchBanner({
            id: resData.detectedPlatform,
            name: resData.detectedName
          });
          Toast.warning(resData.message, 'Ketidakcocokan Kategori');
          return;
        }

        if (resData.errorType === 'PRIVATE_OR_RESTRICTED' || (resData.error && resData.error.code === 'PRIVATE_OR_RESTRICTED')) {
          throw {
            code: 'PRIVATE_OR_RESTRICTED',
            title: 'Konten Privat atau Dibatasi',
            message: resData.message || (resData.error && resData.error.message) || 'Tidak dapat mengunduh konten ini karena berasal dari Akun Private, Story yang dibatasi, atau tautan sudah tidak tersedia. Pastikan akun dan postingan bersifat Publik.',
            retryable: false
          };
        }

        throw resData.error || { message: resData.message || 'Gagal mengambil data dari server.' };
      }

      state.mediaData = resData.data;
      renderResult(resData.data);
      Toast.success('Media berhasil diekstrak dan siap diunduh!');
    } catch (err) {
      clearInterval(stageTimer);
      renderError(err);
    } finally {
      setLoadingState(false);
    }
  }

  function setLoadingState(loading) {
    state.isLoading = loading;

    if (loading) {
      if (downloadBtn) downloadBtn.disabled = true;
      if (downloadBtnSpinner) downloadBtnSpinner.classList.remove('hidden');
      if (downloadBtnText) downloadBtnText.textContent = 'Memproses...';
      if (loadingSkeleton) loadingSkeleton.classList.remove('hidden');
    } else {
      if (downloadBtn) downloadBtn.disabled = false;
      if (downloadBtnSpinner) downloadBtnSpinner.classList.add('hidden');
      if (downloadBtnText) downloadBtnText.textContent = 'Unduh';
      if (loadingSkeleton) loadingSkeleton.classList.add('hidden');
    }
  }

  // ----------------------------------------------------------------------
  // Render Result Card
  // ----------------------------------------------------------------------
  function renderResult(data) {
    hideError();
    if (!resultContainer) return;

    resultContainer.classList.remove('hidden');
    resultContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

    // Platform Badge & Colors
    const platformBadge = document.getElementById('res-platform-badge');
    if (platformBadge) {
      platformBadge.textContent = data.platformName || data.platform.toUpperCase();

      const platformColors = {
        tiktok: 'bg-black text-cyan-400 border-cyan-500/50',
        instagram: 'bg-gradient-to-r from-purple-500 to-pink-500 text-white border-pink-400/50',
        facebook: 'bg-blue-600 text-white border-blue-400/50',
        twitter: 'bg-slate-900 text-white border-slate-700',
        youtube: 'bg-red-600 text-white border-red-400/50',
        threads: 'bg-slate-900 text-white border-slate-700'
      };

      platformBadge.className = `inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${
        platformColors[data.platform] || 'bg-indigo-600 text-white border-indigo-400/50'
      }`;
    }

    // Story indicator badge
    const storyIndicator = document.getElementById('res-story-badge');
    if (storyIndicator) {
      storyIndicator.classList.toggle('hidden', !data.isStory);
    }

    // Media Thumbnail
    const thumbnailImg = document.getElementById('res-thumbnail');
    if (thumbnailImg) {
      thumbnailImg.src =
        data.thumbnail ||
        'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=600&q=80';
      thumbnailImg.alt = data.title || 'Thumbnail Media';
    }

    // Duration
    const durationBadge = document.getElementById('res-duration');
    if (durationBadge) {
      if (data.durationFormatted) {
        durationBadge.textContent = data.durationFormatted;
        durationBadge.classList.remove('hidden');
      } else {
        durationBadge.classList.add('hidden');
      }
    }

    // Title & Uploader
    const titleEl = document.getElementById('res-title');
    if (titleEl) titleEl.textContent = data.title || 'Tanpa Judul';

    const uploaderEl = document.getElementById('res-uploader');
    if (uploaderEl) uploaderEl.textContent = `@${data.uploader || 'Creator'}`;

    // Setup Download Tabs
    setupDownloadTabs(data);
  }

  function setupDownloadTabs(data) {
    const tabVideo = document.getElementById('tab-btn-video');
    const tabAudio = document.getElementById('tab-btn-audio');
    const tabPhotos = document.getElementById('tab-btn-photos');
    const tabStories = document.getElementById('tab-btn-stories');
    const storiesBadge = document.getElementById('stories-count-badge');

    const contentVideo = document.getElementById('tab-content-video');
    const contentAudio = document.getElementById('tab-content-audio');
    const contentPhotos = document.getElementById('tab-content-photos');
    const contentStories = document.getElementById('tab-content-stories');

    if (!tabVideo || !tabAudio || !tabPhotos) return;

    const hasVideos = data.downloads.videos && data.downloads.videos.length > 0;
    const hasAudios = data.downloads.audios && data.downloads.audios.length > 0;
    const hasImages = data.downloads.images && data.downloads.images.length > 0;
    const hasStories = data.downloads.stories && data.downloads.stories.length > 0;

    tabVideo.classList.toggle('hidden', !hasVideos);
    tabAudio.classList.toggle('hidden', !hasAudios);
    tabPhotos.classList.toggle('hidden', !hasImages);

    if (tabStories && storiesBadge) {
      if (hasStories) {
        tabStories.classList.remove('hidden');
        storiesBadge.textContent = data.downloads.stories.length;
      } else {
        tabStories.classList.add('hidden');
      }
    }

    if (hasStories && (data.isStory || data.contentType === 'story')) {
      switchTab('stories');
    } else if (data.contentType === 'carousel' || data.contentType === 'photo') {
      switchTab('photos');
    } else if (hasVideos) {
      switchTab('video');
    } else if (hasAudios) {
      switchTab('audio');
    } else if (hasImages) {
      switchTab('photos');
    } else if (hasStories) {
      switchTab('stories');
    }

    tabVideo.onclick = () => switchTab('video');
    tabAudio.onclick = () => switchTab('audio');
    tabPhotos.onclick = () => switchTab('photos');
    if (tabStories) tabStories.onclick = () => switchTab('stories');

    function switchTab(tabKey) {
      state.activeTab = tabKey;

      [tabVideo, tabAudio, tabPhotos, tabStories].forEach((btn) => btn && btn.classList.remove('tab-active'));
      [contentVideo, contentAudio, contentPhotos, contentStories].forEach((c) => c && c.classList.add('hidden'));

      if (tabKey === 'video' && contentVideo) {
        tabVideo.classList.add('tab-active');
        contentVideo.classList.remove('hidden');
      } else if (tabKey === 'audio' && contentAudio) {
        tabAudio.classList.add('tab-active');
        contentAudio.classList.remove('hidden');
      } else if (tabKey === 'photos' && contentPhotos) {
        tabPhotos.classList.add('tab-active');
        contentPhotos.classList.remove('hidden');
      } else if (tabKey === 'stories' && contentStories && tabStories) {
        tabStories.classList.add('tab-active');
        contentStories.classList.remove('hidden');
      }
    }

    // Render Lists
    renderVideoOptions(data.downloads.videos || [], data.title);
    renderAudioOptions(data.downloads.audios || [], data.title);
    renderPhotoOptions(data.downloads.images || [], data.title);
    if (hasStories) {
      renderStoryOptions(data.downloads.stories || [], data.title);
    }
  }

  function renderVideoOptions(videos, title) {
    const list = document.getElementById('video-options-list');
    if (!list) return;
    list.innerHTML = '';

    if (videos.length === 0) {
      list.innerHTML = `<div class="text-sm text-slate-400 p-4 text-center">Tidak ada stream video langsung yang tersedia.</div>`;
      return;
    }

    videos.forEach((video) => {
      const item = document.createElement('div');
      item.className =
        'flex flex-col sm:flex-row sm:items-center justify-between p-3.5 rounded-xl bg-slate-800/60 border border-slate-700/50 hover:border-indigo-500/50 transition-all gap-3';

      const isSd = video.qualityKey === 'sd';

      item.innerHTML = `
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-lg ${isSd ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' : 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400'} border flex items-center justify-center shrink-0">
            <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"/>
            </svg>
          </div>
          <div>
            <div class="flex items-center gap-2 flex-wrap">
              <span class="font-semibold text-sm text-slate-100">${video.quality}</span>
              ${
                !isSd
                  ? `<span class="px-2 py-0.5 rounded text-[10px] font-bold tracking-wide uppercase bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-sm">Kualitas Terbaik (1080p)</span>`
                  : `<span class="px-2 py-0.5 rounded text-[10px] font-bold tracking-wide uppercase bg-amber-500/20 text-amber-300 border border-amber-500/40">Hemat Kuota (480p)</span>`
              }
              <span class="px-2 py-0.5 rounded text-[10px] font-medium bg-indigo-950 text-indigo-300 border border-indigo-800/60">H.264 / MP4</span>
              <span class="px-2 py-0.5 rounded text-[10px] font-medium bg-cyan-950 text-cyan-300 border border-cyan-800/60">No Watermark</span>
            </div>
            <div class="text-xs text-slate-400 mt-0.5 flex items-center gap-3">
              <span>Resolusi: ${video.resolution || (isSd ? '480p' : '1080p')}</span>
              <span>Codec: H.264 (avc1)</span>
              <span>Tipe: ${isSd ? 'Hemat Data' : 'Full HD'}</span>
            </div>
          </div>
        </div>
        <button type="button" class="btn-download-media inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-xs font-semibold ${
        !isSd
          ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30'
          : 'bg-slate-700 hover:bg-slate-600 text-slate-200'
      } transition-all shrink-0 active:scale-95 disabled:pointer-events-none" data-url="${video.downloadUrl}" data-type="video">
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
          </svg>
          <span class="btn-label">${isSd ? 'Unduh SD (480p)' : 'Unduh HD (1080p)'}</span>
        </button>
      `;

      const dlBtn = item.querySelector('.btn-download-media');
      if (dlBtn) {
        dlBtn.addEventListener('click', () => triggerBackendDownload(dlBtn, video.downloadUrl, 'video'));
      }

      list.appendChild(item);
    });
  }

  function renderAudioOptions(audios, title) {
    const list = document.getElementById('audio-options-list');
    if (!list) return;
    list.innerHTML = '';

    if (audios.length === 0) {
      list.innerHTML = `<div class="text-sm text-slate-400 p-4 text-center">Audio tidak tersedia untuk postingan ini.</div>`;
      return;
    }

    audios.forEach((audio) => {
      const item = document.createElement('div');
      item.className =
        'flex flex-col sm:flex-row sm:items-center justify-between p-3.5 rounded-xl bg-slate-800/60 border border-slate-700/50 hover:border-violet-500/50 transition-all gap-3';

      item.innerHTML = `
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-lg bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-violet-400 shrink-0">
            <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"/>
            </svg>
          </div>
          <div>
            <div class="flex items-center gap-2">
              <span class="font-semibold text-sm text-slate-100">${audio.quality}</span>
              ${
                audio.isBest
                  ? `<span class="px-2 py-0.5 rounded text-[10px] font-bold tracking-wide uppercase bg-violet-600 text-white">320kbps</span>`
                  : ''
              }
            </div>
            <div class="text-xs text-slate-400 mt-0.5 flex items-center gap-3">
              <span>Bitrate: ${audio.bitrate}</span>
              <span>Format: ${audio.ext.toUpperCase()}</span>
              <span>Ukuran: ${audio.filesizeFormatted || 'Otomatis'}</span>
            </div>
          </div>
        </div>
        <button type="button" class="btn-download-media inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-xs font-semibold bg-violet-600 hover:bg-violet-500 text-white shadow-lg shadow-violet-600/30 transition-all shrink-0 active:scale-95 disabled:pointer-events-none" data-url="${audio.downloadUrl}" data-type="audio">
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
          </svg>
          <span class="btn-label">Unduh ${audio.ext.toUpperCase()}</span>
        </button>
      `;

      const dlBtn = item.querySelector('.btn-download-media');
      if (dlBtn) {
        dlBtn.addEventListener('click', () => triggerBackendDownload(dlBtn, audio.downloadUrl, 'audio'));
      }

      list.appendChild(item);
    });
  }

  /**
   * Safe Trigger Download Engine
   * Disables button, changes text to 'Memproses File... Mohon tunggu', and starts stream download.
   */
  function triggerBackendDownload(btn, url, type = 'video') {
    if (!btn || btn.disabled || btn.dataset.downloading === 'true') return;

    btn.disabled = true;
    btn.dataset.downloading = 'true';
    btn.classList.add('opacity-75', 'cursor-wait');
    const originalHTML = btn.innerHTML;

    const isProxyDownload = url.includes('/api/proxy-download');

    btn.innerHTML = `
      <svg class="w-4 h-4 animate-spin text-white shrink-0" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
      </svg>
      <span>${isProxyDownload ? 'Mengunduh...' : 'Memproses File... Mohon tunggu'}</span>
    `;

    if (isProxyDownload) {
      Toast.info(
        type === 'video'
          ? 'Memulai pengunduhan video... File akan otomatis terunduh.'
          : type === 'audio'
          ? 'Memulai pengunduhan audio original...'
          : 'Memulai pengunduhan foto kualitas penuh...',
        'Mengunduh Media'
      );
    } else {
      Toast.info(
        type === 'video'
          ? 'Sedang memproses & menggabungkan video (H.264 MP4). Unduhan akan otomatis tersimpan...'
          : 'Sedang mengekstrak audio kualitas tinggi (MP3 320kbps). Harap tunggu...',
        'Memproses Unduhan'
      );
    }

    // Stream download via hidden iframe (avoids filling RAM with Blob)
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    iframe.src = url;
    document.body.appendChild(iframe);

    // Restore button status after download initiation
    const waitTime = isProxyDownload ? 4000 : 7000;
    setTimeout(() => {
      if (btn) {
        btn.disabled = false;
        btn.dataset.downloading = 'false';
        btn.classList.remove('opacity-75', 'cursor-wait');
        btn.innerHTML = originalHTML;
      }
      try {
        iframe.remove();
      } catch (e) {}
    }, waitTime);
  }

  function renderStoryOptions(stories, title) {
    const grid = document.getElementById('stories-grid');
    if (!grid) return;
    grid.innerHTML = '';

    if (!stories || stories.length === 0) {
      grid.innerHTML = `<div class="col-span-full text-sm text-slate-400 p-4 text-center">Tidak ada item story yang ditemukan.</div>`;
      return;
    }

    stories.forEach((item) => {
      const card = document.createElement('div');
      card.className =
        'relative group rounded-xl overflow-hidden border border-slate-700/60 bg-slate-800/60 transition-all hover:border-indigo-500/60 flex flex-col justify-between';

      const isVid = item.type === 'video';

      card.innerHTML = `
        <div class="aspect-video sm:aspect-square bg-slate-900/80 relative overflow-hidden flex items-center justify-center">
          ${
            item.thumbnail
              ? `<img src="${item.thumbnail}" alt="${item.title || 'Story Item'}" loading="lazy" class="w-full h-full object-cover">`
              : `<div class="text-slate-500 font-mono text-xs">Preview Media</div>`
          }
          <div class="absolute top-2 left-2 flex items-center gap-1.5">
            <span class="bg-slate-900/80 backdrop-blur-md px-2 py-0.5 rounded text-[11px] font-semibold text-slate-200">
              #${item.index}
            </span>
            <span class="px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
              isVid ? 'bg-indigo-600/90 text-white' : 'bg-emerald-600/90 text-white'
            }">
              ${isVid ? 'Video MP4' : 'Foto JPG'}
            </span>
          </div>
        </div>
        <div class="p-3 bg-slate-900/90 flex items-center justify-between gap-2 border-t border-slate-800">
          <span class="text-xs text-slate-300 font-medium truncate">${item.title || `Story Slide ${item.index}`}</span>
          <button type="button" class="btn-download-media inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold ${
            isVid ? 'bg-indigo-600 hover:bg-indigo-500' : 'bg-emerald-600 hover:bg-emerald-500'
          } text-white transition-all shrink-0 active:scale-95 disabled:pointer-events-none" data-url="${item.downloadUrl}" data-type="${item.type}">
            <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
            </svg>
            <span>Unduh</span>
          </button>
        </div>
      `;

      const dlBtn = card.querySelector('.btn-download-media');
      if (dlBtn) {
        dlBtn.addEventListener('click', () => triggerBackendDownload(dlBtn, item.downloadUrl, item.type));
      }

      grid.appendChild(card);
    });
  }

  function renderPhotoOptions(images, title) {
    const grid = document.getElementById('photo-grid');
    const bulkBtn = document.getElementById('bulk-download-zip-btn');
    if (!grid) return;
    grid.innerHTML = '';

    if (images.length === 0) {
      grid.innerHTML = `<div class="col-span-full text-sm text-slate-400 p-4 text-center">Tidak ada foto atau slide pada postingan ini.</div>`;
      if (bulkBtn) bulkBtn.classList.add('hidden');
      return;
    }

    if (images.length > 1 && bulkBtn) {
      bulkBtn.classList.remove('hidden');
      bulkBtn.onclick = () => downloadAllImagesAsZip(images, title);
    } else if (bulkBtn) {
      bulkBtn.classList.add('hidden');
    }

    images.forEach((img, index) => {
      const card = document.createElement('div');
      card.className =
        'relative group rounded-xl overflow-hidden border border-slate-700/60 bg-slate-800/60 transition-all hover:border-indigo-500/60 zoom-container';

      card.innerHTML = `
        <div class="aspect-square bg-slate-900/80 relative">
          <img src="${img.url}" alt="${img.title || 'Slide Foto'}" loading="lazy" class="w-full h-full object-cover">
          <div class="absolute top-2 left-2 bg-slate-900/80 backdrop-blur-md px-2 py-0.5 rounded text-[11px] font-semibold text-slate-200">
            #${index + 1}
          </div>
        </div>
        <div class="p-2.5 bg-slate-900/90 flex items-center justify-between gap-2 border-t border-slate-800">
          <span class="text-xs text-slate-300 font-medium truncate">Slide ${index + 1}</span>
          <button type="button" class="btn-download-media p-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-colors shrink-0 active:scale-95 disabled:pointer-events-none" title="Unduh Foto Resolusi Penuh" data-url="${img.downloadUrl}" data-type="image">
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
            </svg>
          </button>
        </div>
      `;

      const dlBtn = card.querySelector('.btn-download-media');
      if (dlBtn) {
        dlBtn.addEventListener('click', () => triggerBackendDownload(dlBtn, img.downloadUrl, 'image'));
      }

      grid.appendChild(card);
    });
  }

  async function downloadAllImagesAsZip(images, title) {
    const bulkBtn = document.getElementById('bulk-download-zip-btn');
    if (!bulkBtn) return;
    const originalText = bulkBtn.innerHTML;

    bulkBtn.disabled = true;
    bulkBtn.innerHTML = `
      <svg class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
      </svg>
      <span>Mengemas ZIP...</span>
    `;

    try {
      Toast.info('Sedang mengemas semua foto ke dalam file ZIP...');

      const response = await fetch('/api/download-zip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: images,
          title: title || 'DownloadIn_Carousel'
        })
      });

      if (!response.ok) {
        throw new Error('Gagal membuat arsip ZIP.');
      }

      const blob = await response.blob();
      const downloadLink = document.createElement('a');
      downloadLink.href = window.URL.createObjectURL(blob);
      downloadLink.download = `${title || 'DownloadIn_Photos'}.zip`;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      downloadLink.remove();

      Toast.success('File ZIP berhasil diunduh!');
    } catch (err) {
      Toast.error('Gagal mengunduh kumpulan gambar ZIP: ' + err.message);
    } finally {
      bulkBtn.disabled = false;
      bulkBtn.innerHTML = originalText;
    }
  }

  // ----------------------------------------------------------------------
  // Render Error Card
  // ----------------------------------------------------------------------
  function renderError(err) {
    hideResult();
    if (!errorContainer) return;

    errorContainer.classList.remove('hidden');
    errorContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

    const isRestricted = err.code === 'PRIVATE_OR_RESTRICTED' || err.errorType === 'PRIVATE_OR_RESTRICTED';

    if (errorTitle) errorTitle.textContent = err.title || (isRestricted ? 'Konten Privat atau Dibatasi' : 'Gagal Mengambil Konten');
    if (errorMessage) errorMessage.textContent = err.message || 'Terjadi kesalahan teknis pada sistem.';

    if (errorDetail) {
      if (!isRestricted && err.detail && err.detail !== err.message) {
        errorDetail.textContent = `Detail teknis: ${err.detail}`;
        errorDetail.classList.remove('hidden');
      } else {
        errorDetail.classList.add('hidden');
      }
    }

    if (retryBtn) {
      if (!isRestricted && err.retryable !== false) {
        retryBtn.classList.remove('hidden');
      } else {
        retryBtn.classList.add('hidden');
      }
    }

    if (isRestricted) {
      Toast.warning(err.message, err.title || 'Konten Dibatasi');
    } else {
      Toast.error(err.message, err.title || 'Kesalahan');
    }
  }

  function hideResult() {
    if (resultContainer) resultContainer.classList.add('hidden');
  }

  function hideError() {
    if (errorContainer) errorContainer.classList.add('hidden');
  }

  // ----------------------------------------------------------------------
  // Health & Server Diagnostics
  // ----------------------------------------------------------------------
  async function checkServerHealth() {
    try {
      const res = await fetch('/api/health');
      if (res.ok) {
        const data = await res.json();
        if (serverStatusBadge) {
          const ffmpegNote = data.ffmpeg && data.ffmpeg.available ? ' • FFmpeg Ready' : '';
          serverStatusBadge.innerHTML = `
            <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span class="text-slate-300">Server Siap • Mode Publik${ffmpegNote}</span>
          `;
        }
      }
    } catch (e) {
      if (serverStatusBadge) {
        serverStatusBadge.innerHTML = `
          <span class="w-2 h-2 rounded-full bg-amber-400"></span>
          <span class="text-amber-300">Server Offline</span>
        `;
      }
    }
  }
});
