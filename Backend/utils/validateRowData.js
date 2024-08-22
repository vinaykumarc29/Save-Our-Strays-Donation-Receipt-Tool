// import { RowData } from '../src/interfaces.js';

// Define a function to validate the row data
export function validateRow(row, rowNumber) {
    // Validate each field
    const requiredFields = [
        'Receipt No',
        'Date of Donation',
        'Donor Name',
        'Donor Email',
        'Amount of Donation',
        'Mode of Payment',
        'Email Subject',
        'Email - Name',
        'Email - Body',
        'Email - Sign',
        'Towards'
    ];

    for (const field of requiredFields) {
        if (!row[field]) {
            throw new Error(
                `Error processing Row ${rowNumber}: The "${field}" field is empty. Please ensure all required fields are filled in.`
            );
        }
    }
}