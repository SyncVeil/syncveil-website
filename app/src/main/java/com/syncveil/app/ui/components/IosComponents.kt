package com.syncveil.app.ui.components

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.*
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutVertically
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.ArrowForward
import androidx.compose.material.icons.filled.*
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.syncveil.app.ui.theme.AppColors
import com.syncveil.app.ui.theme.LocalThemeController
import com.syncveil.app.ui.theme.SyncVeilTokens
import com.syncveil.app.ui.theme.ThemeMode
import kotlinx.coroutines.delay

/**
 * Core SyncVeil Understated Card
 *
 * Solid surface, 1dp thin border, subtle radius, strong typography, clear spacing.
 * Identical layout and hierarchy across Dark and Light mode.
 */
@Composable
fun SyncVeilCard(
    modifier: Modifier = Modifier,
    cornerRadius: Dp = 12.dp,
    onClick: (() -> Unit)? = null,
    backgroundColor: Color = MaterialTheme.colorScheme.surface,
    borderColor: Color = MaterialTheme.colorScheme.outline,
    contentPadding: PaddingValues = PaddingValues(16.dp),
    content: @Composable ColumnScope.() -> Unit
) {
    val clickableModifier = if (onClick != null) {
        Modifier.clickable(
            interactionSource = remember { MutableInteractionSource() },
            indication = ripple(color = MaterialTheme.colorScheme.primary),
            onClick = onClick
        )
    } else {
        Modifier
    }

    Box(
        modifier = modifier
            .clip(RoundedCornerShape(cornerRadius))
            .background(backgroundColor)
            .border(
                width = 1.dp,
                color = borderColor,
                shape = RoundedCornerShape(cornerRadius)
            )
            .then(clickableModifier)
            .padding(contentPadding)
    ) {
        Column {
            content()
        }
    }
}

/**
 * EnterpriseBox & IosGlassCard alias to SyncVeilCard
 */
@Composable
fun EnterpriseBox(
    modifier: Modifier = Modifier,
    cornerRadius: Dp = 12.dp,
    onClick: (() -> Unit)? = null,
    backgroundColor: Color = MaterialTheme.colorScheme.surface,
    borderColor: Color = MaterialTheme.colorScheme.outline,
    contentPadding: PaddingValues = PaddingValues(16.dp),
    content: @Composable ColumnScope.() -> Unit
) {
    SyncVeilCard(
        modifier = modifier,
        cornerRadius = cornerRadius,
        onClick = onClick,
        backgroundColor = backgroundColor,
        borderColor = borderColor,
        contentPadding = contentPadding,
        content = content
    )
}

@Composable
fun IosGlassCard(
    modifier: Modifier = Modifier,
    cornerRadius: Dp = 12.dp,
    onClick: (() -> Unit)? = null,
    backgroundColor: Color = MaterialTheme.colorScheme.surface,
    borderColor: Color = MaterialTheme.colorScheme.outline,
    content: @Composable ColumnScope.() -> Unit
) {
    SyncVeilCard(
        modifier = modifier,
        cornerRadius = cornerRadius,
        onClick = onClick,
        backgroundColor = backgroundColor,
        borderColor = borderColor,
        contentPadding = PaddingValues(16.dp),
        content = content
    )
}

/**
 * SyncVeil Animated Security Score Card
 *
 * Communicates information first and decoration second.
 * Animate the number from 0 -> score with clean editorial typography.
 */
