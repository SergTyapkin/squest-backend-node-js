import express from "express";
import {DB} from "../constants.js";
import sql from "../database/SQL_requests.js";
import {jsonResponse} from "../utils/utils.js";
import codes from "../httpCodes.json" assert {type: 'json'};
import {loginAndEmailConfirmationRequired, loginRequired, loginRequiredReturnId} from "../utils/access.js";
import {checkBranchAuthor, checkQuestAuthor, checkTaskAuthor} from "../utils/questUtils.js";
import bodyParser from "body-parser";
import {corsMiddleware, errorMiddleware} from "../middleware.js";

const app = express();
app.use(bodyParser.json());
app.use(corsMiddleware);
app.use(errorMiddleware);
export default app;


app.get("", loginRequiredReturnId(async (req, res, next, userId) => {
    const r = req.query;
    const taskId = r['taskId'];
    const branchId = r['branchId'];

    // Нужно выдать таск по id
    if (taskId !== undefined) {
        const taskData = await checkTaskAuthor(res, taskId, userId, true)
        if (!taskData) return;

        return jsonResponse(res, taskData)
        // Нужно выдать все таски ветки
    } else if (branchId !== undefined) {
        // Можно смотреть только если юзер залогинен и юзер - автор ветки
        if (userId === null || !await checkBranchAuthor(res, branchId, userId, true, true))
            return jsonResponse(res, "Вы не являетесь автором ветки", codes.HTTP_NO_PERMISSIONS)
        const tasks = await DB.execute(sql.selectTasksByBranchid, [branchId], true)  // можно смотреть все ветки квеста
        return jsonResponse(res, {'tasks': tasks})
    }
    // Не пришло ни одного id
    return jsonResponse(res, "Не удалось сериализовать json", codes.HTTP_INVALID_DATA)
}));



async function getOrCreateUserProgress(userData) {
    const resp = await DB.execute(sql.selectProgressByUseridBranchid, [userData['id'], userData['chosenbranchid']])
    let progress = resp?.progress;
    if (progress === undefined) {  // прогресса нет - надо создать нулевой прогресс
        const resp = await DB.execute(sql.insertProgress, [userData['id'], userData['chosenbranchid']])
        progress = resp['progress'];
    }
    return progress
}


app.get("/play", loginRequired(async (req, res, next, userData) => {
    if (userData['chosenbranchid'] === null || userData['chosenquestid'] === null)
        return jsonResponse(res, "Квест или ветка не выбраны", codes.HTTP_INVALID_DATA)

    const questResp = await DB.execute(sql.selectQuestById, [userData['chosenquestid']])
    const isAuthor = await checkQuestAuthor(res, questResp['id'], userData['id'], true, true)
    const branchResp = await DB.execute(sql.selectBranchLengthById, [userData['chosenbranchid']])
    if (Number(branchResp['length']) === 0)
        return jsonResponse(res, "В ветке нет заданий", codes.HTTP_INVALID_DATA)

    // Можно получить только последний таск в выбранной ветке и квесте только если
    // ветка и квест опубликованы или юзер - автор
    if ((isAuthor === null) && (!questResp['ispublished'] || !branchResp['ispublished']))
        return jsonResponse(res, "Выбранный квест или ветка не опубликованы, а вы не автор", codes.HTTP_NO_PERMISSIONS)

    const progress = await getOrCreateUserProgress(userData)

    const resp = await DB.execute(sql.selectTaskByBranchidNumber, [userData['chosenbranchid'], progress])
    // Добавим к ответу названия квеста и ветки
    resp['questtitle'] = questResp['title']
    resp['branchtitle'] = branchResp['title']
    // Добавим к ответу прогресс и общую длину ветки
    resp['progress'] = progress
    resp['length'] = Math.max(branchResp['length'] - 1, 0)

    // Определим кол-во заданий, и уберем поле question, если задание - последнее
    const maxOrderid = await DB.execute(sql.selectTaskMaxOrderidByBranchid, [userData['chosenbranchid']])
    if (maxOrderid['maxorderid'] === resp['orderid'])
        delete resp['question']

    return jsonResponse(res, resp)
}));


