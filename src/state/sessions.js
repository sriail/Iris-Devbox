export const sessions = new Map();

export function touchSession(id) {
  const s = sessions.get(id);
  if (s) s.lastActivity = Date.now();
}
