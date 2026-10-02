import { describe, expect, it } from 'vitest';
import { findLocalAddresses, parseCandidate } from '../src/lib/device/webrtc';

describe('ICE candidate parsing', () => {
  it('reads an IPv4 host candidate', () => {
    expect(parseCandidate('candidate:842163049 1 udp 2122260223 192.168.1.24 51772 typ host generation 0')).toEqual({
      address: '192.168.1.24',
      masked: false,
      kind: 'IPv4',
    });
  });
  it('flags mDNS-masked candidates', () => {
    expect(parseCandidate('candidate:1 1 udp 2122260223 a1b2c3d4-e5f6.local 51772 typ host')).toEqual({
      address: 'a1b2c3d4-e5f6.local',
      masked: true,
      kind: 'mDNS',
    });
  });
  it('recognises IPv6 host candidates', () => {
    expect(parseCandidate('candidate:1 1 udp 1 fe80::1c2d 51772 typ host')?.kind).toBe('IPv6');
  });
  it('ignores non-host (server-reflexive) candidates', () => {
    expect(parseCandidate('candidate:2 1 udp 1 203.0.113.5 51772 typ srflx raddr 0.0.0.0')).toBeNull();
    expect(parseCandidate('garbage')).toBeNull();
  });
});

class FakePC {
  onicecandidate: ((e: { candidate: { candidate: string } | null }) => void) | null = null;
  onicegatheringstatechange: (() => void) | null = null;
  iceGatheringState = 'gathering';
  constructor(_: unknown, private lines: string[] = FakePC.lines) {}
  static lines: string[] = [];
  createDataChannel() {}
  async createOffer() {
    return {} as RTCSessionDescriptionInit;
  }
  async setLocalDescription() {
    queueMicrotask(() => {
      for (const l of this.lines) this.onicecandidate?.({ candidate: { candidate: l } });
      this.onicecandidate?.({ candidate: null });
      this.iceGatheringState = 'complete';
      this.onicegatheringstatechange?.();
    });
  }
  close() {}
}

describe('local address gathering', () => {
  it('returns distinct host addresses', async () => {
    FakePC.lines = [
      'candidate:1 1 udp 1 192.168.1.24 5 typ host',
      'candidate:2 1 udp 1 192.168.1.24 6 typ host', // duplicate
      'candidate:3 1 udp 1 203.0.113.5 7 typ srflx', // not local
    ];
    const found = await findLocalAddresses(500, FakePC as unknown as typeof RTCPeerConnection);
    expect(found).toEqual([{ address: '192.168.1.24', masked: false, kind: 'IPv4' }]);
  });
  it('returns nothing when WebRTC is unavailable', async () => {
    expect(await findLocalAddresses(100, undefined)).toEqual([]);
  });
});
