package cn.partialy.pm.ui.player

import android.app.Activity
import android.graphics.Color
import android.graphics.drawable.GradientDrawable
import android.view.View
import com.google.android.material.dialog.MaterialAlertDialogBuilder
import com.google.android.material.slider.Slider
import cn.partialy.pm.R

object LyricColorPickerDialog {

    enum class Mode {
        /** 仅 RGB，用于常规行（透明度由主界面「非当前行不透明度」控制） */
        NORMAL_RGB,
        /** 完整 ARGB，用于当前行 */
        CURRENT_ARGB,
    }

    fun show(
        activity: Activity,
        initialColor: Int,
        mode: Mode,
        onPick: (Int) -> Unit,
    ) {
        val root = activity.layoutInflater.inflate(R.layout.dialog_lyric_color_picker, null)
        val preview = root.findViewById<View>(R.id.lyricColorPickerPreview)
        val sliderR = root.findViewById<Slider>(R.id.lyricColorPickerSliderR)
        val sliderG = root.findViewById<Slider>(R.id.lyricColorPickerSliderG)
        val sliderB = root.findViewById<Slider>(R.id.lyricColorPickerSliderB)
        val sliderA = root.findViewById<Slider>(R.id.lyricColorPickerSliderA)
        val alphaLabel = root.findViewById<View>(R.id.lyricColorPickerAlphaLabel)

        fun updatePreview(argb: Int) {
            val bg = GradientDrawable().apply {
                shape = GradientDrawable.RECTANGLE
                cornerRadius = 8f * activity.resources.displayMetrics.density
                setColor(argb)
                setStroke(1, 0x66000000.toInt())
            }
            preview.background = bg
        }

        var r = Color.red(initialColor)
        var g = Color.green(initialColor)
        var b = Color.blue(initialColor)
        var a = Color.alpha(initialColor).coerceIn(0, 255)

        val showAlpha = mode == Mode.CURRENT_ARGB
        alphaLabel.visibility = if (showAlpha) View.VISIBLE else View.GONE
        sliderA.visibility = if (showAlpha) View.VISIBLE else View.GONE

        fun combinedColor(): Int =
            if (showAlpha) Color.argb(a, r, g, b) else Color.rgb(r, g, b)

        sliderR.value = r.toFloat()
        sliderG.value = g.toFloat()
        sliderB.value = b.toFloat()
        if (showAlpha) sliderA.value = a.toFloat()
        updatePreview(combinedColor())

        sliderR.addOnChangeListener { _, value, _ ->
            r = value.toInt().coerceIn(0, 255)
            updatePreview(combinedColor())
        }
        sliderG.addOnChangeListener { _, value, _ ->
            g = value.toInt().coerceIn(0, 255)
            updatePreview(combinedColor())
        }
        sliderB.addOnChangeListener { _, value, _ ->
            b = value.toInt().coerceIn(0, 255)
            updatePreview(combinedColor())
        }
        sliderA.addOnChangeListener { _, value, _ ->
            a = value.toInt().coerceIn(0, 255)
            updatePreview(combinedColor())
        }

        MaterialAlertDialogBuilder(activity)
            .setTitle(
                when (mode) {
                    Mode.NORMAL_RGB -> activity.getString(R.string.lyric_color_picker_title_normal)
                    Mode.CURRENT_ARGB -> activity.getString(R.string.lyric_color_picker_title_current)
                },
            )
            .setView(root)
            .setPositiveButton(R.string.lyric_color_picker_ok) { _, _ ->
                onPick(combinedColor())
            }
            .setNegativeButton(R.string.cancel, null)
            .show()
    }
}