@Composable
fun SyncVeilSecurityScoreCard(
    targetScore: Int = 92,
    statusText: String = "Excellent",
    summaryText: String = "Your account is well protected.",
    onScanClick: (() -> Unit)? = null,
    modifier: Modifier = Modifier
) {
    var animatedScore by remember { mutableStateOf(0) }

    LaunchedEffect(targetScore) {
        val duration = 900L
        val steps = targetScore.coerceAtLeast(1)
        val delayPerStep = duration / steps
        for (i in 1..targetScore) {
            animatedScore = i
            delay(delayPerStep.coerceAtLeast(8))
        }
    }

    SyncVeilCard(
        modifier = modifier.fillMaxWidth(),
        cornerRadius = 12.dp,
        contentPadding = PaddingValues(18.dp)
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = "SECURITY SCORE",
                style = MaterialTheme.typography.labelSmall.copy(
                    fontFamily = FontFamily.Monospace,
                    fontWeight = FontWeight.Bold,
                    fontSize = 11.sp,
                    letterSpacing = 1.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            )

            Surface(
                shape = RoundedCornerShape(6.dp),
                color = SyncVeilTokens.AccentOrange.copy(alpha = 0.12f),
                border = androidx.compose.foundation.BorderStroke(1.dp, SyncVeilTokens.AccentOrange.copy(alpha = 0.35f))
            ) {
                Row(
                    modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Box(
                        modifier = Modifier
                            .size(6.dp)
                            .clip(CircleShape)
                            .background(SyncVeilTokens.AccentOrange)
                    )
                    Spacer(modifier = Modifier.width(6.dp))
                    Text(
                        text = statusText.uppercase(),
                        style = MaterialTheme.typography.labelSmall.copy(
                            fontFamily = FontFamily.Monospace,
                            fontWeight = FontWeight.Bold,
                            color = SyncVeilTokens.AccentOrange,
                            fontSize = 10.sp
                        )
                    )
                }
            }
        }

        Spacer(modifier = Modifier.height(14.dp))

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.Bottom
        ) {
            Column {
                Text(
                    text = "$animatedScore",
                    style = MaterialTheme.typography.displayMedium.copy(
                        fontWeight = FontWeight.ExtraBold,
                        letterSpacing = (-1.5).sp,
                        color = MaterialTheme.colorScheme.onSurface
                    )
                )
                Spacer(modifier = Modifier.height(2.dp))
                Text(
                    text = statusText,
                    style = MaterialTheme.typography.titleMedium.copy(
                        fontWeight = FontWeight.Bold,
                        color = SyncVeilTokens.AccentOrange
                    )
                )
            }

            if (onScanClick != null) {
                OutlinedButton(
                    onClick = onScanClick,
                    shape = RoundedCornerShape(8.dp),
                    border = androidx.compose.foundation.BorderStroke(1.dp, MaterialTheme.colorScheme.outline),
                    colors = ButtonDefaults.outlinedButtonColors(
                        contentColor = MaterialTheme.colorScheme.onSurface
                    ),
                    contentPadding = PaddingValues(horizontal = 14.dp, vertical = 8.dp)
                ) {
                    Icon(
                        imageVector = Icons.Outlined.Refresh,
                        contentDescription = "Scan",
                        modifier = Modifier.size(16.dp)
                    )
                    Spacer(modifier = Modifier.width(6.dp))
                    Text(
                        text = "Run Audit",
                        style = MaterialTheme.typography.labelMedium.copy(fontWeight = FontWeight.SemiBold)
                    )
                }
            }
        }

        Spacer(modifier = Modifier.height(10.dp))
        HorizontalDivider(color = MaterialTheme.colorScheme.outline)
        Spacer(modifier = Modifier.height(10.dp))

        Text(
            text = summaryText,
            style = MaterialTheme.typography.bodyMedium.copy(
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        )
    }
}

/**
 * SyncVeil Minimal Security Visualization
 *
 * Sophisticated, clean security node architecture:
 * SYNCVEIL (92 SECURE) connected to Identity, Vault, Monitoring
 */
@Composable
fun SyncVeilSecurityVisualization(
    modifier: Modifier = Modifier,
    score: Int = 92
) {
    SyncVeilCard(
        modifier = modifier.fillMaxWidth(),
        cornerRadius = 12.dp,
        contentPadding = PaddingValues(18.dp)
    ) {
        Text(
            text = "SECURITY TOPOLOGY",
            style = MaterialTheme.typography.labelSmall.copy(
                fontFamily = FontFamily.Monospace,
                fontWeight = FontWeight.Bold,
                fontSize = 11.sp,
                letterSpacing = 1.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        )

        Spacer(modifier = Modifier.height(16.dp))

        // Center Root Node
        Box(
            modifier = Modifier.fillMaxWidth(),
            contentAlignment = Alignment.Center
        ) {
            Surface(
                shape = RoundedCornerShape(8.dp),
                color = MaterialTheme.colorScheme.surfaceVariant,
                border = androidx.compose.foundation.BorderStroke(1.5.dp, SyncVeilTokens.AccentOrange),
                modifier = Modifier.width(180.dp)
            ) {
                Column(
                    modifier = Modifier.padding(vertical = 12.dp, horizontal = 14.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Text(
                        text = "SYNCVEIL CORE",
                        style = MaterialTheme.typography.labelSmall.copy(
                            fontFamily = FontFamily.Monospace,
                            fontWeight = FontWeight.Bold,
                            letterSpacing = 1.sp,
                            fontSize = 10.sp,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    )
                    Spacer(modifier = Modifier.height(4.dp))
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(
                            text = "$score",
                            style = MaterialTheme.typography.titleLarge.copy(
                                fontWeight = FontWeight.ExtraBold,
                                color = MaterialTheme.colorScheme.onSurface
                            )
                        )
                        Spacer(modifier = Modifier.width(6.dp))
                        Text(
                            text = "SECURE",
                            style = MaterialTheme.typography.labelSmall.copy(
                                fontFamily = FontFamily.Monospace,
                                fontWeight = FontWeight.Bold,
                                color = SyncVeilTokens.AccentOrange,
                                fontSize = 11.sp
                            )
                        )
                    }
                }
            }
        }

        // Connection Lines Drawing
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(36.dp)
        ) {
            val lineColor = MaterialTheme.colorScheme.outline
            val accentColor = SyncVeilTokens.AccentOrange

            Canvas(modifier = Modifier.fillMaxSize()) {
                val midX = size.width / 2f
                val leftX = size.width * 0.18f
                val rightX = size.width * 0.82f
                val bottomY = size.height

                // Vertical line from root
                drawLine(
                    color = accentColor,
                    start = Offset(midX, 0f),
                    end = Offset(midX, bottomY * 0.4f),
                    strokeWidth = 1.5.dp.toPx()
                )

                // Horizontal distribution line
                drawLine(
                    color = lineColor,
                    start = Offset(leftX, bottomY * 0.4f),
                    end = Offset(rightX, bottomY * 0.4f),
                    strokeWidth = 1.5.dp.toPx()
                )

                // Branches down to 3 nodes
                drawLine(
                    color = accentColor,
                    start = Offset(leftX, bottomY * 0.4f),
                    end = Offset(leftX, bottomY),
                    strokeWidth = 1.5.dp.toPx()
                )
                drawLine(
                    color = accentColor,
                    start = Offset(midX, bottomY * 0.4f),
                    end = Offset(midX, bottomY),
                    strokeWidth = 1.5.dp.toPx()
                )
                drawLine(
                    color = accentColor,
                    start = Offset(rightX, bottomY * 0.4f),
                    end = Offset(rightX, bottomY),
                    strokeWidth = 1.5.dp.toPx()
                )

                // Node dots
                drawCircle(color = accentColor, radius = 3.dp.toPx(), center = Offset(leftX, bottomY))
                drawCircle(color = accentColor, radius = 3.dp.toPx(), center = Offset(midX, bottomY))
                drawCircle(color = accentColor, radius = 3.dp.toPx(), center = Offset(rightX, bottomY))
            }
        }

        Spacer(modifier = Modifier.height(8.dp))

        // Three Sub-Nodes
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            SecuritySubNode(
                title = "Identity",
                status = "Zero-Trust",
                icon = Icons.Outlined.Fingerprint,
                modifier = Modifier.weight(1f)
            )
            Spacer(modifier = Modifier.width(8.dp))
            SecuritySubNode(
                title = "Vault",
                status = "Encrypted",
                icon = Icons.Outlined.Lock,
                modifier = Modifier.weight(1f)
            )
            Spacer(modifier = Modifier.width(8.dp))
            SecuritySubNode(
                title = "Monitoring",
                status = "Live",
                icon = Icons.Outlined.Radar,
                modifier = Modifier.weight(1f)
            )
        }
    }
}

