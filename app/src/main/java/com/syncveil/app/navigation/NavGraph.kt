package com.syncveil.app.navigation

import android.app.Application
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.platform.LocalContext
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import com.syncveil.app.ui.screens.AuthScreen
import com.syncveil.app.ui.screens.AuthViewModel
import com.syncveil.app.ui.screens.DashboardScreen
import com.syncveil.app.ui.screens.HomeScreen
import com.syncveil.app.ui.screens.VaultScreen

@Composable
fun NavGraph() {
    val navController = rememberNavController()
    val authViewModel: AuthViewModel = viewModel(
        factory = ViewModelProvider.AndroidViewModelFactory.getInstance(
            LocalContext.current.applicationContext as Application
        )
    )
    val isLoggedIn by authViewModel.isLoggedIn.collectAsState()

    NavHost(
        navController = navController,
        startDestination = if (isLoggedIn) "dashboard" else "auth"
    ) {
        composable("home") {
            HomeScreen(
                isLoggedIn = isLoggedIn,
                onNavigateToAuth = { navController.navigate("auth") },
                onNavigateToDashboard = { navController.navigate("dashboard") }
            )
        }
        composable("auth") {
            AuthScreen(
                onNavigateToDashboard = {
                    navController.navigate("dashboard") {
                        popUpTo("auth") { inclusive = true }
                    }
                },
                onBack = {
                    if (navController.previousBackStackEntry != null) {
                        navController.popBackStack()
                    }
                },
                authViewModel = authViewModel
            )
        }
        composable("dashboard") {
            DashboardScreen(
                onNavigateToVault = { navController.navigate("vault") },
                onNavigateToAuth = { navController.navigate("auth") },
                onLogout = {
                    navController.navigate("auth") {
                        popUpTo(0) { inclusive = true }
                    }
                },
                authViewModel = authViewModel
            )
        }
        composable("vault") {
            VaultScreen(
                onBack = { navController.popBackStack() }
            )
        }
    }
}
