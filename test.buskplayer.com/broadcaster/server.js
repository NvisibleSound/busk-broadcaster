import { WebSocketServer } from 'ws';
import net from 'net';
import { spawn } from 'child_process';

// Configuration - use environment variables for Docker
const ICECAST_HOST = process.env.ICECAST_HOST || 'icecast';
const ICECAST_PORT = parseInt(process.env.ICECAST_PORT || '8000');
const ICECAST_PASSWORD = process.env.ICECAST_PASSWORD || 'EtherIsBetter';
const WS_PORT = parseInt(process.env.WS_PORT || '8081');

const wss = new WebSocketServer({ port: WS_PORT });
console.log(`WebSocket server started on port ${WS_PORT}`);
console.log(`Icecast target: ${ICECAST_HOST}:${ICECAST_PORT}`);

wss.on('connection', async (ws) => {
  console.log('Browser connected to WebSocket server');
  let icecast = null;
  let isSourceEstablished = false;
  let totalBytesReceived = 0;
  let totalBytesSent = 0;
  let isFirstChunk = true;
  let sourceName = 'Ether';
  let description = 'sounds from the universe';
  let mountpoint = '/ether';
  let tags = [];
  let contentType = 'audio/webm;codecs=opus';
  let ffmpegProcess = null;

  const startFFmpegConversion = () => {
    console.log('Starting FFmpeg conversion from', contentType, 'to MP3');

    if (ffmpegProcess) {
      ffmpegProcess.kill();
    }

    try {
      ffmpegProcess = spawn('ffmpeg', [
        '-f', 'webm',
        '-i', 'pipe:0',
        '-f', 'mp3',
        '-acodec', 'mp3',
        '-ab', '128k',
        '-ar', '48000',
        '-ac', '2',
        'pipe:1'
      ], {
        stdio: ['pipe', 'pipe', 'pipe']
      });

      ffmpegProcess.stdout.on('data', (data) => {
        if (icecast && isSourceEstablished) {
          try {
            const writeSuccess = icecast.write(data);
            totalBytesSent += data.length;

            if (!writeSuccess) {
              console.log('Write buffer full - waiting for drain');
            }
          } catch (error) {
            console.error('Error writing converted audio to Icecast:', error);
          }
        }
      });

      ffmpegProcess.stderr.on('data', (data) => {
        console.log('FFmpeg:', data.toString().trim());
      });

      ffmpegProcess.on('error', (error) => {
        console.error('FFmpeg process error:', error);
        ffmpegProcess = null;
      });

      ffmpegProcess.on('close', (code) => {
        console.log('FFmpeg process closed with code:', code);
      });
    } catch (error) {
      console.error('Failed to start FFmpeg:', error);
      ffmpegProcess = null;
    }
  };

  const setupIcecastConnection = () => {
    console.log(`Connecting to Icecast at ${ICECAST_HOST}:${ICECAST_PORT}`);
    console.log('Mountpoint:', mountpoint);
    console.log('Source name:', sourceName);

    // Connect directly to Icecast (no TLS needed inside Docker network)
    icecast = net.connect({
      host: ICECAST_HOST,
      port: ICECAST_PORT
    }, () => {
      console.log('Connected to Icecast, sending headers');

      const headers = [
        `SOURCE ${mountpoint} HTTP/1.0`,
        'Authorization: Basic ' + Buffer.from(`source:${ICECAST_PASSWORD}`).toString('base64'),
        'Content-Type: audio/mpeg',
        'Ice-Public: 1',
        `Ice-Name: ${sourceName}`,
        `Ice-Description: ${description}`,
        tags.length > 0 ? `Ice-Genre: ${tags.join(', ')}` : '',
        `Ice-URL: https://test.buskplayer.com${mountpoint}`,
        'Ice-Audio-Info: ice-bitrate=128;ice-samplerate=48000;ice-channels=2',
        'User-Agent: busk-broadcaster/1.0',
        '',
        ''
      ].filter(h => h !== '').join('\r\n');

      console.log('Sending headers to Icecast');
      icecast.write(headers);
    });

    icecast.on('data', (data) => {
      const response = data.toString();
      console.log('Icecast response:', response);
      if (response.includes('200 OK')) {
        console.log('Source connection established for mountpoint:', mountpoint);
        isSourceEstablished = true;
      } else if (response.includes('403') || response.includes('404')) {
        console.log('Icecast rejected connection:', response);
      }
    });

    icecast.on('error', (error) => {
      console.error('Icecast connection error:', error);
      isSourceEstablished = false;
    });

    icecast.on('close', () => {
      console.log('Icecast connection closed');
      console.log(`Total bytes received: ${totalBytesReceived}`);
      console.log(`Total bytes sent: ${totalBytesSent}`);
      isSourceEstablished = false;
    });

    icecast.on('drain', () => {
      console.log('Icecast buffer drained');
    });
  };

  ws.on('message', async (data) => {
    try {
      const message = JSON.parse(data.toString());
      console.log('Config message received:', message);
      if (message.type === 'config') {
        if (message.sourceName) sourceName = message.sourceName;
        if (message.description) description = message.description;
        if (message.mountpoint) mountpoint = message.mountpoint;
        if (message.tags) tags = message.tags;
        if (message.contentType) contentType = message.contentType;

        console.log('Final values:', { sourceName, description, mountpoint, tags, contentType });

        startFFmpegConversion();
        setupIcecastConnection();
      }
    } catch (e) {
      // Not JSON, must be audio data
      totalBytesReceived += data.length;

      if (isFirstChunk) {
        console.log('First audio chunk received, size:', data.length);
        isFirstChunk = false;
      }

      if (ffmpegProcess && ffmpegProcess.stdin) {
        try {
          ffmpegProcess.stdin.write(data);
        } catch (error) {
          console.error('Error writing to FFmpeg:', error);
        }
      } else if (icecast && isSourceEstablished) {
        try {
          icecast.write(data);
          totalBytesSent += data.length;
        } catch (error) {
          console.error('Error writing to Icecast:', error);
        }
      }
    }
  });

  ws.on('close', () => {
    console.log('Browser disconnected');
    console.log(`Final stats: received=${totalBytesReceived}, sent=${totalBytesSent}`);

    if (ffmpegProcess) {
      ffmpegProcess.stdin.end();
      ffmpegProcess.kill();
      ffmpegProcess = null;
    }

    if (icecast) {
      icecast.end();
    }
  });
});

wss.on('error', (error) => {
  console.error('WebSocket server error:', error);
});
