/**
 * Demo worker for testing RFC 8707 audience prefix-matching behavior.
 *
 * Endpoints:
 *   POST /oauth/register   — Dynamic client registration
 *   GET  /authorize         — Auto-grants (no UI) and redirects with code
 *   POST /oauth/token       — Token endpoint (authorization_code + refresh)
 *   GET  /api/*             — Protected API (returns authenticated user info)
 *   GET  /callback          — Displays the authorization code (for easy copy/paste)
 *
 * Usage (all via curl):
 *   cd demo && npm install && npx wrangler dev
 *
 *   # 1. Register a client
 *   curl -s -X POST http://localhost:8787/oauth/register \
 *     -H 'Content-Type: application/json' \
 *     -d '{"redirect_uris":["http://localhost:8787/callback"],"client_name":"test"}'
 *
 *   # 2. Authorize (auto-grants, redirects with code)
 *   curl -s -v 'http://localhost:8787/authorize?response_type=code&client_id=CLIENT_ID&redirect_uri=http://localhost:8787/callback&scope=read'
 *
 *   # 3. Exchange code for token WITH a resource parameter
 *   curl -s -X POST http://localhost:8787/oauth/token \
 *     -d 'grant_type=authorization_code&code=CODE&redirect_uri=http://localhost:8787/callback&client_id=CLIENT_ID&resource=http://localhost:8787/api/'
 *
 *   # 4. Use token — these should all PASS (prefix match):
 *   curl http://localhost:8787/api/test -H 'Authorization: Bearer TOKEN'
 *   curl http://localhost:8787/api/test/sub -H 'Authorization: Bearer TOKEN'
 *   curl http://localhost:8787/api/ -H 'Authorization: Bearer TOKEN'
 *
 *   # 5. This should FAIL (not a path boundary):
 *   curl http://localhost:8787/api-v2 -H 'Authorization: Bearer TOKEN'
 */

import OAuthProvider from '@cloudflare/workers-oauth-provider';
import type { AuthRequest, OAuthHelpers } from '@cloudflare/workers-oauth-provider';

// ── Env type ────────────────────────────────────────────────────────────────

interface Env {
  OAUTH_KV: KVNamespace;
  OAUTH_PROVIDER: OAuthHelpers;
}

// ── API handler (protected by OAuth) ────────────────────────────────────────

const apiHandler: ExportedHandler<Env> = {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    return Response.json({
      ok: true,
      path: url.pathname,
      props: (ctx as any).props,
      message: 'You reached the protected API.',
    });
  },
};

// ── Default handler (authorization UI + callback helper) ────────────────────

const defaultHandler: ExportedHandler<Env> = {
  async fetch(request, env) {
    const url = new URL(request.url);

    // ── /authorize — auto-grant, no consent screen ──────────────────────
    if (url.pathname === '/authorize') {
      const oauthReq: AuthRequest = await env.OAUTH_PROVIDER.parseAuthRequest(request);
      const { redirectTo } = await env.OAUTH_PROVIDER.completeAuthorization({
        request: oauthReq,
        userId: 'demo-user',
        metadata: { label: 'demo' },
        scope: oauthReq.scope,
        props: { user: 'demo-user', ts: Date.now() },
      });

      return Response.redirect(redirectTo, 302);
    }

    // ── /callback — show the authorization code so you can copy it ──────
    if (url.pathname === '/callback') {
      const code = url.searchParams.get('code');
      if (code) {
        return Response.json({ code, hint: 'Use this code in the /oauth/token request.' });
      }
      const error = url.searchParams.get('error');
      return Response.json({ error, description: url.searchParams.get('error_description') }, { status: 400 });
    }

    return new Response('Not found', { status: 404 });
  },
};

// ── OAuthProvider wiring ────────────────────────────────────────────────────

export default new OAuthProvider({
  apiRoute: '/api/',
  apiHandler,
  defaultHandler,
  authorizeEndpoint: '/authorize',
  tokenEndpoint: '/oauth/token',
  clientRegistrationEndpoint: '/oauth/register',
  scopesSupported: ['read', 'write'],
});
