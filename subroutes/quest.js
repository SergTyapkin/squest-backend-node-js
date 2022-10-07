import express from "express";
import {DB} from "../constants.js";
import sql from "../database/SQL_requests.js";
import {getSecondsFromPGInterval, jsonResponse} from "../utils/utils.js";
import { v4 as uuid4 } from 'uuid';
import codes from "../httpCodes.json" assert {type: 'json'};
import {loginAndEmailConfirmationRequired, loginOrNullReturnId, loginRequiredReturnId} from "../utils/access.js";
import {checkQuestAuthor} from "../utils/questUtils.js";
import bodyParser from "body-parser";
import {corsMiddleware, errorMiddleware} from "../middleware.js";

const app = express();
app.use(bodyParser.json());
app.use(corsMiddleware);
app.use(errorMiddleware);
export default app;


app.get("", loginOrNullReturnId(async (req, res, next, userIdLogined) => {
    const r = req.query;
    const userId = r['userId'];
    const questId = r['questId'];
    const questUid = r['questUid'];

    let resp;
    // Нужно выдать квест по id
    if (questId !== undefined) {
        let questData = await checkQuestAuthor(res, questId, userIdLogined, true, true)
        if (questData)
            return jsonResponse(res, questData);

        questData = await DB.execute(sql.selectPublishedQuestById, [questId])
        if (!questData)
            return jsonResponse(res, 'Квеста не существует или нет прав доступа', codes.HTTP_NOT_FOUND)

        return jsonResponse(res, questData)
    // Нужно выдать квест по uid
    } else if (questUid !== undefined) {
        const questData = await DB.execute(sql.selectQuestByUid, [questUid])
        if (!questData)
            return jsonResponse(res, 'Квеста не существует или нет прав доступа', codes.HTTP_NO_PERMISSIONS)

        return jsonResponse(res, questData)
    // Нужно выдать все квесты юзера
    } else if (userId !== undefined) {
        if (userIdLogined.toString() === userId)
            resp = await DB.execute(sql.selectEditableQuestsByUseridx2, [userIdLogined, userIdLogined], true)  // просмотр всех своих квестов
        else
            resp = await DB.execute(sql.selectPublishedQuestsByAuthorUserid, [userId, userIdLogined], true)  // просмотр квестов определенного автора
    // Нужно выдать вообще все квесты
    } else if (userIdLogined !== undefined) {
        const allQuests = await DB.execute(sql.selectPublishedQuests, [],true)  // берем все опубликованные
        const myQuests = await DB.execute(sql.selectEditableQuestsByUseridx2, [userIdLogined, userIdLogined], true)  // берем все, доступные для редактирования
        const myQuestsIds = myQuests.map((quest) => quest['id']);
        allQuests.forEach((quest) => {  // т.к. они могут пересекаться, добавляем к доступым для редактирования, остальные неопубликованные
            if (!myQuestsIds.includes(quest['id'])) {
                quest['canedit'] = false  // следим за полями canedit. Всё что мы делаем ради них и нужно
                myQuests.push(quest)
            }
        });
        resp = myQuests
    } else {
        resp = await DB.execute(sql.selectPublishedQuests, [], true)  // просмотр всех опубликованных квестов для незалогиненного пользователя
    }

    return jsonResponse(res, {'quests': resp})
}));


// app.get("/uid", loginRequiredReturnId(async (req, res, next, userId) => {
//     const r = req.query;
//     const questId = r['id'];noReq
//     if ([].includes(undefined))
//         return jsonResponse(res, "Не удалось сериализовать json", codes.HTTP_INVALID_DATA)
//
//     const questData = checkQuestAuthor(questId, userId, DB, allowHelpers=True)
//     if (!res)
//         return questData
//     resp = await DB.execute(sql.selectQuestUidById, [questData['id']])
//     if (!resp)
//         return jsonResponse(res, "Квеста не существует или нет прав доступа", codes.HTTP_NO_PERMISSIONS)
//     return jsonResponse(res, resp)


app.post("", loginAndEmailConfirmationRequired(async (req, res, next, userData) => {
    const r = req.body || {};
    const title = r['title'];
    const description = r['description'];
    const isPublished = r['isPublished'];
    if ([title, description, isPublished].includes(undefined))
        return jsonResponse(res, "Не удалось сериализовать json", codes.HTTP_INVALID_DATA)

    const uid = uuid4();
    const quest = await DB.execute(sql.insertQuest, [uid, title, description, userData['id'], isPublished])

    jsonResponse(res, quest)
}));


