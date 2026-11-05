import express from "express";
import crypto from "node:crypto";
import db from "./database/postgresdb.js";
import morgan from "morgan";
import argon2 from "argon2";
import { body, validationResult } from "express-validator";
import sessionMiddleware from "./config/session.js";
import requireAuth from "./middleware/requireAuth.js";
import error_handling from "./middleware/error_handling.js";

//consider using express validtor middleware
const app = express();
//parse it to JSON before routing
//These are ezecuted before the eoutes, it executes a requests is sent
app.use(express.json()); // apply to all respones everything
app.use(morgan("dev")); //apply to all respones
app.use(sessionMiddleware);

//check credentials
const inputValidation = [
  body("email")
    .trim()
    .notEmpty()
    .withMessage("Email is a required field")
    .isEmail()
    .withMessage("Provide valid email address"),
  body("password").trim().notEmpty().withMessage("Password cannot be empty"),
];
//check url
const urlValidation = [body("url").trim().notEmpty().isURL()];

//the cryptographic generator does not provide enough entropyu
function shortcode(length = 6) {
  //define a set of chars
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  //populate the string
  let result = "";
  //populate the array of length 6  with random number
  const randomArray = new Uint8Array(length);

  //randomize
  crypto.getRandomValues(randomArray);

  //loop through the array and create a random string by populating result
  //iterate six times
  //the reusult is the position of the chars string
  randomArray.forEach((number) => {
    result += chars[number % chars.length];
  });
  return result;
}

//authoization and authentication
//signup endpoint
//user creation
// miss this /
app.post("/auth/register", inputValidation, async (req, res) => {
  //handle santization errors
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      errors: errors.array(),
    });
  }

  //get the req body username and password
  const { email, password } = req.body;

  //hash password
  const password_hash = await argon2.hash(password);

  //user object
  const user = {
    u_email: email,
    password_hash: password_hash,
  };

  //insert into db
  //the user id is autmatically generated when signing up
  const result = await db.one(
    "INSERT INTO users (email,password_hash) VALUES($1,$2) RETURNING id",
    [user.u_email, user.password_hash],
  );

  //express regenerates the session obj, create a fresh random sessionID
  //session ID identifies the particular session
  req.session.regenerate((err) => {
    if (err) return next(err);

    //express saves the modified session data in the server side session store, session created
    //this is the session data being stored on the server
    // this is a custom prperty set in the session object
    //automatic log in
    req.session.userID = result.id;

    //save the session, persist
    req.session.save((err) => {
      if (err) return next(err);

      return res.status(201).send({
        message: "Registration successful",
      });
    });
  });

  //browser receives a cookie containing the sessin ID (sid)from the server, not the session data (==> req.session.userID)

  //on subsequent requests, express use the session cookie to retrieve the session data, recognize the authenticated user
});

app.post("/auth/login", inputValidation, async (req, res) => {
  //handle sanntization errors
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      errors: errors.array(),
    });
  }
  const { email, password } = req.body;

  //find hash associated with email
  const result = await db.oneOrNone(
    "SELECT id, password_hash FROM users WHERE email = $1",
    email,
  );
  //user might not exists
  if (result === null) {
    return res.status(404).send({
      error: "User not found",
    });
  }

  //compare the hash with the password string
  const verified = await argon2.verify(result.password_hash, password);

  //unauthorized, 401 user identity cannot be verified
  if (!verified) {
    return res.status(401).send({
      error: "Invalid e-mail or password",
    });
  }

  //regenerate the session guard against session fixation
  //the new sessio object will be generated
  req.session.regenerate((err) => {
    if (err) return next(err); // handle to custoe error handler if error

    //assoicate the session with the authenticated user,
    //store the session in server
    req.session.userID = result.id;

    //save the session, persis the authenticated session
    req.session.save((err) => {
      if (err) return next(err);

      //send success login status
      //server sends the cookie to the browser as part of the response
      //set cookie + response body
      return res.status(200).send({
        message: "Login successful",
      });
    });
  });
});

// logging out
//doing an action
//Terminate the current authenticated session
app.post("/auth/logout", (req, res) => {
  //destroy the session associated with the request session cookie on the server
  req.session.destroy((err) => {
    if (err) return next(err); //next handling middleware

    //clear cookies, clear the session id cookie on browser
    res.clearCookie("connect.sid");

    return res.sendStatus(204);
  });
});

