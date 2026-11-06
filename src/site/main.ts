// Public pages: fonts, styles, header, mobile menu, scroll reveal.
import '@fontsource/ibm-plex-sans-arabic/200.css';
import '@fontsource/ibm-plex-sans-arabic/300.css';
import '@fontsource/ibm-plex-sans-arabic/400.css';
import '@fontsource/ibm-plex-sans-arabic/500.css';
import '@fontsource/cormorant-garamond/latin-500.css';
import '@fontsource/cormorant-garamond/latin-500-italic.css';
import '@fontsource/cormorant-garamond/latin-600.css';
import '../scss/site.scss';

document.documentElement.classList.add('js');

// Header: solid background after scrolling
const header = document.querySelector<HTMLElement>('.site-header');
const onScroll = () => header?.classList.toggle('is-scrolled', window.scrollY > 12);
onScroll();
window.addEventListener('scroll', onScroll, { passive: true });

// Mobile menu
const drawer = document.getElementById('drawer');
const toggles = document.querySelectorAll<HTMLButtonElement>('[data-menu-toggle]');
const setMenu = (open: boolean) => {
  if (!drawer) return;
  drawer.classList.toggle('is-open', open);
  drawer.setAttribute('aria-hidden', String(!open));
  document.body.classList.toggle('menu-open', open);
  toggles.forEach((b) => b.setAttribute('aria-expanded', String(open)));
  if (open) drawer.querySelector<HTMLElement>('a, button')?.focus();
};
toggles.forEach((b) => b.addEventListener('click', () => setMenu(!drawer?.classList.contains('is-open'))));
drawer?.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => setMenu(false)));
document.addEventListener('keydown', (e) => e.key === 'Escape' && setMenu(false));

// Scroll reveal
const revealed = document.querySelectorAll<HTMLElement>('[data-reveal]');
if ('IntersectionObserver' in window) {
  const io = new IntersectionObserver(
    (entries) =>
      entries.forEach((en) => {
        if (en.isIntersecting) {
          en.target.classList.add('is-in');
          io.unobserve(en.target);
        }
      }),
    { rootMargin: '0px 0px -8% 0px', threshold: 0.12 },
  );
  revealed.forEach((el) => io.observe(el));
} else revealed.forEach((el) => el.classList.add('is-in'));

// Current year in the footer
document.querySelectorAll('[data-year]').forEach((el) => (el.textContent = String(new Date().getFullYear())));
