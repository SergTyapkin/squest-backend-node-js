import pkg from "pg";
const {Client} = pkg;
import {readFile} from 'node:fs/promises';

export default class DB {
  user
  password
  host
  port
  dbname

  db

  constructor(host, port, user, password, dbname) {
    // make singleton
    if (DB._instance) {
      return DB._instance;
    }
    DB._instance = this;

    this.user = user;
    this.password = password;
    this.host = host;
    this.port = port;
    this.dbname = dbname;

    this.db = new Client({
      user: this.user,
      password: this.password,
      host: this.host,
      port: this.port,
      database: dbname
    });
  }

  async start() {
    try {
      await this.db.connect();
    } catch (e) {
      if (e.code === '3D000') {
        console.log(`База данных "${this.dbname}" не существует. Создание базы данных с таким именем...`);
        try {
          this.db = new Client({
            user: this.user,
            password: this.password,
            host: this.host,
            port: this.port
          });
          this.db.connect();
          this.db.query(`CREATE DATABASE "${this.dbname}"`);
        } catch (e) {
          console.log('\n/*/', e);
          throw Error('Ошибка при создании базы данных');
        }
      }
    }

    try {
      const init = await readFile('database/init.sql', 'utf-8');
      this.db.query(init);
      console.log("Подключение к базе данных выполнено. Таблицы созданы");
    } catch (e) {
      console.log('\n/*/', e);
      throw Error('Ошибка при открытии и выполнении init.sql');
    }
  }

  async execute(request, values=[], manyResults=false, toLists=false) {
    let res;
    try {
      res = await this.db.query(request, values);
    } catch (e) {
      console.log('\n/*/', request, '\n/*/', values, '\n/*/', e);
      throw Error('Ошибка при выполнении запроса');
    }


    if (!toLists && !manyResults) {
      if (!res.rows?.length) {
        return null;
      }
    }

    if (!manyResults) {
      if (toLists)
        return Object.values(res.rows[0]);
      return res.rows[0];
    }

    if (toLists)
      return res.rows.map((row) => Object.values(row));
    return res.rows;
  }

  async stop() {
    await this.db.end();
  }
}
