package cn.example.dataserver.utils;

import cn.hutool.core.codec.Base64;
import cn.hutool.core.util.HexUtil;
import cn.hutool.core.util.RandomUtil;
import lombok.Builder;
import lombok.Data;

import javax.crypto.Cipher;
import javax.crypto.spec.IvParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;

/**
 * AES 加解密工具类 (Spring Bean)
 * - 支持使用随机生成的密钥进行加密
 * - 支持使用配置文件中的固定密钥进行加密
 * - 密文使用 Base64URL 编码（URL 安全）
 */
public class AesEncryptUtils {

    private static final String ALGORITHM = "AES";
    // 注意：Java 标准库中无 PKCS7Padding，通常使用 PKCS5Padding，其逻辑与 PKCS7 对块大小为 N 字节的数据相同。
    private static final String TRANSFORMATION = "AES/CBC/PKCS5Padding";
    /**
     * 加密结果封装类
     */
    @Data @Builder
    public static class EncResult {
        private String randomKey; // 随机生成的 128 位 HEX 字符串
        private String secretText; // Base64URL 编码后的加密密文
    }

    /**
     * 使用随机生成的密钥加密数据
     *
     * @param plainText 待加密的明文
     * @return EncResult 包含 128 位随机密钥和加密后的 Base64URL 密文
     */
    public static EncResult encryptRandom(String plainText) {
        // 1. 生成 128 位（64 个字符）的随机 HEX 字符串
        String fullRandomKey = RandomUtil.randomString("0123456789abcdef", 128);

        // 2. 按照指定规则从 128 位字符串中提取 32 位作为实际 AES 密钥
        String extractedAesKey = extractKeyFromFullKey(fullRandomKey);

        // 3. 使用提取出的密钥进行加密
        String encryptedBase64Url = performEncrypt(extractedAesKey, plainText);

        return EncResult.builder()
                .randomKey(fullRandomKey)
                .secretText(encryptedBase64Url)
                .build();
    }

    /**
     * 使用随机加密时返回的 128 位密钥来解密数据
     *
     * @param fullRandomKey 128 位的 HEX 密钥字符串
     * @param encryptedBase64Url Base64URL 编码的加密密文
     * @return 解密后的明文
     */
    public static String decryptWithRandomKey(String fullRandomKey, String encryptedBase64Url) {
        String extractedAesKey = extractKeyFromFullKey(fullRandomKey);
        return performDecrypt(extractedAesKey, encryptedBase64Url);
    }

    /**
     * 使用固定的外部密钥进行加密
     *
     * @param plainText 待加密的明文
     * @param key       32 位的 HEX 格式密钥
     * @return Base64URL 编码的加密密文
     */
    public static String encryptWithFixedKey(String plainText, String key) {
        if (key == null || key.length() != 32) {
            throw new IllegalArgumentException("外部传入的 key 必须是 32 位的十六进制字符串。");
        }
        return performEncrypt(key, plainText);
    }

    /**
     * 使用固定的外部密钥进行解密
     *
     * @param encryptedBase64Url Base64URL 编码的加密密文
     * @param key                32 位的 HEX 格式密钥
     * @return 解密后的明文
     */
    public static String decryptWithFixedKey(String encryptedBase64Url, String key) {
        if (key == null || key.length() != 32) {
            throw new IllegalArgumentException("外部传入的 key 必须是 32 位的十六进制字符串。");
        }
        return performDecrypt(key, encryptedBase64Url);
    }

    /**
     * 执行加密操作
     */
    private static String performEncrypt(String hexKey, String plainText) {
        try {
            byte[] keyBytes = HexUtil.decodeHex(hexKey);
            SecretKeySpec secretKey = new SecretKeySpec(keyBytes, ALGORITHM);

            Cipher cipher = Cipher.getInstance(TRANSFORMATION);

            // 生成一个随机 IV (Initialization Vector)
            byte[] iv = new byte[16]; // AES block size is 16 bytes
            new SecureRandom().nextBytes(iv);
            IvParameterSpec ivSpec = new IvParameterSpec(iv);

            cipher.init(Cipher.ENCRYPT_MODE, secretKey, ivSpec);
            byte[] encryptedBytes = cipher.doFinal(plainText.getBytes(StandardCharsets.UTF_8));

            // 将 IV 和加密数据拼接在一起，然后进行 Base64URL 编码
            byte[] result = new byte[iv.length + encryptedBytes.length];
            System.arraycopy(iv, 0, result, 0, iv.length);
            System.arraycopy(encryptedBytes, 0, result, iv.length, encryptedBytes.length);

            return encodeBase64Url(result);
        } catch (Exception e) {
            throw new RuntimeException("加密失败", e);
        }
    }

