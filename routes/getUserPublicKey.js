import { User } from "#schema";
export default async function (req, res, next) {
  let user = await User.findOne({ id: req.params.id }).lean();
  let status = 200;
  res.send(user.publicKey);
}
