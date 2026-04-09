import { useState } from "react";
import { LogOut,KeyRound } from "lucide-react";
import toast from "react-hot-toast";
import { apiFetch } from '../../utils/api'

import ResetPasswordModal from "../../components/resetModal/ResetPasswordModal.jsx";
const API = import.meta.env.VITE_API_URL
const Navbar = ({ handleLogout }) => {
  const [showDropdown, setShowDropdown] = useState(false);
  const storedUser = JSON.parse(localStorage.getItem("organizerUser"));
  const [showResetModal, setShowResetModal] = useState(false);

    const handleResetPassword = async (data) => {
        const toastId = toast.loading("Updating password...");

        try {
            const res = await apiFetch(`${API}/api/users/reset-password`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json',
                        Authorization: `Bearer ${storedUser?.token}` 
                    },
            body: JSON.stringify({
                oldPassword: data.oldPassword,
                newPassword: data.newPassword
            }),
            });

            const result = await res.json(); // IMPORTANT

            if (!res.ok) {

            throw new Error(result.message || "Failed to update password");
            }

            toast.success("Password updated successfully 🔐", { id: toastId });
            setShowResetModal(false);

        } catch (error) {
            toast.error(error.message || "Something went wrong", { id: toastId });
            console.log(error);
        }
    };

  return (

    <>
        <nav className="navbar">
            {/* LEFT */}
            <div className="navbar-logo">
                <span>🛡️</span>
                <span>SecureCrowd</span>
                <span className="role-text"> / Organizer</span>
            </div>

            {/* RIGHT */}
            <div className="nav-right">
                
                {/* USER */}
                <div
                    className="user-section"
                    onMouseEnter={() => setShowDropdown(true)}
                    onMouseLeave={() => setShowDropdown(false)}
                >
                    <div className="user-info">
                        
                        {/* Avatar Circle */}
                        <div className="avatar">
                        {storedUser?.username?.charAt(0).toUpperCase()}
                        </div>

                        {/* Username */}
                        <span>{storedUser?.username}</span>
                    </div>

                    {showDropdown && (
                        <div className="dropdown">
                            <p><strong>Username :</strong> {storedUser?.username}</p>
                            <p><strong>Role :</strong> {storedUser?.role?.toUpperCase()}</p>
                            <hr className="dropdown-divider" />

                            <button 
                                className="dropdown-item"
                                onClick={() => setShowResetModal(true)}
                                >
                                <KeyRound size={16} style={{ marginRight: "8px" }} />
                                Reset Password
                            </button>
                        </div>
                    )}
                </div>

                {/* LOGOUT */}
                <button className="logout-btn" onClick={handleLogout}>
                <LogOut size={16} />
                Logout
                </button>

            </div>
        </nav>
        {showResetModal && (
        <ResetPasswordModal
            onClose={() => setShowResetModal(false)}
            onSubmit={(data) => {
               handleResetPassword(data);
            }}
        />
        )}
    </>
  );
};

export default Navbar;