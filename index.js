import {jsonResponse} from "./utils/utils.js";
import codes from "./httpCodes.js";
import express from "express";
import {corsMiddleware, errorMiddleware} from "./middleware.js";

import user from "./subroutes/user.js";
import admin from "./subroutes/admin.js";
import quest from "./subroutes/quest.js";
import branch from "./subroutes/branch.js";
import task from "./subroutes/task.js";
import rating from "./subroutes/rating.js";
import image from "./subroutes/image.js";
import config from "./config.js";



const api = express();
api.use('/user', user);
api.use('/admin', admin);
api.use('/quest', quest);
api.use('/branch', branch);
api.use('/task', task);
api.use('/ratings', rating);
api.use('/image', image);

const app = express();
app.use('/api', api);
app.use(errorMiddleware);
app.use(corsMiddleware);
app.use(errorMiddleware);


api.get(`/`, async (req, res) => {
    res.send("Это начальная страница API, а не сайт. Вiйди отсюда!");
});

app.get('*', (req, res) => {
    jsonResponse(res, "404 страница не найдена", codes.HTTP_NOT_FOUND);
});



const HTTP_PORT = process.env.PORT || config.api_port;
app.listen(HTTP_PORT, () => {
    console.log('Server working on http://localhost:' + HTTP_PORT);
});

