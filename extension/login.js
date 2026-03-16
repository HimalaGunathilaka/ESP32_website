/**
 * @fileoverview Authentication and WebSocket management for the extension.
 */

// ==========================================
// Constants & Configuration
// ==========================================

/** * Base URL for authentication API.
 * @type {string}
 */
const API_BASE_URL = "http://localhost:8080";

/** * WebSocket server URL.
 * @type {string} 
 */
const WS_URL = "ws://localhost:8081";


/**
 * Class representing the Authentication Controller.
 * Handles UI interactions, API requests, and WebSocket state.
 */
class AuthController {
    constructor() {
        /**
         * The active WebSocket connection.
         * @type {WebSocket|null}
         */
        this.socket = null;
    }

    /**
     * Caches DOM elements, attaches event listeners, and checks initial auth state.
     * Should be called on DOMContentLoaded.
     * @return {Promise<void>}
     */
    async init() {
        this.messageBox = document.getElementById('message');

        this.loginBtn = document.querySelector('#login button');
        this.loginInputs = document.querySelectorAll('#login input');

        this.registerBtn = document.querySelector('#register button');
        this.registerInputs = document.querySelectorAll('#register input');

        // Attach Listeners
        if (this.loginBtn) {
            this.loginBtn.addEventListener('click', () => this.handleLogin());
        }

        if (this.registerBtn) {
            this.registerBtn.addEventListener('click', () => this.handleRegister());
        }

        // Check existing auth state
        await this.checkExistingAuth();
    }

    /**
     * Checks Chrome local storage for existing credentials and connects 
     * to the WebSocket if authenticated.
     * @returns {Promise<void>}
     */
    async checkExistingAuth() {
        try {
            const { isLogged, token } = await chrome.storage.local.get(['isLogged', 'token']);
            if (isLogged && token) {
                this.connectWebsocket(token);
            }
        } catch (err) {
            console.error('Failed to retrieve auth state from storage:', err);
        }
    }

    /**
   * Handles the login button click, authenticates the user, and updates storage.
   * @returns {Promise<void>}
   */
    async handleLogin() {
        const username = this.loginInputs[0]?.value.trim();
        const password = this.loginInputs[1]?.value.trim();

        if (!username || !password) {
            this.showMessage('Please fill in all login fields', 'error');
            return;
        }

        try {
            const res = await fetch(`${API_BASE_URL}/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            const data = await res.json();

            if (!res.ok) {
                this.showMessage(data.message || 'Login failed', 'error');
                return;
            }

            this.showMessage('Login successful', 'success');

            await chrome.storage.local.set({
                username,
                token: data.accessToken,
                isLogged: true
            });

            // Automatically close the current tab after 1 second
            setTimeout(() => {
                chrome.tabs.getCurrent((tab) => {
                    if (tab?.id) {
                        chrome.tabs.remove(tab.id);
                    }
                });
            }, 1000);
        } catch (err) {
            console.error('Login error:', err);
            this.showMessage('Server is not running', 'error');
        }
    }

    /**
     * Handles the register button click and registers a new user.
     * @returns {Promise<void>}
     */
    async handleRegister() {
        const username = this.registerInputs[0]?.value.trim();
        const email = this.registerInputs[1]?.value.trim();
        const password = this.registerInputs[2]?.value.trim();
        const confirmPassword = this.registerInputs[3]?.value.trim();

        if (!username || !email || !password || !confirmPassword) {
            this.showMessage('Please fill in all register fields', 'error');
            return;
        }

        if (password !== confirmPassword) {
            this.showMessage('Passwords do not match', 'error');
            return;
        }

        try {
            const res = await fetch(`${API_BASE_URL}/add-user`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password, email })
            });

            const data = await res.json();

            if (!res.ok) {
                this.showMessage(data.message || 'Registration failed', 'error');
                return;
            }

            this.showMessage('Registration successful. Please log in.', 'success');

            // Clear form fields here
            this.registerInputs.forEach(input => input.value = '');

        } catch (err) {
            console.error('Registration error:', err);
            this.showMessage('Server is not running', 'error');
        }
    }
    /**
     * Displays a temporary notification message on the screen.
     * @param {string} text - The message to display.
     * @param {string} [type='success'] - The CSS class for styling ('success' or 'error').
     */
    showMessage(text, type = 'success') {
        if (!this.messageBox) return;

        this.messageBox.textContent = text;
        this.messageBox.className = type;
        this.messageBox.style.display = 'block';

        setTimeout(() => {
            this.messageBox.style.display = 'none';
        }, 2500);
    }

    /**
     * Establishes a WebSocket connection and handles connection events.
     * @param {string} token - The user's authentication token.
     */

    connectWebsocket(token) {
        this.socket = new WebSocket(WS_URL);

        this.socket.addEventListener('open', () => {
            this.socket.send(JSON.stringify({
                type: 'auth',
                token
            }));
        });

        this.socket.addEventListener('message', (event) => {
            try {
                const msg = JSON.parse(event.data);
                if (msg.type === 'auth' && msg.status === 'ok') {
                    console.log('Websocket authenticated');
                }
            } catch (err) {
                console.error('Failed to parse WebSocket message:', err);
            }
        });

        this.socket.addEventListener('close', () => {
            console.log('Websocket closed');
            this.socket = null;
        });

        this.socket.addEventListener('error', (err) => {
            console.error('WebSocket error:', err);
        });
    }
}

// Bootstrap the application
document.addEventListener('DOMContentLoaded', () => {
    const authController = new AuthController();
    authController.init();
})