import express from "express";
import {DB} from "../constants.js";
import sql from "../database/SQL_requests.js";
import { v4 as uuid4 } from 'uuid';
import {getCookie, hashSHA256, jsonResponse, randInt, sendMail} from "../utils/utils.js";
import codes from "../httpCodes.json" assert {type: 'json'};
import {loginOrNull, loginRequired, loginRequiredReturnId} from "../utils/access.js";
import * as emails from "../emailTemplates.js";
import bodyParser from "body-parser";
import {corsMiddleware, errorMiddleware} from "../middleware.js";


const app = express();
app.use(bodyParser.json());
app.use(corsMiddleware);
app.use(errorMiddleware);
export default app;


async function newSession(userData, res) {
  const tokenResp = await DB.execute(sql.selectSessionByUserId, [userData['id']]);
  let token, expires;
  if (tokenResp) {
    token = tokenResp['token'];
    expires = tokenResp['expires'];
  } else {
    token = uuid4();
    const hoursAlive = 24 * 7; // 7 days
    const session = await DB.execute(sql.insertSession, [userData['id'], token, hoursAlive]);
    expires = session['expires'];
  }

  await DB.execute(sql.deleteExpiredSessions);

  res.cookie("session_token", token, {expires: expires, httpOnly: true, sameSite: "lax"});
  jsonResponse(res, userData);
}


async function newSecretCode(userId, type, hours=1) {
  await DB.execute(sql.deleteExpiredSecretCodes)

  const secretCode = await DB.execute(sql.selectSecretCodeByUserIdType, [userId, type])
  if (secretCode)
    return secretCode['code'];

  // create new
  let code;
  if (type === "login") {
    code = '00000' + randInt(1, 999999);
    code = code.substring(code.length - 6);
  } else {
    code = uuid4();
  }

  await DB.execute(sql.insertSecretCode, [userId, code, type, hours]);

  return code;
}


app.post("/auth", async (req, res) => {
  const r = req.body || {};
  const username = r['username'];
  const password = r['password'];
  if ([username, password].includes(undefined))
    return jsonResponse(res, "Не удалось сериализовать json", codes.HTTP_INVALID_DATA)

  const passwordHash = hashSHA256(password);

  const userData = await DB.execute(sql.selectUserByUsernamePassword, [username, passwordHash])
  if (!userData)
    return jsonResponse(res, "Неверные логин или пароль", codes.HTTP_INVALID_AUTH_DATA)

  await newSession(userData, res);
});


app.delete("/session", async (req, res) => {
  const token = getCookie(req, 'session_token');
  if (!token)
    return jsonResponse(res, "Вы не вошли в аккаунт", codes.HTTP_NO_PERMISSIONS)

  try {
    await DB.execute(sql.deleteSessionByToken, [token])
  } catch (e) {
    return jsonResponse(res, "Сессия не удалена", codes.HTTP_INTERNAL_ERROR)
  }
  res.clearCookie("session_token");
  jsonResponse(res, "Вы вышли из аккаунта");
});


app.get("", loginOrNull(async (req, res, next, userData) => {
  const r = req.query;
  const userId = r['id'];

  async function addRating(obj, id) {
    const ratings = await DB.execute(sql.selectRatings, [], true)
    let positionDecrease = 0;
    const idx = ratings.findIndex((rating) => {
      if (rating['rating'] === null)
        positionDecrease += 1

      return rating['id'].toString() === id.toString();
    });
    if (idx !== -1) {
      obj['rating'] = ratings[idx]['rating'] || 0
      obj['position'] = idx + 1 - positionDecrease
      return;
    }
    obj['rating'] = 0
    obj['position'] = ratings.length;
  }

  async function addQuestsInfo(obj, id) {
    const createdQuests = await DB.execute(sql.selectCreatedQuestsByUserid, [id], true)
    const completedBranches = await DB.execute(sql.selectCompletedBranchesByUserid, [id], true)
    obj['createdquests'] = createdQuests;
    obj['completedbranches'] = completedBranches;
  }

  if (userId === undefined) {  // return self user data
    if (!userData)
      return jsonResponse(res, "Не авторизован", codes.HTTP_INVALID_AUTH_DATA);
    await addRating(userData, userData['id'])
    await addQuestsInfo(userData, userData['id'])
    return jsonResponse(res, userData)
  }

  // get another user data
  const user = await DB.execute(sql.selectAnotherUserById, [userId])
  if (!user)
    return jsonResponse(res, "Пользователь не найден", codes.HTTP_NOT_FOUND)
  await addRating(user, userId)
  await addQuestsInfo(user, userId)
  return jsonResponse(res, user)
}));



app.post("", async (req, res) => {
  const r = req.body || {};
  const username = r['username'];
  const name = r['name'];
  let password = r['password'];
  let email = r['email'];
  if ([username, name, password].includes(undefined))
    return jsonResponse(res, "Не удалось сериализовать json", codes.HTTP_INVALID_DATA)

  if (email) email = email.trim().toLowerCase();
  password = hashSHA256(password);

  let user;
  try {
    user = await DB.execute(sql.insertUser, [username, password, email, name])
  } catch (e) {
    return jsonResponse(res, "Имя пользователя или email заняты", codes.HTTP_DATA_CONFLICT)
  }

  await newSession(user, res);
});


