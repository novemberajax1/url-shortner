import { body } from "express-validator";

export const inputValidation = [
  body("email")
    .trim()
    .notEmpty()
    .withMessage("Email is a required field")
    .toLowerCase()
    .isEmail()
    .withMessage("Provide valid email address"),
  body("password").trim().notEmpty().withMessage("Password cannot be empty"),
];
