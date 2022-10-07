import _DB from "./database/database.js";
import config from "./config.js";


export const DB = new _DB(config.db_host, config.db_port, config.db_user, config.db_password, config.db_database);
DB.start();