@Composable
private fun SecuritySubNode(
    title: String,
    status: String,
    icon: ImageVector,
    modifier: Modifier = Modifier
) {
    Surface(
        shape = RoundedCornerShape(8.dp),
        color = MaterialTheme.colorScheme.surfaceVariant,
        border = androidx.compose.foundation.BorderStroke(1.dp, MaterialTheme.colorScheme.outline),
        modifier = modifier
    ) {
        Column(
            modifier = Modifier.padding(vertical = 10.dp, horizontal = 6.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Icon(
                imageVector = icon,
                contentDescription = title,
                tint = SyncVeilTokens.AccentOrange,
                modifier = Modifier.size(18.dp)
            )
            Spacer(modifier = Modifier.height(4.dp))
            Text(
                text = title,
                style = MaterialTheme.typography.labelSmall.copy(
                    fontWeight = FontWeight.Bold,
                    fontSize = 11.sp
                ),
                maxLines = 1
            )
            Text(
                text = status,
                style = MaterialTheme.typography.labelSmall.copy(
                    fontFamily = FontFamily.Monospace,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    fontSize = 9.sp
                ),
                maxLines = 1
            )
        }
    }
}

/**
 * SyncVeil Live Security Scanning Bar
 *
 * Micro-interaction for scanning states: Idle -> Scanning -> Complete
 */
@Composable
fun SyncVeilLiveScanBar(
    isScanning: Boolean,
    onTriggerScan: () -> Unit,
    modifier: Modifier = Modifier
) {
    val infiniteTransition = rememberInfiniteTransition(label = "scan_line")
    val scanProgress by infiniteTransition.animateFloat(
        initialValue = 0f,
        targetValue = 1f,
        animationSpec = infiniteRepeatable(
            animation = tween(1200, easing = LinearEasing),
            repeatMode = RepeatMode.Restart
        ),
        label = "scan_progress"
    )

    SyncVeilCard(
        modifier = modifier.fillMaxWidth(),
        cornerRadius = 10.dp,
        contentPadding = PaddingValues(12.dp)
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(
                    modifier = Modifier
                        .size(8.dp)
                        .clip(CircleShape)
                        .background(if (isScanning) SyncVeilTokens.AccentOrange else SyncVeilTokens.SecureGreen)
                )
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    text = if (isScanning) "SYSTEM SCANNING IN PROGRESS" else "REAL-TIME PROTECTION ACTIVE",
                    style = MaterialTheme.typography.labelSmall.copy(
                        fontFamily = FontFamily.Monospace,
                        fontWeight = FontWeight.Bold,
                        fontSize = 10.sp,
                        letterSpacing = 0.5.sp,
                        color = if (isScanning) SyncVeilTokens.AccentOrange else MaterialTheme.colorScheme.onSurface
                    )
                )
            }

            TextButton(
                onClick = onTriggerScan,
                contentPadding = PaddingValues(horizontal = 8.dp, vertical = 2.dp),
                enabled = !isScanning
            ) {
                Text(
                    text = if (isScanning) "Scanning..." else "Scan Now",
                    style = MaterialTheme.typography.labelSmall.copy(
                        fontWeight = FontWeight.Bold,
                        color = SyncVeilTokens.AccentOrange
                    )
                )
            }
        }

        if (isScanning) {
            Spacer(modifier = Modifier.height(8.dp))
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(2.dp)
                    .clip(RoundedCornerShape(1.dp))
                    .background(MaterialTheme.colorScheme.surfaceVariant)
            ) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth(0.35f)
                        .fillMaxHeight()
                        .offset(x = (scanProgress * 240).dp)
                        .background(SyncVeilTokens.AccentOrange)
                )
            }
        }
    }
}

