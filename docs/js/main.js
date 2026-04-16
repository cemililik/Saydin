/* ============================================================
   Saydın — Site JavaScript
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {
  /* ── Mobil hamburger menü ──────────────────────────────── */
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

  /* ── Hero kelime değişimi (Alsaydım / Satsaydım) ──────── */
  const heroWord = document.getElementById('heroWord');
  if (heroWord) {
    const words = ['Alsaydım', 'Satsaydım'];
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

  /* ── İletişim formu (Formspree) ────────────────────────── */
  const form = document.getElementById('contact-form');
  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();

      const submitBtn = form.querySelector('.form-submit');
      const status = document.getElementById('form-status');
      const subjectInput = document.getElementById('subject');
      const hiddenSubject = document.getElementById('form-subject');

      /* Konu başlığını düzenle */
      if (subjectInput && hiddenSubject) {
        hiddenSubject.value = 'Saydın Contact Form - ' + subjectInput.value;
      }

      /* Butonu devre dışı bırak */
      submitBtn.disabled = true;
      submitBtn.textContent = 'Gönderiliyor...';
      status.className = 'form-status';
      status.style.display = 'none';

      fetch(form.action, {
        method: 'POST',
        body: new FormData(form),
        headers: { 'Accept': 'application/json' }
      })
      .then(response => {
        if (!response.ok) throw new Error('Gönderilemedi');

        status.className = 'form-status success';
        status.textContent = 'Mesajınız başarıyla gönderildi. Teşekkürler!';
        form.reset();
      })
      .catch(() => {
        status.className = 'form-status error';
        status.textContent = 'Gönderilemedi. Lütfen daha sonra tekrar deneyin.';
      })
      .finally(() => {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg> Gönder';
      });
    });
  }
});
