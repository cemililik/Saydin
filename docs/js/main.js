/* ============================================================
   Saydin — Site JavaScript
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {
  /* ── Mobile hamburger menu ─────────────────────────────── */
  const hamburger = document.querySelector('.nav-hamburger');
  const menu = document.querySelector('.nav-menu');

  if (hamburger && menu) {
    hamburger.addEventListener('click', () => {
      const open = menu.classList.toggle('open');
      hamburger.setAttribute('aria-expanded', String(open));
    });

    menu.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        menu.classList.remove('open');
        hamburger.setAttribute('aria-expanded', 'false');
      });
    });
  }

  /* ── Hero word rotate (Alsaydim / Satsaydim) ───────────── */
  const heroWord = document.getElementById('heroWord');
  if (heroWord) {
    const words = ['Alsayd\u0131m', 'Satsayd\u0131m'];
    let index = 0;

    setInterval(() => {
      heroWord.classList.add('fade-out');
      heroWord.classList.remove('fade-in');

      setTimeout(() => {
        index = (index + 1) % words.length;
        heroWord.textContent = words[index];
        heroWord.classList.remove('fade-out');
        heroWord.classList.add('fade-in');
      }, 500);
    }, 5000);
  }
});
