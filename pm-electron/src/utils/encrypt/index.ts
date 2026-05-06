import CryptoJS from "crypto-js";

const SECRET_KEY = "partialypartialy"; // 建议使用更安全的密钥（如 256-bit）
const IV = "63348624562315867651232156465314"

/**
 * AES 加密（输出 HEX 格式）
 * @param data 要加密的数据（对象会被转为 JSON）
 * @returns HEX 字符串
 */
function encrypt(data:any) {
  const dataStr = JSON.stringify(data);
  const encrypted = CryptoJS.AES.encrypt(dataStr, SECRET_KEY, {
    mode: CryptoJS.mode.CBC,          // 明确指定 CBC 模式
    padding: CryptoJS.pad.Pkcs7,      // 明确指定 PKCS#7 填充
    iv: CryptoJS.enc.Hex.parse(IV), // 需要提供 IV（初始化向量）
  });
  return encrypted.toString(); // 直接返回 Base64 格式（包含 IV 和密文）
}

/**
 * AES 解密（从 Base64 格式解密）
 * @param encryptedData Base64 格式的加密数据
 * @returns 解密后的原始数据（自动解析 JSON）
 */
function decrypt(encryptedData:string) {
  const decrypted = CryptoJS.AES.decrypt(encryptedData, SECRET_KEY, {
    mode: CryptoJS.mode.CBC,          // 与加密一致
    padding: CryptoJS.pad.Pkcs7,      // 与加密一致
    iv: CryptoJS.enc.Hex.parse(IV), // 与加密一致
  });
  const decryptedStr = decrypted.toString(CryptoJS.enc.Utf8);
  try {
    return JSON.parse(decryptedStr);
  } catch (error) {
    return decryptedStr;
  }
}

export { encrypt, decrypt };