/**
 * Top App Bar with Brand Identity, Live Status Indicator, and Theme Toggle
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SyncVeilTopAppBar(
    title: String = "SYNCVEIL",
    onNavigationClick: (() -> Unit)? = null,
    actions: @Composable RowScope.() -> Unit = {}
) {
    val themeController = LocalThemeController.current

    TopAppBar(
        title = {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(
                    modifier = Modifier
                        .size(28.dp)
                        .clip(RoundedCornerShape(6.dp))
                        .background(SyncVeilTokens.AccentOrange),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = Icons.Default.Shield,
                        contentDescription = "SyncVeil",
                        tint = Color.White,
                        modifier = Modifier.size(16.dp)
                    )
                }
                Spacer(modifier = Modifier.width(10.dp))
                Column {
                    Text(
                        text = title,
                        style = MaterialTheme.typography.titleMedium.copy(
                            fontWeight = FontWeight.ExtraBold,
                            letterSpacing = (-0.3).sp
                        )
                    )
                    Text(
                        text = "ZERO-KNOWLEDGE PRIVACY",
                        style = MaterialTheme.typography.labelSmall.copy(
                            fontFamily = FontFamily.Monospace,
                            fontWeight = FontWeight.Bold,
                            fontSize = 8.sp,
                            letterSpacing = 0.5.sp,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    )
                }
            }
        },
        navigationIcon = {
            if (onNavigationClick != null) {
                IconButton(onClick = onNavigationClick) {
                    Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                }
            }
        },
        actions = {
            // Dark / Light Theme Toggle Button
            IconButton(
                onClick = { themeController.toggleDarkLight() }
            ) {
                Icon(
                    imageVector = if (themeController.themeMode == ThemeMode.LIGHT) Icons.Outlined.DarkMode else Icons.Outlined.LightMode,
                    contentDescription = "Toggle Theme",
                    tint = SyncVeilTokens.AccentOrange
                )
            }
            actions()
        },
        colors = TopAppBarDefaults.topAppBarColors(
            containerColor = MaterialTheme.colorScheme.background,
            titleContentColor = MaterialTheme.colorScheme.onBackground
        )
    )
}

/**
 * Enterprise Header Status HUD Bar (Zero Trust Enclave Status)
 */
@Composable
fun EnterpriseStatusHud(
    modifier: Modifier = Modifier,
    isOperational: Boolean = true,
    pingMs: Long = 18,
    cipher: String = "AES-256-GCM + KYBER-1024"
) {
    val infiniteTransition = rememberInfiniteTransition(label = "pulse_led")
    val ledAlpha by infiniteTransition.animateFloat(
        initialValue = 0.4f,
        targetValue = 1f,
        animationSpec = infiniteRepeatable(
            animation = tween(800, easing = LinearEasing),
            repeatMode = RepeatMode.Reverse
        ),
        label = "led_alpha"
    )

    Surface(
        shape = RoundedCornerShape(10.dp),
        color = MaterialTheme.colorScheme.surfaceVariant,
        border = androidx.compose.foundation.BorderStroke(1.dp, MaterialTheme.colorScheme.outline),
        modifier = modifier.fillMaxWidth()
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 12.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(
                    modifier = Modifier
                        .size(7.dp)
                        .clip(CircleShape)
                        .background(
                            if (isOperational) SyncVeilTokens.SecureGreen.copy(alpha = ledAlpha)
                            else SyncVeilTokens.DangerRed.copy(alpha = ledAlpha)
                        )
                )
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    text = if (isOperational) "ENCLAVE OPERATIONAL" else "SYSTEM RESTRICTED",
                    style = MaterialTheme.typography.labelSmall.copy(
                        fontFamily = FontFamily.Monospace,
                        fontWeight = FontWeight.Bold,
                        fontSize = 10.sp,
                        letterSpacing = 0.5.sp,
                        color = if (isOperational) SyncVeilTokens.SecureGreen else SyncVeilTokens.DangerRed
                    )
                )
            }

            Row(verticalAlignment = Alignment.CenterVertically) {
                Surface(
                    shape = RoundedCornerShape(4.dp),
                    color = MaterialTheme.colorScheme.surface
                ) {
                    Text(
                        text = "$pingMs ms",
                        style = MaterialTheme.typography.labelSmall.copy(
                            fontFamily = FontFamily.Monospace,
                            fontWeight = FontWeight.Bold,
                            fontSize = 10.sp,
                            color = SyncVeilTokens.AccentOrange
                        ),
                        modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                    )
                }
                Spacer(modifier = Modifier.width(6.dp))
                Text(
                    text = "SSCE-v3",
                    style = MaterialTheme.typography.labelSmall.copy(
                        fontFamily = FontFamily.Monospace,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        fontSize = 10.sp
                    )
                )
            }
        }
    }
}

/**
 * Enterprise Metric Tile Box
 */
