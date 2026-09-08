const DB_USERS_KEY = "distill_users";
const SESSION_KEY = "distill_session";

function getUsers() {
  try {
    return JSON.parse(localStorage.getItem(DB_USERS_KEY)) || [];
  } catch {
    return [];
  }
}

function saveUsers(users) {
  localStorage.setItem(DB_USERS_KEY, JSON.stringify(users));
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function signupUser(name, email, password) {
  if (!name || !email || !password) {
    return { ok: false, error: "Fill in every field to create your account." };
  }
  if (!isValidEmail(email)) {
    return { ok: false, error: "Enter a real email address, like you@gmail.com." };
  }
  if (password.length < 6) {
    return { ok: false, error: "Use at least 6 characters for your password." };
  }
  const users = getUsers();
  if (users.some((u) => u.email.toLowerCase() === email.toLowerCase())) {
    return { ok: false, error: "An account already exists for that email. Log in instead." };
  }
  users.push({ name, email, password });
  saveUsers(users);
  return { ok: true };
}

function loginUser(email, password) {
  if (!email || !password) {
    return { ok: false, error: "Enter your email and password." };
  }
  if (!isValidEmail(email)) {
    return { ok: false, error: "That email doesn't look right." };
  }
  const users = getUsers();
  const match = users.find(
    (u) => u.email.toLowerCase() === email.toLowerCase() && u.password === password
  );
  if (!match) {
    return { ok: false, error: "Wrong email or password. Check your details, or sign up." };
  }
  localStorage.setItem(SESSION_KEY, JSON.stringify({ name: match.name, email: match.email }));
  return { ok: true };
}

function currentUser() {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY));
  } catch {
    return null;
  }
}

function logoutUser() {
  localStorage.removeItem(SESSION_KEY);
  window.location.href = "login.html";
}

// Call at the top of any page that requires a logged-in user.
function requireAuth() {
  if (!currentUser()) {
    window.location.href = "login.html";
  }
}
