import getFromCollection from "#utils/getFromCollection.js";

export default async function (opts) {
  return await getFromCollection("Groups", opts);
}
