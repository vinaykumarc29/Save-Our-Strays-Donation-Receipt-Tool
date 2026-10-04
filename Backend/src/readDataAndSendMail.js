import dotenv from 'dotenv';
import { performance } from 'perf_hooks';
import { sendMail, createMailTransporter } from './sendMail.js';
import { validateRow } from '../utils/validateRowData.js';
import { isRetryableError } from '../utils/errorClassifier.js';

dotenv.config(); // Load environment variables from .env file

function sanitizeErrorMessage(rawMessage, rowNumber) {
    if (!rawMessage) return `Row ${rowNumber}: Unknown processing error`;
    let safe = String(rawMessage)
        .replace(/pass(word)?\s*[:=]\s*\S+/gi, 'password=***')
        .replace(/[a-f0-9]{24,}/gi, '***');
    return safe;
}

// Function to get and process rows from the spreadsheet and send email
export const readDataAndSendMail = async (
    startingRowNo,
    fileData,
    email,
    ccEmail,
    password,
    existingTransporter = null,
    onProgress = null,
    options = {}) => {
    if (!Array.isArray(fileData) || fileData.length === 0) {
        throw new Error('No row data found in the spreadsheet payload.');
    }

    let actualTransporter = existingTransporter;
    let actualOnProgress = onProgress;
    let actualOptions = options || {};

    // Backward compatibility for parameter order when onProgress is passed as 6th arg
    if (typeof existingTransporter === 'function' && onProgress === null) {
        actualOnProgress = existingTransporter;
        actualTransporter = null;
    }
    if (typeof onProgress === 'object' && onProgress !== null && Object.keys(options || {}).length === 0) {
        actualOptions = onProgress;
        actualOnProgress = null;
    }

    const concurrency = Math.max(1, Math.min(
        Number(actualOptions.concurrency || process.env.EMAIL_CONCURRENCY || 1),
        3
    ));
    const maxRetries = Number(actualOptions.maxRetries ?? 2);
    const baseRetryDelayMs = Number(actualOptions.retryDelayMs ?? 500);

    const batchStartTime = performance.now();
    let totalPdfTime = 0;
    let totalEmailTime = 0;
    let totalRetries = 0;

    console.log("====================================");
    console.log("🚀 BATCH PROCESSING STARTED");
    console.log("Time:", new Date().toISOString());
    console.log(`Configured Email Concurrency: ${concurrency}`);
    console.log(`Max Retries per transient error: ${maxRetries}`);
    console.log("====================================");

    const timingCollector = {
        addPdfTime: (ms) => { totalPdfTime += ms; },
        addEmailTime: (ms) => { totalEmailTime += ms; }
    };

    const transporter = actualTransporter || createMailTransporter(email, password, concurrency);
    const results = [];
    let successful = 0;
    let failed = 0;

    // Step 2: Initialize row-level processing state
    const rowStates = fileData.map((row, index) => {
        const rowNumber = startingRowNo + index;
        const donorName = (row && (row['Donar Name'] || row['Donor Name'])) || '';
        const donorEmail = (row && (row['Donar Email'] || row['Donor Email'])) || '';
        return {
            row: rowNumber,
            index,
            receiptNo: String((row && row['Receipt No']) || ''),
            donorName: String(donorName),
            donorEmail: String(donorEmail),
            state: 'PENDING', // PENDING -> PROCESSING -> SENT / FAILED
            status: 'pending',
            attempts: 0,
            retries: 0,
            error: null,
            data: row
        };
    });

    try {
        async function processRow(rowState) {
            const rowNumber = rowState.row;

            // Step 5: Prevent unnecessary duplicate emails
            // If already marked SENT in this job, never process again
            if (rowState.state === 'SENT') {
                console.warn(`Row ${rowNumber} is already marked SENT. Skipping to prevent duplicate email.`);
                return;
            }

            rowState.state = 'PROCESSING';
            rowState.status = 'processing';

            const row = rowState.data;
            if (!row) {
                rowState.state = 'FAILED';
                rowState.status = 'failed';
                rowState.error = `Row ${rowNumber}: Empty row data`;
                return;
            }

            // Extract donor info supporting both spellings
            const donorName = (row['Donar Name'] !== undefined && row['Donar Name'] !== '')
                ? row['Donar Name']
                : (row['Donor Name'] !== undefined && row['Donor Name'] !== '')
                    ? row['Donor Name']
                    : '';

            const donorEmail = (row['Donar Email'] !== undefined && row['Donar Email'] !== '')
                ? row['Donar Email']
                : (row['Donor Email'] !== undefined && row['Donor Email'] !== '')
                    ? row['Donor Email']
                    : '';

            const data = {
                "Receipt No": row['Receipt No'],
                "Date of Donation": row['Date of Donation'],
                "Donar Name": donorName,
                "Donor Name": donorName,
                "Donar Email": donorEmail,
                "Donor Email": donorEmail,
                "Amount of Donation": row['Amount of Donation'],
                "Mode of Payment": row['Mode of Payment'],
                "Email Subject": row['Email Subject'],
                "Email - Name": row['Email - Name'],
                "Email - Body": row['Email - Body'],
                "Email - Sign": row['Email - Sign'],
                "Towards": row['Towards'],
                "Chq.No.": row['Chq.No.'],
                "Bank & Branch": row['Bank & Branch'],
            };

            // Step 4: Validate row data (permanent failure; never retried)
            try {
                validateRow(data, rowNumber);
            } catch (valErr) {
                console.error(`Row ${rowNumber} validation failed:`, valErr.message);
                rowState.state = 'FAILED';
                rowState.status = 'failed';
                rowState.error = sanitizeErrorMessage(valErr.message, rowNumber);
                return;
            }

            // Step 3: Transient email retry loop
            let sendSuccess = false;
            let lastError = null;

            for (let attempt = 1; attempt <= 1 + maxRetries; attempt++) {
                rowState.attempts = attempt;
                try {
                    await sendMail(data, email, ccEmail, password, transporter, rowNumber, timingCollector);
                    sendSuccess = true;
                    rowState.state = 'SENT';
                    rowState.status = 'success';
                    rowState.error = null;
                    break; // Successfully sent, exit retry loop
                } catch (sendErr) {
                    lastError = sendErr;
                    const retryable = isRetryableError(sendErr);

                    if (retryable && attempt <= maxRetries) {
                        totalRetries++;
                        rowState.retries++;
                        const delayMs = baseRetryDelayMs * attempt;
                        console.warn(
                            `⚠️ Row ${rowNumber} transient error on attempt ${attempt}/${1 + maxRetries} (${sendErr.message}). Retrying in ${delayMs}ms...`
                        );
                        await new Promise(r => setTimeout(r, delayMs));
                    } else {
                        // Either permanent failure or max retries exhausted
                        break;
                    }
                }
            }

            if (!sendSuccess) {
                console.error(`Row ${rowNumber} failed:`, lastError?.message);
                rowState.state = 'FAILED';
                rowState.status = 'failed';
                rowState.error = sanitizeErrorMessage(lastError?.message, rowNumber);
            }
        }

        // Step 8: Controlled concurrency worker pool
        let nextIndex = 0;
        const activeWorkerCount = Math.min(concurrency, rowStates.length);

        async function worker(workerId) {
            while (true) {
                if (nextIndex >= rowStates.length) {
                    break;
                }
                const index = nextIndex++;
                const rowState = rowStates[index];

                await processRow(rowState);

                // Step 7: Atomic progress calculation
                if (rowState.state === 'SENT') {
                    successful++;
                } else {
                    failed++;
                }

                const itemResult = {
                    row: rowState.row,
                    receiptNo: rowState.receiptNo,
                    donorEmail: rowState.donorEmail,
                    state: rowState.state,
                    status: rowState.status,
                    retries: rowState.retries,
                    ...(rowState.error ? { error: rowState.error } : {})
                };

                results.push(itemResult);

                if (typeof actualOnProgress === 'function') {
                    actualOnProgress({
                        processed: successful + failed,
                        successful,
                        failed,
                        lastResult: itemResult
                    });
                }
            }
        }

        const workers = Array.from({ length: activeWorkerCount }, (_, id) => worker(id));
        await Promise.all(workers);

        // Sort results by row number so output is deterministic
        results.sort((a, b) => a.row - b.row);

        const totalBatchTime = performance.now() - batchStartTime;
        const otherProcessingTime = Math.max(0, totalBatchTime - totalPdfTime - totalEmailTime);

        console.log("====================================");
        console.log("📊 BATCH PERFORMANCE");
        console.log("====================================");

        console.log(
            `Total batch time: ${(totalBatchTime / 1000).toFixed(2)} seconds`
        );

        console.log(
            `Total PDF time: ${(totalPdfTime / 1000).toFixed(2)} seconds`
        );

        console.log(
            `Total email time: ${(totalEmailTime / 1000).toFixed(2)} seconds`
        );

        console.log(
            `Other processing: ${(otherProcessingTime / 1000).toFixed(2)} seconds`
        );

        console.log(`Concurrency level: ${concurrency}`);
        console.log(`Total retries: ${totalRetries}`);
        console.log("====================================");

        const summary = {
            total: results.length,
            successful,
            failed,
            concurrency,
            retries: totalRetries,
            results
        };

        return summary;
    } finally {
        if (transporter && typeof transporter.close === 'function') {
            transporter.close();
        }
    }
};

