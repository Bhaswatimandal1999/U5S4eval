
const express = require('express');
const mongoose = require('mongoose');
const redis = require('redis');
const rateLimit = require('express-rate-limit');
const RedisStore = require('rate-limit-redis');
const ipapi = require('ipapi.co');
const winston = require('winston');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

const app = express();

const redisClient = redis.createClient({
    url: 'redis://alice:foobared@awesome.redis.server:6380'
});

const connection = mongoose.connect("mongodb://127.0.0.1:27017/ipuser")

const logger = winston.createLogger({
    level: 'error',
    transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: 'error.log' }),
    ],
});

const limiter = rateLimit({
    store: new RedisStore({
        client: redisClient,
    }),
    windowMs: 15 * 60 * 1000,
    max: 100,
});

app.use(express.json());

app.use(limiter);

const authenticateUser = (req, res, next) => {

    // if (validateIPAddress) {
    //     next();
    // } else {
    //     res.sendStatus(401);
    // }
    next()
};

const validateIPAddress = (req, res, next) => {
    const ipAddress = req.params.ip;

    const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
    if (!ipRegex.test(ipAddress)) {
        res.status(400).json({ error: 'Invalid IP address' });
        return;
    }

    next();

    app.get('/ip/:ip', authenticateUser, validateIPAddress, (req, res) => {
        const ipAddress = req.params.ip;

        redisClient.get(ipAddress, (error, cachedData) => {
            if (error) {
                logger.error(error);
            }

            if (cachedData) {
                res.json({ city: cachedData });
            } else {
                ipapi.location(ipAddress, (error, data) => {
                    if (error) {
                        logger.error(error);
                        res.sendStatus(500);
                    } else {
                        const city = data.city;

                        redisClient.setex(ipAddress, 6 * 60 * 60, city);

                        res.json({ city });
                    }
                });
            }
        });
    });
}
app.listen(8080, async () => {
    try {
        console.log("server running at port 8080");
        await connection
        console.log("connected to db");
    } catch (err) {
        console.log(err);
    }
});
