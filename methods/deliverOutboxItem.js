import { Outbox } from "../schema/index.js";
import post from "./post.js";
export default async function (id) {
  let item = await Outbox.findOne({ id });

  let res = await post(`https://${item.server}/inbox`, item.id, item.object);
  if (res.ok) {
    item.status = "delivered";
    await item.save();
    item.response = await res.json();
  } else {
    item.status = "error";
    item.error = await res.json();
    await item.save();
    return await res.json();
  }
}
