// scripts/checkObjectId.js
import "dotenv/config"; // <-- loads MONGODB_URI / MONGO_URL before any other imports
import { faker } from "@faker-js/faker";
import Kowloon from "../Kowloon.js";
import ActivityParser from "#ActivityParser";

const randEl = (arr) => arr[Math.floor(Math.random() * arr.length)];

const shortText = (max = 200) => {
  let s = faker.lorem.sentences({ min: 1, max: 3 });
  if (s.length > max) s = s.slice(0, max - 3) + "...";
  return s;
};

const noteBody = () => {
  let s = faker.lorem.paragraphs({ min: 1, max: 2 });
  if (s.length > 480) s = s.slice(0, 480);
  return s;
};

const postTypes = ["Note", "Article", "Link"];
const t = randEl(postTypes);
const actorId = "@admin@kwln.org";
const to = "@public";
const replyTo = "@public";
const reactTo = "@public";
const base = {
  actorId,
  type: t,
  to,
  replyTo,
  reactTo,
  //   meta: { runId: RUN_ID },
};

if (t === "Note") {
  base.source = { mediaType: "text/markdown", content: noteBody() };
  base.summary = Math.random() < 0.3 ? shortText(160) : undefined;
} else if (t === "Article") {
  const title = faker.lorem.words({ min: 3, max: 8 });
  const md = `# ${title}\n\n${faker.lorem.paragraphs({ min: 2, max: 5 })}`;
  base.title = title;
  base.source = { mediaType: "text/markdown", content: md };
  base.summary = shortText(220);
} else if (t === "Link") {
  base.title = faker.lorem.words({ min: 2, max: 6 });
  base.href = faker.internet.url();
  base.summary = shortText(180);
  base.source = { mediaType: "text/markdown", content: shortText(240) };
}

const activity = {
  actorId,
  type: "Create",
  objectType: "Post",
  object: base,
  to,
  reactTo,
  replyTo,
};

// wherever you use it:

// New per-verb factory API

// This calls ./handlers/Create/index.js default export, passing through ctx
const result = await Kowloon.activities.create(activity);
console.log(result);
// const returnedActivity = await Kowloon.activities.create(activity);
// console.log(returnedActivity);
process.exit(0);
