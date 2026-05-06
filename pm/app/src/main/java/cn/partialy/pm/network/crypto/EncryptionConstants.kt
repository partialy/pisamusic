package cn.partialy.pm.network.crypto

internal object EncryptionConstants {
    const val SECRET: String = "pisamusicpartial"
    const val ENC_VER: String = "1"
    const val HEADER_RANDOM: String = "x-pm-random"
    const val HEADER_VER: String = "x-pm-enc-ver"
    const val FULL_KEY_HEX_LENGTH: Int = 128
    const val IV_LENGTH: Int = 12
    const val TAG_LENGTH_BITS: Int = 128
}
