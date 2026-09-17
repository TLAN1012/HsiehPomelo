import { json, getSettings, publicSettings } from '../../src/lib.js';

export async function onRequestGet({ env }) {
  const s = await getSettings(env.DB);
  return json({ ok: true, ...publicSettings(s) });
}
