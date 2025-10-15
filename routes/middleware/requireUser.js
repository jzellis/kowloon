// routes/middleware/requireUser.js
export default function requireUser(req, res, next) {
  if (req.user && req.user.id) return next();
  return res.status(401).json({ error: "Unauthorized" });
}
