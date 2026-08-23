package com.syncveil.app.ui.theme

import android.app.Activity
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.SideEffect
import androidx.compose.runtime.compositionLocalOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.platform.LocalView
import androidx.core.view.WindowCompat

/**
 * SyncVeil Design System Tokens
 *
 * Dark Mode: Style #6 (Black + Orange)
 * Light Mode: Style #9 (Editorial / Premium)
 */
object SyncVeilTokens {
    // Shared Brand Accent
    val AccentOrange = Color(0xFFFF6B2C)
    val AccentOrangeMuted = Color(0xFFFF6B2C).copy(alpha = 0.15f)
    val AccentOrangeBorder = Color(0xFFFF6B2C).copy(alpha = 0.35f)

    // Dark Mode Palette (#6 Black + Orange)
    val DarkBackground = Color(0xFF080808)
    val DarkPrimarySurface = Color(0xFF111111)
    val DarkSecondarySurface = Color(0xFF171717)
    val DarkBorder = Color(0xFF292929)
    val DarkTextPrimary = Color(0xFFF5F5F5)
    val DarkTextSecondary = Color(0xFFA0A0A0)
    val DarkTextMuted = Color(0xFF6F6F6F)

    // Light Mode Palette (#9 Editorial / Premium)
    val LightBackground = Color(0xFFF7F5F2)
    val LightPrimarySurface = Color(0xFFFFFFFF)
    val LightSecondarySurface = Color(0xFFF1EFEC)
    val LightBorder = Color(0xFFDDD9D4)
    val LightTextPrimary = Color(0xFF111111)
    val LightTextSecondary = Color(0xFF686868)
    val LightTextMuted = Color(0xFF99938D)

    // Security Semantic Indicators (Restrained)
    val SecureGreen = Color(0xFF10B981)
    val WarningAmber = Color(0xFFF59E0B)
    val DangerRed = Color(0xFFEF4444)
    val NeutralSlate = Color(0xFF64748B)
}

// Backward-compatible AppColors bridge
object AppColors {
    val OrangeAccent = SyncVeilTokens.AccentOrange
    val BluePrimary = SyncVeilTokens.AccentOrange
    val BlueBright = SyncVeilTokens.AccentOrange
    val BlueLightBg = Color(0xFFFFECE5)
    
    val EmeraldSuccess = SyncVeilTokens.SecureGreen
    val EmeraldDark = Color(0xFF059669)
    val EmeraldBg = Color(0xFFECFDF5)
    
    val VioletIdentity = Color(0xFF8B5CF6)
    val VioletDark = Color(0xFF6D28D9)
    val VioletBg = Color(0xFFF5F3FF)
    
    val AmberWarning = SyncVeilTokens.WarningAmber
    val AmberBg = Color(0xFFFFFBEB)
    
    val CrimsonThreat = SyncVeilTokens.DangerRed
    val CrimsonBg = Color(0xFFFEF2F2)
    
    val TextMuted = SyncVeilTokens.DarkTextMuted
    val TextNavy = SyncVeilTokens.LightTextPrimary
}

private val DarkColorScheme = darkColorScheme(
    primary = SyncVeilTokens.AccentOrange,
    onPrimary = Color.White,
    primaryContainer = Color(0xFF24150D),
    onPrimaryContainer = Color(0xFFFFDBCF),
    secondary = SyncVeilTokens.DarkTextSecondary,
    onSecondary = SyncVeilTokens.DarkPrimarySurface,
    secondaryContainer = SyncVeilTokens.DarkSecondarySurface,
    onSecondaryContainer = SyncVeilTokens.DarkTextPrimary,
    tertiary = SyncVeilTokens.AccentOrange,
    onTertiary = Color.White,
    background = SyncVeilTokens.DarkBackground,
    onBackground = SyncVeilTokens.DarkTextPrimary,
    surface = SyncVeilTokens.DarkPrimarySurface,
    onSurface = SyncVeilTokens.DarkTextPrimary,
    surfaceVariant = SyncVeilTokens.DarkSecondarySurface,
    onSurfaceVariant = SyncVeilTokens.DarkTextSecondary,
    outline = SyncVeilTokens.DarkBorder,
    outlineVariant = Color(0xFF1E1E1E),
    error = SyncVeilTokens.DangerRed,
    errorContainer = Color(0xFF3B1212),
    onError = Color.White
)

private val LightColorScheme = lightColorScheme(
    primary = SyncVeilTokens.AccentOrange,
    onPrimary = Color.White,
    primaryContainer = Color(0xFFFFECE5),
    onPrimaryContainer = Color(0xFF5A1E00),
    secondary = SyncVeilTokens.LightTextSecondary,
    onSecondary = Color.White,
    secondaryContainer = SyncVeilTokens.LightSecondarySurface,
    onSecondaryContainer = SyncVeilTokens.LightTextPrimary,
    tertiary = SyncVeilTokens.AccentOrange,
    onTertiary = Color.White,
    background = SyncVeilTokens.LightBackground,
    onBackground = SyncVeilTokens.LightTextPrimary,
    surface = SyncVeilTokens.LightPrimarySurface,
    onSurface = SyncVeilTokens.LightTextPrimary,
    surfaceVariant = SyncVeilTokens.LightSecondarySurface,
    onSurfaceVariant = SyncVeilTokens.LightTextSecondary,
    outline = SyncVeilTokens.LightBorder,
    outlineVariant = Color(0xFFE8E5E1),
    error = Color(0xFFDC2626),
    errorContainer = Color(0xFFFEE2E2),
    onError = Color.White
)

enum class ThemeMode {
    SYSTEM, DARK, LIGHT
}

class ThemeController {
    var themeMode by mutableStateOf(ThemeMode.DARK)
        private set

    fun setTheme(mode: ThemeMode) {
        themeMode = mode
    }

    fun toggleDarkLight() {
        themeMode = if (themeMode == ThemeMode.LIGHT) ThemeMode.DARK else ThemeMode.LIGHT
    }
}

val LocalThemeController = compositionLocalOf { ThemeController() }

@Composable
fun SyncVeilTheme(
    controller: ThemeController = ThemeController(),
    content: @Composable () -> Unit
) {
    val isSystemDark = isSystemInDarkTheme()
    val isDark = when (controller.themeMode) {
        ThemeMode.SYSTEM -> isSystemDark
        ThemeMode.DARK -> true
        ThemeMode.LIGHT -> false
    }

    val colorScheme = if (isDark) DarkColorScheme else LightColorScheme
    val view = LocalView.current
    if (!view.isInEditMode) {
        SideEffect {
            val window = (view.context as? Activity)?.window
            if (window != null) {
                window.statusBarColor = Color.Transparent.toArgb()
                WindowCompat.getInsetsController(window, view).isAppearanceLightStatusBars = !isDark
            }
        }
    }

    CompositionLocalProvider(LocalThemeController provides controller) {
        MaterialTheme(
            colorScheme = colorScheme,
            content = content
        )
    }
}


