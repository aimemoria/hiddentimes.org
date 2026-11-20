// HiddenTimes publishing page (/admin/agent-publish).
// Sends stories to the same endpoints as the admin dashboard (POST/PUT /api/admin/stories),
// so the same checks, storage and publishing rules apply. Nothing secret lives in this file:
// sign-in happens with the password typed into the page, and the server keeps the rest.
(() => {
  const $ = (id) => document.getElementById(id);
  const form = $('story-form');
  const SAVE_KEY = 'hiddentimes-agent-publish-v1';
  const FIELDS = ['title', 'author', 'category', 'excerpt', 'body', 'sources', 'cover-url', 'cover-alt', 'cover-credit'];

  let preparedCover = null;  // the chosen image file, made smaller if needed
  let preparing = null;      // promise while the image is being prepared
  let busy = false;
  let currentCover = '';     // the cover a loaded draft already has

  // ---------- small helpers ----------
  const newSubmissionId = () => (crypto.randomUUID ? crypto.randomUUID()
    : '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, (c) => (c ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))).toString(16)));
  const words = (text) => (text.trim() ? text.trim().split(/\s+/).length : 0);
  const fmtDate = (iso) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  const api = async (url, opts = {}) => {
    const r = await fetch(url, { credentials: 'same-origin', ...opts });
    const data = await r.json().catch(() => ({}));
    return { r, data };
  };

  // "Title | https://link" per line → [{ title, url }], plus the lines that aren't valid
  const parseSources = (text) => {
    const list = [], bad = [];
    text.split('\n').forEach((line, i) => {
      const raw = line.trim();
      if (!raw) return;
      const cut = raw.lastIndexOf('|');
      const title = cut === -1 ? '' : raw.slice(0, cut).trim();
      const url = (cut === -1 ? raw : raw.slice(cut + 1)).trim();
      if (/^https?:\/\/[^\s/]+\.[^\s]+$/i.test(url)) list.push({ title, url }); else bad.push(i + 1);
    });
    return { list, bad };
  };

  // ---------- result box ----------
  const result = {
    show(status, message, { problems = [], url = '', check = '' } = {}) {
      const box = $('result');
      box.hidden = false;
      box.dataset.status = status;
      $('result-message').textContent = message;
      $('result-problems').replaceChildren(...problems.map((p) => Object.assign(document.createElement('li'), { textContent: p })));
      $('result-link-line').hidden = !url;
      $('result-url').href = url || '#';
      $('result-url').textContent = url;
      $('result-check').textContent = check;
      $('result-check').dataset.verified = 'unknown';
      if (status !== 'working') box.scrollIntoView({ block: 'center' });
    },
  };

  // ---------- counters ----------
  const updateCounts = () => {
    $('excerpt-count').textContent = `${form.excerpt.value.trim().length} / 300 characters`;
    $('body-count').textContent = `${words(form.body.value)} words`;
    const { list, bad } = parseSources(form.sources.value);
    $('sources-count').textContent = `${list.length} source${list.length === 1 ? '' : 's'}` +
      (bad.length ? ` · line ${bad.join(', ')} is not "Title | https://link"` : '');
  };

  // ---------- keep unsaved work (survives a reload, a crash or a lost connection) ----------
  const saveLocal = () => {
    try {
      const data = { savedAt: new Date().toISOString(), storyId: $('story-id').value, submissionId: $('submission-id').value,
        keep: { link: $('keep-link').value, featured: $('keep-featured').value }, currentCover };
      FIELDS.forEach((id) => { data[id] = $(id).value; });
      localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    } catch { /* storage may be unavailable; the form still works */ }
  };
  const clearLocal = () => { try { localStorage.removeItem(SAVE_KEY); } catch { /* ignore */ } };
  const restoreLocal = () => {
    let data = null;
    try { data = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); } catch { /* ignore */ }
    if (!data || !FIELDS.some((id) => (data[id] || '').trim())) return false;
    FIELDS.forEach((id) => { if (id !== 'category') $(id).value = data[id] || ''; });
    form.dataset.restoredCategory = data.category || '';
    $('story-id').value = data.storyId || '';
    $('submission-id').value = data.submissionId || newSubmissionId();
    $('keep-link').value = data.keep?.link || '';
    $('keep-featured').value = data.keep?.featured || 'false';
    currentCover = data.currentCover || '';
    $('restore-text').textContent = `Unsaved work from ${new Date(data.savedAt).toLocaleString('en-GB')} was restored into the form. ` +
      'If a submission was interrupted, click the same button again: the server recognises it and will not publish it twice.';
    $('restore-notice').hidden = false;
    return true;
  };

  // ---------- the form ----------
  const resetForm = () => {
    form.reset();
    delete form.dataset.restoredCategory;
    $('category').value = '';
    $('story-id').value = '';
    $('submission-id').value = newSubmissionId();
    $('keep-link').value = ''; $('keep-featured').value = 'false';
    preparedCover = null; preparing = null; currentCover = '';
    $('cover-file-info').textContent = '';
    showEditing(null);
    $('restore-notice').hidden = true;
    updateCounts();
    clearLocal();
  };

  const showEditing = (story) => {
    $('editing-notice').hidden = !story;
    $('editing-text').textContent = story ? `Continuing the draft "${story.title}". Saving updates this draft; publishing makes it public.` : '';
    $('current-cover').hidden = !currentCover;
    $('current-cover').textContent = currentCover ? `Current cover image (kept unless you give a new one): ${currentCover}` : '';
  };

  const setCategories = (categories) => {
    const select = $('category');
    const wanted = select.value || form.dataset.restoredCategory || '';
    delete form.dataset.restoredCategory; // used once, right after restoring saved work
    select.replaceChildren(new Option('Choose a category', ''), ...categories.map((c) => new Option(c, c)));
    select.value = categories.includes(wanted) ? wanted : '';
  };

  // ---------- history ----------
  const loadHistory = async () => {
    const { r, data } = await api('/api/admin/agent/overview');
    if (r.status === 401) return showLogin();
    if (!r.ok) { $('history-body').innerHTML = '<tr><td colspan="5">Could not load the list of stories.</td></tr>'; return; }
    setCategories(data.categories);
    $('history-count').textContent = `(${data.stories.length})`;
    const rows = data.stories.map((s) => {
      const tr = document.createElement('tr');
      tr.dataset.storyId = s.id;
      const cell = (content) => { const td = document.createElement('td'); if (content instanceof Node) td.append(content); else td.textContent = content; tr.append(td); };
      cell(fmtDate(s.createdAt));
      if (s.published) cell(Object.assign(document.createElement('a'), { href: s.url, target: '_blank', rel: 'noopener', textContent: s.title }));
      else cell(s.title);
      cell(s.category);
      cell(s.published ? 'Published' : 'Draft');
      if (s.published) cell('');
      else cell(Object.assign(document.createElement('button'), {
        type: 'button', className: 'linklike', id: `continue-${s.id}`, textContent: 'Continue this draft',
        onclick: () => continueDraft(s.id),
      }));
      return tr;
    });
    $('history-body').replaceChildren(...(rows.length ? rows : [Object.assign(document.createElement('tr'), { innerHTML: '<td colspan="5">No stories yet.</td>' })]));
  };

  const continueDraft = async (id) => {
    const { r, data: s } = await api(`/api/admin/stories/${encodeURIComponent(id)}`);
    if (!r.ok) return result.show('error', s.error || 'Could not open this draft.');
    form.reset();
    $('story-id').value = s.id;
    $('submission-id').value = newSubmissionId();
    $('title').value = s.title;
    $('category').value = s.category;
    $('excerpt').value = s.excerpt || '';
    $('body').value = s.body || '';
    $('sources').value = (s.resources || []).map((x) => (x.title ? `${x.title} | ${x.url}` : x.url)).join('\n');
    $('cover-alt').value = s.coverAlt || '';
    $('cover-credit').value = s.coverCredit || '';
    $('author').value = s.author || '';
    $('keep-link').value = s.link || '';
    $('keep-featured').value = s.featured ? 'true' : 'false';
    currentCover = s.cover || '';
    preparedCover = null;
    $('restore-notice').hidden = true;
    showEditing(s);
    updateCounts();
    saveLocal();
    $('result').hidden = true;
    window.scrollTo({ top: 0 });
    $('title').focus();
  };

  // ---------- cover file: shrink big photos with the site's image library ----------
  $('cover-file').addEventListener('change', () => {
    const f = $('cover-file').files[0];
    preparedCover = null;
    $('cover-file-info').textContent = '';
    if (!f) return;
    $('cover-file-info').textContent = 'Preparing the image…';
    const job = import('/image-kit/src/index.js')
      .then(({ shrinkImage, formatBytes }) => shrinkImage(f).then((r) => {
        if (preparing !== job) return;
        preparedCover = r.file;
        $('cover-file-info').textContent = r.changed
          ? `Ready: made smaller from ${formatBytes(r.originalSize)} to ${formatBytes(r.size)}.`
          : `Ready: ${formatBytes(r.size)}.`;
      }))
      .catch((e) => {
        if (preparing !== job) return;
        $('cover-file').value = '';
        $('cover-file-info').textContent = e.message || 'This image could not be used. Choose another one.';
      })
      .finally(() => { if (preparing === job) preparing = null; });
    preparing = job;
  });

  // ---------- after publishing: open the public page to confirm it works ----------
  const verifyLive = async (url) => {
    const check = $('result-check');
    check.textContent = 'Checking that the public page opens…';
    try {
      const r = await fetch(new URL(url).pathname, { cache: 'no-store', credentials: 'omit' });
      const ok = r.ok;
      check.dataset.verified = ok ? 'true' : 'false';
      check.textContent = ok ? `Verified: the public page opens (HTTP ${r.status}).`
        : `Warning: the public page answered HTTP ${r.status}. Open the link above to check.`;
    } catch {
      check.dataset.verified = 'false';
      check.textContent = 'Could not check the public page. Open the link above to check.';
    }
  };

  // ---------- save / publish ----------
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (busy) return; // ignore double clicks
    const publishing = (e.submitter?.dataset.action || 'publish') === 'publish';

    const { list: sources, bad } = parseSources(form.sources.value);
    if (bad.length) {
      return result.show('error', 'Not saved. Some source lines are not in the form "Title | https://link".',
        { problems: bad.map((n) => `Source line ${n}`) });
    }
    if (preparing) { result.show('working', 'Waiting for the image to be prepared…'); await preparing.catch(() => {}); }

    const editingId = $('story-id').value;
    const fd = new FormData();
    fd.set('mode', 'agent');
    fd.set('title', form.title.value.trim());
    fd.set('category', form.category.value);
    fd.set('excerpt', form.excerpt.value.trim());
    fd.set('body', form.body.value);
    fd.set('resources', JSON.stringify(sources));
    fd.set('coverUrl', $('cover-url').value.trim());
    fd.set('coverAlt', $('cover-alt').value.trim());
    fd.set('coverCredit', $('cover-credit').value.trim());
    fd.set('author', $('author').value.trim());
    fd.set('link', $('keep-link').value);
    fd.set('featured', $('keep-featured').value);
    fd.set('published', publishing ? 'true' : 'false');
    if (!editingId) fd.set('submissionId', $('submission-id').value);
    const file = preparedCover || $('cover-file').files[0];
    if (file) fd.set('coverFile', file, file.name || 'cover');

    busy = true;
    $('publish-button').disabled = true; $('save-draft-button').disabled = true;
    saveLocal();
    result.show('working', publishing ? 'Publishing…' : 'Saving the draft…');

    let r, data;
    try {
      ({ r, data } = await api(editingId ? `/api/admin/stories/${encodeURIComponent(editingId)}` : '/api/admin/stories',
        { method: editingId ? 'PUT' : 'POST', body: fd }));
    } catch {
      busy = false; $('publish-button').disabled = false; $('save-draft-button').disabled = false;
      return result.show('error', 'Connection problem: the server could not be reached. Your work is kept in this form. ' +
        'Click the same button again: it is safe, the story will not be saved twice.');
    } finally {
      busy = false; $('publish-button').disabled = false; $('save-draft-button').disabled = false;
    }

    if (r.status === 401) { saveLocal(); return showLogin('You were signed out. Sign in again; your work is kept and will be restored.'); }
    if (!r.ok) {
      const extra = data.existing ? { url: data.existing.published ? data.existing.url : '' } : {};
      return result.show('error', `Not saved. ${r.status === 409 ? '' : 'Please fix the following:'} ${data.error || `Server error (HTTP ${r.status}).`}`.replace(/\s+/g, ' ').trim(),
        { problems: data.problems || [], ...extra });
    }

    const story = data;
    // An earlier attempt was saved as a draft (e.g. the connection dropped), and now "Publish" was clicked:
    // continue with that same draft and publish it, instead of stopping.
    if (data.repeated && publishing && !story.published && !editingId) {
      $('story-id').value = story.id;
      return form.requestSubmit($('publish-button'));
    }
    const again = data.repeated ? ' (This submission had already been saved before; no copy was made.)' : '';
    if (story.published) {
      result.show('success', `Published: "${story.title}".${again}`, { url: story.url });
      resetForm();
      verifyLive(story.url);
    } else {
      $('story-id').value = story.id;
      currentCover = story.cover || '';
      $('cover-url').value = ''; $('cover-file').value = ''; preparedCover = null; $('cover-file-info').textContent = '';
      showEditing(story);
      saveLocal();
      result.show('success', `Draft saved: "${story.title}". It is not public. Click "Publish story" when it is ready.${again}`);
    }
    loadHistory();
  });

  form.addEventListener('input', () => { updateCounts(); saveLocal(); });
  $('discard-restored-button').addEventListener('click', () => { resetForm(); $('result').hidden = true; });
  $('new-story-button').addEventListener('click', () => { resetForm(); $('result').hidden = true; });

  // ---------- sign in / out ----------
  function showLogin(message = '') {
    $('publish-section').hidden = true;
    $('login-section').hidden = false;
    $('login-error').textContent = message;
    $('password').focus();
  }
  function showPage() {
    $('login-section').hidden = true;
    $('publish-section').hidden = false;
    if (!$('submission-id').value && !restoreLocal()) $('submission-id').value = newSubmissionId();
    updateCounts();
    showEditing($('story-id').value ? { title: $('title').value } : null);
    loadHistory();
  }

  $('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    $('login-error').textContent = '';
    $('sign-in-button').disabled = true;
    try {
      const { r, data } = await api('/api/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: $('password').value }),
      });
      if (!r.ok) { $('login-error').textContent = data.error || 'Sign in failed.'; return; }
      $('password').value = '';
      showPage();
    } catch {
      $('login-error').textContent = 'Connection problem. Try again.';
    } finally {
      $('sign-in-button').disabled = false;
    }
  });

  $('sign-out-button').addEventListener('click', async () => {
    await fetch('/api/logout', { method: 'POST', credentials: 'same-origin' }).catch(() => {});
    showLogin();
  });

  api('/api/me').then(({ data }) => (data.authed ? showPage() : showLogin())).catch(() => showLogin());
})();
