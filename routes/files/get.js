import Kowloon from "../../Kowloon.js";
export default async function (req, res, next) {
  let status = 200;
  let qStart = Date.now();
  let response = {};

  res.status(status).json(response);
}

// app.listen(3000, () => console.log("Server running on port 3000"));
