// Synthetic GitHub REST API responses. Not real people.

export const githubUser = {
  login: 'janedoe-dev',
  id: 1000001,
  type: 'User',
  name: 'Jane Doe',
  company: 'Acme Studio',
  blog: 'https://janedoe.example',
  location: 'Lisbon',
  email: null,
  bio: 'Makes small tools. Say hi: jane@example.com',
  twitter_username: 'janedoe',
  public_repos: 12,
  created_at: '2019-04-02T10:00:00Z',
};

export const githubMinimalUser = {
  login: 'quiet-coder',
  type: 'User',
  name: null,
  company: null,
  blog: '',
  location: null,
  email: null,
  bio: null,
  twitter_username: null,
  public_repos: 0,
  created_at: '2023-01-01T00:00:00Z',
};

export const githubOrg = { ...githubMinimalUser, login: 'acme-org', type: 'Organization', name: 'Acme' };

export const githubNotFound = {
  message: 'Not Found',
  documentation_url: 'https://docs.github.com/rest/users/users#get-a-user',
  status: '404',
};

export const githubRateLimited = {
  message: "API rate limit exceeded for 203.0.113.7. (But here's the good news: Authenticated requests get a higher rate limit.)",
  documentation_url: 'https://docs.github.com/rest/overview/resources-in-the-rest-api#rate-limiting',
};

/** Headers GitHub sends when the unauthenticated quota is spent. */
export const rateLimitHeaders = (resetEpochSeconds: number) => ({
  'x-ratelimit-limit': '60',
  'x-ratelimit-remaining': '0',
  'x-ratelimit-used': '60',
  'x-ratelimit-reset': String(resetEpochSeconds),
});

export const okHeaders = (remaining = 59) => ({
  'content-type': 'application/json; charset=utf-8',
  'x-ratelimit-limit': '60',
  'x-ratelimit-remaining': String(remaining),
  'x-ratelimit-reset': '1790000000',
});
