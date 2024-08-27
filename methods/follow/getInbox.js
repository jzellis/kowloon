import { User, Inbox, Post } from "../../schema/index.js";
import get from "../remote/get.js";
import post from "../remote/post.js";
import Parser from "rss-parser";
import slugify from "slugify";
import url, { URL } from "url";

export default async function (actorId, options = { read: false, type: [] }) {
  let query = { to: actorId };
  if (options.read == true) query.read = true;
  return (await Inbox.find(query, "item")).map((i) => i.item);
}
