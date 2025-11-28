export const useMuteStatus = () => {
  const isUserMuted = (user: any): boolean => {
    if (!user.mutedUntil) return false;
    try {
      const mutedUntil = new Date(user.mutedUntil);
      const now = new Date();

      if (isNaN(mutedUntil.getTime())) {
        console.warn('Invalid mutedUntil date:', user.mutedUntil);
        return false;
      }

      const mutedUntilTime = mutedUntil.getTime();
      const nowTime = now.getTime();
      const isMuted = mutedUntilTime > nowTime;

      if (process.env.NODE_ENV === 'development') {
        console.log('Mute check:', {
          mutedUntil: user.mutedUntil,
          parsedDate: mutedUntil.toISOString(),
          now: now.toISOString(),
          mutedUntilTime,
          nowTime,
          timeDiff: mutedUntilTime - nowTime,
          isMuted,
        });
      }

      return isMuted;
    } catch (error) {
      console.error('Error checking mute status:', error, user.mutedUntil);
      return false;
    }
  };

  return { isUserMuted };
};
