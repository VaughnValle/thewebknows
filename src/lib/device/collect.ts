/**
 * Reads what any website can read from the browser, without asking permission.
 * Nothing here is sent anywhere: values are only shown back to the visitor.
 * Every probe is optional and guarded, so missing APIs just mean "not shared".
 */

export interface Signals {
  ua: string;
  brands?: { brand: string; version: string }[];
  platformVersion?: string;
  maxTouchPoints: number;
  languages: string[];
  timezone: string | null;
  now: Date;
  screen: { width: number; height: number; colorDepth: number } | null;
  viewport: { width: number; height: number };
  pixelRatio: number;
  cores: number | null;
  memoryGb: number | null;
  gpu: string | null;
  pointer: 'fine' | 'coarse' | 'none' | null;
  battery: { level: number; charging: boolean } | null;
  connection: { type: string | null; effectiveType: string | null; downlinkMbps: number | null; rttMs: number | null; saveData: boolean } | null;
  media: { cameras: number; microphones: number; speakers: number } | null;
  storageQuota: number | null;
  dnt: boolean | null;
  gpc: boolean | null;
  cookies: boolean;
  darkMode: boolean | null;
  reducedMotion: boolean | null;
  plugins: number;
  referrer: string | null;
  fingerprint: { hash: string; traits: number } | null;
}

type Nav = Navigator & {
  userAgentData?: { brands?: { brand: string; version: string }[]; getHighEntropyValues?: (h: string[]) => Promise<{ platformVersion?: string }> };
  deviceMemory?: number;
  globalPrivacyControl?: boolean;
  connection?: { type?: string; effectiveType?: string; downlink?: number; rtt?: number; saveData?: boolean };
  getBattery?: () => Promise<{ level: number; charging: boolean }>;
};

const isJsdom = () => typeof navigator !== 'undefined' && /jsdom/i.test(navigator.userAgent);

function media(query: string): boolean | null {
  try {
    return typeof window.matchMedia === 'function' ? window.matchMedia(query).matches : null;
  } catch {
    return null;
  }
}

async function safe<T>(fn: () => Promise<T> | T, timeoutMs = 1500): Promise<T | null> {
  try {
    return await Promise.race([Promise.resolve().then(fn), new Promise<null>((r) => setTimeout(() => r(null), timeoutMs))]);
  } catch {
    return null;
  }
}

function webglInfo(): { renderer: string | null; params: string } | null {
  if (isJsdom()) return null;
  try {
    const canvas = document.createElement('canvas');
    const gl = (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')) as WebGLRenderingContext | null;
    if (!gl) return null;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const renderer = (ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER)) as string;
    const params = [gl.MAX_TEXTURE_SIZE, gl.MAX_RENDERBUFFER_SIZE, gl.MAX_VERTEX_ATTRIBS, gl.MAX_VIEWPORT_DIMS]
      .map((p) => String(gl.getParameter(p)))
      .join('|');
    return { renderer: renderer || null, params };
  } catch {
    return null;
  }
}

function canvasSignature(): string | null {
  if (isJsdom()) return null;
  try {
    const c = document.createElement('canvas');
    c.width = 240;
    c.height = 60;
    const ctx = c.getContext('2d');
    if (!ctx) return null;
    ctx.textBaseline = 'top';
    ctx.font = "16px 'Arial'";
    ctx.fillStyle = '#f60';
    ctx.fillRect(100, 1, 62, 20);
    ctx.fillStyle = '#069';
    ctx.fillText('thewebknows.me 🌐 ∑', 2, 15);
    ctx.fillStyle = 'rgba(102, 204, 0, 0.7)';
    ctx.fillText('thewebknows.me 🌐 ∑', 4, 17);
    return c.toDataURL();
  } catch {
    return null;
  }
}

async function audioSignature(): Promise<string | null> {
  if (isJsdom()) return null;
  const Ctx = (window as unknown as { OfflineAudioContext?: typeof OfflineAudioContext }).OfflineAudioContext;
  if (!Ctx) return null;
  const ctx = new Ctx(1, 5000, 44100);
  const osc = ctx.createOscillator();
  osc.type = 'triangle';
  osc.frequency.value = 10000;
  const comp = ctx.createDynamicsCompressor();
  osc.connect(comp);
  comp.connect(ctx.destination);
  osc.start(0);
  const buf = await ctx.startRendering();
  const data = buf.getChannelData(0);
  let sum = 0;
  for (let i = 4000; i < 5000; i++) sum += Math.abs(data[i]);
  return sum.toFixed(6);
}

