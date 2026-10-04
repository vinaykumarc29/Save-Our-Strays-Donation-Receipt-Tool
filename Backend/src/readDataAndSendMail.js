import dotenv from 'dotenv';
import { performance } from 'perf_hooks';
import { sendMail, createMailTransporter } from './sendMail.js'; // Import sendMail and createMailTransporter
// import { RowData } from './interfaces.js'; // Import the RowData interface
import { validateRow } from '../utils/validateRowData.js';

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
    onProgress = null) => {
    if (!Array.isArray(fileData) || fileData.length === 0) {
        throw new Error('No row data found in the spreadsheet payload.');
    }

    let actualTransporter = existingTransporter;
    let actualOnProgress = onProgress;
    if (typeof existingTransporter === 'function' && onProgress === null) {
        actualOnProgress = existingTransporter;
        actualTransporter = null;
    }

    const batchStartTime = performance.now();
    let totalPdfTime = 0;
    let totalEmailTime = 0;

    console.log("====================================");
    console.log("🚀 BATCH PROCESSING STARTED");
    console.log("Time:", new Date().toISOString());
    console.log("====================================");

    const timingCollector = {
        addPdfTime: (ms) => { totalPdfTime += ms; },
        addEmailTime: (ms) => { totalEmailTime += ms; }
    };

    const transporter = actualTransporter || createMailTransporter(email, password);
    const results = [];
    let successful = 0;
    let failed = 0;

    try {
        // Loop through each row independently
        for (let index = 0; index < fileData.length; index++) {
            const rowNumber = startingRowNo + index;
            const row = fileData[index];
            if (!row) {
                continue;
            }

            try {
                // Support both 'Donar Name'/'Donor Name' and 'Donar Email'/'Donor Email' spellings
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

                // Extract necessary data from the row
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

                validateRow(data, rowNumber);
                await sendMail(data, email, ccEmail, password, transporter, rowNumber, timingCollector);

                successful++;
                const itemResult = {
                    row: rowNumber,
                    receiptNo: String(data["Receipt No"] || ""),
                    donorEmail: String(donorEmail || ""),
                    status: "success"
                };
                results.push(itemResult);
                if (typeof actualOnProgress === 'function') {
                    actualOnProgress({
                        processed: results.length,
                        successful,
                        failed,
                        lastResult: itemResult
                    });
                }
            } catch (rowError) {
                console.error(`Row ${rowNumber} failed:`, rowError.message);
                failed++;
                const safeError = sanitizeErrorMessage(rowError.message, rowNumber);
                const itemResult = {
                    row: rowNumber,
                    receiptNo: String(row['Receipt No'] || ""),
                    donorEmail: String(row['Donar Email'] || row['Donor Email'] || ""),
                    status: "failed",
                    error: safeError
                };
                results.push(itemResult);
                if (typeof actualOnProgress === 'function') {
                    actualOnProgress({
                        processed: results.length,
                        successful,
                        failed,
                        lastResult: itemResult
                    });
                }
            }
        }

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

        console.log("====================================");

        const summary = {
            total: results.length,
            successful,
            failed,
            results
        };

        return summary;
    } finally {
        if (transporter && typeof transporter.close === 'function') {
            transporter.close();
        }
    }
};
