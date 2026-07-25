import { useCallback, useEffect, useRef, useState } from 'react';

export function useCountdown(seconds: number) {
  const [remaining, setRemaining] = useState(seconds);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clear = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const restart = useCallback(() => {
    clear();
    setRemaining(seconds);
    timerRef.current = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          clear();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [clear, seconds]);

  useEffect(() => {
    restart();
    return clear;
    // Only re-run if the requested duration changes — `restart`/`clear` are
    // stable across renders since `seconds` is their only real dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seconds]);

  return { remaining, restart, isActive: remaining > 0 };
}
