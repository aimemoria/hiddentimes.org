(() => {
  const { esc, date } = HT;
  const $ = (id) => document.getElementById(id);

  const loginView = $('login');
  const dash = $('dash');
  const form = $('storyForm');
  const fileInput = form.coverFile;
  const preview = $('coverPreview');

  let stories = [];
  let editing = null;      // story being edited, or null for a new one
  let removeCover = false;
  let objectUrl = null;
  let preparedCover = null;  // the photo after shrinking, ready to upload
  let preparing = null;      // promise while a photo is being shrunk

  // ---------- api ----------
  const api = async (url, opts = {}) => {
    const r = await fetch(url, { credentials: 'same-origin', ...opts });
    const data = await r.json().catch(() => ({}));
    if (r.status === 401 && url !== '/api/login') { showLogin(); throw new Error('Please sign in again.'); }
    if (!r.ok) throw new Error(data.error || 'Something went wrong.');
    return data;
  };

  const ytId = (url) => {
    const m = String(url).match(/(?:youtu\.be\/|youtube(?:-nocookie)?\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/|v\/))([\w-]{6,20})/);
    return m ? m[1] : '';
  };

  // ---------- views ----------
  const showLogin = () => { dash.hidden = true; loginView.hidden = false; };
  const showDash = async () => {
    loginView.hidden = true; dash.hidden = false;
    await loadStories();
  };

  $('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const err = $('loginError');
    err.textContent = '';
    try {
      await api('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: e.target.password.value }),
      });
      e.target.reset();
      showDash();
    } catch (x) { err.textContent = x.message; }
  });

  $('logout').addEventListener('click', async () => {
    await fetch('/api/logout', { method: 'POST' });
    showLogin();
  });

  // ---------- list ----------
  const loadStories = async () => {
    stories = await api('/api/admin/stories');
    renderList();
    const cats = [...new Set(stories.map((s) => s.category))];
    $('catList').innerHTML = cats.map((c) => `<option value="${esc(c)}">`).join('');
  };

  const renderList = () => {
    const q = $('filter').value.trim().toLowerCase();
    const list = stories.filter((s) => !q || (s.title + ' ' + s.category).toLowerCase().includes(q));
    $('count').textContent = stories.length;
    $('list').innerHTML = list.length ? list.map((s) => {
      const img = HT.coverOf(s);
      return `<li data-id="${esc(s.id)}" class="${editing && editing.id === s.id ? 'is-editing' : ''}">
        <div class="thumb">${img ? `<img src="${esc(img)}" alt="" loading="lazy">` : ''}</div>
        <div>
          <strong>${esc(s.title)}</strong>
          <small>${esc(s.category)} · ${esc(date(s.createdAt))}${s.readMinutes ? ` · ${s.readMinutes} min read` : ''}</small>
          ${s.published === false ? '<span class="tag tag--draft">Draft</span>' : ''}
          ${s.featured ? '<span class="tag tag--feat">Featured</span>' : ''}
          ${s.youtubeId ? '<span class="tag">YouTube</span>' : ''}
        </div>
        <div class="item-actions">
          <button type="button" data-act="edit">Edit</button>
          ${s.published !== false ? `<button type="button" data-act="view">View</button>` : ''}
          <button type="button" data-act="del" class="del">Delete</button>
        </div>
      </li>`;
    }).join('') : `<li class="list-empty">${q ? 'No matches.' : 'No stories yet. Write the first one.'}</li>`;
  };

  $('filter').addEventListener('input', renderList);

  $('list').addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-act]');
    if (!btn) return;
    const s = stories.find((x) => x.id === btn.closest('li').dataset.id);
    if (!s) return;
    if (btn.dataset.act === 'edit') startEdit(s);
    if (btn.dataset.act === 'view') window.open('/story/' + encodeURIComponent(s.slug), '_blank', 'noopener');
    if (btn.dataset.act === 'del') {
      if (!confirm(`Delete "${s.title}"? This can't be undone.`)) return;
      try {
        await api('/api/admin/stories/' + s.id, { method: 'DELETE' });
        if (editing && editing.id === s.id) resetForm();
        await loadStories();
      } catch (x) { alert(x.message); }
    }
  });

  // ---------- cover preview ----------
  const setPreview = (src) => {
    preview.innerHTML = src ? `<img src="${esc(src)}" alt="">` : '<span>No image</span>';
    $('removeCover').hidden = !src || (!preparedCover && !form.coverUrl.value && !(editing && editing.cover && !removeCover));
  };

  const refreshPreview = () => {
    if (objectUrl) { URL.revokeObjectURL(objectUrl); objectUrl = null; }
    if (preparedCover) { objectUrl = URL.createObjectURL(preparedCover); return setPreview(objectUrl); }
    if (form.coverUrl.value.trim()) return setPreview(form.coverUrl.value.trim());
    if (editing && editing.cover && !removeCover) return setPreview(editing.cover);
    const id = ytId(form.link.value);
    setPreview(id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : '');
  };

  // Shrink big photos in the browser before upload (packages/image-shrink)
  const coverInfo = $('coverInfo');
  const clearPrepared = () => { preparedCover = null; preparing = null; coverInfo.textContent = ''; };
  fileInput.addEventListener('change', () => {
    const f = fileInput.files[0];
    clearPrepared();
    removeCover = false;
    if (!f) { refreshPreview(); return; }
    if (f.size > 60 * 1024 * 1024) { alert('That file is very large (over 60 MB). Please choose a smaller photo.'); fileInput.value = ''; return; }
    coverInfo.textContent = 'Optimising photo…';
    $('submitBtn').disabled = true;
    const job = import('/image-kit/src/index.js')
      .then(({ shrinkImage, formatBytes }) => shrinkImage(f).then((r) => {
        if (preparing !== job) return; // a newer photo was picked meanwhile
        preparedCover = r.file;
        coverInfo.textContent = r.changed
          ? `Optimised: ${formatBytes(r.originalSize)} → ${formatBytes(r.size)} · ${r.width}×${r.height}px, same visible quality`
          : `Ready: ${formatBytes(r.size)}, already small enough, uploaded as it is`;
        refreshPreview();
      }))
      .catch((e) => {
        if (preparing !== job) return;
        alert(e.message || 'This photo could not be prepared.');
        fileInput.value = ''; clearPrepared(); refreshPreview();
      })
      .finally(() => { if (preparing === job) { preparing = null; $('submitBtn').disabled = false; } });
    preparing = job;
  });
  form.coverUrl.addEventListener('input', () => { removeCover = false; refreshPreview(); });
  $('removeCover').addEventListener('click', () => {
    fileInput.value = ''; clearPrepared(); form.coverUrl.value = ''; removeCover = true; refreshPreview();
  });

  form.link.addEventListener('input', () => {
    const hint = $('linkHint');
    const id = ytId(form.link.value);
    hint.textContent = id ? 'YouTube video found. Readers get a podcast player on the story.' :
      form.link.value ? 'Readers get a button that opens this link.' : 'A YouTube link adds a podcast player to the story.';
    hint.classList.toggle('is-yt', Boolean(id));
    refreshPreview();
  });

  // ---------- resources ----------
  const resRows = $('resRows');
  const addResource = (r = {}) => {
    const li = document.createElement('li');
    li.className = 'res-row';
    li.innerHTML = `
      <input data-k="title" maxlength="140" placeholder="Title, e.g. Original article" aria-label="Resource title">
      <input data-k="url" type="url" inputmode="url" placeholder="https://…" aria-label="Resource link">
      <button type="button" class="del-res" aria-label="Remove resource" title="Remove">×</button>`;
    li.querySelector('[data-k="title"]').value = r.title || '';
    li.querySelector('[data-k="url"]').value = r.url || '';
    li.querySelector('.del-res').addEventListener('click', () => li.remove());
    resRows.appendChild(li);
    return li;
  };
  const setResources = (list) => { resRows.innerHTML = ''; (list || []).forEach((r) => addResource(r)); };
  const getResources = () => [...resRows.children].map((li) => ({
    title: li.querySelector('[data-k="title"]').value.trim(),
    url: li.querySelector('[data-k="url"]').value.trim(),
    el: li,
  })).filter((r) => r.title || r.url);
  $('addRes').addEventListener('click', () => addResource().querySelector('input').focus());

  // ---------- story editor: write / preview ----------
  const mdPreview = $('mdPreview');
  const showTab = (which) => {
    const isPreview = which === 'preview';
    $('tabWrite').classList.toggle('is-on', !isPreview);
    $('tabPreview').classList.toggle('is-on', isPreview);
    $('tabWrite').setAttribute('aria-selected', !isPreview);
    $('tabPreview').setAttribute('aria-selected', isPreview);
    form.body.hidden = isPreview;
    mdPreview.hidden = !isPreview;
    if (isPreview) {
      mdPreview.innerHTML = form.body.value.trim()
        ? HT.markdown(form.body.value)
        : '<p class="empty-note">Nothing to preview yet.</p>';
    }
  };
  $('tabWrite').addEventListener('click', () => showTab('write'));
  $('tabPreview').addEventListener('click', () => showTab('preview'));

  // ---------- import a Markdown file ----------
  // Reads optional front matter (--- title: … ---) and a leading "# Title" line into the form.
  $('mdFile').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { alert('That file is larger than 2 MB.'); return; }
    let text = (await file.text()).replace(/^﻿/, '').replace(/\r\n?/g, '\n');
    if (form.body.value.trim() && !confirm('Replace the current story text with this file?')) return;

    const meta = {};
    const fm = text.match(/^---\n([\s\S]*?)\n---\n?/);
    if (fm) {
      fm[1].split('\n').forEach((line) => {
        const m = line.match(/^([A-Za-z_]+)\s*:\s*(.*)$/);
        if (m) meta[m[1].toLowerCase()] = m[2].trim().replace(/^["']|["']$/g, '');
      });
      text = text.slice(fm[0].length);
    }
    const h1 = text.match(/^\s*#\s+(.+)\n+/);
    if (h1 && !meta.title) { meta.title = h1[1].trim(); text = text.slice(h1[0].length); }

    const fill = (field, value) => { if (value && !form[field].value.trim()) form[field].value = value; };
    fill('title', meta.title);
    fill('author', meta.author);
    fill('category', meta.category || meta.section);
    fill('excerpt', meta.summary || meta.excerpt || meta.description);
    fill('link', meta.youtube || meta.link);
    form.body.value = text.trim();
    form.link.dispatchEvent(new Event('input'));
    showTab('preview');
  });

  // ---------- edit / reset ----------
  const startEdit = (s) => {
    editing = s;
    removeCover = false;
    form.reset();
    clearPrepared();
    form.title.value = s.title;
    form.category.value = s.category;
    form.author.value = s.author || '';
    form.excerpt.value = s.excerpt || '';
    form.body.value = s.body || '';
    form.link.value = s.link || '';
    form.coverUrl.value = s.cover && !s.coverKey ? s.cover : ''; // uploaded images are shown in the preview, not as a URL
    form.coverAlt.value = s.coverAlt || '';
    form.featured.checked = Boolean(s.featured);
    form.published.checked = s.published !== false;
    setResources(s.resources);
    showTab('write');
    $('formTitle').textContent = 'Edit story';
    $('submitBtn').textContent = 'Save changes';
    $('resetForm').hidden = false;
    $('formError').textContent = '';
    $('saved').textContent = '';
    form.link.dispatchEvent(new Event('input'));
    refreshPreview();
    renderList();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const resetForm = () => {
    editing = null;
    removeCover = false;
    form.reset();
    clearPrepared();
    setResources([]);
    showTab('write');
    $('formTitle').textContent = 'New story';
    $('submitBtn').textContent = 'Publish story';
    $('resetForm').hidden = true;
    $('formError').textContent = '';
    form.link.dispatchEvent(new Event('input'));
    refreshPreview();
    renderList();
  };
  $('resetForm').addEventListener('click', resetForm);

  // ---------- save ----------
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const err = $('formError');
    err.textContent = '';

    if (!form.title.value.trim()) { err.textContent = 'Please add a title.'; form.title.focus(); return; }
    if (!form.body.value.trim() && !form.link.value.trim()) { err.textContent = 'Add the story text, a link, or both.'; return; }
    if (form.link.value && !form.link.checkValidity()) { err.textContent = 'The link should start with https://'; form.link.focus(); return; }

    const resources = getResources();
    const badRes = resources.find((r) => !/^https?:\/\/\S+\.\S+/i.test(r.url));
    if (badRes) {
      err.textContent = 'Each resource needs a link starting with https://';
      badRes.el.querySelector('[data-k="url"]').focus();
      return;
    }

    const fd = new FormData(form);
    fd.set('resources', JSON.stringify(resources.map(({ title, url }) => ({ title, url }))));
    if (preparing) await preparing;
    fd.delete('coverFile');
    if (preparedCover) fd.set('coverFile', preparedCover, preparedCover.name);
    fd.set('featured', form.featured.checked ? 'true' : 'false');
    fd.set('published', form.published.checked ? 'true' : 'false');
    if (removeCover) fd.set('removeCover', 'true');

    const btn = $('submitBtn');
    btn.disabled = true;
    try {
      const saved = await api(editing ? '/api/admin/stories/' + editing.id : '/api/admin/stories', {
        method: editing ? 'PUT' : 'POST',
        body: fd,
      });
      const wasEditing = Boolean(editing);
      await loadStories();
      if (wasEditing) startEdit(stories.find((s) => s.id === saved.id) || saved);
      else resetForm();
      $('saved').innerHTML = `${wasEditing ? 'Saved' : 'Published'} · <a href="/story/${encodeURIComponent(saved.slug)}" target="_blank" rel="noopener" style="text-decoration:underline">view story</a>`;
    } catch (x) {
      err.textContent = x.message;
    } finally {
      btn.disabled = false;
    }
  });

  // ---------- boot ----------
  fetch('/api/me').then((r) => r.json()).then((m) => (m.authed ? showDash() : showLogin())).catch(showLogin);
})();
