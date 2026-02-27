---
'@cloudflare/workers-oauth-provider': patch
---

Revoke tokens and grant when an authorization code is reused, per RFC 6749 §10.5. This prevents authorization code replay attacks by invalidating all tokens issued from the first exchange.
