import { Navigate } from "react-router-dom";
import { useAuth } from "../store";

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const accessToken = useAuth((s) => s.accessToken);
  if (!accessToken) return <Navigate to="/login" replace />;
  return <>{children}</>;
}
