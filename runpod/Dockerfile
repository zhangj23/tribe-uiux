# RunPod Serverless — TRIBE v2 GPU inference worker
# License: CC-BY-NC-4.0 (non-commercial use only, due to TRIBE v2)

FROM nvidia/cuda:12.4.1-runtime-ubuntu22.04

ENV DEBIAN_FRONTEND=noninteractive
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# System deps
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3.11 python3.11-venv python3-pip \
    ffmpeg \
    wget curl git \
    && rm -rf /var/lib/apt/lists/*

RUN update-alternatives --install /usr/bin/python python /usr/bin/python3.11 1 \
    && update-alternatives --install /usr/bin/python3 python3 /usr/bin/python3.11 1

WORKDIR /worker

# Upgrade pip + setuptools so tribev2's setup.py builds with proper metadata
RUN pip install --no-cache-dir --upgrade pip setuptools wheel

# Install PyTorch with CUDA (long timeout for large downloads)
RUN pip install --no-cache-dir --timeout 600 \
    torch torchvision --index-url https://download.pytorch.org/whl/cu124

# Install TRIBE v2
RUN pip install --no-cache-dir --timeout 600 \
    git+https://github.com/facebookresearch/tribev2.git \
    && python -c "from tribev2 import TribeModel; print('tribev2 import OK')"

# Install RunPod SDK + numpy
RUN pip install --no-cache-dir runpod numpy

# Pre-download TRIBE v2 weights at build time (avoids ~2min cold start)
RUN python -c "\
from tribev2 import TribeModel; \
TribeModel.from_pretrained('facebook/tribev2', checkpoint_name='best.ckpt', cache_folder='/cache', device='cpu')" \
    && echo 'Model weights cached'

# Copy handler
COPY handler.py /worker/handler.py
COPY _media_utils.py /worker/_media_utils.py

ENV TRIBE_CACHE_DIR=/cache

CMD ["python", "handler.py"]
