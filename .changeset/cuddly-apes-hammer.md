---
'@cloudflare/workers-oauth-provider': patch
---

Fix RFC 8707 audience validation to use path-prefix matching at path-segment boundaries. A token with audience `https://example.com/api/` now grants access to `https://example.com/api/foo` and `https://example.com/api/foo/bar`, but rejects `https://example.com/api-v2` (not a `/`-separated prefix). Origin-only audiences (no path or just `/`) continue to match any path on that origin for backward compatibility.
