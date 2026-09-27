const SESSION_KEY = "distill_session";
const TOKEN_KEY = "distill_token";

const API_BASE = "http://localhost:5000/api";

// =========================
// SIGNUP
// =========================
async function signupUser(name, email, password) {
  if (!name || !email || !password) {
    return {
      ok: false,
      error: "Fill in every field to create your account."
    };
  }

  try {
    const response = await fetch(`${API_BASE}/auth/signup`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        name,
        email,
        password
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        ok: false,
        error: data.message || "Signup failed."
      };
    }

    return {
      ok: true,
      user: data.user
    };

  } catch (error) {
    console.error("Signup error:", error);

    return {
      ok: false,
      error: "Unable to connect to the server."
    };
  }
}


// =========================
// LOGIN
// =========================
async function loginUser(email, password) {
  if (!email || !password) {
    return {
      ok: false,
      error: "Enter your email and password."
    };
  }

  try {
    const response = await fetch(`${API_BASE}/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        email,
        password
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        ok: false,
        error: data.message || "Invalid email or password."
      };
    }

    // Make sure backend returned a JWT
    if (!data.token) {
      return {
        ok: false,
        error: "Login succeeded but no authentication token was received."
      };
    }

    // Store JWT token
    localStorage.setItem(TOKEN_KEY, data.token);

    // Store logged-in user
    localStorage.setItem(
      SESSION_KEY,
      JSON.stringify(data.user)
    );

    return {
      ok: true,
      user: data.user,
      token: data.token
    };

  } catch (error) {
    console.error("Login error:", error);

    return {
      ok: false,
      error: "Unable to connect to the server."
    };
  }
}


// =========================
// CURRENT USER
// =========================
function currentUser() {
  try {
    const session = localStorage.getItem(SESSION_KEY);

    if (!session) {
      return null;
    }

    return JSON.parse(session);

  } catch {
    return null;
  }
}


// =========================
// GET JWT TOKEN
// =========================
function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}


// =========================
// AUTHORIZATION HEADERS
// =========================
function authHeaders() {
  const token = getToken();

  return {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${token}`
  };
}


// =========================
// LOGOUT
// =========================
function logoutUser() {
  localStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(TOKEN_KEY);

  window.location.href = "login.html";
}


// =========================
// PROTECT PAGE
// =========================
function requireAuth() {
  const user = currentUser();
  const token = getToken();

  if (!user || !token) {
    window.location.href = "login.html";
    return false;
  }

  return true;
}