package com.syncveil.app.ui.screens

import android.app.Application
import androidx.compose.animation.*
import androidx.compose.animation.core.*
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowForward
import androidx.compose.material.icons.automirrored.filled.ExitToApp
import androidx.compose.material.icons.filled.*
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewmodel.compose.viewModel
import com.syncveil.app.data.CloudSyncManager
import com.syncveil.app.data.TelemetryEvent
import com.syncveil.app.ui.components.*
import com.syncveil.app.ui.theme.AppColors
import com.syncveil.app.ui.theme.LocalThemeController
import com.syncveil.app.ui.theme.SyncVeilTokens
import com.syncveil.app.ui.theme.ThemeMode

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DashboardScreen(
    onNavigateToVault: () -> Unit,
    onNavigateToAuth: () -> Unit,
    onLogout: () -> Unit,
    authViewModel: AuthViewModel = viewModel(
        factory = ViewModelProvider.AndroidViewModelFactory.getInstance(
            LocalContext.current.applicationContext as Application
        )
    )
) {
    val themeController = LocalThemeController.current
    val context = LocalContext.current
    val cloudSyncManager = remember { CloudSyncManager.getInstance(context) }
    val syncState by cloudSyncManager.syncState.collectAsState()

    val isLoggedIn by authViewModel.isLoggedIn.collectAsState()
    val fullName by authViewModel.currentFullName.collectAsState()
    val email by authViewModel.currentUserEmail.collectAsState()
    val is2faActive by authViewModel.is2faActive.collectAsState()

    var showLogoutDialog by remember { mutableStateOf(false) }
    var showWebConfigDialog by remember { mutableStateOf(false) }
    var webUrlInput by remember { mutableStateOf(syncState.websiteUrl) }
    var telemetryFilter by remember { mutableStateOf("ALL") }

    val infiniteRotation = rememberInfiniteTransition(label = "sync_spin")
    val syncSpinAngle by infiniteRotation.animateFloat(
        initialValue = 0f,
        targetValue = 360f,
        animationSpec = infiniteRepeatable(
            animation = tween(900, easing = LinearEasing),
            repeatMode = RepeatMode.Restart
        ),
        label = "sync_spin_angle"
    )

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Box(
                            modifier = Modifier
                                .size(34.dp)
                                .clip(RoundedCornerShape(8.dp))
                                .background(AppColors.BluePrimary),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(
                                Icons.Default.Shield,
                                contentDescription = "SyncVeil Enterprise",
                                tint = Color.White,
                                modifier = Modifier.size(20.dp)
                            )
                        }
                        Spacer(modifier = Modifier.width(10.dp))
                        Column {
                            Text(
                                "Command Console",
                                style = MaterialTheme.typography.titleMedium.copy(
                                    fontWeight = FontWeight.Bold,
                                    letterSpacing = (-0.3).sp
                                )
                            )
                            Text(
                                "SYNCVEIL ZERO-TRUST • TENANT SV-994",
                                style = MaterialTheme.typography.labelSmall.copy(
                                    fontFamily = FontFamily.Monospace,
                                    fontSize = 9.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = AppColors.EmeraldSuccess
                                )
                            )
                        }
                    }
                },
                actions = {
                    IconButton(
                        onClick = { themeController.toggleDarkLight() }
                    ) {
                        Icon(
                            imageVector = if (themeController.themeMode == ThemeMode.LIGHT) Icons.Outlined.DarkMode else Icons.Outlined.LightMode,
                            contentDescription = "Toggle Theme",
                            tint = SyncVeilTokens.AccentOrange
                        )
                    }

                    IconButton(
                        onClick = { cloudSyncManager.triggerCloudSync() }
                    ) {
                        Icon(
                            imageVector = Icons.Default.Sync,
                            contentDescription = "Sync Now",
                            tint = SyncVeilTokens.AccentOrange,
                            modifier = if (syncState.isSyncing) Modifier.rotate(syncSpinAngle) else Modifier
                        )
                    }

                    if (isLoggedIn) {
                        IconButton(onClick = { showLogoutDialog = true }) {
                            Icon(
                                Icons.AutoMirrored.Filled.ExitToApp,
                                contentDescription = "Lock Session",
                                tint = MaterialTheme.colorScheme.error
                            )
                        }
                    } else {
                        Button(
                            onClick = onNavigateToAuth,
                            shape = RoundedCornerShape(8.dp),
                            contentPadding = PaddingValues(horizontal = 12.dp, vertical = 4.dp),
                            colors = ButtonDefaults.buttonColors(containerColor = AppColors.BluePrimary),
                            modifier = Modifier.padding(end = 8.dp)
                        ) {
                            Text("Sign In", style = MaterialTheme.typography.labelMedium.copy(fontWeight = FontWeight.Bold))
                        }
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.background
                )
            )
        }
    ) { padding ->
        LazyColumn(
            modifier = Modifier
                .padding(padding)
                .fillMaxSize()
                .background(MaterialTheme.colorScheme.background),
            contentPadding = PaddingValues(horizontal = 16.dp, vertical = 12.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp)
        ) {
            // 1. Enterprise Enclave Status HUD
            item {
                EnterpriseStatusHud(
                    isOperational = true,
                    pingMs = syncState.pingMs.toLong(),
                    cipher = "AES-256-GCM + KYBER-1024"
                )
            }

            // 2. Enterprise Digital ID Card Box
            item {
                EnterpriseIdentityCard(
                    fullName = fullName,
                    email = email,
                    tenantId = if (isLoggedIn) "SV-CORP-94812" else "GUEST-DEMO-ACCESS",
                    isVerified = isLoggedIn,
                    is2faActive = is2faActive
                )
            }

            // 3. Four Enterprise Metric Boxes (2x2 Grid)
            item {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        EnterpriseMetricBox(
                            title = "Security Posture",
                            value = "98.8%",
                            subValue = "OPTIMAL",
                            icon = Icons.Default.VerifiedUser,
                            accentColor = AppColors.EmeraldSuccess,
                            modifier = Modifier.weight(1f)
                        )

                        EnterpriseMetricBox(
                            title = "Threats Deflected",
                            value = "${syncState.activeThreatsBlocked}",
                            subValue = "BLOCKED",
                            icon = Icons.Default.Shield,
                            accentColor = AppColors.BlueBright,
                            modifier = Modifier.weight(1f)
                        )
                    }

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        EnterpriseMetricBox(
                            title = "Enclave Latency",
                            value = "${syncState.pingMs} ms",
                            subValue = "REALTIME",
                            icon = Icons.Default.Speed,
                            accentColor = AppColors.VioletIdentity,
                            modifier = Modifier.weight(1f)
                        )

                        EnterpriseMetricBox(
                            title = "Relay Status",
                            value = if (syncState.isSyncing) "Syncing" else "Online",
                            subValue = "99.99%",
                            icon = Icons.Default.CloudDone,
                            accentColor = AppColors.AmberWarning,
                            modifier = Modifier.weight(1f)
                        )
                    }
                }
            }

            // 4. Live Threat Radar & Interactive Defenses Box
            item {
                EnterpriseBox(modifier = Modifier.fillMaxWidth()) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column(modifier = Modifier.weight(1f)) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Box(
                                    modifier = Modifier
                                        .size(7.dp)
                                        .clip(CircleShape)
                                        .background(AppColors.EmeraldSuccess)
                                )
                                Spacer(modifier = Modifier.width(6.dp))
                                Text(
                                    "ZERO-TRUST HARDWARE INTERCEPTOR",
                                    style = MaterialTheme.typography.labelSmall.copy(
                                        fontFamily = FontFamily.Monospace,
                                        fontWeight = FontWeight.Bold,
                                        color = AppColors.BlueBright,
                                        fontSize = 10.sp
                                    )
                                )
                            }
                            Spacer(modifier = Modifier.height(4.dp))
                            Text(
                                text = "Quantum Cryptographic Defense",
                                style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold)
                            )
                            Spacer(modifier = Modifier.height(4.dp))
                            Text(
                                text = "Active hardware telemetry monitoring memory pages and network socket tunnels for unauthorized egress.",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }

                        Spacer(modifier = Modifier.width(12.dp))

                        IosLiveRadar(
                            radarColor = AppColors.BlueBright,
                            isScanning = true
                        )
                    }

                    Spacer(modifier = Modifier.height(14.dp))
                    HorizontalDivider(color = MaterialTheme.colorScheme.outline.copy(alpha = 0.5f))
                    Spacer(modifier = Modifier.height(12.dp))

                    // Interactive Defense Action Buttons
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        OutlinedButton(
                            onClick = { cloudSyncManager.triggerCloudSync() },
                            shape = RoundedCornerShape(8.dp),
                            modifier = Modifier.weight(1f),
                            contentPadding = PaddingValues(vertical = 8.dp)
                        ) {
                            Icon(Icons.Default.BugReport, contentDescription = null, modifier = Modifier.size(16.dp))
                            Spacer(modifier = Modifier.width(6.dp))
                            Text("Simulate Probe", style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.Bold))
                        }

                        Button(
                            onClick = { cloudSyncManager.triggerCloudSync() },
                            shape = RoundedCornerShape(8.dp),
                            colors = ButtonDefaults.buttonColors(containerColor = AppColors.BluePrimary),
                            modifier = Modifier.weight(1f),
                            contentPadding = PaddingValues(vertical = 8.dp)
                        ) {
                            Icon(Icons.Default.VpnKey, contentDescription = null, modifier = Modifier.size(16.dp))
                            Spacer(modifier = Modifier.width(6.dp))
                            Text("Rotate Keys", style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.Bold))
                        }
                    }
                }
            }

            // 5. Linked Web Console Synchronization Box
            item {
                EnterpriseBox(modifier = Modifier.fillMaxWidth()) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Box(
                                modifier = Modifier
                                    .size(38.dp)
                                    .clip(RoundedCornerShape(8.dp))
                                    .background(AppColors.BluePrimary.copy(alpha = 0.14f)),
                                contentAlignment = Alignment.Center
                            ) {
                                Icon(
                                    Icons.Default.CloudSync,
                                    contentDescription = "Website Sync",
                                    tint = AppColors.BlueBright,
                                    modifier = Modifier.size(22.dp)
                                )
                            }
                            Spacer(modifier = Modifier.width(10.dp))
                            Column {
                                Text(
                                    "Web Console Uplink",
                                    style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold)
                                )
                                Text(
                                    syncState.websiteUrl,
                                    style = MaterialTheme.typography.bodySmall.copy(
                                        fontFamily = FontFamily.Monospace,
                                        color = AppColors.BlueBright,
                                        fontWeight = FontWeight.SemiBold
                                    )
                                )
                            }
                        }

                        IconButton(onClick = {
                            webUrlInput = syncState.websiteUrl
                            showWebConfigDialog = true
                        }) {
                            Icon(
                                Icons.Outlined.Settings,
                                contentDescription = "Configure Sync",
                                tint = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                    }

                    Spacer(modifier = Modifier.height(12.dp))

                    if (syncState.isSyncing) {
                        Column {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween
                            ) {
                                Text(
                                    "Synchronizing Zero-Knowledge Datastore...",
                                    style = MaterialTheme.typography.labelSmall.copy(color = AppColors.BlueBright)
                                )
                                Text(
                                    "${(syncState.syncProgress * 100).toInt()}%",
                                    style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.Bold)
                                )
                            }
                            Spacer(modifier = Modifier.height(6.dp))
                            LinearProgressIndicator(
                                progress = { syncState.syncProgress },
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .height(6.dp)
                                    .clip(RoundedCornerShape(3.dp)),
                                color = AppColors.BluePrimary,
                                trackColor = MaterialTheme.colorScheme.surfaceVariant
                            )
                        }
                    } else {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                "Last synced: ${syncState.lastSyncFormatted}",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )

                            Button(
                                onClick = { cloudSyncManager.triggerCloudSync() },
                                shape = RoundedCornerShape(8.dp),
                                colors = ButtonDefaults.buttonColors(containerColor = AppColors.BluePrimary),
                                contentPadding = PaddingValues(horizontal = 14.dp, vertical = 6.dp)
                            ) {
                                Icon(Icons.Default.Sync, contentDescription = "Sync", modifier = Modifier.size(16.dp))
                                Spacer(modifier = Modifier.width(6.dp))
                                Text(
                                    "Sync Uplink",
                                    style = MaterialTheme.typography.labelMedium.copy(fontWeight = FontWeight.Bold)
                                )
                            }
                        }
                    }
                }
            }

            // 6. Encrypted Vault Gateway Tile Box
            item {
                EnterpriseBox(
                    modifier = Modifier.fillMaxWidth(),
                    onClick = onNavigateToVault
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Box(
                                modifier = Modifier
                                    .size(46.dp)
                                    .clip(RoundedCornerShape(10.dp))
                                    .background(AppColors.VioletIdentity.copy(alpha = 0.15f)),
                                contentAlignment = Alignment.Center
                            ) {
                                Icon(
                                    Icons.Default.Lock,
                                    contentDescription = "Encrypted Vault",
                                    tint = AppColors.VioletIdentity,
                                    modifier = Modifier.size(24.dp)
                                )
                            }
                            Spacer(modifier = Modifier.width(14.dp))
                            Column {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Text(
                                        "Encrypted Vault Records",
                                        style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold)
                                    )
                                    Spacer(modifier = Modifier.width(6.dp))
                                    Surface(
                                        shape = RoundedCornerShape(4.dp),
                                        color = AppColors.EmeraldSuccess.copy(alpha = 0.15f)
                                    ) {
                                        Text(
                                            "SSCE-v3",
                                            style = MaterialTheme.typography.labelSmall.copy(
                                                color = AppColors.EmeraldSuccess,
                                                fontWeight = FontWeight.Bold,
                                                fontSize = 9.sp
                                            ),
                                            modifier = Modifier.padding(horizontal = 4.dp, vertical = 1.dp)
                                        )
                                    }
                                }
                                Text(
                                    "Client-side encrypted notes, credentials, and API secrets",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant
                                )
                            }
                        }

                        Icon(
                            Icons.AutoMirrored.Filled.ArrowForward,
                            contentDescription = "Open Vault",
                            tint = AppColors.BlueBright
                        )
                    }
                }
            }

            // 7. Live SOC Security Telemetry Terminal Stream
            item {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = "Live SOC Telemetry Stream",
                        style = MaterialTheme.typography.titleMedium.copy(
                            fontWeight = FontWeight.Bold,
                            letterSpacing = (-0.2).sp
                        )
                    )

                    Surface(
                        shape = RoundedCornerShape(6.dp),
                        color = MaterialTheme.colorScheme.surfaceVariant
                    ) {
                        Text(
                            text = "${syncState.liveEvents.size} PACKETS",
                            style = MaterialTheme.typography.labelSmall.copy(
                                fontFamily = FontFamily.Monospace,
                                fontWeight = FontWeight.Bold,
                                color = AppColors.BlueBright
                            ),
                            modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                        )
                    }
                }
            }

            items(syncState.liveEvents, key = { it.id }) { event ->
                EnterpriseTelemetryEventItem(event)
            }
        }

        // Web Console Config Dialog
        if (showWebConfigDialog) {
            BackendConfigDialog(
                cloudSyncManager = cloudSyncManager,
                onDismiss = { showWebConfigDialog = false }
            )
        }

        // Logout Confirmation Dialog
        if (showLogoutDialog) {
            AlertDialog(
                onDismissRequest = { showLogoutDialog = false },
                icon = { Icon(Icons.Default.Lock, contentDescription = "Logout", tint = MaterialTheme.colorScheme.error) },
                title = { Text("Lock Enterprise Vault") },
                text = { Text("This will purge active memory keys and lock the zero-trust hardware enclave.") },
                confirmButton = {
                    Button(
                        colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.error),
                        shape = RoundedCornerShape(8.dp),
                        onClick = {
                            showLogoutDialog = false
                            authViewModel.logout {
                                onLogout()
                            }
                        }
                    ) {
                        Text("Lock Vault")
                    }
                },
                dismissButton = {
                    TextButton(onClick = { showLogoutDialog = false }) {
                        Text("Cancel")
                    }
                }
            )
        }
    }
}

