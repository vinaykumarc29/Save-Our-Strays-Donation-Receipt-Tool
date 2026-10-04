// import { RowData } from '../src/interfaces.js';

// Define a function to validate the row data
export function validateRow(row, rowNumber) {
    // Validate standard required fields
    const requiredFields = [
        'Receipt No',
        'Date of Donation',
        'Amount of Donation',
        'Mode of Payment',
        'Email Subject',
        'Email - Name',
        'Email - Body',
        'Email - Sign',
        'Towards'
    ];

    for (const field of requiredFields) {
        if (row[field] === undefined || row[field] === null || String(row[field]).trim() === '') {
            throw new Error(
                `Error processing Row ${rowNumber}: The "${field}" field is empty. Please ensure all required fields are filled in.`
            );
        }
    }

    // Support both 'Donor Name' and 'Donar Name' spellings
    const donorName = row['Donor Name'] || row['Donar Name'];
    if (donorName === undefined || donorName === null || String(donorName).trim() === '') {
        throw new Error(
            `Error processing Row ${rowNumber}: The "Donor Name" field is empty. Please ensure all required fields are filled in.`
        );
    }

    // Support both 'Donor Email' and 'Donar Email' spellings
    const donorEmail = row['Donor Email'] || row['Donar Email'];
    if (donorEmail === undefined || donorEmail === null || String(donorEmail).trim() === '') {
        throw new Error(
            `Error processing Row ${rowNumber}: The "Donor Email" field is empty. Please ensure all required fields are filled in.`
        );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(String(donorEmail).trim())) {
        throw new Error(
            `Error processing Row ${rowNumber}: Invalid email address "${donorEmail}".`
        );
    }
}