/**
 * File upload with drag-and-drop handling.
 * Uses XMLHttpRequest for upload progress events.
 */
const Upload = (() => {
  let selectedFile = null;
  let currentXHR = null;

  function init() {
    const dropzone = document.getElementById('dropzone');
    const fileInput = document.getElementById('fileInput');
    const browseBtn = document.getElementById('browseBtn');
    const analyzeBtn = document.getElementById('analyzeBtn');
    const fileRemove = document.getElementById('fileRemove');

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

    fileRemove.addEventListener('click', () => {
      clearFile();
    });

    analyzeBtn.addEventListener('click', () => {
      if (selectedFile) {
        uploadFile(selectedFile);
      }
    });
  }

  function selectFile(file) {
    selectedFile = file;
    const meta = document.getElementById('uploadMeta');
    const nameEl = document.getElementById('fileName');
    const sizeEl = document.getElementById('fileSize');
    const iconEl = document.getElementById('fileIcon');

    nameEl.textContent = file.name;
    sizeEl.textContent = formatSize(file.size);

    if (file.type.startsWith('image/')) {
      iconEl.textContent = '🖼';
    } else if (file.type.startsWith('video/')) {
      iconEl.textContent = '🎬';
    } else if (file.type.startsWith('audio/')) {
      iconEl.textContent = '🎵';
    } else {
      iconEl.textContent = '◉';
    }

    meta.style.display = 'flex';
  }

  function clearFile() {
    if (currentXHR) {
      currentXHR.abort();
      currentXHR = null;
    }
    selectedFile = null;
    document.getElementById('uploadMeta').style.display = 'none';
    document.getElementById('fileInput').value = '';
<<<<<<< Updated upstream
  }

  async function uploadFile(file) {
=======
    hideUploadError();
    hideProgress();
    const btn = document.getElementById('analyzeBtn');
    btn.disabled = false;
    btn.querySelector('.btn-text').textContent = 'Begin Analysis';
  }

  function showProgress(pct) {
    const wrap = document.getElementById('uploadProgressWrap');
    const bar = document.getElementById('uploadProgressBar');
    const label = document.getElementById('uploadProgressPct');
    if (!wrap) return;
    wrap.style.display = 'block';
    bar.style.width = pct + '%';
    label.textContent = Math.round(pct) + '%';
  }

  function hideProgress() {
    const wrap = document.getElementById('uploadProgressWrap');
    if (wrap) wrap.style.display = 'none';
  }

  function uploadFile(file) {
    const analyzeBtn = document.getElementById('analyzeBtn');
    const btnText = analyzeBtn.querySelector('.btn-text');

    analyzeBtn.disabled = true;
    btnText.textContent = 'Uploading...';
    hideUploadError();
    showProgress(0);

>>>>>>> Stashed changes
    const formData = new FormData();
    formData.append('file', file);

    const xhr = new XMLHttpRequest();
    currentXHR = xhr;

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) {
        const pct = (e.loaded / e.total) * 100;
        showProgress(pct);
        btnText.textContent = Math.round(pct) + '% uploaded';
      }
    });

<<<<<<< Updated upstream
      const data = await resp.json();
      App.startProcessing(data.job_id);
    } catch (err) {
      alert('Upload error: ' + err.message);
    }
=======
    xhr.addEventListener('load', () => {
      currentXHR = null;
      hideProgress();
      if (xhr.status >= 200 && xhr.status < 300) {
        const data = JSON.parse(xhr.responseText);
        App.startProcessing(data.job_id);
      } else {
        let msg = 'Upload failed';
        try {
          const err = JSON.parse(xhr.responseText);
          msg = err.detail || msg;
        } catch {}
        showUploadError('Upload error: ' + msg);
        clearFile();
        analyzeBtn.disabled = false;
        btnText.textContent = 'Begin Analysis';
      }
    });

    xhr.addEventListener('error', () => {
      currentXHR = null;
      hideProgress();
      showUploadError('Upload error: Network failure');
      clearFile();
      analyzeBtn.disabled = false;
      btnText.textContent = 'Begin Analysis';
    });

    xhr.addEventListener('abort', () => {
      currentXHR = null;
      hideProgress();
    });

    xhr.open('POST', '/api/upload');
    xhr.send(formData);
>>>>>>> Stashed changes
  }

  function formatSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  return { init, clearFile };
})();
