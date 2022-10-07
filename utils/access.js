import {DB} from "../constants.js";
import sql from "../database/SQL_requests.js";
import {getCookie, jsonResponse} from "./utils.js";
import codes from "../httpCodes.json" assert {type: 'json'};


async function getLoginedUserid(req) {
    const token = getCookie(req, 'session_token');
    if (token === null)
        return '';
    const session = await DB.execute(sql.selectUserIdBySessionToken, [token])
    if (!session)
        return ''
    return session['userid']
}

async function getLoginedUser(req) {
    const token = getCookie(req, 'session_token')
    if (token === null)
        return null;
    const userData = await DB.execute(sql.selectUserDataBySessionToken, [token])
    if (!userData)
        return null
    return userData;
}


export function loginRequired(callback) {
    return async (req, res, next, ...args) => {
        const userData = await getLoginedUser(req);
        if (!userData)
            return jsonResponse(res, "Не авторизован", codes.HTTP_INVALID_AUTH_DATA)
        return await callback(req, res, next, ...args, userData);
    }
}


export function loginAndEmailConfirmationRequired(callback) {
    return async (req, res, next, ...args) => {
        const userData = await getLoginedUser(req);
        if (!userData)
            return jsonResponse(res, "Не авторизован", codes.HTTP_INVALID_AUTH_DATA)
        if (!userData['isconfirmed'])
            return jsonResponse(res, "EMail не подтвержден", codes.HTTP_NO_PERMISSIONS)
        return await callback(req, res, next, ...args, userData);
    }
}


export function loginRequiredReturnId(callback) {
    return async (req, res, next, ...args) => {
        const userId = await getLoginedUserid(req);
        if (!userId)
            return jsonResponse(res, "Не авторизован", codes.HTTP_INVALID_AUTH_DATA)
        return await callback(req, res, next, ...args, userId);
    }
}


export function loginRequiredAdmin(callback) {
    return async (req, res, next, ...args) => {
        const userData = await getLoginedUser(req);
        if (!userData)
            return jsonResponse(res, "Не авторизован", codes.HTTP_INVALID_AUTH_DATA)
        if (!userData['isadmin'])
            return jsonResponse(res, "Нет прав админа", codes.HTTP_NO_PERMISSIONS)
        return await callback(req, res, next, ...args, userData);
    }
}


export function loginOrNull(callback) {
    return async (req, res, next, ...args) => {
        let userData = await getLoginedUser(req);
        if (!userData)
            userData = null
        return await callback(req, res, next, ...args, userData);
    }
}


export function loginOrNullReturnId(callback) {
    return async (req, res, next, ...args) => {
        let userId = await getLoginedUserid(req);
        if (!userId)
            userId = null
        return await callback(req, res, next, ...args, userId);
    }
}
