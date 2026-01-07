#!/usr/bin/env node
// Test outgoing push federation
import fetch from 'node-fetch';
import https from 'https';

// Disable SSL verification for local testing
const agent = new https.Agent({ rejectUnauthorized: false });

async function testPushFederation() {
  console.log('🚀 Testing Outgoing Push Federation\n');

  // Test: Create a post on kowloon.net that mentions a user on kwln.org
  console.log('Step 1: Creating a post on kowloon.net with remote recipient...');

  const activity = {
    type: 'Create',
    objectType: 'Post',
    to: '@roy_nikolausbrau_wvnu@kwln.org', // Remote user on kwln.org
    object: {
      type: 'Note',
      content: 'Hello from kowloon.net! Testing federation. 🌐',
      name: 'Federation Test Post'
    }
  };

  try {
    const response = await fetch('https://kowloon.net/outbox', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Note: In production this would need a valid JWT token
        // For now, testing if the endpoint accepts the request
      },
      body: JSON.stringify(activity),
      agent
    });

    console.log(`Response status: ${response.status}`);

    const result = await response.json();
    console.log('\n📄 Response:', JSON.stringify(result, null, 2));

    if (result.federate && result.federationJob) {
      console.log('\n✅ Federation job created!');
      console.log(`   Job ID: ${result.federationJob.jobId}`);
      console.log(`   Recipients: ${result.federationJob.recipients}`);
      console.log(`   Status: ${JSON.stringify(result.federationJob.counts)}`);

      // Wait a moment for delivery
      console.log('\n⏳ Waiting 5 seconds for delivery...');
      await new Promise(resolve => setTimeout(resolve, 5000));

      // Check job status
      console.log('\nStep 2: Checking federation job status...');
      const jobId = result.federationJob.jobId;
      const statusResponse = await fetch(`https://kowloon.net/outbox/${jobId}`, {
        agent
      });

      if (statusResponse.status === 200) {
        const status = await statusResponse.json();
        console.log('\n📊 Delivery Status:');
        console.log(JSON.stringify(status, null, 2));
      } else {
        console.log(`   ⚠️  Could not fetch job status: ${statusResponse.status}`);
      }
    } else {
      console.log('\n⚠️  No federation job created');
      console.log('   federate:', result.federate);
    }

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.cause) console.error('   Cause:', error.cause);
  }
}

testPushFederation();
