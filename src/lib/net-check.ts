import net from 'net';
import dns from 'dns';
import dotenv from 'dotenv';
dotenv.config();

const host = process.env.DB_HOST || '';
const port = 3306;

console.log(`--- Network Diagnostic for ${host} ---`);

// 1. DNS Resolution
dns.lookup(host, (err, address) => {
  if (err) {
    console.error('❌ DNS Lookup Failed: Could not find the server address.');
    return;
  }
  console.log(`✅ DNS Resolved: ${address}`);

  // 2. TCP Connection
  const socket = new net.Socket();
  console.log(`Connecting to ${host}:${port}...`);
  
  socket.setTimeout(5000);
  
  socket.on('connect', () => {
    console.log('✅ TCP Connection Success! The port is OPEN and reachable.');
    socket.destroy();
  });
  
  socket.on('timeout', () => {
    console.error('❌ TCP Connection Timeout: The server did not respond in time.');
    console.log('\nCAUSE: This is 100% an Azure Firewall issue.');
    console.log('Action: Go to Azure Portal -> Networking -> Add your IP and Enable Public Access.');
    socket.destroy();
  });
  
  socket.on('error', (err) => {
    console.error(`❌ TCP Connection Error: ${err.message}`);
    socket.destroy();
  });
  
  socket.connect(port, host);
});
