const handler = (res, req, next) => {
  let response = "Hello POST";
  let status = 200;

  res.status(status).send(response);
};

export default handler;
