// Utility for capturing & remembering a public visitor's display name
// used when they edit/delete content on a public editorial plan.

const KEY_PREFIX = "ep_actor_name::";

export function getActorName(epId: string): string | null {
  try {
    return localStorage.getItem(KEY_PREFIX + epId);
  } catch {
    return null;
  }
}

export function setActorName(epId: string, name: string) {
  try {
    localStorage.setItem(KEY_PREFIX + epId, name);
  } catch {
    // ignore
  }
}

/**
 * Returns a name, prompting the user when needed.
 * Returns null if the user cancels.
 */
export function ensureActorName(epId: string, promptLabel = "Masukkan nama Anda agar perubahan ini tercatat:"): string | null {
  const existing = getActorName(epId);
  if (existing && existing.trim()) return existing.trim();
  const input = typeof window !== "undefined" ? window.prompt(promptLabel, "") : null;
  if (!input || !input.trim()) return null;
  const name = input.trim();
  setActorName(epId, name);
  return name;
}
