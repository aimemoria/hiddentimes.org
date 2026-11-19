// Admin: Account section (change password).
(() => {
  const $ = (id) => document.getElementById(id);
  const form = $('pwForm');

  const loadStatus = async () => {
    try {
      const r = await fetch('/api/admin/account', { credentials: 'same-origin' });
      if (!r.ok) return;
      const a = await r.json();
      $('acc-status').textContent = a.passwordChangedAt
        ? `Password last changed ${new Date(a.passwordChangedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}.`
        : 'You\'re using the starting password from the site settings. Set your own below.';
    } catch { /* leave as is */ }
  };

  document.addEventListener('ht:view', (e) => { if (e.detail === 'account') loadStatus(); });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const err = $('pwError');
    err.textContent = ''; $('pwSaved').textContent = '';
    const current = form.current.value, next = form.next.value, confirm = form.confirm.value;

    if (!current) { err.textContent = 'Enter your current password.'; form.current.focus(); return; }
    if (next.length < 12) { err.textContent = 'The new password needs at least 12 characters.'; form.next.focus(); return; }
    if (next !== confirm) { err.textContent = 'The two new passwords don\'t match.'; form.confirm.focus(); return; }

    const btn = $('pwSubmit');
    btn.disabled = true;
    try {
      const r = await fetch('/api/admin/password', {
        method: 'POST', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ current, next }),
      });
      const data = await r.json().catch(() => ({}));
      if (r.status === 401) { location.reload(); return; }
      if (!r.ok) throw new Error(data.error || 'Could not change the password.');
      form.reset();
      $('pwSaved').textContent = 'Password updated. Other devices have been signed out.';
      loadStatus();
    } catch (x) {
      err.textContent = x.message;
    } finally {
      btn.disabled = false;
    }
  });
})();
