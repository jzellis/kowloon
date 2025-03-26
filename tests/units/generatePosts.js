import { faker } from "@faker-js/faker";
import { Settings, User } from "../../schema/index.js";
import Kowloon from "../../Kowloon.js";
export default async function (numPosts) {
  let activityTemplate = {
    type: "Create",
    actorId: "",
    objectType: "Post",
    to: ["@public"],
    object: {},
  };

  let baseUrl = `https://${
    (await Settings.findOne({ name: "domain" })).value
  }/inbox`;

  let posts = [];
  let postTypes = ["Note", "Article", "Link", "Media"];

  let articleText = `<p>
I have never begun a novel with more misgiving. If I call it a novel it
is only because I don't know what else to call it. I have little story
to tell and I end neither with a death nor a marriage. Death ends all
things and so is the comprehensive conclusion of a story, but marriage
finishes it very properly too and the sophisticated are ill-advised to
sneer at what is by convention termed a happy ending. It is a sound
instinct of the common people which persuades them that with this all
that needs to be said is said. When male and female, after whatever
vicissitudes you like, are at last brought together they have fulfilled
their biological function and interest passes to the generation that is
to come. But I leave my reader in the air. This book consists of my
recollections of a man with whom I was thrown into close contact only at
long intervals, and I have little knowledge of what happened to him in
between. I suppose that by the exercise of invention I could fill the
gaps plausibly enough and so make my narrative more coherent; but I have
no wish to do that. I only want to set down what I know of my own
knowledge.
</p>

<p>
Many years ago I wrote a novel called <i>The Moon and Sixpence</i>. In that I
took a famous painter, Paul Gauguin, and, using the novelist's
privilege, devised a number of incidents to illustrate the character I
had created on the suggestions afforded me by the scanty facts I knew
about the French artist. In the present book I have attempted to do
nothing of the kind. I have invented nothing. To save embarrassment to
people still living I have given to the persons who play a part in this
story names of my own contriving, and I have in other ways taken pains
to make sure that no one should recognize them. The man I am writing
about is not famous. It may be that he never will be. It may be that
when his life at last comes to an end he will leave no more trace of his
sojourn on earth than a stone thrown into a river leaves on the surface
of the water. Then my book, if it is read at all, will be read only for
what intrinsic interest it may possess. But it may be that the way of
life that he has chosen for himself and the peculiar strength and
sweetness of his character may have an ever-growing influence over his
fellow men so that, long after his death perhaps, it may be realized
that there lived in this age a very remarkable creature. Then it will be
quite clear of whom I write in this book and those who want to know at
least a little about his early life may find in it something to their
purpose. I think my book, within its acknowledged limitations, will be a
useful source of information to my friend's biographers.
</p>`;
  let users = await User.find({});

  for (let i = 0; i < numPosts; i++) {
    let postActivity = activityTemplate;
    let actorId = users[Math.floor(Math.random() * users.length)].id;
    // let actorId = "@admin@kowloon.social";
    postActivity.actorId = actorId;
    let postType = postTypes[Math.floor(Math.random() * postTypes.length)];
    postActivity.object = {
      to: ["@public"],

      type: postType,
      source: {
        content: `<p>${faker.lorem.sentence()}</p>`,
        mediaType: "text/html",
      },
    };
    if (postType == "Article") postActivity.object.source.content = articleText;
    if (postType != "Note") postActivity.object.title = faker.lorem.sentence();
    if (postType == "Link") postActivity.object.href = faker.internet.url();
    if (["Image", "Link"].includes(postType))
      postActivity.object.image = faker.image.url();
    let reply = await fetch(baseUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ activity: postActivity }),
    });
    posts.push(await reply.json());
  }

  for (let i = 0; i < numPosts; i++) {
    let postActivity = activityTemplate;
    // let actorId = users[Math.floor(Math.random() * users.length)].id;
    let actorId = "@admin@kowloon.social";
    postActivity.actorId = actorId;
    let postType = postTypes[Math.floor(Math.random() * postTypes.length)];
    postActivity.object = {
      to: ["@admin@kowloon.social"],

      type: postType,
      source: {
        content: `<p>${faker.lorem.sentence()}</p>`,
        mediaType: "text/html",
      },
    };
    if (postType == "Article")
      postActivity.object.source.content = `<p>${faker.lorem.paragraphs(
        {
          min: 2,
          max: 5,
        },
        "</p><p>"
      )}</p>`;
    if (postType != "Note") postActivity.object.title = faker.lorem.sentence();
    if (postType == "Link") postActivity.object.href = faker.internet.url();
    if (["Image", "Link"].includes(postType))
      postActivity.object.image = faker.image.url();
    let reply = await fetch(baseUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ activity: postActivity }),
    });
    posts.push(await reply.json());
  }
  return posts;
}
