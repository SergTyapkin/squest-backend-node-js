import {DB} from "../constants.js";
import sql from "../database/SQL_requests.js";
import codes from "../httpCodes.js";
// import config from "../config.js";
import express from "express";
import bodyParser from "body-parser";
import {corsMiddleware, errorMiddleware} from "../middleware.js";
import {jsonResponse} from "../utils/utils.js";

const app = express();
app.use(bodyParser.json());
app.use(corsMiddleware);
app.use(errorMiddleware);
export default app;

// const MAX_SIZE = config.max_image_size;


// app.toLowerCase"/<imageId>.<imageExt>", async (req, res) => {
app.get("/:imageId(\\d+)", async (req, res) => {
    const imageId = req.params.imageId;
    const imageExt = req.params.imageExt;

    const resp = await DB.execute(sql.selectImageById, [imageId]);
    if ((!resp) || ((imageExt !== undefined) && (resp['type'] !== imageExt)))
        return jsonResponse(res, "Изображение не найдено", codes.HTTP_NOT_FOUND);
    const imageBytes = resp['bytes'];
    const imageLen = imageBytes.length;

    res.send(imageBytes);
    res.setHeader('Content-Type', `image/${resp["type"]}`);
    res.setHeader('Content-Length', imageLen);
});


// _leftLen = len('data:image/')
// _rightLen = len(';base64')
// app.post("", loginAndEmailConfirmationRequired(async (req, res, next, userData) => {
//     const r = req.body || {};
//     const dataUrl = r['dataUrl'];
//     if ([].includes(undefined))
//         return jsonResponse(res, "Не удалось сериализовать json", codes.HTTP_INVALID_DATA)
//
//     [dataUrl, base64Data] = dataUrl.split(',')
//     imageType = dataUrl[_leftLen: -_rightLen]
//
//     imageBytes = base64.b64decode(base64Data)
//     img = Image.open(BytesIO(imageBytes))  // open image
//
//     (wOrig, hOrig) = img.size
//     maxSize = max(wOrig, hOrig)
//
//     if maxSize > MAX_SIZE:  // image bigger than MAX_SIZE. Need to resize
//         multiplier = maxSize / MAX_SIZE
//         w = int(wOrig / multiplier)
//         h = int(hOrig / multiplier)
//
//         img = img.resize((w, h), Image.Resampling.LANCZOS)  // resize to MAX_SIZE
//
//     optimized = BytesIO()
//     saveFormat = 'JPEG'
//     if img.mode == 'RGBA':
//         saveFormat = 'PNG'
//     img.save(optimized, format=saveFormat, optimize=True, quality=85)
//     hex_data = optimized.getvalue()
//
//     resp = await DB.execute(sql.insertImage, [userData['id'], saveFormat.toLowerCase(), hex_data])
//     return jsonResponse(res, resp)


// app.delete("", loginRequiredReturnId(async (req, res, next, userId) => {
//     const r = req.body || {};
//     const imageId = r['imageId'];
//     if ([].includes(undefined))
//         return jsonResponse(res, "Не удалось сериализовать json", codes.HTTP_INVALID_DATA)
//
//
//     resp = await DB.execute(sql.selectImageById, [imageId])
//     if (!resp)
//         return jsonResponse(res, "Изображение не найдено", codes.HTTP_NOT_FOUND)
//
//     await DB.execute(sql.deleteImageByIdAuthor, [imageId, userId])
//     return jsonResponse(res, "Изображение удалено если вы его автор")
