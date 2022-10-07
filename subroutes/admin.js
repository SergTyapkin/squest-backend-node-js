import express from "express";
import {DB} from "../constants.js";
import {jsonResponse} from "../utils/utils.js";
import codes from "../httpCodes.js";
import {loginRequiredAdmin} from "../utils/access.js";
import bodyParser from "body-parser";
import {corsMiddleware, errorMiddleware} from "../middleware.js";

const app = express();
app.use(bodyParser.json());
app.use(corsMiddleware);
app.use(errorMiddleware);
export default app;

app.post("/sql", loginRequiredAdmin(async (req, res) => {
    const r = req.body || {};
    const sqlText = r['sql'];
    if ([sqlText].includes(undefined))
        return jsonResponse(res, "Не удалось сериализовать json", codes.HTTP_INVALID_DATA);

    try {
        const resp = await DB.execute(sqlText, [], true);
        return jsonResponse(res, {"response": resp});
    } catch (e) {
        return jsonResponse(e.toString(), codes.HTTP_INTERNAL_ERROR);
    }
}));
