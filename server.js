import { WebSocketServer } from 'ws';
import net from 'net';
import fetch from 'node-fetch';

const wss = new WebSocketServer({ port: 3001 });
console.log('WebSocket server started on port 3001');

// Add stats endpoint
const getIcecastStats = async () => {
  try {
    const response = await fetch('https://www.buskplayer.com/status-json.xsl', {
      headers: {
        'Authorization': 'Basic ' + Buffer.from('source:EtherIsBetter').toString('base64')
      }
    });
    return await response.json();
  } catch (error) {
    console.error('Error fetching Icecast stats:', error);
    return null;
  }
};

wss.on('connection', async (ws) => {
  console.log('Browser connected');
  let icecast = null;
  let isSourceEstablished = false;
  
  const setupIcecastConnection = () => {
    if (icecast) {
      console.log('Cleaning up existing connection...');
      icecast.destroy();
    }

    console.log('Creating new Icecast connection...');
    icecast = new net.Socket();
    
    // Add error handler
    icecast.on('error', (error) => {
      console.error('Icecast socket error:', error);
    });
    
    // Connect to Icecast server
    console.log('Attempting to connect to Icecast at 64.227.99.194:8000...');
    icecast.connect(8000, '64.227.99.194', () => {
      console.log('TCP Connected, sending SOURCE request...');
      
      const headers = [
        'SOURCE /ether HTTP/1.0',
        'Authorization: Basic ' + Buffer.from('source:EtherIsBetter').toString('base64'),
        'User-Agent: BuskBroadcaster/1.0',
        'Content-Type: audio/webm;codecs=opus',
        'Ice-Public: 1',
        'Ice-Name: buSk',
        'Ice-Description: Play music. Get Paid.',
        'Ice-URL: https://www.buskplayer.com/ether',
        'Ice-Audio-Info: bitrate=128000;channels=2;samplerate=48000',
        '',
        ''
      ].join('\r\n');
      
      console.log('Sending headers:', headers);
      icecast.write(headers);
    });

    icecast.on('data', (data) => {
      console.log('Received from Icecast:', data.toString());
      if (data.toString().includes('HTTP/1.0 200 OK')) {
        isSourceEstablished = true;
        console.log('Source mount established successfully');
        ws.send(JSON.stringify({ type: 'CONNECTED' }));
      }
    });
  };

  // Set up WebSocket message handling
  ws.on('message', (data) => {
    console.log('✓ Server received audio chunk');  // Simple confirmation
    
    if (!icecast) {
      setupIcecastConnection();
    }
    
    if (isSourceEstablished && icecast) {
      icecast.write(data);
    }
  });

  // Handle WebSocket closure
  ws.on('close', () => {
    console.log('Browser disconnected');
    if (icecast) {
      icecast.destroy();
      icecast = null;
    }
  });
});

// Log any WebSocket server errors
wss.on('error', (error) => {
  console.error('WebSocket server error:', error);
}); 