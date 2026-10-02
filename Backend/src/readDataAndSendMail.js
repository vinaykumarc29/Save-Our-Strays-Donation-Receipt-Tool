import dotenv from 'dotenv';
import { sendMail, createMailTransporter } from './sendMail.js'; // Import sendMail and createMailTransporter
// import { RowData } from './interfaces.js'; // Import the RowData interface
import { validateRow } from '../utils/validateRowData.js';

dotenv.config(); // Load environment variables from .env file

// Function to get and process rows from the spreadsheet and send email
export const readDataAndSendMail = async (
    startingRowNo,
    fileData,
    email,
    ccEmail,
    password,
    existingTransporter = null) => {
    const transporter = existingTransporter || createMailTransporter(email, password);
    try {
        // Loop through each row
        for (let index = 0; index < fileData.length; index++) {
            const row = fileData[index];
            if (row) {
                // Extract necessary data from the row
                const data = {
                    "Receipt No": row['Receipt No'], // Assuming 'Receipt No' is a column in the sheet
                    "Date of Donation": row['Date of Donation'],
                    "Donar Name": row['Donar Name'],
                    "Donar Email": row['Donar Email'], // Assuming 'email' is a column in the sheet
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
                validateRow(data, startingRowNo + index);
                await sendMail(data, email, ccEmail, password, transporter);
            }
        }
    } catch (error) {
        // console.log(error)
        throw error;
    } finally {
        if (transporter && typeof transporter.close === 'function') {
            transporter.close();
        }
    }
};
