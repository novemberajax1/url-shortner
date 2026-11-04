//last middleware in the request handling process
//if not handled here, then handled with default handler
//catch all
//the error handler forces
const error_handler = (err, req, res, next) => {
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
  console.error(err); //showing at the error level
  return res.status(500).send({
    error: "Internal server error",
  });
};

export default error_handler;
