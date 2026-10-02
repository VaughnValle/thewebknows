import { onRequestGet as __api_whoami_ts_onRequestGet } from "/home/user/thewebknows/functions/api/whoami.ts"

export const routes = [
    {
      routePath: "/api/whoami",
      mountPath: "/api",
      method: "GET",
      middlewares: [],
      modules: [__api_whoami_ts_onRequestGet],
    },
  ]