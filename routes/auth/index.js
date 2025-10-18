// /routes/auth/index.js
import express from "express";
import loginRouter from "./login.js";

const router = express.Router({ mergeParams: true });

// loginRouter already has router.post("/login", …)
// so we *mount* it here -- effective path will be /auth/login
router.use("/", loginRouter);

export default router;