app.put("", loginRequiredReturnId(async (req, res, next, userId) => {
    const r = req.body || {};
    const questId = r['id'];
    let title = r['title'];
    let description = r['description'];
    let isPublished = r['isPublished'];
    let isLinkActive = r['isLinkActive'];
    let previewUrl = r['previewUrl'];
    if ([questId].includes(undefined))
        return jsonResponse(res, "Не удалось сериализовать json", codes.HTTP_INVALID_DATA)

    const questData = await checkQuestAuthor(res, questId, userId, true)
    if (!questData) return;

    if (!title)  title = questData['title']
    if (!isPublished)  description = questData['description']
    if (!isPublished)  isPublished = questData['ispublished']
    if (!isLinkActive)  isLinkActive = questData['islinkactive']
    if (!previewUrl)  previewUrl = questData['previewurl']

    const quest = await DB.execute(sql.updateQuestById, [title, description, isPublished, isLinkActive, previewUrl, questId])
    return jsonResponse(res, quest)
}));


app.delete("", loginRequiredReturnId(async (req, res, next, userId) => {
    const r = req.body || {};
    const questId = r['id'];
    if ([questId].includes(undefined))
        return jsonResponse(res, "Не удалось сериализовать json", codes.HTTP_INVALID_DATA)

    const questData = await checkQuestAuthor(res, questId, userId)
    if (!questData) return;

    await DB.execute(sql.deleteQuestById, [questId])
    return jsonResponse(res, "Квест удален")
}));


app.post("/choose", loginRequiredReturnId(async (req, res, next, userId) => {
    const r = req.body || {};
    const questId = r['questId'];
    const branchId = r['branchId'];
    if ([questId, branchId].includes(undefined))
        return jsonResponse(res, "Не удалось сериализовать json", codes.HTTP_INVALID_DATA)

    let user;
    try {
        user = await DB.execute(sql.updateUserChooseBranchByUserId, [questId, branchId, userId])
    } catch {
        return jsonResponse(res, "Ветка уже выбрана", codes.HTTP_DATA_CONFLICT)
    }
    return jsonResponse(res, user)
}));


app.get("/helpers", loginRequiredReturnId(async (req, res, next, userId) => {
    const r = req.query;
    const questId = r['questId'];
    if ([questId].includes(undefined))
        return jsonResponse(res, "Не удалось сериализовать json", codes.HTTP_INVALID_DATA)

    const questData = await checkQuestAuthor(res, questId, userId)
    if (!questData) return;

    const helpers = await DB.execute(sql.selectHelpersUserNamesByQuestId, [questId], true)
    return jsonResponse(res, {'helpers': helpers})
}));


app.post("/helpers", loginRequiredReturnId(async (req, res, next, userIdLogined) => {
    const r = req.body || {};
    const questId = r['questId'];
    let userId = r['userId'];
    const userName = r['name'];
    if ([questId].includes(undefined))
        return jsonResponse(res, "Не удалось сериализовать json", codes.HTTP_INVALID_DATA)

    if (!userId) {
        if (!userName)
            return jsonResponse(res, "Не удалось сериализовать json", codes.HTTP_INVALID_DATA)
        const user = await DB.execute(sql.selectUserByUsername, [userName])
        if (!user)
            return jsonResponse(res, "Пользователя не существует", codes.HTTP_NOT_FOUND)
        userId = user['id']
    }

    const questData = await checkQuestAuthor(res, questId, userIdLogined)
    if (!questData) return;

    let helper;
    try {
        helper = await DB.execute(sql.insertHelper, [userId, questId])
    } catch {
        return jsonResponse(res, "Пользователя не существует или уже настроен", codes.HTTP_DATA_CONFLICT)
    }
    return jsonResponse(res, helper)
}));


