import { faker } from "@faker-js/faker";
import { Settings, User, Post, Circle } from "../../schema/index.js";
import Kowloon from "../../Kowloon.js";
export default async function () {
  let allCircles = [];
  let circles = await Circle.find({}).select("members").lean();
  circles.map((c) => {
    allCircles.push(...c.members.map((i) => i.id));
  });
  allCircles = [...new Set(allCircles)];
  let requests = Kowloon.parseUserlist(allCircles);
  return requests;
}
