// Create three test posts with different addressing
import { KowloonClient } from '../kowloon-client/src/index.js';

const client = new KowloonClient({ baseUrl: 'http://localhost:3000' });

async function createPosts() {
  try {
    // Login as admin
    console.log('Logging in as admin...');
    await client.auth.login({
      username: 'admin',
      password: process.env.ADMIN_PASSWORD || '12345',
    });
    console.log('Logged in successfully\n');

    // Post 1: Public
    console.log('Creating public post...');
    const post1 = await client.activities.createPost({
      content: 'This is a public post',
      to: '@public',
    });
    console.log('Public post created:', post1.result.id);
    console.log('  - to:', post1.result.to);
    console.log('  - content:', post1.result.source.content);
    console.log();

    // Post 2: Server-only
    console.log('Creating server-only post...');
    const post2 = await client.activities.createPost({
      content: 'This is a server-only post',
      to: '@localhost',
    });
    console.log('Server-only post created:', post2.result.id);
    console.log('  - to:', post2.result.to);
    console.log('  - content:', post2.result.source.content);
    console.log();

    // Post 3: Circle-addressed
    console.log('Creating circle-addressed post...');
    const post3 = await client.activities.createPost({
      content: 'This is a post for my followers circle',
      to: 'circle:6974e03394be8b8f0c0823b4@localhost',
    });
    console.log('Circle-addressed post created:', post3.result.id);
    console.log('  - to:', post3.result.to);
    console.log('  - content:', post3.result.source.content);
    console.log();

    console.log('All posts created successfully!');
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    if (err.response) {
      console.error('Response:', err.response);
    }
    process.exit(1);
  }
}

createPosts();
