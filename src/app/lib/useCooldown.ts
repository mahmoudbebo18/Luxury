// Seconds-left counter for "resend" buttons, so people can't hammer the email endpoints.
import { useEffect, useState } from 'react';

export function useCooldown() {
  const [left, setLeft] = useState(0);
  useEffect(() => {
    if (left <= 0) return;
    const timer = setTimeout(() => setLeft((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [left]);
  return { left, start: (seconds = 60) => setLeft(seconds) };
}
