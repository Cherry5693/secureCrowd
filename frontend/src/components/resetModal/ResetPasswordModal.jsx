import { useState } from "react";
import { KeyRound, Eye, EyeOff, X } from "lucide-react";

import "./resetModal.css"

const ResetPasswordModal = ({ onClose, onSubmit }) => {
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");

  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({ oldPassword, newPassword });
  };

  return (
    <div className="modal-overlay">
      <div className="modal">

        {/* Header */}
        <div className="modal-header">
          <div className="modal-title">
            <KeyRound size={18} />
            <span>Reset Password</span>
          </div>
          <button className="close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="modal-body">

          {/* Old Password */}
          <div className="input-group">
            <label>Old Password</label>
            <div className="input-wrapper">
              <input
                type={showOld ? "text" : "password"}
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                placeholder="Enter old password"
                required
              />
              <span onClick={() => setShowOld(!showOld)}>
                {showOld ? <EyeOff size={16} /> : <Eye size={16} />}
              </span>
            </div>
          </div>

          {/* New Password */}
          <div className="input-group">
            <label>New Password</label>
            <div className="input-wrapper">
              <input
                type={showNew ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password"
                required
              />
              <span onClick={() => setShowNew(!showNew)}>
                {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="modal-actions">
            <button type="button" className="btn cancel" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn primary">
              Update Password
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};

export default ResetPasswordModal;