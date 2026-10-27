import "dotenv/config"; //load the env file into process.env. storing configuration separate from code
import pgPromise from "pg-promise";

//initialize instasnce
const pgp = pgPromise();

//connection
const db = pgp(process.env.DATABASE_URL);

//exporting for shareed use
export default db;
