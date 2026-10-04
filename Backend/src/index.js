import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import morgan from 'morgan';
import decryptData from '../utils/decryptData.js';
import { readDataAndSendMail } from './readDataAndSendMail.js';
import { jobManager } from './jobManager.js';

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
    try {
        const encryptedData = req.body?.encryptedData;
        if (!encryptedData) {
            return res.status(400).send('Encrypted data is required.');
        }

        const {
            startingRowNo,
            fileData,
            email,
            ccEmails,
            password
        } = decryptData(encryptedData);

        if (!Array.isArray(fileData) || fileData.length === 0) {
            return res.status(400).send('No valid row data found in spreadsheet payload.');
        }

        const job = jobManager.createJob(fileData.length);
        jobManager.updateJob(job.jobId, { status: 'PROCESSING' });

        // Immediately respond to client with job ID and status
        res.status(200).json({
            jobId: job.jobId,
            status: 'PROCESSING',
            total: job.total,
            processed: 0,
            successful: 0,
            failed: 0
        });

        // Run batch processing asynchronously in background
        setImmediate(async () => {
            try {
                const summary = await readDataAndSendMail(
                    startingRowNo,
                    fileData,
                    email,
                    ccEmails,
                    password,
                    null,
                    (progress) => {
                        const current = jobManager.getJob(job.jobId);
                        if (current) {
                            current.processed = progress.processed;
                            current.successful = progress.successful;
                            current.failed = progress.failed;
                            if (progress.lastResult) {
                                current.results.push(progress.lastResult);
                            }
                            current.updatedAt = Date.now();
                        }
                    }
                );

                jobManager.updateJob(job.jobId, {
                    status: 'COMPLETED',
                    processed: summary.total,
                    successful: summary.successful,
                    failed: summary.failed,
                    results: summary.results,
                    completedAt: Date.now()
                });
            } catch (err) {
                console.error(`Background job ${job.jobId} failed:`, err);
                jobManager.updateJob(job.jobId, {
                    status: 'FAILED',
                    error: err.message || 'Fatal error processing batch',
                    completedAt: Date.now()
                });
            }
        });
    } catch (error) {
        next(error); // Pass the error to the error handling middleware
    }
});

const handleGetJobStatus = (req, res) => {
    const { jobId } = req.params;
    const job = jobManager.getJob(jobId);
    if (!job) {
        return res.status(404).json({ error: 'Job not found or expired' });
    }
    return res.status(200).json(job);
};

app.get('/jobs/:jobId', handleGetJobStatus);
app.get('/job/:jobId', handleGetJobStatus);

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
