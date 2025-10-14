import get from "#methods/get/index.js";

export default async function (opts) {
  return await get.collection("Groups", opts);
}
