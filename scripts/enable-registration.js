// Enable registration by updating the Settings
import mongoose from 'mongoose';
import { Settings } from '#schema';

const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGO_URL || 'mongodb://localhost:27017/kowloon';

async function main() {
  await mongoose.connect(MONGODB_URI);
  console.log('Connected to MongoDB');

  const result = await Settings.updateOne(
    { name: 'registrationIsOpen' },
    { $set: { value: true } },
    { upsert: true }
  );

  console.log('Registration enabled:', result);

  await mongoose.disconnect();
  console.log('Done!');
}

main().catch(console.error);
