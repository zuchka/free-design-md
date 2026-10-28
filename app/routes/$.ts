/** Unknown URLs (including credential and WordPress probes) need no SSR shell.
 * Concrete application/resource routes take priority over this fallback.
 */
export function loader() {
  return new Response("Not found\n", {
    status: 404,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export const action = loader;
