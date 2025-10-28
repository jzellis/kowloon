// Quick federation logic test
import shouldFederate from "./methods/federation/shouldFederate.js";
import dotenv from "dotenv";

dotenv.config();

// Mock domain for testing
process.env.DOMAIN = "local.example.com";

const tests = [
  {
    name: "Create in remote group",
    activity: {
      type: "Create",
      target: "group:abc@remote.example.com",
      to: "group:abc@remote.example.com",
    },
    expected: true,
  },
  {
    name: "Create in local group",
    activity: {
      type: "Create",
      target: "group:abc@local.example.com",
      to: "group:abc@local.example.com",
    },
    expected: false,
  },
  {
    name: "Reply to remote post",
    activity: {
      type: "Reply",
      object: {
        inReplyTo: "post:xyz@remote.example.com",
      },
    },
    expected: true,
  },
  {
    name: "Reply to local post",
    activity: {
      type: "Reply",
      object: {
        inReplyTo: "post:xyz@local.example.com",
      },
    },
    expected: false,
  },
  {
    name: "React to remote post",
    activity: {
      type: "React",
      object: {
        target: "post:abc@remote.example.com",
      },
    },
    expected: true,
  },
  {
    name: "React to local post",
    activity: {
      type: "React",
      object: {
        target: "post:abc@local.example.com",
      },
    },
    expected: false,
  },
  {
    name: "Join remote group",
    activity: {
      type: "Join",
      object: {
        id: "group:xyz@remote.example.com",
      },
      target: "group:xyz@remote.example.com",
    },
    expected: true,
  },
  {
    name: "Join local group",
    activity: {
      type: "Join",
      object: {
        id: "group:xyz@local.example.com",
      },
      target: "group:xyz@local.example.com",
    },
    expected: false,
  },
  {
    name: "Never federate to @public",
    activity: {
      type: "Create",
      to: "@public",
      target: "group:abc@remote.example.com",
    },
    expected: false,
  },
  {
    name: "Never federate to local domain",
    activity: {
      type: "Create",
      to: "@local.example.com",
      target: "group:abc@remote.example.com",
    },
    expected: false,
  },
  {
    name: "Never federate Follow",
    activity: {
      type: "Follow",
      object: "user:abc@remote.example.com",
    },
    expected: false,
  },
  {
    name: "Never federate Unfollow",
    activity: {
      type: "Unfollow",
      object: "user:abc@remote.example.com",
    },
    expected: false,
  },
  {
    name: "Never federate Block",
    activity: {
      type: "Block",
      object: "user:abc@remote.example.com",
    },
    expected: false,
  },
  {
    name: "Never federate Mute",
    activity: {
      type: "Mute",
      object: "user:abc@remote.example.com",
    },
    expected: false,
  },
  {
    name: "Delete remote object",
    activity: {
      type: "Delete",
      object: {
        id: "post:xyz@remote.example.com",
      },
    },
    expected: true,
  },
  {
    name: "Update remote object",
    activity: {
      type: "Update",
      object: {
        id: "post:xyz@remote.example.com",
      },
    },
    expected: true,
  },
  {
    name: "Flag remote content",
    activity: {
      type: "Flag",
      object: {
        id: "post:xyz@remote.example.com",
      },
    },
    expected: true,
  },
  {
    name: "Invite to remote group",
    activity: {
      type: "Invite",
      target: "group:xyz@remote.example.com",
      object: "user:abc@local.example.com",
    },
    expected: true,
  },
  {
    name: "Invite remote user to local group",
    activity: {
      type: "Invite",
      target: "group:xyz@local.example.com",
      object: "user:abc@remote.example.com",
    },
    expected: true,
  },
];

console.log("🧪 Testing Federation Logic\n");
console.log(`Local domain: ${process.env.DOMAIN}\n`);

let passed = 0;
let failed = 0;

for (const test of tests) {
  const result = shouldFederate(test.activity);
  const status = result === test.expected ? "✅ PASS" : "❌ FAIL";

  if (result === test.expected) {
    passed++;
  } else {
    failed++;
  }

  console.log(
    `${status} | ${test.name}: expected ${test.expected}, got ${result}`
  );
}

console.log(
  `\n📊 Results: ${passed} passed, ${failed} failed out of ${tests.length} tests`
);

if (failed === 0) {
  console.log("✅ All federation tests passed!");
  process.exit(0);
} else {
  console.log("❌ Some tests failed");
  process.exit(1);
}
