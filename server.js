import { WebSocketServer } from 'ws';
import { connect } from 'net';

const wss = new WebSocketServer({ port: 3001 });
console.log('WebSocket server running on port 3001');

wss.on('connection', (ws) => {
  console.log('Browser connected');
  let icecastConnected = false;
  let reconnectAttempts = 0;
  const MAX_RECONNECT_ATTEMPTS = 3;
  
  const connectToIcecast = () => {
    const icecast = connect({
      port: 8000,
      host: '64.227.99.194'
    }, () => {
      console.log('Connected to Icecast');
      
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
        'Ice-Charset: UTF-8',
        'Ice-Genre: various',
        'Ice-Bitrate: 128',
        'Ice-Username: source',
        'Ice-Password: EtherIsBetter',
        '',
        ''
      ].join('\r\n');

      icecast.write(headers);
    });

    // Set a shorter timeout
    icecast.setTimeout(5000);

    icecast.on('timeout', () => {
      console.log('Icecast connection timeout');
      icecast.end();
      tryReconnect();
    });

    icecast.on('data', (data) => {
      const response = data.toString();
      console.log('Icecast response:', response);
      
      if (response.includes('200 OK')) {
        icecastConnected = true;
        reconnectAttempts = 0;
        ws.send(JSON.stringify({ type: 'CONNECTED' }));
      } else if (response.includes('401')) {
        console.error('Authentication failed');
        ws.send(JSON.stringify({ 
          type: 'ERROR', 
          message: 'Authentication failed' 
        }));
        icecast.end();
      } else if (response.includes('Mountpoint /ether in use')) {
        console.log('Mount point in use, waiting before retry...');
        icecast.end();
        setTimeout(tryReconnect, 2000);
      }
    });

    ws.on('message', (data) => {
      if (!icecastConnected) {
        console.log('Waiting for Icecast connection...');
        return;
      }

      try {
        icecast.write(data);
      } catch (err) {
        console.error('Error writing to Icecast:', err);
        tryReconnect();
      }
    });

    icecast.on('error', (err) => {
      console.error('Icecast connection error:', err);
      ws.send(JSON.stringify({ type: 'ERROR', message: err.message }));
      tryReconnect();
    });

    icecast.on('close', () => {
      console.log('Icecast connection closed');
      icecastConnected = false;
      ws.send(JSON.stringify({ type: 'DISCONNECTED' }));
    });

    return icecast;
  };

  const tryReconnect = () => {
    if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      console.log('Max reconnection attempts reached');
      ws.send(JSON.stringify({ 
        type: 'ERROR', 
        message: 'Failed to connect after multiple attempts' 
      }));
      return;
    }

    reconnectAttempts++;
    console.log(`Reconnection attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS}`);
    setTimeout(() => {
      if (ws.readyState === WebSocket.OPEN) {
        connectToIcecast();
      }
    }, 2000 * reconnectAttempts); // Increasing delay between attempts
  };

  let icecast = connectToIcecast();

  ws.on('close', () => {
    console.log('Browser disconnected');
    if (icecast) {
      icecast.end();
    }
  });
});

// Log any WebSocket server errors
wss.on('error', (error) => {
  console.error('WebSocket server error:', error);
}); 