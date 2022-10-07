import express from "express";
import {DB} from "../constants.js";
import sql from "../database/SQL_requests.js";
import {jsonResponse} from "../utils/utils.js";
import codes from "../httpCodes.js";
import {loginAndEmailConfirmationRequired, loginOrNullReturnId, loginRequiredReturnId} from "../utils/access.js";
import {checkBranchAuthor, checkQuestAuthor} from "../utils/questUtils.js";
import bodyParser from "body-parser";
import {corsMiddleware, errorMiddleware} from "../middleware.js";

const app = express();
app.use(bodyParser.json());
app.use(corsMiddleware);
app.use(errorMiddleware);
export default app;


app.get("", loginOrNullReturnId(async (req, res, next, userId) => {
    const r = req.query;
    const questId = r['questId'];
    const branchId = r['branchId'];

    // Нужно выдать ветку по id
    if (branchId !== undefined) {
        const branchData = await DB.execute(sql.selectQuestByBranchId, [branchId]);
        const isAuthor = await checkBranchAuthor(res, branchId, userId, true, true);
        // Если юзер залогинен и юзер - автор квеста ветки
        if (branchData?.ispublished || isAuthor) {
            // Добавим прогресс пользователя
            const progress = await DB.execute(sql.selectProgressByUseridBranchid, [userId, branchId]);
            branchData['progress'] = progress?.maxprogress || 0;
            // Добавим длину ветки
            const branchLength = await DB.execute(sql.selectBranchLengthById, [branchId]);
            branchData['length'] = Math.max(branchLength['length'] - 1, 0);
            return jsonResponse(res, branchData);
        } else {
            return jsonResponse(res, "Ветка не опубликована, а вы не автор", codes.HTTP_NO_PERMISSIONS);
        }
    // Нужно выдать все ветки квеста
    } else if (questId !== undefined) {
        let branchesResp;
        if (userId !== undefined && await checkQuestAuthor(res, questId, userId, true, true)) {  // Если юзер залогинен и юзер - автор квеста
            branchesResp = await DB.execute(sql.selectBranchesByQuestid, [questId], true);  // можно смотреть все ветки квеста
        } else {
            branchesResp = await DB.execute(sql.selectPublishedBranchesByQuestid, [questId], true);  // иначе - только опубликованные
        }
        return jsonResponse(res, {'branches': branchesResp});
    }
    // Не пришло ни одного id
    return jsonResponse(res, "Не удалось сериализовать json", codes.HTTP_INVALID_DATA);
}));


app.post("", loginAndEmailConfirmationRequired(async (req, res, next, userData) => {
    const r = req.body || {};
    const questId = r['questId'];
    const title = r['title'];
    const description = r['description'];
    if ([questId, title, description].includes(undefined))
        return jsonResponse(res, "Не удалось сериализовать json", codes.HTTP_INVALID_DATA);

    const questData = await checkQuestAuthor(res, questId, userData['id'], true);
    if (!questData) return;

    const branch = await DB.execute(sql.selectBranchMaxOrderidByQuestid, [questId]);
    const maxOrderId = branch['maxorderid'] || 0;

    const newBranch = await DB.execute(sql.insertBranch, [questId, title, description, maxOrderId + 1]);
    return jsonResponse(res, newBranch);
}));


app.post("/many", loginAndEmailConfirmationRequired(async (req, res, next, userData) => {
    const r = req.body || {};
    const questId = r['questId'];
    const branches = r['branches'];
    if ([questId, branches].includes(undefined))
        return jsonResponse(res, "Не удалось сериализовать json", codes.HTTP_INVALID_DATA);

    const questData = await checkQuestAuthor(res, questId, userData['id'], true);
    if (!questData) return;

    const branch = await DB.execute(sql.selectBranchMaxOrderidByQuestid, [questId]);
    const maxOrderId = branch['maxorderid'] || 0;

    const newBranches = [];
    for (const [idx, branch] of branches.entries()) {
        newBranches.push(await DB.execute(sql.insertBranch, [questId, branch['title'], branch['description'], maxOrderId + idx + 1]));
    }
    return jsonResponse(res, {'branches': newBranches});
}));


app.put("", loginRequiredReturnId(async (req, res, next, userId) => {
    const r = req.body || {};
    const branchId = r['id'];
    let orderId = r['orderId'];
    let title = r['title'];
    let description = r['description'];
    let isPublished = r['isPublished'];
    if ([branchId].includes(undefined))
        return jsonResponse(res, "Не удалось сериализовать json", codes.HTTP_INVALID_DATA);

    const branchData = await checkBranchAuthor(res, branchId, userId, true);
    if (!branchData) return;

    if (!title) title = branchData['title'];
    if (!description) description = branchData['description'];
    if (!isPublished) isPublished = branchData['ispublished'];
    if (!orderId) orderId = branchData['orderid'];

    const resp = await DB.execute(sql.updateBranchById, [orderId, title, description, isPublished, branchId]);
    return jsonResponse(res, resp);
}));


app.delete("", loginRequiredReturnId(async (req, res, next, userId) => {
    const r = req.body || {};
    const branchId = r['id'];
    if ([branchId].includes(undefined))
        return jsonResponse(res, "Не удалось сериализовать json", codes.HTTP_INVALID_DATA);

    const branchData = await checkBranchAuthor(branchId, userId, true);
    if (!branchData) return branchData;

    await DB.execute(sql.deleteBranchById, [branchId]);

    // Make orderids actual
    const questId = branchData['questid'];
    const resp = await DB.execute(sql.selectBranchesByQuestid, [questId], true);  // получаем все ветки
    for (const [branch, idx] of resp) {
        if (branch['orderid'] !== (idx + 1)) {
            resp[idx-1] = await DB.execute(sql.updateBranchOrderidById, [idx, branch['id']]);
        }
    }

    return jsonResponse(res, resp);
}));


app.put("/progress/reset", loginRequiredReturnId(async (req, res, next, userId) => {
    const r = req.body || {};
    const branchId = r['branchId'];
    if ([branchId].includes(undefined))
        return jsonResponse(res, "Не удалось сериализовать json", codes.HTTP_INVALID_DATA);

    const resp = await DB.execute(sql.updateProgressByUseridBranchid, [0, userId, branchId]);
    return jsonResponse(res, resp);
}));
