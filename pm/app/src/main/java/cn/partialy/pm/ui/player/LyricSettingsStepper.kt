package cn.partialy.pm.ui.player

import android.view.KeyEvent
import android.view.MotionEvent
import android.view.View
import android.view.inputmethod.EditorInfo
import android.view.inputmethod.InputMethodManager
import android.content.Context
import android.widget.EditText

/** 数值编辑与长按步进共用同一有效值，非法输入回退到最后一次提交。 */
internal class LyricSettingsStepper(
    private val input: EditText,
    private val minus: View,
    private val plus: View,
    private val range: IntRange,
    initialValue: Int,
    private val onApply: (Int) -> Unit,
) {
    private var value = initialValue.coerceIn(range)
    private var repeatButton: View? = null
    private var repeatDelta = 0
    private val repeat = object : Runnable {
        override fun run() {
            if (repeatButton == null) return
            step(repeatDelta)
            repeatButton?.postDelayed(this, 100L)
        }
    }

    init {
        setValue(value)
        bindButton(minus, -1)
        bindButton(plus, 1)
        input.setOnFocusChangeListener { _, hasFocus -> if (!hasFocus) commit() }
        input.setOnEditorActionListener { _, actionId, event ->
            val enter = event?.keyCode == KeyEvent.KEYCODE_ENTER && event.action == KeyEvent.ACTION_DOWN
            if (enter || actionId == EditorInfo.IME_ACTION_DONE) {
                commit()
                input.clearFocus()
                (input.context.getSystemService(Context.INPUT_METHOD_SERVICE) as? InputMethodManager)
                    ?.hideSoftInputFromWindow(input.windowToken, 0)
                true
            } else false
        }
    }

    fun setValue(newValue: Int) {
        value = newValue.coerceIn(range)
        val text = value.toString()
        if (input.text.toString() != text) input.setText(text)
        minus.isEnabled = value > range.first
        plus.isEnabled = value < range.last
        minus.alpha = if (minus.isEnabled) 1f else 0.35f
        plus.alpha = if (plus.isEnabled) 1f else 0.35f
    }

    fun commit() {
        val parsed = input.text.toString().trim().toIntOrNull() ?: value
        apply(parsed.coerceIn(range))
    }

    fun stop() {
        repeatButton?.removeCallbacks(repeat)
        repeatButton = null
    }

    private fun apply(newValue: Int) {
        val changed = value != newValue
        setValue(newValue)
        if (changed) onApply(value)
    }

    private fun step(delta: Int) {
        val base = input.text.toString().trim().toIntOrNull()?.coerceIn(range) ?: value
        apply((base + delta).coerceIn(range))
        if (value == range.first || value == range.last) stop()
    }

    private fun bindButton(button: View, delta: Int) {
        button.setOnClickListener { step(delta) }
        button.setOnLongClickListener {
            stop()
            repeatButton = button
            repeatDelta = delta
            repeat.run()
            true
        }
        button.setOnTouchListener { _, event ->
            if (event.actionMasked == MotionEvent.ACTION_UP || event.actionMasked == MotionEvent.ACTION_CANCEL) stop()
            false
        }
    }
}
