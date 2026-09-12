import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer } from "recharts";
import { Loader2, TrendingUp, Video, Eye, Coins, AlertTriangle, HardDrive, LogOut } from "lucide-react";
import api from "@/lib/api";

function StatCard({ icon: Icon, label, value, sub, testid }) {
  return (
    <div className="p-6 rounded-2xl bg-white border border-slate-100" data-testid={testid}>
      <div className="flex items-center justify-between">
        <div className="text-xs uppercase tracking-widest text-slate-500 font-semibold">{label}</div>
        <Icon size={16} className="text-slate-400" />
      </div>
      <div className="mt-3 text-3xl font-bold text-slate-900 tracking-tight">{value}</div>
      {sub && <div className="mt-1 text-xs text-slate-500">{sub}</div>}
    </div>
  );
}

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [me, setMe] = useState(null);
  const [stats, setStats] = useState(null);
  const [txs, setTxs] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [meR, statsR, txR, jobsR] = await Promise.all([
          api.get("/admin/me"),
          api.get("/admin/stats"),
          api.get("/admin/transactions"),
          api.get("/admin/jobs"),
        ]);
        setMe(meR.data);
        setStats(statsR.data);
        setTxs(txR.data.transactions);
        setJobs(jobsR.data.jobs);
      } catch (e) {
        navigate("/admin/login");
      } finally { setLoading(false); }
    })();
  }, [navigate]);

  const logout = async () => {
    try { await api.post("/admin/logout"); } catch {}
    localStorage.removeItem("admin_token");
    navigate("/admin/login");
  };

  if (loading) {
    return <div className="max-w-5xl mx-auto py-24 text-center text-slate-500 flex items-center justify-center gap-2"><Loader2 className="animate-spin" size={16}/> Chargement du dashboard...</div>;
  }
  if (!stats) return null;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs uppercase tracking-widest text-indigo-600 font-semibold">Dashboard</div>
          <h1 className="mt-2 text-3xl font-bold text-slate-900 tracking-tight">Administration</h1>
          {me && <p className="mt-1 text-sm text-slate-500">Connecté : {me.email}</p>}
        </div>
        <button onClick={logout} className="inline-flex items-center gap-2 h-10 px-4 rounded-full bg-white border border-slate-200 text-slate-700 text-sm hover:bg-slate-50">
          <LogOut size={14}/> Déconnexion
        </button>
      </div>

      {stats.provider_is_mock && (
        <div className="mt-6 p-4 rounded-2xl bg-amber-50 border border-amber-200 text-sm text-amber-900">
          <strong>MODE MOCK</strong> — Le fournisseur de face swap est un mock. Configurez <code className="font-mono">FACE_SWAP_API_KEY</code> et <code className="font-mono">FACE_SWAP_PROVIDER</code> pour brancher un fournisseur réel.
        </div>
      )}

      <div className="mt-8 grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Video} label="Générations" value={stats.total_generations} testid="admin-stats-total-generations" />
        <StatCard icon={Eye} label="Aperçus prêts" value={stats.previews_ready} testid="admin-stats-free-previews" />
        <StatCard icon={Coins} label="Vidéos payées" value={stats.paid_videos} testid="admin-stats-paid-videos" />
        <StatCard icon={TrendingUp} label="Chiffre d'affaires" value={`${stats.revenue_eur.toFixed(2)} €`} sub={`Conversion ${stats.conversion_rate}%`} testid="admin-stats-total-revenue" />
        <StatCard icon={AlertTriangle} label="Erreurs" value={stats.failed} />
        <StatCard icon={HardDrive} label="Fichiers actifs" value={stats.active_files} sub="TTL 24h" />
      </div>

      <div className="mt-10 p-6 rounded-3xl bg-white border border-slate-100">
        <h3 className="text-lg font-semibold text-slate-900">Chiffre d'affaires — 14 derniers jours</h3>
        <div className="h-64 mt-4">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={stats.revenue_series}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#64748B" }} />
              <YAxis tick={{ fontSize: 11, fill: "#64748B" }} />
              <Tooltip />
              <Line type="monotone" dataKey="revenue" stroke="#0F172A" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="mt-10 grid lg:grid-cols-2 gap-6">
        <div className="p-6 rounded-3xl bg-white border border-slate-100">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Transactions récentes</h3>
          <div className="overflow-x-auto" data-testid="admin-transactions-table">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase tracking-wide text-slate-500">
                <tr><th className="text-left py-2">Session</th><th className="text-left">Montant</th><th className="text-left">Statut</th></tr>
              </thead>
              <tbody>
                {txs.map((t) => (
                  <tr key={t.session_id} className="border-t border-slate-100">
                    <td className="py-2 font-mono text-xs">{t.session_id?.slice(0, 20)}...</td>
                    <td>{((t.amount || 0) / 100).toFixed(2)} {(t.currency || "").toUpperCase()}</td>
                    <td>
                      <span className={`text-xs px-2 py-1 rounded-full ${t.payment_status === 'paid' ? 'bg-emerald-50 text-emerald-700' : t.payment_status === 'failed' ? 'bg-red-50 text-red-700' : 'bg-slate-50 text-slate-600'}`}>
                        {t.payment_status}
                      </span>
                    </td>
                  </tr>
                ))}
                {txs.length === 0 && <tr><td colSpan={3} className="py-6 text-center text-slate-400">Aucune transaction</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        <div className="p-6 rounded-3xl bg-white border border-slate-100">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Jobs récents</h3>
          <table className="w-full text-sm">
            <thead className="text-xs uppercase tracking-wide text-slate-500">
              <tr><th className="text-left py-2">ID</th><th className="text-left">Statut</th><th className="text-left">Payé</th></tr>
            </thead>
            <tbody>
              {jobs.map((j) => (
                <tr key={j.id} className="border-t border-slate-100">
                  <td className="py-2 font-mono text-xs">{j.id.slice(0, 10)}</td>
                  <td>{j.status}</td>
                  <td>{j.payment_status}</td>
                </tr>
              ))}
              {jobs.length === 0 && <tr><td colSpan={3} className="py-6 text-center text-slate-400">Aucun job</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
