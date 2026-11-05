import { body } from "express-validator";

export const urlValidation = [body("url").trim().notEmpty().isURL()];
