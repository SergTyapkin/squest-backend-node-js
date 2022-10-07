import express from "express";
import {DB} from "../constants.js";
import sql from "../database/SQL_requests.js";
import {jsonResponse} from "../utils/utils.js";
import bodyParser from "body-parser";
import {corsMiddleware, errorMiddleware} from "../middleware.js";

const app = express();
app.use(bodyParser.json());
app.use(corsMiddleware);
app.use(errorMiddleware);
export default app;

app.get("", async (req, res) => {
    const resp = await DB.execute(sql.selectRatings, [], true)
    const notNoneRatings = []
    const noneRatings = []
    resp.forEach((rating) => {
        if (rating['rating'] === undefined) {
            rating['rating'] = 0
            noneRatings.push(rating)
        } else {
            notNoneRatings.push(rating)
        }
    });

    return jsonResponse(res, {'ratings': notNoneRatings.concat(noneRatings)})
});
