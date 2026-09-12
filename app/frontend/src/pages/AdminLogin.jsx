import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { toast } from "sonner";
import { Loader2, LogIn } from "lucide-react";
import api from "@/lib/api";

export default function AdminLogin() {
  const navigate = useNavigate();
  const location = useLocation();
  const [processing, setProcessing] = useState(false);

  // On mount, if URL has session_id in hash, exchange it
  useEffect(() => {
    const hash = window.location.hash || "";
    const m = hash.match(/session_id=([^&]+)/);
    if (m && m[1]) {
      const sid = m[1];
      window.history.replaceState({}, "", location.pathname);
      (async () => {
        setProcessing(true);
        try {
          const { data } = await api.post("/admin/session", { session_id: sid });
          localStorage.setItem("admin_token", data.token);
          toast.success(`Connecté : ${data.email}`);
          navigate("/admin");
        } catch (e) {
          toast.error(e?.response?.data?.detail || "Échec de la connexion");
          setProcessing(false);
        }
      })();
    }
  }, [location.pathname, navigate]);

  const login = () => {
    const redirect = `${window.location.origin}/admin/login`;
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirect)}`;
  };

  return (
    <div className="max-w-md mx-auto py-24 px-4">
      <div className="p-8 rounded-3xl bg-white border border-slate-100 text-center shadow-sm">
        <h1 className="text-2xl font-bold text-slate-900">Espace administrateur</h1>
        <p className="mt-2 text-slate-600 text-sm">Connectez-vous avec votre compte Google pour accéder au dashboard.</p>
        <button
          onClick={login}
          disabled={processing}
          data-testid="admin-google-login"
          className="mt-8 inline-flex items-center justify-center gap-2 h-12 w-full rounded-full bg-slate-900 text-white font-medium hover:bg-slate-800 disabled:opacity-50"
        >
          {processing ? <><Loader2 className="animate-spin" size={16}/> Connexion...</> : <><LogIn size={16}/> Se connecter avec Google</>}
        </button>
      </div>
    </div>
  );
}