//Create a short URL
// custome alias and expiration data is optional things that you can send through the post request
//allow multiple different short code for the same long URL
//WRITE api
app.post("/shorten", urlValidation, requireAuth, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      errors: errors.array(),
    });
  }
  const originUrl = req.body?.url;

  //generate random short codes for link, the code need to be associated with the original link
  const shortCode = shortcode();

  //get date
  const date = new Date(Date.now());

  //the id is from the session data
  //from server
  const userID = req.session.userID;

  //result object
  //the id is not inserted into the database
  //the id is for the JSON response for the client to see
  //ids is UNIQUE AND DEFAULT, AUTO INCREMENT, enforced in db
  const result = {
    url: originUrl,
    shortCode: shortCode, //default 6
    createdAt: date.toISOString(), //time created
    updatedAt: date.toISOString(), //time updateed
    user_id: userID, //FK the user id that identifies the user, this is being referenced by the users(id) table PK
  };

  //return one result with a default id of the row
  //Persists the record and generate the ID, maintain consistency between the response object and database
  //generate ID straight from db
  //trying ON CONFLICT DO NOTHING as in when i try to insert the sasme link, the row will not be inserted and the error is not shown
  //the duplicate exception is not raised inthis case
  //CRUS returns a prommise then unwrapped by await, either resolve or reject
  //duplicate inserts will
  //the conflict insertion is skipped
  //Postgres consume identiy sequence values when precents insertion expected
  //Once a sequence value is allocated, PostgreSQL does not reclaim it merely because the transaction fails.
  //ID can have gaps
  const insertion = await db.one(
    "INSERT INTO urls (shortcode,originurl,timecreate,timeupdated,user_id) VALUES($1,$2,$3,$4,$5) RETURNING *",
    [
      result.shortCode,
      result.url,
      result.createdAt,
      result.updatedAt,
      result.user_id,
    ],
  );

  //if handling with 409, then 409 conflict will beoutputedd , the custome error handler is at the end of the stack

  //return it
  return res.status(201).send({
    id: insertion.id,
    url: insertion.originurl,
    shortCode: insertion.shortcode,
    createdAt: insertion.timecreate,
    updatedAt: insertion.timeupdated,
    user_id: insertion.user_id, //returning the id
  });
});

//takes in the shortcode and redirect the user to the original long URL
//READ api
app.get("/shorten/:shortcode", requireAuth, async (req, res) => {
  //extract the url params, default string
  const shortUrl = req.params.shortcode;

  //index into db, find ogurl
  //this is being handled by default handler
  //either 1 or 0 , return one row or null
  //more explicit ffound or not found 1 row or null
  //UPdate the access count everytime the get request to get the original url through the short code
  //UPDATE and return

  const result = await db.oneOrNone(
    "UPDATE urls SET accessedcount = accessedcount + 1 WHERE shortcode = $1 RETURNING originurl",
    shortUrl,
  );

  //connection established but not found
  if (result === null) {
    return res.status(404).send({
      error: "Short URL not found",
    });
  }

  //302 redirect, browsers do not cache this response
  //Every request will go through this server
  //tracking click stat is optional

  return res.redirect(result.originurl);
  //either staight up redirect or. return the url and redirect
});

//update the url if new url appears
//but this is more like creating a new resource

app.put("/shorten/:shortcode", urlValidation, requireAuth, async (req, res) => {
  //santize input error
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      errors: errors.array(),
    });
  }
  const newUrl = req.body?.url;
  //also get the old code
  const code = req.params.shortcode;
  //so updated URL => update short ?

  //check string first
  if (isValidurl(newUrl) === false) {
    return res.status(400).send({
      error: "Invalid URL",
    });
  }

  //new date
  const ndate = new Date(Date.now());

  //change the updatedtime, the originurl, not the short code
  const updated = await db.oneOrNone(
    "UPDATE urls SET timeupdated = $1, originurl = $2 WHERE shortcode = $3 RETURNING *",
    [ndate, newUrl, code],
  );

  if (updated === null) {
    return res.status(404).send("Short URL not found");
  }

  return res.status(200).send({
    id: updated.id,
    shortCode: updated.shortcode,
    originUrl: updated.originurl,
    createdAt: updated.timecreate,
    updatedAt: updated.timeupdated,
  });
});

app.delete("/shorten/:shortcode", requireAuth, async (req, res) => {
  //we need to get the code from the url
  const identifier = req.params.shortcode;
  const usr_id = req.session.userID;
  //index into db, delete specif row based onthe shorturl
  //return the deleted row
  //only delete as the user owned urls
  const deleted = await db.result(
    "DELETE FROM urls WHERE shortcode = $1 AND user_id = $2",
    [identifier, usr_id],
  );

  //can't founud
  if (deleted.rowCount === 0) {
    return res.status(404).send({
      error: "Short URL not found",
    });
  }

  return res.status(204).send();
});

//get the times of  a shorten url is pressed , when user press the short link, redirect to the original
//how many get req is sent ??
//get url stats
app.get("/shorten/:shortcode/stats", requireAuth, async (req, res) => {
  const code = req.params.shortcode;
  //get the accessed count based on the specific shorturl
  const result = await db.oneOrNone(
    "SELECT * from urls WHERE shortcode = $1",
    code,
  );
  //can't be found
  if (result === null) {
    return res.status(404).send({
      error: "Short url can't be found",
    });
  }

  return res.status(200).send({
    id: result.id,
    url: result.originurl,
    shortCode: result.shortcode,
    createdAt: result.timecreate,
    updatedAt: result.timeupdated,
    accessCount: result.accessedcount,
    user_id: result.user_id,
  });
});

app.use(error_handling);

export default app;

//error handling, use a generic error handler for unexpeacted errors

//POST the same url INSERT error, consdier do nothign
//same generated six digits short cod, enforce onstraint in db, consider do nothing
//expected errors should be handled
