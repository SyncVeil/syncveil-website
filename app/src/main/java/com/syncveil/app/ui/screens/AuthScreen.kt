package com.syncveil.app.ui.screens

import android.app.Application
import androidx.compose.animation.*
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.*
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewmodel.compose.viewModel
import com.syncveil.app.data.CloudSyncManager
import com.syncveil.app.data.api.ApiConfig
import com.syncveil.app.ui.components.*
import com.syncveil.app.ui.theme.AppColors
import com.syncveil.app.ui.theme.LocalThemeController
import com.syncveil.app.ui.theme.SyncVeilTokens
import com.syncveil.app.ui.theme.ThemeMode

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AuthScreen(
    onNavigateToDashboard: () -> Unit,
    onBack: () -> Unit,
    authViewModel: AuthViewModel = viewModel(
        factory = ViewModelProvider.AndroidViewModelFactory.getInstance(
            LocalContext.current.applicationContext as Application
        )
    )
) {
    val themeController = LocalThemeController.current
    val context = LocalContext.current
    val cloudSyncManager = remember { CloudSyncManager.getInstance(context.applicationContext as Application) }
    val syncState by cloudSyncManager.syncState.collectAsState()
    val uiState by authViewModel.uiState.collectAsState()
    val scrollState = rememberScrollState()
    var showServerConfigDialog by remember { mutableStateOf(false) }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Box(
                            modifier = Modifier
                                .size(32.dp)
                                .clip(RoundedCornerShape(8.dp))
                                .background(SyncVeilTokens.AccentOrange),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(
                                imageVector = Icons.Default.Shield,
                                contentDescription = "SyncVeil Shield",
                                tint = Color.White,
                                modifier = Modifier.size(18.dp)
                            )
                        }
                        Spacer(modifier = Modifier.width(10.dp))
                        Column {
                            Text(
                                "Identity Gateway",
                                style = MaterialTheme.typography.titleMedium.copy(
                                    fontWeight = FontWeight.Bold,
                                    letterSpacing = (-0.3).sp
                                )
                            )
                            Text(
                                "ZERO-KNOWLEDGE AUTH PROTOCOL",
                                style = MaterialTheme.typography.labelSmall.copy(
                                    fontFamily = FontFamily.Monospace,
                                    fontSize = 9.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = SyncVeilTokens.SecureGreen
                                )
                            )
                        }
                    }
                },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                },
                actions = {
                    IconButton(
                        onClick = { showServerConfigDialog = true }
                    ) {
                        Icon(
                            imageVector = Icons.Default.Dns,
                            contentDescription = "Backend Server Config",
                            tint = AppColors.BlueBright
                        )
                    }

                    IconButton(
                        onClick = { themeController.toggleDarkLight() }
                    ) {
                        Icon(
                            imageVector = if (themeController.themeMode == ThemeMode.LIGHT) Icons.Outlined.DarkMode else Icons.Outlined.LightMode,
                            contentDescription = "Toggle Theme",
                            tint = SyncVeilTokens.AccentOrange
                        )
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.background
                )
            )
        }
    ) { padding ->
        Box(
            modifier = Modifier
                .padding(padding)
                .fillMaxSize()
                .background(MaterialTheme.colorScheme.background)
        ) {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .verticalScroll(scrollState)
                    .padding(horizontal = 16.dp, vertical = 12.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                // Enterprise Header Status Box
                EnterpriseBox(
                    modifier = Modifier.fillMaxWidth(),
                    cornerRadius = 10.dp,
                    contentPadding = PaddingValues(horizontal = 14.dp, vertical = 10.dp)
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Box(
                                modifier = Modifier
                                    .size(7.dp)
                                    .clip(CircleShape)
                                    .background(AppColors.EmeraldSuccess)
                            )
                            Spacer(modifier = Modifier.width(6.dp))
                            Text(
                                "BACKEND: ${ApiConfig.currentEnvironment().displayName.uppercase()}",
                                style = MaterialTheme.typography.labelSmall.copy(
                                    fontFamily = FontFamily.Monospace,
                                    fontWeight = FontWeight.Bold,
                                    color = AppColors.EmeraldSuccess,
                                    fontSize = 10.sp
                                )
                            )
                        }

                        Surface(
                            shape = RoundedCornerShape(4.dp),
                            color = AppColors.BluePrimary.copy(alpha = 0.15f),
                            modifier = Modifier.clickable { showServerConfigDialog = true }
                        ) {
                            Text(
                                "SWITCH SERVER",
                                style = MaterialTheme.typography.labelSmall.copy(
                                    fontFamily = FontFamily.Monospace,
                                    fontWeight = FontWeight.Bold,
                                    color = AppColors.BlueBright,
                                    fontSize = 9.sp
                                ),
                                modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                            )
                        }
                    }
                }

                Spacer(modifier = Modifier.height(14.dp))

                Text(
                    text = when (uiState.currentTab) {
                        AuthTab.SIGN_IN -> "Enterprise Sign In"
                        AuthTab.OTP -> "Instant OTP Login"
                        AuthTab.SIGN_UP -> "Provision Account"
                        AuthTab.PASSKEY -> "Hardware Passkey / Enclave"
                        AuthTab.TWO_FACTOR -> "Two-Factor Authentication"
                    },
                    style = MaterialTheme.typography.headlineMedium.copy(
                        fontWeight = FontWeight.ExtraBold,
                        letterSpacing = (-0.5).sp
                    ),
                    textAlign = TextAlign.Center
                )

                Text(
                    text = when (uiState.currentTab) {
                        AuthTab.SIGN_IN -> "Access your zero-knowledge enterprise encrypted vault"
                        AuthTab.OTP -> "Receive a one-time cryptographic authorization code"
                        AuthTab.SIGN_UP -> "Generate client-side post-quantum keypairs"
                        AuthTab.PASSKEY -> "Hardware-backed biometrics via FIDO2 / Secure Enclave"
                        AuthTab.TWO_FACTOR -> "Enter 6-digit TOTP from your authenticator application"
                    },
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.padding(horizontal = 12.dp, vertical = 4.dp)
                )

                Spacer(modifier = Modifier.height(16.dp))

                // Segmented Navigation Switcher
                IosSegmentedControl(
                    items = listOf(AuthTab.SIGN_IN, AuthTab.OTP, AuthTab.SIGN_UP, AuthTab.PASSKEY),
                    selectedItem = uiState.currentTab,
                    itemLabel = { tab ->
                        when (tab) {
                            AuthTab.SIGN_IN -> "Password"
                            AuthTab.OTP -> "Send OTP"
                            AuthTab.SIGN_UP -> "Sign Up"
                            AuthTab.PASSKEY -> "Passkey"
                            AuthTab.TWO_FACTOR -> "2FA"
                        }
                    },
                    itemIcon = { tab ->
                        when (tab) {
                            AuthTab.SIGN_IN -> Icons.Outlined.Lock
                            AuthTab.OTP -> Icons.Outlined.MarkEmailRead
                            AuthTab.SIGN_UP -> Icons.Outlined.PersonAdd
                            AuthTab.PASSKEY -> Icons.Outlined.Fingerprint
                            AuthTab.TWO_FACTOR -> Icons.Outlined.Shield
                        }
                    },
                    onItemSelected = { authViewModel.setTab(it) }
                )

                Spacer(modifier = Modifier.height(16.dp))

                // Inline Error / Success Alerts
                AnimatedVisibility(visible = uiState.errorMessage != null) {
                    uiState.errorMessage?.let { error ->
                        Surface(
                            shape = RoundedCornerShape(10.dp),
                            color = MaterialTheme.colorScheme.errorContainer.copy(alpha = 0.9f),
                            border = androidx.compose.foundation.BorderStroke(
                                0.5.dp,
                                MaterialTheme.colorScheme.error.copy(alpha = 0.4f)
                            ),
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(bottom = 14.dp)
                        ) {
                            Row(
                                modifier = Modifier.padding(12.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Icon(
                                    imageVector = Icons.Default.ErrorOutline,
                                    contentDescription = "Error",
                                    tint = MaterialTheme.colorScheme.error,
                                    modifier = Modifier.size(18.dp)
                                )
                                Spacer(modifier = Modifier.width(8.dp))
                                Text(
                                    text = error,
                                    style = MaterialTheme.typography.bodySmall.copy(fontWeight = FontWeight.Medium),
                                    color = MaterialTheme.colorScheme.onErrorContainer
                                )
                            }
                        }
                    }
                }

                AnimatedVisibility(visible = uiState.successMessage != null) {
                    uiState.successMessage?.let { success ->
                        Surface(
                            shape = RoundedCornerShape(10.dp),
                            color = AppColors.EmeraldSuccess.copy(alpha = 0.15f),
                            border = androidx.compose.foundation.BorderStroke(
                                0.5.dp,
                                AppColors.EmeraldSuccess.copy(alpha = 0.35f)
                            ),
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(bottom = 14.dp)
                        ) {
                            Row(
                                modifier = Modifier.padding(12.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Icon(
                                    imageVector = Icons.Default.CheckCircle,
                                    contentDescription = "Success",
                                    tint = AppColors.EmeraldSuccess,
                                    modifier = Modifier.size(18.dp)
                                )
                                Spacer(modifier = Modifier.width(8.dp))
                                Text(
                                    text = success,
                                    style = MaterialTheme.typography.bodySmall.copy(fontWeight = FontWeight.Medium),
                                    color = AppColors.EmeraldSuccess
                                )
                            }
                        }
                    }
                }

                // Interactive Tab Sections
                AnimatedContent(
                    targetState = uiState.currentTab,
                    transitionSpec = {
                        fadeIn(animationSpec = tween(220)) togetherWith fadeOut(animationSpec = tween(180))
                    },
                    label = "tab_content"
                ) { tab ->
                    when (tab) {
                        AuthTab.SIGN_IN -> {
                            SignInSection(
                                uiState = uiState,
                                onIdentifierChange = authViewModel::onLoginIdentifierChange,
                                onPasswordChange = authViewModel::onLoginPasswordChange,
                                onRememberMeToggle = authViewModel::onRememberMeToggle,
                                onSignIn = { authViewModel.signIn(onNavigateToDashboard) },
                                onSwitchToOtp = { authViewModel.setTab(AuthTab.OTP) }
                            )
                        }
                        AuthTab.OTP -> {
                            OtpSection(
                                uiState = uiState,
                                onEmailChange = authViewModel::onOtpEmailChange,
                                onSendOtp = authViewModel::sendOtp,
                                onOtpCodeChange = authViewModel::onOtpCodeInputChange,
                                onVerifyOtp = { authViewModel.verifyOtp(onNavigateToDashboard) }
                            )
                        }
                        AuthTab.SIGN_UP -> {
                            SignUpSection(
                                uiState = uiState,
                                onFullNameChange = authViewModel::onRegFullNameChange,
                                onUsernameChange = authViewModel::onRegUsernameChange,
                                onEmailChange = authViewModel::onRegEmailChange,
                                onPasswordChange = authViewModel::onRegPasswordChange,
                                onConfirmPasswordChange = authViewModel::onRegConfirmPasswordChange,
                                on2FaToggle = authViewModel::onReg2FaToggle,
                                onSignUp = { authViewModel.signUp(onNavigateToDashboard) }
                            )
                        }
                        AuthTab.PASSKEY -> {
                            PasskeySection(
                                uiState = uiState,
                                onAuthenticate = { authViewModel.authenticateWithPasskey(onNavigateToDashboard) }
                            )
                        }
                        AuthTab.TWO_FACTOR -> {
                            TwoFactorSection(
                                uiState = uiState,
                                onCodeChange = authViewModel::onTotpCodeChange,
                                onVerify = { authViewModel.verifyTotp(onNavigateToDashboard) },
                                onCancel = { authViewModel.setTab(AuthTab.SIGN_IN) }
                            )
                        }
                    }
                }

                Spacer(modifier = Modifier.height(20.dp))

                // Bottom Enterprise Security & Website Sync Card
                EnterpriseBox(
                    modifier = Modifier.fillMaxWidth(),
                    cornerRadius = 12.dp
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(
                                imageVector = Icons.Default.CloudSync,
                                contentDescription = "Cloud Sync",
                                tint = AppColors.BlueBright,
                                modifier = Modifier.size(18.dp)
                            )
                            Spacer(modifier = Modifier.width(8.dp))
                            Text(
                                "Live Web Console Sync",
                                style = MaterialTheme.typography.titleSmall.copy(fontWeight = FontWeight.Bold)
                            )
                        }
                        Surface(
                            shape = RoundedCornerShape(4.dp),
                            color = AppColors.EmeraldSuccess.copy(alpha = 0.15f)
                        ) {
                            Text(
                                text = "CONNECTED",
                                style = MaterialTheme.typography.labelSmall.copy(
                                    fontFamily = FontFamily.Monospace,
                                    fontWeight = FontWeight.Bold,
                                    color = AppColors.EmeraldSuccess,
                                    fontSize = 10.sp
                                ),
                                modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                            )
                        }
                    }
                    Spacer(modifier = Modifier.height(6.dp))
                    Text(
                        text = "Encrypted master keys and identity claims synchronize bidirectionally to https://syncveil.software.",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }

                Spacer(modifier = Modifier.height(20.dp))
            }

            // Top Floating Dynamic Island Banner
            IosDynamicIslandBanner(
                visible = uiState.showBanner,
                title = uiState.bannerTitle,
                subtitle = uiState.bannerSubtitle,
                code = uiState.bannerCode,
                onDismiss = { authViewModel.dismissBanner() },
                modifier = Modifier.align(Alignment.TopCenter)
            )

            if (showServerConfigDialog) {
                BackendConfigDialog(
                    cloudSyncManager = cloudSyncManager,
                    onDismiss = { showServerConfigDialog = false }
                )
            }
        }
    }
}

