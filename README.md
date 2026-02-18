# Busk Broadcaster

A real-time audio broadcasting application that streams audio from your microphone to an Icecast server via WebSocket. Built with React and Node.js, this application provides professional-grade audio streaming capabilities with real-time monitoring and control.

## Features

- **Real-time Audio Streaming**: Stream audio directly from your microphone to Icecast servers
- **Live Audio Monitoring**: Real-time stereo level meters with color-coded audio levels
- **Volume Control**: Precise broadcast signal level control
- **Device Selection**: Choose from available audio input devices
- **Connection Management**: Automatic reconnection with error handling
- **Broadcast Statistics**: Live display of stream time, format, bitrate, and connection status

## Technical Specifications

- **Ingest Format (browser -> server)**: WebM/Opus (MediaRecorder)
- **Listener Format (Icecast output)**: MP3 (`audio/mpeg`)
- **Bitrate**: 192 kbps listener output (default)
- **Sample Rate**: 48 kHz
- **Channels**: Stereo (2 channels)
- **Streaming Protocol**: WebSocket → TCP → Icecast

## Architecture

```
Browser Audio → Web Audio API → MediaRecorder → WebSocket → Node.js Server → TCP → Icecast Server
```

- **Frontend**: React application (port 3000)
- **WebSocket Server**: Node.js proxy server (port 8081)
- **Icecast Server**: External streaming server (64.227.99.194:8000)

## Quick Start

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- Modern web browser with Web Audio API support

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd busk-broadcaster
```

2. Install dependencies:
```bash
npm install
```

### Running the Application

1. **Start app + WebSocket server**:
```bash
npm run dev
```
This starts Vite on port 3000 and the WebSocket server on port 8081 in one command.

2. **Open your browser** and navigate to:
```
http://localhost:3000
```

### Usage

1. **Select Audio Device**: Click "Audio" in the header to choose your input device
2. **Configure Settings**: Click "Settings" to set artist, description, and genre tags
3. **Monitor Audio Levels**: Use the stereo level meters to monitor your audio input
4. **Adjust Volume**: Use the volume control to set your broadcast signal level
5. **Start Broadcasting**: Click the broadcast button to begin streaming
6. **Monitor Stats**: Watch the broadcast statistics for connection status and stream information

### Stream Access

**Broadcasting:**
- **Target Server**: `64.227.99.194:8000` (HTTP)
- **Authentication**: source:EtherIsBetter
- **Browser Ingest**: `audio/webm;codecs=opus`

**Listening:**
- **Public URL (HTTPS only)**: `https://test.buskplayer.com/[mountpoint]`
- **Output Format**: `audio/mpeg`

The public listener URL is HTTPS via the domain. Do not distribute direct `:8000` HTTP links.

## Configuration

### Icecast Server Settings
- **Server**: 64.227.99.194:8000
- **Mount Point**: /ether
- **Authentication**: source:EtherIsBetter
- **Format**: audio/mpeg

### Development Ports
- **Frontend**: 3000
- **WebSocket Server**: 8081
- **Icecast**: 8000

## Development

Future work planning: see `NEAR_ZERO_LATENCY_PLAN.md` for the parallel near-live monitor path.

### Available Scripts

- `npm run dev` - Start frontend + WebSocket server
- `npm run dev:client` - Start frontend only
- `npm run server` - Start WebSocket server only
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

### Project Structure

```
src/
├── audio/
│   ├── capture/
│   │   ├── Capture.js            # Capture interface
│   │   └── MediaRecorderCapture.js # MediaRecorder implementation
│   └── transport/
│       └── WebSocketTransport.js # WebSocket transport module
├── components/
│   ├── IcecastBroadcaster.js    # Main broadcasting component
│   ├── AudioMeters.js           # Real-time audio level meters
│   ├── BroadcastStats.js        # Stream statistics display
│   └── VolumeControl.js         # Volume control slider
├── config/
│   └── BroadcastConfig.js       # Server configuration
├── protocol/
│   └── audioMessages.js         # Audio/config message protocol helpers
└── App.js                       # Main application component

server.js                        # WebSocket server
```

## Troubleshooting

### Common Issues

1. **Audio Context Suspended**: The browser may suspend the audio context. The application automatically resumes it when needed.

2. **Connection Drops**: The system includes automatic reconnection with exponential backoff. Check your network connection if issues persist.

3. **Audio Device Not Working**: Ensure you've granted microphone permissions and selected the correct input device.

4. **WebSocket Connection Failed**: Verify that the WebSocket server is running on port 8081 and not blocked by firewall.

5. **Listener count increases but no sound**:
- Opening the stream URL can still register a listener even if playback is paused/muted.
- Verify stream transport with:
  ```bash
  curl -sS -D - "https://test.buskplayer.com/ether" --range 0-512 -o /dev/null
  ```
  Expected header: `content-type: audio/mpeg`.

### Browser Compatibility

- Chrome/Chromium (recommended)
- Firefox
- Safari (limited Web Audio API support)
- Edge

## Production Deployment

For production deployment, ensure:
- WebSocket server is accessible from your domain
- SSL/TLS certificates are properly configured
- Firewall allows connections to required ports
- Icecast server credentials are secure

## Test Server (test.buskplayer.com)

A complete Icecast server deployment is available in the `test.buskplayer.com/` directory. This includes:

- **Icecast server** with Docker
- **WebSocket broadcaster** service for browser-based streaming
- **Caddy** reverse proxy with automatic SSL

See [test.buskplayer.com/README.md](test.buskplayer.com/README.md) for full documentation.

### Quick Test

```bash
cd test.buskplayer.com
./scripts/test.sh
```

### Server Endpoints

| Purpose | URL |
|---------|-----|
| Listen (HTTPS) | https://test.buskplayer.com/ether |
| Broadcast (ffmpeg/butt) | test.buskplayer.com:8000 |
| Broadcast (browser) | wss://test.buskplayer.com/ws |
| Admin | https://test.buskplayer.com/admin |

## License

[Add your license information here]

## Support

For issues and questions, please refer to the project documentation or create an issue in the repository.