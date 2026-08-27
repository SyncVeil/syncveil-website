import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import App from './App';
import { authAPI, isAuthenticated, getCurrentUser } from './api';

// 1. Mock the API layer
jest.mock('./api', () => ({
  authAPI: {
    login: jest.fn(),
    logout: jest.fn(),
  },
  isAuthenticated: jest.fn(),
  getCurrentUser: jest.fn(),
}));

// 2. Mock child components, matching the actual props App.jsx passes
jest.mock('./components/Navigation', () => ({ onSwitchView, isAuthenticated: isAuth }) => (
  <button data-testid="nav-auth" onClick={() => onSwitchView('auth-choice')}>
    {isAuth ? 'Dashboard' : 'Sign In'}
  </button>
));

jest.mock('./components/views/Home', () => () => <div data-testid="home">Home</div>);
jest.mock('./components/views/Dashboard', () => () => <div data-testid="dashboard">Dashboard</div>);
jest.mock('./components/views/InfoPage', () => () => <div data-testid="info">Info Page</div>);
jest.mock('./components/Footer', () => () => <footer data-testid="footer">Footer</footer>);

// AuthChoice mock uses the actual props App.jsx passes: onAuth and onSwitchView
jest.mock('./components/views/AuthChoice', () => ({ onAuth, onSwitchView }) => (
  <div data-testid="auth-choice">
    <button
      data-testid="simulate-auth-success"
      onClick={() => onAuth({ id: '1', email: 'test@example.com' })}
    >
      Simulate Login Success
    </button>
    <button
      data-testid="go-home"
      onClick={() => onSwitchView('home')}
    >
      Back to Home
    </button>
  </div>
));

describe('App.jsx View Routing', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    isAuthenticated.mockReturnValue(false);
    getCurrentUser.mockReturnValue(null);
  });

  test('renders Home view by default when unauthenticated', () => {
    render(<App />);
    expect(screen.getByTestId('home')).toBeInTheDocument();
    expect(screen.getByTestId('footer')).toBeInTheDocument();
  });

  test('navigates to AuthChoice when nav button is clicked', async () => {
    render(<App />);
    fireEvent.click(screen.getByTestId('nav-auth'));
    await waitFor(() => {
      expect(screen.getByTestId('auth-choice')).toBeInTheDocument();
    });
  });

  test('switches to Dashboard and hides footer after successful auth', async () => {
    render(<App />);

    // Navigate to auth view
    fireEvent.click(screen.getByTestId('nav-auth'));
    await waitFor(() => expect(screen.getByTestId('auth-choice')).toBeInTheDocument());

    // Simulate successful login via onAuth callback
    fireEvent.click(screen.getByTestId('simulate-auth-success'));

    await waitFor(() => {
      expect(screen.getByTestId('dashboard')).toBeInTheDocument();
      expect(screen.queryByTestId('footer')).not.toBeInTheDocument();
    });
  });

  test('onSwitchView from AuthChoice navigates back to home', async () => {
    render(<App />);
    fireEvent.click(screen.getByTestId('nav-auth'));
    await waitFor(() => expect(screen.getByTestId('auth-choice')).toBeInTheDocument());

    fireEvent.click(screen.getByTestId('go-home'));
    await waitFor(() => {
      expect(screen.getByTestId('home')).toBeInTheDocument();
    });
  });

  test('restores authenticated session from localStorage on mount', () => {
    isAuthenticated.mockReturnValue(true);
    getCurrentUser.mockReturnValue({ id: '1', email: 'user@example.com' });

    render(<App />);
    // Dashboard requires isAuth=true and currentView='dashboard'
    // On mount it checks localStorage — session restored means isAuth=true
    // but view stays 'home' unless redirected; Nav button should reflect auth state
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
  });
});
