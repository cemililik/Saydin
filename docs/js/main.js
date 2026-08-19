/* Saydın site interactions — no tracking, no persistent browser storage. */

document.addEventListener('DOMContentLoaded', () => {
  const header = document.querySelector('.site-header');
  const toggle = document.querySelector('.nav-toggle');
  const menu = document.querySelector('.nav-menu');
  const mobileQuery = window.matchMedia('(max-width: 760px)');

  const closeMenu = ({ returnFocus = false } = {}) => {
    if (!toggle || !menu) return;
    menu.classList.remove('open');
    toggle.setAttribute('aria-expanded', 'false');
    document.body.classList.remove('menu-open');
    if (returnFocus) toggle.focus();
  };

  if (toggle && menu) {
    toggle.addEventListener('click', () => {
      const willOpen = !menu.classList.contains('open');
      menu.classList.toggle('open', willOpen);
      toggle.setAttribute('aria-expanded', String(willOpen));
      document.body.classList.toggle('menu-open', willOpen && mobileQuery.matches);
    });

    menu.querySelectorAll('a').forEach((link) => {
      link.addEventListener('click', () => closeMenu());
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && menu.classList.contains('open')) {
        closeMenu({ returnFocus: true });
      }
    });

    document.addEventListener('click', (event) => {
      if (!menu.classList.contains('open')) return;
      if (!menu.contains(event.target) && !toggle.contains(event.target)) closeMenu();
    });

    mobileQuery.addEventListener('change', (event) => {
      if (!event.matches) closeMenu();
    });
  }

  const updateHeader = () => header?.classList.toggle('scrolled', window.scrollY > 16);
  updateHeader();
  window.addEventListener('scroll', updateHeader, { passive: true });

  document.querySelectorAll('[data-current-year]').forEach((element) => {
    element.textContent = String(new Date().getFullYear());
  });

  const form = document.getElementById('contact-form');
  if (form) {
    const query = new URLSearchParams(window.location.search);
    const subjectInput = document.getElementById('subject');
    if (subjectInput && query.get('subject')) subjectInput.value = query.get('subject').slice(0, 120);

    form.addEventListener('submit', async (event) => {
      event.preventDefault();

      const submitButton = form.querySelector('.form-submit');
      const buttonLabel = submitButton?.querySelector('.button-label');
      const status = document.getElementById('form-status');
      const hiddenSubject = document.getElementById('form-subject');

      if (!submitButton || !buttonLabel || !status || !form.reportValidity()) return;
      if (hiddenSubject && subjectInput) {
        hiddenSubject.value = `Saydın iletişim formu — ${subjectInput.value}`;
      }

      submitButton.disabled = true;
      submitButton.setAttribute('aria-busy', 'true');
      buttonLabel.textContent = 'Gönderiliyor…';
      status.hidden = true;
      status.className = 'form-status';

      try {
        const response = await fetch(form.action, {
          method: 'POST',
          body: new FormData(form),
          headers: { Accept: 'application/json' },
        });
        if (!response.ok) throw new Error('Form gönderimi başarısız');

        form.reset();
        status.className = 'form-status success';
        status.textContent = 'Mesajınız alındı. En kısa sürede dönüş yapacağız.';
      } catch (_) {
        status.className = 'form-status error';
        status.textContent = 'Mesaj gönderilemedi. iletisim@saydin.app adresine e-posta gönderebilirsiniz.';
      } finally {
        status.hidden = false;
        submitButton.disabled = false;
        submitButton.removeAttribute('aria-busy');
        buttonLabel.textContent = 'Mesajı gönder';
      }
    });
  }
});
