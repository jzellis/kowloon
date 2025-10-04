import getFromCollection from "#utils/getFromCollection.js";

export default async function (opts) {
  return await getFromCollection("Files", opts);
}
