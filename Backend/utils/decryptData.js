import CryptoJS from 'crypto-js';
import dotenv from 'dotenv';

dotenv.config(); // Load environment variables from .env file

// Retrieve the secret key from environment variables
const secretKey = process.env.CRYPTO_SECRET_KEY;

// Function to decrypt the encrypted object
const decryptData = (encryptedObj) => {
    // Decrypt the object using the secret key
    const bytes = CryptoJS.AES.decrypt(encryptedObj, secretKey); // Using empty string as fallback if secret key is undefined
    // Parse the decrypted bytes to JSON
    const temp = bytes.toString(CryptoJS.enc.Utf8);
    const decryptedObj = JSON.parse(temp);
    return decryptedObj;
};

export default decryptData;
