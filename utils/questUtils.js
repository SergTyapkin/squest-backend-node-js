import {DB} from "../constants.js";
import sql from "../database/SQL_requests.js";
import {jsonResponse} from "./utils.js";
import codes from "../httpCodes.js";


async function _checkAuthor(sqlRequest, args, fieldName, toCompare, res, disableResWrite) {
    const questData = await DB.execute(sqlRequest, args);
    if (!questData) {
        if (!disableResWrite)
            jsonResponse(res, "Квеста не существует", codes.HTTP_NOT_FOUND);
        return null;
    }
    if (questData[fieldName] !== toCompare) {
        if (!disableResWrite)
            jsonResponse(res, "Вы не являетесь автором квеста", codes.HTTP_NO_PERMISSIONS);
        return null;
    }
    return questData;
}


async function _checkHelper(sqlRequest, args, res, disableResWrite) {
    const questData = await DB.execute(sqlRequest, args);
    if (!questData) {
        if (!disableResWrite)
            jsonResponse(res, "Вы не являетесь автором или соавтором квеста", codes.HTTP_NO_PERMISSIONS);
        return null;
    }
    questData['helper'] = true;
    return questData;
}


// ------------
async function _checkAuthorOrHelper(sqlRequestAuthor, argsAuthor, toCompare, allowHelpers, sqlRequestHelper, argsHelper, res, disableResWrite) {
    const result = await _checkAuthor(sqlRequestAuthor, argsAuthor, 'author', toCompare, res, disableResWrite);
    if (result === null && allowHelpers)
        return await _checkHelper(sqlRequestHelper, argsHelper, res, disableResWrite);
    return result;
}


// ------------
export async function checkQuestAuthor(res, questId, userId, allowHelpers=false, disableResWrite=false) {
    return await _checkAuthorOrHelper(
        sql.selectQuestById, [questId], userId,
        allowHelpers,
        sql.selectQuestByIdHelperid, [questId, userId],
        res, disableResWrite
    );
}

export async function checkBranchAuthor(res, branchId, userId, allowHelpers=false, disableResWrite=false) {
    return await _checkAuthorOrHelper(
        sql.selectQuestByBranchId, [branchId], userId,
        allowHelpers,
        sql.selectQuestByBranchidHelperId, [branchId, userId],
        res, disableResWrite
    );
}

export async function checkTaskAuthor(res, taskId, userId, allowHelpers=false, disableResWrite=false) {
    return await _checkAuthorOrHelper(
        sql.selectQuestByTaskId, [taskId], userId,
        allowHelpers,
        sql.selectQuestByTaskidHelperId, [taskId, userId],
        res, disableResWrite
    );
}
