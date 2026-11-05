import express from "express";
import urlRoutes from "./routes/url.routes.js";
import authRoutes from "./routes/auth.routes.js";
import morgan from "morgan";
import sessionMiddleware from "./config/session.js";
import error_handling from "./middleware/error_handling.js";
const app = express();
app.use(express.json()); // //parse it to JSON before routing, These are ezecuted before the eoutes, it executes a requests is sent
app.use(morgan("combined")); //apply to all respones
app.use(sessionMiddleware);

//mount the routes
//routes has access to session
app.use("/auth", authRoutes);
app.use("/urls", urlRoutes);

app.use(error_handling);

export default app;

//error handling, use a generic error handler for unexpeacted errors

//POST the same url INSERT error, consdier do nothign
//same generated six digits short cod, enforce onstraint in db, consider do nothing
//expected errors should be handled
