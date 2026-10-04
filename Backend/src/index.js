import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import morgan from 'morgan';
import decryptData from '../utils/decryptData.js';
import { readDataAndSendMail } from './readDataAndSendMail.js';

dotenv.config(); // Load environment variables from .env file

// Check if all required environment variables are present
const requiredEnvVariables = [
    'PORT',
    'ENV',
    'CRYPTO_SECRET_KEY',
    'FRONTEND_BASE_URI',
    'OUTPUT_PDF_PATH',
    'INPUT_PDF_PATH',
];

const missingEnvVariables = requiredEnvVariables.filter(variable => !process.env[variable]);

if (missingEnvVariables.length > 0) {
    throw new Error(`Required environment variables are missing: ${missingEnvVariables.join(', ')}`);
}

const app = express();
const PORT = parseInt(process.env.PORT || '3000'); // Use port from environment variables or default to 3000

app.use(express.json()); // Enable JSON parsing middleware

// Enable CORS with specific origin
app.use(cors({
    origin: process.env.FRONTEND_BASE_URI
}));

// Set up morgan middleware for logging
app.use(morgan(process.env.ENV));

app.get('/', async (req, res, next) => {
    res.status(200).send('Server Is Running');
});

app.post('/', async (req, res, next) => {
    const encryptedData = req.body.encryptedData;
    const {
        startingRowNo,
        fileData,
        email,
        ccEmails,
        password } = decryptData(encryptedData);
    try {
        const summary = await readDataAndSendMail(startingRowNo, fileData, email, ccEmails, password);
        res.status(200).json(summary);
    } catch (error) {
        next(error); // Pass the error to the error handling middleware
    }
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.log(err);
    console.log(err.message);
    res.status(400).send(err.message);
});

// Start the server
const server = app.listen(PORT, () => {
    console.log("Server is listening on port " + PORT);
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
    // console.error('Uncaught Exception:', err);
    // Gracefully close the server and then exit
    server.close(() => {
        process.exit(1);
    });
});