@Composable
private fun EnterpriseTelemetryEventItem(event: TelemetryEvent) {
    EnterpriseBox(
        modifier = Modifier.fillMaxWidth(),
        cornerRadius = 10.dp,
        contentPadding = PaddingValues(horizontal = 12.dp, vertical = 10.dp)
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically
        ) {
            val (icon, iconColor) = when (event.type) {
                "SYNC" -> Icons.Default.Sync to AppColors.BlueBright
                "THREAT_BLOCKED" -> Icons.Default.Shield to AppColors.EmeraldSuccess
                "ENCLAVE" -> Icons.Default.Fingerprint to AppColors.VioletIdentity
                else -> Icons.Default.VpnKey to AppColors.AmberWarning
            }

            Box(
                modifier = Modifier
                    .size(30.dp)
                    .clip(RoundedCornerShape(6.dp))
                    .background(iconColor.copy(alpha = 0.14f)),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector = icon,
                    contentDescription = event.type,
                    tint = iconColor,
                    modifier = Modifier.size(16.dp)
                )
            }

            Spacer(modifier = Modifier.width(10.dp))

            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = event.title,
                    style = MaterialTheme.typography.bodyMedium.copy(
                        fontWeight = FontWeight.SemiBold,
                        fontSize = 13.sp
                    )
                )
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        text = event.timestamp,
                        style = MaterialTheme.typography.labelSmall.copy(
                            fontFamily = FontFamily.Monospace,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            fontSize = 10.sp
                        )
                    )
                    Text(
                        text = " • ${event.latencyMs}ms",
                        style = MaterialTheme.typography.labelSmall.copy(
                            fontFamily = FontFamily.Monospace,
                            color = AppColors.BlueBright,
                            fontSize = 10.sp
                        )
                    )
                }
            }

            Surface(
                shape = RoundedCornerShape(4.dp),
                color = iconColor.copy(alpha = 0.14f)
            ) {
                Text(
                    text = event.type,
                    style = MaterialTheme.typography.labelSmall.copy(
                        fontFamily = FontFamily.Monospace,
                        fontWeight = FontWeight.Bold,
                        color = iconColor,
                        fontSize = 9.sp
                    ),
                    modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                )
            }
        }
    }
}

