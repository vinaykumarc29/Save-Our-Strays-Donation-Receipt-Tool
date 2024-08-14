// import { RowData } from '../src/interfaces.js';

// Define a function to validate the row data
export function validateRow(row, rowNumber) {
    // Validate each field
    if (
        !row['Receipt No'] ||
        !row['Date of Donation'] ||
        !row['Donar Name'] ||
        !row['Donar Email'] ||
        !row['Amount of Donation'] ||
        !row['Mode of Payment'] ||
        !row['Email Subject'] ||
        !row['Email - Name'] ||
        !row['Email - Body'] ||
        !row['Email - Sign']
    ) {
        throw new Error(
            'Server Stopped sending mail from Row No :- ' + rowNumber + '\n Reason :- Some fields are empty in Row No :- ' + rowNumber
        );
    }
}