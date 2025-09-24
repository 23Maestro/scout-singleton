# Use Python slim image
FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Set Python unbuffered mode
ENV PYTHONUNBUFFERED=1

# Install system dependencies for web automation including Playwright
RUN apt-get update && apt-get install -y \
    curl \
    wget \
    gnupg \
    libnss3 \
    libatk-bridge2.0-0 \
    libdrm2 \
    libxkbcommon0 \
    libgtk-3-0 \
    libgbm1 \
    libasound2 \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for better caching
COPY requirements.txt .

# Install dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Create non-root user first
RUN useradd -m -u 1000 mcpuser

# Install Playwright browsers as root (system-wide)
RUN playwright install chromium
RUN playwright install-deps chromium

# Copy the server code
COPY scout_npid_server.py .
COPY npid_bridge.py .

# Change ownership to mcpuser and copy Playwright browsers to user directory
RUN chown -R mcpuser:mcpuser /app && \
    cp -r /root/.cache/ms-playwright /home/mcpuser/.cache/ && \
    chown -R mcpuser:mcpuser /home/mcpuser/.cache/ms-playwright

# Switch to non-root user
USER mcpuser

# Expose the HTTP bridge port
EXPOSE 8812

# Run the HTTP bridge server
CMD ["python", "npid_bridge.py"]
