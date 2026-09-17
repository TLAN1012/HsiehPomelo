import { json, requireAdmin } from '../../../src/lib.js';

export async function onRequestPost({ request, env }) {
  const denied = requireAdmin(request, env);
  if (denied) return denied;
  return json({ ok: true });
}