    /**
     * 执行解密操作
     */
    private static String performDecrypt(String hexKey, String encryptedBase64Url) {
        try {
            byte[] keyBytes = HexUtil.decodeHex(hexKey);
            SecretKeySpec secretKey = new SecretKeySpec(keyBytes, ALGORITHM);

            // 先解码 Base64URL
            byte[] combinedData = decodeBase64Url(encryptedBase64Url);

            // 分离 IV 和加密数据
            byte[] iv = new byte[16];
            byte[] encryptedData = new byte[combinedData.length - 16];
            System.arraycopy(combinedData, 0, iv, 0, 16);
            System.arraycopy(combinedData, 16, encryptedData, 0, encryptedData.length);

            IvParameterSpec ivSpec = new IvParameterSpec(iv);

            Cipher cipher = Cipher.getInstance(TRANSFORMATION);
            cipher.init(Cipher.DECRYPT_MODE, secretKey, ivSpec);
            byte[] decryptedBytes = cipher.doFinal(encryptedData);

            return new String(decryptedBytes, StandardCharsets.UTF_8);
        } catch (Exception e) {
            throw new RuntimeException("解密失败", e);
        }
    }

    /**
     * 按照指定规则从 128 位 HEX 字符串中提取 32 位 HEX 字符串作为 AES 密钥
     * 规则：取第 1, 4, 8, 12, 16, 20, 24, 28, ... 直到 128 位
     * 数组索引为 0, 3, 7, 11, 15, 19, 23, 27, ...
     */
    private static String extractKeyFromFullKey(String fullKey) {
        if (fullKey.length() != 128) {
            throw new IllegalArgumentException("Full key must be 128 characters long.");
        }
        // 位置 1, 4, 8, 12, 16, 20, 24, 28, 32, 36, 40, 44, 48, 52, 56, 60 -> 对应数组索引 0, 3, 7, 11, 15, 19, 23, 27, 31, 35, 39, 43, 47, 51, 55, 59
        // 位置 64, 68, 72, 76, 80, 84, 88, 92, 96, 100, 104, 108, 112, 116, 120, 124 -> 对应数组索引 63, 67, 71, 75, 79, 83, 87, 91, 95, 99, 103, 107, 111, 115, 119, 123
        // 总共需要 16 个字符 * 2 = 32 位 HEX
        // 索引列表：0, 3, 7, 11, 15, 19, 23, 27, 31, 35, 39, 43, 47, 51, 55, 59, 63, 67, 71, 75, 79, 83, 87, 91, 95, 99, 103, 107, 111, 115, 119, 123
        int[] indices = {0, 3, 7, 11, 15, 19, 23, 27, 31, 35, 39, 43, 47, 51, 55, 59, 63, 67, 71, 75, 79, 83, 87, 91, 95, 99, 103, 107, 111, 115, 119, 123};
        StringBuilder correctSb = new StringBuilder();
        for (int index : indices) {
            correctSb.append(fullKey.charAt(index));
        }
        return correctSb.toString();
    }

    /**
     * 将字节数组编码为 Base64URL 字符串（无填充）
     */
    private static String encodeBase64Url(byte[] data) {
        return Base64.encodeUrlSafe(data);
    }

    /**
     * 将 Base64URL 字符串解码为字节数组（自动还原填充）
     */
    private static byte[] decodeBase64Url(String base64Url) {
        // 还原为标准 Base64：- -> +, _ -> /, 补齐 =
        String base64 = base64Url.replace('-', '+').replace('_', '/');
        // 补齐 padding
        int padLen = (4 - (base64.length() % 4)) % 4;
        base64 += "=".repeat(padLen);
        return Base64.decode(base64);
    }
}
