#!/usr/bin/env node
// Simple CLI to run Kowloon methods
// Usage: node run-method.js <method-path>
// Example: node run-method.js methods/utils/__nukeDb.js

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import mongoose from 'mongoose';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const methodPath = process.argv[2];

if (!methodPath) {
  console.error('Usage: node run-method.js <method-path>');
  console.error('Example: node run-method.js methods/utils/__nukeDb.js');
  process.exit(1);
}

async function run() {
  try {
    // Connect to MongoDB
    const mongoUrl = process.env.MONGO_URL || 'mongodb://localhost:27017/kowloon';
    await mongoose.connect(mongoUrl);
    console.log('Connected to MongoDB');

    // Import and run the method
    const methodModule = await import(join(__dirname, methodPath));
    const method = methodModule.default;

    if (typeof method !== 'function') {
      throw new Error(`Method at ${methodPath} does not export a default function`);
    }

    console.log(`Running method: ${methodPath}`);
    const result = await method();
    console.log('Result:', result);

    // Disconnect
    await mongoose.disconnect();
    console.log('Done');
    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    await mongoose.disconnect();
    process.exit(1);
  }
}

run();
