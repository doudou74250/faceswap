import { useState } from "react";
import { toast } from "sonner";
import { Send } from "lucide-react";
import api from "@/lib/api";

export default function Contact() {
  const [form, setForm] = useState({ name: "", email: "", message: "" });
  const [sending, setSending] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.message) return toast.error("Tous les champs sont requis");
    setSending(true);
    try {
      await api.post("/contact", form);
      toast.success("Message envoyé — nous revenons vers vous rapidement.");
      setForm({ name: "", email: "", message: "" });
    } catch { toast.error("Erreur d'envoi"); }
    setSending(false);
  };
  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Contact</h1>
      <p className="mt-2 text-slate-600">Une question ? Un souci ? Une demande de suppression anticipée ? Écrivez-nous.</p>
      <form onSubmit={submit} className="mt-8 space-y-4">
        <input className="w-full h-11 px-4 rounded-xl border border-slate-200 bg-white text-sm" placeholder="Nom" value={form.name} onChange={(e)=>setForm({...form, name:e.target.value})} data-testid="contact-name" />
        <input type="email" className="w-full h-11 px-4 rounded-xl border border-slate-200 bg-white text-sm" placeholder="Email" value={form.email} onChange={(e)=>setForm({...form, email:e.target.value})} data-testid="contact-email" />
        <textarea rows={5} className="w-full p-4 rounded-xl border border-slate-200 bg-white text-sm" placeholder="Votre message" value={form.message} onChange={(e)=>setForm({...form, message:e.target.value})} data-testid="contact-message" />
        <button type="submit" disabled={sending} data-testid="contact-submit" className="inline-flex items-center gap-2 h-11 px-6 rounded-full bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 disabled:opacity-50">
          <Send size={14}/> Envoyer
        </button>
      </form>
    </div>
  );
}
