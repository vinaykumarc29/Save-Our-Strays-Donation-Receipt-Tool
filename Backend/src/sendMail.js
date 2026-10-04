import { createTransport } from "nodemailer";
// import { RowData } from "./interfaces.js";
import dotenv from 'dotenv';
import { performance } from 'perf_hooks';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
const __dirname = dirname(fileURLToPath(import.meta.url));
import { PDFDocument, StandardFonts } from "pdf-lib";
import { ToWords } from 'to-words';

dotenv.config(); // Load environment variables from .env file

const toWords = new ToWords({
    localeCode: 'en-IN',
    converterOptions: {
        currency: true,
        ignoreDecimal: false,
        ignoreZeroCurrency: false,
        doNotAddOnly: false,
        currencyOptions: {
            // can be used to override defaults for the selected locale
            name: 'Rupee',
            plural: 'Rupees',
            symbol: '₹',
            fractionalUnit: {
                name: 'Paisa',
                plural: 'Paise',
                symbol: '',
            },
        },
    },
});

// In-memory cache for static PDF template bytes to avoid repeated disk reads
let cachedInputPdfBytes = null;
let cachedInput1PdfBytes = null;

const getTemplateBytes = (isModeOfPaymentLarge) => {
    if (isModeOfPaymentLarge) {
        if (!cachedInputPdfBytes) {
            cachedInputPdfBytes = fs.readFileSync(path.join(__dirname, process.env.INPUT_PDF_PATH));
        }
        return cachedInputPdfBytes;
    } else {
        if (!cachedInput1PdfBytes) {
            cachedInput1PdfBytes = fs.readFileSync(path.join(__dirname, process.env.INPUT_PDF_PATH1));
        }
        return cachedInput1PdfBytes;
    }
};

export const createMailTransporter = (email, password) => {
    const cleanPassword = password ? String(password).replace(/\s+/g, '') : '';
    return createTransport({
        service: 'gmail',
        pool: true,
        maxConnections: 1,
        maxMessages: 100,
        auth: {
            user: email,
            pass: cleanPassword,
        },
    });
};

export const sendMail = async (rowData, email, ccEmail, password, transporter = null, rowNumber = null, timingCollector = null) => {

    try {
        console.log(rowData);
        const currentRowNumber = rowNumber !== null && rowNumber !== undefined ? rowNumber : (rowData["Receipt No"] || 'Unknown');

        const donorName = rowData["Donar Name"] || rowData["Donor Name"] || "";
        const donorEmail = rowData["Donar Email"] || rowData["Donor Email"] || "";
        rowData["Donar Name"] = donorName;
        rowData["Donor Name"] = donorName;
        rowData["Donar Email"] = donorEmail;
        rowData["Donor Email"] = donorEmail;

        rowData['Amount of Donation In Number'] = parseInt(rowData["Amount of Donation"]).toLocaleString('en-IN') + '/-';

        rowData['Amount of Donation'] = toWords.convert(parseInt(rowData["Amount of Donation"]));

        if (rowData["Donar Name"].length > 39) {
            rowData["Remaining Donar Name"] = rowData["Donar Name"].substring(38);
            rowData["Donar Name"] = rowData["Donar Name"].substring(0, 38) + '-';
        }

        if (rowData['Amount of Donation'].length > 50) {
            rowData['Remaining Amount of Donation'] = rowData['Amount of Donation'].substring(50);
            rowData['Amount of Donation'] = rowData['Amount of Donation'].substring(0, 50) + '-';
        }
        let isModeOfPaymentLarge = false;
        if (rowData['Mode of Payment'] == 'CHQ') {
            rowData['Mode of Payment'] = `Chq.No.${rowData['Chq.No.']}  Bank & Branch. ${rowData['Bank & Branch']}`;
            if (rowData['Mode of Payment'].length > 70) {
                rowData['Remaining Mode of Payment'] = rowData["Mode of Payment"].substring(70);
                rowData['Mode of Payment'] = rowData['Mode of Payment'].substring(0, 70) + '-';
                isModeOfPaymentLarge = true;
            }
        }

        const pdfStartTime = performance.now();
        const pdfBuffer = await helper(rowData, isModeOfPaymentLarge);
        const pdfTime = performance.now() - pdfStartTime;
        console.log(
            `Row ${currentRowNumber} PDF generation: ${pdfTime.toFixed(2)} ms`
        );
        if (timingCollector && typeof timingCollector.addPdfTime === 'function') {
            timingCollector.addPdfTime(pdfTime);
        }

        const cleanPassword = password ? String(password).replace(/\s+/g, '') : '';
        const mailTransporter = transporter || createMailTransporter(email, cleanPassword);

        // Update the mailOptions object with the PDF attachment
        let from = `Save Our Strays ${email}`
        const mailOptions = {
            from: from,
            to: rowData["Donar Email"],
            cc: ccEmail,
            subject: rowData["Email Subject"],
            html: `
                ${rowData["Email - Name"]}
                <p>${rowData["Email - Body"]}</p>
                <p>${rowData["Email - Sign"]}</p>
            `,
            attachments: [
                {
                    filename: `${rowData['Receipt No']}`,
                    content: pdfBuffer,
                    contentType: 'application/pdf'
                }
            ]
        };

        // Send email with PDF attachment
        const emailStartTime = performance.now();
        await mailTransporter.sendMail(mailOptions);
        const emailTime = performance.now() - emailStartTime;
        console.log(
            `Row ${currentRowNumber} email sending: ${emailTime.toFixed(2)} ms`
        );
        if (timingCollector && typeof timingCollector.addEmailTime === 'function') {
            timingCollector.addEmailTime(emailTime);
        }
    } catch (error) {
        console.error("Error in sendMail:", error);
        if (error.message && error.message.startsWith('PDF generation error')) {
            throw error;
        }
        throw new Error(`SMTP error: ${error.message || 'Failed to send email'}`);
    }
};

