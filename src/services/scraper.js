const axios = require('axios');
const path = require('path');
const { formatDuration, safeFilename } = require('../utils/helpers');

let btch = null;
try {
  btch = require('btch-downloader');
} catch (e) {
  console.warn('[scraper] btch-downloader not available:', e.message);
}

let snapVideo = null;
try {
  snapVideo = require('cakkatrok-instagram-downloader');
} catch (e) {
  console.warn('[scraper] cakkatrok-instagram-downloader not available:', e.message);
}

let ruhend = null;
try {
  ruhend = require('ruhend-scraper');
} catch (e) {
  console.warn('[scraper] ruhend-scraper not available:', e.message);
}

class ScraperService {
  constructor() {
    this.tikwmApi = 'https://www.tikwm.com/api/';
    this.defaultUserAgent =
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';
  }

  /**
   * Scrape TikTok without cookies via TikWM API (HD, SD, Music, Photo Slides)
   * Fallback to btch-downloader.ttdl
   */
  async scrapeTikTok(url) {
    // 1. TikWM API (Fast, Free, No Watermark, HD + SD + MP3)
    try {
      const response = await axios.post(
        this.tikwmApi,
        new URLSearchParams({ url }),
        {
          headers: {
            'User-Agent': this.defaultUserAgent,
            'Accept': 'application/json',
            'Referer': 'https://www.tikwm.com/'
          },
          timeout: 12000
        }
      );

      if (response.data && response.data.code === 0 && response.data.data) {
        const d = response.data.data;
        const title = d.title || 'TikTok Media';
        const uploader = d.author?.nickname || d.author?.unique_id || 'TikTok User';
        const thumbnail = d.cover || d.origin_cover || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=600&q=80';
        const duration = d.duration || 0;

        const videos = [];
        if (d.hdplay) {
          videos.push({
            formatId: 'tiktok-hd',
            qualityKey: 'hd',
            quality: 'Video HD (1080p / Asli Tanpa Watermark)',
            resolution: '1080p / Full HD',
            height: 1080,
            fps: 60,
            ext: 'mp4',
            cdnUrl: d.hdplay,
            isBest: true,
            badge: 'HD 1080p',
            hasAudio: true,
            noWatermark: true
          });
        }

        if (d.play) {
          videos.push({
            formatId: 'tiktok-sd',
            qualityKey: 'sd',
            quality: 'Video SD (Hemat Kuota / Tanpa Watermark)',
            resolution: '720p / SD',
            height: 720,
            fps: 30,
            ext: 'mp4',
            cdnUrl: d.play,
            isBest: videos.length === 0,
            badge: 'SD Normal',
            hasAudio: true,
            noWatermark: true
          });
        }

        const audios = [];
        if (d.music) {
          audios.push({
            formatId: 'tiktok-music',
            qualityKey: 'mp3',
            quality: 'Audio Musik Asli (MP3 320kbps)',
            ext: 'mp3',
            cdnUrl: d.music,
            bitrate: '320kbps',
            filesizeFormatted: 'Kualitas Tinggi',
            isBest: true
          });
        }

        const images = [];
        if (Array.isArray(d.images) && d.images.length > 0) {
          d.images.forEach((imgUrl, idx) => {
            images.push({
              id: `slide-${idx + 1}`,
              index: idx + 1,
              url: imgUrl,
              cdnUrl: imgUrl,
              title: `${title} #${idx + 1}`,
              ext: 'jpg'
            });
          });
        }

        const isCarousel = images.length > 0;
        return {
          id: d.id || String(Date.now()),
          title,
          description: d.title || '',
          uploader,
          thumbnail,
          duration,
          durationFormatted: formatDuration(duration),
          platform: 'tiktok',
          platformName: 'TikTok',
          isStory: false,
          contentType: isCarousel ? 'carousel' : 'video',
          downloads: {
            videos,
            audios,
            images,
            stories: []
          },
          sourceUrl: url,
          engine: 'tikwm'
        };
      }
    } catch (err) {
      console.warn('[scraper] TikWM attempt failed:', err.message);
    }

    // 2. btch-downloader.ttdl fallback
    if (btch && typeof btch.ttdl === 'function') {
      try {
        const res = await btch.ttdl(url);
        if (res && res.status && (res.video?.length > 0 || res.audio?.length > 0)) {
          const title = res.title || 'TikTok Video';
          const thumbnail = res.thumbnail || '';
          const videos = [];

          if (Array.isArray(res.video)) {
            res.video.forEach((vUrl, i) => {
              if (vUrl && typeof vUrl === 'string' && vUrl.startsWith('http')) {
                videos.push({
                  formatId: `tiktok-v-${i}`,
                  qualityKey: i === 0 ? 'hd' : 'sd',
                  quality: i === 0 ? 'Video HD (Tanpa Watermark)' : 'Video SD Normal',
                  ext: 'mp4',
                  cdnUrl: vUrl,
                  isBest: i === 0,
                  badge: i === 0 ? 'HD' : 'SD',
                  hasAudio: true,
                  noWatermark: true
                });
              }
            });
          }

          const audios = [];
          if (Array.isArray(res.audio)) {
            res.audio.forEach((aUrl) => {
              if (aUrl && typeof aUrl === 'string' && aUrl.startsWith('http')) {
                audios.push({
                  formatId: 'tiktok-audio',
                  qualityKey: 'mp3',
                  quality: 'Audio MP3 Original',
                  ext: 'mp3',
                  cdnUrl: aUrl,
                  bitrate: '320kbps',
                  isBest: true
                });
              }
            });
          }

          if (videos.length > 0 || audios.length > 0) {
            return {
              id: String(Date.now()),
              title,
              description: '',
              uploader: 'TikTok Creator',
              thumbnail,
              duration: 0,
              durationFormatted: '',
              platform: 'tiktok',
              platformName: 'TikTok',
              isStory: false,
              contentType: 'video',
              downloads: {
                videos,
                audios,
                images: [],
                stories: []
              },
              sourceUrl: url,
              engine: 'btch-ttdl'
            };
          }
        }
      } catch (err) {
        console.warn('[scraper] btch.ttdl failed:', err.message);
      }
    }

    return null;
  }

