package cn.partialy.pm.audioeffect

data class StereoWidenerSettings(
    val enabled: Boolean = false,
    val stereoWidth: Int = AudioEffectState.STEREO_WIDTH_DEFAULT,
    val centerRetention: Int = AudioEffectState.CENTER_RETENTION_DEFAULT,
    val spatialDelayUs: Int = AudioEffectState.SPATIAL_DELAY_DEFAULT_US,
    val bassMonoProtectHz: Int = AudioEffectState.BASS_MONO_PROTECT_DEFAULT_HZ,
) {
    fun normalized(): StereoWidenerSettings =
        copy(
            stereoWidth = stereoWidth.coerceIn(
                AudioEffectState.STEREO_WIDTH_MIN,
                AudioEffectState.STEREO_WIDTH_MAX,
            ),
            centerRetention = centerRetention.coerceIn(
                AudioEffectState.CENTER_RETENTION_MIN,
                AudioEffectState.CENTER_RETENTION_MAX,
            ),
            spatialDelayUs = spatialDelayUs.coerceIn(
                AudioEffectState.SPATIAL_DELAY_MIN_US,
                AudioEffectState.SPATIAL_DELAY_MAX_US,
            ),
            bassMonoProtectHz = AudioEffectState.normalizeBassMonoProtectHz(bassMonoProtectHz),
        )

    fun requiresAudioProcessor(): Boolean {
        val current = normalized()
        return current.enabled &&
            (current.stereoWidth != AudioEffectState.STEREO_WIDTH_DEFAULT ||
                current.centerRetention != AudioEffectState.CENTER_RETENTION_DEFAULT ||
                current.spatialDelayUs > 0 ||
                current.bassMonoProtectHz > 0)
    }

    companion object {
        val DISABLED = StereoWidenerSettings()
    }
}
