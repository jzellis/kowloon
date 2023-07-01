import fs from "fs";

const path = "./export.json";

let exported = JSON.parse(await fs.readFileSync(path));

// console.log(exported.posts_publish[0]);
let posts = exported.posts_publish.map((post) => ({
  type: "Create",
  "@context": "https://www.w3.org/ns/activitystreams",
  actor: "@jzellis@kwln.social",
  owner: "6485aac7e15ad519ff139d08",
  object: {
    type: "Article",
    name: post.post_title,
    source: {
      content: `<p>${post.post_content.split("\r\n").join("</p><p>")}</p>`,
      mediaType: "text/html",
    },
    public: true,
    publicCanComment: false,

    published: post.post_date,
  },
  published: post.post_date,
  to: ["@jzellis@kwln.social"],
}));
fs.writeFileSync("wp-to-kowloon.json", JSON.stringify(posts));
