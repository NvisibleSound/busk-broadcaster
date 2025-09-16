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

- **Audio Format**: WebM container with Opus codec
- **Bitrate**: 128 kbps
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

1. **Start the WebSocket Server** (in one terminal):
```bash
node server.js
```
The server will start on port 8081 and connect to the Icecast server.

2. **Start the Frontend** (in another terminal):
```bash
npm run dev
```
The React application will start on port 3000.

3. **Open your browser** and navigate to:
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
- **Format**: audio/webm;codecs=opus

**Listening:**
- **HTTPS URL**: `https://www.buskplayer.com/[mountpoint]`
- **Direct HTTP**: `http://64.227.99.194:8000/[mountpoint]`

The buskplayer domain forwards HTTPS traffic to the Icecast server via GoDaddy, providing secure access for listeners while broadcasting goes directly to the IP address.

## Configuration

### Icecast Server Settings
- **Server**: 64.227.99.194:8000
- **Mount Point**: /ether
- **Authentication**: source:EtherIsBetter
- **Format**: audio/webm;codecs=opus

### Development Ports
- **Frontend**: 3000
- **WebSocket Server**: 8081
- **Icecast**: 8000

## Development

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

### Project Structure

```
src/
├── components/
│   ├── IcecastBroadcaster.js    # Main broadcasting component
│   ├── AudioMeters.js           # Real-time audio level meters
│   ├── BroadcastStats.js        # Stream statistics display
│   └── VolumeControl.js         # Volume control slider
├── config/
│   └── BroadcastConfig.js       # Server configuration
└── App.jsx                      # Main application component

server.js                        # WebSocket server
```

## Troubleshooting

### Common Issues

1. **Audio Context Suspended**: The browser may suspend the audio context. The application automatically resumes it when needed.

2. **Connection Drops**: The system includes automatic reconnection with exponential backoff. Check your network connection if issues persist.

3. **Audio Device Not Working**: Ensure you've granted microphone permissions and selected the correct input device.

4. **WebSocket Connection Failed**: Verify that the WebSocket server is running on port 8081 and not blocked by firewall.

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

## License

[Add your license information here]

## Support

For issues and questions, please refer to the project documentation or create an issue in the repository.