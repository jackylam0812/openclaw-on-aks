FROM ghcr.io/openclaw/openclaw:latest
COPY patch.py /tmp/patch.py
RUN python3 /tmp/patch.py; rm -f /tmp/patch.py || true
