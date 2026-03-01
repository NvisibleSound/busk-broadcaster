import { WebSocketServer } from 'ws';
import net from 'net';
import { spawn } from 'child_process';
import {
  PROTOCOL_VERSION,
  decodeAudioPayload,
  isAudioChunkMessage,
  parseMessage
} from './src/protocol/audioMessages.js';

const wss = new WebSocketServer({ port: 8081 });
console.log('WebSocket server started on port 8081');
const MP3_BITRATE_KBPS = Number(process.env.MP3_BITRATE_KBPS || 192);

wss.on('connection', async (ws) => {
  console.log('Browser connected to WebSocket server');
  let icecast = null;
  let isSourceEstablished = false;
  let pendingAudioChunks = [];
  let pendingBytes = 0;
  const MAX_PENDING_BYTES = 256 * 1024;
  let pendingEncodedChunks = [];
  let pendingEncodedBytes = 0;
  const MAX_PENDING_ENCODED_BYTES = 512 * 1024;
  let totalBytesReceived = 0;
  let totalBytesSent = 0;
  let isFirstChunk = true;
  let sourceName = 'Ether';
  let description = 'sounds from the universe';
  let mountpoint = '/ether';
  let tags = [];
  let sourceContentType = 'audio/ogg;codecs=opus';
  let icecastContentType = sourceContentType;
  let outputBitrateKbps = 128;
  let shouldTranscode = false;
  let ffmpegProcess = null;

  const resolveInputContainer = (type) => {
    const normalizedType = (type || '').toLowerCase();
    if (normalizedType.includes('webm')) {
      return 'webm';
    }
    if (normalizedType.includes('ogg')) {
      return 'ogg';
    }
    return null;
  };

  const shouldUseTranscoder = (type) => {
    const normalizedType = (type || '').toLowerCase();
    // Browser Opus/WebM/Ogg streams are transcoded for broad HTML5 listener compatibility.
    return normalizedType.includes('opus') || normalizedType.includes('webm') || normalizedType.includes('ogg');
  };

  const startTranscoderIfNeeded = () => {
    if (!shouldTranscode || ffmpegProcess) {
      return;
    }

    const inputContainer = resolveInputContainer(sourceContentType);
    if (!inputContainer) {
      console.warn('⚠️ Unknown source container for transcoding, skipping FFmpeg:', sourceContentType);
      shouldTranscode = false;
      icecastContentType = sourceContentType;
      return;
    }

    console.log(`🎚️ Starting FFmpeg transcoder (${inputContainer} -> mp3 @ ${outputBitrateKbps}k)`);
    const ffmpegArgs = [
      '-loglevel', 'error',
      '-fflags', 'nobuffer',
      '-flags', 'low_delay',
      '-f', inputContainer,
      '-i', 'pipe:0',
      '-vn',
      '-acodec', 'libmp3lame',
      '-b:a', `${outputBitrateKbps}k`,
      '-ar', '48000',
      '-ac', '2',
      '-compression_level', '4',
      '-write_xing', '0',
      '-flush_packets', '1',
      '-f', 'mp3',
      'pipe:1'
    ];

    ffmpegProcess = spawn('ffmpeg', ffmpegArgs, {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    ffmpegProcess.stdout.on('data', (encodedChunk) => {
      if (icecast && isSourceEstablished) {
        try {
          const writeSuccess = icecast.write(encodedChunk);
          totalBytesSent += encodedChunk.length;
          if (!writeSuccess) {
            console.log('Write buffer full - waiting for drain');
          }
        } catch (error) {
          console.error('Error writing transcoded audio to Icecast:', error);
        }
        return;
      }

      if (pendingEncodedBytes + encodedChunk.length <= MAX_PENDING_ENCODED_BYTES) {
        pendingEncodedChunks.push(encodedChunk);
        pendingEncodedBytes += encodedChunk.length;
      }
    });

    ffmpegProcess.stderr.on('data', () => {
      // Keep FFmpeg noise off logs unless process fails.
    });

    ffmpegProcess.on('error', (error) => {
      console.error('FFmpeg process error:', error);
    });

    ffmpegProcess.on('close', (code) => {
      console.log('FFmpeg process closed with code:', code);
      ffmpegProcess = null;
    });
  };

  const writeAudioToOutput = (audioChunk) => {
    if (shouldTranscode && ffmpegProcess?.stdin && !ffmpegProcess.stdin.destroyed) {
      try {
        ffmpegProcess.stdin.write(audioChunk);
      } catch (error) {
        console.error('Error writing audio to FFmpeg stdin:', error);
      }
      return;
    }

    if (icecast && isSourceEstablished) {
      try {
        const writeSuccess = icecast.write(audioChunk);
        totalBytesSent += audioChunk.length;
        if (!writeSuccess) {
          console.log('Write buffer full - waiting for drain');
        }
      } catch (error) {
        console.error('Error writing audio to Icecast:', error);
      }
    }
  };

  const enqueuePendingChunk = (audioChunk, chunkLabel) => {
    if (shouldTranscode) {
      // Feed FFmpeg immediately so it can parse stream headers before Icecast is ready.
      if (ffmpegProcess?.stdin && !ffmpegProcess.stdin.destroyed) {
        writeAudioToOutput(audioChunk);
      }
      return;
    }

    if (pendingBytes + audioChunk.length <= MAX_PENDING_BYTES) {
      pendingAudioChunks.push(audioChunk);
      pendingBytes += audioChunk.length;
      return;
    }

    console.warn(`Dropping ${chunkLabel} chunk: pending buffer is full`);
  };

  const setupIcecastConnection = () => {
    console.log('Setting up Icecast TCP connection...');
    if (icecast) {
      icecast.removeAllListeners();
      icecast.destroy();
      icecast = null;
    }

    icecast = net.connect({
      host: 'test.buskplayer.com',
      port: 8000
    }, () => {
      console.log('Connected to Icecast TCP, sending source headers');
      
      const safeDesc = String(description || '').replace(/[\r\n]/g, ' ').trim() || 'sounds from the universe';
      const safeName = String(sourceName || '').replace(/[\r\n]/g, ' ').trim() || 'Ether';
      const safeTags = Array.isArray(tags) ? tags.map(t => String(t).replace(/[\r\n]/g, ' ').trim()).filter(Boolean) : [];
      const headerLines = [
        `SOURCE ${mountpoint} HTTP/1.0`,
        'Authorization: Basic ' + Buffer.from('source:EtherIsBetter').toString('base64'),
        `Content-Type: ${icecastContentType}`,
        'Ice-Public: 1',
        `Ice-Name: ${safeName}`,
        `Ice-Description: ${safeDesc}`,
        safeTags.length > 0 ? `Ice-Genre: ${safeTags.join(', ')}` : null,
        `Ice-URL: https://test.buskplayer.com${mountpoint}`,
        `Ice-Audio-Info: ice-bitrate=${outputBitrateKbps};ice-samplerate=48000;ice-channels=2`,
        'User-Agent: busk-broadcaster/1.0'
      ].filter(Boolean);
      const headers = headerLines.join('\r\n') + '\r\n\r\n';
      console.log('Icecast headers:', { IceName: safeName, IceDescription: safeDesc, IceGenre: safeTags });
      icecast.write(headers);
    });

    icecast.on('data', (data) => {
      const response = data.toString();
      if (response.includes('200 OK')) {
        console.log('Icecast source connection established:', mountpoint);
        isSourceEstablished = true;
        if (pendingAudioChunks.length > 0) {
          console.log(`📦 Flushing ${pendingAudioChunks.length} buffered audio chunks (${pendingBytes} bytes)`);
          for (const chunk of pendingAudioChunks) {
            writeAudioToOutput(chunk);
          }
          pendingAudioChunks = [];
          pendingBytes = 0;
        }
        if (pendingEncodedChunks.length > 0) {
          console.log(`📦 Flushing ${pendingEncodedChunks.length} buffered transcoded chunks (${pendingEncodedBytes} bytes)`);
          for (const encodedChunk of pendingEncodedChunks) {
            try {
              const writeSuccess = icecast.write(encodedChunk);
              totalBytesSent += encodedChunk.length;
              if (!writeSuccess) {
                console.log('Write buffer full while flushing transcoded chunks - waiting for drain');
              }
            } catch (flushError) {
              console.error('Error flushing buffered transcoded chunk to Icecast:', flushError);
              break;
            }
          }
          pendingEncodedChunks = [];
          pendingEncodedBytes = 0;
        }
        if (ws.readyState === ws.OPEN) {
          ws.send(JSON.stringify({
            type: 'icecast-status',
            status: 'connected',
            sourceContentType,
            outputContentType: icecastContentType,
            transcoding: shouldTranscode,
            bitrateKbps: outputBitrateKbps
          }));
        }
      } else if (response.includes('403') || response.includes('404')) {
        console.log('Icecast rejected source connection');
        if (ws.readyState === ws.OPEN) {
          ws.send(JSON.stringify({ type: 'icecast-status', status: 'rejected' }));
        }
      }
    });

    icecast.on('error', (error) => {
      console.error('Icecast connection error');
      isSourceEstablished = false;
      if (ws.readyState === ws.OPEN) {
        ws.send(JSON.stringify({ type: 'icecast-status', status: 'error' }));
      }
    });

    icecast.on('close', () => {
      console.log('Icecast connection closed');
      console.log(`Total bytes received: ${totalBytesReceived}`);
      console.log(`Total bytes sent: ${totalBytesSent}`);
      isSourceEstablished = false;
      if (ws.readyState === ws.OPEN) {
        ws.send(JSON.stringify({ type: 'icecast-status', status: 'disconnected' }));
      }
    });

    icecast.on('drain', () => {});
  };

  ws.on('message', async (data, isBinary) => {
    if (isBinary) {
      totalBytesReceived += data.length;

      if (isFirstChunk) {
        console.log('First legacy audio chunk received');
        isFirstChunk = false;
      }

      if (icecast && isSourceEstablished) {
        writeAudioToOutput(data);
      } else {
        enqueuePendingChunk(data, 'legacy audio');
      }
      return;
    }

    const rawMessage = typeof data === 'string' ? data : data.toString();
    const message = parseMessage(rawMessage);
    if (!message) {
      console.warn('⚠️ Dropping unrecognized text message');
      return;
    }

    if (typeof message.v === 'number' && message.v !== PROTOCOL_VERSION) {
      console.warn('⚠️ Protocol version mismatch:', message.v, '(expected', PROTOCOL_VERSION + ')');
    }

    if (message.type === 'config') {
      console.log('Config message received');
      // Update dynamic values if provided
      if (message.sourceName) {
        sourceName = message.sourceName;
      }
      if (message.description) {
        description = message.description;
      }
      if (message.mountpoint) {
        mountpoint = message.mountpoint;
      }
      if (message.tags) {
        tags = message.tags;
      }
      if (message.contentType) {
        sourceContentType = message.contentType;
      }

      if (typeof sourceContentType !== 'string' || sourceContentType.length === 0) {
        console.warn('⚠️ Missing content type from client, defaulting to audio/ogg;codecs=opus');
        sourceContentType = 'audio/ogg;codecs=opus';
      }
      shouldTranscode = shouldUseTranscoder(sourceContentType);
      icecastContentType = shouldTranscode ? 'audio/mpeg' : sourceContentType;
      outputBitrateKbps = shouldTranscode ? MP3_BITRATE_KBPS : 128;
      pendingAudioChunks = [];
      pendingBytes = 0;
      pendingEncodedChunks = [];
      pendingEncodedBytes = 0;
      startTranscoderIfNeeded();
      console.log('Output mode:', shouldTranscode ? 'ffmpeg transcoding (mp3)' : 'direct passthrough');
      setupIcecastConnection();
      return;
    }

    if (isAudioChunkMessage(message)) {
      const chunkBuffer = decodeAudioPayload(message.payload);
      totalBytesReceived += chunkBuffer.length;

      if (isFirstChunk) {
        console.log('First structured audio chunk received');
        isFirstChunk = false;
      }

      if (icecast && isSourceEstablished) {
        writeAudioToOutput(chunkBuffer);
      } else {
        enqueuePendingChunk(chunkBuffer, 'structured audio');
      }
      return;
    }

    console.warn('⚠️ Unsupported message type:', message.type);
  });

  ws.on('close', () => {
    console.log('Browser disconnected');
    console.log(`Final stats:`);
    console.log(`Total bytes received: ${totalBytesReceived}`);
    console.log(`Total bytes sent: ${totalBytesSent}`);
    
    if (icecast) {
      icecast.end();
    }
    if (ffmpegProcess) {
      if (ffmpegProcess.stdin && !ffmpegProcess.stdin.destroyed) {
        ffmpegProcess.stdin.end();
      }
      ffmpegProcess.kill();
      ffmpegProcess = null;
    }
  });
});

// Log any WebSocket server errors
wss.on('error', (error) => {
  console.error('WebSocket server error:', error);
}); 