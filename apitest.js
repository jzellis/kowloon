import Kowloon from "./Kowloon.js";
import { faker } from "@faker-js/faker";
import Post from "./schema/Post.js";
let baseUrl = "https://kowloon.social";
let auth = "";

// const endpoints = {
//   get: [
//     { name: "Circles", url: "/circles" },
//     { name: "Posts", url: "/posts" },
//     { name: "Users", url: "/users" },
//     { name: "Activities", url: "/activities" },
//     { name: "Admin Profile", url: "/users/@admin@kowloon.social" },
//     { name: "Admin Posts", url: "/users/@admin@kowloon.social/posts" },
//     { name: "Admin Circles", url: "/users/@admin@kowloon.social/circles" },
//     { name: "Admin Groups", url: "/users/@admin@kowloon.social/groups" },
//     { name: "Admin Bookmarks", url: "/users/@admin@kowloon.social/bookmarks" },
//   ],
//   post: [],
// };

// let results = {};

// let activities = {
//   create: {
//     activity: {
//       type: "Create",
//       objectType: "Post",
//       actorId: "@admin@kowloon.social",
//       object: {
//         type: "Article",
//         title: "Hello World!",
//         source: {
//           mediaType: "text/html",
//           content: "Hello World!",
//         },
//       },
//     },
//   },
//   update: { type: "Update" },
//   delete: { type: "Delete" },
//   follow: { type: "Follow" },
//   bookmark: { type: "Bookmark" },
//   like: { activity: { type: "Like", target: "", object: {} } },
//   unlike: { type: "Unlike" },
// };

try {
  let res = await fetch(baseUrl + "/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ username: "admin", password: "admin" }),
  });
  auth = "Basic " + (await res.text());

  console.log(auth);

  //   // await Promise.all(
  //   //   endpoints.get.map(async (endpoint) => {
  //   //     try {
  //   //       let qStart = Date.now();
  //   //       let res = await fetch(baseUrl + endpoint.url, {
  //   //         method: "GET",
  //   //         headers: {
  //   //           "Content-Type": "application/json",
  //   //           Authorization: auth,
  //   //         },
  //   //       });
  //   //       results[endpoint.name] = await res.json();
  //   //       let qEnd = Date.now();
  //   //       // console.log(`${endpoint.name}: Success - ${qEnd - qStart} ms`);
  //   //     } catch (e) {
  //   //       console.error(`${endpoint.name} failed: ${e}`);
  //   //     }
  //   //   })
  //   // );
  //   // // for (let key in results) {
  //   // //   if (results[key].hasOwnProperty("items"))
  //   // //     console.log(`${results[key].summary}: ${results[key].items.length}`);
  //   // // }

  //   try {
  //     res = await fetch(baseUrl + "/outbox", {
  //       method: "POST",
  //       headers: {
  //         "Content-Type": "application/json",
  //         Authorization: auth,
  //       },
  //       body: JSON.stringify(activities.create),
  //     });
  //     let createActivity = await res.json();
  //     let createdActivity = await Post.findOne({
  //       id: createActivity.activity.objectId,
  //     });
  //     console.log(`Create Activity: `, createdActivity);

  //     let updatedActivity = activities.create;
  //     updatedActivity.activity.type = "Update";
  //     updatedActivity.activity.target = createActivity.activity.objectId;
  //     updatedActivity.activity.object.source.content =
  //       "This post has been updated!";
  //     res = await fetch(baseUrl + "/outbox", {
  //       method: "POST",
  //       headers: {
  //         "Content-Type": "application/json",
  //         Authorization: auth,
  //       },
  //       body: JSON.stringify(updatedActivity),
  //     });

  //     let updateActivity = await res.json();
  //     updatedActivity = await Post.findOne({
  //       id: createActivity.activity.objectId,
  //     });
  //     console.log(`Updated Activity: `, updatedActivity);

  //     res = await fetch(baseUrl + "/outbox", {
  //       method: "POST",
  //       headers: {
  //         "Content-Type": "application/json",
  //         Authorization: auth,
  //       },
  //       body: JSON.stringify({
  //         activity: {
  //           type: "Like",
  //           target: createdActivity.id,
  //           object: faker.helpers.arrayElement(Kowloon.settings.likeEmojis),
  //         },
  //       }),
  //     });

  //     let likeActivity = await res.json();

  //     res = await fetch(baseUrl + "/outbox", {
  //       method: "POST",
  //       headers: {
  //         "Content-Type": "application/json",
  //         Authorization: auth,
  //       },
  //       body: JSON.stringify({
  //         activity: {
  //           type: "Unlike",
  //           target: createdActivity.id,
  //           object: faker.helpers.arrayElement(Kowloon.settings.likeEmojis),
  //         },
  //       }),
  //     });

  //     let unlikeActivity = await res.json();

  //     res = await fetch(baseUrl + "/outbox", {
  //       method: "POST",
  //       headers: {
  //         "Content-Type": "application/json",
  //         Authorization: auth,
  //       },
  //       body: JSON.stringify({
  //         activity: {
  //           type: "Bookmark",
  //           target: createdActivity.id,
  //           object: {
  //             href: createdActivity.url,
  //           },
  //           // object: faker.helpers.arrayElement(Kowloon.settings.likeEmojis),
  //         },
  //       }),
  //     });

  //     let bookmarkActivity = await res.json();
  //     console.log(bookmarkActivity);
  //   } catch (e) {
  //     console.log(e);
  //   }

  let followActivity = {
    activity: {
      type: "Follow",
      actorId: "@admin@kowloon.social",
      target: "https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml",
    },
  };

  res = await fetch(baseUrl + "/outbox", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: auth,
    },
    body: JSON.stringify(followActivity),
  });
  console.log(await res.json());
} catch (e) {
  console.log(e);
}
process.exit();
