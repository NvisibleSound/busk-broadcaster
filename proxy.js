const net = require('net');
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const app = express();

app.use(cors());
app.use(bodyParser.raw({ type: '*/*', limit: '50mb' }));

let icecastConnection = null;

app.post('/broadcast', async (req, res) => {
  try {
    console.log('Received broadcast request:', {
      contentType: req.headers['content-type'],
      bodySize: req.body.length,
      auth: req.headers['authorization'] ? 'present' : 'missing'
    });

    if (!icecastConnection || icecastConnection.destroyed) {
      console.log('Creating new Icecast connection...');
      icecastConnection = new net.Socket();
      
      await new Promise((resolve, reject) => {
        icecastConnection.connect(8000, '64.227.99.194', () => {
          console.log('Connected to Icecast');
          
          const headers = [
            'SOURCE /ether HTTP/1.0',
            `Authorization: Basic ${req.headers.authorization}`,
            'User-Agent: (null)',
            'Content-Type: audio/webm;codecs=opus',
            'Ice-Public: 1',
            '',
            ''
          ].join('\r\n');
          
          console.log('Sending headers to Icecast:', headers);
          icecastConnection.write(headers);
          resolve();
        });
        
        icecastConnection.on('data', (data) => {
          console.log('Received from Icecast:', data.toString());
        });

        icecastConnection.on('error', (err) => {
          console.error('Socket error:', err);
          reject(err);
        });

        icecastConnection.on('close', () => {
          console.log('Icecast connection closed');
          icecastConnection = null;
        });
      });
    }
    
    console.log('Sending audio chunk:', req.body.length, 'bytes');
    icecastConnection.write(req.body);
    res.status(200).send('OK');
    
  } catch (error) {
    console.error('Error in broadcast:', error);
    if (icecastConnection) {
      icecastConnection.destroy();
      icecastConnection = null;
    }
    res.status(500).send(error.message);
  }
});

// Clean up on server shutdown
process.on('SIGINT', () => {
  if (icecastConnection) {
    icecastConnection.destroy();
  }
  process.exit();
});

app.listen(3001, () => {
  console.log('Proxy server running on port 3001');
}); 