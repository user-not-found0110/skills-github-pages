package com.personalapp.missedcallreply

import android.Manifest
import android.annotation.SuppressLint
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import android.telephony.SubscriptionInfo
import android.telephony.SubscriptionManager
import android.widget.ArrayAdapter
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.core.content.ContextCompat.startForegroundService
import com.personalapp.missedcallreply.databinding.ActivityMainBinding

class MainActivity : AppCompatActivity() {

    private lateinit var binding: ActivityMainBinding
    private var simList: List<SubscriptionInfo> = emptyList()

    private val permissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { results ->
        if (results.values.all { it }) {
            loadSims()
            loadPreferences()
        } else {
            val denied = results.filterValues { !it }.keys
            val anyPermanentlyDenied = denied.any {
                !shouldShowRequestPermissionRationale(it)
            }
            if (anyPermanentlyDenied) {
                showOpenSettingsDialog()
            } else {
                Toast.makeText(this, getString(R.string.permission_rationale), Toast.LENGTH_LONG).show()
            }
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)

        binding.btnSave.setOnClickListener { saveSettings() }

        binding.switchEnable.setOnCheckedChangeListener { _, isChecked ->
            PreferencesManager.setEnabled(this, isChecked)
            if (isChecked) startMonitoringService() else stopMonitoringService()
        }

        checkAndRequestPermissions()
    }

    override fun onResume() {
        super.onResume()
        if (allPermissionsGranted()) {
            loadSims()
            loadPreferences()
        }
    }

    private fun checkAndRequestPermissions() {
        val toRequest = buildRequiredPermissions().filter {
            ContextCompat.checkSelfPermission(this, it) != PackageManager.PERMISSION_GRANTED
        }

        if (toRequest.isEmpty()) {
            loadSims()
            loadPreferences()
            return
        }

        val needsRationale = toRequest.any { shouldShowRequestPermissionRationale(it) }
        if (needsRationale) {
            AlertDialog.Builder(this)
                .setTitle(R.string.app_name)
                .setMessage(R.string.permission_rationale)
                .setPositiveButton(android.R.string.ok) { _, _ ->
                    permissionLauncher.launch(toRequest.toTypedArray())
                }
                .setNegativeButton(android.R.string.cancel, null)
                .show()
        } else {
            permissionLauncher.launch(toRequest.toTypedArray())
        }
    }

    private fun buildRequiredPermissions(): List<String> = buildList {
        add(Manifest.permission.READ_PHONE_STATE)
        add(Manifest.permission.READ_CALL_LOG)
        add(Manifest.permission.SEND_SMS)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            add(Manifest.permission.READ_PHONE_NUMBERS)
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            add(Manifest.permission.POST_NOTIFICATIONS)
        }
    }

    private fun allPermissionsGranted() = buildRequiredPermissions().all {
        ContextCompat.checkSelfPermission(this, it) == PackageManager.PERMISSION_GRANTED
    }

    @SuppressLint("MissingPermission")
    private fun loadSims() {
        val sm = getSystemService(SubscriptionManager::class.java)
        simList = sm.activeSubscriptionInfoList ?: emptyList()

        if (simList.isEmpty()) {
            binding.tvStatus.text = getString(R.string.status_no_sims)
            binding.btnSave.isEnabled = false
            return
        }

        val displayNames = simList.mapIndexed { index, info ->
            val number = info.number?.takeIf { it.isNotBlank() } ?: getString(R.string.sim_unknown_number)
            "SIM ${index + 1}: ${info.displayName} ($number)"
        }

        val adapter = ArrayAdapter(this, android.R.layout.simple_spinner_item, displayNames)
        adapter.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item)
        binding.spinnerSim.adapter = adapter

        val savedSubId = PreferencesManager.getSubscriptionId(this)
        val savedIndex = simList.indexOfFirst { it.subscriptionId == savedSubId }
        if (savedIndex >= 0) binding.spinnerSim.setSelection(savedIndex)

        binding.btnSave.isEnabled = true
    }

    private fun loadPreferences() {
        binding.switchEnable.isChecked = PreferencesManager.isEnabled(this)
        binding.editReplyMessage.setText(PreferencesManager.getReplyMessage(this))
    }

    private fun saveSettings() {
        val selectedIndex = binding.spinnerSim.selectedItemPosition
        if (selectedIndex < 0 || selectedIndex >= simList.size) return

        val subId = simList[selectedIndex].subscriptionId
        val message = binding.editReplyMessage.text.toString().trim()

        if (message.isBlank()) {
            Toast.makeText(this, R.string.error_empty_message, Toast.LENGTH_SHORT).show()
            return
        }

        PreferencesManager.setSubscriptionId(this, subId)
        PreferencesManager.setReplyMessage(this, message)
        PreferencesManager.setEnabled(this, binding.switchEnable.isChecked)

        if (binding.switchEnable.isChecked) {
            startMonitoringService()
        } else {
            stopMonitoringService()
        }

        binding.tvStatus.text = getString(R.string.status_saved)
    }

    private fun startMonitoringService() {
        startForegroundService(this, Intent(this, CallStateService::class.java))
        binding.tvStatus.text = getString(R.string.status_service_started)
    }

    private fun stopMonitoringService() {
        stopService(Intent(this, CallStateService::class.java))
        binding.tvStatus.text = getString(R.string.status_service_stopped)
    }

    private fun showOpenSettingsDialog() {
        AlertDialog.Builder(this)
            .setTitle(R.string.app_name)
            .setMessage(R.string.permission_permanently_denied)
            .setPositiveButton(R.string.open_settings) { _, _ ->
                startActivity(
                    Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
                        data = Uri.fromParts("package", packageName, null)
                    }
                )
            }
            .setNegativeButton(android.R.string.cancel, null)
            .show()
    }
}
