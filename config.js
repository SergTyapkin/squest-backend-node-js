export default {
    "db_host": "localhost",
    "db_port": 5432,
    "db_user": "postgres",
    "db_password": 'root' || process.env.DATABASE_PASSWORD,
    "db_database": "squest-site",

    "max_image_size": 512,

    "api_port": "9000",
    "debug": "False",

    "cors_origins": [
        "http://127.0.0.1",
        "https://127.0.0.1",
        "http://squest.herokuapp.com",
        "https://squest.herokuapp.com",
        "http://squest.ml",
        "https://squest.ml"
    ],
    "cors_methods": ["GET", "POST", "PUT", "DELETE"],

    "SMTP_mail_server_host": "smtp.googlemail.com",
    "SMTP_mail_server_port": 587,
    "SMTP_mail_server_use_tls": true,
    "mail_username": "squest.studio@gmail.com",
    "mail_password": process.env.MAIL_PASSWORD,
}
