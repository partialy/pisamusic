package cn.partialy.pm.ui.widget

import android.content.Context
import android.os.Build
import android.util.AttributeSet
import com.google.android.material.switchmaterial.SwitchMaterial

class PmSwitch @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null,
    defStyleAttr: Int = com.google.android.material.R.attr.switchStyle,
) : SwitchMaterial(context, attrs, defStyleAttr) {

    init {
        removeTouchRipple()
    }

    private fun removeTouchRipple() {
        background = null
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            foreground = null
        }
        stateListAnimator = null
    }
}
