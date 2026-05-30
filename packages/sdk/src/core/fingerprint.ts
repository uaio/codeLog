import { fnv1a, combineHashes } from './utils/hash.js';

const STORAGE_KEY = '_codelog_fp';

/**
 * Generate a stable browser fingerprint based on hardware and rendering characteristics.
 *
 * The fingerprint combines:
 *   - User agent string
 *   - Screen dimensions + color depth + pixel ratio
 *   - Hardware: CPU cores, device memory
 *   - Locale: timezone + language
 *   - Canvas rendering fingerprint (font/GPU-level differences)
 *   - WebGL renderer string (GPU model)
 *
 * Result is stored in localStorage so that the SAME browser/device always returns
 * the same ID, even across page loads and navigations.
 */
export function getOrCreateFingerprint(): string {
  // 1. Try to load existing stable fingerprint
  try {
    const cached = localStorage.getItem(STORAGE_KEY);
    if (cached && /^[0-9a-f]{16,}$/.test(cached)) {
      return cached;
    }
  } catch {
    // localStorage blocked (private browsing, sandboxed iframe)
  }

  // 2. Compute from stable characteristics
  const fp = computeFingerprint();

  // 3. Persist so the next load reuses the same value
  try {
    localStorage.setItem(STORAGE_KEY, fp);
  } catch {
    // ok to skip
  }

  return fp;
}

function computeFingerprint(): string {
  const parts: string[] = [
    // User agent (browser name + version + OS)
    navigator.userAgent,
    // Screen
    `${screen.width}x${screen.height}x${screen.colorDepth}x${window.devicePixelRatio}`,
    // Locale
    Intl.DateTimeFormat().resolvedOptions().timeZone,
    navigator.language,
    // Hardware
    String(navigator.hardwareConcurrency ?? 0),
    String((navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 0),
    // Touch
    String(navigator.maxTouchPoints),
    // Canvas fingerprint
    getCanvasFingerprint(),
    // WebGL renderer
    getWebGLRenderer(),
    // Audio context fingerprint
    getAudioFingerprint(),
  ];

  return combineHashes(...parts);
}

/** Draw text + shapes to a canvas and hash the pixel data for GPU-level uniqueness. */
function getCanvasFingerprint(): string {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 240;
    canvas.height = 60;
    const ctx = canvas.getContext('2d');
    if (!ctx) return 'no-canvas';

    // Background
    ctx.fillStyle = '#f0f0f0';
    ctx.fillRect(0, 0, 240, 60);

    // Text with multiple fonts (rendering differs between engines/OSes)
    ctx.fillStyle = '#1a1a2e';
    ctx.font = '14px "Arial", sans-serif';
    ctx.fillText('codeLog 🔍 BrowserFP', 10, 22);

    ctx.font = 'bold 11px "Courier New", monospace';
    ctx.fillStyle = '#16213e';
    ctx.fillText('abcdef ABCDEF 012345', 10, 42);

    // Shape: arc (antialiasing varies)
    ctx.strokeStyle = '#0f3460';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(200, 30, 18, 0, Math.PI * 2);
    ctx.stroke();

    return fnv1a(canvas.toDataURL().slice(22, 100)); // sample middle of data URI
  } catch {
    return 'canvas-blocked';
  }
}

/** Get GPU renderer info from WebGL — unique per GPU model. */
function getWebGLRenderer(): string {
  try {
    const canvas = document.createElement('canvas');
    const gl =
      (canvas.getContext('webgl') as WebGLRenderingContext | null) ??
      (canvas.getContext('experimental-webgl') as WebGLRenderingContext | null);
    if (!gl) return 'no-webgl';
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    if (!ext) return 'no-ext';
    return gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) as string;
  } catch {
    return 'webgl-blocked';
  }
}

/**
 * AudioContext fingerprint — oscillator frequency response differs slightly
 * between browser engine builds. We only read the hash asynchronously but
 * return a synchronous stub; the main fingerprint doesn't need this to be exact.
 */
function getAudioFingerprint(): string {
  try {
    const AudioContextClass =
      window.AudioContext ??
      (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return 'no-audio';

    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const analyser = ctx.createAnalyser();
    const gain = ctx.createGain();
    gain.gain.value = 0; // silent
    osc.connect(analyser);
    analyser.connect(gain);
    gain.connect(ctx.destination);
    osc.start(0);

    const freqData = new Float32Array(analyser.frequencyBinCount);
    analyser.getFloatFrequencyData(freqData);
    osc.stop();
    void ctx.close();

    // Sample first 32 values
    const sample = freqData.slice(0, 32).join(',');
    return fnv1a(sample);
  } catch {
    return 'audio-blocked';
  }
}
