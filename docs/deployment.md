# Deployment Guide

## License

**CC-BY-NC-4.0 — Non-commercial use only.**

This project uses Meta's TRIBE v2 model which is licensed under CC-BY-NC-4.0. This license applies to the entire project. You may not use this software for commercial purposes.

## Prerequisites

- Docker with NVIDIA Container Toolkit (for GPU mode)
- At minimum 16GB RAM (model loading + inference)
- GPU with 10GB+ VRAM recommended (falls back to CPU otherwise)

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `TRIBE_MOCK_MODE` | `true` | Set `false` for real TRIBE v2 inference |
| `TRIBE_DEVICE` | `auto` | `auto`, `cuda`, or `cpu` |
| `ANTHROPIC_API_KEY` | (empty) | Claude API key for LLM analysis |

## Quick Start

### 1. Clone and configure

```bash
git clone https://github.com/zhangj23/tribe-uiux.git
cd tribe-uiux
cp backend/.env.example backend/.env
# Edit backend/.env with your settings
```

### 2. Build and run

```bash
# CPU mode (mock inference)
docker compose up --build

# GPU mode (real TRIBE v2)
# Requires: nvidia-docker2 or NVIDIA Container Toolkit
docker compose up --build
# Set TRIBE_MOCK_MODE=false in backend/.env
```

### 3. Access

Open http://localhost:9100

## GPU Passthrough Setup

### Linux

```bash
# Install NVIDIA Container Toolkit
distribution=$(. /etc/os-release;echo $ID$VERSION_ID)
curl -fsSL https://nvidia.github.io/libnvidia-container/gpgkey | sudo gpg --dearmor -o /usr/share/keyrings/nvidia-container-toolkit-keyring.gpg
curl -s -L https://nvidia.github.io/libnvidia-container/$distribution/libnvidia-container.list | \
  sed 's#deb https://#deb [signed-by=/usr/share/keyrings/nvidia-container-toolkit-keyring.gpg] https://#g' | \
  sudo tee /etc/apt/sources.list.d/nvidia-container-toolkit.list
sudo apt-get update && sudo apt-get install -y nvidia-container-toolkit
sudo systemctl restart docker
```

### Windows (WSL2)

Docker Desktop with WSL2 backend automatically supports GPU passthrough if:
1. NVIDIA GPU drivers are installed on the Windows host
2. WSL2 is configured with GPU support
3. Docker Desktop > Settings > Resources > WSL Integration is enabled

## Without Docker

```bash
# 1. Install dependencies
cd backend
pip install -r requirements.txt
pip install torch torchvision --index-url https://download.pytorch.org/whl/cu124
pip install git+https://github.com/facebookresearch/tribev2.git
pip install playwright && npx playwright install chromium

# 2. Configure
cp .env.example .env
# Edit .env

# 3. Run
python run.py
# Open http://localhost:9100
```

## Performance Notes

- **Mock mode**: Instant results (2s simulated delay)
- **Real TRIBE on GPU (10GB+ VRAM)**: ~30-60s per analysis
- **Real TRIBE on CPU**: ~3-5 minutes per analysis
- **URL input**: Adds ~3-5s for Playwright screenshot capture
- First run downloads TRIBE v2 weights (~2GB from HuggingFace)