@Composable
fun EnterpriseMetricBox(
    title: String,
    value: String,
    subValue: String,
    icon: ImageVector,
    accentColor: Color = SyncVeilTokens.AccentOrange,
    modifier: Modifier = Modifier
) {
    SyncVeilCard(
        modifier = modifier,
        cornerRadius = 10.dp,
        contentPadding = PaddingValues(12.dp)
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.Top
        ) {
            Box(
                modifier = Modifier
                    .size(32.dp)
                    .clip(RoundedCornerShape(8.dp))
                    .background(SyncVeilTokens.AccentOrange.copy(alpha = 0.12f)),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector = icon,
                    contentDescription = title,
                    tint = SyncVeilTokens.AccentOrange,
                    modifier = Modifier.size(18.dp)
                )
            }

            Surface(
                shape = RoundedCornerShape(4.dp),
                color = SyncVeilTokens.AccentOrange.copy(alpha = 0.12f)
            ) {
                Text(
                    text = subValue,
                    style = MaterialTheme.typography.labelSmall.copy(
                        fontFamily = FontFamily.Monospace,
                        fontWeight = FontWeight.Bold,
                        fontSize = 9.sp,
                        color = SyncVeilTokens.AccentOrange
                    ),
                    modifier = Modifier.padding(horizontal = 5.dp, vertical = 2.dp)
                )
            }
        }

        Spacer(modifier = Modifier.height(8.dp))

        Text(
            text = value,
            style = MaterialTheme.typography.titleLarge.copy(
                fontWeight = FontWeight.ExtraBold,
                letterSpacing = (-0.5).sp,
                color = MaterialTheme.colorScheme.onSurface
            )
        )

        Text(
            text = title,
            style = MaterialTheme.typography.labelSmall.copy(
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                fontSize = 11.sp
            ),
            maxLines = 1
        )
    }
}

/**
 * Enterprise Quick-Action Grid Tile Box
 */
@Composable
fun EnterpriseActionTile(
    title: String,
    subtitle: String,
    icon: ImageVector,
    accentColor: Color = SyncVeilTokens.AccentOrange,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    badge: String? = null
) {
    SyncVeilCard(
        modifier = modifier,
        cornerRadius = 10.dp,
        onClick = onClick,
        contentPadding = PaddingValues(12.dp)
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Box(
                modifier = Modifier
                    .size(36.dp)
                    .clip(RoundedCornerShape(8.dp))
                    .background(SyncVeilTokens.AccentOrange.copy(alpha = 0.12f)),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector = icon,
                    contentDescription = title,
                    tint = SyncVeilTokens.AccentOrange,
                    modifier = Modifier.size(20.dp)
                )
            }

            if (badge != null) {
                Surface(
                    shape = RoundedCornerShape(4.dp),
                    color = SyncVeilTokens.AccentOrange.copy(alpha = 0.15f)
                ) {
                    Text(
                        text = badge,
                        style = MaterialTheme.typography.labelSmall.copy(
                            fontWeight = FontWeight.Bold,
                            color = SyncVeilTokens.AccentOrange,
                            fontSize = 9.sp
                        ),
                        modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                    )
                }
            } else {
                Icon(
                    imageVector = Icons.Default.ChevronRight,
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.size(16.dp)
                )
            }
        }

        Spacer(modifier = Modifier.height(10.dp))

        Text(
            text = title,
            style = MaterialTheme.typography.titleSmall.copy(fontWeight = FontWeight.Bold),
            maxLines = 1
        )

        Text(
            text = subtitle,
            style = MaterialTheme.typography.bodySmall.copy(
                fontSize = 11.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            ),
            maxLines = 1
        )
    }
}

/**
 * Enterprise Digital ID Card
 */
