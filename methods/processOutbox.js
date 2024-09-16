import { Outbox } from "../schema/index.js";
import get from "../remote/get.js";
import post from "../remote/post.js";
export default async function () {
  let items = await Outbox.find({ status: "pending" }).sort({ createdAt: 1 });

  await Promise.all(
    items.map(async (item) => {
      let server = item.to.split("@")[1];
      let url = `https://${server}/api/inbox`;
      let response = await post(url, {
        actorId: item.actorId,
        body: { activity: item.item },
      });
      let update = {};
      if (!response.error) {
        update.response = response;
        update.deliveredAt = new Date();
      }
      if (!response || response.error) {
        update.error = response.error;
      }

      await Outbox.findOneAndUpdate({ id: item.id }, { $set: update });
    })
  );
  return true;
}
