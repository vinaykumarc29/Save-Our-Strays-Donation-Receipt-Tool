import CryptoJS from 'crypto-js';

const secretKey = import.meta.env.VITE_CRYPTO_SECRET_KEY as string;

const encryptData = (dataObj: any) => {
    const objStr = JSON.stringify({ ...dataObj });
    const encryptedObj = CryptoJS.AES.encrypt(objStr, secretKey).toString();
    return encryptedObj;
};

export default encryptData;