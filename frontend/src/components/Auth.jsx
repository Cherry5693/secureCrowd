import { useState } from "react";

const API_BASE = `${import.meta.env.VITE_API_URL}/api/users`;

function Auth({ onAuthSuccess }) {
  const [mode, setMode] = useState("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [seat, setSeat] = useState("");
  const [section, setSection] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError("Username and password are required");
      return;
    }
    if (mode === "register" && (!seat.trim() || !section.trim())) {
      setError("Seat and section are required for registration");
      return;
    }

    const url = mode === "login" ? `${API_BASE}/login` : `${API_BASE}/register`;
    const body = mode === "login" 
      ? { username, password } 
      : { username, password, seat, section };
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
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
        {mode === "register" && (
          <>
            <input
              value={seat}
              onChange={(e) => setSeat(e.target.value)}
              placeholder="Seat (e.g., B12)"
            />
            <input
              value={section}
              onChange={(e) => setSection(e.target.value)}
              placeholder="Section (e.g., B)"
            />
          </>
        )}
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