@Composable
private fun OtpSection(
    uiState: AuthUiState,
    onEmailChange: (String) -> Unit,
    onSendOtp: () -> Unit,
    onOtpCodeChange: (String) -> Unit,
    onVerifyOtp: () -> Unit
) {
    EnterpriseBox(modifier = Modifier.fillMaxWidth()) {
        Text(
            text = "Email One-Time Password",
            style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold)
        )
        Spacer(modifier = Modifier.height(6.dp))
        Text(
            text = "Enter your registered email address. A 6-digit cryptographic verification OTP will be sent immediately.",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )

        Spacer(modifier = Modifier.height(16.dp))

        OutlinedTextField(
            value = uiState.otpEmail,
            onValueChange = onEmailChange,
            label = { Text("Email Address") },
            placeholder = { Text("user@example.com") },
            leadingIcon = {
                Icon(Icons.Outlined.Email, contentDescription = "Email")
            },
            trailingIcon = {
                if (uiState.resendCountdown > 0) {
                    Text(
                        text = "${uiState.resendCountdown}s",
                        style = MaterialTheme.typography.labelMedium.copy(
                            fontFamily = FontFamily.Monospace,
                            fontWeight = FontWeight.Bold,
                            color = AppColors.BlueBright
                        ),
                        modifier = Modifier.padding(end = 12.dp)
                    )
                }
            },
            singleLine = true,
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email, imeAction = ImeAction.Done),
            keyboardActions = KeyboardActions(onDone = { if (!uiState.isOtpSent) onSendOtp() }),
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(10.dp)
        )

        Spacer(modifier = Modifier.height(14.dp))

        Button(
            onClick = onSendOtp,
            enabled = !uiState.isLoading && uiState.resendCountdown == 0,
            shape = RoundedCornerShape(8.dp),
            colors = ButtonDefaults.buttonColors(containerColor = AppColors.BluePrimary),
            modifier = Modifier
                .fillMaxWidth()
                .height(48.dp)
        ) {
            if (uiState.isLoading && !uiState.isOtpSent) {
                CircularProgressIndicator(
                    modifier = Modifier.size(20.dp),
                    color = Color.White,
                    strokeWidth = 2.dp
                )
            } else {
                Icon(Icons.Default.Send, contentDescription = "Send OTP", modifier = Modifier.size(18.dp))
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    text = if (uiState.isOtpSent) "Resend OTP Code" else "Send OTP to Email",
                    style = MaterialTheme.typography.labelLarge.copy(fontWeight = FontWeight.Bold)
                )
            }
        }

        if (uiState.isOtpSent) {
            Spacer(modifier = Modifier.height(20.dp))
            HorizontalDivider(color = MaterialTheme.colorScheme.outline.copy(alpha = 0.5f))
            Spacer(modifier = Modifier.height(16.dp))

            Text(
                text = "Enter 6-Digit OTP Code",
                style = MaterialTheme.typography.titleSmall.copy(fontWeight = FontWeight.Bold),
                modifier = Modifier.align(Alignment.CenterHorizontally)
            )

            Spacer(modifier = Modifier.height(12.dp))

            // iOS 6-Box PIN code entry
            IosOtpPinInput(
                otpValue = uiState.otpCodeInput,
                onOtpChange = onOtpCodeChange,
                onFilled = { onVerifyOtp() }
            )

            Spacer(modifier = Modifier.height(18.dp))

            Button(
                onClick = onVerifyOtp,
                enabled = !uiState.isLoading && uiState.otpCodeInput.length == 6,
                shape = RoundedCornerShape(8.dp),
                colors = ButtonDefaults.buttonColors(containerColor = AppColors.EmeraldSuccess),
                modifier = Modifier
                    .fillMaxWidth()
                    .height(50.dp)
            ) {
                if (uiState.isLoading) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(20.dp),
                        color = Color.White,
                        strokeWidth = 2.dp
                    )
                } else {
                    Icon(Icons.Default.Check, contentDescription = "Verify", modifier = Modifier.size(18.dp))
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        "Verify & Authorize Session",
                        style = MaterialTheme.typography.titleMedium.copy(
                            fontWeight = FontWeight.Bold,
                            color = Color.White
                        )
                    )
                }
            }
        }
    }
}

