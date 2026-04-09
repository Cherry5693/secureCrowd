import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { apiFetch } from '../../utils/api'

const API = import.meta.env.VITE_API_URL;

export default function ResetPassword() {
  const { token } = useParams();
  const navigate = useNavigate();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!password || !confirmPassword) {
      return setError("All fields are required");
    }

    if (password.length < 4) {
      return setError("Password must be at least 4 characters");
    }

    if (password !== confirmPassword) {
      return setError("Passwords do not match");
    }

    setLoading(true);

    const toastId = toast.loading("Updating password...");

    try {
      const res = await apiFetch(`${API}/api/users/reset-password/${token}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      const data = await res.json();

      if (!res.ok) {
        return setError(data.message || "Failed to reset password");
      }

      toast.success("Successfully updated password!", { id: toastId });
      navigate("/auth"); 

    } catch {
        toast.error("Something went wrong", { id: toastId });
      setError("Network error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-center">
      <div className="card" style={{ width: 350 }}>
        <h2 style={{ marginBottom: 20 }}>Reset Password</h2>

        <form onSubmit={handleSubmit} className="auth-form">
          <div>
            <label className="input-label">New Password</label>
            <input
              className="input"
              type="password"
              placeholder="Enter new password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <div>
            <label className="input-label">Confirm Password</label>
            <input
              className="input"
              type="password"
              placeholder="Confirm password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </div>

          {error && <div className="error-msg">{error}</div>}

          <button className="btn btn-primary btn-full" disabled={loading}>
            {loading ? "Please wait..." : "Reset Password"}
          </button>
        </form>
      </div>
    </div>
  );
}