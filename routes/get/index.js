import fs from "fs/promises";

const staticPage = await fs.readFile("./public/index.html", "utf-8");

export default async function (req, res) {
  let status = 200;
  res.status(status).send(staticPage);
}
