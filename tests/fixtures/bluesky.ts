// Synthetic Bluesky app.bsky.actor.getProfile responses. Not real people.

export const blueskyProfile = {
  did: 'did:plc:abcdefghijklmnopqrstuvwx',
  handle: 'janedoe.bsky.social',
  displayName: 'Jane Doe',
  description: 'Designer in Lisbon. Portfolio: https://janedoe.example',
  followersCount: 210,
  followsCount: 180,
  postsCount: 845,
  createdAt: '2023-05-10T12:00:00.000Z',
  labels: [],
};

export const blueskyLoggedOutOptOut = {
  ...blueskyProfile,
  handle: 'private-ish.bsky.social',
  labels: [{ src: 'did:plc:abcdefghijklmnopqrstuvwx', uri: 'at://x', val: '!no-unauthenticated', cts: '2024-01-01T00:00:00Z' }],
};

export const blueskyNotFound = { error: 'InvalidRequest', message: 'Profile not found' };
export const blueskyDeactivated = { error: 'AccountDeactivated', message: 'Account is deactivated' };
export const blueskyBadRequest = { error: 'InvalidRequest', message: 'Error: actor must be a valid did or a handle' };
export const blueskyRateLimited = { error: 'RateLimitExceeded', message: 'Rate Limit Exceeded' };
