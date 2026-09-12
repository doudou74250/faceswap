import { useEffect } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "sonner";
import Layout from "@/components/Layout";
import Landing from "@/pages/Landing";
import Create from "@/pages/Create";
import Preview from "@/pages/Preview";
import Confirmation from "@/pages/Confirmation";
import Cancel from "@/pages/Cancel";
import AdminLogin from "@/pages/AdminLogin";
import AdminDashboard from "@/pages/AdminDashboard";
import Terms from "@/pages/Terms";
import Privacy from "@/pages/Privacy";
import Contact from "@/pages/Contact";
import "@/App.css";

function App() {
  useEffect(() => { document.title = "MorphCut — Face Swap Vidéo IA"; }, []);
  return (
    <div className="App">
      <Toaster position="top-right" richColors closeButton />
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<Landing />} />
            <Route path="/create" element={<Create />} />
            <Route path="/preview/:id" element={<Preview />} />
            <Route path="/confirmation/:id" element={<Confirmation />} />
            <Route path="/cancel" element={<Cancel />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/admin/login" element={<AdminLogin />} />
            <Route path="/admin" element={<AdminDashboard />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </div>
  );
}

export default App;