app.post("/play", loginRequired(async (req, res, next, userData) => {
    const r = req.body || {};
    let userAnswer = r['answer'];
    if ([userAnswer].includes(undefined))
        return jsonResponse(res, "Не удалось сериализовать json", codes.HTTP_INVALID_DATA)

    userAnswer = userAnswer.toLowerCase();

    const progress = await getOrCreateUserProgress(userData)

    const task = await DB.execute(sql.selectTaskAnswersByBranchidNumber, [userData['chosenbranchid'], progress])
    for (const answer of task['answers']) {
        if (answer === userAnswer || answer === '*') {  // если настроен ответ '*' - принимается любой ответ
            const resp = await DB.execute(sql.increaseProgressByUseridBranchid, [userData['id'], userData['chosenbranchid']])
            return jsonResponse(res, resp)
        }
    }

    return jsonResponse(res, "Ответ неверен", codes.HTTP_ANSWER_MISS)
}));


app.post("", loginAndEmailConfirmationRequired(async (req, res, next, userData) => {
    const r = req.body || {};
    const branchId = r['branchId'];
    const title = r['title'];
    const description = r['description'];
    const question = r['question'];
    let answers = r['answers'];
    if ([branchId, title, description, question, answers].includes(undefined))
        return jsonResponse(res, "Не удалось сериализовать json", codes.HTTP_INVALID_DATA)

    answers = answers.map((answer) => answer.toLowerCase());

    const branchData = await checkBranchAuthor(res, branchId, userData['id'], true)
    if (!branchData) return;

    const resp = await DB.execute(sql.selectTaskMaxOrderidByBranchid, [branchId])
    const maxOrderId = resp['maxorderid'] || 0

    const newTask = await DB.execute(sql.insertTask, [branchId, title, description, question, answers, maxOrderId + 1])
    return jsonResponse(res, newTask)
}));


app.post("/many", loginAndEmailConfirmationRequired(async (req, res, next, userData) => {
    const r = req.body || {};
    const branchId = r['branchId'];
    const tasks = r['tasks'];
    if ([branchId, tasks].includes(undefined))
        return jsonResponse(res, "Не удалось сериализовать json", codes.HTTP_INVALID_DATA)

    const branchData = await checkBranchAuthor(res, branchId, userData['id'], true)
    if (!branchData) return;

    const resp = await DB.execute(sql.selectTaskMaxOrderidByBranchid, [branchId])
    const maxOrderId = resp['maxorderid'] || 0

    const newTasks = []
    for (const [idx, task] of tasks.entries()) {
        newTasks.push(await DB.execute(sql.insertTask, [branchId, task['title'], task['description'], task['question'], task['answers'], maxOrderId + idx + 1]));
    }
    return jsonResponse(res, {'tasks': newTasks})
}));


app.put("", loginRequiredReturnId(async (req, res, next, userId) => {
    const r = req.body || {};
    const taskId = r['id'];
    let orderId = r['orderId'];
    let title = r['title'];
    let description = r['description'];
    let question = r['question'];
    let answers = r['answers'];
    let isQrAnswer = r['isQrAnswer'];
    if ([taskId].includes(undefined))
        return jsonResponse(res, "Не удалось сериализовать json", codes.HTTP_INVALID_DATA)

    const taskData = await checkTaskAuthor(res, taskId, userId, true)
    if (!taskData) return;

    if (!title)  title = taskData['title']
    if (!question)  question = taskData['question']
    if (answers !== undefined)
        answers = answers.map((answer) => answer.toLowerCase());
    else
        answers = taskData['answers']
    if (!description)  description = taskData['description']
    if (!orderId)  orderId = taskData['orderid']
    if (!isQrAnswer)  isQrAnswer = taskData['isqranswer']

    const resp = await DB.execute(sql.updateTaskById, [orderId, title, description, question, answers, isQrAnswer, taskId])
    return jsonResponse(res, resp)
}));


app.delete("", loginRequiredReturnId(async (req, res, next, userId) => {
    const r = req.body || {};
    const taskId = r['id'];
    if ([taskId].includes(undefined))
        return jsonResponse(res, "Не удалось сериализовать json", codes.HTTP_INVALID_DATA)

    const taskData = await checkTaskAuthor(res, taskId, userId, true)
    if (!taskData) return;

    await DB.execute(sql.deleteTaskById, [taskId])

    // Make orderids actual
    const branchId = taskData['branchid']
    const resp = await DB.execute(sql.selectTasksByBranchid, [branchId], true)  // получаем все ветки
    for (const [task, idx] of resp) {
        if (task['orderid'] !== (idx + 1)) {
            resp[idx - 1] = await DB.execute(sql.updateTaskOrderidById, [idx, task['id']])
        }
    }
    return jsonResponse(res, resp)
}));