  /**
   * Scrape Instagram (Reels, Posts, Carousels, Stories, Multi-items)
   * Primary: SnapVideo scraper logic
   * Secondary: btch-downloader.igdl
   */
  async scrapeInstagram(url) {
    const isStory = /stories/i.test(url);

    // 1. cakkatrok-instagram-downloader (SnapVideo scraper)
    if (snapVideo) {
      try {
        let result = null;
        if (isStory) {
          const match = url.match(/stories\/([a-zA-Z0-9._]+)/i);
          const username = match ? match[1] : url;
          try {
            result = await snapVideo.story(username);
          } catch (e) {
            result = await snapVideo(url);
          }
        } else {
          result = await snapVideo(url);
        }

        if (result && result.status === 'ok' && Array.isArray(result.media) && result.media.length > 0) {
          const mediaList = result.media.filter((m) => m && m.url && m.url.startsWith('http'));

          if (mediaList.length > 0) {
            const rawHtml = result.raw?.data || '';
            const thumbs = [];
            const imgRegex = /<img[^>]+src=["']([^"']+)["']/gi;
            let m;
            while ((m = imgRegex.exec(rawHtml)) !== null) {
              if (m[1] && !m[1].includes('data:image')) {
                thumbs.push(m[1]);
              }
            }

            const mainThumb = thumbs[0] || mediaList[0].url;
            const title = `Instagram ${isStory ? 'Story' : 'Media'} (${mediaList.length} Item)`;

            const videos = [];
            const images = [];
            const stories = [];

            mediaList.forEach((item, index) => {
              const itemType = item.type === 'photo' ? 'photo' : 'video';
              const itemThumb = thumbs[index] || (itemType === 'photo' ? item.url : mainThumb);

              // Add to stories multi-item list
              stories.push({
                index: index + 1,
                id: `story-${index + 1}`,
                type: itemType,
                url: item.url,
                cdnUrl: item.url,
                thumbnail: itemThumb,
                title: item.filename || `Story Slide ${index + 1}`,
                ext: itemType === 'photo' ? 'jpg' : 'mp4'
              });

              if (itemType === 'video') {
                videos.push({
                  formatId: `ig-video-${index + 1}`,
                  qualityKey: 'hd',
                  quality: `Video #${index + 1} (Kualitas Asli HD)`,
                  resolution: '1080p / HD',
                  ext: 'mp4',
                  cdnUrl: item.url,
                  isBest: index === 0,
                  badge: `Slide ${index + 1}`,
                  hasAudio: true,
                  noWatermark: true,
                  index: index + 1
                });
              } else {
                images.push({
                  id: `ig-photo-${index + 1}`,
                  index: index + 1,
                  url: item.url,
                  cdnUrl: item.url,
                  thumbnail: itemThumb,
                  title: item.filename || `Foto Slide ${index + 1}`,
                  ext: 'jpg'
                });
              }
            });

            return {
              id: String(Date.now()),
              title,
              description: '',
              uploader: 'Instagram User',
              thumbnail: mainThumb,
              duration: 0,
              durationFormatted: '',
              platform: 'instagram',
              platformName: 'Instagram',
              isStory,
              contentType: isStory ? 'story' : (images.length > 0 && videos.length === 0 ? 'carousel' : 'video'),
              downloads: {
                videos,
                audios: [],
                images,
                stories
              },
              sourceUrl: url,
              engine: 'snapvideo'
            };
          }
        }
      } catch (err) {
        console.warn('[scraper] SnapVideo Instagram attempt failed:', err.message);
      }
    }

    // 2. ruhend-scraper fallback (igdl2 / igdl)
    if (ruhend && (typeof ruhend.igdl2 === 'function' || typeof ruhend.igdl === 'function')) {
      try {
        const res = typeof ruhend.igdl2 === 'function' ? await ruhend.igdl2(url) : await ruhend.igdl(url);
        const list = Array.isArray(res) ? res : (res && Array.isArray(res.data) ? res.data : []);
        const validList = list.filter((item) => item && (item.url || item.download_url));

        if (validList.length > 0) {
          const title = `Instagram ${isStory ? 'Story' : 'Media'} (${validList.length} Item)`;
          const mainThumb = validList[0].thumbnail || validList[0].url || '';
          const videos = [];
          const images = [];
          const stories = [];

          validList.forEach((item, index) => {
            const dlUrl = item.url || item.download_url;
            const isVid = /\.(mp4|mov)/i.test(dlUrl) || (item.resolution && !item.resolution.includes('jpg'));
            const itemType = isVid ? 'video' : 'photo';
            const itemExt = isVid ? 'mp4' : 'jpg';
            const itemThumb = item.thumbnail || mainThumb;

            stories.push({
              index: index + 1,
              id: `story-${index + 1}`,
              type: itemType,
              url: dlUrl,
              cdnUrl: dlUrl,
              thumbnail: itemThumb,
              title: `Instagram ${isStory ? 'Story' : 'Slide'} #${index + 1}`,
              ext: itemExt
            });

            if (isVid) {
              videos.push({
                formatId: `ig-v-${index + 1}`,
                qualityKey: index === 0 ? 'hd' : 'sd',
                quality: `Video #${index + 1} (${item.resolution || 'HD Asli'})`,
                ext: 'mp4',
                cdnUrl: dlUrl,
                isBest: index === 0,
                badge: `Slide ${index + 1}`,
                hasAudio: true,
                noWatermark: true,
                index: index + 1
              });
            } else {
              images.push({
                id: `ig-photo-${index + 1}`,
                index: index + 1,
                url: dlUrl,
                cdnUrl: dlUrl,
                thumbnail: itemThumb,
                title: `Foto #${index + 1}`,
                ext: 'jpg'
              });
            }
          });

          return {
            id: String(Date.now()),
            title,
            description: '',
            uploader: 'Instagram User',
            thumbnail: mainThumb,
            duration: 0,
            durationFormatted: '',
            platform: 'instagram',
            platformName: 'Instagram',
            isStory,
            contentType: isStory ? 'story' : (images.length > 0 && videos.length === 0 ? 'carousel' : 'video'),
            downloads: {
              videos,
              audios: [],
              images,
              stories
            },
            sourceUrl: url,
            engine: 'ruhend-scraper'
          };
        }
      } catch (err) {
        console.warn('[scraper] ruhend-scraper attempt failed:', err.message);
      }
    }

    // 3. btch-downloader.igdl fallback
    if (btch && typeof btch.igdl === 'function') {
      try {
        const res = await btch.igdl(url);
        if (res && res.status && Array.isArray(res.result) && res.result.length > 0) {
          const validItems = res.result.filter((r) => r && r.url && typeof r.url === 'string' && r.url.startsWith('http'));

          if (validItems.length > 0) {
            const title = `Instagram ${isStory ? 'Story' : 'Media'}`;
            const mainThumb = validItems[0].thumbnail || validItems[0].url;
            const videos = [];
            const images = [];
            const stories = [];

            validItems.forEach((item, index) => {
              const isVid = /\.(mp4|mov)/i.test(item.url) || (item.thumbnail && item.thumbnail !== item.url);
              const type = isVid ? 'video' : 'photo';
              const ext = isVid ? 'mp4' : 'jpg';

              stories.push({
                index: index + 1,
                id: `story-${index + 1}`,
                type,
                url: item.url,
                cdnUrl: item.url,
                thumbnail: item.thumbnail || item.url,
                title: `Item #${index + 1}`,
                ext
              });

              if (isVid) {
                videos.push({
                  formatId: `ig-v-${index + 1}`,
                  qualityKey: 'hd',
                  quality: `Video #${index + 1} (Kualitas Asli)`,
                  ext: 'mp4',
                  cdnUrl: item.url,
                  isBest: index === 0,
                  badge: `Item ${index + 1}`,
                  hasAudio: true,
                  noWatermark: true,
                  index: index + 1
                });
              } else {
                images.push({
                  id: `ig-p-${index + 1}`,
                  index: index + 1,
                  url: item.url,
                  cdnUrl: item.url,
                  title: `Foto #${index + 1}`,
                  ext: 'jpg'
                });
              }
            });

            return {
              id: String(Date.now()),
              title,
              description: '',
              uploader: 'Instagram User',
              thumbnail: mainThumb,
              duration: 0,
              durationFormatted: '',
              platform: 'instagram',
              platformName: 'Instagram',
              isStory,
              contentType: isStory ? 'story' : (images.length > 0 && videos.length === 0 ? 'carousel' : 'video'),
              downloads: {
                videos,
                audios: [],
                images,
                stories
              },
              sourceUrl: url,
              engine: 'btch-igdl'
            };
          }
        }
      } catch (err) {
        console.warn('[scraper] btch.igdl attempt failed:', err.message);
      }
    }

    return null;
  }

