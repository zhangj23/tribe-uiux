/**
 * File upload with drag-and-drop handling + URL input mode.
 * Posts to /api/upload (file) or /api/analyze/url (URL).
 */
const Upload = (() => {
  let selectedFile = null;
  let currentMode = 'file'; // 'file' or 'url'

  const ALLOWED_EXTENSIONS = [
    '.png', '.jpg', '.jpeg', '.webp', '.bmp', '.gif',
    '.mp4', '.mov', '.avi', '.mkv', '.webm',
    '.mp3', '.wav', '.ogg', '.flac', '.m4a',
  ];

  const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100 MB

  function init() {
    const dropzone = document.getElementById('dropzone');
    const fileInput = document.getElementById('fileInput');
    const browseBtn = document.getElementById('browseBtn');
    const analyzeBtn = document.getElementById('analyzeBtn');
    const fileRemove = document.getElementById('fileRemove');

    // Input mode toggle
    const toggleFile = document.getElementById('toggleFile');
    const toggleUrl = document.getElementById('toggleUrl');
    toggleFile.addEventListener('click', () => setMode('file'));
    toggleUrl.addEventListener('click', () => setMode('url'));

    // URL input
    const analyzeUrlBtn = document.getElementById('analyzeUrlBtn');
    const urlInput = document.getElementById('urlInput');
    analyzeUrlBtn.addEventListener('click', () => submitUrl());
    urlInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') submitUrl();
    });

    // Drag events
    dropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropzone.classList.add('drag-over');
    });

    dropzone.addEventListener('dragleave', () => {
      dropzone.classList.remove('drag-over');
    });

    dropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzone.classList.remove('drag-over');
      if (e.dataTransfer.files.length > 0) {
        selectFile(e.dataTransfer.files[0]);
      }
    });

    // Click to browse
    dropzone.addEventListener('click', (e) => {
      if (e.target !== browseBtn) {
        fileInput.click();
      }
    });

    browseBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      fileInput.click();
    });

    fileInput.addEventListener('change', () => {
      if (fileInput.files.length > 0) {
        selectFile(fileInput.files[0]);
      }
    });

    // Remove file
    fileRemove.addEventListener('click', () => {
      clearFile();
    });

    // Analyze button
    analyzeBtn.addEventListener('click', () => {
      if (selectedFile) {
        uploadFile(selectedFile);
      }
    });
  }

  function setMode(mode) {
    currentMode = mode;
    const toggleFile = document.getElementById('toggleFile');
    const toggleUrl = document.getElementById('toggleUrl');
    const dropzone = document.getElementById('dropzone');
    const uploadMeta = document.getElementById('uploadMeta');
    const urlWrap = document.getElementById('urlInputWrap');

    toggleFile.classList.toggle('toggle-btn--active', mode === 'file');
    toggleUrl.classList.toggle('toggle-btn--active', mode === 'url');

    if (mode === 'url') {
      dropzone.style.display = 'none';
      uploadMeta.style.display = 'none';
      urlWrap.style.display = 'block';
      document.getElementById('urlInput').focus();
    } else {
      dropzone.style.display = '';
      urlWrap.style.display = 'none';
      // Show upload meta only if a file is selected
      uploadMeta.style.display = selectedFile ? 'flex' : 'none';
    }

    hideUploadError();
    hideUrlError();
  }

  function showUploadError(message) {
    const errorEl = document.getElementById('uploadError');
    errorEl.textContent = message;
    errorEl.style.display = 'block';
  }

  function hideUploadError() {
    const errorEl = document.getElementById('uploadError');
    errorEl.textContent = '';
    errorEl.style.display = 'none';
  }

  function showUrlError(message) {
    const errorEl = document.getElementById('urlError');
    errorEl.textContent = message;
    errorEl.style.display = 'block';
  }

  function hideUrlError() {
    const errorEl = document.getElementById('urlError');
    errorEl.textContent = '';
    errorEl.style.display = 'none';
  }

  function isAllowedFile(file) {
    const name = file.name.toLowerCase();
    return ALLOWED_EXTENSIONS.some(ext => name.endsWith(ext));
  }

  function selectFile(file) {
    hideUploadError();

    if (!isAllowedFile(file)) {
      showUploadError('Unsupported file type. Allowed: ' + ALLOWED_EXTENSIONS.join(', '));
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      showUploadError('File too large. Maximum size is 100 MB.');
      return;
    }

    selectedFile = file;
    const meta = document.getElementById('uploadMeta');
    const nameEl = document.getElementById('fileName');
    const sizeEl = document.getElementById('fileSize');
    const iconEl = document.getElementById('fileIcon');

    nameEl.textContent = file.name;
    sizeEl.textContent = formatSize(file.size);

    // Set icon based on type
    if (file.type.startsWith('image/')) {
      iconEl.textContent = '\u{1F5BC}';
    } else if (file.type.startsWith('video/')) {
      iconEl.textContent = '\u{1F3AC}';
    } else if (file.type.startsWith('audio/')) {
      iconEl.textContent = '\u{1F3B5}';
    } else {
      iconEl.textContent = '\u25C9';
    }

    meta.style.display = 'flex';
  }

  function clearFile() {
    selectedFile = null;
    document.getElementById('uploadMeta').style.display = 'none';
    document.getElementById('fileInput').value = '';
    hideUploadError();
    // Reset analyze button state (may be stuck from previous upload)
    const btn = document.getElementById('analyzeBtn');
    btn.disabled = false;
    btn.querySelector('.btn-text').textContent = 'Begin Analysis';

    // Also reset URL input
    document.getElementById('urlInput').value = '';
    hideUrlError();
    const urlBtn = document.getElementById('analyzeUrlBtn');
    urlBtn.disabled = false;
    urlBtn.querySelector('.btn-text').textContent = 'Analyze';
  }

  async function uploadFile(file) {
    const analyzeBtn = document.getElementById('analyzeBtn');
    const btnText = analyzeBtn.querySelector('.btn-text');

    // Guard against double-submit
    analyzeBtn.disabled = true;
    btnText.textContent = 'Uploading...';
    hideUploadError();

    const formData = new FormData();
    formData.append('file', file);

    try {
      const resp = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!resp.ok) {
        const err = await resp.json();
        throw new Error(err.detail || 'Upload failed');
      }

      const data = await resp.json();
      App.startProcessing(data.job_id);
    } catch (err) {
      showUploadError('Upload error: ' + err.message);
      clearFile();
      analyzeBtn.disabled = false;
      btnText.textContent = 'Begin Analysis';
    }
  }

  async function submitUrl() {
    const urlInput = document.getElementById('urlInput');
    const btn = document.getElementById('analyzeUrlBtn');
    const btnText = btn.querySelector('.btn-text');

    const url = urlInput.value.trim();
    hideUrlError();

    if (!url) {
      showUrlError('Please enter a URL');
      return;
    }

    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      showUrlError('URL must start with http:// or https://');
      return;
    }

    btn.disabled = true;
    btnText.textContent = 'Capturing...';

    try {
      const resp = await fetch('/api/analyze/url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });

      if (!resp.ok) {
        const err = await resp.json();
        throw new Error(err.detail || 'URL analysis failed');
      }

      const data = await resp.json();
      App.startProcessing(data.job_id);
    } catch (err) {
      showUrlError('Error: ' + err.message);
      btn.disabled = false;
      btnText.textContent = 'Analyze';
    }
  }

  function formatSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  return { init, clearFile };
})();
