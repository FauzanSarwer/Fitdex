export const ROLLING_STREAK_WINDOW_MS = 30 * 60 * 60 * 1000;

type StreakSession = {
  exitAt: number;
  validForStreak: boolean;
};

export function computeRollingStreak(sessions: StreakSession[], now: number): number {
  const validSessions = sessions
    .filter((session) => session.validForStreak && Number.isFinite(session.exitAt))
    .sort((a, b) => a.exitAt - b.exitAt);

  if (validSessions.length === 0) return 0;

  const latest = validSessions[validSessions.length - 1];
  if (now - latest.exitAt > ROLLING_STREAK_WINDOW_MS) return 0;

  let streak = 0;
  let windowAnchor: number | null = null;

  for (const session of validSessions) {
    if (windowAnchor == null) {
      streak = 1;
      windowAnchor = session.exitAt;
      continue;
    }

    if (session.exitAt - windowAnchor <= ROLLING_STREAK_WINDOW_MS) {
      // Within the same rolling window; do not double-count.
      continue;
    }

    streak += 1;
    windowAnchor = session.exitAt;
  }

  return streak;
}
