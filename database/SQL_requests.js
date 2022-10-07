// -----------------------
// -- Default user part --
// -----------------------
const _userColumns = `users.id, name, username, email, isadmin, joineddate, isconfirmed, avatarimageid, chosenquestid, chosenbranchid`;

// ----- INSERTS -----
export default {
    insertUser: `
        INSERT INTO users (username, password, avatarImageId, email, name, ChosenQuestId, ChosenBranchId)
        VALUES ($1, $2, NULL, $3, $4, NULL, NULL)
        RETURNING ${_userColumns}`,

    insertSession: `
        INSERT INTO sessions (userId, token, expires)
        VALUES ($1, $2, NOW() + interval '1 hour' * $3)
        RETURNING *`,

    insertSecretCode: `
        INSERT INTO secretCodes (userId, code, type, expires)
        VALUES ($1, $2, $3, NOW() + interval '1 hour' * $4)
        RETURNING *`,

    // ----- SELECTS -----
    selectUserByUsernamePassword: `
        SELECT ${_userColumns} FROM users
        WHERE username = $1 AND password = $2`,

    selectUserById: `
        SELECT ${_userColumns} FROM users
        WHERE id = $1`,

    selectAnotherUserById: `
        SELECT users.id, name, username, joineddate, avatarImageId, chosenbranchid, chosenquestid, quests.title as chosenQuest, branches.title as chosenBranch FROM users
        LEFT JOIN quests ON users.chosenquestid = quests.id
        LEFT JOIN branches ON users.chosenbranchid = branches.id
        WHERE users.id = $1`,

    selectCreatedQuestsByUserid: `
        SELECT quests.id, quests.title FROM users
        JOIN quests ON users.id = quests.author
        WHERE users.id = $1`,

    selectCompletedBranchesByUserid: `
        SELECT branches.id as branchid, branches.title as branchtitle, quests.id as questid, quests.title as questtitle FROM users
        LEFT JOIN progresses ON progresses.userid = users.id
        LEFT JOIN branches ON progresses.branchid = branches.id
        LEFT JOIN quests ON branches.questid = quests.id
        WHERE users.id = $1 AND progresses.isfinished = True`,

    selectUserByUsername: `
        SELECT ${_userColumns} FROM users
        WHERE username = $1`,

    selectUserByEmail: `
        SELECT ${_userColumns} FROM users
        WHERE email = $1`,

    selectUserIdBySessionToken: `
        SELECT userId FROM sessions
        WHERE token = $1`,

    selectSessionByUserId: `
        SELECT token, expires FROM sessions
        WHERE userId = $1`,

    selectUserDataBySessionToken: `
        SELECT ${_userColumns}, quests.title as chosenQuest, branches.title as chosenBranch FROM sessions
        JOIN users ON sessions.userId = users.id
        LEFT JOIN quests ON users.chosenquestid = quests.id
        LEFT JOIN branches ON users.chosenbranchid = branches.id
        WHERE token = $1`,

    selectSecretCodeByUserIdType: `
        SELECT * FROM secretCodes
        WHERE userId = $1 AND
        type = $2 AND
        expires > NOW()`,

    selectUserByEmailCodeType: `
        SELECT users.id, name, username, joineddate, avatarImageId, chosenbranchid, chosenquestid FROM users
        JOIN secretCodes ON secretCodes.userId = users.id
        WHERE email = $1 AND
        code = $2 AND
        type = $3 AND
        expires > NOW()`,

    // ----- UPDATES -----
    updateUserById: `
        UPDATE users SET
        username = $1,
        name = $2,
        email = $3,
        avatarImageId = $4
        WHERE id = $5
        RETURNING *`,

    updateUserPasswordByIdPassword: `
        UPDATE users SET
        password = $1
        WHERE id = $2 AND password = $3
        RETURNING id`,

    updateUserPasswordBySecretcodeType: `
        UPDATE users
        SET password = $1
        FROM secretCodes
        WHERE secretCodes.userId = users.id AND
        secretCodes.code = $2 AND
        secretCodes.type = $3
        RETURNING users.*`,


    updateUserConfirmationBySecretcodeType: `
        UPDATE users
        SET isConfirmed = True
        FROM secretCodes
        WHERE secretCodes.userId = users.id AND
        secretCodes.code = $1 AND
        secretCodes.type = $2
        RETURNING users.*`,

    // ----- DELETES -----
    deleteExpiredSessions: `
        DELETE FROM sessions
        WHERE expires <= NOW()`,

    deleteUserById: `
        DELETE FROM users
        WHERE id = $1`,

    deleteSessionByToken: `
        DELETE FROM sessions
        WHERE token = $1`,

    deleteExpiredSecretCodes: `
        DELETE FROM secretCodes
        WHERE expires <= NOW()`,

    deleteSecretCodeByUseridCode: `
        DELETE FROM secretCodes
        WHERE userId = $1 AND
        code = $2`,

    // -----------------
    // -- Quests part --
    // -----------------

    // ----- INSERTS -----
    insertQuest: `
        INSERT INTO quests (uid, title, description, author, isPublished)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *`,

    insertProgress: `
        INSERT INTO progresses (userId, branchId)
        VALUES ($1, $2)
        RETURNING *`,

    insertHelper: `
        INSERT INTO questsHelpers (userId, questId)
        VALUES ($1, $2)
        RETURNING *`,

    insertBranch: `
        INSERT INTO branches (questId, title, description, orderid)
        VALUES ($1, $2, $3, $4)
        RETURNING *`,

    insertTask: `
        INSERT INTO tasks (branchId, title, description, question, answers, orderid)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *`,

    // ----- SELECTS -----
    selectPublishedQuestsByAuthorUserid: `
        SELECT id, author, title, description, isPublished, previewUrl FROM quests
        WHERE author = $1 AND (
           isPublished = true OR
           (id IN
              (SELECT questid FROM questshelpers
                  JOIN users on questshelpers.userid = users.id
                  WHERE userid = $2
              )
           )
        )`,

    selectQuestById: `
        SELECT quests.id, uid, author, title, description, isPublished, isLinkActive, previewUrl, users.username as authorName
        FROM quests LEFT JOIN users ON quests.author = users.id
        WHERE quests.id = $1`,

    selectPublishedQuestById: `
        SELECT quests.id, author, title, description, isPublished, previewUrl, users.username as authorName
        FROM quests JOIN users ON quests.author = users.id
        WHERE quests.id = $1
        AND ispublished = true`,

    selectQuestByUid: `
        SELECT quests.id, author, title, description, isPublished, previewUrl, users.username as authorName
        FROM quests LEFT JOIN users ON quests.author = users.id
        WHERE uid = $1
        AND islinkactive = true`,

    selectQuestUidById: `
        SELECT uid FROM quests
        WHERE id = $1`,

    selectQuestByIdHelperid: `
        SELECT quests.id, author, title, description, isPublished, isLinkActive, previewUrl, users.username as authorName
        FROM quests LEFT JOIN users ON quests.author = users.id
        LEFT JOIN questshelpers on quests.id = questshelpers.questid
        WHERE quests.id = $1 AND questshelpers.userid = $2`,

    selectHelpersUserNamesByQuestId: `
        SELECT users.username as name, questsHelpers.id as id FROM questsHelpers
        JOIN users ON userId = users.id
        WHERE questId = $1`,

    selectHelperById: `
        SELECT * FROM questsHelpers
        WHERE id = $1`,

    // выбрать все квесты
    // 1. где ты автор
    // 2. где ты в соавторах
    selectEditableQuestsByUseridx2: `
        SELECT quests.id, author, title, description, ispublished, islinkactive, previewUrl, users.username as authorName, True as canEdit
        FROM quests JOIN users ON quests.author = users.id
        WHERE
        (author = $1) OR
        (quests.id IN
           (SELECT questid FROM questshelpers
               JOIN users on questshelpers.userid = users.id
               WHERE userid = $2
           )
        )`,

    selectPublishedQuests: `
        SELECT quests.id, author, title, description, isPublished, isLinkActive, previewUrl, users.username as authorName
        FROM quests JOIN users ON quests.author = users.id
        WHERE ispublished = True`,

    selectPublishedQuestsByUserid: `
        SELECT id, author, title, description, ispublished FROM quests
        WHERE isPublished = true OR quests.author = $1`,

    selectPublishedBranchesByQuestid: `
        SELECT * FROM branches
        WHERE ispublished = true AND questid = $1
        ORDER BY orderid`,

    selectBranchesByQuestid: `
        SELECT * FROM branches
        WHERE questId = $1
        ORDER BY orderid`,

    selectBranchById: `
        SELECT * FROM branches
        WHERE id = $1`,

    selectBranchLengthById: `
        SELECT branches.*, count(tasks.id) as length FROM tasks
        RIGHT JOIN branches ON tasks.branchid = branches.id
        WHERE branches.id = $1
        GROUP BY branches.id`,

    selectBranchMaxOrderidByQuestid: `
        SELECT max(orderid) as maxorderid FROM branches
        WHERE questid = $1`,

    selectTaskMaxOrderidByBranchid: `
        SELECT max(orderid) as maxorderid FROM tasks
        WHERE branchid = $1`,

    selectQuestByBranchId: `
        SELECT branches.*, quests.author, quests.ispublished as qispublished, quests.title as qtitle FROM quests
        JOIN branches ON branches.questId = quests.id
        WHERE branches.id = $1`,

    selectQuestByBranchidHelperId: `
        SELECT branches.*, quests.author, quests.ispublished as qispublished, quests.title as qtitle FROM quests
        JOIN branches ON branches.questId = quests.id
        LEFT JOIN questshelpers on quests.id = questshelpers.questid
        WHERE branches.id = $1 AND questshelpers.userid = $2`,

    selectQuestByTaskId: `
        SELECT tasks.*, branches.ispublished as bispublished, branches.title as btitle, quests.author, quests.ispublished as qispublished FROM tasks
        JOIN branches ON tasks.branchid = branches.id
        JOIN quests ON branches.questid = quests.id
        WHERE tasks.id = $1`,

    selectQuestByTaskidHelperId: `
        SELECT tasks.*, branches.ispublished as bispublished, branches.title as btitle, quests.author, quests.ispublished as qispublished FROM tasks
        JOIN branches ON tasks.branchid = branches.id
        JOIN quests ON branches.questid = quests.id
        LEFT JOIN questshelpers on quests.id = questshelpers.questid
        WHERE tasks.id = $1 AND questshelpers.userid = $2`,


    selectTasksByBranchid: `
        SELECT * FROM tasks
        WHERE branchid = $1
        ORDER BY orderid`,

    selectTasksByPublishedBranchid: `
        SELECT tasks.id, tasks.title, tasks.description, tasks.question FROM tasks
        JOIN branches ON tasks.branchid = branches.id
        JOIN quests ON branches.questid = quests.id
        WHERE branchid = $1 AND quests.isPublished = true AND branches.isPublished = true`,

    selectTaskByBranchidNumber: `
        SELECT id, orderid, title, description, question, isqranswer FROM tasks
        WHERE branchid = $1
        ORDER BY orderid
        OFFSET $2 LIMIT 1`,

    selectTaskAnswersByBranchidNumber: `
        SELECT answers FROM tasks
        WHERE branchid = $1
        ORDER BY orderid
        OFFSET $2 LIMIT 1`,

    selectProgressByUseridBranchid: `
        SELECT * FROM progresses
        WHERE userid = $1 AND branchid = $2`,

    selectProgressStatsByUseridBranchid: `
        SELECT ratingvote as rating, finished - started as time FROM progresses
        WHERE userid = $1 AND branchid = $2`,

    // строка с WHERE нужна для удаления рейтингов авторов и хелперов в своих же квестах
    selectRatings: `
        SELECT sum(progresses.maxprogress) as rating, users.id, users.username
        FROM users
        JOIN progresses ON progresses.userid = users.id
        LEFT JOIN branches ON branchid = branches.id
        LEFT JOIN quests ON branches.questid = quests.id
        LEFT JOIN questshelpers on quests.id = questshelpers.questid
        WHERE ((quests.author IS NULL OR quests.author != users.id) AND (questshelpers.userid IS NULL OR questshelpers.userid != users.id)) AND
        users.isConfirmed = True
        GROUP BY users.id
        ORDER BY rating DESC`,


    selectPLayersProgressesByQuestid: `
        SELECT users.id, users.username, progresses.maxprogress as progress, branches.title as branchTitle, NOW() - progresses.started as time
        FROM progresses
        JOIN users ON progresses.userid = users.id
        JOIN branches ON progresses.branchid = branches.id
        JOIN quests ON branches.questid = quests.id
        WHERE quests.id = $1
        AND progresses.isfinished = False
        AND progress != 0
        ORDER BY branchTitle, progress DESC`,

    selectFinishedQuestPLayersByQuestid: `
        SELECT users.id, users.username, STRING_AGG(branches.title, ', ') as branches, SUM(progresses.finished - progresses.started) as time
        FROM progresses
        JOIN users ON progresses.userid = users.id
        JOIN branches ON progresses.branchid = branches.id
        JOIN quests ON branches.questid = quests.id
        WHERE quests.id = $1
        AND progresses.isfinished = True
        GROUP BY users.id
        ORDER BY time`,

    selectQuestStatisticsByQuestid: `
        SELECT quests.id, avg(ratingvote) as rating, avg(finished - started) as time, count(*) as played
        FROM progresses
        JOIN branches ON progresses.branchid = branches.id
        JOIN quests ON branches.questid = quests.id
        WHERE quests.id = $1
        AND progresses.isfinished = true
        GROUP BY quests.id`,

    // ----- S -----
    updateUserChooseBranchByUserId: `
        UPDATE users SET
        chosenQuestId = $1,
        chosenBranchId = $2
        WHERE id = $3`,

    updateQuestById: `
        UPDATE quests SET
        title = $1,
        description = $2,
        isPublished = $3,
        isLinkActive = $4,
        previewUrl = $5
        WHERE id = $6
        RETURNING *`,

    updateBranchById: `
        UPDATE branches SET
        orderid = $1,
        title = $2,
        description = $3,
        isPublished = $4
        WHERE id = $5
        RETURNING *`,

    updateBranchOrderidById: `
        UPDATE branches SET
        orderid = $1
        WHERE id = $2
        RETURNING *`,

    updateBranchTitleById: `
        UPDATE branches SET
        title = $1
        WHERE id = $2
        RETURNING *`,

    updateHelperByIdQuestid: `
        UPDATE questsHelpers SET
        userId = $1
        WHERE id = $2 AND questId = $3
        RETURNING *`,

    increaseProgressByUseridBranchid: `
        UPDATE progresses SET
        progress = progress + 1
        WHERE userId = $1 AND branchId = $2
        RETURNING *`,

    updateProgressByUseridBranchid: `
        UPDATE progresses SET
        progress = $1
        WHERE userId = $2 AND branchId = $3
        RETURNING *`,

    updateTaskById: `
        UPDATE tasks SET
        orderid = $1,
        title = $2,
        description = $3,
        question = $4,
        answers = $5,
        isQrAnswer = $6
        WHERE id = $7
        RETURNING *`,

    updateTaskOrderidById: `
        UPDATE tasks SET
        orderid = $1,
        WHERE id = $2
        RETURNING *`,

    updateProgressRatingByBranchidUserid: `
        UPDATE progresses SET
        ratingvote = $1
        WHERE isfinished = True AND
        branchid = $2 AND
        userid = $3
        RETURNING *`,

    // ----- DELETES -----
    deleteQuestById: `
        DELETE FROM quests
        WHERE id = $1`,

    deleteBranchById: `
        DELETE FROM branches
        WHERE id = $1`,

    deleteTaskById: `
        DELETE FROM tasks
        WHERE id = $1`,

    deleteHelperById: `
        DELETE FROM questsHelpers
        WHERE id = $1`,

    deleteHelperByQuestidUserid: `
        DELETE FROM questsHelpers
        WHERE questId = $1 AND userid = $2`,

    deleteProgressByUserid: `
        DELETE FROM progresses
        WHERE userId = $1`,


    // --- IMAGES ---
    insertImage: `
        INSERT INTO images (author, type, bytes)
        VALUES ($1, $2, $3)
        RETURNING id, author, type`,

    selectImageById: `
        SELECT * FROM images
        WHERE id = $1`,

    deleteImageByIdAuthor: `
        DELETE FROM images
        WHERE id = $1 AND author = $2`
};