app.put("/helpers", loginRequiredReturnId(async (req, res, next, userIdLogined) => {
    const r = req.body || {};
    const id = r['id'];
    const questId = r['questId'];
    let userId = r['userId'];
    const userName = r['name'];
    if ([id, questId].includes(undefined))
        return jsonResponse(res, "Не удалось сериализовать json", codes.HTTP_INVALID_DATA)

    if (!userId) {
        if (!userName)
            return jsonResponse(res, "Не удалось сериализовать json", codes.HTTP_INVALID_DATA)
        const user = await DB.execute(sql.selectUserByUsername, [userName])
        if (!user)
            return jsonResponse(res, "Пользователя не существует", codes.HTTP_NOT_FOUND)
        userId = user['id']
    }

    const questData = await checkQuestAuthor(res, questId, userIdLogined)
    if (!questData) return;

    let helper;
    try {
        helper = await DB.execute(sql.updateHelperByIdQuestid, [userId, id, questId])
    } catch {
        return jsonResponse(res, "Пользователя не существует или уже настроен", codes.HTTP_DATA_CONFLICT)
    }
    return jsonResponse(res, helper)
}));


app.delete("/helpers", loginRequiredReturnId(async (req, res, next, userId) => {
    const r = req.body || {};
    const id = r['id'];
    if ([id].includes(undefined))
        return jsonResponse(res, "Не удалось сериализовать json", codes.HTTP_INVALID_DATA)

    const helper = await DB.execute(sql.selectHelperById, [id])
    const questId = helper['questid']

    const questData = await checkQuestAuthor(res, questId, userId)
    if (!questData) return;

    await DB.execute(sql.deleteHelperById, [id])
    return jsonResponse(res, "Запись доступа удалена")
}));


// ---- statistics ---
app.get("/users/finished", async (req, res) => {
    const r = req.query;
    const questId = r['questId'];
    if ([questId].includes(undefined))
        return jsonResponse(res, "Не удалось сериализовать json", codes.HTTP_INVALID_DATA)

    const players = await DB.execute(sql.selectFinishedQuestPLayersByQuestid, [questId], true)
    players.forEach((player) => {player['time'] = getSecondsFromPGInterval(player['time'])});
    return jsonResponse(res, {"players": players})
});


app.get("/users/progresses", async (req, res) => {
    const r = req.query;
    const questId = r['questId'];
    if ([questId].includes(undefined))
        return jsonResponse(res, "Не удалось сериализовать json", codes.HTTP_INVALID_DATA)

    const players = await DB.execute(sql.selectPLayersProgressesByQuestid, [questId], true)
    players.forEach((player) => {player['time'] = getSecondsFromPGInterval(player['time'])});
    return jsonResponse(res, {"players": players});
});


app.get("/progress/stats", loginRequiredReturnId(async (req, res, next, userId) => {
    const r = req.query;
    const branchId = r['branchId'];
    if ([branchId].includes(undefined))
        return jsonResponse(res, "Не удалось сериализовать json", codes.HTTP_INVALID_DATA)

    const stats = await DB.execute(sql.selectProgressStatsByUseridBranchid, [userId, branchId])
    stats['time'] = getSecondsFromPGInterval(stats['time']);
    return jsonResponse(res, stats);
}));


app.post("/rating", loginAndEmailConfirmationRequired(async (req, res, next, userData) => {
    const r = req.body || {};
    const branchId = r['branchId'];
    const rating = Number(r['rating']);
    if ([branchId, rating].includes(undefined))
        return jsonResponse(res, "Не удалось сериализовать json", codes.HTTP_INVALID_DATA)

    if (rating < 1 || rating > 5)
        return jsonResponse(res, "rating может быть только от 0 до 5", codes.HTTP_INVALID_DATA)

    const progress = await DB.execute(sql.updateProgressRatingByBranchidUserid, [rating, branchId, userData['id']], true)
    if (!progress)
        return jsonResponse(res, "Нет прав на голосование за рейтинг квеста", codes.HTTP_NO_PERMISSIONS)
    return jsonResponse(res, progress)
}));


app.get("/stats", async (req, res) => {
    const r = req.query;
    const questId = r['questId'];
    if ([questId].includes(undefined))
        return jsonResponse(res, "Не удалось сериализовать json", codes.HTTP_INVALID_DATA)

    const stats = await DB.execute(sql.selectQuestStatisticsByQuestid, [questId])
    if (!stats)
        return jsonResponse(res, "Квест не найден или в него пока никто не играл", codes.HTTP_NOT_FOUND)

    if (stats['time'])
        stats['time'] = getSecondsFromPGInterval(stats['time']);
    return jsonResponse(res, stats)
});
