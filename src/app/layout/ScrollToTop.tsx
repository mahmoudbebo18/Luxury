// A new page starts at its top instead of keeping the previous page's scroll position.
// Back / forward (POP) keep the browser's restored position, and links to a #section let the
// page scroll to that section itself.
import { useLayoutEffect } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

export function ScrollToTop() {
  const { pathname, hash } = useLocation();
  const type = useNavigationType();

  useLayoutEffect(() => {
    if (type === 'POP' || hash) return;
    // "instant": the site sets scroll-behavior: smooth on <html>, which would animate the jump.
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  return null;
}
