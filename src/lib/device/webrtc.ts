/**
 * Local-network address leak via WebRTC. With no STUN/TURN server configured,
 * the browser still gathers "host" ICE candidates that expose a local address.
 * Nothing leaves the device; we read our own candidates and show them back.
 */

export interface LocalAddress {
  address: string;
  /** true for mDNS-masked candidates like "a1b2…​.local" (the modern default). */
  masked: boolean;
  kind: 'IPv4' | 'IPv6' | 'mDNS';
}

/** Pull the address out of an ICE candidate line. Pure, so it can be tested. */
export function parseCandidate(candidate: string): LocalAddress | null {
  // candidate:842163049 1 udp 2122260223 192.168.1.24 51772 typ host ...
  const parts = candidate.split(' ');
  const idx = parts.indexOf('typ');
  if (idx < 5) return null;
  if (parts[idx + 1] !== 'host') return null; // only locally-known addresses
  const address = parts[4];
  if (!address) return null;
  if (/\.local$/i.test(address)) return { address, masked: true, kind: 'mDNS' };
  if (address.includes(':')) return { address, masked: false, kind: 'IPv6' };
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(address)) return { address, masked: false, kind: 'IPv4' };
  return null;
}

type PC = typeof RTCPeerConnection;

/** Gather host candidates for ~`timeoutMs`, returning the distinct local addresses found. */
export async function findLocalAddresses(timeoutMs = 2500, Impl?: PC): Promise<LocalAddress[]> {
  const Ctor = Impl ?? (typeof RTCPeerConnection !== 'undefined' ? RTCPeerConnection : undefined);
  if (!Ctor) return [];
  let pc: RTCPeerConnection;
  try {
    pc = new Ctor({ iceServers: [] });
  } catch {
    return [];
  }
  const found = new Map<string, LocalAddress>();
  try {
    pc.createDataChannel('x');
    pc.onicecandidate = (e) => {
      const line = e.candidate?.candidate;
      if (!line) return;
      const a = parseCandidate(line);
      if (a && !found.has(a.address)) found.set(a.address, a);
    };
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    await new Promise<void>((resolve) => {
      const done = () => resolve();
      pc.onicegatheringstatechange = () => pc.iceGatheringState === 'complete' && done();
      setTimeout(done, timeoutMs);
    });
  } catch {
    /* ignore */
  } finally {
    try {
      pc.close();
    } catch {
      /* ignore */
    }
  }
  return [...found.values()];
}