export async function sha256Hex(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Synchronous part: instant, so the page can render immediately. */
export function collectBasic(): Signals {
  const nav = navigator as Nav;
  let timezone: string | null = null;
  try {
    timezone = Intl.DateTimeFormat().resolvedOptions().timeZone ?? null;
  } catch {
    /* not shared */
  }
  const c = nav.connection;
  const pointer = media('(pointer: fine)') ? 'fine' : media('(pointer: coarse)') ? 'coarse' : media('(pointer: none)') ? 'none' : null;
  return {
    ua: nav.userAgent,
    brands: nav.userAgentData?.brands,
    maxTouchPoints: nav.maxTouchPoints ?? 0,
    languages: [...(nav.languages?.length ? nav.languages : [nav.language].filter(Boolean))],
    timezone,
    now: new Date(),
    screen: typeof screen !== 'undefined' && screen.width ? { width: screen.width, height: screen.height, colorDepth: screen.colorDepth } : null,
    viewport: { width: window.innerWidth, height: window.innerHeight },
    pixelRatio: window.devicePixelRatio || 1,
    cores: nav.hardwareConcurrency || null,
    memoryGb: typeof nav.deviceMemory === 'number' ? nav.deviceMemory : null,
    gpu: webglInfo()?.renderer ?? null,
    pointer,
    battery: null,
    connection: c
      ? {
          type: c.type ?? null,
          effectiveType: c.effectiveType ?? null,
          downlinkMbps: typeof c.downlink === 'number' ? c.downlink : null,
          rttMs: typeof c.rtt === 'number' ? c.rtt : null,
          saveData: Boolean(c.saveData),
        }
      : null,
    media: null,
    storageQuota: null,
    dnt: nav.doNotTrack === '1' ? true : nav.doNotTrack === '0' ? false : null,
    gpc: typeof nav.globalPrivacyControl === 'boolean' ? nav.globalPrivacyControl : null,
    cookies: nav.cookieEnabled,
    darkMode: media('(prefers-color-scheme: dark)'),
    reducedMotion: media('(prefers-reduced-motion: reduce)'),
    plugins: nav.plugins?.length ?? 0,
    referrer: document.referrer || null,
    fingerprint: null,
  };
}

/** Asynchronous extras: battery, devices, storage, OS version and the fingerprint. */
export async function collectExtras(base: Signals): Promise<Signals> {
  const nav = navigator as Nav;
  const [battery, devices, estimate, hints, audio] = await Promise.all([
    safe(async () => {
      const b = await nav.getBattery?.();
      return b ? { level: b.level, charging: b.charging } : null;
    }),
    safe(async () => (await navigator.mediaDevices?.enumerateDevices?.()) ?? null),
    safe(async () => (await navigator.storage?.estimate?.()) ?? null),
    safe(async () => (await nav.userAgentData?.getHighEntropyValues?.(['platformVersion'])) ?? null),
    safe(audioSignature),
  ]);
  const next: Signals = {
    ...base,
    battery: battery ?? null,
    media: devices
      ? {
          cameras: devices.filter((d) => d.kind === 'videoinput').length,
          microphones: devices.filter((d) => d.kind === 'audioinput').length,
          speakers: devices.filter((d) => d.kind === 'audiooutput').length,
        }
      : null,
    storageQuota: typeof estimate?.quota === 'number' ? estimate.quota : null,
    platformVersion: hints?.platformVersion,
  };

  // Fingerprint: many small traits that are boring alone but rarely identical together.
  const gl = webglInfo();
  const traits: Record<string, unknown> = {
    ua: base.ua,
    languages: base.languages,
    timezone: base.timezone,
    screen: base.screen,
    pixelRatio: base.pixelRatio,
    cores: base.cores,
    memory: base.memoryGb,
    touch: base.maxTouchPoints,
    gpu: gl?.renderer,
    gpuParams: gl?.params,
    canvas: canvasSignature(),
    audio,
    plugins: base.plugins,
    dark: base.darkMode,
  };
  const present = Object.values(traits).filter((v) => v !== null && v !== undefined).length;
  const hash = await safe(() => sha256Hex(JSON.stringify(traits)));
  next.fingerprint = hash ? { hash, traits: present } : null;
  return next;
}
