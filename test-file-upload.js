#!/usr/bin/env node
// Test file upload to /files endpoint
import fs from 'fs';
import FormData from 'form-data';
import http from 'http';

const testContent = 'Hello from Kowloon file upload test!\nTime: ' + new Date().toISOString() + '\n';
fs.writeFileSync('/tmp/test-upload.txt', testContent);

const form = new FormData();
form.append('file', fs.createReadStream('/tmp/test-upload.txt'), {
  filename: 'test-upload.txt',
  contentType: 'text/plain'
});
form.append('actorId', '@testuser@kowloon.net');
form.append('title', 'Test Upload');
form.append('summary', 'Testing S3/MinIO file upload functionality');

const req = http.request({
  host: 'localhost',
  port: 3000,
  path: '/files',
  method: 'POST',
  headers: form.getHeaders()
}, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log('\n✅ Upload Response:');
    console.log('Status:', res.statusCode);
    console.log('Body:', JSON.parse(data));
  });
});

form.pipe(req);
req.on('error', e => {
  console.error('❌ Error:', e.message);
  process.exit(1);
});
