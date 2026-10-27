import http from "node:http";
import app from "./app.js";

const port = 3000;

//passing the Express application as the HTTP request listener
//server listen to incoming connections fromm the app and respond accoridngly
const server = http.createServer(app);

server.listen(port, () => {
  console.log(`Currently listening on port ${port}`);
});
