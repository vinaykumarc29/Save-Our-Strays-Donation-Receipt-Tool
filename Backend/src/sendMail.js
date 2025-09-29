import { createTransport } from "nodemailer";
// import { RowData } from "./interfaces.js";
import dotenv from 'dotenv';
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

export const sendMail = async (rowData, email, ccEmail, password) => {

    try {
        console.log(rowData);
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
        await helper(rowData, isModeOfPaymentLarge);
        password = password.replace(/\s+/g, '');
        // Now, you can send an email after navigating to the endpoint and intercepting the request
        // Create a transporter using Gmail service
        const transporter = createTransport({
            service: 'gmail',
            auth: {
                user: email, // Use environment variables instead of hardcoding
                pass: password, // Use environment variables instead of hardcoding
            },
        });
        // console.log(__dirname);
        // margin-top:12px;
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
                    path: path.join(__dirname, process.env.OUTPUT_PDF_PATH),
                    contentType: 'application/pdf'
                }
                // , {
                //     filename: "linkedin.png",
                //     path: path.join(__dirname, process.env.LINKEDIN_IMG_PATH),
                //     cid: "linkedin",
                //     contentType: 'image/png'
                // }, {
                //     filename: "twitter.png",
                //     path: path.join(__dirname, process.env.TWITTER_IMG_PATH),
                //     cid: "twitter",
                //     contentType: 'image/png'
                // }, {
                //     filename: "facebook.png",
                //     path: path.join(__dirname, process.env.FACEBOOK_IMG_PATH),
                //     cid: "facebook",
                //     contentType: 'image/png'
                // }, {
                //     filename: "instagram.png",
                //     path: path.join(__dirname, process.env.INSTAGRAM_IMG_PATH),
                //     cid: "instagram",
                //     contentType: 'image/png'
                // }
            ]
        };

        // Send email with PDF attachment
        await transporter.sendMail(mailOptions);
    } catch (error) {
        console.log(error);
        throw new Error('Error while sending mail. Please connect to your developers.');
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
        const existingPdfBytes = fs.readFileSync(path.join(__dirname, isModeOfPaymentLarge ? process.env.INPUT_PDF_PATH : process.env.INPUT_PDF_PATH1));
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

        // Write the updated PDF bytes to a new file
        fs.writeFileSync(path.join(__dirname, process.env.OUTPUT_PDF_PATH), updatedPdfBytes);
    } catch (error) {
        console.log(error);
        throw new Error('Internval Server Error!');
    }
}