@Composable
fun EnterpriseIdentityCard(
    fullName: String,
    email: String,
    tenantId: String = "SV-ENTERPRISE-884",
    isVerified: Boolean = true,
    is2faActive: Boolean = true,
    modifier: Modifier = Modifier
) {
    SyncVeilCard(
        modifier = modifier.fillMaxWidth(),
        cornerRadius = 12.dp,
        contentPadding = PaddingValues(16.dp)
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(
                    modifier = Modifier
                        .size(26.dp)
                        .clip(RoundedCornerShape(6.dp))
                        .background(SyncVeilTokens.AccentOrange),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = Icons.Default.Shield,
                        contentDescription = null,
                        tint = Color.White,
                        modifier = Modifier.size(16.dp)
                    )
                }
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    "ZERO-TRUST IDENTITY",
                    style = MaterialTheme.typography.labelSmall.copy(
                        fontFamily = FontFamily.Monospace,
                        fontWeight = FontWeight.Bold,
                        color = SyncVeilTokens.AccentOrange,
                        letterSpacing = 0.8.sp,
                        fontSize = 10.sp
                    )
                )
            }

            Surface(
                shape = RoundedCornerShape(4.dp),
                color = if (isVerified) SyncVeilTokens.SecureGreen.copy(alpha = 0.15f) else SyncVeilTokens.WarningAmber.copy(alpha = 0.15f)
            ) {
                Text(
                    text = if (isVerified) "VERIFIED PASSKEY" else "GUEST ACCESS",
                    style = MaterialTheme.typography.labelSmall.copy(
                        color = if (isVerified) SyncVeilTokens.SecureGreen else SyncVeilTokens.WarningAmber,
                        fontWeight = FontWeight.Bold,
                        fontFamily = FontFamily.Monospace,
                        fontSize = 9.sp
                    ),
                    modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                )
            }
        }

        Spacer(modifier = Modifier.height(14.dp))

        Row(verticalAlignment = Alignment.CenterVertically) {
            Box(
                modifier = Modifier
                    .size(44.dp)
                    .clip(CircleShape)
                    .background(SyncVeilTokens.AccentOrange.copy(alpha = 0.15f))
                    .border(1.dp, SyncVeilTokens.AccentOrange.copy(alpha = 0.4f), CircleShape),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = if (fullName.isNotBlank()) fullName.take(1).uppercase() else "G",
                    style = MaterialTheme.typography.titleMedium.copy(
                        fontWeight = FontWeight.ExtraBold,
                        color = SyncVeilTokens.AccentOrange
                    )
                )
            }

            Spacer(modifier = Modifier.width(12.dp))

            Column {
                Text(
                    text = if (fullName.isNotBlank()) fullName else "Guest User",
                    style = MaterialTheme.typography.titleMedium.copy(
                        fontWeight = FontWeight.Bold
                    )
                )
                Text(
                    text = if (email.isNotBlank()) email else "guest@syncveil.software",
                    style = MaterialTheme.typography.bodySmall.copy(
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                )
            }
        }

        Spacer(modifier = Modifier.height(12.dp))
        HorizontalDivider(color = MaterialTheme.colorScheme.outline)
        Spacer(modifier = Modifier.height(10.dp))

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column {
                Text(
                    text = "ORGANIZATION TENANT",
                    style = MaterialTheme.typography.labelSmall.copy(
                        fontSize = 9.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        fontWeight = FontWeight.Bold
                    )
                )
                Text(
                    text = tenantId,
                    style = MaterialTheme.typography.labelMedium.copy(
                        fontFamily = FontFamily.Monospace,
                        fontWeight = FontWeight.Bold
                    )
                )
            }

            Column(horizontalAlignment = Alignment.End) {
                Text(
                    text = "MFA ENFORCEMENT",
                    style = MaterialTheme.typography.labelSmall.copy(
                        fontSize = 9.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        fontWeight = FontWeight.Bold
                    )
                )
                Text(
                    text = if (is2faActive) "TOTP + BIOMETRIC" else "PASSWORD ONLY",
                    style = MaterialTheme.typography.labelMedium.copy(
                        fontFamily = FontFamily.Monospace,
                        fontWeight = FontWeight.Bold,
                        color = if (is2faActive) SyncVeilTokens.SecureGreen else SyncVeilTokens.WarningAmber
                    )
                )
            }
        }
    }
}

/**
 * Dynamic Notification Banner
 */
@Composable
fun IosDynamicIslandBanner(
    visible: Boolean,
    title: String,
    subtitle: String,
    code: String? = null,
    onDismiss: () -> Unit,
    modifier: Modifier = Modifier
) {
    AnimatedVisibility(
        visible = visible,
        enter = slideInVertically(initialOffsetY = { -it }) + fadeIn(animationSpec = tween(200)),
        exit = slideOutVertically(targetOffsetY = { -it }) + fadeOut(animationSpec = tween(200)),
        modifier = modifier
    ) {
        Surface(
            shape = RoundedCornerShape(12.dp),
            color = MaterialTheme.colorScheme.surface,
            border = androidx.compose.foundation.BorderStroke(1.dp, SyncVeilTokens.AccentOrange),
            shadowElevation = 8.dp,
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 14.dp, vertical = 8.dp)
                .clickable { onDismiss() }
        ) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 14.dp, vertical = 12.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Box(
                    modifier = Modifier
                        .size(36.dp)
                        .clip(RoundedCornerShape(8.dp))
                        .background(SyncVeilTokens.AccentOrange.copy(alpha = 0.15f)),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = Icons.Default.MarkEmailRead,
                        contentDescription = "Notification",
                        tint = SyncVeilTokens.AccentOrange,
                        modifier = Modifier.size(18.dp)
                    )
                }

                Spacer(modifier = Modifier.width(12.dp))

                Column(modifier = Modifier.weight(1f)) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = title,
                            style = MaterialTheme.typography.titleSmall.copy(
                                fontWeight = FontWeight.Bold,
                                fontSize = 13.sp
                            )
                        )
                        Text(
                            text = "JUST NOW",
                            style = MaterialTheme.typography.labelSmall.copy(
                                color = SyncVeilTokens.AccentOrange,
                                fontWeight = FontWeight.Bold,
                                fontSize = 9.sp,
                                fontFamily = FontFamily.Monospace
                            )
                        )
                    }

                    Spacer(modifier = Modifier.height(2.dp))

                    Text(
                        text = subtitle,
                        style = MaterialTheme.typography.bodySmall.copy(
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            fontSize = 12.sp
                        )
                    )

                    if (code != null) {
                        Spacer(modifier = Modifier.height(6.dp))
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Surface(
                                shape = RoundedCornerShape(4.dp),
                                color = MaterialTheme.colorScheme.surfaceVariant
                            ) {
                                Text(
                                    text = "OTP: $code",
                                    style = MaterialTheme.typography.labelLarge.copy(
                                        fontFamily = FontFamily.Monospace,
                                        fontWeight = FontWeight.ExtraBold,
                                        letterSpacing = 2.sp,
                                        color = SyncVeilTokens.AccentOrange
                                    ),
                                    modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                                )
                            }
                            Spacer(modifier = Modifier.width(8.dp))
                            Text(
                                text = "Tap to dismiss",
                                style = MaterialTheme.typography.labelSmall.copy(
                                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                                    fontSize = 10.sp
                                )
                            )
                        }
                    }
                }
            }
        }
    }
}

