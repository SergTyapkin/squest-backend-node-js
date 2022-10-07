import config from "./config.js";
import codes from "./httpCodes.json" assert { type: 'json' };
import {jsonResponse} from "./utils/utils.js";


const headerCorsMethods = config.cors_methods.join(', ');

function addCorsHeaders(req, res) {
  if (!config.cors_origins.includes(req.origin))
    return;
  res.set("Access-Control-Allow-Origin", req.origin)
  res.set("Access-Control-Allow-Headers", "Content-type, X-CSRF-Token, Authorization")
  res.set("Access-Control-Allow-Credentials", "true")
  res.set("Access-Control-Allow-Methods", headerCorsMethods)
  res.set("Access-Control-Expose-Headers", "Set-Cookie")
}


export function corsMiddleware (req, res, next) {
  if (req.method === "OPTIONS") {
    res.set("Content-Type", "text/plain");
    res.send("200 Ok");
    return;
  }

  next();
}

export function errorMiddleware (err, req, res, next) {
  console.log(`В процессе обработки пути произошла ошибка:`, err);
  jsonResponse(res, "Внутренняя ошибка сервера", codes.HTTP_INTERNAL_ERROR);
}
