//auth middleware to protect paths
function requireAuth(req, res, next) {
  console.log("Cookie present:", Boolean(req.headers.cookie));
  console.log("Session ID:", req.sessionID);
  console.log("Session userId:", req.session?.userID);
  //if exist in the session object
  if (req.session.userID) {
    return next(); //past control to the request handler below
  }
  return res.status(401).send({ message: "Unauthorised" });
}

export default requireAuth;
