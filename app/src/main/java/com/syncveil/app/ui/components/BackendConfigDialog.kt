package com.syncveil.app.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Cloud
import androidx.compose.material.icons.filled.CloudDone
import androidx.compose.material.icons.filled.Computer
import androidx.compose.material.icons.filled.Dns
import androidx.compose.material.icons.filled.Error
import androidx.compose.material.icons.filled.NetworkCheck
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Speed
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import com.syncveil.app.data.CloudSyncManager
import com.syncveil.app.data.api.ApiConfig
import com.syncveil.app.data.api.Environment
import com.syncveil.app.ui.theme.AppColors
import com.syncveil.app.ui.theme.SyncVeilTokens
import kotlinx.coroutines.launch

@Composable
fun BackendConfigDialog(
    cloudSyncManager: CloudSyncManager,
    onDismiss: () -> Unit
) {
    val coroutineScope = rememberCoroutineScope()
    var selectedEnv by remember { mutableStateOf(ApiConfig.currentEnvironment()) }
    var customUrlInput by remember { mutableStateOf(ApiConfig.currentBaseUrl) }
    var isTestingConnection by remember { mutableStateOf(false) }
    var testResult by remember { mutableStateOf<Pair<Boolean, String>?>(null) }

    val activeTargetUrl = if (selectedEnv == Environment.CUSTOM) {
        customUrlInput.trim()
    } else {
        selectedEnv.baseUrl
    }

    Dialog(onDismissRequest = onDismiss) {
        Surface(
            shape = RoundedCornerShape(16.dp),
            color = MaterialTheme.colorScheme.surface,
            tonalElevation = 6.dp,
            modifier = Modifier
                .fillMaxWidth()
                .padding(vertical = 16.dp)
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(20.dp)
                    .verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(14.dp)
            ) {
                // Dialog Header
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Box(
                            modifier = Modifier
                                .size(36.dp)
                                .clip(RoundedCornerShape(8.dp))
                                .background(AppColors.BluePrimary.copy(alpha = 0.15f)),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(
                                imageVector = Icons.Default.Dns,
                                contentDescription = "Backend Config",
                                tint = AppColors.BlueBright,
                                modifier = Modifier.size(20.dp)
                            )
                        }
                        Spacer(modifier = Modifier.width(10.dp))
                        Column {
                            Text(
                                text = "Backend Server Uplink",
                                style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold)
                            )
                            Text(
                                text = "Select or configure target API service",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                    }
                }

                HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)

                Text(
                    text = "SELECT ENVIRONMENT",
                    style = MaterialTheme.typography.labelSmall.copy(
                        fontFamily = FontFamily.Monospace,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        fontSize = 10.sp
                    )
                )

                // Environment Option Cards
                Environment.entries.forEach { env ->
                    val isSelected = selectedEnv == env
                    val (icon, tint) = when (env) {
                        Environment.PRODUCTION -> Icons.Default.CloudDone to AppColors.EmeraldSuccess
                        Environment.AI_STUDIO_DEV -> Icons.Default.Cloud to AppColors.BlueBright
                        Environment.LOCAL_EMULATOR -> Icons.Default.Computer to AppColors.AmberWarning
                        Environment.STAGING -> Icons.Default.Dns to AppColors.VioletIdentity
                        Environment.CUSTOM -> Icons.Default.NetworkCheck to SyncVeilTokens.AccentOrange
                    }

                    Surface(
                        shape = RoundedCornerShape(10.dp),
                        color = if (isSelected) MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.6f) else MaterialTheme.colorScheme.surface,
                        border = if (isSelected) {
                            androidx.compose.foundation.BorderStroke(1.5.dp, AppColors.BlueBright)
                        } else {
                            androidx.compose.foundation.BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant)
                        },
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable {
                                selectedEnv = env
                                testResult = null
                                if (env != Environment.CUSTOM) {
                                    customUrlInput = env.baseUrl
                                }
                            }
                    ) {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(12.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Box(
                                modifier = Modifier
                                    .size(32.dp)
                                    .clip(RoundedCornerShape(6.dp))
                                    .background(tint.copy(alpha = 0.15f)),
                                contentAlignment = Alignment.Center
                            ) {
                                Icon(
                                    imageVector = icon,
                                    contentDescription = env.displayName,
                                    tint = tint,
                                    modifier = Modifier.size(18.dp)
                                )
                            }
                            Spacer(modifier = Modifier.width(10.dp))
                            Column(modifier = Modifier.weight(1f)) {
                                Text(
                                    text = env.displayName,
                                    style = MaterialTheme.typography.bodyMedium.copy(
                                        fontWeight = FontWeight.Bold,
                                        fontSize = 13.sp
                                    )
                                )
                                Text(
                                    text = if (env.baseUrl.isNotBlank()) env.baseUrl else "Enter custom URL below",
                                    style = MaterialTheme.typography.labelSmall.copy(
                                        fontFamily = FontFamily.Monospace,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                                        fontSize = 10.sp
                                    )
                                )
                            }
                            if (isSelected) {
                                Icon(
                                    imageVector = Icons.Default.CheckCircle,
                                    contentDescription = "Selected",
                                    tint = AppColors.BlueBright,
                                    modifier = Modifier.size(18.dp)
                                )
                            }
                        }
                    }
                }

                // Custom URL Input if Custom selected
                if (selectedEnv == Environment.CUSTOM) {
                    OutlinedTextField(
                        value = customUrlInput,
                        onValueChange = {
                            customUrlInput = it
                            testResult = null
                        },
                        label = { Text("Custom Server Endpoint URL") },
                        placeholder = { Text("https://your-backend.com or http://10.0.2.2:3000") },
                        singleLine = true,
                        shape = RoundedCornerShape(10.dp),
                        modifier = Modifier.fillMaxWidth()
                    )
                }

                // Connection Test Status Card
                if (testResult != null) {
                    val (success, msg) = testResult!!
                    Surface(
                        shape = RoundedCornerShape(8.dp),
                        color = if (success) AppColors.EmeraldSuccess.copy(alpha = 0.12f) else MaterialTheme.colorScheme.error.copy(alpha = 0.12f),
                        border = androidx.compose.foundation.BorderStroke(
                            1.dp,
                            if (success) AppColors.EmeraldSuccess.copy(alpha = 0.4f) else MaterialTheme.colorScheme.error.copy(alpha = 0.4f)
                        ),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Row(
                            modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Icon(
                                imageVector = if (success) Icons.Default.CheckCircle else Icons.Default.Error,
                                contentDescription = "Test Status",
                                tint = if (success) AppColors.EmeraldSuccess else MaterialTheme.colorScheme.error,
                                modifier = Modifier.size(16.dp)
                            )
                            Spacer(modifier = Modifier.width(8.dp))
                            Text(
                                text = msg,
                                style = MaterialTheme.typography.bodySmall.copy(
                                    fontWeight = FontWeight.Medium,
                                    fontSize = 12.sp,
                                    color = if (success) AppColors.EmeraldSuccess else MaterialTheme.colorScheme.error
                                )
                            )
                        }
                    }
                }

                // Test Ping Button
                OutlinedButton(
                    onClick = {
                        val testUrl = if (selectedEnv == Environment.CUSTOM) customUrlInput else selectedEnv.baseUrl
                        if (testUrl.isNotBlank()) {
                            isTestingConnection = true
                            testResult = null
                            coroutineScope.launch {
                                val res = cloudSyncManager.testBackendConnection(testUrl)
                                testResult = res
                                isTestingConnection = false
                            }
                        }
                    },
                    enabled = !isTestingConnection && activeTargetUrl.isNotBlank(),
                    shape = RoundedCornerShape(8.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    if (isTestingConnection) {
                        CircularProgressIndicator(
                            modifier = Modifier.size(16.dp),
                            strokeWidth = 2.dp,
                            color = AppColors.BlueBright
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        Text("Pinging Target Server...")
                    } else {
                        Icon(
                            imageVector = Icons.Default.Speed,
                            contentDescription = "Test Ping",
                            modifier = Modifier.size(16.dp),
                            tint = AppColors.BlueBright
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        Text("Test Server Latency & Health")
                    }
                }

                // Dialog Buttons
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.End,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    TextButton(onClick = onDismiss) {
                        Text("Cancel")
                    }
                    Spacer(modifier = Modifier.width(8.dp))
                    Button(
                        onClick = {
                            val finalUrl = if (selectedEnv == Environment.CUSTOM) {
                                customUrlInput.trim()
                            } else {
                                selectedEnv.baseUrl
                            }
                            if (finalUrl.isNotBlank()) {
                                cloudSyncManager.updateWebsiteUrl(finalUrl)
                            }
                            onDismiss()
                        },
                        enabled = activeTargetUrl.isNotBlank(),
                        shape = RoundedCornerShape(8.dp),
                        colors = ButtonDefaults.buttonColors(containerColor = AppColors.BluePrimary)
                    ) {
                        Text("Apply & Connect")
                    }
                }
            }
        }
    }
}
