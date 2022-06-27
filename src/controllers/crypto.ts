//https://attacomsian.com/blog/nodejs-encrypt-decrypt-data

const crypto = require('crypto');

const algorithm = 'aes-256-ctr';
const secretKey = 'vOVH6sdmpNWjRRIqCc7rdxs01lwHzfr3';

const encrypt = (text: string) => {

    const iv = Buffer.alloc(16, 0);

    const cipher = crypto.createCipheriv(algorithm, secretKey,  iv);

    const encrypted = Buffer.concat([cipher.update(text), cipher.final()]);

    return encrypted.toString('hex');
};

const decrypt = (hash: string) => {

    const iv = Buffer.alloc(16, 0);

    const decipher = crypto.createDecipheriv(algorithm, secretKey, iv);

    const decrpyted = Buffer.concat([decipher.update(Buffer.from(hash, 'hex')), decipher.final()]);

    return decrpyted.toString();
};

module.exports = {
    encrypt,
    decrypt
};