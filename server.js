import { WebSocketServer } from 'ws';
import net from 'net';
import { spawn } from 'child_process';

const wss = new WebSocketServer({ port: 8081 });
console.log('WebSocket server started on port 8081');

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
    console.log('🎵 Starting FFmpeg conversion from', contentType, 'to MP3');
    
    // Kill existing FFmpeg process if any
    if (ffmpegProcess) {
      ffmpegProcess.kill();
    }
    
    try {
      // Start FFmpeg process to convert WebM/Opus to MP3
      ffmpegProcess = spawn('ffmpeg', [
        '-f', 'webm',           // Input format
        '-i', 'pipe:0',         // Read from stdin
        '-f', 'mp3',            // Output format
        '-acodec', 'mp3',       // Audio codec
        '-ab', '128k',          // Bitrate
        '-ar', '48000',         // Sample rate
        '-ac', '2',             // Channels
        'pipe:1'                // Write to stdout
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
        console.log('FFmpeg stderr:', data.toString());
      });
      
      ffmpegProcess.on('error', (error) => {
        console.error('FFmpeg process error:', error);
        console.log('❌ FFmpeg not available - falling back to direct stream');
        ffmpegProcess = null; // Disable FFmpeg conversion
      });
      
      ffmpegProcess.on('close', (code) => {
        console.log('FFmpeg process closed with code:', code);
      });
    } catch (error) {
      console.error('Failed to start FFmpeg:', error);
      console.log('❌ FFmpeg not available - falling back to direct stream');
      ffmpegProcess = null; // Disable FFmpeg conversion
    }
  };

  const setupIcecastConnection = () => {
    console.log('Setting up Icecast connection...');
    icecast = new net.Socket();
    
    icecast.connect(8000, '64.227.99.194', () => {
      console.log('Connected to Icecast, sending headers');
      
      // Always send MP3 format to Icecast for compatibility
      const headers = [
        `SOURCE ${mountpoint} HTTP/1.0`,
        'Authorization: Basic ' + Buffer.from('source:EtherIsBetter').toString('base64'),
        'Content-Type: audio/mpeg', // Force MP3 for Icecast
        'Ice-Public: 1',
        `Ice-Name: ${sourceName}`,
        `Ice-Description: ${description}`,
        tags.length > 0 ? `Ice-Genre: ${tags.join(', ')}` : '',
        `Ice-URL: https://www.buskplayer.com${mountpoint}`,
        'Ice-Audio-Info: ice-bitrate=128;ice-samplerate=48000;ice-channels=2',
        'User-Agent: busk-broadcaster/1.0',
        '',
        ''
      ].join('\r\n');
      
      console.log('Sending headers to Icecast');
      icecast.write(headers);
    });

    icecast.on('data', (data) => {
      const response = data.toString();
      console.log('Icecast response:', response);
      if (response.includes('200 OK')) {
        console.log('✅ Source connection established for mountpoint:', mountpoint);
        isSourceEstablished = true;
      } else if (response.includes('403') || response.includes('404')) {
        console.log('❌ Icecast rejected connection:', response);
      } else {
        console.log('📋 Icecast response details:', response);
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

    // Add drain handler
    icecast.on('drain', () => {
      console.log('Icecast buffer drained');
    });
  };

  ws.on('message', async (data) => {
    console.log('📨 Message received, length:', data.length);
    try {
      const message = JSON.parse(data.toString());
      console.log('📋 Parsed message:', message);
      if (message.type === 'config') {
        console.log('✅ Config message received:', message);
        // Update dynamic values if provided
        if (message.sourceName) {
          sourceName = message.sourceName;
          console.log('📝 Updated sourceName to:', sourceName);
        }
        if (message.description) {
          description = message.description;
          console.log('📝 Updated description to:', description);
        }
        if (message.mountpoint) {
          mountpoint = message.mountpoint;
          console.log('📝 Updated mountpoint to:', mountpoint);
        }
        if (message.tags) {
          tags = message.tags;
          console.log('📝 Updated tags to:', tags);
        }
        if (message.contentType) {
          contentType = message.contentType;
          console.log('📝 Updated contentType to:', contentType);
        }
        console.log('🎯 Final values:', { sourceName, description, mountpoint, tags, contentType });
        
        // Start FFmpeg conversion process
        startFFmpegConversion();
        setupIcecastConnection();
      }
    } catch (e) {
      // Not JSON, must be audio data
      totalBytesReceived += data.length;
      
      if (isFirstChunk) {
        console.log('First audio chunk received:');
        console.log('Size:', data.length);
        console.log('First 32 bytes:', data.slice(0, 32).toString('hex'));
        isFirstChunk = false;
      }

      if (ffmpegProcess && ffmpegProcess.stdin) {
        // Send audio data to FFmpeg for conversion
        try {
          ffmpegProcess.stdin.write(data);
        } catch (error) {
          console.error('Error writing to FFmpeg:', error);
        }
      } else {
        // Fallback: send directly to Icecast (may not work with WebM/Opus)
        if (icecast && isSourceEstablished) {
          try {
            const writeSuccess = icecast.write(data);
            totalBytesSent += data.length;
            
            if (!writeSuccess) {
              console.log('Write buffer full - waiting for drain');
            }
          } catch (error) {
            console.error('Error writing to Icecast:', error);
          }
        }
      }
    }
  });

  ws.on('close', () => {
    console.log('Browser disconnected');
    console.log(`Final stats:`);
    console.log(`Total bytes received: ${totalBytesReceived}`);
    console.log(`Total bytes sent: ${totalBytesSent}`);
    
    // Clean up FFmpeg process
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

// Log any WebSocket server errors
wss.on('error', (error) => {
  console.error('WebSocket server error:', error);
}); 