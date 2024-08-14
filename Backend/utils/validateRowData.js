// import { RowData } from '../src/interfaces.js';

// Define a function to validate the row data
export function validateRow(row, rowNumber) {
    // Validate each field
    if (
        !row['Receipt No'] ||
        !row['Today’s Date'] ||
        !row['Name'] ||
        !row['Address'] ||
        !row['PAN'] ||
        !row['Email'] ||
        !row['Amount Received'] ||
        !row['Mode of Payment'] ||
        !row['Check/CC/Reference Number'] ||
        !row['This donation has gone towards']
    ) {
        throw new Error(
            'Server Stopped sending mail from Row No :- ' + rowNumber + '\n Reason :- Some fields are empty in Row No :- ' + rowNumber
        );
    }
}