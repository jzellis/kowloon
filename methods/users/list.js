import getFromCollection from "#methods/get/objectById.js";
export default async function (opts) {
  return await getFromCollection("Users", opts);
}
