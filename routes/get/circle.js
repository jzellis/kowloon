import Kowloon from "../../Kowloon.js";
export default async function (req, res) {
  let qStart = Date.now();
  let status = 200;
  console.log(req.params.id);
  let query = req.user?.id
    ? {
        id: req.params.id,
        $or: [{ public: true }, { actorId: req.user.id }],
      }
    : { id: req.params.id, public: true };
  let response = await Kowloon.getCircle(query);
  // response.posts = await Kowloon.getPosts(
  //   req.user
  //     ? {
  //         circles: req.params.id,
  //         $or: [
  //           { public: true },
  //           { actorId: req.user.id },
  //           { to: req.user.id },
  //           { bto: req.user.id },
  //           { cc: req.user.id },
  //           { bcc: req.user.id },
  //         ],
  //       }
  //     : { circles: req.params.id, public: true },
  //   { page: req.query.page ? parseInt(req.query.page) : 1 }
  // );
  let qEnd = Date.now();
  response.queryTime = qEnd - qStart;
  res.status(status).json(response);
}
