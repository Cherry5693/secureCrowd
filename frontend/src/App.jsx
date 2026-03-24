
import { useState } from "react";
import "./App.css";
import Groups from "./components/groups";
import Auth from "./components/Auth";

function App() {
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem("secureCrowdUser");
    return stored ? JSON.parse(stored) : null;
  });

  if (!user) {
    return <Auth onAuthSuccess={(u) => setUser(u)} />;
  }

  return <Groups user={user} onLogout={() => { localStorage.removeItem("secureCrowdUser"); setUser(null); }} />;
}

export default App;
