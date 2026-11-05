import session from "express-session";
import ConnectPgSimple from "connect-pg-simple";
import db from "../database/postgresdb.js";

//session configuration
const PgSession = ConnectPgSimple(session); //create a session store class with express session
//handle sessions, create session, set sessio cookie, set config
//cookies are automatically attached
//sessionID are randomaly generated
//store the session object in the postgres database, sessionID, session data, expiration
//this is the external session store, provide the storage
//maintain session persistance , the session survives a restart
const sessionMiddleware = session({
  store: new PgSession({
    //new instance
    pgPromise: db, // pass the database object, did not mentoined tis so end up 404 not found, the table cannot be found since there is not db object
    tableName: "user_sessions",
    createTableIfMissing: true,
  }),
  name: "mysession", //the name of the session
  secret: process.env.SESSION_SECRET, //responsible for cryptographically sign the sessionID cookie, changing the secret
  //will invalidate previously issued signed cookies
  resave: false, //avoid saving an unchanged session
  saveUninitialized: false, //avoid ssaving a newly created session that has not been modified, created when saved
  //configure a cookie
  cookie: {
    httpOnly: true, //ensure javascript cannot read the id
    secure: false,//if true only allows https 
    sameSite: "lax",
    maxAge: 600000, //expires in 10 minutes, after that the sessio is invalid, new session and new session ID
  },
});

export default sessionMiddleware;