async function appendTextToPDF(pdfDoc, contents) {
    const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    contents.forEach((content) => {
        if (content) {
            pdfDoc.getPages()[content.pageNo]?.drawText(content.text, {
                x: content.x,
                y: content.y,
                size: content.size,
                font: content.bold ? boldFont : regularFont,
                color: content.color,
            });
        }
    });
    const pdfBytes = await pdfDoc.save();
    return pdfBytes;
}

const helper = async (data, isModeOfPaymentLarge) => {
    try {
        const existingPdfBytes = getTemplateBytes(isModeOfPaymentLarge);
        const pdfDoc = await PDFDocument.load(existingPdfBytes);
        let addOn = 0;
        const updatedPdfBytes = await appendTextToPDF(pdfDoc, [
            {
                text: data["Receipt No"].toString(),
                pageNo: 0,
                x: 100,
                y: 547,
                bold: true,
                size: 12,
            },
            {
                text: data["Date of Donation"],
                pageNo: 0,
                x: 385,
                y: 547,
                bold: true,
                size: 12,
            },
            {
                text: data["Donar Name"],
                pageNo: 0,
                x: 240,
                y: 516,
                bold: true,
                size: 12,
            },
            (
                data['Remaining Donar Name'] && {
                    text: data["Remaining Donar Name"],
                    pageNo: 0,
                    x: 80,
                    y: 500,
                    bold: true,
                    size: 12
                }
            ),
            {
                text: data["Amount of Donation"],
                pageNo: 0,
                x: 195,
                y: 482,
                bold: true,
                size: 12,
            },
            (
                data['Remaining Amount of Donation'] && {
                    text: data["Remaining Amount of Donation"],
                    pageNo: 0,
                    x: 80,
                    y: 468,
                    bold: true,
                    size: 12
                }
            ),
            {
                text: data["Mode of Payment"],
                pageNo: 0,
                x: 78,
                y: 448,
                bold: true,
                size: 12,
            },
            (
                data['Remaining Mode of Payment'] && {
                    text: data['Remaining Mode of Payment'],
                    pageNo: 0,
                    x: 78,
                    y: 435,
                    bold: true,
                    size: 12,
                }
            ),
            {
                text: data["Towards"],
                pageNo: 0,
                x: 133,
                y: isModeOfPaymentLarge ? 413 : 430,
                bold: true,
                size: 12,
            },
            {
                text: data["Amount of Donation In Number"],
                pageNo: 0,
                x: 100,
                y: isModeOfPaymentLarge ? 261 : 278,
                bold: true,
                size: 12,
            }
        ]);

        return Buffer.from(updatedPdfBytes);
    } catch (error) {
        console.error("PDF generation error in helper:", error);
        throw new Error(`PDF generation error: ${error.message || 'Failed to render PDF'}`);
    }
};

export const generateReceiptPdf = helper;
export { helper };
