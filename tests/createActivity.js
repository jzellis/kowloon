import Kowloon from "../Kowloon.js";

await Kowloon.__nukeDb();

const outboxUrl = "http://kowloon.social/api/outbox";

const headers = {
  Accept: "application/json",
  "Content-Type": "application/json",
};

let adminUserActivity = {
  type: "Create",
  objectType: "User",
  object: {
    username: "admin",
    password: "admin",
    email: "admin@kowloon.social",
    profile: {
      name: "Admin",
      bio: "I'm the admin",
      urls: ["http://kowloon.social"],
      location: {
        type: "Point",
        name: "London, UK",
        latitude: 51.5072178,
        longitude: -0.1275862,
      },
    },
  },
};

let publicActivity = {
  type: "Create",
  objectType: "Post",
  actorId: "@admin@kowloon.social",
  object: {
    type: "Note",
    source: {
      content: "This is a test public post",
    },
    to: ["@public"],
  },
  to: ["@public"],
};

let serverActivity = {
  type: "Create",
  objectType: "Post",
  actorId: "@admin@kowloon.social",
  object: {
    type: "Note",

    source: {
      content: "This is a test server post",
    },
    to: ["@server"],
  },
  to: ["@server"],
};

let replyActivity = {
  type: "Create",
  objectType: "Reply",
  target: "",
  actorId: "@admin@kowloon.social",
  object: {
    source: {
      content: "This is a reply",
    },
  },
};

let likeActivity = {
  type: "Like",
  target: "",
  actorId: "@admin@kowloon.social",
  object: {
    type: {
      name: "Heart",
      emoji: "❤️",
    },
  },
};

let updatePostActivity = {
  type: "Update",
  objectType: "Post",
  actorId: "@admin@kowloon.social",
  target: null,
  object: {
    source: {
      content: "This is an updated post",
    },
    to: ["@server"],
  },
  to: ["@server"],
};

let updateLikeActivity = {
  type: "Update",
  objectType: "Like",
  target: "",
  actorId: "@admin@kowloon.social",
  object: {
    type: {
      name: "Puke",
      emoji: "🤮",
    },
  },
};

let updateUserActivity = {
  type: "Update",
  objectType: "User",
  target: "@admin@kowloon.social",
  actorId: "@admin@kowloon.social",
  object: {
    profile: {
      bio: "This is my updated bio",
      urls: ["https://kowloon.social", "https://www.zenarchery.com"],
    },
  },
};

let userCreateActivity = {
  type: "Create",
  objectType: "User",
  object: {
    username: "bob",
    password: "bob",
    email: "bob@smith.com",
    profile: {
      name: "Bob Smith",
      bio: "I'm Bob Smith",
      urls: ["http://bob.com"],
      location: {
        name: "San Francisco",
        type: "Place",
        latitude: 37.7749,
        longitude: -122.4194,
      },
    },
  },
};

let circleAddActivity = {
  type: "Add",
  objectType: "Circle",
  target: "",
  actorId: "@bob@kowloon.social",
  object: { actorId: "@admin@kowloon.social" },
};

let groupCreateActivity = {
  type: "Create",
  objectType: "Group",
  actorId: "@admin@kowloon.social",
  object: {
    name: "Test Group",
    summary: "This is a test group",
    approval: true,
    members: ["@bob@kowloon.social"],
  },
  to: ["@public"],
};

let groupPostActivity = {
  type: "Create",
  objectType: "Post",
  actorId: "@admin@kowloon.social",
  object: {
    type: "Note",
    source: {
      content: "This is a test group post",
    },
  },
  to: [],
};

/* Do the tests ------------------------------------------------------------ */

let adminCreateResponse = await (
  await fetch(outboxUrl, {
    method: "POST",
    headers,
    body: JSON.stringify({ activity: adminUserActivity }),
  })
).json();

let login = await (
  await fetch("http://kowloon.social/api/login", {
    method: "POST",
    headers,
    body: JSON.stringify({
      username: "admin",
      password: "admin",
    }),
  })
).json();
headers.Authorization = `Basic ${login.token}`;
headers["kowloon-id"] = login.user.id;

let publicActivityResponse = await (
  await fetch(outboxUrl, {
    method: "POST",
    headers,
    body: JSON.stringify({ activity: publicActivity }),
  })
).json();

let serverActivityResponse = await (
  await fetch(outboxUrl, {
    method: "POST",
    headers,
    body: JSON.stringify({ activity: serverActivity }),
  })
).json();

replyActivity.target = serverActivityResponse.activity.objectId;
let replyActivityResponse = await (
  await fetch(outboxUrl, {
    method: "POST",
    headers,
    body: JSON.stringify({ activity: replyActivity }),
  })
).json();

likeActivity.target = publicActivityResponse.activity.objectId;
let likeActivityResponse = await (
  await fetch(outboxUrl, {
    method: "POST",
    headers,
    body: JSON.stringify({ activity: likeActivity }),
  })
).json();

updatePostActivity.target = publicActivityResponse.activity.objectId;
let updatePostActivityResponse = await (
  await fetch(outboxUrl, {
    method: "POST",
    headers,
    body: JSON.stringify({ activity: updatePostActivity }),
  })
).json();

updateLikeActivity.target = likeActivityResponse.activity.objectId;
let updateLikeActivityResponse = await (
  await fetch(outboxUrl, {
    method: "POST",
    headers,
    body: JSON.stringify({ activity: updateLikeActivity }),
  })
).json();

let userCreateActivityResponse = await (
  await fetch(outboxUrl, {
    method: "POST",
    headers,
    body: JSON.stringify({ activity: userCreateActivity }),
  })
).json();

circleAddActivity.target = userCreateActivityResponse.activity.object.following;
let circleAddActivityResponse = await (
  await fetch(outboxUrl, {
    method: "POST",
    headers,
    body: JSON.stringify({ activity: circleAddActivity }),
  })
).json();

let updateUserActivityResponse = await (
  await fetch(outboxUrl, {
    method: "POST",
    headers,
    body: JSON.stringify({ activity: updateUserActivity }),
  })
).json();

let groupCreateActivityResponse = await (
  await fetch(outboxUrl, {
    method: "POST",
    headers,
    body: JSON.stringify({ activity: groupCreateActivity }),
  })
).json();

groupPostActivity.to = [groupCreateActivityResponse.activity.objectId];

groupPostActivity.object.to = [groupCreateActivityResponse.activity.objectId];
let groupPostActivityResponse = await (
  await fetch(outboxUrl, {
    method: "POST",
    headers,
    body: JSON.stringify({ activity: groupPostActivity }),
  })
).json();

process.exit(0);
