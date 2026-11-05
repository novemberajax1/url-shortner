import { Router } from "express";
import { urlValidation } from "../validation/url.validator.js";
import { validationResult } from "express-validator";
import requireAuth from "../middleware/requireAuth.js";
import { shortcode } from "../service/shortCodegeneration.js";
import db from "../database/postgresdb.js";

const router = Router();

//WRITE api
router.post("/shorten", urlValidation, requireAuth, async (req, res) => {
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
  //input transformations
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
  //the id of the user is not supplied by the user, it is automatically generated from the database
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

  //return it json object
  //output json
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
//dynamic routes
//public
//allow anyone to access the route, no accout needed

router.get("/shorten/:shortcode", async (req, res) => {
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

router.put(
  "/shorten/:shortcode",
  urlValidation,
  requireAuth,
  async (req, res) => {
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
  },
);

//require auth for deletion, user need to exists and identgy themselves
router.delete("/shorten/:shortcode", requireAuth, async (req, res) => {
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
router.get("/shorten/:shortcode/stats", requireAuth, async (req, res) => {
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

export default router;
