import express from "express";
import crypto from "node:crypto";
import db from "./db.js"; //relative path, look one dir up
import morgan from "morgan";

const app = express();
//parse it to JSON before routing
//These are ezecuted before the eoutes, it executes a requests is sent
app.use(express.json()); // apply to all respones everything
app.use(morgan("dev")); //apply to all respones
//connecting to one of the databases in the postgres DBMS
// POST for convert the original url to short urls

function isValidurl(url) {
  if (typeof url !== "string") {
    return false;
  }

  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

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

//just maybe add authentication but consider poprerly
//think about using express.Router to group routes but ther are only a fee routes so

//Create a short URL
app.post("/shorten", async (req, res) => {
  const originUrl = req.body?.url;

  //check if the url is a string, proceed
  if (!isValidurl(originUrl)) {
    return res.status(400).send({
      error: "Invalid URL",
    });
  }

  //generate random short codes for link, the code need to be associated with the original link
  const shortCode = shortcode();

  //get date
  const date = new Date(Date.now());

  //result object
  //the id is not inserted into the database
  //the id is for the JSON response for the client to see
  //ids is UNIQUE AND DEFAULT, AUTO INCREMENT, enforced in db
  const result = {
    url: originUrl,
    shortCode: shortCode, //default 6
    createdAt: date.toISOString(), //time created
    updatedAt: date.toISOString(), //time updateed
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
    "INSERT INTO urlshorts (shortcode,originurl,timecreate,timeupdated) VALUES($1,$2,$3,$4) RETURNING *",
    [result.shortCode, result.url, result.createdAt, result.updatedAt],
  );

  //if handling with 409, then 409 conflict will beoutputedd , the custome error handler is at the end of the stack

  //return it
  return res.status(201).send({
    id: insertion.id,
    url: insertion.originurl,
    shortCode: insertion.shortcode,
    createdAt: insertion.timecreate,
    updatedAt: insertion.timeupdated,
  });
});

//get original through returned shortcode from POST
//saearch db, search origina link associated with code
//redirection
app.get("/shorten/:shortcode", async (req, res) => {
  //extract the url params, default string
  const shortUrl = req.params.shortcode;

  //index into db, find ogurl
  //this is being handled by default handler
  //either 1 or 0 , return one row or null
  //more explicit ffound or not found 1 row or null
  //UPdate the access count everytime the get request to get the original url through the short code
  //UPDATE and return

  const result = await db.oneOrNone(
    "UPDATE urlshorts SET accessedcount = accessedcount + 1 WHERE shortcode = $1 RETURNING originurl",
    shortUrl,
  );

  //connection established but not found
  if (result === null) {
    return res.status(404).send({
      error: "Short URL not found",
    });
  }
  //add a column to the table and update everytimee while doing get requests

  return res.redirect(result.originurl);
  //either staight up redirect or. return the url and redirect
});

//need to update timestamp too
//going to update the new put URL that's the only responsibililty based on the short code
//not use etag to check if both links , etag is used for cache validation
//further, a user supplied URL might be malicious , redirecting to other malicious servicces
app.put("/shorten/:shortcode", async (req, res) => {
  //the body will include a updated url
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
    "UPDATE urlshorts SET timeupdated = $1, originurl = $2 WHERE shortcode = $3 RETURNING *",
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

app.delete("/shorten/:shortcode", async (req, res) => {
  //we need to get the code from the url
  const identifier = req.params.shortcode;

  //index into db, delete specif row based onthe shorturl
  //return the deleted row
  const deleted = await db.result(
    "DELETE FROM urlshorts WHERE shortcode = $1",
    identifier,
  );
  //can't founud
  if (deleted.rowCount === 0) {
    return res.status(404).send({
      error: "short URL not found",
    });
  }

  return res.status(204).send();
});

//get the times of  a shorten url is pressed , when user press the short link, redirect to the original
//how many get req is sent ??
//get url stats
app.get("/shorten/:shortcode/stats", async (req, res) => {
  const code = req.params.shortcode;
  //get the accessed count based on the specific shorturl
  const result = await db.oneOrNone(
    "SELECT * from urlshorts WHERE shortcode = $1",
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
  });
});

//client only see a controlled JSON response
//last middleware in the request handling process
//if not handled here, then handled with default handler which there will be a stack trace
//catch all
//the error handler forces
app.use((err, req, res, next) => {
  //the actual error is logged at error level
  if (res.headersSent) {
    return next(err);
  }

  //duplicate, expected error
  if (err.code === "23505" && err.constraint === "uoriginurl") {
    return res.status(409).send({
      error: "URL already exists",
    });
  }

  //unexcpected
  console.error(err);
  return res.status(500).send({
    error: "Internal server error",
  });
});

export default app;

//error handling, use a generic error handler for unexpeacted errors

//POST the same url INSERT error, consdier do nothign
//same generated six digits short cod, enforce onstraint in db, consider do nothing
//expected errors should be handled
