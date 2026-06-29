const mongoose = require('mongoose');
const path = require("path");
const dns = require('node:dns');
dns.setServers(["1.1.1.1", "8.8.8.8"]);
require('dotenv').config({ path: path.resolve(__dirname, "../../.env"), quiet: true });

const Connection = async () => {
    if (!process.env.MONGO_URI) {
        throw new Error("MONGO_URI is missing. Add it to backend/.env before starting the server.");
    }

    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to Stratex Database');
}

module.exports = Connection;

