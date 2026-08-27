package cn.partialy.pm.activity

import android.content.Intent
import android.os.Bundle
import android.view.KeyEvent
import android.view.View
import android.view.ViewGroup
import android.widget.ImageButton
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.updateLayoutParams
import cn.partialy.pm.R
import cn.partialy.pm.scan.QrImageDecoder
import cn.partialy.pm.ui.insets.enableEdgeToEdgeSystemBars
import com.google.zxing.BarcodeFormat
import com.journeyapps.barcodescanner.CaptureManager
import com.journeyapps.barcodescanner.DecoratedBarcodeView
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

class PortraitCaptureActivity : ComponentActivity() {
    private lateinit var captureManager: CaptureManager
    private lateinit var barcodeScannerView: DecoratedBarcodeView
    private val scanScope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)
    private var torchEnabled = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdgeSystemBars(lightStatusBarIcons = false, lightNavigationBarIcons = false)
        barcodeScannerView = initializeContent()
        captureManager = CaptureManager(this, barcodeScannerView)
        captureManager.initializeFromIntent(intent, savedInstanceState)
        captureManager.decode()
    }

    private fun initializeContent(): DecoratedBarcodeView {
        setContentView(R.layout.zxing_capture)
        val scanner = findViewById<DecoratedBarcodeView>(R.id.zxing_barcode_scanner)
        scanner.statusView?.visibility = View.GONE
        applyHeaderStatusBarInset()

        findViewById<ImageButton>(R.id.scan_back_button).setOnClickListener {
            finish()
        }
        findViewById<ImageButton>(R.id.scan_torch_button).setOnClickListener { button ->
            toggleTorch(button as ImageButton)
        }
        findViewById<ImageButton>(R.id.scan_album_button).setOnClickListener {
            openImagePicker()
        }
        return scanner
    }

    private fun applyHeaderStatusBarInset() {
        val header = findViewById<View>(R.id.scan_header)
        ViewCompat.setOnApplyWindowInsetsListener(header) { view, insets ->
            val statusBarTop = insets.getInsets(WindowInsetsCompat.Type.statusBars()).top
            val displayCutoutTop = insets.displayCutout?.safeInsetTop ?: 0
            view.updateLayoutParams<ViewGroup.MarginLayoutParams> {
                topMargin = maxOf(statusBarTop, displayCutoutTop)
            }
            insets
        }
        ViewCompat.requestApplyInsets(header)
    }

    private fun toggleTorch(button: ImageButton) {
        torchEnabled = !torchEnabled
        if (torchEnabled) {
            barcodeScannerView.setTorchOn()
        } else {
            barcodeScannerView.setTorchOff()
        }
        button.isSelected = torchEnabled
    }

    private fun openImagePicker() {
        val intent = Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
            addCategory(Intent.CATEGORY_OPENABLE)
            type = "image/*"
        }
        runCatching {
            startActivityForResult(intent, REQUEST_PICK_IMAGE)
        }.onFailure {
            Toast.makeText(this, R.string.scan_album_open_failed, Toast.LENGTH_SHORT).show()
        }
    }

    @Deprecated("Deprecated in android.app.Activity, but keeps this scan Activity lightweight.")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode != REQUEST_PICK_IMAGE || resultCode != RESULT_OK) return
        val uri = data?.data ?: return

        scanScope.launch {
            val content = withContext(Dispatchers.IO) {
                QrImageDecoder.decode(contentResolver, uri)
            }
            if (content.isNullOrBlank()) {
                Toast.makeText(
                    this@PortraitCaptureActivity,
                    R.string.scan_album_decode_failed,
                    Toast.LENGTH_SHORT,
                ).show()
            } else {
                returnGalleryScanResult(content)
            }
        }
    }

    private fun returnGalleryScanResult(content: String) {
        setResult(
            RESULT_OK,
            Intent().apply {
                putExtra(SCAN_RESULT, content)
                putExtra(SCAN_RESULT_FORMAT, BarcodeFormat.QR_CODE.toString())
            },
        )
        finish()
    }

    override fun onResume() {
        super.onResume()
        captureManager.onResume()
    }

    override fun onPause() {
        super.onPause()
        captureManager.onPause()
    }

    override fun onDestroy() {
        scanScope.cancel()
        captureManager.onDestroy()
        super.onDestroy()
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        captureManager.onSaveInstanceState(outState)
    }

    override fun onRequestPermissionsResult(
        requestCode: Int,
        permissions: Array<out String>,
        grantResults: IntArray,
    ) {
        captureManager.onRequestPermissionsResult(requestCode, permissions, grantResults)
    }

    override fun onKeyDown(keyCode: Int, event: KeyEvent): Boolean {
        return barcodeScannerView.onKeyDown(keyCode, event) || super.onKeyDown(keyCode, event)
    }

    private companion object {
        const val REQUEST_PICK_IMAGE = 2401
        const val SCAN_RESULT = "SCAN_RESULT"
        const val SCAN_RESULT_FORMAT = "SCAN_RESULT_FORMAT"
    }
}
