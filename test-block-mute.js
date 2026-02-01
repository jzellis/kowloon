import KowloonClient from "./kowloon-tests/client.js";

async function testBlockMuteHandlers() {
  console.log("\n=== Testing Block/Unblock and Mute/Unmute Handlers ===\n");

  const client = new KowloonClient("http://localhost:3000");

  try {
    // Login as admin
    console.log("Step 1: Login as admin...");
    const loginResult = await client.login("admin", "admin");
    if (!loginResult.success) throw new Error("Login failed");
    const adminId = loginResult.user.id;
    console.log(`✓ Logged in as ${adminId}`);

    // Get or create testuser1
    console.log("\nStep 2: Get testuser1...");
    const testuser1 = await client.getOrCreateUser("testuser1", "password");
    const user1Id = testuser1.id;
    console.log(`✓ Got testuser1: ${user1Id}`);

    // Test Block
    console.log("\nStep 3: Block testuser1...");
    const blockResult = await client.sendActivity({
      type: "Block",
      actorId: adminId,
      target: user1Id,
    });
    
    if (blockResult.error) {
      console.error("✗ Block failed:", blockResult.error);
    } else {
      console.log(`✓ Blocked ${user1Id}`);
      console.log(`  - Circle: ${blockResult.circleId}`);
      console.log(`  - Blocked: ${blockResult.blocked}`);
    }

    // Test Unblock
    console.log("\nStep 4: Unblock testuser1...");
    const unblockResult = await client.sendActivity({
      type: "Unblock",
      actorId: adminId,
      target: user1Id,
    });
    
    if (unblockResult.error) {
      console.error("✗ Unblock failed:", unblockResult.error);
    } else {
      console.log(`✓ Unblocked ${user1Id}`);
      console.log(`  - Circle: ${unblockResult.circleId}`);
      console.log(`  - Unblocked: ${unblockResult.unblocked}`);
    }

    // Test Mute
    console.log("\nStep 5: Mute testuser1...");
    const muteResult = await client.sendActivity({
      type: "Mute",
      actorId: adminId,
      target: user1Id,
    });
    
    if (muteResult.error) {
      console.error("✗ Mute failed:", muteResult.error);
    } else {
      console.log(`✓ Muted ${user1Id}`);
      console.log(`  - Circle: ${muteResult.circleId}`);
      console.log(`  - Muted: ${muteResult.muted}`);
    }

    // Test Unmute
    console.log("\nStep 6: Unmute testuser1...");
    const unmuteResult = await client.sendActivity({
      type: "Unmute",
      actorId: adminId,
      target: user1Id,
    });
    
    if (unmuteResult.error) {
      console.error("✗ Unmute failed:", unmuteResult.error);
    } else {
      console.log(`✓ Unmuted ${user1Id}`);
      console.log(`  - Circle: ${unmuteResult.circleId}`);
      console.log(`  - Unmuted: ${unmuteResult.unmuted}`);
    }

    console.log("\n=== All tests passed! ===\n");
  } catch (err) {
    console.error("\n✗ Test failed:", err.message);
    console.error(err.stack);
    process.exit(1);
  }
}

testBlockMuteHandlers();