@Composable
private fun SignInSection(
    uiState: AuthUiState,
    onIdentifierChange: (String) -> Unit,
    onPasswordChange: (String) -> Unit,
    onRememberMeToggle: (Boolean) -> Unit,
    onSignIn: () -> Unit,
    onSwitchToOtp: () -> Unit
) {
    var passwordVisible by remember { mutableStateOf(false) }

    EnterpriseBox(modifier = Modifier.fillMaxWidth()) {
        OutlinedTextField(
            value = uiState.loginIdentifier,
            onValueChange = onIdentifierChange,
            label = { Text("Email or Username") },
            placeholder = { Text("user@syncveil.software") },
            leadingIcon = {
                Icon(Icons.Outlined.Person, contentDescription = "Email/Username")
            },
            singleLine = true,
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email, imeAction = ImeAction.Next),
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(10.dp)
        )

        Spacer(modifier = Modifier.height(12.dp))

        OutlinedTextField(
            value = uiState.loginPassword,
            onValueChange = onPasswordChange,
            label = { Text("Master Key / Password") },
            leadingIcon = {
                Icon(Icons.Outlined.Lock, contentDescription = "Password")
            },
            trailingIcon = {
                IconButton(onClick = { passwordVisible = !passwordVisible }) {
                    Icon(
                        imageVector = if (passwordVisible) Icons.Default.VisibilityOff else Icons.Default.Visibility,
                        contentDescription = if (passwordVisible) "Hide password" else "Show password"
                    )
                }
            },
            visualTransformation = if (passwordVisible) VisualTransformation.None else PasswordVisualTransformation(),
            singleLine = true,
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password, imeAction = ImeAction.Done),
            keyboardActions = KeyboardActions(onDone = { onSignIn() }),
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(10.dp)
        )

        Spacer(modifier = Modifier.height(10.dp))

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier.clickable { onRememberMeToggle(!uiState.isRememberMe) }
            ) {
                Checkbox(
                    checked = uiState.isRememberMe,
                    onCheckedChange = onRememberMeToggle
                )
                Text(
                    "Remember Device",
                    style = MaterialTheme.typography.bodySmall
                )
            }
        }

        Spacer(modifier = Modifier.height(14.dp))

        Button(
            onClick = onSignIn,
            enabled = !uiState.isLoading,
            shape = RoundedCornerShape(8.dp),
            colors = ButtonDefaults.buttonColors(containerColor = AppColors.BluePrimary),
            modifier = Modifier
                .fillMaxWidth()
                .height(50.dp)
        ) {
            if (uiState.isLoading) {
                CircularProgressIndicator(
                    modifier = Modifier.size(20.dp),
                    color = Color.White,
                    strokeWidth = 2.dp
                )
            } else {
                Icon(Icons.Default.Login, contentDescription = "Sign In")
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    "Sign In with Master Key",
                    style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold)
                )
            }
        }

        Spacer(modifier = Modifier.height(10.dp))

        OutlinedButton(
            onClick = onSwitchToOtp,
            shape = RoundedCornerShape(8.dp),
            modifier = Modifier
                .fillMaxWidth()
                .height(46.dp)
        ) {
            Icon(Icons.Outlined.MarkEmailRead, contentDescription = "OTP", modifier = Modifier.size(18.dp))
            Spacer(modifier = Modifier.width(8.dp))
            Text(
                "Sign in with Email OTP instead",
                style = MaterialTheme.typography.labelMedium.copy(fontWeight = FontWeight.SemiBold)
            )
        }
    }
}

