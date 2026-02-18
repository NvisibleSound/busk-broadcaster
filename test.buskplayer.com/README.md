# Busk Icecast Server

Icecast streaming server for test.buskplayer.com

**Server path:** `/root/busk-broadcaster/test.buskplayer.com`

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      BROADCASTING                           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Desktop Apps (butt, ffmpeg)                                │
│       │                                                     │
│       └──► test.buskplayer.com:8000 (direct, no SSL)        │
│                                                             │
│  Browser (busk-broadcaster app)                             │
│       │                                                     │
│       └──► wss://test.buskplayer.com/ws (WebSocket + SSL)   │
│            │                                                │
│            └──► broadcaster container ──► icecast:8000      │
│                                                             │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                       LISTENING                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  https://test.buskplayer.com/ether  (via Caddy, with SSL)   │
│  http://test.buskplayer.com:8000/ether (direct, no SSL)     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Listening

### Browser
Open: https://test.buskplayer.com/ether

### HTML5 Audio
```html
<audio src="https://test.buskplayer.com/ether" controls></audio>
```

### ffplay
```bash
ffplay https://test.buskplayer.com/ether
```

### VLC
```bash
open -a VLC https://test.buskplayer.com/ether
```

### mpv
```bash
mpv https://test.buskplayer.com/ether
```

## Broadcasting

### Option 1: ffmpeg (command line)

```bash
# From macOS (using MacBook microphone - device :2)
ffmpeg -f avfoundation -i ":2" \
  -acodec libmp3lame -ab 128k -ar 48000 \
  -content_type audio/mpeg \
  -f mp3 "icecast://source:EtherIsBetter@test.buskplayer.com:8000/ether"

# From Linux (using default audio input)
ffmpeg -f alsa -i default \
  -acodec libmp3lame -ab 128k -ar 48000 \
  -content_type audio/mpeg \
  -f mp3 "icecast://source:EtherIsBetter@test.buskplayer.com:8000/ether"

# Stream an audio file
ffmpeg -re -i /path/to/audio.mp3 \
  -acodec libmp3lame -ab 128k -ar 48000 \
  -content_type audio/mpeg \
  -f mp3 "icecast://source:EtherIsBetter@test.buskplayer.com:8000/ether"
```

### Option 2: butt (Broadcast Using This Tool)

1. Download from: https://danielnoethen.de/butt/
2. Settings > Server > Add:
   - **Address:** test.buskplayer.com
   - **Port:** 8000
   - **Password:** EtherIsBetter
   - **Mount:** /ether
   - **SSL/TLS:** OFF (port 8000 is unencrypted)
3. Select audio input device
4. Click Play to start broadcasting

### Option 3: Browser (busk-broadcaster app)

1. Open the busk-broadcaster web app
2. Select your microphone
3. Click "Start Broadcast"
4. Audio is sent via WebSocket to `wss://test.buskplayer.com/ws`

## Server Administration

### Admin Panel
- **URL:** https://test.buskplayer.com/admin
- **Username:** admin
- **Password:** hackme

### Status Pages
- **HTML Status:** https://test.buskplayer.com/
- **JSON Status:** https://test.buskplayer.com/status-json.xsl

### Mount Points
| Mount | Description |
|-------|-------------|
| `/ether` | Main broadcast mount point |

## Credentials

| Purpose | Username | Password |
|---------|----------|----------|
| Source (broadcasting) | source | EtherIsBetter |
| Admin | admin | hackme |

## Docker Services

| Service | Container | Port | Description |
|---------|-----------|------|-------------|
| icecast | icecast | 8000 | Icecast streaming server |
| broadcaster | broadcaster | 8081 | WebSocket to Icecast bridge |
| caddy | caddy | 80, 443 | Reverse proxy with SSL |

### Commands

```bash
# Start all services
docker compose up -d

# View logs
docker compose logs -f

# Restart services
docker compose restart

# Stop all services
docker compose down

# Rebuild and restart
docker compose up -d --build
```

## Testing

Run the test script to verify the Icecast server is working correctly:

```bash
./scripts/test.sh
```

This script will:
1. Generate a 440Hz test tone
2. Broadcast it to the Icecast server
3. Capture audio from the stream
4. Verify audio was successfully received

You can customize the test with environment variables:

```bash
# Custom server
ICECAST_HOST=my.server.com ICECAST_PORT=8000 ./scripts/test.sh

# Longer broadcast duration
BROADCAST_DURATION=30 ./scripts/test.sh
```

## Configuration Files

- `icecast-config/icecast.xml` - Icecast server configuration
- `Caddyfile` - Caddy reverse proxy configuration
- `broadcaster/server.js` - WebSocket to Icecast bridge
- `scripts/test.sh` - Broadcast test script

## Low-Latency Mode

To keep listener delay as low as possible for browser streams:

1. **Icecast (`icecast-config/icecast.xml`)**
   - Set `<burst-on-connect>0</burst-on-connect>`
   - Keep `<queue-size>` small (e.g. `65536`)
   - Keep mount `<burst-size>` small (e.g. `8192`)
   - Remove mount `<intro>` for live streams

2. **Caddy (`Caddyfile`)**
   - Do not apply gzip encoding to the stream path
   - Use `flush_interval -1` on `reverse_proxy` for stream and websocket routes

3. **Broadcaster server**
   - Use FFmpeg transcoding for browser WebM/Opus ingest when listener compatibility is required
   - Current stable listener output is MP3 (`audio/mpeg`)
   - Keep encoder settings tuned for low delay and avoid large internal buffering

### Stable Baseline

- Browser ingest: `audio/webm;codecs=opus`
- Icecast listener output: `audio/mpeg`
- Default MP3 bitrate: `192 kbps`

### Apply Changes

After any latency-related config edit:

```bash
docker compose up -d --build
docker compose restart
```

Then verify with:

```bash
curl -sS -D - "https://test.buskplayer.com/ether" --max-time 3 -o /dev/null
```