/**
 * 6-Digit split PIN code input
 */
@Composable
fun IosOtpPinInput(
    otpValue: String,
    onOtpChange: (String) -> Unit,
    modifier: Modifier = Modifier,
    digitCount: Int = 6,
    onFilled: (() -> Unit)? = null
) {
    val focusRequester = remember { FocusRequester() }

    LaunchedEffect(Unit) {
        delay(200)
        try {
            focusRequester.requestFocus()
        } catch (_: Exception) {}
    }

    LaunchedEffect(otpValue) {
        if (otpValue.length == digitCount) {
            onFilled?.invoke()
        }
    }

    Box(
        modifier = modifier.fillMaxWidth(),
        contentAlignment = Alignment.Center
    ) {
        BasicTextField(
            value = otpValue,
            onValueChange = { newValue ->
                if (newValue.length <= digitCount && newValue.all { it.isDigit() }) {
                    onOtpChange(newValue)
                }
            },
            keyboardOptions = KeyboardOptions(
                keyboardType = KeyboardType.NumberPassword
            ),
            keyboardActions = KeyboardActions(
                onDone = {
                    if (otpValue.length == digitCount) {
                        onFilled?.invoke()
                    }
                }
            ),
            modifier = Modifier
                .size(1.dp)
                .focusRequester(focusRequester)
        )

        Row(
            modifier = Modifier
                .fillMaxWidth()
                .clickable(
                    interactionSource = remember { MutableInteractionSource() },
                    indication = null
                ) {
                    focusRequester.requestFocus()
                },
            horizontalArrangement = Arrangement.spacedBy(8.dp, Alignment.CenterHorizontally),
            verticalAlignment = Alignment.CenterVertically
        ) {
            for (i in 0 until digitCount) {
                val isFocused = otpValue.length == i
                val char = otpValue.getOrNull(i)?.toString() ?: ""
                val isFilled = char.isNotEmpty()

                val boxBorderColor = when {
                    isFocused -> SyncVeilTokens.AccentOrange
                    isFilled -> SyncVeilTokens.AccentOrange.copy(alpha = 0.6f)
                    else -> MaterialTheme.colorScheme.outline
                }

                val boxBgColor = when {
                    isFocused -> SyncVeilTokens.AccentOrange.copy(alpha = 0.08f)
                    isFilled -> MaterialTheme.colorScheme.surfaceVariant
                    else -> MaterialTheme.colorScheme.surface
                }

                Box(
                    modifier = Modifier
                        .weight(1f)
                        .height(52.dp)
                        .clip(RoundedCornerShape(8.dp))
                        .background(boxBgColor)
                        .border(
                            width = if (isFocused) 1.5.dp else 1.dp,
                            color = boxBorderColor,
                            shape = RoundedCornerShape(8.dp)
                        ),
                    contentAlignment = Alignment.Center
                ) {
                    if (isFilled) {
                        Text(
                            text = char,
                            style = MaterialTheme.typography.titleLarge.copy(
                                fontWeight = FontWeight.Bold,
                                fontFamily = FontFamily.Monospace,
                                fontSize = 20.sp
                            ),
                            color = MaterialTheme.colorScheme.onSurface
                        )
                    } else if (isFocused) {
                        val infiniteTransition = rememberInfiniteTransition(label = "cursor")
                        val cursorAlpha by infiniteTransition.animateFloat(
                            initialValue = 0f,
                            targetValue = 1f,
                            animationSpec = infiniteRepeatable(
                                animation = tween(500),
                                repeatMode = RepeatMode.Reverse
                            ),
                            label = "cursor_alpha"
                        )
                        Box(
                            modifier = Modifier
                                .width(2.dp)
                                .height(20.dp)
                                .background(SyncVeilTokens.AccentOrange.copy(alpha = cursorAlpha))
                        )
                    }
                }
            }
        }
    }
}

/**
 * Segmented Control bar
 */