@Composable
private fun SignUpSection(
    uiState: AuthUiState,
    onFullNameChange: (String) -> Unit,
    onUsernameChange: (String) -> Unit,
    onEmailChange: (String) -> Unit,
    onPasswordChange: (String) -> Unit,
    onConfirmPasswordChange: (String) -> Unit,
    on2FaToggle: (Boolean) -> Unit,
    onSignUp: () -> Unit
) {
    var passwordVisible by remember { mutableStateOf(false) }

    val passwordStrength = remember(uiState.regPassword) {
        when {
            uiState.regPassword.isEmpty() -> 0
            uiState.regPassword.length < 6 -> 1
            uiState.regPassword.length < 10 -> 2
            uiState.regPassword.any { it.isDigit() } && uiState.regPassword.any { !it.isLetterOrDigit() } -> 4
            else -> 3
        }
    }

    EnterpriseBox(modifier = Modifier.fillMaxWidth()) {
        OutlinedTextField(
            value = uiState.regFullName,
            onValueChange = onFullNameChange,
            label = { Text("Full Name") },
            placeholder = { Text("e.g. Alex Mercer") },
            leadingIcon = { Icon(Icons.Outlined.Badge, contentDescription = "Full Name") },
            singleLine = true,
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(10.dp)
        )

        Spacer(modifier = Modifier.height(10.dp))

        OutlinedTextField(
            value = uiState.regUsername,
            onValueChange = onUsernameChange,
            label = { Text("Username") },
            placeholder = { Text("alex_mercer") },
            leadingIcon = { Icon(Icons.Outlined.AccountCircle, contentDescription = "Username") },
            singleLine = true,
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(10.dp)
        )

        Spacer(modifier = Modifier.height(10.dp))

        OutlinedTextField(
            value = uiState.regEmail,
            onValueChange = onEmailChange,
            label = { Text("Email Address") },
            placeholder = { Text("alex@example.com") },
            leadingIcon = { Icon(Icons.Outlined.Email, contentDescription = "Email") },
            singleLine = true,
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email),
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(10.dp)
        )

        Spacer(modifier = Modifier.height(10.dp))

        OutlinedTextField(
            value = uiState.regPassword,
            onValueChange = onPasswordChange,
            label = { Text("Master Password") },
            leadingIcon = { Icon(Icons.Outlined.Lock, contentDescription = "Password") },
            trailingIcon = {
                IconButton(onClick = { passwordVisible = !passwordVisible }) {
                    Icon(
                        imageVector = if (passwordVisible) Icons.Default.VisibilityOff else Icons.Default.Visibility,
                        contentDescription = if (passwordVisible) "Hide password" else "Show password"
                    )
                }
            },
            visualTransformation = if (passwordVisible) VisualTransformation.None else PasswordVisualTransformation(),
            singleLine = true,
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(10.dp)
        )

        if (uiState.regPassword.isNotEmpty()) {
            Spacer(modifier = Modifier.height(6.dp))
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(4.dp)
            ) {
                for (i in 1..4) {
                    val barColor = when {
                        passwordStrength >= i && passwordStrength <= 1 -> Color(0xFFEF4444)
                        passwordStrength >= i && passwordStrength == 2 -> AppColors.AmberWarning
                        passwordStrength >= i -> AppColors.EmeraldSuccess
                        else -> MaterialTheme.colorScheme.surfaceVariant
                    }
                    Box(
                        modifier = Modifier
                            .weight(1f)
                            .height(4.dp)
                            .clip(RoundedCornerShape(2.dp))
                            .background(barColor)
                    )
                }
            }
        }

        Spacer(modifier = Modifier.height(10.dp))

        OutlinedTextField(
            value = uiState.regConfirmPassword,
            onValueChange = onConfirmPasswordChange,
            label = { Text("Confirm Master Password") },
            leadingIcon = { Icon(Icons.Outlined.LockReset, contentDescription = "Confirm Password") },
            visualTransformation = PasswordVisualTransformation(),
            singleLine = true,
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(10.dp)
        )

        Spacer(modifier = Modifier.height(12.dp))

        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(8.dp))
                .background(MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f))
                .clickable { on2FaToggle(!uiState.regEnable2Fa) }
                .padding(10.dp)
        ) {
            Checkbox(
                checked = uiState.regEnable2Fa,
                onCheckedChange = on2FaToggle
            )
            Spacer(modifier = Modifier.width(8.dp))
            Column {
                Text(
                    "Require 2FA TOTP Protection",
                    style = MaterialTheme.typography.titleSmall.copy(fontWeight = FontWeight.Bold)
                )
                Text(
                    "Hardware or authenticator app enforcement",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }

        Spacer(modifier = Modifier.height(16.dp))

        Button(
            onClick = onSignUp,
            enabled = !uiState.isLoading,
            shape = RoundedCornerShape(8.dp),
            colors = ButtonDefaults.buttonColors(containerColor = AppColors.BluePrimary),
            modifier = Modifier
                .fillMaxWidth()
                .height(50.dp)
        ) {
            if (uiState.isLoading) {
                CircularProgressIndicator(
                    modifier = Modifier.size(20.dp),
                    color = Color.White,
                    strokeWidth = 2.dp
                )
            } else {
                Icon(Icons.Default.Security, contentDescription = "Create Account")
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    "Provision Encrypted Account",
                    style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold)
                )
            }
        }
    }
}

