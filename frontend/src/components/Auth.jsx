import { useState } from "react";

const API_BASE = "http://localhost:5000/api/users";

function Auth({ onAuthSuccess }) {
  const [mode, setMode] = useState("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError("Username and password are required");
      return;
    }

    const url = mode === "login" ? `${API_BASE}/login` : `${API_BASE}/register`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });

    const json = await res.json();

    if (!res.ok) {
      setError(json.error || "Failed to authenticate");
      return;
    }

    setError("");
    onAuthSuccess(json);
    localStorage.setItem("secureCrowdUser", JSON.stringify(json));
  };

  return (
    <div className="auth-container">
      <h2>{mode === "login" ? "Login" : "Register"}</h2>
      <form onSubmit={handleSubmit}>
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Username"
          autoComplete="username"
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          autoComplete={mode === "login" ? "current-password" : "new-password"}
        />
        <button type="submit">{mode === "login" ? "Login" : "Register"}</button>
      </form>

      {error && <p className="error">{error}</p>}

      <p>
        {mode === "login" ? "No account? " : "Already have an account? "}
        <button onClick={() => setMode(mode === "login" ? "register" : "login")}>
          {mode === "login" ? "Register" : "Login"}
        </button>
      </p>
    </div>
  );
}

export default Auth;
