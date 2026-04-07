# RunPod Serverless — TRIBE v2 Inference

Deploy TRIBE v2 inference as a RunPod Serverless endpoint so you can run the app locally (or on a cheap server) and only pay for GPU time during actual inference.

## Setup

### 1. Create a RunPod account

Sign up at [runpod.io](https://www.runpod.io/) and add billing.

### 2. Build and push the Docker image

You need a Docker registry (Docker Hub, GitHub Container Registry, etc.):

```bash
cd runpod

# Build the image (this downloads TRIBE v2 weights — ~2GB, takes a while)
docker build -t <your-registry>/tribe-runpod:latest .

# Push to registry
docker push <your-registry>/tribe-runpod:latest
```

### 3. Create a Serverless Endpoint on RunPod

1. Go to [RunPod Console → Serverless](https://www.runpod.io/console/serverless)
2. Click **New Endpoint**
3. Configure:
   - **Container Image**: `<your-registry>/tribe-runpod:latest`
   - **GPU**: RTX 3090 or RTX 4090 (24GB VRAM, cheapest options)
   - **Min Workers**: 0 (scale to zero when idle)
   - **Max Workers**: 1 (increase if you need concurrency)
   - **Idle Timeout**: 5 seconds (keeps worker warm briefly between requests)
   - **Execution Timeout**: 300 seconds
4. Click **Create**
5. Copy the **Endpoint ID** from the dashboard

### 4. Get your API Key

1. Go to [RunPod Console → Settings → API Keys](https://www.runpod.io/console/user/settings)
2. Create a new API key
3. Copy it

### 5. Configure your app

Add to your `backend/.env`:

```env
TRIBE_MOCK_MODE=false
RUNPOD_ENDPOINT_ID=your_endpoint_id_here
RUNPOD_API_KEY=your_api_key_here
```

Then run the app normally:

```bash
cd backend
python run.py
```

The app will automatically send TRIBE inference requests to RunPod instead of running locally.

## How it works

```
┌─────────────┐         ┌──────────────────┐         ┌──────────────────┐
│  Your app   │  HTTP   │  RunPod Endpoint  │  GPU    │  TRIBE v2 model  │
│  (local/    │────────>│  (serverless)     │────────>│  (inference)     │
│   cheap VM) │<────────│                   │<────────│                  │
└─────────────┘  JSON   └──────────────────┘  result  └──────────────────┘
```

- Media files are base64-encoded and sent to RunPod via HTTP
- RunPod spins up a GPU worker (cold start ~30-60s, warm ~instant)
- TRIBE v2 runs inference and returns predictions
- Your app receives the results and continues the analysis pipeline

## Cost

- **Cold start**: ~30-60 seconds (first request after idle)
- **Warm inference**: ~30-60 seconds per analysis
- **Cost per run**: ~$0.01-0.03 (30-60s on an RTX 4090 at $0.00044/sec)
- **Idle cost**: $0 (scales to zero)

## Testing the endpoint

```bash
# Test with RunPod API directly
curl -X POST "https://api.runpod.ai/v2/YOUR_ENDPOINT_ID/runsync" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "input": {
      "media_base64": "'$(base64 -w0 test_image.png)'",
      "media_type": "image",
      "filename": "test.png"
    }
  }'
```