@Composable
private fun PasskeySection(
    uiState: AuthUiState,
    onAuthenticate: () -> Unit
) {
    EnterpriseBox(modifier = Modifier.fillMaxWidth()) {
        Column(
            modifier = Modifier.fillMaxWidth(),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Box(
                modifier = Modifier
                    .size(76.dp)
                    .clip(RoundedCornerShape(16.dp))
                    .background(AppColors.BluePrimary.copy(alpha = 0.15f))
                    .border(1.5.dp, AppColors.BlueBright, RoundedCornerShape(16.dp)),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector = Icons.Default.Fingerprint,
                    contentDescription = "Fingerprint Passkey",
                    tint = AppColors.BlueBright,
                    modifier = Modifier.size(44.dp)
                )
            }

            Spacer(modifier = Modifier.height(16.dp))

            Text(
                text = "Biometric Passkey / Secure Enclave",
                style = MaterialTheme.typography.titleLarge.copy(fontWeight = FontWeight.Bold)
            )

            Spacer(modifier = Modifier.height(6.dp))

            Text(
                text = "Authenticate securely with your hardware biometric enclave. Private keys are never exported across network boundaries.",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                textAlign = TextAlign.Center
            )

            Spacer(modifier = Modifier.height(20.dp))

            Button(
                onClick = onAuthenticate,
                enabled = !uiState.isAuthenticatingPasskey,
                shape = RoundedCornerShape(8.dp),
                colors = ButtonDefaults.buttonColors(containerColor = AppColors.BluePrimary),
                modifier = Modifier
                    .fillMaxWidth()
                    .height(50.dp)
            ) {
                if (uiState.isAuthenticatingPasskey) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(20.dp),
                        color = Color.White,
                        strokeWidth = 2.dp
                    )
                    Spacer(modifier = Modifier.width(10.dp))
                    Text("Scanning Enclave...")
                } else {
                    Icon(Icons.Default.Key, contentDescription = "Passkey")
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        "Authenticate with Passkey",
                        style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold)
                    )
                }
            }
        }
    }
}

