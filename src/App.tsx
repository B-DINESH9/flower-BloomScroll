import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import Particles from './Particles';
import FallingPetals from './FallingPetals';

const VIDEO_URL =
  'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260616_212935_bbf608da-62d1-4f25-9be4-c346e4d09cc8.mp4';

const SCROLL_HEIGHT_VH = 500;
const TOTAL_FRAMES = 150; // Number of frames to extract — more = smoother

const App: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const framesRef = useRef<ImageBitmap[]>([]);
  const [progress, setProgress] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingPct, setLoadingPct] = useState(0);
  const [loadingStage, setLoadingStage] = useState('Downloading video…');

  // ── Extract all frames from video into ImageBitmap array ────
  useEffect(() => {
    const controller = new AbortController();

    (async () => {
      try {
        // Step 1: Download video as blob
        setLoadingStage('Downloading video…');
        const response = await fetch(VIDEO_URL, { signal: controller.signal });
        const contentLength = response.headers.get('content-length');
        const total = contentLength ? parseInt(contentLength, 10) : 0;
        const reader = response.body?.getReader();
        if (!reader) return;

        const chunks: Uint8Array[] = [];
        let received = 0;
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
          received += value.length;
          if (total > 0) setLoadingPct(Math.round((received / total) * 50)); // 0-50%
        }

        const blob = new Blob(chunks, { type: 'video/mp4' });
        const blobUrl = URL.createObjectURL(blob);

        // Step 2: Create offscreen video to extract frames
        setLoadingStage('Extracting frames…');
        const video = document.createElement('video');
        video.muted = true;
        video.playsInline = true;
        video.preload = 'auto';
        video.src = blobUrl;

        await new Promise<void>((resolve) => {
          video.addEventListener('loadedmetadata', () => resolve(), { once: true });
        });

        // Also wait for enough data to seek
        await new Promise<void>((resolve) => {
          if (video.readyState >= 2) { resolve(); return; }
          video.addEventListener('canplay', () => resolve(), { once: true });
        });

        const duration = video.duration;
        const vw = video.videoWidth;
        const vh = video.videoHeight;

        // Offscreen canvas for frame capture
        const offscreen = document.createElement('canvas');
        offscreen.width = vw;
        offscreen.height = vh;
        const offCtx = offscreen.getContext('2d')!;

        const frames: ImageBitmap[] = [];

        // Step 3: Seek to each position and capture frame
        for (let i = 0; i < TOTAL_FRAMES; i++) {
          const time = (i / (TOTAL_FRAMES - 1)) * duration;

          await new Promise<void>((resolve) => {
            const onSeeked = () => {
              video.removeEventListener('seeked', onSeeked);
              resolve();
            };
            video.addEventListener('seeked', onSeeked);
            video.currentTime = time;
          });

          // Draw current frame to offscreen canvas
          offCtx.drawImage(video, 0, 0, vw, vh);

          // Capture as ImageBitmap (very fast to draw later)
          const bitmap = await createImageBitmap(offscreen);
          frames.push(bitmap);

          setLoadingPct(50 + Math.round(((i + 1) / TOTAL_FRAMES) * 50)); // 50-100%
        }

        framesRef.current = frames;
        URL.revokeObjectURL(blobUrl);

        // Draw first frame on the display canvas
        const displayCanvas = canvasRef.current;
        if (displayCanvas) {
          displayCanvas.width = vw;
          displayCanvas.height = vh;
          const ctx = displayCanvas.getContext('2d');
          if (ctx && frames[0]) {
            ctx.drawImage(frames[0], 0, 0);
          }
        }

        setLoading(false);
      } catch (err) {
        if ((err as Error).name !== 'AbortError') console.error(err);
      }
    })();

    return () => controller.abort();
  }, []);

  // ── Scroll → pick frame and draw it ─────────────────────────
  useEffect(() => {
    if (loading) return;

    let ticking = false;

    const onScroll = () => {
      if (ticking) return;
      ticking = true;

      requestAnimationFrame(() => {
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
        if (maxScroll <= 0) { ticking = false; return; }

        const pct = Math.min(Math.max(scrollTop / maxScroll, 0), 1);
        setProgress(pct);

        const frames = framesRef.current;
        if (frames.length === 0) { ticking = false; return; }

        const frameIndex = Math.min(
          Math.floor(pct * (frames.length - 1)),
          frames.length - 1
        );

        const displayCanvas = canvasRef.current;
        if (displayCanvas) {
          const ctx = displayCanvas.getContext('2d');
          if (ctx && frames[frameIndex]) {
            ctx.drawImage(frames[frameIndex], 0, 0);
          }
        }

        ticking = false;
      });
    };

    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [loading]);

  // ── Derived UI opacity ──────────────────────────────────────
  const textOpacity = progress < 0.2 ? 0 : progress > 0.6 ? 1 : (progress - 0.2) / 0.4;
  const ctaOpacity = progress < 0.6 ? 0 : Math.min((progress - 0.6) / 0.2, 1);
  const chevronOpacity = progress < 0.02 ? 1 : 0;

  return (
    <>
      {/* Invisible scroll spacer */}
      <div style={{ height: `${SCROLL_HEIGHT_VH}vh` }} />

      {/* Loading Screen */}
      {loading && (
        <div className="fixed inset-0 z-[100] bg-[#010101] flex flex-col items-center justify-center gap-4">
          <span className="text-white font-bold text-xl tracking-tight">veldara</span>
          <div className="w-56 h-1.5 bg-gray-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-[#2C5C88] rounded-full transition-all duration-200"
              style={{ width: `${loadingPct}%` }}
            />
          </div>
          <p className="text-gray-500 text-xs font-mono">{loadingStage} {loadingPct}%</p>
        </div>
      )}

      {/* Display Canvas — FIXED, centered, flower stays in middle */}
      <div className="fixed inset-0 flex items-center justify-center" style={{ zIndex: 0, backgroundColor: '#010101' }}>
        <canvas
          ref={canvasRef}
          className="max-w-full max-h-full"
          style={{ objectFit: 'contain' }}
        />
      </div>

      {/* Cinematic Overlay — FIXED */}
      <div className="fixed inset-0 pointer-events-none" style={{ zIndex: 1 }}>
        <div
          className="absolute inset-0"
          style={{ background: 'radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.65) 100%)' }}
        />
        <div
          className="absolute inset-0"
          style={{ background: 'radial-gradient(ellipse at center, rgba(44,92,136,0.1) 0%, transparent 55%)' }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
      </div>

      {/* Particles */}
      <Particles />

      {/* Falling Petals */}
      <FallingPetals />

      {/* Nav — FIXED */}
      <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 sm:px-6 md:px-10 py-4 sm:py-5">
        <div className="flex items-center gap-4 sm:gap-8">
          <span className="text-white font-bold text-lg sm:text-xl tracking-tight">veldara</span>
          <div className="hidden sm:flex items-center gap-6">
            <a href="#" className="text-sm text-gray-300 hover:text-white transition-colors">Guides</a>
            <a href="#" className="text-sm text-gray-300 hover:text-white transition-colors">Journal</a>
          </div>
        </div>
        <div className="flex items-center gap-3 sm:gap-4">
          <a href="#" className="text-gray-300 hover:text-white transition-colors">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
            </svg>
          </a>
          <a href="#" className="text-gray-300 hover:text-white transition-colors">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189z" />
            </svg>
          </a>
          <a href="#" className="text-gray-300 hover:text-white transition-colors">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L5.09 21.75H1.78l7.509-8.58L1.14 2.25H7.96l4.71 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
          </a>
        </div>
      </nav>

      {/* Hero Content — FIXED at bottom */}
      <div className="fixed inset-0 flex flex-col pointer-events-none" style={{ zIndex: 2 }}>
        <div className="flex-1 flex flex-col items-center justify-end pb-[6rem] sm:pb-[7rem] px-4">
          <p
            className="text-sm md:text-base text-gray-400 tracking-wide mb-3 sm:mb-4 transition-opacity duration-500"
            style={{ opacity: textOpacity }}
          >
            Our Purpose:
          </p>
          <h1
            className="text-2xl sm:text-3xl md:text-5xl lg:text-6xl font-semibold leading-tight max-w-3xl text-white text-center transition-opacity duration-500"
            style={{ opacity: textOpacity }}
          >
            Instantly craft immersive{' '}
            <span className="relative inline-block whitespace-nowrap">
              <span className="absolute bottom-1 left-0 w-full h-[10px] bg-[#2C5C88] rounded-sm" />
              <span className="relative">3D worlds</span>
            </span>{' '}
            on the web.
          </h1>
          <div
            className="mt-8 sm:mt-10 flex flex-col sm:flex-row gap-3 sm:gap-4 items-center transition-opacity duration-500 pointer-events-auto"
            style={{ opacity: ctaOpacity }}
          >
            <div className="flex items-center bg-[#1a1a1a] border border-gray-700/50 rounded-lg px-6 sm:px-8 py-3.5 sm:py-4">
              <span className="text-[#2C5C88] font-mono text-sm mr-3">{'>'}</span>
              <span className="text-xs sm:text-sm text-gray-200 font-mono">npm i @veldara/core</span>
            </div>
            <button className="bg-[#2C5C88] hover:bg-[#3a7aad] text-white font-medium rounded-lg px-8 py-3.5 sm:py-4 text-sm transition-colors flex items-center gap-2 w-full sm:w-auto justify-center">
              Get Started
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
        <div
          className="pb-8 flex justify-center transition-opacity duration-700"
          style={{ opacity: chevronOpacity }}
        >
          <ChevronDown className="w-6 h-6 text-gray-500 animate-bounce" />
        </div>
      </div>
    </>
  );
};

export default App;
