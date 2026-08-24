import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { useAuth } from "./store";
import { BottomNav, ToastHost } from "./components/ui";
import Login from "./pages/Login";
import Home from "./pages/Home";
import Schedule from "./pages/Schedule";
import Profile from "./pages/Profile";
import Repertoire from "./pages/Repertoire";
import EventDetail from "./pages/EventDetail";
import Holyrics from "./pages/Holyrics";

function Protected({ children }: { children: React.ReactNode }) {
  const user = useAuth((s) => s.user);
  const loc = useLocation();
  if (!user) return <Navigate to="/login" state={{ from: loc }} replace />;
  return (
    <>
      {children}
      <BottomNav />
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ToastHost />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<Protected><Home /></Protected>} />
        <Route path="/escalas" element={<Protected><Schedule /></Protected>} />
        <Route path="/repertorio" element={<Protected><Repertoire /></Protected>} />
        <Route path="/evento/:id" element={<Protected><EventDetail /></Protected>} />
        <Route path="/holyrics" element={<Protected><Holyrics /></Protected>} />
        <Route path="/perfil" element={<Protected><Profile /></Protected>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
