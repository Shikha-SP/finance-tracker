// connection with mongodb
const mongoose = require('mongoose');

const dbConnection = async () => {
    try {
        const conn = await mongoose.connect(process.env.MONGO_URI);
        console.log(`MongoDB Connected: ${conn.connection.host}`);
    } catch (error) {
        console.error('Error connecting to MongoDB:', error);
    }
};

module.exports = dbConnection;