  /**
   * Scrape Facebook (Reels & Videos)
   * Primary: btch-downloader.fbdown
   */
  async scrapeFacebook(url) {
    if (btch && typeof btch.fbdown === 'function') {
      try {
        const res = await btch.fbdown(url);
        if (res && res.status && (res.HD || res.Normal_video)) {
          const videos = [];

          if (res.HD && typeof res.HD === 'string' && res.HD.startsWith('http')) {
            videos.push({
              formatId: 'fb-hd',
              qualityKey: 'hd',
              quality: 'Facebook Video HD (Kualitas Tinggi 1080p)',
              resolution: '1080p / Full HD',
              height: 1080,
              fps: 30,
              ext: 'mp4',
              cdnUrl: res.HD,
              isBest: true,
              badge: 'HD 1080p',
              hasAudio: true,
              noWatermark: true
            });
          }

          if (res.Normal_video && typeof res.Normal_video === 'string' && res.Normal_video.startsWith('http')) {
            videos.push({
              formatId: 'fb-sd',
              qualityKey: 'sd',
              quality: 'Facebook Video SD (Hemat Kuota 720p/480p)',
              resolution: '720p / SD',
              height: 720,
              fps: 30,
              ext: 'mp4',
              cdnUrl: res.Normal_video,
              isBest: videos.length === 0,
              badge: 'SD 720p',
              hasAudio: true,
              noWatermark: true
            });
          }

          if (videos.length > 0) {
            return {
              id: String(Date.now()),
              title: 'Facebook Video',
              description: '',
              uploader: 'Facebook User',
              thumbnail: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=600&q=80',
              duration: 0,
              durationFormatted: '',
              platform: 'facebook',
              platformName: 'Facebook',
              isStory: /stories/i.test(url),
              contentType: 'video',
              downloads: {
                videos,
                audios: [],
                images: [],
                stories: []
              },
              sourceUrl: url,
              engine: 'btch-fbdown'
            };
          }
        }
      } catch (err) {
        console.warn('[scraper] btch.fbdown failed:', err.message);
      }
    }

    return null;
  }
}

module.exports = new ScraperService();