app.put("", loginRequired(async (req, res, next, userData) => {
  const r = req.body || {};
  let username = r['username'];
  let name = r['name'];
  let email = r['email'];
  let avatarImageId = r['avatarImageId'];

  if (email) email = email.trim().toLowerCase();

  if (name === undefined) name = userData['name']
  if (username === undefined) username = userData['username']
  if (email === undefined) email = userData['email']
  if (avatarImageId === undefined) avatarImageId = userData['avatarimageid']

  let updatedUser;
  try {
    updatedUser = await DB.execute(sql.updateUserById, [username, name, email, avatarImageId, userData['id']])
  } catch (e) {
    return jsonResponse(res, "Имя пользователя или email заняты", codes.HTTP_DATA_CONFLICT)
  }
  jsonResponse(res, updatedUser)
}));


app.delete("", loginRequiredReturnId(async (req, res, next, userId) => {
  await DB.execute(sql.deleteUserById, [userId])
  return jsonResponse(res, "Пользователь удален")
}));


app.put("/password", loginRequiredReturnId(async (req, res, next, userId) => {
  const r = req.body || {};
  let oldPassword = r['oldPassword'];
  let newPassword = r['newPassword'];
  if ([oldPassword, newPassword].includes(undefined))
    return jsonResponse(res, "Не удалось сериализовать json", codes.HTTP_INVALID_DATA)

  oldPassword = hashSHA256(oldPassword);
  newPassword = hashSHA256(newPassword);

  const user = await DB.execute(sql.updateUserPasswordByIdPassword, [newPassword, userId, oldPassword])
  if (!user)
    return jsonResponse(res, "Старый пароль не такой", codes.HTTP_INVALID_AUTH_DATA)

  return jsonResponse(res, "Успешно обновлено")
}));


app.post("/password/restore", async (req, res) => {
  const r = req.body || {};
  let email = r['email'];
  if ([email].includes(undefined))
    return jsonResponse(res, "Не удалось сериализовать json", codes.HTTP_INVALID_DATA)

  email = email.trim().toLowerCase()

  const userData = await DB.execute(sql.selectUserByEmail, [email])
  if (!userData)
    return jsonResponse(res, "На этот email не зарегистрирован ни один аккаунт", codes.HTTP_NOT_FOUND)

  const secretCode = await newSecretCode(userData['id'], "password")

  await sendMail(
    "Восстановление пароля на SQuest",
    emails.restorePassword(`/image/${userData['avatarimageid']}`, userData['name'], secretCode),
    email
  );

  return jsonResponse(res, "Ссылка для восстановления выслана на почту " + email)
});


app.put("/password/restore", async (req, res) => {
  const r = req.body || {};
  let newPassword = r['newPassword'];
  const code = r['code'];
  if ([newPassword, code].includes(undefined))
    return jsonResponse(res, "Не удалось сериализовать json", codes.HTTP_INVALID_DATA)

  newPassword = hashSHA256(newPassword)

  const userData = await DB.execute(sql.updateUserPasswordBySecretcodeType, [newPassword, code, "password"])
  if (!userData)
    return jsonResponse(res, "Код восстановления не найден", codes.HTTP_NOT_FOUND)

  await DB.execute(sql.deleteSecretCodeByUseridCode, [userData['id'], code])
  jsonResponse(res, "Пароль изменен")
});


app.post("/auth/code", async (req, res) => {
  const r = req.body || {};
  let email = r['email'];
  const code = r['code'];
  if ([email].includes(undefined))
    return jsonResponse(res, "Не удалось сериализовать json", codes.HTTP_INVALID_DATA)

  email = email.trim().toLowerCase()

  if (code === undefined) {
    const userData = await DB.execute(sql.selectUserByEmail, [email])
    if (!userData)
      return jsonResponse(res, "На этот email не зарегистрирован ни один аккаунт", codes.HTTP_NOT_FOUND)
    if (!userData['isconfirmed'])
      return jsonResponse(res, "Этот email не подтвержден в соответствующем аккаунте", codes.HTTP_NO_PERMISSIONS)

    const secretCode = await newSecretCode(userData['id'], "login")

    await sendMail(
      "Вход на SQuest",
      emails.loginByCode(`/image/${userData['avatarimageid']}`, userData['name'], secretCode),
      email
    )

    jsonResponse(res, "Код выслан на почту " + email)
    return;
  }

  const userData = await DB.execute(sql.selectUserByEmailCodeType, [email, code, "login"])
  if (!userData)
    return jsonResponse(res, "Неверные email или одноразовый код", codes.HTTP_INVALID_AUTH_DATA)

  await newSession(userData, res)
});


app.post("/email/confirm", loginRequired(async (req, res, next, userData) => {
  const email = userData['email'];

  userData = await DB.execute(sql.selectUserByEmail, [email])
  if (!userData)
    return jsonResponse(res, "На этот email не зарегистрирован ни один аккаунт", codes.HTTP_NOT_FOUND)

  const secretCode = await newSecretCode(userData['id'], "email", 24)

  await sendMail(
    "Подтверждение регистрации на SQuest",
    emails.confirmEmail(`/image/${userData['avatarimageid']}`, userData['name'], secretCode),
    email
  );

  return jsonResponse(res, "Ссылка для подтверждения email выслана на почту " + email)
}));


app.put("/email/confirm", async (req, res) => {
  const r = req.body || {};
  const code = r['code'];
  if ([code].includes(undefined))
    return jsonResponse(res, "Не удалось сериализовать json", codes.HTTP_INVALID_DATA)

  const user = await DB.execute(sql.updateUserConfirmationBySecretcodeType, [code, "email"])
  if (!user)
    return jsonResponse(res, "Неверный одноразовый код", codes.HTTP_INVALID_AUTH_DATA)

  return jsonResponse(res, "Адрес email подтвержден")
});
