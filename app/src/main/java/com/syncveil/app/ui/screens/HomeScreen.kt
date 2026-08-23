package com.syncveil.app.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowForward
import androidx.compose.material.icons.filled.*
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.syncveil.app.ui.components.*
import com.syncveil.app.ui.theme.SyncVeilTokens

@Composable
fun HomeScreen(
    onNavigateToAuth: () -> Unit,
    onNavigateToDashboard: () -> Unit,
    isLoggedIn: Boolean = false
) {
    val scrollState = rememberScrollState()
    var isLiveScanning by remember { mutableStateOf(false) }

    Scaffold(
        topBar = {
            SyncVeilTopAppBar(
                title = "SYNCVEIL",
                actions = {
                    Surface(
                        shape = RoundedCornerShape(6.dp),
                        color = SyncVeilTokens.SecureGreen.copy(alpha = 0.12f),
                        border = androidx.compose.foundation.BorderStroke(1.dp, SyncVeilTokens.SecureGreen.copy(alpha = 0.35f)),
                        modifier = Modifier.padding(end = 4.dp)
                    ) {
                        Row(
                            modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Box(
                                modifier = Modifier
                                    .size(6.dp)
                                    .clip(CircleShape)
                                    .background(SyncVeilTokens.SecureGreen)
                            )
                            Spacer(modifier = Modifier.width(5.dp))
                            Text(
                                text = "PROTECTED",
                                style = MaterialTheme.typography.labelSmall.copy(
                                    fontFamily = FontFamily.Monospace,
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 9.sp,
                                    color = SyncVeilTokens.SecureGreen,
                                    letterSpacing = 0.5.sp
                                )
                            )
                        }
                    }
                }
            )
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .padding(padding)
                .fillMaxSize()
                .background(MaterialTheme.colorScheme.background)
                .verticalScroll(scrollState)
                .padding(horizontal = 20.dp, vertical = 18.dp),
            horizontalAlignment = Alignment.Start
        ) {
            // Live Status HUD
            EnterpriseStatusHud(
                isOperational = true,
                pingMs = 18,
                cipher = "AES-256-GCM + KYBER-1024"
            )

            Spacer(modifier = Modifier.height(28.dp))

            // Editorial Tag
            Surface(
                shape = RoundedCornerShape(6.dp),
                color = SyncVeilTokens.AccentOrange.copy(alpha = 0.12f),
                border = androidx.compose.foundation.BorderStroke(1.dp, SyncVeilTokens.AccentOrange.copy(alpha = 0.35f))
            ) {
                Text(
                    text = "NEXT-GENERATION SECURITY WORKSPACE",
                    style = MaterialTheme.typography.labelSmall.copy(
                        fontFamily = FontFamily.Monospace,
                        fontWeight = FontWeight.Bold,
                        color = SyncVeilTokens.AccentOrange,
                        letterSpacing = 1.sp,
                        fontSize = 10.sp
                    ),
                    modifier = Modifier.padding(horizontal = 10.dp, vertical = 5.dp)
                )
            }

            Spacer(modifier = Modifier.height(16.dp))

            // Headline
            Text(
                text = "YOUR DIGITAL LIFE.\nSECURED.",
                style = MaterialTheme.typography.displaySmall.copy(
                    fontWeight = FontWeight.Black,
                    letterSpacing = (-1).sp,
                    lineHeight = 40.sp,
                    color = MaterialTheme.colorScheme.onBackground
                )
            )

            Spacer(modifier = Modifier.height(12.dp))

            // Subhead
            Text(
                text = "SyncVeil protects your files, identity and digital security from one private workspace.",
                style = MaterialTheme.typography.bodyLarge.copy(
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    lineHeight = 24.sp
                )
            )

            Spacer(modifier = Modifier.height(24.dp))

            // Primary Call to Action Button
            Button(
                onClick = if (isLoggedIn) onNavigateToDashboard else onNavigateToAuth,
                modifier = Modifier
                    .fillMaxWidth()
                    .height(52.dp),
                shape = RoundedCornerShape(10.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = SyncVeilTokens.AccentOrange,
                    contentColor = Color.White
                )
            ) {
                Text(
                    text = if (isLoggedIn) "Open Command Console" else "Get Started",
                    style = MaterialTheme.typography.titleMedium.copy(
                        fontWeight = FontWeight.Bold,
                        letterSpacing = 0.3.sp
                    )
                )
                Spacer(modifier = Modifier.width(8.dp))
                Icon(
                    imageVector = Icons.AutoMirrored.Filled.ArrowForward,
                    contentDescription = null,
                    modifier = Modifier.size(18.dp)
                )
            }

            Spacer(modifier = Modifier.height(10.dp))

            OutlinedButton(
                onClick = onNavigateToDashboard,
                modifier = Modifier
                    .fillMaxWidth()
                    .height(48.dp),
                shape = RoundedCornerShape(10.dp),
                border = androidx.compose.foundation.BorderStroke(1.dp, MaterialTheme.colorScheme.outline),
                colors = ButtonDefaults.outlinedButtonColors(
                    contentColor = MaterialTheme.colorScheme.onSurface
                )
            ) {
                Icon(
                    imageVector = Icons.Outlined.Shield,
                    contentDescription = null,
                    modifier = Modifier.size(18.dp),
                    tint = MaterialTheme.colorScheme.onSurfaceVariant
                )
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    text = "Explore Security Console",
                    style = MaterialTheme.typography.labelLarge.copy(fontWeight = FontWeight.SemiBold)
                )
            }

            Spacer(modifier = Modifier.height(30.dp))

            // Live Scan Indicator Bar
            SyncVeilLiveScanBar(
                isScanning = isLiveScanning,
                onTriggerScan = {
                    isLiveScanning = true
                }
            )

            Spacer(modifier = Modifier.height(16.dp))

            // Security Score Card
            SyncVeilSecurityScoreCard(
                targetScore = 98,
                statusText = "Excellent",
                summaryText = "Zero vulnerabilities detected. Hardware keys synchronized with zero-knowledge enclave.",
                onScanClick = {
                    isLiveScanning = !isLiveScanning
                }
            )

            Spacer(modifier = Modifier.height(16.dp))

            // Security Topology Visualization
            SyncVeilSecurityVisualization(
                modifier = Modifier.fillMaxWidth()
            )

            Spacer(modifier = Modifier.height(24.dp))

            // Pillar Action Grid
            Text(
                text = "PROTECTION MODULES",
                style = MaterialTheme.typography.labelSmall.copy(
                    fontFamily = FontFamily.Monospace,
                    fontWeight = FontWeight.Bold,
                    fontSize = 11.sp,
                    letterSpacing = 1.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            )

            Spacer(modifier = Modifier.height(12.dp))

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                EnterpriseActionTile(
                    title = "SSCE-v3 Vault",
                    subtitle = "Quantum-grade keys",
                    icon = Icons.Outlined.Lock,
                    accentColor = SyncVeilTokens.AccentOrange,
                    onClick = onNavigateToDashboard,
                    modifier = Modifier.weight(1f)
                )

                EnterpriseActionTile(
                    title = "Instant OTP",
                    subtitle = "6-Digit push token",
                    icon = Icons.Outlined.MarkEmailRead,
                    accentColor = SyncVeilTokens.SecureGreen,
                    onClick = onNavigateToAuth,
                    modifier = Modifier.weight(1f)
                )
            }

            Spacer(modifier = Modifier.height(10.dp))

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                EnterpriseActionTile(
                    title = "Passkey Enclave",
                    subtitle = "Biometric hardware",
                    icon = Icons.Outlined.Fingerprint,
                    accentColor = SyncVeilTokens.AccentOrange,
                    onClick = onNavigateToAuth,
                    modifier = Modifier.weight(1f)
                )

                EnterpriseActionTile(
                    title = "Cloud Console",
                    subtitle = "syncveil.software",
                    icon = Icons.Outlined.CloudSync,
                    accentColor = SyncVeilTokens.NeutralSlate,
                    onClick = onNavigateToDashboard,
                    modifier = Modifier.weight(1f)
                )
            }

            Spacer(modifier = Modifier.height(20.dp))

            // Compliance & Infrastructure Specs Card
            SyncVeilCard(
                modifier = Modifier.fillMaxWidth(),
                cornerRadius = 10.dp,
                contentPadding = PaddingValues(14.dp)
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        "SECURITY & COMPLIANCE SPECS",
                        style = MaterialTheme.typography.labelSmall.copy(
                            fontFamily = FontFamily.Monospace,
                            fontWeight = FontWeight.Bold,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            letterSpacing = 0.5.sp,
                            fontSize = 10.sp
                        )
                    )
                    Surface(
                        shape = RoundedCornerShape(4.dp),
                        color = SyncVeilTokens.SecureGreen.copy(alpha = 0.15f)
                    ) {
                        Text(
                            "PASSING",
                            style = MaterialTheme.typography.labelSmall.copy(
                                fontWeight = FontWeight.Bold,
                                color = SyncVeilTokens.SecureGreen,
                                fontSize = 9.sp
                            ),
                            modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                        )
                    }
                }

                Spacer(modifier = Modifier.height(12.dp))

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    listOf("SOC 2 Type II", "FIPS 140-3", "Kyber-1024", "Zero-Egress").forEach { spec ->
                        Surface(
                            shape = RoundedCornerShape(6.dp),
                            color = MaterialTheme.colorScheme.surfaceVariant,
                            border = androidx.compose.foundation.BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.4f)),
                            modifier = Modifier.weight(1f)
                        ) {
                            Text(
                                text = spec,
                                style = MaterialTheme.typography.labelSmall.copy(
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 9.5.sp
                                ),
                                textAlign = TextAlign.Center,
                                modifier = Modifier.padding(vertical = 8.dp, horizontal = 2.dp)
                            )
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.height(24.dp))
        }
    }
}
