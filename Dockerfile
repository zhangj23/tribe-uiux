FROM python:3.12-slim

# Install ffmpeg for media conversion
RUN apt-get update && \
    apt-get install -y --no-install-recommends ffmpeg && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python dependencies
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY backend/ .
COPY data/ /app/data/

# Create upload directory
RUN mkdir -p /app/data/uploads

EXPOSE 9100

CMD ["python", "run.py"]
