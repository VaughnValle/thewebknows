import { describe, expect, it } from 'vitest';
import { formatExifDate, readPhotoMeta } from '../src/lib/photo/exif';

/** Build a tiny little-endian EXIF (TIFF) block with camera, date and GPS tags. */
function buildExif({ gps = true, bigEndian = false } = {}): Uint8Array {
  const le = !bigEndian;
  const buf = new ArrayBuffer(1024);
  const v = new DataView(buf);
  const u16 = (o: number, x: number) => v.setUint16(o, x, le);
  const u32 = (o: number, x: number) => v.setUint32(o, x, le);
  const str = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));

  v.setUint16(0, le ? 0x4949 : 0x4d4d);
  u16(2, 0x2a);
  u32(4, 8); // IFD0 at 8

  // IFD0: Make, Model, ExifPtr, GPSPtr
  const ifd0 = 8;
  const entries0 = gps ? 4 : 3;
  u16(ifd0, entries0);
  let data = 200;
  const ascii = (entry: number, tag: number, text: string) => {
    u16(entry, tag);
    u16(entry + 2, 2);
    u32(entry + 4, text.length + 1);
    u32(entry + 8, data);
    str(data, text + '\0');
    data += text.length + 2;
  };
  ascii(ifd0 + 2, 0x010f, 'Apple');
  ascii(ifd0 + 14, 0x0110, 'iPhone 15 Pro');
  // Exif IFD pointer
  u16(ifd0 + 26, 0x8769);
  u16(ifd0 + 28, 4);
  u32(ifd0 + 30, 1);
  u32(ifd0 + 34, 100);
  if (gps) {
    u16(ifd0 + 38, 0x8825);
    u16(ifd0 + 40, 4);
    u32(ifd0 + 42, 1);
    u32(ifd0 + 46, 140);
  }

  // Exif IFD at 100: DateTimeOriginal
  u16(100, 1);
  ascii(102, 0x9003, '2024:05:01 14:03:22');

  if (gps) {
    // GPS IFD at 140: LatRef, Lat, LonRef, Lon
    u16(140, 4);
    const ref = (entry: number, tag: number, c: string) => {
      u16(entry, tag);
      u16(entry + 2, 2);
      u32(entry + 4, 2);
      v.setUint8(entry + 8, c.charCodeAt(0));
    };
    const rat3 = (entry: number, tag: number, vals: [number, number][]) => {
      u16(entry, tag);
      u16(entry + 2, 5);
      u32(entry + 4, 3);
      u32(entry + 8, data);
      vals.forEach(([n, d], i) => {
        u32(data + i * 8, n);
        u32(data + i * 8 + 4, d);
      });
      data += 24;
    };
    ref(142, 1, 'N');
    rat3(154, 2, [[14, 1], [40, 1], [3360, 100]]); // 14°40'33.6" N
    ref(166, 3, 'E');
    rat3(178, 4, [[121, 1], [2, 1], [3720, 100]]); // 121°2'37.2" E
  }
  return new Uint8Array(buf, 0, data);
}

function jpeg(...segments: Uint8Array[]): ArrayBuffer {
  const parts: number[] = [0xff, 0xd8];
  for (const s of segments) parts.push(...s);
  parts.push(0xff, 0xda, 0x00, 0x02, 0xff, 0xd9);
  return new Uint8Array(parts).buffer;
}

function segment(marker: number, header: string, body: Uint8Array): Uint8Array {
  const h = [...header].map((c) => c.charCodeAt(0));
  const len = 2 + h.length + body.length;
  return new Uint8Array([0xff, marker, len >> 8, len & 0xff, ...h, ...body]);
}

describe('photo metadata', () => {
  it('reads GPS, camera and date from EXIF', () => {
    const meta = readPhotoMeta(jpeg(segment(0xe1, 'Exif\0\0', buildExif())));
    expect(meta.isJpeg).toBe(true);
    expect(meta.hasExif).toBe(true);
    expect(meta.camera).toBe('Apple iPhone 15 Pro');
    expect(meta.takenAt).toBe('2024:05:01 14:03:22');
    expect(meta.gps?.latitude).toBeCloseTo(14.676, 3);
    expect(meta.gps?.longitude).toBeCloseTo(121.0437, 3);
  });

  it('handles big-endian EXIF', () => {
    const meta = readPhotoMeta(jpeg(segment(0xe1, 'Exif\0\0', buildExif({ bigEndian: true }))));
    expect(meta.gps?.latitude).toBeCloseTo(14.676, 3);
  });

  it('reports no location when there is no GPS block', () => {
    const meta = readPhotoMeta(jpeg(segment(0xe1, 'Exif\0\0', buildExif({ gps: false }))));
    expect(meta.gps).toBeNull();
    expect(meta.camera).toBe('Apple iPhone 15 Pro');
  });

  it('notices XMP and IPTC blocks', () => {
    const meta = readPhotoMeta(jpeg(segment(0xe1, 'http://ns.adobe.com/xap/1.0/\0', new Uint8Array(4)), segment(0xed, 'Photoshop 3.0\0', new Uint8Array(4))));
    expect(meta.other).toEqual(['XMP', 'IPTC']);
    expect(meta.hasExif).toBe(false);
  });

  it('rejects non-JPEG files and survives garbage', () => {
    expect(readPhotoMeta(new Uint8Array([0x89, 0x50, 0x4e, 0x47]).buffer).isJpeg).toBe(false);
    const broken = readPhotoMeta(jpeg(segment(0xe1, 'Exif\0\0', new Uint8Array([0x49, 0x49, 0x2a, 0x00, 0xff, 0xff, 0xff, 0x7f]))));
    expect(broken.gps).toBeNull();
  });

  it('formats EXIF dates', () => {
    expect(formatExifDate('2024:05:01 14:03:22')).toMatch(/2024/);
    expect(formatExifDate(null)).toBeNull();
  });
});
