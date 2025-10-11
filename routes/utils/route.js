// routes/utils/route.js
export default function route(handler) {
  return async (req, res, next) => {
    let status = 200;
    const response = {};
    const qStart = Date.now();

    const api = {
      req,
      res,
      user: req.user,
      params: req.params,
      query: req.query,
      body: req.body,
      headers: req.headers,
      response,
      setStatus: (s) => {
        status = s;
      },
      set: (k, v) => {
        response[k] = v;
      },
    };

    try {
      await handler(api); // your route logic
    } catch (err) {
      status = err.status || 500;
      response.error = err.message || "Internal error";
    }

    response.queryTime = Date.now() - qStart;
    res.status(status).json(response);
  };
}
