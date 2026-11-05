import { Router } from "express";
import { inputValidation } from "../validation/auth.validator.js";
import { validationResult } from "express-validator";
import argon2 from "argon2";
import db from "../database/postgresdb.js";

const router = Router();

router.post("/register", inputValidation, async (req, res) => {
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

  req.session.regenerate((err) => {
    if (err) return next(err);

    //express saves the modified session data in the server side session store, session created
    //this is the session data being stored on the server
    // this is a custom prperty set in the session object
    //automatic log in
    req.session.userID = result.id;

    //save the session, persists

    req.sesion.save((err) => {
      if (err) return next(err);

      return res.status(201).send({
        message: "Registration successful",
      });
    });
  });
});

//AuthN
router.post("/login", inputValidation, async (req, res) => {
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
router.post("/logout", (req, res) => {
  //destroy the session associated with the request session cookie on the server
  req.session.destroy((err) => {
    if (err) return next(err); //next handling middleware

    //clear cookies, clear the session id cookie on browser
    res.clearCookie("connect.sid");

    return res.sendStatus(204);
  });
});

export default router;
