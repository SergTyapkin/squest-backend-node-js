import codes from "../httpCodes.js";
import mailer from "nodemailer";
import config from "../config.js";
import * as crypto from "crypto";


export function jsonResponse(res, data, code=codes.HTTP_OK) {
    res.status(code);
    if (typeof data === 'string') {
        data = {'info': data};
    }
    res.json(data);
}

export function randInt(min, max) {
    // min and max included
    return Math.floor(Math.random() * (max - min + 1) + min);
}

export function getCookie(req, cookieName) {
    const str = req.headers.cookie;
    if (str === undefined)
        return null;
    const splitted = str.split('; ');
    const cookieRegExp = new RegExp(`^${cookieName}=`);
    const curCookieStr = splitted.find((cookieStr) => cookieStr.match(cookieRegExp));
    if (curCookieStr === undefined)
        return null;

    const curCookieVal = curCookieStr.substring((cookieName + '=').length);
    return curCookieVal;
}

export function hashSHA256(str) {
    return crypto.createHash(
        'sha256'
    ).update(str).digest(
        'hex'
    );
}


export async function sendMail(title, html, targetEmail) {
    // Use Smtp Protocol to send Email
    const smtpTransport = mailer.createTransport({
        service: "Gmail",
        auth: {
            user: config.mail_username,
            pass: config.mail_password
        }
    });

    const mail = {
        from: config.mail_username,
        to: targetEmail,
        subject: title,
        text: "",
        html: html
    };

    await smtpTransport.sendMail(mail, (error, response) => {
        if (error) {
            console.log("Ошибка при отправке e-mail:", error);
            console.log("Ответ от сервера:", response);
            throw Error("Ошибка при отправке e-mail");
        }

        smtpTransport.close();
    });
}

export function getSecondsFromPGInterval(pgInterval) {
    const iso = pgInterval.toISO();
    const arr = iso.split(/[PYM(DT)HMS]/);
    let seconds = 0;
    seconds += Number(arr[1]) * 60 * 60 * 24 * 30 * 12; // year
    seconds += Number(arr[2]) * 60 * 60 * 24 * 30; // month
    seconds += Number(arr[3]) * 60 * 60 * 24; // day
    seconds += Number(arr[5]) * 60 * 60; // hour
    seconds += Number(arr[6]) * 60; // min
    seconds += Number(arr[7]); // sec

    return seconds;
}
