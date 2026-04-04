/**
 * File upload with drag-and-drop handling.
 * Posts to /api/upload and returns a job_id.
 */
const Upload = (() => {
  let selectedFile = null;

  function init() {
    const dropzone = document.getElementById('dropzone');
    const fileInput = document.getElementById('fileInput');
    const browseBtn = document.getElementById('browseBtn');
    const analyzeBtn = document.getElementById('analyzeBtn');
    const fileRemove = document.getElementById('fileRemove');

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

  function selectFile(file) {
    selectedFile = file;
    const meta = document.getElementById('uploadMeta');
    const nameEl = document.getElementById('fileName');
    const sizeEl = document.getElementById('fileSize');
    const iconEl = document.getElementById('fileIcon');

    nameEl.textContent = file.name;
    sizeEl.textContent = formatSize(file.size);

    // Set icon based on type
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
    selectedFile = null;
    document.getElementById('uploadMeta').style.display = 'none';
    document.getElementById('fileInput').value = '';
  }

  async function uploadFile(file) {
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
      alert('Upload error: ' + err.message);
    }
  }

  function formatSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  return { init, clearFile };
})();