@Composable
private fun TwoFactorSection(
    uiState: AuthUiState,
    onCodeChange: (String) -> Unit,
    onVerify: () -> Unit,
    onCancel: () -> Unit
) {
    EnterpriseBox(modifier = Modifier.fillMaxWidth()) {
        Column(
            modifier = Modifier.fillMaxWidth(),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Box(
                modifier = Modifier
                    .size(64.dp)
                    .clip(RoundedCornerShape(14.dp))
                    .background(AppColors.AmberWarning.copy(alpha = 0.15f)),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector = Icons.Default.Shield,
                    contentDescription = "2FA Shield",
                    tint = AppColors.AmberWarning,
                    modifier = Modifier.size(34.dp)
                )
            }

            Spacer(modifier = Modifier.height(14.dp))

            Text(
                text = "Two-Factor Verification",
                style = MaterialTheme.typography.titleLarge.copy(fontWeight = FontWeight.Bold)
            )

            Spacer(modifier = Modifier.height(6.dp))

            Text(
                text = "Enter the 6-digit TOTP code generated by Google Authenticator or your enterprise identity key.",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                textAlign = TextAlign.Center
            )

            Spacer(modifier = Modifier.height(18.dp))

            IosOtpPinInput(
                otpValue = uiState.totpCode,
                onOtpChange = onCodeChange,
                onFilled = onVerify
            )

            Spacer(modifier = Modifier.height(18.dp))

            Button(
                onClick = onVerify,
                enabled = !uiState.isLoading && uiState.totpCode.length == 6,
                shape = RoundedCornerShape(8.dp),
                colors = ButtonDefaults.buttonColors(containerColor = AppColors.EmeraldSuccess),
                modifier = Modifier
                    .fillMaxWidth()
                    .height(50.dp)
            ) {
                if (uiState.isLoading) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(20.dp),
                        color = Color.White,
                        strokeWidth = 2.dp
                    )
                } else {
                    Icon(Icons.Default.VerifiedUser, contentDescription = "Verify")
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        "Verify & Unlock Vault",
                        style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold)
                    )
                }
            }

            Spacer(modifier = Modifier.height(8.dp))

            TextButton(onClick = onCancel) {
                Text("Return to Sign In", color = AppColors.BlueBright)
            }
        }
    }
}