@Composable
fun <T> IosSegmentedControl(
    items: List<T>,
    selectedItem: T,
    itemLabel: (T) -> String,
    onItemSelected: (T) -> Unit,
    modifier: Modifier = Modifier,
    itemIcon: ((T) -> ImageVector)? = null
) {
    Surface(
        shape = RoundedCornerShape(10.dp),
        color = MaterialTheme.colorScheme.surfaceVariant,
        border = androidx.compose.foundation.BorderStroke(1.dp, MaterialTheme.colorScheme.outline),
        modifier = modifier
            .fillMaxWidth()
            .height(42.dp)
    ) {
        Row(
            modifier = Modifier
                .fillMaxSize()
                .padding(3.dp),
            horizontalArrangement = Arrangement.spacedBy(4.dp)
        ) {
            items.forEach { item ->
                val isSelected = item == selectedItem
                val bg = if (isSelected) MaterialTheme.colorScheme.surface else Color.Transparent
                val fg = if (isSelected) SyncVeilTokens.AccentOrange else MaterialTheme.colorScheme.onSurfaceVariant

                Box(
                    modifier = Modifier
                        .weight(1f)
                        .fillMaxHeight()
                        .clip(RoundedCornerShape(8.dp))
                        .background(bg)
                        .then(
                            if (isSelected) Modifier.border(1.dp, MaterialTheme.colorScheme.outline, RoundedCornerShape(8.dp))
                            else Modifier
                        )
                        .clickable { onItemSelected(item) },
                    contentAlignment = Alignment.Center
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.Center,
                        modifier = Modifier.padding(horizontal = 4.dp)
                    ) {
                        if (itemIcon != null) {
                            Icon(
                                imageVector = itemIcon(item),
                                contentDescription = null,
                                tint = fg,
                                modifier = Modifier.size(15.dp)
                            )
                            Spacer(modifier = Modifier.width(4.dp))
                        }
                        Text(
                            text = itemLabel(item),
                            style = MaterialTheme.typography.labelMedium.copy(
                                fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Medium,
                                fontSize = 11.sp
                            ),
                            color = fg,
                            maxLines = 1
                        )
                    }
                }
            }
        }
    }
}

/**
 * Animated Circular Security Gauge Ring
 */
@Composable
fun IosProgressRing(
    progress: Float,
    modifier: Modifier = Modifier,
    strokeWidth: Dp = 8.dp,
    primaryColor: Color = SyncVeilTokens.AccentOrange,
    trackColor: Color = MaterialTheme.colorScheme.outline,
    centerContent: @Composable () -> Unit
) {
    val animatedProgress by animateFloatAsState(
        targetValue = progress,
        animationSpec = tween(900, easing = FastOutSlowInEasing),
        label = "progress_ring"
    )

    Box(
        modifier = modifier,
        contentAlignment = Alignment.Center
    ) {
        Canvas(modifier = Modifier.fillMaxSize()) {
            val stroke = strokeWidth.toPx()
            val diameter = size.minDimension - stroke
            val topLeft = Offset((size.width - diameter) / 2, (size.height - diameter) / 2)

            drawArc(
                color = trackColor,
                startAngle = -90f,
                sweepAngle = 360f,
                useCenter = false,
                topLeft = topLeft,
                size = Size(diameter, diameter),
                style = Stroke(width = stroke, cap = StrokeCap.Round)
            )

            drawArc(
                color = primaryColor,
                startAngle = -90f,
                sweepAngle = animatedProgress * 360f,
                useCenter = false,
                topLeft = topLeft,
                size = Size(diameter, diameter),
                style = Stroke(width = stroke, cap = StrokeCap.Round)
            )
        }
        centerContent()
    }
}

/**
 * Minimalist Editorial Live Radar Scanner
 */
@Composable
fun IosLiveRadar(
    modifier: Modifier = Modifier,
    radarColor: Color = SyncVeilTokens.AccentOrange,
    isScanning: Boolean = true
) {
    val infiniteTransition = rememberInfiniteTransition(label = "radar_sweep")
    val angle by infiniteTransition.animateFloat(
        initialValue = 0f,
        targetValue = 360f,
        animationSpec = infiniteRepeatable(
            animation = tween(2400, easing = LinearEasing),
            repeatMode = RepeatMode.Restart
        ),
        label = "radar_angle"
    )

    Box(
        modifier = modifier
            .size(72.dp)
            .clip(CircleShape)
            .background(MaterialTheme.colorScheme.surfaceVariant),
        contentAlignment = Alignment.Center
    ) {
        Canvas(modifier = Modifier.fillMaxSize().padding(6.dp)) {
            val center = Offset(size.width / 2, size.height / 2)
            val maxRadius = size.minDimension / 2

            // Concentric rings
            drawCircle(
                color = radarColor.copy(alpha = 0.2f),
                radius = maxRadius * 0.33f,
                center = center,
                style = Stroke(width = 1.dp.toPx())
            )
            drawCircle(
                color = radarColor.copy(alpha = 0.2f),
                radius = maxRadius * 0.66f,
                center = center,
                style = Stroke(width = 1.dp.toPx())
            )
            drawCircle(
                color = radarColor.copy(alpha = 0.35f),
                radius = maxRadius,
                center = center,
                style = Stroke(width = 1.2.dp.toPx())
            )

            // Crosshairs
            drawLine(
                color = radarColor.copy(alpha = 0.2f),
                start = Offset(center.x, 0f),
                end = Offset(center.x, size.height),
                strokeWidth = 1.dp.toPx()
            )
            drawLine(
                color = radarColor.copy(alpha = 0.2f),
                start = Offset(0f, center.y),
                end = Offset(size.width, center.y),
                strokeWidth = 1.dp.toPx()
            )

            // Rotating sweep needle
            if (isScanning) {
                val rad = Math.toRadians(angle.toDouble())
                val endX = center.x + (maxRadius * Math.cos(rad)).toFloat()
                val endY = center.y + (maxRadius * Math.sin(rad)).toFloat()

                drawLine(
                    color = radarColor,
                    start = center,
                    end = Offset(endX, endY),
                    strokeWidth = 1.8.dp.toPx()
                )

                // Blip dot
                drawCircle(
                    color = radarColor,
                    radius = 3.dp.toPx(),
                    center = center
                )
            }
        }
    }
}



