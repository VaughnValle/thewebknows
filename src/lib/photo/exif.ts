/**
 * Minimal JPEG metadata reader. Runs entirely in the browser; the photo never
 * leaves the device. Reads the EXIF fields that matter for privacy (location,
 * camera, time taken) and notes other embedded metadata blocks.
 */

export interface PhotoMeta {
  isJpeg: boolean;
  hasExif: boolean;
  gps: { latitude: number; longitude: number; altitude: number | null } | null;
  camera: string | null;
  lens: string | null;
  software: string | null;
  takenAt: string | null;
  /** Other metadata blocks found, e.g. "XMP", "IPTC". */
  other: string[];
}

type Reader = { u16: (o: number) => number; u32: (o: number) => number; i32: (o: number) => number };

function reader(view: DataView, little: boolean): Reader {
  return {
    u16: (o) => view.getUint16(o, little),
    u32: (o) => view.getUint32(o, little),
    i32: (o) => view.getInt32(o, little),
  };
}

const TYPE_SIZE: Record<number, number> = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 7: 1, 9: 4, 10: 8 };

interface Entry {
  type: number;
  count: number;
  /** Absolute offset (in the DataView) of the value bytes. */
  at: number;
}

function readIfd(view: DataView, r: Reader, tiff: number, ifdOffset: number): Map<number, Entry> {
  const out = new Map<number, Entry>();
  const start = tiff + ifdOffset;
  if (start + 2 > view.byteLength) return out;
  const n = r.u16(start);
  for (let i = 0; i < n && i < 512; i++) {
    const e = start + 2 + i * 12;
    if (e + 12 > view.byteLength) break;
    const tag = r.u16(e);
    const type = r.u16(e + 2);
    const count = r.u32(e + 4);
    const size = (TYPE_SIZE[type] ?? 1) * count;
    const at = size <= 4 ? e + 8 : tiff + r.u32(e + 8);
    if (at + size <= view.byteLength) out.set(tag, { type, count, at });
  }
  return out;
}

function ascii(view: DataView, e: Entry | undefined): string | null {
  if (!e || e.type !== 2) return null;
  let s = '';
  for (let i = 0; i < e.count && i < 256; i++) {
    const c = view.getUint8(e.at + i);
    if (c === 0) break;
    s += String.fromCharCode(c);
  }
  s = s.trim();
  return s || null;
}

function rationals(r: Reader, e: Entry | undefined): number[] | null {
  if (!e || (e.type !== 5 && e.type !== 10)) return null;
  const vals: number[] = [];
  for (let i = 0; i < e.count && i < 8; i++) {
    const num = e.type === 5 ? r.u32(e.at + i * 8) : r.i32(e.at + i * 8);
    const den = e.type === 5 ? r.u32(e.at + i * 8 + 4) : r.i32(e.at + i * 8 + 4);
    vals.push(den ? num / den : 0);
  }
  return vals;
}

function longValue(r: Reader, e: Entry | undefined): number | null {
  if (!e) return null;
  if (e.type === 4) return r.u32(e.at);
  if (e.type === 3) return r.u16(e.at);
  return null;
}

function toDegrees(dms: number[] | null, ref: string | null): number | null {
  if (!dms || dms.length < 3) return null;
  const deg = dms[0] + dms[1] / 60 + dms[2] / 3600;
  if (!Number.isFinite(deg)) return null;
  return ref === 'S' || ref === 'W' ? -deg : deg;
}

function startsWith(view: DataView, offset: number, text: string): boolean {
  if (offset + text.length > view.byteLength) return false;
  for (let i = 0; i < text.length; i++) if (view.getUint8(offset + i) !== text.charCodeAt(i)) return false;
  return true;
}

export function readPhotoMeta(buffer: ArrayBuffer): PhotoMeta {
  const view = new DataView(buffer);
  const meta: PhotoMeta = { isJpeg: false, hasExif: false, gps: null, camera: null, lens: null, software: null, takenAt: null, other: [] };
  if (view.byteLength < 4 || view.getUint16(0) !== 0xffd8) return meta;
  meta.isJpeg = true;

  let o = 2;
  while (o + 4 <= view.byteLength) {
    if (view.getUint8(o) !== 0xff) break;
    const marker = view.getUint8(o + 1);
    if (marker === 0xd9 || marker === 0xda) break; // end of image / start of scan
    const len = view.getUint16(o + 2);
    const body = o + 4;
    if (marker === 0xe1 && startsWith(view, body, 'Exif\0\0')) {
      parseExif(view, body + 6, meta);
    } else if (marker === 0xe1 && startsWith(view, body, 'http://ns.adobe.com/xap/')) {
      if (!meta.other.includes('XMP')) meta.other.push('XMP');
    } else if (marker === 0xed) {
      if (!meta.other.includes('IPTC')) meta.other.push('IPTC');
    }
    o += 2 + len;
  }
  return meta;
}

function parseExif(view: DataView, tiff: number, meta: PhotoMeta) {
  if (tiff + 8 > view.byteLength) return;
  const order = view.getUint16(tiff);
  if (order !== 0x4949 && order !== 0x4d4d) return;
  const r = reader(view, order === 0x4949);
  if (r.u16(tiff + 2) !== 0x002a) return;
  meta.hasExif = true;

  const ifd0 = readIfd(view, r, tiff, r.u32(tiff + 4));
  const make = ascii(view, ifd0.get(0x010f));
  const model = ascii(view, ifd0.get(0x0110));
  meta.camera = model ? (make && !model.toLowerCase().startsWith(make.toLowerCase()) ? `${make} ${model}` : model) : make;
  meta.software = ascii(view, ifd0.get(0x0131));
  meta.takenAt = ascii(view, ifd0.get(0x0132));

  const exifPtr = longValue(r, ifd0.get(0x8769));
  if (exifPtr) {
    const exif = readIfd(view, r, tiff, exifPtr);
    meta.takenAt = ascii(view, exif.get(0x9003)) ?? meta.takenAt;
    meta.lens = ascii(view, exif.get(0xa434));
  }

  const gpsPtr = longValue(r, ifd0.get(0x8825));
  if (gpsPtr) {
    const gps = readIfd(view, r, tiff, gpsPtr);
    const lat = toDegrees(rationals(r, gps.get(2)), ascii(view, gps.get(1)));
    const lon = toDegrees(rationals(r, gps.get(4)), ascii(view, gps.get(3)));
    if (lat !== null && lon !== null && !(lat === 0 && lon === 0)) {
      const alt = rationals(r, gps.get(6))?.[0] ?? null;
      meta.gps = { latitude: lat, longitude: lon, altitude: alt };
    }
  }
}

/** "2024:05:01 14:03:22" → "1 May 2024, 14:03" */
export function formatExifDate(raw: string | null): string | null {
  if (!raw) return null;
  const m = raw.match(/^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2})/);
  if (!m) return raw;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]));
  return Number.isNaN(d.getTime()) ? raw : d.toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

/**
 * Re-draw the photo onto a canvas and export it. The new file has no EXIF,
 * XMP or IPTC metadata. Orientation is applied first, so it still looks right.
 */
export async function stripMetadata(file: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0);
  bitmap.close?.();
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not export image'))), 'image/jpeg', 0.92));
}
