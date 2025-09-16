import { WebSocketServer } from 'ws';
import net from 'net';

const wss = new WebSocketServer({ port: 3001 });
console.log('WebSocket server started on port 3001');

wss.on('connection', async (ws) => {
  console.log('Browser connected to WebSocket server');
  let icecast = null;
  let isSourceEstablished = false;
  let totalBytesReceived = 0;
  let totalBytesSent = 0;
  let isFirstChunk = true;

  const setupIcecastConnection = () => {
    console.log('Setting up Icecast connection...');
    icecast = new net.Socket();
    
    icecast.connect(8000, '64.227.99.194', () => {
      console.log('Connected to Icecast, sending headers');
      
      const headers = [
        'SOURCE /ether HTTP/1.0',
        'Authorization: Basic ' + Buffer.from('source:EtherIsBetter').toString('base64'),
        'Content-Type: audio/webm;codecs=opus',
        'Ice-Public: 1',
        'Ice-Name: buSk',
        'Ice-Description: Play music. Get Paid.',
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
        console.log('Source connection established');
        isSourceEstablished = true;
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
    try {
      const message = JSON.parse(data.toString());
      if (message.type === 'config') {
        console.log('Received config:', message);
        setupIcecastConnection();
      }
    } catch (e) {
      // Not JSON, must be audio data
      if (icecast && isSourceEstablished) {
        totalBytesReceived += data.length;
        
        if (isFirstChunk) {
          console.log('First audio chunk received:');
          console.log('Size:', data.length);
          console.log('First 32 bytes:', data.slice(0, 32).toString('hex'));
          isFirstChunk = false;
        }

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
  });

  ws.on('close', () => {
    console.log('Browser disconnected');
    console.log(`Final stats:`);
    console.log(`Total bytes received: ${totalBytesReceived}`);
    console.log(`Total bytes sent: ${totalBytesSent}`);
    if (icecast) {
      icecast.end();
    }
  });
});

// Log any WebSocket server errors
wss.on('error', (error) => {
  console.error('WebSocket server error:', error);
}); 