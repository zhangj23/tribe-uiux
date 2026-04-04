# TRIBE UX Analyzer — Dockerized deployment
# Uses CUDA-capable PyTorch for GPU inference, falls back to CPU
#
# License: CC-BY-NC-4.0 (non-commercial use only, due to TRIBE v2)

FROM nvidia/cuda:12.4.1-runtime-ubuntu22.04

# Prevent interactive prompts
ENV DEBIAN_FRONTEND=noninteractive
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Install system deps
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3.11 python3.11-venv python3-pip \
    ffmpeg \
    wget curl \
    # Playwright deps
    libnss3 libatk-bridge2.0-0 libdrm2 libxcomposite1 \
    libxdamage1 libxrandr2 libgbm1 libpango-1.0-0 \
    libcairo2 libasound2 libatspi2.0-0 libxshmfence1 \
    && rm -rf /var/lib/apt/lists/*

# Use python3.11 as default
RUN update-alternatives --install /usr/bin/python python /usr/bin/python3.11 1 \
    && update-alternatives --install /usr/bin/python3 python3 /usr/bin/python3.11 1

WORKDIR /app

# Install Python dependencies
COPY backend/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Install CUDA PyTorch
RUN pip install --no-cache-dir \
    torch torchvision --index-url https://download.pytorch.org/whl/cu124

# Install TRIBE v2
RUN pip install --no-cache-dir \
    git+https://github.com/facebookresearch/tribev2.git

# Install Playwright + Chromium
RUN pip install --no-cache-dir playwright \
    && python -m playwright install chromium --with-deps

# Copy application code
COPY backend/ /app/backend/
COPY frontend/ /app/frontend/
COPY scripts/ /app/scripts/
COPY data/ /app/data/

# Set working directory to backend
WORKDIR /app/backend

# Create data directories
RUN mkdir -p /app/data/uploads /app/data/baselines /app/backend/cache

# Expose port
EXPOSE 9100

# Health check
HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
    CMD curl -f http://localhost:9100/api/health || exit 1

# Run the application
CMD ["python", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "9100"]
