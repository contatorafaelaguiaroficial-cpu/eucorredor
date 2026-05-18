// eucorredor v3.4 — hub com análise automática + percurso no feed
import { useState, useEffect, useRef } from "react";
import { createClient } from "@supabase/supabase-js";
import { Capacitor } from "@capacitor/core";
import { Geolocation } from "@capacitor/geolocation";
import { PushNotifications } from "@capacitor/push-notifications";
import { CardPayment, initMercadoPago } from "@mercadopago/sdk-react";

const SUPABASE_URL = "https://atzbgyjenhfgrnwdstnl.supabase.co";
const SUPABASE_KEY = "sb_publishable_WB5ILhYe5FqHaPjHChWH1A_5fNq2_KI";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const ADMIN_ID = "7cdb56e9-0525-48ac-901f-1f5ac23fe009";

const MERCADOPAGO_PUBLIC_KEY = import.meta.env.VITE_MERCADOPAGO_PUBLIC_KEY;

if (MERCADOPAGO_PUBLIC_KEY) {
  initMercadoPago(MERCADOPAGO_PUBLIC_KEY, { locale: "pt-BR" });
}

const LEVELS = [
  { name: "Iniciante", min: 0, max: 4, color: "#6ee7b7", icon: "🌱" },
  { name: "Intermediário", min: 5, max: 14, color: "#60a5fa", icon: "🏃" },
  { name: "Avançado", min: 15, max: 29, color: "#f59e0b", icon: "⚡" },
  { name: "Semi-profissional", min: 30, max: 59, color: "#f97316", icon: "🔥" },
  { name: "Profissional", min: 60, max: Infinity, color: "#e11d48", icon: "🏅" },
];

function formatTime(s) {
  const h = Math.floor(s/3600), m = Math.floor((s%3600)/60), sec = s%60;
  if (h > 0) return `${h}:${String(m).padStart(2,"0")}:${String(sec).padStart(2,"0")}`;
  return `${String(m).padStart(2,"0")}:${String(sec).padStart(2,"0")}`;
}
function calcPace(km, secs) {
  if (!km || km === 0) return "--";
  const mPerKm = secs / 60 / km;
  const min = Math.floor(mPerKm);
  const sec = Math.round((mPerKm - min) * 60);
  return min + "'" + String(sec).padStart(2,"0") + "/km";
}

const getLevel = (n) => LEVELS.find((l) => n >= l.min && n <= l.max) || LEVELS[0];
const getNextLevel = (n) => LEVELS.find((l) => l.min > n);
const getLevelColor = (name) => LEVELS.find((l) => l.name === name)?.color || "#888";
const getLevelIcon = (name) => LEVELS.find((l) => l.name === name)?.icon || "🏃";

const events = [
  { id: 1, name: "Maratona de Porto Alegre", date: "15 Jun", dist: "42km", local: "Porto Alegre, RS", cat: "Maratona" },
  { id: 2, name: "Corrida das Pedras", date: "22 Jun", dist: "10km", local: "Gramado, RS", cat: "10K" },
  { id: 3, name: "Night Run Canoas", date: "30 Jun", dist: "5km", local: "Canoas, RS", cat: "5K" },
  { id: 4, name: "Trail da Serra Gaúcha", date: "7 Jul", dist: "21km", local: "Caxias do Sul, RS", cat: "Trail" },
];
// ─── AUTH ─────────────────────────────────────────────────────────────────────
function AuthScreen({ onLogin }) {
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ name: "", email: "", password: "", handle: "", newPassword: "" });
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  useEffect(() => {
    const hash = window.location.hash;
    if (hash.includes("type=recovery") || hash.includes("access_token")) {
      supabase.auth.onAuthStateChange((event, session) => {
        if (event === "PASSWORD_RECOVERY") setMode("reset");
      });
    }
  }, []);

  const handleGoogleLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}` },
    });
  };

  const handleForgot = async () => {
    setError(""); setSuccess("");
    if (!form.email.includes("@")) return setError("Informe um e-mail válido.");
    setLoading(true);
    const { error: err } = await supabase.auth.resetPasswordForEmail(form.email, {
      redirectTo: `${window.location.origin}/#recovery`
    });
    if (err) setError(err.message);
    else setSuccess("E-mail enviado! Verifique sua caixa de entrada.");
    setLoading(false);
  };

  const handleReset = async () => {
    setError(""); setSuccess("");
    if (form.newPassword.length < 6) return setError("A nova senha precisa ter no mínimo 6 caracteres.");
    setLoading(true);
    const { error: err } = await supabase.auth.updateUser({ password: form.newPassword });
    if (err) setError(err.message);
    else { setSuccess("Senha alterada com sucesso!"); setTimeout(() => setMode("login"), 2000); }
    setLoading(false);
  };

  const handleSubmit = async () => {
    setError("");
    if (mode === "register" && !form.name.trim()) return setError("Informe seu nome.");
    if (mode === "register" && !form.handle.trim()) return setError("Informe seu @handle.");
    const isHandle = !form.email.includes("@") || form.email.startsWith("@");
    if (!isHandle && !form.email.includes("@")) return setError("E-mail ou @handle inválido.");
    if (form.password.length < 6) return setError("Senha com no mínimo 6 caracteres.");
    setLoading(true);
    try {
      if (mode === "register") {
        if (!acceptedTerms) throw new Error("Você precisa aceitar os Termos de Uso e a Política de Privacidade.");
        if (!form.handle.trim()) throw new Error("Informe seu @handle.");
        if (form.handle.length < 3) throw new Error("O handle precisa ter no mínimo 3 caracteres.");
        const { data: existing } = await supabase.from("profiles").select("id").eq("handle", form.handle).single();
        if (existing) throw new Error("Esse @handle já está em uso. Tente outro.");
        const { data, error: err } = await supabase.auth.signUp({
          email: form.email, password: form.password,
          options: { data: { name: form.name } },
        });
        if (err) throw err;
        if (data.user) {
          await supabase.from("profiles").insert({ id: data.user.id, name: form.name, handle: form.handle, level: "Iniciante", races_count: 0, total_km: 0, terms_accepted_at: new Date().toISOString(), terms_version: "1.0" });
          onLogin(data.user, form.name);
        }
      } else {
        let emailToUse = form.email.trim();
        if (!emailToUse.includes("@") || emailToUse.startsWith("@")) {
          const handle = emailToUse.replace("@", "").toLowerCase();
          const { data: profileData } = await supabase.from("profiles").select("id").eq("handle", handle).single();
          if (!profileData) throw new Error("Usuário @" + handle + " não encontrado.");
          const { data: authData } = await supabase.rpc("get_email_by_handle", { p_handle: handle });
          if (!authData) throw new Error("Não foi possível autenticar com esse @handle. Use seu e-mail.");
          emailToUse = authData;
        }
        const { data, error: err } = await supabase.auth.signInWithPassword({ email: emailToUse, password: form.password });
        if (err) throw err;
        const { data: profile } = await supabase.from("profiles").select("*").eq("id", data.user.id).single();
        onLogin(data.user, profile?.name || emailToUse.split("@")[0]);
      }
    } catch (err) {
      setError(err.message || "Erro ao autenticar.");
    }
    setLoading(false);
  };

  return (
    <div style={{ background: "#0a0a0f", minHeight: "100vh", display: "flex", justifyContent: "center", alignItems: "center", fontFamily: "'DM Sans', sans-serif", color: "#f0f0f0" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&family=Space+Grotesk:wght@700;800&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #0a0a0f; margin: 0; }
        .ai { width: 100%; background: #13131a; border: 1.5px solid #1e1e2e; border-radius: 12px; padding: 14px 16px; color: #f0f0f0; font-size: 14px; font-family: inherit; outline: none; }
        .ai:focus { border-color: #e11d48; }
        .ai::placeholder { color: #444; }
        .ab { width: 100%; background: #e11d48; color: #fff; border: none; border-radius: 12px; padding: 15px; font-size: 15px; font-weight: 700; cursor: pointer; font-family: inherit; }
        .ab:disabled { background: #3a1a22; color: #666; cursor: not-allowed; }
      `}</style>
      <div style={{ width: "100%", maxWidth: 390, padding: "40px 28px" }}>
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🏃</div>
          <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 32, fontWeight: 800 }}>eu<span style={{ color: "#e11d48" }}>corredor</span></h1>
          <p style={{ color: "#555", fontSize: 13, marginTop: 8 }}>
            {mode === "forgot" ? "Recuperação de senha" : mode === "reset" ? "Nova senha" : "A comunidade dos corredores"}
          </p>
        </div>
        <div style={{ background: "#13131a", borderRadius: 12, padding: 4, marginBottom: 28, display: mode === "forgot" || mode === "reset" ? "none" : "flex" }}>
          {["login", "register"].map((m) => (
            <button key={m} onClick={() => { setMode(m); setError(""); }}
              style={{ flex: 1, background: mode === m ? "#1e1e2e" : "none", border: "none", borderRadius: 9, padding: "9px 0", color: mode === m ? "#fff" : "#555", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
              {m === "login" ? "Entrar" : "Criar conta"}
            </button>
          ))}
        </div>
        <div style={{ display: mode === "forgot" || mode === "reset" ? "none" : "flex", flexDirection: "column", gap: 12 }}>
          {mode === "register" && <input className="ai" placeholder="Seu nome" value={form.name} onChange={set("name")} />}
          {mode === "register" && (
            <div style={{ position: "relative" }}>
              <span style={{ position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)", color: "#555", fontSize: 14 }}>@</span>
              <input className="ai" style={{ paddingLeft: 28 }} placeholder="seuhandle" value={form.handle}
                onChange={(e) => setForm(f => ({ ...f, handle: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "") }))} />
            </div>
          )}
          {mode === "register" && form.handle.length > 0 && (
            <p style={{ fontSize: 11, color: "#555", marginTop: -6 }}>Somente letras minúsculas, números e _</p>
          )}
          <input className="ai" placeholder="E-mail ou @handle" value={form.email} onChange={set("email")} />
          <input className="ai" placeholder="Senha" type="password" value={form.password} onChange={set("password")} />
        </div>
        {error && (mode === "login" || mode === "register") && <p style={{ color: "#e11d48", fontSize: 12, marginTop: 10 }}>{error}</p>}
        {mode === "forgot" && (
          <>
            <p style={{ fontSize: 14, color: "#888", marginBottom: 16, lineHeight: 1.5 }}>Digite seu e-mail e enviaremos um link para redefinir sua senha.</p>
            <input className="ai" placeholder="Seu e-mail" type="email" value={form.email} onChange={set("email")} />
            {error && <p style={{ color: "#e11d48", fontSize: 12, marginTop: 10 }}>{error}</p>}
            {success && <p style={{ color: "#6ee7b7", fontSize: 12, marginTop: 10 }}>{success}</p>}
            <button className="ab" style={{ marginTop: 16 }} onClick={handleForgot} disabled={loading}>{loading ? "Enviando..." : "Enviar link de recuperação"}</button>
            <button onClick={() => { setMode("login"); setError(""); setSuccess(""); }} style={{ width: "100%", background: "none", border: "none", color: "#555", fontSize: 13, marginTop: 16, cursor: "pointer", fontFamily: "inherit" }}>Voltar para o login</button>
          </>
        )}
        {mode === "reset" && (
          <>
            <p style={{ fontSize: 14, color: "#888", marginBottom: 16 }}>Digite sua nova senha.</p>
            <input className="ai" placeholder="Nova senha" type="password" value={form.newPassword} onChange={set("newPassword")} />
            {error && <p style={{ color: "#e11d48", fontSize: 12, marginTop: 10 }}>{error}</p>}
            {success && <p style={{ color: "#6ee7b7", fontSize: 12, marginTop: 10 }}>{success}</p>}
            <button className="ab" style={{ marginTop: 16 }} onClick={handleReset} disabled={loading}>{loading ? "Salvando..." : "Salvar nova senha"}</button>
          </>
        )}
        {(mode === "login" || mode === "register") && (
          <>
            {mode === "register" && (
              <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginTop: 16 }}>
                <div onClick={() => setAcceptedTerms(t => !t)}
                  style={{ width: 20, height: 20, borderRadius: 5, border: `2px solid ${acceptedTerms ? "#e11d48" : "#1e1e2e"}`, background: acceptedTerms ? "#e11d48" : "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0, marginTop: 1 }}>
                  {acceptedTerms && <span style={{ color: "#fff", fontSize: 12, fontWeight: 700 }}>✓</span>}
                </div>
                <p style={{ fontSize: 12, color: "#888", lineHeight: 1.5 }}>
                  Li e aceito os <a href="/termos" target="_blank" style={{ color: "#e11d48", textDecoration: "none" }}>Termos de uso</a> e a <a href="/privacidade" target="_blank" style={{ color: "#e11d48", textDecoration: "none" }}>Política de privacidade</a>
                </p>
              </div>
            )}
            <button className="ab" style={{ marginTop: 16 }} onClick={handleSubmit} disabled={loading}>{loading ? "Aguarde..." : mode === "login" ? "Entrar" : "Criar conta"}</button>
            <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "16px 0" }}>
              <div style={{ flex: 1, height: 1, background: "#1e1e2e" }} />
              <span style={{ fontSize: 12, color: "#555" }}>ou</span>
              <div style={{ flex: 1, height: 1, background: "#1e1e2e" }} />
            </div>
            <button onClick={handleGoogleLogin} style={{ width: "100%", background: "#fff", color: "#1a1a1a", border: "none", borderRadius: 12, padding: "13px 0", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
              <svg width="18" height="18" viewBox="0 0 48 48">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                <path fill="none" d="M0 0h48v48H0z"/>
              </svg>
              Continuar com Google
            </button>
            {mode === "login" && (
              <div style={{ textAlign: "center", marginTop: 12 }}>
                <button onClick={() => { setMode("forgot"); setError(""); setSuccess(""); }} style={{ background: "none", border: "none", color: "#555", fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>Esqueci minha senha</button>
              </div>
            )}
            <p style={{ textAlign: "center", fontSize: 13, color: "#555", marginTop: 16 }}>
              {mode === "login" ? "Ainda não tem conta? " : "Já tem conta? "}
              <button onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); }} style={{ background: "none", border: "none", color: "#e11d48", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                {mode === "login" ? "Criar agora" : "Entrar"}
              </button>
            </p>
          </>
        )}
      </div>
    </div>
  );
}

// ─── EMPTY STATE ────────────────────────────────────────────────────────────────
function EmptyState({ icon = "✨", title, description, actionLabel, onAction, compact = false }) {
  return (
    <div style={{
      textAlign: "center",
      padding: compact ? "18px 14px" : "34px 20px",
      background: compact ? "rgba(255,255,255,0.03)" : "linear-gradient(180deg, rgba(255,255,255,0.055), rgba(255,255,255,0.022))",
      border: "1px solid rgba(255,255,255,0.10)",
      borderRadius: compact ? 16 : 22,
      boxShadow: compact ? "none" : "inset 0 1px 0 rgba(255,255,255,0.05)",
      width: "100%"
    }}>
      <div style={{
        width: compact ? 42 : 58,
        height: compact ? 42 : 58,
        borderRadius: compact ? 14 : 18,
        margin: "0 auto 12px",
        background: "rgba(225,29,72,0.12)",
        border: "1px solid rgba(225,29,72,0.24)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: compact ? 20 : 27
      }}>{icon}</div>
      <p style={{ fontSize: compact ? 13 : 15, fontWeight: 900, color: "#f5f5f7", marginBottom: description ? 6 : 0 }}>{title}</p>
      {description && <p style={{ color: "#777", fontSize: compact ? 12 : 13, lineHeight: 1.5, maxWidth: 280, margin: "0 auto" }}>{description}</p>}
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          style={{
            marginTop: 14,
            background: "linear-gradient(135deg, #e11d48, #ff3d63)",
            color: "#fff",
            border: "none",
            borderRadius: 999,
            padding: compact ? "9px 14px" : "11px 16px",
            fontSize: compact ? 12 : 13,
            fontWeight: 900,
            cursor: "pointer",
            fontFamily: "inherit",
            boxShadow: "0 12px 28px rgba(225,29,72,0.24)"
          }}
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}

// ─── APP MAIN ─────────────────────────────────────────────────────────────────
function AppMain({ user, userName }) {
  const [tab, setTab] = useState("eventos");
  const [commFeed, setCommFeed] = useState("todos");
  const [profileTab, setProfileTab] = useState("fotos");
  const [profile, setProfile] = useState(null);
  const [posts, setPosts] = useState([]);
  const [activities, setActivities] = useState([]);
  const [liked, setLiked] = useState({});
  const [following, setFollowing] = useState({});
  const [newPost, setNewPost] = useState("");
  const [showPublish, setShowPublish] = useState(false);
  const [publishType, setPublishType] = useState(null);
  const [actForm, setActForm] = useState({ distance: "", duration: "", pace: "" });
  const [showActivityForm, setShowActivityForm] = useState(false);
  const [hubScreen, setHubScreen] = useState("hub");
  const [gpsElapsed, setGpsElapsed] = useState(0);
  const [gpsDistance, setGpsDistance] = useState(0);
  const [gpsRoute, setGpsRoute] = useState([]);
  const [gpsPaused, setGpsPaused] = useState(false);
  const [gpsHR, setGpsHR] = useState(142);
  const [gpsLocated, setGpsLocated] = useState(false);
  const [gpsError, setGpsError] = useState("");
  const [showGpsPermissionModal, setShowGpsPermissionModal] = useState(false);
  const [checkingGpsPermission, setCheckingGpsPermission] = useState(false);
  const [gpsLocked, setGpsLocked] = useState(false);
  const [runSummary, setRunSummary] = useState(null);
  const [completedRunRoute, setCompletedRunRoute] = useState([]);
  const [summaryPostText, setSummaryPostText] = useState("");
  const [publishingRunSummary, setPublishingRunSummary] = useState(false);
  const [rankingMode, setRankingMode] = useState("km");
  const [rankingPeriod, setRankingPeriod] = useState("semanal");
  const [rankingRecentActivities, setRankingRecentActivities] = useState([]);
  const [monthGoal, setMonthGoal] = useState(() => {
    const saved = Number(window.localStorage?.getItem("eucorredor_month_goal"));
    return Number.isFinite(saved) && saved > 0 ? saved : 30;
  });
  const [goalDraft, setGoalDraft] = useState(String(monthGoal));
  const [showGoalEditor, setShowGoalEditor] = useState(false);
  const gpsIntervalRef = useRef(null);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [settingsView, setSettingsView] = useState("menu");
  const [deleteConfirmationText, setDeleteConfirmationText] = useState("");
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [deleteAccountError, setDeleteAccountError] = useState("");
  const [editForm, setEditForm] = useState({ name: "", bio: "" });
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [loadingPost, setLoadingPost] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showProductOnboarding, setShowProductOnboarding] = useState(false);
  const [productOnboardingStep, setProductOnboardingStep] = useState(0);
  const [onboardingForm, setOnboardingForm] = useState({ name: "", handle: "", terms: false });
  const [dbEvents, setDbEvents] = useState([]);
  const [showAdminEvents, setShowAdminEvents] = useState(false);
  const [adminEventsView, setAdminEventsView] = useState("agenda");
  const [eventFilter, setEventFilter] = useState("Todos");
  const [eventForm, setEventForm] = useState({ name: "", date: "", city: "", state: "RS", distance: "", category: "5K", link: "", featured: false });
  const [nativeRaceStep, setNativeRaceStep] = useState("basic");
  const [nativeRaceForm, setNativeRaceForm] = useState({
    name: "",
    slug: "",
    eventDate: "",
    city: "",
    state: "RS",
    organizerName: "",
    salesStatus: "open",
    featured: false,
    kitDescription: "",
    kitItemsText: "",
    hasTshirt: true,
    tshirtSizesText: "PP, P, M, G, GG",
    requiresEmergencyContact: true
  });
  const [nativeKitImageFile, setNativeKitImageFile] = useState(null);
  const [nativeKitImagePreview, setNativeKitImagePreview] = useState(null);
  const [nativeRaceModalities, setNativeRaceModalities] = useState([]);
  const [savingNativeRace, setSavingNativeRace] = useState(false);
  const [lastSavedNativeOrganizer, setLastSavedNativeOrganizer] = useState(null);
  const [nativeModalityDraft, setNativeModalityDraft] = useState({
    name: "",
    lotName: "1º lote",
    price: "",
    totalSlots: ""
  });
  const [savingEvent, setSavingEvent] = useState(false);
  const [selectedRaceEvent, setSelectedRaceEvent] = useState(null);
  const [raceEventDetails, setRaceEventDetails] = useState(null);
  const [loadingRaceDetails, setLoadingRaceDetails] = useState(false);
  const [selectedRaceModalityId, setSelectedRaceModalityId] = useState(null);
  const [raceCheckoutStep, setRaceCheckoutStep] = useState("details");
  const [creatingRaceRegistration, setCreatingRaceRegistration] = useState(false);
  const [pendingRaceRegistration, setPendingRaceRegistration] = useState(null);
  const [creatingPixPayment, setCreatingPixPayment] = useState(false);
  const [pixPaymentData, setPixPaymentData] = useState(null);
  const [pixPaymentError, setPixPaymentError] = useState("");
  const [selectedCheckoutPaymentMethod, setSelectedCheckoutPaymentMethod] = useState("pix");
  const [creatingCardPayment, setCreatingCardPayment] = useState(false);
  const [cardPaymentData, setCardPaymentData] = useState(null);
  const [cardPaymentError, setCardPaymentError] = useState("");
  const [myRaceRegistrations, setMyRaceRegistrations] = useState([]);
  const [loadingMyRaceRegistrations, setLoadingMyRaceRegistrations] = useState(true);
  const [myRaceFilter, setMyRaceFilter] = useState("Todas");
  const [raceParticipantForm, setRaceParticipantForm] = useState({
    name: "",
    cpf: "",
    birthDate: "",
    phone: "",
    email: user?.email || "",
    tshirtSize: "",
    emergencyContactName: "",
    emergencyContactPhone: "",
  });
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [showFollowModal, setShowFollowModal] = useState(null);
  const [viewingProfile, setViewingProfile] = useState(null);
  const [viewPosts, setViewPosts] = useState([]);
  const [viewActivities, setViewActivities] = useState([]);
  const [viewTab, setViewTab] = useState("fotos");
  const [followList, setFollowList] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [realFollowing, setRealFollowing] = useState({});
  const [showSearch, setShowSearch] = useState(false);
  const [openComments, setOpenComments] = useState(null);
  const [comments, setComments] = useState({});
  const [newComment, setNewComment] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [selectedPhotoPost, setSelectedPhotoPost] = useState(null);
  const [seenStories, setSeenStories] = useState({});
  const [activeStory, setActiveStory] = useState(null);
  const [storyProgress, setStoryProgress] = useState(0);
  const storyTimerRef = useRef(null);
  // Stories reais
  const [stories, setStories] = useState([]);
  const [showStoryUpload, setShowStoryUpload] = useState(false);
  const [storyFile, setStoryFile] = useState(null);
  const [storyPreview, setStoryPreview] = useState(null);
  const [uploadingStory, setUploadingStory] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [loadingSections, setLoadingSections] = useState({
    profile: true,
    posts: true,
    activities: true,
    events: true,
    notifications: true,
    stories: true,
    suggestions: true,
    ranking: true,
    myClubs: true,
    allClubs: true,
    clubDetails: false,
  });
  const [commentsLoading, setCommentsLoading] = useState({});
  const [rankingUsers, setRankingUsers] = useState([]);
  const [myClubs, setMyClubs] = useState([]);
  const [allClubs, setAllClubs] = useState([]);
  const [clubMembership, setClubMembership] = useState({});
  const [activeClub, setActiveClub] = useState(null);
  const [clubPosts, setClubPosts] = useState([]);
  const [clubMembers, setClubMembers] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [showCreateClub, setShowCreateClub] = useState(false);
  const [clubForm, setClubForm] = useState({ name: "", description: "" });
  const [clubAvatarFile, setClubAvatarFile] = useState(null);
  const [clubAvatarPreview, setClubAvatarPreview] = useState(null);
  const [newClubPost, setNewClubPost] = useState("");
  const [clubNotices, setClubNotices] = useState([]);
  const [activeClubTab, setActiveClubTab] = useState("posts");
  const [showCreateClubNotice, setShowCreateClubNotice] = useState(false);
  const [savingClubNotice, setSavingClubNotice] = useState(false);
  const [clubNoticeForm, setClubNoticeForm] = useState({
    title: "",
    body: "",
    location: "",
    time: "",
    distance: "",
    is_pinned: true,
  });
  const [onlineUserIds, setOnlineUserIds] = useState({});
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshMessage, setRefreshMessage] = useState("");
  const [blockedUserIds, setBlockedUserIds] = useState({});
  const [moderationMenu, setModerationMenu] = useState(null);
  const [reportTarget, setReportTarget] = useState(null);
  const [reportReason, setReportReason] = useState("Spam");
  const [reportDetails, setReportDetails] = useState("");
  const [blockTarget, setBlockTarget] = useState(null);
  const [moderationToast, setModerationToast] = useState("");
  const moderationToastTimerRef = useRef(null);
  const pullStartYRef = useRef(null);
  const pullDistanceRef = useRef(0);
  const refreshNoticeTimerRef = useRef(null);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let registrationListener;
    let registrationErrorListener;
    let receivedListener;
    let actionListener;

    const setupPushNotifications = async () => {
      try {
        registrationListener = await PushNotifications.addListener("registration", (token) => {
          console.info("Token de push recebido:", token.value);
          window.localStorage?.setItem("eucorredor_push_token", token.value);
        });

        registrationErrorListener = await PushNotifications.addListener("registrationError", (error) => {
          console.error("Erro ao registrar push:", error?.error || error);
        });

        receivedListener = await PushNotifications.addListener("pushNotificationReceived", (notification) => {
          console.log("Push recebido com o app aberto:", notification);
        });

        actionListener = await PushNotifications.addListener("pushNotificationActionPerformed", (notification) => {
          console.log("Usuário tocou na notificação:", notification);
        });

        let permission = await PushNotifications.checkPermissions();

        if (permission.receive === "prompt") {
          permission = await PushNotifications.requestPermissions();
        }

        if (permission.receive !== "granted") {
          console.warn("Permissão de push não concedida.");
          return;
        }

        await PushNotifications.register();
        console.log("Registro de push solicitado ao iOS.");
      } catch (error) {
        console.error("Falha ao configurar push notifications:", error);
      }
    };

    setupPushNotifications();

    return () => {
      registrationListener?.remove();
      registrationErrorListener?.remove();
      receivedListener?.remove();
      actionListener?.remove();
    };
  }, []);

  useEffect(() => {
    if (activeStory) {
      setStoryProgress(0);
      storyTimerRef.current = setInterval(() => {
        setStoryProgress(p => {
          if (p >= 100) { clearInterval(storyTimerRef.current); setActiveStory(null); return 0; }
          return p + 2;
        });
      }, 60);
    } else {
      clearInterval(storyTimerRef.current);
      setStoryProgress(0);
    }
    return () => clearInterval(storyTimerRef.current);
  }, [activeStory]);

  useEffect(() => { loadProfile(); loadPosts(); loadActivities(); loadFollowCounts(); loadNotifications(); loadRealFollowingList(); loadBlockedUsers(); loadEvents(); loadMyRaceRegistrations(); loadStories(); loadSuggestions(); loadRankingUsers(); loadMyClubs(); loadAllClubs(); loadClubMembership(); }, []);

  useEffect(() => {
    if (!user?.id) return;

    const presenceChannel = supabase.channel("eucorredor-online-users", {
      config: { presence: { key: user.id } },
    });

    const syncPresenceState = () => {
      const presenceState = presenceChannel.presenceState() || {};
      const onlineMap = {};

      Object.entries(presenceState).forEach(([presenceKey, presences]) => {
        if (Array.isArray(presences) && presences.length > 0) onlineMap[presenceKey] = true;
        (presences || []).forEach((presence) => {
          if (presence?.user_id) onlineMap[presence.user_id] = true;
        });
      });

      setOnlineUserIds(onlineMap);
    };

    presenceChannel
      .on("presence", { event: "sync" }, syncPresenceState)
      .on("presence", { event: "join" }, syncPresenceState)
      .on("presence", { event: "leave" }, syncPresenceState)
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await presenceChannel.track({
            user_id: user.id,
            online_at: new Date().toISOString(),
          });
        }
      });

    return () => {
      presenceChannel.untrack();
      supabase.removeChannel(presenceChannel);
    };
  }, [user?.id]);

  useEffect(() => {
    const liveChannel = supabase
      .channel(`eucorredor-live-${user.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "posts" }, () => loadPosts())
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "posts" }, () => loadPosts())
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "posts" }, () => loadPosts())
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "comments" }, (payload) => {
        if (openComments && payload.new?.post_id === openComments) loadComments(openComments);
        loadNotifications();
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` }, () => loadNotifications())
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` }, () => loadNotifications())
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "activities" }, () => { loadActivities(); loadRankingUsers(); })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "profiles" }, (payload) => {
        loadRankingUsers();
        if (payload.new?.id === user.id) loadProfile();
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "events" }, () => loadEvents())
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "events" }, () => loadEvents())
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "events" }, () => loadEvents())
      .subscribe();

    return () => {
      supabase.removeChannel(liveChannel);
    };
  }, [user.id, openComments]);

  const loadStories = async () => {
    const { data } = await supabase.from("stories")
      .select("*, profiles(id, name, avatar_url, level, handle)")
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false });
    setStories(data || []);
    setLoadingSections((prev) => ({ ...prev, stories: false }));
  };

  const loadSuggestions = async () => {
    const { data: followingData } = await supabase.from("follows").select("following_id").eq("follower_id", user.id);
    const followingIds = (followingData || []).map(f => f.following_id);
    followingIds.push(user.id);
    const { data } = await supabase.from("profiles")
      .select("id, name, handle, level, avatar_url, races_count")
      .not("id", "in", `(${followingIds.join(",")})`)
      .order("races_count", { ascending: false })
      .limit(8);
    setSuggestions(data || []);
    setLoadingSections((prev) => ({ ...prev, suggestions: false }));
  };

  const loadRankingUsers = async () => {
    const monthAgo = new Date();
    monthAgo.setDate(monthAgo.getDate() - 29);
    monthAgo.setHours(0, 0, 0, 0);

    const [{ data: profilesData }, { data: recentActivitiesData }] = await Promise.all([
      supabase.from("profiles")
        .select("id, name, handle, level, avatar_url, races_count, total_km")
        .order("total_km", { ascending: false })
        .limit(500),
      supabase.from("activities")
        .select("user_id, distance, created_at, profiles(id, name, handle, level, avatar_url, races_count, total_km)")
        .gte("created_at", monthAgo.toISOString())
        .order("created_at", { ascending: false })
        .limit(2000),
    ]);

    setRankingUsers(profilesData || []);
    setRankingRecentActivities(recentActivitiesData || []);
    setLoadingSections((prev) => ({ ...prev, ranking: false }));
  };

  const enrichClubCard = async (club) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      { count: memberCount },
      { data: latestNotices },
      { count: postsToday },
    ] = await Promise.all([
      supabase.from("club_members").select("*", { count: "exact", head: true }).eq("club_id", club.id).eq("status", "approved"),
      supabase.from("club_notices").select("*").eq("club_id", club.id).order("is_pinned", { ascending: false }).order("created_at", { ascending: false }).limit(1),
      supabase.from("club_posts").select("*", { count: "exact", head: true }).eq("club_id", club.id).gte("created_at", today.toISOString()),
    ]);

    return {
      ...club,
      member_count: memberCount || 0,
      latest_notice: latestNotices?.[0] || null,
      posts_today: postsToday || 0,
    };
  };

  const loadMyClubs = async () => {
    const { data } = await supabase
      .from("club_members")
      .select("*, clubs(id, name, description, avatar_url, owner_id)")
      .eq("user_id", user.id)
      .eq("status", "approved");

    const clubs = (data || []).map((m) => m.clubs).filter(Boolean);
    const enriched = await Promise.all(clubs.map(enrichClubCard));
    setMyClubs(enriched);
    setLoadingSections((prev) => ({ ...prev, myClubs: false }));
  };

  const loadAllClubs = async () => {
    const { data } = await supabase.from("clubs").select("*").order("created_at", { ascending: false });
    const clubs = data || [];
    const enriched = await Promise.all(clubs.map(enrichClubCard));
    setAllClubs(enriched);
    setLoadingSections((prev) => ({ ...prev, allClubs: false }));
  };

  const loadClubMembership = async () => {
    const { data } = await supabase.from("club_members").select("club_id, status").eq("user_id", user.id);
    const map = {};
    (data || []).forEach(m => { map[m.club_id] = m.status; });
    setClubMembership(map);
  };
  const handleCreateClub = async () => {
    if (!clubForm.name.trim()) return alert("Informe o nome do clube.");
    let avatar_url = null;
    if (clubAvatarFile) {
      const ext = clubAvatarFile.name.split(".").pop();
      const path = `${user.id}/club_${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("posts").upload(path, clubAvatarFile);
      if (!upErr) {
        const { data: urlData } = supabase.storage.from("posts").getPublicUrl(path);
        avatar_url = urlData.publicUrl;
      } else {
        console.error("Club avatar upload error:", upErr.message);
      }
    }
    const { data, error } = await supabase.from("clubs").insert({ name: clubForm.name, description: clubForm.description, owner_id: user.id, avatar_url }).select().single();
    if (error) { alert("Erro: " + error.message); return; }
    await supabase.from("club_members").insert({ club_id: data.id, user_id: user.id, role: "owner", status: "approved" });
    setClubForm({ name: "", description: "" });
    setClubAvatarFile(null);
    setClubAvatarPreview(null);
    setShowCreateClub(false);
    await loadMyClubs(); await loadAllClubs(); await loadClubMembership();
  };
  const handleRequestJoin = async (clubId) => {
    await supabase.from("club_members").insert({ club_id: clubId, user_id: user.id, status: "pending" });
    setClubMembership(m => ({ ...m, [clubId]: "pending" }));
  };
  const handleCancelRequest = async (clubId) => {
    await supabase.from("club_members").delete().eq("club_id", clubId).eq("user_id", user.id);
    setClubMembership(m => ({ ...m, [clubId]: null }));
  };
  const handleLeaveClub = async (clubId) => {
    if (!window.confirm("Sair do clube?")) return;
    await supabase.from("club_members").delete().eq("club_id", clubId).eq("user_id", user.id);
    setClubMembership(m => ({ ...m, [clubId]: null }));
    await loadMyClubs(); setActiveClub(null);
  };
  const openClub = async (club, preferredTab = "posts") => {
    setLoadingSections((prev) => ({ ...prev, clubDetails: true }));
    setActiveClub(club);
    setActiveClubTab(preferredTab);

    const [
      { data: postsData },
      { data: membersData },
      { data: noticesData },
    ] = await Promise.all([
      supabase.from("club_posts").select("*, profiles(id, name, avatar_url, level, handle)").eq("club_id", club.id).order("created_at", { ascending: false }),
      supabase.from("club_members").select("*, profiles(id, name, avatar_url, level, handle)").eq("club_id", club.id).eq("status", "approved"),
      supabase.from("club_notices").select("*").eq("club_id", club.id).order("is_pinned", { ascending: false }).order("created_at", { ascending: false }),
    ]);

    setClubPosts(postsData || []);
    setClubMembers(membersData || []);
    setClubNotices(noticesData || []);

    if (club.owner_id === user.id) {
      const { data: pendingData } = await supabase
        .from("club_members")
        .select("*, profiles(id, name, avatar_url, level, handle)")
        .eq("club_id", club.id)
        .eq("status", "pending");
      setPendingRequests(pendingData || []);
    } else {
      setPendingRequests([]);
    }
    setLoadingSections((prev) => ({ ...prev, clubDetails: false }));
  };

  const handleApproveMember = async (memberId) => {
    await supabase.from("club_members").update({ status: "approved" }).eq("id", memberId);
    await openClub(activeClub);
  };
  const handleRejectMember = async (memberId) => {
    await supabase.from("club_members").delete().eq("id", memberId);
    await openClub(activeClub);
  };
  const handleClubPost = async () => {
    if (!newClubPost.trim() || !activeClub) return;
    await supabase.from("club_posts").insert({ club_id: activeClub.id, user_id: user.id, text: newClubPost });
    setNewClubPost("");
    await openClub(activeClub, "posts");
    await loadMyClubs();
  };

  const resetClubNoticeForm = () => {
    setClubNoticeForm({
      title: "",
      body: "",
      location: "",
      time: "",
      distance: "",
      is_pinned: true,
    });
  };

  const handleCreateClubNotice = async () => {
    if (!activeClub || activeClub.owner_id !== user.id) return;
    if (!clubNoticeForm.title.trim()) return alert("Informe o título do aviso.");

    setSavingClubNotice(true);
    try {
      if (clubNoticeForm.is_pinned) {
        await supabase.from("club_notices").update({ is_pinned: false }).eq("club_id", activeClub.id);
      }

      const { error } = await supabase.from("club_notices").insert({
        club_id: activeClub.id,
        author_id: user.id,
        title: clubNoticeForm.title.trim(),
        body: clubNoticeForm.body.trim() || null,
        location: clubNoticeForm.location.trim() || null,
        notice_time: clubNoticeForm.time.trim() || null,
        distance: clubNoticeForm.distance.trim() || null,
        is_pinned: clubNoticeForm.is_pinned,
      });

      if (error) throw error;

      setShowCreateClubNotice(false);
      resetClubNoticeForm();
      await openClub(activeClub, "avisos");
      await loadMyClubs();
    } catch (err) {
      alert("Erro ao criar aviso: " + (err.message || "tente novamente."));
    } finally {
      setSavingClubNotice(false);
    }
  };

  const handlePinClubNotice = async (noticeId) => {
    if (!activeClub || activeClub.owner_id !== user.id) return;
    await supabase.from("club_notices").update({ is_pinned: false }).eq("club_id", activeClub.id);
    await supabase.from("club_notices").update({ is_pinned: true }).eq("id", noticeId);
    await openClub(activeClub, "avisos");
    await loadMyClubs();
  };

  const handleDeleteClubNotice = async (noticeId) => {
    if (!activeClub || activeClub.owner_id !== user.id) return;
    if (!window.confirm("Excluir este aviso?")) return;
    await supabase.from("club_notices").delete().eq("id", noticeId);
    await openClub(activeClub, "avisos");
    await loadMyClubs();
  };

  const handlePostStory = async () => {
    if (!storyFile) return;
    setUploadingStory(true);
    const ext = storyFile.name.split(".").pop();
    const path = `${user.id}/story_${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("posts").upload(path, storyFile);
    if (error) { alert("Erro ao enviar story: " + error.message); setUploadingStory(false); return; }
    const { data } = supabase.storage.from("posts").getPublicUrl(path);
    await supabase.from("stories").insert({ user_id: user.id, media_url: data.publicUrl });
    await loadStories();
    setShowStoryUpload(false);
    setStoryFile(null);
    setStoryPreview(null);
    setUploadingStory(false);
  };

  const loadNotifications = async () => {
    const { data } = await supabase.from("notifications")
      .select("*, from_user:profiles!notifications_from_user_id_fkey(name, avatar_url, handle)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(30);
    setNotifications(data || []);
    setLoadingSections((prev) => ({ ...prev, notifications: false }));
  };

  const markAllRead = async () => {
    await supabase.from("notifications").update({ read: true }).eq("user_id", user.id).eq("read", false);
    await loadNotifications();
  };

  const handleNotificationClick = async (notification) => {
    if (!notification) return;
    setShowNotifications(false);

    if ((notification.type === "comment" || notification.type === "like") && notification.post_id) {
      let targetPost = posts.find((post) => post.id === notification.post_id);
      if (!targetPost) {
        const { data } = await supabase.from("posts").select("*").eq("id", notification.post_id).single();
        targetPost = data || null;
      }

      if (targetPost) {
        setSelectedPhotoPost(targetPost);
        if (notification.type === "comment") {
          setOpenComments(targetPost.id);
          await loadComments(targetPost.id);
        } else {
          setOpenComments(null);
          setNewComment("");
        }
        return;
      }

      alert("Essa publicação não está mais disponível.");
      return;
    }

    if (notification.type === "follow" && notification.from_user_id) {
      await openProfile(notification.from_user_id);
    }
  };

  const handleFollow = async (targetId) => {
    const isFollowing = realFollowing[targetId];
    if (isFollowing) {
      await supabase.from("follows").delete().eq("follower_id", user.id).eq("following_id", targetId);
      setRealFollowing(f => ({ ...f, [targetId]: false }));
    } else {
      await supabase.from("follows").insert({ follower_id: user.id, following_id: targetId });
      await supabase.from("notifications").insert({ user_id: targetId, from_user_id: user.id, type: "follow" });
      setRealFollowing(f => ({ ...f, [targetId]: true }));
    }
    await loadFollowCounts();
    await loadNotifications();
    await loadSuggestions();
  };

  const handleLikePost = async (postId, postOwnerId) => {
    const isLiked = liked[postId];
    setLiked(l => ({ ...l, [postId]: !isLiked }));
    if (!isLiked) {
      await supabase.from("posts").update({ likes: (posts.find(p => p.id === postId)?.likes || 0) + 1 }).eq("id", postId);
      if (postOwnerId !== user.id) {
        await supabase.from("notifications").insert({ user_id: postOwnerId, from_user_id: user.id, type: "like", post_id: postId });
      }
    } else {
      await supabase.from("posts").update({ likes: Math.max((posts.find(p => p.id === postId)?.likes || 1) - 1, 0) }).eq("id", postId);
    }
  };

  const openProfile = async (profileId) => {
    if (profileId === user.id) return;
    const { data: p } = await supabase.from("profiles").select("*").eq("id", profileId).single();
    if (!p) return;
    const { data: posts } = await supabase.from("posts").select("*").eq("user_id", profileId).order("created_at", { ascending: false });
    const { data: acts } = await supabase.from("activities").select("*").eq("user_id", profileId).order("created_at", { ascending: false });
    const { count: fc } = await supabase.from("follows").select("*", { count: "exact", head: true }).eq("following_id", profileId);
    const { count: ing } = await supabase.from("follows").select("*", { count: "exact", head: true }).eq("follower_id", profileId);
    setViewingProfile({ ...p, followersCount: fc || 0, followingCount: ing || 0 });
    setViewPosts(posts || []);
    setViewActivities(acts || []);
    setViewTab("fotos");
  };

  const loadFollowList = async (type) => {
    setShowFollowModal(type);
    setFollowList([]);
    if (type === "seguidores") {
      const { data } = await supabase.from("follows")
        .select("profiles!follows_follower_id_fkey(id, name, handle, level, avatar_url, races_count)")
        .eq("following_id", user.id);
      setFollowList((data || []).map(d => d.profiles).filter(Boolean));
    } else {
      const { data } = await supabase.from("follows")
        .select("profiles!follows_following_id_fkey(id, name, handle, level, avatar_url, races_count)")
        .eq("follower_id", user.id);
      setFollowList((data || []).map(d => d.profiles).filter(Boolean));
    }
  };

  const loadRealFollowingList = async () => {
    const { data } = await supabase.from("follows").select("following_id").eq("follower_id", user.id);
    if (data) {
      const map = {};
      data.forEach(f => { map[f.following_id] = true; });
      setRealFollowing(map);
    }
  };


  const loadBlockedUsers = async () => {
    const { data, error } = await supabase
      .from("blocked_users")
      .select("blocked_id")
      .eq("blocker_id", user.id);

    if (error) {
      console.error("Erro ao carregar bloqueios:", error.message);
      return;
    }

    const map = {};
    (data || []).forEach((row) => {
      if (row.blocked_id) map[row.blocked_id] = true;
    });
    setBlockedUserIds(map);
  };

  const isBlockedUser = (targetUserId) => !!targetUserId && !!blockedUserIds[targetUserId];

  const showModerationToast = (message) => {
    setModerationToast(message);
    if (moderationToastTimerRef.current) clearTimeout(moderationToastTimerRef.current);
    moderationToastTimerRef.current = setTimeout(() => setModerationToast(""), 2200);
  };

  const openModerationMenu = ({ targetType, targetId, targetUserId, targetLabel = "" }) => {
    if (!targetUserId || targetUserId === user.id) return;
    setModerationMenu({ targetType, targetId, targetUserId, targetLabel });
  };

  const openReportFlow = (target) => {
    setModerationMenu(null);
    setBlockTarget(null);
    setReportReason("Spam");
    setReportDetails("");
    setReportTarget(target);
  };

  const openBlockFlow = (target) => {
    setModerationMenu(null);
    setReportTarget(null);
    setBlockTarget(target);
  };

  const closeModerationFlows = () => {
    setModerationMenu(null);
    setReportTarget(null);
    setBlockTarget(null);
    setReportReason("Spam");
    setReportDetails("");
  };

  const handleSubmitReport = async () => {
    if (!reportTarget?.targetType || !reportTarget?.targetId || !reportTarget?.targetUserId) return;

    const { error } = await supabase.from("reports").insert({
      reporter_id: user.id,
      reported_user_id: reportTarget.targetUserId,
      target_type: reportTarget.targetType,
      target_id: reportTarget.targetId,
      reason: reportReason,
      details: reportDetails.trim() || null,
      status: "pending",
    });

    if (error) {
      alert("Não foi possível enviar a denúncia: " + error.message);
      return;
    }

    closeModerationFlows();
    showModerationToast("Denúncia enviada. Obrigado por ajudar a comunidade.");
  };

  const handleBlockUser = async () => {
    const targetUserId = blockTarget?.targetUserId;
    if (!targetUserId || targetUserId === user.id) return;

    const { error } = await supabase
      .from("blocked_users")
      .upsert(
        { blocker_id: user.id, blocked_id: targetUserId },
        { onConflict: "blocker_id,blocked_id" }
      );

    if (error) {
      alert("Não foi possível bloquear este usuário: " + error.message);
      return;
    }

    await Promise.all([
      supabase.from("follows").delete().eq("follower_id", user.id).eq("following_id", targetUserId),
      supabase.from("follows").delete().eq("follower_id", targetUserId).eq("following_id", user.id),
    ]);

    setBlockedUserIds((prev) => ({ ...prev, [targetUserId]: true }));
    setPosts((prev) => prev.filter((post) => post.user_id !== targetUserId));
    setSuggestions((prev) => prev.filter((suggestion) => suggestion.id !== targetUserId));
    setSearchResults((prev) => prev.filter((result) => result.id !== targetUserId));
    setStories((prev) => prev.filter((story) => story.user_id !== targetUserId));
    setComments((prev) => {
      const next = {};
      Object.entries(prev || {}).forEach(([postId, list]) => {
        next[postId] = (list || []).filter((comment) => comment.user_id !== targetUserId);
      });
      return next;
    });

    if (viewingProfile?.id === targetUserId) setViewingProfile(null);

    closeModerationFlows();
    await loadRealFollowingList();
    await loadFollowCounts();
    await loadSuggestions();
    showModerationToast("Usuário bloqueado.");
  };

  const handleOnboarding = async () => {
    if (!onboardingForm.terms) return alert("Você precisa aceitar os Termos de Uso e a Política de Privacidade.");
    if (!onboardingForm.name.trim()) return alert("Informe seu nome.");
    if (!onboardingForm.handle.trim() || onboardingForm.handle.length < 3) return alert("Handle precisa ter no mínimo 3 caracteres.");
    const { data: existing } = await supabase.from("profiles").select("id").eq("handle", onboardingForm.handle).neq("id", user.id).single();
    if (existing) return alert("Esse @handle já está em uso. Tente outro.");
    await supabase.from("profiles").upsert({ id: user.id, name: onboardingForm.name, handle: onboardingForm.handle, level: "Iniciante", races_count: 0, total_km: 0, terms_accepted_at: new Date().toISOString(), terms_version: "1.0" });
    await loadProfile();
    setShowOnboarding(false);
  };

  const finishProductOnboarding = () => {
    try { window.localStorage?.setItem("eucorredor_intro_seen_v1", "true"); } catch (_) {}
    setProductOnboardingStep(0);
    setShowProductOnboarding(false);
  };

  const goToNextProductOnboardingStep = () => {
    if (productOnboardingStep >= 4) return finishProductOnboarding();
    setProductOnboardingStep((step) => Math.min(step + 1, 4));
  };

  const goToPreviousProductOnboardingStep = () => {
    setProductOnboardingStep((step) => Math.max(step - 1, 0));
  };

  const loadMyRaceRegistrations = async () => {
    setLoadingMyRaceRegistrations(true);

    try {
      const nowIso = new Date().toISOString();

      const { data, error } = await supabase
        .from("race_registrations")
        .select(`
          id,
          status,
          reservation_expires_at,
          amount_cents,
          created_at,
          race_event:race_events (
            id,
            event_id,
            base_event:events (
              id,
              name,
              date,
              city,
              state
            )
          ),
          modality:race_modalities (
            id,
            name
          ),
          lot:race_lots (
            id,
            name
          )
        `)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      setMyRaceRegistrations(data || []);
    } catch (err) {
      console.error("Erro ao carregar Minhas provas:", err.message || err);
      setMyRaceRegistrations([]);
    } finally {
      setLoadingMyRaceRegistrations(false);
    }
  };

  const loadEvents = async () => {
    const { data: eventsData, error: eventsError } = await supabase
      .from("events")
      .select("*")
      .order("created_at", { ascending: true });

    if (eventsError) {
      console.error("Erro ao carregar eventos:", eventsError.message);
      setDbEvents([]);
      setLoadingSections((prev) => ({ ...prev, events: false }));
      return;
    }

    const eventIds = (eventsData || []).map((event) => event.id).filter(Boolean);

    let raceEventsByEventId = {};

    if (eventIds.length > 0) {
      const { data: raceEventsData, error: raceEventsError } = await supabase
        .from("race_events")
        .select("id, event_id, slug, sales_status, native_registration_enabled")
        .in("event_id", eventIds);

      if (raceEventsError) {
        console.error("Erro ao carregar inscrições nativas dos eventos:", raceEventsError.message);
      } else {
        raceEventsByEventId = Object.fromEntries(
          (raceEventsData || []).map((raceEvent) => [raceEvent.event_id, raceEvent])
        );
      }
    }

    const eventsWithNativeRegistration = (eventsData || []).map((event) => ({
      ...event,
      race_event: raceEventsByEventId[event.id] || null,
    }));

    const sortedEvents = [...eventsWithNativeRegistration].sort((a, b) => {
      if (!!a.featured === !!b.featured) return 0;
      return a.featured ? -1 : 1;
    });

    setDbEvents(sortedEvents);
    setLoadingSections((prev) => ({ ...prev, events: false }));
  };

  const openRaceEventDetails = async (event) => {
    const raceEventId = event?.race_event?.id;
    if (!raceEventId) return;

    setSelectedRaceEvent(event);
    setRaceEventDetails(null);
    setSelectedRaceModalityId(null);
    setRaceCheckoutStep("details");
    setPendingRaceRegistration(null);
    setRaceParticipantForm({
      name: "",
      cpf: "",
      birthDate: "",
      phone: "",
      email: user?.email || "",
      tshirtSize: "",
      emergencyContactName: "",
      emergencyContactPhone: "",
    });
    setLoadingRaceDetails(true);

    try {
      const { data: raceEventData, error: raceEventError } = await supabase
        .from("race_events")
        .select("*")
        .eq("id", raceEventId)
        .single();

      if (raceEventError) throw raceEventError;

      const { data: organizerData, error: organizerError } = await supabase
        .from("race_organizers")
        .select("id, name, email, phone, instagram_url, logo_url, description")
        .eq("id", raceEventData.organizer_id)
        .maybeSingle();

      if (organizerError) {
        console.error("Erro ao carregar organizador da prova:", organizerError.message);
      }

      const { data: modalitiesData, error: modalitiesError } = await supabase
        .from("race_modalities")
        .select("*")
        .eq("race_event_id", raceEventId)
        .eq("is_active", true)
        .order("display_order", { ascending: true });

      if (modalitiesError) throw modalitiesError;

      const modalityIds = (modalitiesData || []).map((modality) => modality.id);

      let lotsData = [];

      if (modalityIds.length > 0) {
        const { data, error: lotsError } = await supabase
          .from("race_lots")
          .select("*")
          .in("modality_id", modalityIds)
          .order("display_order", { ascending: true });

        if (lotsError) throw lotsError;
        lotsData = data || [];
      }

      const lotsByModalityId = lotsData.reduce((acc, lot) => {
        if (!acc[lot.modality_id]) acc[lot.modality_id] = [];
        acc[lot.modality_id].push(lot);
        return acc;
      }, {});

      const modalitiesWithLots = (modalitiesData || []).map((modality) => ({
        ...modality,
        lots: lotsByModalityId[modality.id] || [],
      }));

      setRaceEventDetails({
        ...raceEventData,
        organizer: organizerData || null,
        modalities: modalitiesWithLots,
      });
    } catch (err) {
      console.error("Erro ao carregar detalhes da prova:", err.message || err);
      alert("Não foi possível carregar os detalhes desta prova agora.");
      setSelectedRaceEvent(null);
      setRaceEventDetails(null);
    } finally {
      setLoadingRaceDetails(false);
    }
  };

  const handleCreatePendingRaceRegistration = async () => {
    if (!raceEventDetails?.id || !selectedRaceModalityId) {
      alert("Selecione uma modalidade antes de continuar.");
      return;
    }

    const selectedModality = (raceEventDetails.modalities || []).find(
      (modality) => modality.id === selectedRaceModalityId
    );

    const activeLot = (selectedModality?.lots || []).find((lot) => lot.is_active);

    if (!selectedModality || !activeLot) {
      alert("Não foi possível identificar a modalidade ou o lote ativo.");
      return;
    }

    setCreatingRaceRegistration(true);

    try {
      const extraCheckoutData = {
        emergency_contact_name: raceParticipantForm.emergencyContactName || "",
        emergency_contact_phone: raceParticipantForm.emergencyContactPhone || "",
      };

      const { data, error } = await supabase.rpc("create_pending_race_registration", {
        p_race_event_id: raceEventDetails.id,
        p_modality_id: selectedRaceModalityId,
        p_participant_name: raceParticipantForm.name,
        p_participant_cpf: raceParticipantForm.cpf,
        p_participant_birth_date: raceParticipantForm.birthDate,
        p_participant_phone: raceParticipantForm.phone,
        p_participant_email: raceParticipantForm.email,
        p_tshirt_size: raceParticipantForm.tshirtSize || null,
        p_extra_checkout_data: extraCheckoutData,
      });

      if (error) throw error;

      const reservation = Array.isArray(data) ? data[0] : data;

      setPendingRaceRegistration(reservation || null);
      await loadMyRaceRegistrations();

      setRaceCheckoutStep("reserved");
    } catch (err) {
      console.error("Erro ao criar reserva da inscrição:", err.message || err);
      alert(err.message || "Não foi possível criar a reserva agora.");
    } finally {
      setCreatingRaceRegistration(false);
    }
  };

  const handleCreatePixPayment = async () => {
    if (!pendingRaceRegistration?.registration_id) {
      alert("Não foi possível identificar a inscrição reservada.");
      return;
    }

    if (!pendingRaceRegistration?.amount_cents) {
      alert("Não foi possível identificar o valor da inscrição.");
      return;
    }

    setCreatingPixPayment(true);
    setPixPaymentError("");
    setPixPaymentData(null);

    try {
      const pixApiUrl = Capacitor.isNativePlatform()
        ? "https://app.eucorredor.com.br/api/criar-pagamento-pix"
        : "/api/criar-pagamento-pix";

      const response = await fetch(pixApiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          registrationId: pendingRaceRegistration.registration_id,
          amountCents: pendingRaceRegistration.amount_cents,
          participantEmail: raceParticipantForm.email,
          participantName: raceParticipantForm.name
        })
      });

      const data = await response.json();

      if (!response.ok || !data?.sucesso) {
        throw new Error(data?.erro || "Não foi possível gerar o Pix.");
      }

      setPixPaymentData(data);
    } catch (err) {
      console.error("Erro ao gerar Pix da inscrição:", err.message || err);
      setPixPaymentError(err.message || "Não foi possível gerar o Pix.");
    } finally {
      setCreatingPixPayment(false);
    }
  };

  const handleCreateCardPayment = async (formData, additionalData) => {
    const registrationId = pendingRaceRegistration?.registration_id;

    if (!registrationId) {
      setCardPaymentError("Não foi possível identificar a inscrição reservada.");
      throw new Error("Inscrição reservada não identificada.");
    }

    if (!pendingRaceRegistration?.amount_cents) {
      setCardPaymentError("Não foi possível identificar o valor da inscrição.");
      throw new Error("Valor da inscrição não identificado.");
    }

    setCreatingCardPayment(true);
    setCardPaymentError("");

    try {
      const cardApiUrl = Capacitor.isNativePlatform()
        ? "https://app.eucorredor.com.br/api/criar-pagamento-cartao"
        : "/api/criar-pagamento-cartao";

      const response = await fetch(cardApiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          registrationId,
          amountCents: pendingRaceRegistration.amount_cents,
          token: formData?.token,
          paymentMethodId: formData?.payment_method_id,
          paymentTypeId: additionalData?.paymentTypeId,
          installments: formData?.installments,
          payerEmail: "test@testuser.com",
          identification: formData?.payer?.identification || null
        })
      });

      const data = await response.json();

      if (!response.ok || !data?.sucesso) {
        throw new Error(data?.erro || "Não foi possível processar o cartão.");
      }

      setCardPaymentData(data);

      if (data?.inscricao_confirmada) {
        setPendingRaceRegistration((current) => ({
          ...current,
          status: "confirmed"
        }));

        await loadMyRaceRegistrations();
      }

      return data;
    } catch (err) {
      console.error("Erro ao processar pagamento com cartão:", err.message || err);
      setCardPaymentError(err.message || "Não foi possível processar o cartão.");
      throw err;
    } finally {
      setCreatingCardPayment(false);
    }
  };

  const handleCheckPixPaymentStatus = async (registrationIdFromCard = null) => {
    const registrationId =
      registrationIdFromCard || pendingRaceRegistration?.registration_id;

    if (!registrationId) {
      alert("Não foi possível identificar a inscrição.");
      return;
    }

    try {
      const { data, error } = await supabase
        .from("race_registrations")
        .select("id, status, confirmed_at, payment_status, payment_status_detail")
        .eq("id", registrationId)
        .single();

      if (error) throw error;

      if (data?.status === "confirmed") {
        setPendingRaceRegistration((current) => ({
          ...current,
          status: "confirmed",
          confirmed_at: data.confirmed_at
        }));

        setPixPaymentData((current) => ({
          ...current,
          payment_confirmed: true,
          payment_status: data.payment_status,
          payment_status_detail: data.payment_status_detail
        }));

        await loadMyRaceRegistrations();
        return;
      }

      alert("Pagamento ainda não identificado. Assim que for aprovado, sua inscrição será confirmada automaticamente.");
    } catch (err) {
      console.error("Erro ao verificar pagamento Pix:", err.message || err);
      alert("Não foi possível verificar o pagamento agora.");
    }
  };

  const handleSaveEvent = async () => {
    if (!eventForm.name || !eventForm.date || !eventForm.distance) return alert("Preencha nome, data e distância.");
    setSavingEvent(true);

    try {
      if (eventForm.featured) {
        await supabase
          .from("events")
          .update({ featured: false })
          .neq("id", "00000000-0000-0000-0000-000000000000");
      }

      const { error } = await supabase.from("events").insert({
        name: eventForm.name,
        date: eventForm.date,
        city: eventForm.city,
        state: eventForm.state,
        distance: eventForm.distance,
        category: eventForm.category,
        link: eventForm.link,
        featured: !!eventForm.featured,
      });

      if (error) throw error;

      setEventForm({ name: "", date: "", city: "", state: "RS", distance: "", category: "5K", link: "", featured: false });
      await loadEvents();
    } catch (err) {
      alert("Erro ao salvar evento: " + (err.message || "tente novamente."));
    }

    setSavingEvent(false);
  };

  const handleSaveNativeRace = async () => {
    if (
      !nativeRaceForm.name.trim() ||
      !nativeRaceForm.slug.trim() ||
      !nativeRaceForm.eventDate ||
      !nativeRaceForm.city.trim() ||
      !nativeRaceForm.state.trim() ||
      !nativeRaceForm.organizerName.trim()
    ) {
      alert("Preencha os dados básicos da prova.");
      return;
    }

    if (nativeRaceModalities.length === 0) {
      alert("Cadastre ao menos uma modalidade.");
      return;
    }

    setSavingNativeRace(true);

    try {
      const [year, month, day] = nativeRaceForm.eventDate.split("-");
      const monthNames = [
        "",
        "janeiro",
        "fevereiro",
        "março",
        "abril",
        "maio",
        "junho",
        "julho",
        "agosto",
        "setembro",
        "outubro",
        "novembro",
        "dezembro"
      ];

      const eventDateLabel = `${Number(day)} ${monthNames[Number(month)] || ""} ${year}`.trim();
      const nativeDistanceLabel = nativeRaceModalities.map((modality) => modality.name).join(" · ");
      const nativeCategoryLabel = nativeRaceModalities[0]?.name || "Corrida";

      if (nativeRaceForm.featured) {
        await supabase
          .from("events")
          .update({ featured: false })
          .neq("id", "00000000-0000-0000-0000-000000000000");
      }

      const { data: eventData, error: eventError } = await supabase
        .from("events")
        .insert({
          name: nativeRaceForm.name.trim(),
          date: eventDateLabel,
          city: nativeRaceForm.city.trim(),
          state: nativeRaceForm.state.trim(),
          distance: nativeDistanceLabel,
          category: nativeCategoryLabel,
          link: "",
          featured: !!nativeRaceForm.featured,
        })
        .select("id")
        .single();

      if (eventError) throw eventError;

      const { data: organizerData, error: organizerError } = await supabase
        .from("race_organizers")
        .insert({
          name: nativeRaceForm.organizerName.trim(),
          is_active: true,
        })
        .select("id")
        .single();

      if (organizerError) throw organizerError;

      let kitImageUrl = null;

      if (nativeKitImageFile) {
        const safeFileName = nativeKitImageFile.name
          .toLowerCase()
          .replace(/[^a-z0-9._-]+/g, "-");

        const imagePath = `race-kits/${Date.now()}-${safeFileName}`;

        const { error: uploadError } = await supabase
          .storage
          .from("posts")
          .upload(imagePath, nativeKitImageFile);

        if (uploadError) throw uploadError;

        const { data: kitImagePublicData } = supabase
          .storage
          .from("posts")
          .getPublicUrl(imagePath);

        kitImageUrl = kitImagePublicData?.publicUrl || null;
      }

      const kitItems = nativeRaceForm.kitItemsText
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);

      const tshirtSizes = nativeRaceForm.tshirtSizesText
        .split(",")
        .map((size) => size.trim())
        .filter(Boolean);

      const { data: raceEventData, error: raceEventError } = await supabase
        .from("race_events")
        .insert({
          event_id: eventData.id,
          organizer_id: organizerData.id,
          slug: nativeRaceForm.slug.trim(),
          sales_status: nativeRaceForm.salesStatus,
          native_registration_enabled: true,
          kit_image_url: kitImageUrl,
          kit_description: nativeRaceForm.kitDescription.trim() || null,
          kit_items: kitItems,
          has_tshirt: !!nativeRaceForm.hasTshirt,
          tshirt_sizes: nativeRaceForm.hasTshirt ? tshirtSizes : [],
          checkout_settings: {
            requires_emergency_contact: !!nativeRaceForm.requiresEmergencyContact,
          },
        })
        .select("id")
        .single();

      if (raceEventError) throw raceEventError;

      for (let modalityIndex = 0; modalityIndex < nativeRaceModalities.length; modalityIndex++) {
        const modality = nativeRaceModalities[modalityIndex];
        const distanceMatch = modality.name.match(/\d+(?:[.,]\d+)?/);
        const distanceKm = distanceMatch ? Number(distanceMatch[0].replace(",", ".")) : null;

        const { data: modalityData, error: modalityError } = await supabase
          .from("race_modalities")
          .insert({
            race_event_id: raceEventData.id,
            name: modality.name,
            distance_km: Number.isFinite(distanceKm) ? distanceKm : null,
            description: null,
            display_order: modalityIndex + 1,
            is_active: true,
          })
          .select("id")
          .single();

        if (modalityError) throw modalityError;

        const lots = Array.isArray(modality.lots) ? modality.lots : [];

        for (let lotIndex = 0; lotIndex < lots.length; lotIndex++) {
          const lot = lots[lotIndex];
          const priceInCents = Math.round(Number(lot.price || 0) * 100);

          const { error: lotError } = await supabase
            .from("race_lots")
            .insert({
              modality_id: modalityData.id,
              name: lot.name,
              price_cents: priceInCents,
              total_slots: Number(lot.totalSlots || 0),
              reserved_slots: 0,
              confirmed_slots: 0,
              is_active: true,
              display_order: lotIndex + 1,
            });

          if (lotError) throw lotError;
        }
      }

      setLastSavedNativeOrganizer({
        id: organizerData.id,
        name: nativeRaceForm.organizerName.trim(),
        raceName: nativeRaceForm.name.trim()
      });

      alert("Prova nativa salva com sucesso!");

      setNativeRaceStep("basic");
      setNativeRaceForm({
        name: "",
        slug: "",
        eventDate: "",
        city: "",
        state: "RS",
        organizerName: "",
        salesStatus: "open",
        featured: false,
        kitDescription: "",
        kitItemsText: "",
        hasTshirt: true,
        tshirtSizesText: "PP, P, M, G, GG",
        requiresEmergencyContact: true
      });
      setNativeKitImageFile(null);
      setNativeKitImagePreview(null);
      setNativeRaceModalities([]);
      setNativeModalityDraft({
        name: "",
        lotName: "1º lote",
        price: "",
        totalSlots: ""
      });

      await loadEvents();
    } catch (err) {
      console.error("Erro ao salvar prova nativa:", err.message || err);
      alert("Erro ao salvar prova nativa: " + (err.message || "tente novamente."));
    } finally {
      setSavingNativeRace(false);
    }
  };

  const handleSetFeaturedEvent = async (eventId) => {
    try {
      await supabase
        .from("events")
        .update({ featured: false })
        .neq("id", "00000000-0000-0000-0000-000000000000");

      const { error } = await supabase
        .from("events")
        .update({ featured: true })
        .eq("id", eventId);

      if (error) throw error;
      await loadEvents();
    } catch (err) {
      alert("Erro ao definir destaque: " + (err.message || "tente novamente."));
    }
  };

  const handleRemoveFeaturedEvent = async (eventId) => {
    try {
      const { error } = await supabase
        .from("events")
        .update({ featured: false })
        .eq("id", eventId);

      if (error) throw error;
      await loadEvents();
    } catch (err) {
      alert("Erro ao remover destaque: " + (err.message || "tente novamente."));
    }
  };

  const handleDeleteEvent = async (id) => {
    if (!window.confirm("Excluir este evento?")) return;
    await supabase.from("events").delete().eq("id", id);
    await loadEvents();
  };

  const loadFollowCounts = async () => {
    const { count: fc } = await supabase.from("follows").select("*", { count: "exact", head: true }).eq("following_id", user.id);
    const { count: ing } = await supabase.from("follows").select("*", { count: "exact", head: true }).eq("follower_id", user.id);
    setFollowersCount(fc || 0);
    setFollowingCount(ing || 0);
  };

  const loadProfile = async () => {
    const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
    setProfile(data);
    setLoadingSections((prev) => ({ ...prev, profile: false }));
    const hasHandle = data?.handle && data.handle.trim() !== "";
    if (!hasHandle) {
      const suggestedHandle = user.email?.split("@")[0]?.toLowerCase().replace(/[^a-z0-9_]/g, "") || "";
      const suggestedName = user.user_metadata?.full_name || user.user_metadata?.name || data?.name || "";
      setOnboardingForm({ name: suggestedName, handle: suggestedHandle, terms: false });
      setShowOnboarding(true);
    } else {
      const introSeen = window.localStorage?.getItem("eucorredor_intro_seen_v1") === "true";
      if (!introSeen) {
        setProductOnboardingStep(0);
        setShowProductOnboarding(true);
      }
    }
  };

  const loadPosts = async () => {
    const { data } = await supabase.from("posts").select("*, profiles(id, name, level, avatar_url, handle)").order("created_at", { ascending: false }).limit(20);
    setPosts(data || []);
    setLoadingSections((prev) => ({ ...prev, posts: false }));
  };

  const loadActivities = async () => {
    const { data } = await supabase.from("activities").select("*, profiles(name, avatar_url)").order("created_at", { ascending: false }).limit(20);
    setActivities(data || []);
    setLoadingSections((prev) => ({ ...prev, activities: false }));
  };

  const refreshAllData = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    setRefreshMessage("");

    try {
      await Promise.all([
        loadProfile(),
        loadPosts(),
        loadActivities(),
        loadFollowCounts(),
        loadNotifications(),
        loadRealFollowingList(),
        loadBlockedUsers(),
        loadEvents(),
        loadStories(),
        loadSuggestions(),
        loadRankingUsers(),
        loadMyClubs(),
        loadAllClubs(),
        loadClubMembership(),
      ]);

      if (openComments) await loadComments(openComments);
      if (activeClub) await openClub(activeClub);
      setRefreshMessage("Conteúdo atualizado");
    } catch (err) {
      console.error("Erro ao atualizar conteúdo:", err);
      setRefreshMessage("Não foi possível atualizar agora");
    } finally {
      setIsRefreshing(false);
      if (refreshNoticeTimerRef.current) clearTimeout(refreshNoticeTimerRef.current);
      refreshNoticeTimerRef.current = setTimeout(() => setRefreshMessage(""), 1800);
    }
  };

  const handlePullStart = (event) => {
    if (hubScreen === "tracking" || showNotifications || showAdminEvents || showSearch || activeStory) return;
    if (window.scrollY > 0) return;
    pullStartYRef.current = event.touches?.[0]?.clientY ?? null;
    pullDistanceRef.current = 0;
  };

  const handlePullMove = (event) => {
    if (pullStartYRef.current === null || window.scrollY > 0) return;
    const currentY = event.touches?.[0]?.clientY;
    if (typeof currentY !== "number") return;
    const distance = Math.max(0, Math.min(112, currentY - pullStartYRef.current));
    pullDistanceRef.current = distance;
    setPullDistance(distance);
  };

  const handlePullEnd = () => {
    const shouldRefresh = pullDistanceRef.current >= 72;
    pullStartYRef.current = null;
    pullDistanceRef.current = 0;
    setPullDistance(0);
    if (shouldRefresh) refreshAllData();
  };

  const handlePost = async () => {
    if (!newPost.trim()) return;
    setLoadingPost(true);
    const { error } = await supabase.from("posts").insert({ user_id: user.id, text: newPost });
    if (error) alert("Erro: " + error.message);
    else { setNewPost(""); await loadPosts(); }
    setLoadingPost(false);
  };

  const handleActivity = async () => {
    if (!actForm.distance) return;
    const { error } = await supabase.from("activities").insert({ user_id: user.id, distance: parseFloat(actForm.distance), duration: actForm.duration, pace: actForm.pace });
    if (error) { alert("Erro: " + error.message); return; }
    const newKm = (profile?.total_km || 0) + parseFloat(actForm.distance);
    const newCount = (profile?.races_count || 0) + 1;
    await supabase.from("profiles").update({ total_km: newKm, races_count: newCount, level: getLevel(newCount).name }).eq("id", user.id);
    setActForm({ distance: "", duration: "", pace: "" });
    setShowActivityForm(false);
    setShowPublish(false);
    setPublishType(null);
    await loadProfile();
    await loadActivities();
  };

  const formatRunTime = (seconds) => {
    const h = Math.floor(seconds / 3600), m = Math.floor((seconds % 3600) / 60), s = seconds % 60;
    if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  const formatGpsPace = (km, secs) => {
    if (!km || km < 0.05 || secs < 10) return "--'--";
    const minPerKm = (secs / 60) / km;
    if (minPerKm < 2) return "--'--";
    const min = Math.floor(minPerKm);
    const sec = Math.round((minPerKm - min) * 60);
    const adjMin = sec >= 60 ? min + 1 : min;
    const adjSec = sec >= 60 ? 0 : sec;
    return adjMin + "min" + String(adjSec).padStart(2, "0") + "s/km";
  };

  const getRunSummary = (distanceKm, elapsedSeconds) => {
    const safeDistance = Number(distanceKm || 0);
    const safeElapsed = Math.max(Number(elapsedSeconds || 0), 1);
    const paceSecondsPerKm = safeDistance > 0 ? safeElapsed / safeDistance : Infinity;
    const distanceLabel = safeDistance.toFixed(2).replace(".", ",");
    const durationLabel = formatRunTime(safeElapsed);
    const paceLabel = formatGpsPace(safeDistance, safeElapsed);

    let type = "Atividade registrada";
    let emoji = "🏁";
    let tone = "#f59e0b";
    let explanation = "Sua atividade foi concluída e já entrou no histórico.";
    let feedText = `Registrei uma atividade de ${distanceLabel} km em ${durationLabel}. 🏁`;

    if (safeDistance < 0.05 || safeElapsed < 20 || !Number.isFinite(paceSecondsPerKm)) {
      type = "Atividade curta";
      emoji = "📍";
      tone = "#94a3b8";
      explanation = "A atividade foi muito curta para uma leitura confiável de ritmo.";
      feedText = `Registrei uma atividade curta de ${distanceLabel} km em ${durationLabel}. 📍`;
    } else if (paceSecondsPerKm >= 660) {
      type = "Caminhada";
      emoji = "🚶";
      tone = "#6ee7b7";
      explanation = `O ritmo médio de ${paceLabel} indica uma caminhada ou deslocamento leve.`;
      feedText = `Completei uma caminhada de ${distanceLabel} km em ${durationLabel}, com ritmo médio de ${paceLabel}. 🚶`;
    } else if (paceSecondsPerKm >= 510) {
      type = "Corrida leve";
      emoji = "🏃";
      tone = "#60a5fa";
      explanation = `O pace de ${paceLabel} sugere um trote leve, bom para manter a constância.`;
      feedText = `Finalizei uma corrida leve de ${distanceLabel} km em ${durationLabel}, com pace médio de ${paceLabel}. 🏃`;
    } else if (paceSecondsPerKm >= 360) {
      type = "Corrida moderada";
      emoji = "🔥";
      tone = "#f97316";
      explanation = `O pace de ${paceLabel} mostra um treino consistente, com intensidade moderada.`;
      feedText = `Corri ${distanceLabel} km em ${durationLabel}, com pace médio de ${paceLabel}. Treino moderado concluído. 🔥`;
    } else {
      type = "Corrida intensa";
      emoji = "⚡";
      tone = "#e11d48";
      explanation = `O pace de ${paceLabel} indica um treino mais intenso e acelerado.`;
      feedText = `Finalizei uma corrida intensa de ${distanceLabel} km em ${durationLabel}, com pace médio de ${paceLabel}. ⚡`;
    }

    return { type, emoji, tone, explanation, feedText, distanceLabel, durationLabel, paceLabel };
  };

  const createRouteSnapshotDataUrl = (route = []) => {
    if (!Array.isArray(route) || route.length < 2) return "";

    const sampled = route.length > 90
      ? route.filter((_, index) => index % Math.ceil(route.length / 90) === 0 || index === route.length - 1)
      : route;

    const lats = sampled.map(([lat]) => Number(lat)).filter(Number.isFinite);
    const lngs = sampled.map(([, lng]) => Number(lng)).filter(Number.isFinite);
    if (lats.length < 2 || lngs.length < 2) return "";

    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    const width = 900;
    const height = 540;
    const pad = 62;
    const latSpan = Math.max(maxLat - minLat, 0.0001);
    const lngSpan = Math.max(maxLng - minLng, 0.0001);

    const points = sampled.map(([lat, lng]) => {
      const x = pad + ((Number(lng) - minLng) / lngSpan) * (width - pad * 2);
      const y = height - pad - ((Number(lat) - minLat) / latSpan) * (height - pad * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(" ");

    const [startX, startY] = points.split(" ")[0].split(",");
    const [endX, endY] = points.split(" ").slice(-1)[0].split(",");

    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
        <defs>
          <radialGradient id="glow" cx="70%" cy="22%" r="70%">
            <stop offset="0%" stop-color="#e11d48" stop-opacity="0.28"/>
            <stop offset="100%" stop-color="#0a0a0f" stop-opacity="0"/>
          </radialGradient>
          <filter id="shadow" x="-40%" y="-40%" width="180%" height="180%">
            <feDropShadow dx="0" dy="0" stdDeviation="10" flood-color="#e11d48" flood-opacity="0.45"/>
          </filter>
        </defs>
        <rect width="${width}" height="${height}" rx="34" fill="#0d0d18"/>
        <rect width="${width}" height="${height}" rx="34" fill="url(#glow)"/>
        ${[1,2,3,4,5].map(i => `<line x1="${i * width / 6}" y1="0" x2="${i * width / 6}" y2="${height}" stroke="#ffffff" stroke-opacity="0.06" stroke-width="2"/>`).join("")}
        ${[1,2,3,4].map(i => `<line x1="0" y1="${i * height / 5}" x2="${width}" y2="${i * height / 5}" stroke="#ffffff" stroke-opacity="0.06" stroke-width="2"/>`).join("")}
        <polyline points="${points}" fill="none" stroke="#e11d48" stroke-opacity="0.22" stroke-width="20" stroke-linecap="round" stroke-linejoin="round" filter="url(#shadow)"/>
        <polyline points="${points}" fill="none" stroke="#ff3157" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>
        <circle cx="${startX}" cy="${startY}" r="18" fill="#6ee7b7" stroke="#ffffff" stroke-width="7"/>
        <circle cx="${endX}" cy="${endY}" r="21" fill="#ffffff"/>
        <circle cx="${endX}" cy="${endY}" r="12" fill="#e11d48"/>
        <text x="72" y="74" fill="#ffffff" font-family="Arial, sans-serif" font-size="34" font-weight="700">Percurso registrado</text>
        <text x="72" y="116" fill="#a1a1aa" font-family="Arial, sans-serif" font-size="22">eucorredor</text>
      </svg>`;

    return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
  };

  const beginGpsRun = () => {
    setGpsElapsed(0);
    setGpsDistance(0);
    setGpsRoute([{ x: 195, y: 300 }]);
    setGpsPaused(false);
    setGpsLocked(false);
    setRunSummary(null);
    setCompletedRunRoute([]);
    setSummaryPostText("");
    setGpsHR(142);
    setGpsLocated(false);
    setGpsError("");
    setShowGpsPermissionModal(false);
    setHubScreen("tracking");
  };

  const startGpsRun = () => {
    setGpsError("");
    setShowGpsPermissionModal(true);
  };

  const requestGpsPermissionAndStart = async () => {
    setGpsError("");
    setCheckingGpsPermission(true);

    try {
      if (Capacitor.isNativePlatform()) {
        const permissions = await Geolocation.requestPermissions();

        if (permissions.location !== "granted") {
          setGpsError("Permissão negada. Ative a localização do EuCorredor nos Ajustes do iPhone.");
          return;
        }

        await Geolocation.getCurrentPosition({
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 0,
        });

        beginGpsRun();
        return;
      }

      if (!navigator.geolocation) {
        setGpsError("Seu navegador não permite usar GPS neste dispositivo.");
        return;
      }

      navigator.geolocation.getCurrentPosition(
        () => beginGpsRun(),
        (err) => {
          const msgs = {
            1: "Permissão negada. Ative a localização do navegador para registrar sua corrida.",
            2: "GPS indisponível no momento. Verifique sinal, internet e localização do aparelho.",
            3: "Tempo esgotado ao buscar sua localização. Tente novamente em local aberto.",
          };
          setGpsError(msgs[err.code] || "Não foi possível acessar sua localização.");
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
      );
    } catch (err) {
      setGpsError("Não foi possível acessar sua localização. Verifique a permissão de GPS e tente novamente.");
    } finally {
      setCheckingGpsPermission(false);
    }
  };

  const finishGpsRun = async () => {
    clearInterval(gpsIntervalRef.current);
    const finalRoute = [...leafletCoordsRef.current];
    setCompletedRunRoute(finalRoute);
    if (leafletMapRef.current?._watchId !== undefined) navigator.geolocation.clearWatch(leafletMapRef.current._watchId);
    if (leafletMapRef.current) { leafletMapRef.current.remove(); leafletMapRef.current = null; }

    const pace = formatGpsPace(gpsDistance, gpsElapsed);
    const duration = formatRunTime(gpsElapsed);
    const summary = getRunSummary(gpsDistance, gpsElapsed);
    setRunSummary(summary);
    setSummaryPostText(summary.feedText);

    if (gpsDistance > 0) {
      await supabase.from("activities").insert({ user_id: user.id, distance: parseFloat(gpsDistance.toFixed(2)), duration, pace });
      const newKm = (profile?.total_km || 0) + gpsDistance;
      const newCount = (profile?.races_count || 0) + 1;
      await supabase.from("profiles").update({ total_km: newKm, races_count: newCount, level: getLevel(newCount).name }).eq("id", user.id);
      await loadProfile();
      await loadActivities();
      await loadRankingUsers();
    }

    setHubScreen("summary");
  };

  const handleSaveMonthGoal = () => {
    const nextGoal = Number(String(goalDraft).replace(",", "."));
    if (!Number.isFinite(nextGoal) || nextGoal <= 0) return alert("Informe uma meta válida em quilômetros.");
    setMonthGoal(nextGoal);
    window.localStorage?.setItem("eucorredor_month_goal", String(nextGoal));
    setShowGoalEditor(false);
  };

  const handlePublishRunSummary = async () => {
    const text = (runSummary?.feedText || summaryPostText).trim();
    const routeSnapshot = createRouteSnapshotDataUrl(completedRunRoute);
    const cannotPublishWithRoute = runSummary?.type === "Atividade curta" || !routeSnapshot;
    if (!text || cannotPublishWithRoute) return;
    setPublishingRunSummary(true);
    const payload = { user_id: user.id, text, photo_url: routeSnapshot };
    const { error } = await supabase.from("posts").insert(payload);
    if (error) alert("Erro ao publicar no feed: " + error.message);
    else {
      await loadPosts();
      setRunSummary(null);
      setCompletedRunRoute([]);
      setSummaryPostText("");
      setTab("comunidade");
      setCommFeed("todos");
      setHubScreen("hub");
    }
    setPublishingRunSummary(false);
  };

  const leafletMapRef = useRef(null);
  const leafletMarkerRef = useRef(null);
  const leafletPolylineRef = useRef(null);
  const leafletCoordsRef = useRef([]);

  useEffect(() => {
    if (hubScreen !== "tracking") return;
    const loadLeaflet = async () => {
      if (!window.L) {
        const script = document.createElement("script");
        script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
        script.onload = initMap;
        document.head.appendChild(script);
      } else { initMap(); }
    };
    const initMap = () => {
      const mapEl = document.getElementById("leaflet-map");
      if (!mapEl || leafletMapRef.current) return;
      const map = window.L.map("leaflet-map", { zoomControl: false, attributionControl: false });
      map.setView([-30.0346, -51.2177], 15);
      window.L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", { maxZoom: 19, subdomains: "abcd" }).addTo(map);
      const markerIcon = window.L.divIcon({ html: `<div style="width:18px;height:18px;background:#e11d48;border-radius:50%;border:3px solid #fff;box-shadow:0 0 10px #e11d4880;"></div>`, iconSize: [18, 18], iconAnchor: [9, 9], className: "" });
      const marker = window.L.marker([0, 0], { icon: markerIcon }).addTo(map);
      const polyline = window.L.polyline([], { color: "#e11d48", weight: 4, opacity: 0.9 }).addTo(map);
      leafletMapRef.current = map; leafletMarkerRef.current = marker; leafletPolylineRef.current = polyline; leafletCoordsRef.current = [];
      setTimeout(() => { map.invalidateSize(); }, 300);
      gpsIntervalRef.current = setInterval(() => {
        setGpsElapsed(e => e + 1);
        setGpsHR(h => Math.max(135, Math.min(175, h + (Math.random() > 0.5 ? 1 : -1))));
      }, 1000);
      let lastCoord = null;
      const gpsOptions = { enableHighAccuracy: true, maximumAge: 5000, timeout: 30000 };
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition((pos) => {
          const { latitude: lat, longitude: lng } = pos.coords;
          marker.setLatLng([lat, lng]); map.setView([lat, lng], 17); setGpsLocated(true); lastCoord = [lat, lng];
        }, (err) => { const msgs = { 1: "Permissão negada. Ative a localização do navegador para registrar sua corrida.", 2: "GPS indisponível", 3: "Tempo esgotado" }; setGpsError(msgs[err.code] || "Erro GPS"); if (err.code === 1) setShowGpsPermissionModal(true); }, gpsOptions);
        const watchId = navigator.geolocation.watchPosition((pos) => {
          const { latitude: lat, longitude: lng } = pos.coords;
          const latlng = [lat, lng];
          marker.setLatLng(latlng); map.setView(latlng, 17); setGpsLocated(true);
          if (lastCoord) {
            const R = 6371, dLat = (lat - lastCoord[0]) * Math.PI / 180, dLng = (lng - lastCoord[1]) * Math.PI / 180;
            const a = Math.sin(dLat/2)**2 + Math.cos(lastCoord[0]*Math.PI/180)*Math.cos(lat*Math.PI/180)*Math.sin(dLng/2)**2;
            const dist = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
            if (dist > 0.003 && dist < 0.5) { setGpsDistance(d => d + dist); leafletCoordsRef.current.push(latlng); polyline.setLatLngs(leafletCoordsRef.current); }
          } else { leafletCoordsRef.current = [latlng]; }
          map.setView(latlng, 17); lastCoord = latlng;
        }, (err) => { const msgs = { 1: "Permissão negada. Ative a localização do navegador para registrar sua corrida.", 2: "GPS indisponível", 3: "Tempo esgotado" }; setGpsError(msgs[err.code] || "Erro GPS"); if (err.code === 1) setShowGpsPermissionModal(true); }, gpsOptions);
        leafletMapRef.current._watchId = watchId;
      }
    };
    loadLeaflet();
    return () => {
      clearInterval(gpsIntervalRef.current);
      if (leafletMapRef.current) {
        if (leafletMapRef.current._watchId !== undefined) navigator.geolocation.clearWatch(leafletMapRef.current._watchId);
        leafletMapRef.current.remove(); leafletMapRef.current = null; leafletMarkerRef.current = null; leafletPolylineRef.current = null;
      }
    };
  }, [hubScreen]);

  useEffect(() => {
    if (hubScreen === "tracking") {
      if (gpsPaused) clearInterval(gpsIntervalRef.current);
      else {
        gpsIntervalRef.current = setInterval(() => {
          setGpsElapsed(e => e + 1);
          setGpsHR(h => Math.max(135, Math.min(175, h + (Math.random() > 0.5 ? 1 : -1))));
        }, 1000);
      }
    }
  }, [gpsPaused]);

  const handleShare = (type = "perfil", data = {}) => {
    const handle = profile?.handle || (profile?.name || userName).toLowerCase().replace(/\s/g, "");
    const url = `https://app.eucorredor.com.br/@${handle}`;
    let text = "";
    if (type === "atividade") text = `Acabei de correr ${data.distance} km em ${data.duration} com pace de ${data.pace}! 🏃`;
    else if (type === "perfil") text = `Me siga no eucorredor! Estou no nível ${level.name} com ${races} corridas. 🏃`;
    else if (type === "resumo_gps") text = `Finalizei ${data.distance} km em ${data.time}! 🏅 Pace: ${data.pace} | ${data.calories} kcal`;
    else text = `Confira no eucorredor, a comunidade dos corredores! 🏃`;
    const shareData = { title: "eucorredor", text, url };
    if (navigator.share && navigator.canShare && navigator.canShare(shareData)) navigator.share(shareData).catch(() => {});
    else {
      const full = `${text}\n${url}`;
      if (navigator.clipboard) navigator.clipboard.writeText(full).then(() => alert("Link copiado!"));
      else prompt("Copie o link:", full);
    }
  };

  const handleDeletePost = async (postId) => {
    if (!window.confirm("Excluir esta publicação?")) return;
    await supabase.from("posts").delete().eq("id", postId);
    await loadPosts();
  };

  const handleDeleteActivity = async (actId) => {
    if (!window.confirm("Excluir esta atividade?")) return;
    await supabase.from("activities").delete().eq("id", actId);
    await loadActivities();
  };

  const loadComments = async (postId) => {
    setCommentsLoading((prev) => ({ ...prev, [postId]: true }));
    const { data } = await supabase.from("comments").select("*, profiles(id, name, avatar_url, level, handle)").eq("post_id", postId).order("created_at", { ascending: true });
    setComments(c => ({ ...c, [postId]: (data || []).filter((comment) => !isBlockedUser(comment.user_id)) }));
    setCommentsLoading((prev) => ({ ...prev, [postId]: false }));
  };

  const handleComment = async (postId) => {
    if (!newComment.trim()) return;
    const commentText = newComment.trim();
    await supabase.from("comments").insert({ post_id: postId, user_id: user.id, text: commentText });
    const post = posts.find(p => p.id === postId);
    if (post && post.user_id !== user.id) {
      await supabase.from("notifications").insert({
        user_id: post.user_id,
        from_user_id: user.id,
        type: "comment",
        post_id: postId,
        comment_text: commentText,
      });
    }
    setNewComment("");
    await loadComments(postId);
    await loadNotifications();
  };

  const handleSearch = async (query) => {
    setSearchQuery(query);
    if (!query.trim()) { setSearchResults([]); return; }
    const { data } = await supabase.from("profiles").select("id, name, handle, level, avatar_url, races_count").or(`name.ilike.%${query}%,handle.ilike.%${query}%`).neq("id", user.id).limit(10);
    setSearchResults((data || []).filter((result) => !isBlockedUser(result.id)));
  };

  const handleEditProfile = async () => {
    const handle = editForm.handle?.toLowerCase().replace(/[^a-z0-9_]/g, "") || (editForm.name || "").toLowerCase().replace(/\s/g, "");
    await supabase.from("profiles").update({ name: editForm.name, bio: editForm.bio, handle }).eq("id", user.id);
    await loadProfile();
    setShowEditProfile(false);
  };

  const handleAvatarUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setAvatarPreview({ file, previewUrl: URL.createObjectURL(file) });
  };

  const confirmAvatarUpload = async () => {
    if (!avatarPreview) return;
    setUploadingAvatar(true);
    const { file } = avatarPreview;
    const ext = file.name.split(".").pop();
    const path = `${user.id}/avatar.${ext}`;
    const { error } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
    if (error) { alert("Erro ao enviar foto: " + error.message); setUploadingAvatar(false); return; }
    const { data } = supabase.storage.from("avatars").getPublicUrl(path);
    await supabase.from("profiles").update({ avatar_url: data.publicUrl }).eq("id", user.id);
    await loadProfile();
    setUploadingAvatar(false);
    setAvatarPreview(null);
  };

  const RouteMap = ({ route }) => {
    if (!route || route.length < 2) return null;
    const xs = route.map(p => p[0]), ys = route.map(p => p[1]);
    const pad = 14, w = 340, h = 130;
    const sx = (Math.max(...xs)-Math.min(...xs))||1, sy = (Math.max(...ys)-Math.min(...ys))||1;
    const pts = route.map(([x,y]) => `${pad+(x-Math.min(...xs))*(w-pad*2)/sx},${pad+(y-Math.min(...ys))*(h-pad*2)/sy}`).join(" ");
    const [x0,y0] = pts.split(" ")[0].split(",");
    const last = pts.split(" ").slice(-1)[0].split(",");
    return (
      <div style={{ background: "#0d0d18", borderRadius: 14, overflow: "hidden", marginTop: 12 }}>
        <svg width="100%" viewBox={`0 0 ${w} ${h}`} style={{ display: "block" }}>
          <rect width={w} height={h} fill="#0d0d18"/>
          {[0,1,2,3,4].map(i => <line key={i} x1={i*85} y1={0} x2={i*85} y2={h} stroke="#ffffff06" strokeWidth="1"/>)}
          <polyline points={pts} fill="none" stroke="#e11d48" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" opacity="0.15"/>
          <polyline points={pts} fill="none" stroke="#e11d48" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
          <circle cx={x0} cy={y0} r="5" fill="#6ee7b7"/>
          <circle cx={last[0]} cy={last[1]} r="7" fill="#e11d48" opacity="0.25"/>
          <circle cx={last[0]} cy={last[1]} r="4.5" fill="#e11d48"/>
          <circle cx={last[0]} cy={last[1]} r="2" fill="#fff"/>
        </svg>
      </div>
    );
  };

  const handleSignOut = async () => { await supabase.auth.signOut(); window.location.reload(); };

  const openSettings = () => {
    setShowSettings(true);
    setSettingsView("menu");
    setDeleteConfirmationText("");
    setDeleteAccountError("");
  };

  const closeSettings = () => {
    if (deletingAccount) return;
    setShowSettings(false);
    setSettingsView("menu");
    setDeleteConfirmationText("");
    setDeleteAccountError("");
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmationText.trim().toUpperCase() !== "EXCLUIR" || deletingAccount) return;
    setDeletingAccount(true);
    setDeleteAccountError("");

    const removeOwnStorageFiles = async (bucket) => {
      const { data: files, error: listError } = await supabase.storage.from(bucket).list(user.id, { limit: 1000 });
      if (listError) throw new Error(`Não foi possível localizar seus arquivos em ${bucket}: ${listError.message}`);
      const paths = (files || [])
        .filter((file) => file?.name)
        .map((file) => `${user.id}/${file.name}`);
      if (!paths.length) return;
      const { error: removeError } = await supabase.storage.from(bucket).remove(paths);
      if (removeError) throw new Error(`Não foi possível remover seus arquivos em ${bucket}: ${removeError.message}`);
    };

    try {
      await removeOwnStorageFiles("avatars");
      await removeOwnStorageFiles("posts");

      const { error } = await supabase.rpc("delete_my_account");
      if (error) throw error;

      try {
        window.localStorage?.removeItem("eucorredor_intro_seen_v1");
        window.localStorage?.removeItem("eucorredor_month_goal");
      } catch (_) {}

      await supabase.auth.signOut();
      window.location.reload();
    } catch (error) {
      setDeleteAccountError(error?.message || "Não foi possível excluir sua conta agora.");
      setDeletingAccount(false);
    }
  };

  const timeAgo = (dateStr) => {
    const diff = Math.floor((Date.now() - new Date(dateStr)) / 1000);
    if (diff < 60) return "agora";
    if (diff < 3600) return `${Math.floor(diff / 60)}min`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}d`;
    return new Date(dateStr).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
  };

  const races = profile?.races_count || 0;
  const level = getLevel(races);
  const next = getNextLevel(races);
  const progress = next ? ((races - level.min) / (next.min - level.min)) * 100 : 100;

  const hasActiveStory = (profileId) => stories.some(s => s.user_id === profileId);

  const getAvatar = (p, size = 38) => {
    if (p?.avatar_url) return <img src={p.avatar_url} alt="av" style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", border: `2px solid ${getLevelColor(p.level)}`, flexShrink: 0 }} />;
    return <div style={{ width: size, height: size, borderRadius: "50%", background: "#1e1e2e", display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.3, fontWeight: 700, color: "#fff", border: `2px solid ${getLevelColor(p?.level)}`, flexShrink: 0 }}>{p?.name?.charAt(0) || "?"}</div>;
  };

  const isUserOnline = (profileId) => Boolean(profileId && onlineUserIds[profileId]);

  const eventFilters = ["Todos", "3K", "5K", "10K", "21K", "Maratona", "Trail"];

  const normalizeEventText = (value = "") => value.toString().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

  const eventMatchesFilter = (event, filter) => {
    if (filter === "Todos") return true;
    const haystack = normalizeEventText(`${event.name || ""} ${event.distance || ""} ${event.category || ""}`);
    return haystack.includes(normalizeEventText(filter));
  };

  const filteredEvents = dbEvents.filter((event) => eventMatchesFilter(event, eventFilter));
  const sortedFilteredEvents = [...filteredEvents].sort((a, b) => {
    if (!!a.featured === !!b.featured) return 0;
    return a.featured ? -1 : 1;
  });
  const featuredEvent = sortedFilteredEvents.find((event) => event.featured) || sortedFilteredEvents[0];
  const listEvents = featuredEvent ? sortedFilteredEvents.filter((event) => event.id !== featuredEvent.id) : sortedFilteredEvents;

  const myRaceFilters = ["Todas", "Aguardando pagamento", "Confirmadas", "Histórico"];

  const isActivePendingRaceRegistration = (registration) =>
    registration.status === "pending_payment" &&
    registration.reservation_expires_at &&
    new Date(registration.reservation_expires_at).getTime() > Date.now();

  const filteredMyRaceRegistrations = myRaceRegistrations.filter((registration) => {
    const isPending = isActivePendingRaceRegistration(registration);
    const isConfirmed = registration.status === "confirmed";
    const isHistory =
      registration.status === "expired" ||
      registration.status === "cancelled" ||
      registration.status === "canceled" ||
      registration.status === "refunded" ||
      (registration.status === "pending_payment" && !isPending);

    if (myRaceFilter === "Aguardando pagamento") return isPending;
    if (myRaceFilter === "Confirmadas") return isConfirmed;
    if (myRaceFilter === "Histórico") return isHistory;

    return true;
  });

  const getEventImage = (event) => {
    const text = normalizeEventText(`${event?.name || ""} ${event?.category || ""} ${event?.distance || ""} ${event?.city || ""}`);

    if (text.includes("night") || text.includes("noite")) {
      return "https://images.unsplash.com/photo-1502224562085-639556652f33?w=900&q=85";
    }

    if (text.includes("trail") || text.includes("serra")) {
      return "https://images.unsplash.com/photo-1551632811-561732d1e306?w=900&q=85";
    }

    if (text.includes("maratona") || text.includes("42k") || text.includes("meia") || text.includes("21k")) {
      return "https://images.unsplash.com/photo-1552674605-db6ffd4facb5?w=900&q=85";
    }

    if (text.includes("3k") || text.includes("5k") || text.includes("10k") || text.includes("corrida de rua")) {
      return "https://images.unsplash.com/photo-1461896836934-ffe607ba8211?w=900&q=85";
    }

    return "https://images.unsplash.com/photo-1571008887538-b36bb32f4571?w=900&q=85";
  };

  const getDateParts = (date = "") => {
    const raw = date.toString();
    const months = {
      janeiro: "JAN", jan: "JAN", fevereiro: "FEV", fev: "FEV", marco: "MAR", março: "MAR", mar: "MAR", abril: "ABR", abr: "ABR",
      maio: "MAI", mai: "MAI", junho: "JUN", jun: "JUN", julho: "JUL", jul: "JUL", agosto: "AGO", ago: "AGO",
      setembro: "SET", set: "SET", outubro: "OUT", out: "OUT", novembro: "NOV", nov: "NOV", dezembro: "DEZ", dez: "DEZ"
    };
    const normalized = normalizeEventText(raw);
    const foundMonth = Object.keys(months).find((m) => normalized.includes(m));
    const numbers = raw.match(/\d+/g) || [];
    const year = numbers.find((n) => n.length === 4) || "";
    const days = numbers.filter((n) => n.length !== 4).slice(0, 2);
    return {
      day: days.length > 1 ? `${days[0]} e ${days[1]}` : (days[0] || raw),
      month: foundMonth ? months[foundMonth] : "",
      year
    };
  };


  const parseDurationToSeconds = (duration = "") => {
    if (!duration) return 0;
    const parts = duration.toString().split(":").map(Number).filter(n => !Number.isNaN(n));
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    if (parts.length === 1) return parts[0];
    return 0;
  };

  const parsePaceToSeconds = (pace = "") => {
    const txt = pace.toString().toLowerCase();
    const match = txt.match(/(\d+)[\'min:]\s*(\d{1,2})?/);
    if (!match) return 0;
    return Number(match[1]) * 60 + Number(match[2] || 0);
  };

  const formatSecondsLabel = (seconds) => {
    if (!seconds) return "00:00";
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const sec = Math.floor(seconds % 60);
    if (h > 0) return `${h}h ${String(m).padStart(2, "0")}m`;
    return `${m}min`;
  };

  const myActivities = activities.filter((a) => a.user_id === user.id);
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - 6);
  weekStart.setHours(0, 0, 0, 0);
  const weekActivities = myActivities.filter((a) => new Date(a.created_at || Date.now()) >= weekStart);
  const weekKm = weekActivities.reduce((sum, a) => sum + Number(a.distance || 0), 0);
  const weekSeconds = weekActivities.reduce((sum, a) => sum + parseDurationToSeconds(a.duration), 0);
  const weekPace = weekKm > 0 ? calcPace(weekKm, weekSeconds) : "--";
  const lastActivity = myActivities[0] || activities[0];
  const monthKm = Number(profile?.total_km || 0);
  const monthProgress = Math.min(100, (monthKm / monthGoal) * 100);
  const bestDistance = myActivities.length ? Math.max(...myActivities.map(a => Number(a.distance || 0))) : 0;
  const bestPaceSeconds = myActivities.map(a => parsePaceToSeconds(a.pace)).filter(Boolean).sort((a, b) => a - b)[0] || 0;
  const bestPaceLabel = bestPaceSeconds ? `${Math.floor(bestPaceSeconds / 60)}'${String(bestPaceSeconds % 60).padStart(2, "0")}/km` : "--";
  const dayLabels = ["S", "T", "Q", "Q", "S", "S", "D"];
  const weekBars = dayLabels.map((_, idx) => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + idx);
    const total = weekActivities
      .filter(a => {
        const ad = new Date(a.created_at || Date.now());
        return ad.toDateString() === d.toDateString();
      })
      .reduce((sum, a) => sum + Number(a.distance || 0), 0);
    return total;
  });
  const maxWeekBar = Math.max(...weekBars, 1);
  const rankingWeekStart = new Date();
  rankingWeekStart.setDate(rankingWeekStart.getDate() - 6);
  rankingWeekStart.setHours(0, 0, 0, 0);

  const rankingMonthStart = new Date();
  rankingMonthStart.setDate(rankingMonthStart.getDate() - 29);
  rankingMonthStart.setHours(0, 0, 0, 0);

  const rankingPool = (() => {
    if (rankingPeriod === "geral") {
      return (rankingUsers.length ? rankingUsers : [profile].filter(Boolean)).map((runner) => ({
        ...runner,
        rankingKm: Number(runner?.total_km || 0),
        rankingRaces: Number(runner?.races_count || 0),
      }));
    }

    const rankingStart = rankingPeriod === "mensal" ? rankingMonthStart : rankingWeekStart;
    const profilesById = new Map((rankingUsers || []).map((runner) => [runner.id, runner]));
    const aggregate = {};

    (rankingRecentActivities || []).forEach((activity) => {
      if (!activity?.user_id || new Date(activity.created_at || Date.now()) < rankingStart) return;
      const baseProfile = activity.profiles || profilesById.get(activity.user_id) || {};

      if (!aggregate[activity.user_id]) {
        aggregate[activity.user_id] = {
          id: activity.user_id,
          name: baseProfile?.name || "Corredor",
          handle: baseProfile?.handle || "",
          level: baseProfile?.level || "Iniciante",
          avatar_url: baseProfile?.avatar_url || null,
          total_km: Number(baseProfile?.total_km || 0),
          races_count: Number(baseProfile?.races_count || 0),
          rankingKm: 0,
          rankingRaces: 0,
        };
      }

      aggregate[activity.user_id].rankingKm += Number(activity.distance || 0);
      aggregate[activity.user_id].rankingRaces += 1;
    });

    return Object.values(aggregate);
  })();

  const rankedRunners = [...rankingPool].sort((a, b) => rankingMode === "corridas"
    ? Number(b?.rankingRaces || 0) - Number(a?.rankingRaces || 0)
    : Number(b?.rankingKm || 0) - Number(a?.rankingKm || 0)
  );

  const podiumRunners = rankedRunners.slice(0, 3);
  const visibleRankedRunners = rankedRunners.slice(0, 5);
  const currentRankingIndex = rankedRunners.findIndex((runner) => runner?.id === user.id);
  const currentRankingPosition = currentRankingIndex >= 0 ? currentRankingIndex + 1 : null;
  const currentRankingRunner = currentRankingIndex >= 0
    ? rankedRunners[currentRankingIndex]
    : {
        ...(profile || {}),
        id: user.id,
        rankingKm: 0,
        rankingRaces: 0,
      };
  const currentRankingLabel = rankingMode === "corridas"
    ? `${Number(currentRankingRunner?.rankingRaces || 0)} corridas`
    : `${Number(currentRankingRunner?.rankingKm || 0).toFixed(1).replace(".", ",")} km`;

  const summaryRouteSnapshot = createRouteSnapshotDataUrl(completedRunRoute);
  const hasSummaryRouteSnapshot = Boolean(summaryRouteSnapshot);
  const isSummaryTooShortForFeed = runSummary?.type === "Atividade curta" || !hasSummaryRouteSnapshot;

  const SkeletonBlock = ({ width = "100%", height = 14, radius = 999, style = {} }) => (
    <div className="skeleton-block" style={{ width, height, borderRadius: radius, ...style }} />
  );

  const SkeletonCircle = ({ size = 44, style = {} }) => (
    <SkeletonBlock width={size} height={size} radius="50%" style={{ flexShrink: 0, ...style }} />
  );

  const PostSkeleton = ({ withImage = true }) => (
    <div style={{ background: "linear-gradient(180deg, rgba(255,255,255,0.052), rgba(255,255,255,0.025))", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 22, padding: 16, marginBottom: 14 }}>
      <div style={{ display: "flex", gap: 11, alignItems: "center", marginBottom: 14 }}>
        <SkeletonCircle size={44} />
        <div style={{ flex: 1 }}>
          <SkeletonBlock width="42%" height={13} style={{ marginBottom: 8 }} />
          <SkeletonBlock width="58%" height={10} />
        </div>
      </div>
      <SkeletonBlock width="92%" height={12} style={{ marginBottom: 8 }} />
      <SkeletonBlock width="68%" height={12} style={{ marginBottom: withImage ? 14 : 18 }} />
      {withImage && <SkeletonBlock width="100%" height={164} radius={16} style={{ marginBottom: 14 }} />}
      <div style={{ display: "flex", gap: 18 }}>
        <SkeletonBlock width={42} height={14} />
        <SkeletonBlock width={42} height={14} />
        <SkeletonBlock width={30} height={14} style={{ marginLeft: "auto" }} />
      </div>
    </div>
  );

  const EventSkeleton = () => (
    <>
      <SkeletonBlock width="100%" height={238} radius={24} style={{ marginBottom: 18 }} />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <SkeletonBlock width="42%" height={16} />
        <SkeletonBlock width={56} height={11} />
      </div>
      {[0, 1].map((i) => (
        <div key={i} style={{ display: "grid", gridTemplateColumns: "86px 1fr", gap: 14, background: "linear-gradient(180deg, rgba(255,255,255,0.045), rgba(255,255,255,0.025))", borderRadius: 22, padding: 14, border: "1px solid rgba(255,255,255,0.10)", marginBottom: 14 }}>
          <SkeletonBlock width={86} height={92} radius={16} />
          <div>
            <SkeletonBlock width="48%" height={10} style={{ marginBottom: 10 }} />
            <SkeletonBlock width="86%" height={14} style={{ marginBottom: 9 }} />
            <SkeletonBlock width="62%" height={11} style={{ marginBottom: 14 }} />
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
              <SkeletonBlock width="44%" height={12} />
              <SkeletonBlock width={86} height={34} radius={12} />
            </div>
          </div>
        </div>
      ))}
    </>
  );

  const StoriesSkeleton = () => (
    <div style={{ display: "flex", gap: 13, overflow: "hidden", padding: "2px 2px 4px", marginBottom: 22 }}>
      {[0, 1, 2, 3].map((i) => (
        <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, flexShrink: 0 }}>
          <SkeletonCircle size={58} />
          <SkeletonBlock width={46} height={10} />
        </div>
      ))}
    </div>
  );

  const SuggestionsSkeleton = () => (
    <div style={{ display: "flex", gap: 10, overflow: "hidden", paddingBottom: 4, marginBottom: 22 }}>
      {[0, 1, 2].map((i) => (
        <div key={i} style={{ width: 112, flexShrink: 0, background: "linear-gradient(180deg, rgba(255,255,255,0.055), rgba(255,255,255,0.025))", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 18, padding: "14px 10px", display: "flex", flexDirection: "column", alignItems: "center" }}>
          <SkeletonCircle size={54} style={{ marginBottom: 8 }} />
          <SkeletonBlock width={58} height={11} style={{ marginBottom: 7 }} />
          <SkeletonBlock width={68} height={10} style={{ marginBottom: 12 }} />
          <SkeletonBlock width="100%" height={32} radius={999} />
        </div>
      ))}
    </div>
  );

  const HubSkeleton = () => (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <SkeletonBlock width="100%" height={236} radius={26} />
      <SkeletonBlock width="100%" height={252} radius={24} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <SkeletonBlock width="100%" height={210} radius={22} />
        <SkeletonBlock width="100%" height={210} radius={22} />
      </div>
      <SkeletonBlock width="100%" height={154} radius={22} />
      <SkeletonBlock width="100%" height={190} radius={22} />
    </div>
  );

  const ProfileSkeleton = () => (
    <>
      <SkeletonBlock width="100%" height={446} radius={26} style={{ marginBottom: 14 }} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 14 }}>
        {[0, 1, 2, 3].map((i) => <SkeletonBlock key={i} width="100%" height={38} radius={12} />)}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 4 }}>
        {[0, 1, 2, 3, 4, 5].map((i) => <SkeletonBlock key={i} width="100%" height={118} radius={6} />)}
      </div>
    </>
  );

  const ClubsSkeleton = () => (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {[0, 1, 2].map((i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, background: "#13131a", border: "1px solid #1e1e2e", borderRadius: 18, padding: 14 }}>
          <SkeletonBlock width={58} height={58} radius={16} />
          <div style={{ flex: 1 }}>
            <SkeletonBlock width="48%" height={13} style={{ marginBottom: 8 }} />
            <SkeletonBlock width="72%" height={11} style={{ marginBottom: 8 }} />
            <SkeletonBlock width="40%" height={10} />
          </div>
          <SkeletonBlock width={74} height={36} radius={12} />
        </div>
      ))}
    </div>
  );

  const NotificationsSkeleton = () => (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {[0, 1, 2, 3].map((i) => (
        <div key={i} style={{ display: "flex", gap: 11, alignItems: "center", paddingBottom: 14, borderBottom: "1px solid #1e1e2e" }}>
          <SkeletonCircle size={44} />
          <div style={{ flex: 1 }}>
            <SkeletonBlock width="88%" height={12} style={{ marginBottom: 8 }} />
            <SkeletonBlock width="38%" height={10} />
          </div>
          <SkeletonBlock width={24} height={24} radius={8} />
        </div>
      ))}
    </div>
  );

  return (
    <div style={{ background: "#0a0a0f", minHeight: "100vh", fontFamily: "'DM Sans', sans-serif", color: "#f0f0f0", display: "flex", justifyContent: "center" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&family=Space+Grotesk:wght@700;800&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { display: none; }
        body { background: #0a0a0f; margin: 0; }
        .card { background: #13131a; border-radius: 16px; padding: 16px; border: 1px solid #1e1e2e; }
        .sbox { background: #1a1a24; border-radius: 10px; padding: 10px 12px; flex: 1; text-align: center; }
        .jbtn { background: #e11d48; color: #fff; border: none; border-radius: 10px; padding: 8px 16px; font-size: 12px; font-weight: 700; cursor: pointer; font-family: inherit; }
        .lbtn { background: none; border: none; cursor: pointer; display: flex; align-items: center; gap: 5px; color: #555; font-size: 13px; padding: 0; font-family: inherit; }
        .tinput { width: 100%; background: #13131a; border: 1.5px solid #1e1e2e; border-radius: 12px; padding: 12px 16px; color: #f0f0f0; font-size: 14px; font-family: inherit; outline: none; resize: none; }
        .tinput:focus { border-color: #e11d48; }
        .tinput::placeholder { color: #444; }
        @media (pointer: coarse) {
          input, textarea, select, .tinput {
            font-size: 16px !important;
          }
        }
        .bnav { position: fixed; bottom: 0; left: 50%; transform: translateX(-50%); width: 100%; max-width: 390px; background: rgba(10,10,15,0.92); backdrop-filter: blur(24px); -webkit-backdrop-filter: blur(24px); border-top: 1px solid rgba(255,255,255,0.08); display: grid; grid-template-columns: repeat(5, 1fr); align-items: center; padding: 10px 4px max(18px, calc(env(safe-area-inset-bottom) + 10px)); z-index: 100; }
        .nbtn { background: none; border: none; cursor: pointer; display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 4px 8px; font-family: inherit; min-width: 0; }
        .post-sep { border: none; border-top: 1px solid #1e1e2e; margin: 0; }
        .skeleton-block {
          background: linear-gradient(90deg, rgba(255,255,255,0.045) 0%, rgba(255,255,255,0.10) 45%, rgba(255,255,255,0.045) 100%);
          background-size: 220% 100%;
          animation: skeletonShimmer 1.35s ease-in-out infinite;
          border: 1px solid rgba(255,255,255,0.055);
        }
        @keyframes skeletonShimmer {
          0% { background-position: 100% 0; }
          100% { background-position: -120% 0; }
        }
        @keyframes onboardingFloat {
          0%, 100% { transform: translateY(0px) rotate(var(--tilt, 0deg)); }
          50% { transform: translateY(-8px) rotate(var(--tilt, 0deg)); }
        }
        @keyframes onboardingPulse {
          0%, 100% { opacity: 0.72; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.045); }
        }
      `}</style>

      <div
        onTouchStart={handlePullStart}
        onTouchMove={handlePullMove}
        onTouchEnd={handlePullEnd}
        onTouchCancel={handlePullEnd}
        style={{ width: "100%", maxWidth: 390, minHeight: "100vh", touchAction: "pan-y" }}
      >
        {(pullDistance > 0 || isRefreshing || refreshMessage) && (
          <div style={{
            position: "fixed",
            top: 76,
            left: "50%",
            transform: `translateX(-50%) translateY(${Math.min(pullDistance / 3, 24)}px)`,
            zIndex: 190,
            background: "rgba(19,19,26,0.96)",
            border: "1px solid #252536",
            boxShadow: "0 18px 46px rgba(0,0,0,0.36)",
            borderRadius: 999,
            padding: "10px 14px",
            display: "flex",
            alignItems: "center",
            gap: 9,
            minWidth: 154,
            justifyContent: "center",
            pointerEvents: "none",
          }}>
            <span style={{ color: "#e11d48", fontSize: 15, display: "inline-block", transform: isRefreshing ? "rotate(360deg)" : "none", transition: "transform 0.8s linear" }}>↻</span>
            <span style={{ fontSize: 12, fontWeight: 800, color: "#f0f0f0", whiteSpace: "nowrap" }}>
              {isRefreshing ? "Atualizando..." : refreshMessage || (pullDistance >= 72 ? "Solte para atualizar" : "Puxe para atualizar")}
            </span>
          </div>
        )}

        {/* Modal onboarding */}
        {showOnboarding && (
          <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "#0a0a0f", zIndex: 500, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 28 }}>
            <div style={{ width: "100%", maxWidth: 360 }}>
              <div style={{ textAlign: "center", marginBottom: 36 }}>
                <p style={{ fontSize: 48, marginBottom: 12 }}>🏃</p>
                <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 26, fontWeight: 800, marginBottom: 8 }}>Bem-vindo ao eu<span style={{ color: "#e11d48" }}>corredor</span></h1>
                <p style={{ fontSize: 13, color: "#555" }}>Antes de começar, confirme seus dados.</p>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div>
                  <p style={{ fontSize: 11, color: "#555", marginBottom: 6, fontWeight: 700 }}>Seu nome</p>
                  <input className="tinput" placeholder="Como quer ser chamado?" value={onboardingForm.name} onChange={(e) => setOnboardingForm(f => ({ ...f, name: e.target.value }))} />
                </div>
                <div>
                  <p style={{ fontSize: 11, color: "#555", marginBottom: 6, fontWeight: 700 }}>Seu @handle único</p>
                  <div style={{ position: "relative" }}>
                    <span style={{ position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)", color: "#555", fontSize: 14 }}>@</span>
                    <input className="tinput" style={{ paddingLeft: 28 }} placeholder="seuhandle" value={onboardingForm.handle} onChange={(e) => setOnboardingForm(f => ({ ...f, handle: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "") }))} />
                  </div>
                  <p style={{ fontSize: 11, color: "#555", marginTop: 5 }}>Somente letras minúsculas, números e _</p>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginTop: 20 }}>
                <div onClick={() => setOnboardingForm(f => ({ ...f, terms: !f.terms }))} style={{ width: 20, height: 20, borderRadius: 5, border: `2px solid ${onboardingForm.terms ? "#e11d48" : "#1e1e2e"}`, background: onboardingForm.terms ? "#e11d48" : "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0, marginTop: 1 }}>
                  {onboardingForm.terms && <span style={{ color: "#fff", fontSize: 12, fontWeight: 700 }}>✓</span>}
                </div>
                <p style={{ fontSize: 12, color: "#888", lineHeight: 1.5 }}>
                  Li e aceito os <a href="/termos" target="_blank" style={{ color: "#e11d48", textDecoration: "none" }}>Termos de uso</a> e a <a href="/privacidade" target="_blank" style={{ color: "#e11d48", textDecoration: "none" }}>Política de privacidade</a>
                </p>
              </div>
              <button onClick={handleOnboarding} style={{ width: "100%", background: "#e11d48", color: "#fff", border: "none", borderRadius: 14, padding: 16, fontSize: 15, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", marginTop: 16 }}>
                Entrar no eucorredor
              </button>
            </div>
          </div>
        )}


        {showProductOnboarding && !showOnboarding && (
          <div style={{ position: "fixed", inset: 0, zIndex: 760, background: "radial-gradient(circle at 50% 10%, rgba(225,29,72,0.18), transparent 34%), #08080f", display: "flex", justifyContent: "center", alignItems: "flex-start", overflow: "hidden", padding: "max(12px, env(safe-area-inset-top)) 14px max(12px, env(safe-area-inset-bottom))" }}>
            <div style={{ width: "100%", maxWidth: 390, height: "calc(100dvh - 24px - env(safe-area-inset-top) - env(safe-area-inset-bottom))", maxHeight: 920, borderRadius: 34, border: "1px solid rgba(255,255,255,0.14)", background: "linear-gradient(180deg, rgba(13,13,21,0.98), rgba(8,8,14,0.98))", boxShadow: "0 30px 110px rgba(0,0,0,0.72), inset 0 1px 0 rgba(255,255,255,0.06)", padding: "20px 20px 18px", display: "flex", flexDirection: "column", position: "relative", overflow: "hidden" }}>
              <div style={{ position: "absolute", inset: 0, pointerEvents: "none", background: "radial-gradient(circle at 78% 76%, rgba(225,29,72,0.16), transparent 28%), radial-gradient(circle at 12% 92%, rgba(225,29,72,0.09), transparent 24%)" }} />

              <div style={{ position: "relative", zIndex: 1, display: "flex", alignItems: "center", justifyContent: "space-between", minHeight: 34 }}>
                <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 20, fontWeight: 800, letterSpacing: -0.5 }}>eu<span style={{ color: "#e11d48" }}>corredor</span></div>
                {productOnboardingStep < 4 ? (
                  <button onClick={finishProductOnboarding} style={{ background: "none", border: "none", color: "#777", fontSize: 12, fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}>Pular</button>
                ) : <span />}
              </div>

              <div style={{ position: "relative", zIndex: 1, flex: 1, minHeight: 0, display: "flex", flexDirection: "column", justifyContent: "space-between", paddingTop: 20, overflowY: "auto", overflowX: "hidden", WebkitOverflowScrolling: "touch", paddingRight: 2, scrollbarWidth: "none" }}>
                {productOnboardingStep === 0 && (
                  <>
                    <div>
                      <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 35, lineHeight: 0.98, letterSpacing: -1.45, marginBottom: 12 }}>Tudo da corrida<br/>em <span style={{ color: "#e11d48" }}>um só lugar.</span></h2>
                      <p style={{ color: "#c7c7d1", fontSize: 14, lineHeight: 1.6, maxWidth: 330 }}>Encontre provas, registre treinos e faça parte da comunidade que corre com você.</p>
                    </div>
                    <div style={{ position: "relative", height: 330, margin: "26px 0 18px" }}>
                      <div style={{ '--tilt': '-7deg', position: "absolute", left: 4, top: 10, width: 174, borderRadius: 22, padding: 15, background: "linear-gradient(180deg, rgba(255,255,255,0.07), rgba(255,255,255,0.03))", border: "1px solid rgba(225,29,72,0.26)", animation: "onboardingFloat 4.4s ease-in-out infinite", boxShadow: "0 18px 50px rgba(0,0,0,0.28)" }}>
                        <p style={{ color: "#ff4169", fontSize: 10, fontWeight: 900, letterSpacing: 0.7, marginBottom: 10 }}>EVENTOS</p>
                        <p style={{ fontSize: 12, color: "#aaa", marginBottom: 5 }}>27 abr</p>
                        <p style={{ fontWeight: 900, fontSize: 14, lineHeight: 1.2 }}>Maratona de Porto Alegre</p>
                        <p style={{ color: "#e11d48", fontSize: 12, fontWeight: 900, marginTop: 10 }}>42K</p>
                      </div>
                      <div style={{ '--tilt': '5deg', position: "absolute", right: 8, top: 24, width: 178, borderRadius: 22, padding: 15, background: "linear-gradient(180deg, rgba(255,255,255,0.07), rgba(255,255,255,0.03))", border: "1px solid rgba(255,255,255,0.11)", animation: "onboardingFloat 4.9s ease-in-out infinite", boxShadow: "0 18px 50px rgba(0,0,0,0.28)" }}>
                        <p style={{ color: "#ff4169", fontSize: 10, fontWeight: 900, letterSpacing: 0.7, marginBottom: 10 }}>HUB / GPS</p>
                        <p style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 24, fontWeight: 800, marginBottom: 10 }}>8,42 km</p>
                        <div style={{ height: 58, borderRadius: 16, background: "rgba(0,0,0,0.28)", border: "1px solid rgba(255,255,255,0.08)", position: "relative", overflow: "hidden" }}>
                          <div style={{ position: "absolute", left: 18, bottom: 12, width: 100, height: 38, borderLeft: "4px solid #e11d48", borderBottom: "4px solid #e11d48", transform: "skewX(-20deg)", borderRadius: "0 0 0 18px" }} />
                          <div style={{ position: "absolute", right: 18, top: 12, width: 12, height: 12, borderRadius: "50%", background: "#fff", border: "3px solid #e11d48" }} />
                        </div>
                      </div>
                      <div style={{ '--tilt': '-4deg', position: "absolute", left: 18, bottom: 26, width: 182, borderRadius: 22, padding: 15, background: "linear-gradient(180deg, rgba(255,255,255,0.07), rgba(255,255,255,0.03))", border: "1px solid rgba(255,255,255,0.11)", animation: "onboardingFloat 5.2s ease-in-out infinite", boxShadow: "0 18px 50px rgba(0,0,0,0.28)" }}>
                        <p style={{ color: "#ff4169", fontSize: 10, fontWeight: 900, letterSpacing: 0.7, marginBottom: 10 }}>COMUNIDADE</p>
                        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                          {[0,1,2].map((n) => <div key={n} style={{ width: 32, height: 32, borderRadius: "50%", border: "2px solid #e11d48", background: "rgba(225,29,72,0.18)" }} />)}
                          <span style={{ fontSize: 11, color: "#9b9ba7", fontWeight: 800 }}>+124</span>
                        </div>
                        <p style={{ marginTop: 12, color: "#6ee7b7", fontSize: 11, fontWeight: 900 }}>● 21 online</p>
                      </div>
                      <div style={{ '--tilt': '4deg', position: "absolute", right: 6, bottom: 8, width: 174, borderRadius: 22, padding: 15, background: "linear-gradient(180deg, rgba(255,255,255,0.07), rgba(255,255,255,0.03))", border: "1px solid rgba(255,255,255,0.11)", animation: "onboardingFloat 4.6s ease-in-out infinite", boxShadow: "0 18px 50px rgba(0,0,0,0.28)" }}>
                        <p style={{ color: "#ff4169", fontSize: 10, fontWeight: 900, letterSpacing: 0.7, marginBottom: 10 }}>CLUBES</p>
                        <p style={{ fontSize: 14, fontWeight: 900, marginBottom: 5 }}>Runners POA</p>
                        <p style={{ color: "#9b9ba7", fontSize: 12 }}>248 membros</p>
                      </div>
                      <div style={{ position: "absolute", left: -14, right: -14, bottom: -12, height: 72, background: "radial-gradient(circle at 50% 20%, rgba(225,29,72,0.48), transparent 62%)", opacity: 0.66, filter: "blur(8px)" }} />
                    </div>
                  </>
                )}

                {productOnboardingStep === 1 && (
                  <>
                    <div>
                      <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 35, lineHeight: 0.98, letterSpacing: -1.45, marginBottom: 12 }}>Descubra sua<br/><span style={{ color: "#e11d48" }}>próxima prova.</span></h2>
                      <p style={{ color: "#c7c7d1", fontSize: 14, lineHeight: 1.6 }}>Veja datas, distâncias e links de inscrição em um calendário feito para corredores.</p>
                    </div>
                    <div style={{ marginTop: 26, borderRadius: 28, border: "1px solid rgba(255,255,255,0.12)", background: "linear-gradient(180deg, rgba(255,255,255,0.055), rgba(255,255,255,0.022))", padding: 16, boxShadow: "0 24px 64px rgba(0,0,0,0.34)" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                        <p style={{ fontSize: 15, fontWeight: 900 }}>Corridas</p>
                        <div style={{ width: 30, height: 30, borderRadius: "50%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>⌕</div>
                      </div>
                      <div style={{ display: "flex", gap: 7, overflow: "hidden", marginBottom: 14 }}>
                        {['Todos','3K','5K','10K','21K'].map((chip, index) => <span key={chip} style={{ flexShrink: 0, borderRadius: 999, padding: "7px 10px", fontSize: 10, fontWeight: 900, background: index === 0 ? "#e11d48" : "rgba(255,255,255,0.04)", border: index === 0 ? "1px solid rgba(255,255,255,0.18)" : "1px solid rgba(255,255,255,0.08)" }}>{chip}</span>)}
                      </div>
                      <div style={{ borderRadius: 24, padding: 16, background: "linear-gradient(135deg, rgba(225,29,72,0.19), rgba(0,0,0,0.46)), radial-gradient(circle at 84% 20%, rgba(225,29,72,0.32), transparent 31%)", border: "1px solid rgba(225,29,72,0.28)", minHeight: 238, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                        <div>
                          <span style={{ display: "inline-flex", borderRadius: 999, padding: "6px 10px", border: "1px solid #e11d48", color: "#fff", fontSize: 10, fontWeight: 900, marginBottom: 14 }}>★ DESTAQUE</span>
                          <p style={{ color: "#ff4169", fontSize: 12, fontWeight: 900, marginBottom: 7 }}>31 MAI 2026</p>
                          <p style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 25, lineHeight: 1.08, letterSpacing: -0.8, fontWeight: 800 }}>Maratona Internacional de Porto Alegre</p>
                          <p style={{ marginTop: 8, color: "#c7c7d1", fontSize: 12 }}>⌖ Porto Alegre, RS</p>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                          <div style={{ display: "flex", gap: 7 }}>
                            {['42K','21K','10K'].map((d) => <span key={d} style={{ padding: "7px 9px", borderRadius: 999, background: "rgba(0,0,0,0.30)", border: "1px solid rgba(255,255,255,0.12)", fontSize: 10, fontWeight: 900 }}>{d}</span>)}
                          </div>
                          <button style={{ background: "linear-gradient(135deg,#e11d48,#ff4169)", color: "#fff", border: "none", borderRadius: 999, padding: "11px 14px", fontSize: 11, fontWeight: 900, fontFamily: "inherit" }}>Inscrever</button>
                        </div>
                      </div>
                      <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
                        <div style={{ height: 52, borderRadius: 18, background: "rgba(255,255,255,0.035)", border: "1px solid rgba(255,255,255,0.08)" }} />
                        <div style={{ height: 52, borderRadius: 18, background: "rgba(255,255,255,0.035)", border: "1px solid rgba(255,255,255,0.08)" }} />
                      </div>
                    </div>
                  </>
                )}

                {productOnboardingStep === 2 && (
                  <>
                    <div>
                      <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 35, lineHeight: 0.98, letterSpacing: -1.45, marginBottom: 12 }}>Corra. O <span style={{ color: "#e11d48" }}>app cuida<br/>do resto.</span></h2>
                      <p style={{ color: "#c7c7d1", fontSize: 14, lineHeight: 1.6 }}>Registre distância, tempo, pace e publique seu percurso automaticamente.</p>
                    </div>
                    <div style={{ marginTop: 25, borderRadius: 28, border: "1px solid rgba(255,255,255,0.12)", background: "linear-gradient(180deg, rgba(255,255,255,0.055), rgba(255,255,255,0.022))", padding: 15 }}>
                      <div style={{ borderRadius: 24, minHeight: 242, background: "linear-gradient(180deg, rgba(0,0,0,0.26), rgba(0,0,0,0.62)), radial-gradient(circle at 82% 15%, rgba(225,29,72,0.24), transparent 28%)", border: "1px solid rgba(255,255,255,0.08)", padding: 15, position: "relative", overflow: "hidden" }}>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 10px", borderRadius: 999, background: "rgba(0,0,0,0.28)", border: "1px solid rgba(255,255,255,0.12)", color: "#6ee7b7", fontSize: 10, fontWeight: 900 }}>● GPS</span>
                        <p style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 33, fontWeight: 800, letterSpacing: -1, marginTop: 12 }}>7,36 <span style={{ fontSize: 17 }}>km</span></p>
                        <p style={{ fontSize: 23, fontWeight: 900, marginTop: 4 }}>00:38:42</p>
                        <p style={{ fontSize: 17, color: "#ddd", marginTop: 4 }}>5'16” <span style={{ color: "#8e8e9c", fontSize: 12 }}>/km</span></p>
                        <div style={{ position: "absolute", right: 14, top: 30, width: 156, height: 150 }}>
                          <div style={{ position: "absolute", left: 8, bottom: 22, width: 124, height: 92, borderLeft: "4px solid #e11d48", borderBottom: "4px solid #e11d48", transform: "skewX(-24deg) rotate(-8deg)", borderRadius: "0 0 0 22px" }} />
                          <div style={{ position: "absolute", right: 12, top: 6, width: 15, height: 15, borderRadius: "50%", background: "#fff", border: "4px solid #e11d48" }} />
                          <div style={{ position: "absolute", left: 14, bottom: 18, width: 14, height: 14, borderRadius: "50%", background: "#6ee7b7", border: "3px solid #fff" }} />
                        </div>
                        <div style={{ position: "absolute", left: 15, right: 15, bottom: 14, display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
                          {[['ritmo','5’16”'],['elevação','48 m'],['calorias','512']].map(([label, value]) => <div key={label} style={{ borderRadius: 14, padding: "9px 7px", background: "rgba(0,0,0,0.34)", border: "1px solid rgba(255,255,255,0.08)" }}><p style={{ color: "#777", fontSize: 9, marginBottom: 4 }}>{label}</p><p style={{ fontSize: 11, fontWeight: 900 }}>{value}</p></div>)}
                        </div>
                      </div>
                      <div style={{ marginTop: 12, borderRadius: 20, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.035)", padding: 12 }}>
                        <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 9 }}>
                          <div style={{ width: 34, height: 34, borderRadius: "50%", background: "rgba(225,29,72,0.18)", border: "1px solid rgba(225,29,72,0.28)" }} />
                          <div><p style={{ fontSize: 12, fontWeight: 900 }}>João Silva</p><p style={{ color: "#8e8e9c", fontSize: 10 }}>Treino leve de terça! ☀️</p></div>
                        </div>
                        <p style={{ color: "#a9a9b5", fontSize: 11 }}>7,36 km · 38:42 · 5’16”/km</p>
                      </div>
                    </div>
                  </>
                )}

                {productOnboardingStep === 3 && (
                  <>
                    <div>
                      <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 35, lineHeight: 0.98, letterSpacing: -1.45, marginBottom: 12 }}>Compartilhe e<br/><span style={{ color: "#e11d48" }}>corra junto.</span></h2>
                      <p style={{ color: "#c7c7d1", fontSize: 14, lineHeight: 1.6 }}>Publique momentos, siga corredores e participe de clubes com avisos e treinos.</p>
                    </div>
                    <div style={{ marginTop: 24, display: "grid", gap: 12 }}>
                      <div style={{ borderRadius: 24, padding: 15, border: "1px solid rgba(255,255,255,0.11)", background: "linear-gradient(180deg, rgba(255,255,255,0.055), rgba(255,255,255,0.022))" }}>
                        <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 12 }}>
                          <div style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(225,29,72,0.18)", border: "1px solid rgba(225,29,72,0.28)" }} />
                          <div><p style={{ fontSize: 12, fontWeight: 900 }}>Marina Costa</p><p style={{ color: "#8e8e9c", fontSize: 10 }}>Hoje às 08:32 · Porto Alegre, RS</p></div>
                        </div>
                        <p style={{ fontSize: 13, fontWeight: 800, marginBottom: 12 }}>Domingo de longão com o grupo! 🔥</p>
                        <div style={{ height: 96, borderRadius: 18, background: "linear-gradient(135deg, rgba(225,29,72,0.20), rgba(255,255,255,0.04))", border: "1px solid rgba(255,255,255,0.08)" }} />
                        <div style={{ display: "flex", gap: 14, color: "#a9a9b5", fontSize: 11, marginTop: 12 }}><span>♡ 128</span><span>◌ 18</span></div>
                      </div>
                      <div style={{ borderRadius: 24, padding: 15, border: "1px solid rgba(255,255,255,0.11)", background: "linear-gradient(180deg, rgba(255,255,255,0.055), rgba(255,255,255,0.022))" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", marginBottom: 12 }}>
                          <div><p style={{ fontSize: 13, fontWeight: 900 }}>Runners POA</p><p style={{ color: "#8e8e9c", fontSize: 10 }}>Clube · 248 membros</p></div>
                          <div style={{ padding: "7px 10px", borderRadius: 999, background: "rgba(225,29,72,0.14)", color: "#ff4169", border: "1px solid rgba(225,29,72,0.25)", fontSize: 10, fontWeight: 900 }}>Aviso</div>
                        </div>
                        <div style={{ borderRadius: 18, border: "1px solid rgba(225,29,72,0.20)", background: "rgba(225,29,72,0.08)", padding: 12 }}>
                          <p style={{ fontSize: 11, fontWeight: 900, color: "#ffd36b", marginBottom: 5 }}>Treino de tiros amanhã às 6h</p>
                          <p style={{ fontSize: 11, color: "#c7c7d1" }}>Chegue 15 min antes! 🚀</p>
                        </div>
                        <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 12 }}>
                          {[0,1,2,3,4].map((n) => <div key={n} style={{ width: 24, height: 24, borderRadius: "50%", border: "2px solid #6ee7b7", background: "rgba(110,231,183,0.18)" }} />)}
                          <span style={{ fontSize: 10, color: "#8e8e9c", fontWeight: 900 }}>+36 online</span>
                        </div>
                      </div>
                    </div>
                  </>
                )}

                {productOnboardingStep === 4 && (
                  <>
                    <div style={{ textAlign: "center", paddingTop: 28 }}>
                      <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 39, lineHeight: 0.98, letterSpacing: -1.7, marginBottom: 14 }}>Pronto para<br/><span style={{ color: "#e11d48" }}>começar?</span></h2>
                      <p style={{ color: "#c7c7d1", fontSize: 14, lineHeight: 1.6, maxWidth: 280, margin: "0 auto" }}>Crie sua rotina, encontre corridas e faça parte do eucorredor.</p>
                    </div>
                    <div style={{ position: "relative", height: 335, marginTop: 16, overflow: "hidden", borderRadius: 30, border: "1px solid rgba(255,255,255,0.08)", background: "linear-gradient(180deg, rgba(225,29,72,0.10), rgba(0,0,0,0.42)), radial-gradient(circle at 50% 36%, rgba(225,29,72,0.42), transparent 33%)" }}>
                      <div style={{ position: "absolute", left: "50%", top: 38, width: 230, height: 230, transform: "translateX(-50%)", borderRadius: "50%", border: "2px solid rgba(225,29,72,0.72)", boxShadow: "0 0 40px rgba(225,29,72,0.26)", animation: "onboardingPulse 3s ease-in-out infinite" }} />
                      <div style={{ position: "absolute", left: "50%", top: 95, transform: "translateX(-50%)", width: 54, height: 130, borderRadius: 999, background: "linear-gradient(180deg, rgba(255,255,255,0.72), rgba(255,255,255,0.10))", opacity: 0.20 }} />
                      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 120, background: "linear-gradient(180deg, transparent, rgba(225,29,72,0.28))" }} />
                      <div style={{ position: "absolute", left: -10, right: -10, bottom: 28, height: 4, background: "linear-gradient(90deg, transparent, #e11d48, transparent)", transform: "rotate(-7deg)", boxShadow: "0 0 24px rgba(225,29,72,0.78)" }} />
                      <div style={{ position: "absolute", left: -10, right: -10, bottom: 58, height: 3, background: "linear-gradient(90deg, transparent, rgba(225,29,72,0.76), transparent)", transform: "rotate(8deg)" }} />
                    </div>
                  </>
                )}

                <div style={{ position: "sticky", bottom: 0, zIndex: 5, paddingTop: 18, paddingBottom: 2, marginTop: 18, background: "linear-gradient(180deg, rgba(8,8,14,0), rgba(8,8,14,0.97) 26%)" }}>
                  <div style={{ display: "flex", justifyContent: "center", gap: 8, marginBottom: 18 }}>
                    {[0,1,2,3,4].map((dot) => <span key={dot} style={{ width: dot === productOnboardingStep ? 22 : 8, height: 8, borderRadius: 999, background: dot === productOnboardingStep ? "#e11d48" : "rgba(255,255,255,0.16)", transition: "all .2s ease" }} />)}
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: productOnboardingStep === 0 || productOnboardingStep === 4 ? "1fr" : "0.72fr 1.28fr", gap: 12 }}>
                    {productOnboardingStep > 0 && productOnboardingStep < 4 && (
                      <button onClick={goToPreviousProductOnboardingStep} style={{ minHeight: 54, borderRadius: 999, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.16)", color: "#fff", fontWeight: 900, fontSize: 14, fontFamily: "inherit", cursor: "pointer" }}>Voltar</button>
                    )}
                    <button onClick={goToNextProductOnboardingStep} style={{ minHeight: 54, borderRadius: 999, background: "linear-gradient(135deg,#e11d48,#ff4169)", border: "none", color: "#fff", fontWeight: 900, fontSize: 15, fontFamily: "inherit", cursor: "pointer", boxShadow: "0 18px 42px rgba(225,29,72,0.24)" }}>
                      {productOnboardingStep === 4 ? "Entrar no app →" : "Continuar →"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {showGpsPermissionModal && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.76)", backdropFilter: "blur(14px)", zIndex: 650, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
            <div style={{ width: "100%", maxWidth: 360, background: "linear-gradient(180deg, rgba(19,19,26,0.98), rgba(10,10,15,0.98))", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 26, padding: 22, boxShadow: "0 28px 80px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.06)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, marginBottom: 18 }}>
                <div style={{ width: 52, height: 52, borderRadius: 18, background: "rgba(225,29,72,0.16)", border: "1px solid rgba(225,29,72,0.30)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 25 }}>
                  📍
                </div>
                <button onClick={() => { setShowGpsPermissionModal(false); setCheckingGpsPermission(false); }} style={{ background: "none", border: "none", color: "#777", fontSize: 28, lineHeight: 1, cursor: "pointer" }}>×</button>
              </div>

              <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 25, lineHeight: 1.08, letterSpacing: -0.8, marginBottom: 10 }}>
                Permita o GPS para iniciar sua corrida
              </h2>

              <p style={{ color: "#b9b9c3", fontSize: 14, lineHeight: 1.55, marginBottom: 16 }}>
                O eucorredor precisa da sua localização para medir distância, tempo, pace e desenhar o percurso no mapa.
              </p>

              <div style={{ background: "rgba(255,255,255,0.045)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 18, padding: 14, marginBottom: 16 }}>
                <p style={{ color: "#fff", fontSize: 13, fontWeight: 900, marginBottom: 8 }}>No iPhone, se aparecer permissão negada:</p>
                <p style={{ color: "#8f8f9b", fontSize: 12.5, lineHeight: 1.55 }}>
                  Ajustes → Safari ou Chrome → Localização → Permitir. Depois volte aqui e toque em tentar novamente.
                </p>
              </div>

              {gpsError && (
                <p style={{ color: "#ff4d6d", background: "rgba(225,29,72,0.10)", border: "1px solid rgba(225,29,72,0.22)", borderRadius: 14, padding: "10px 12px", fontSize: 12.5, lineHeight: 1.45, marginBottom: 14 }}>
                  {gpsError}
                </p>
              )}

              <button onClick={requestGpsPermissionAndStart} disabled={checkingGpsPermission} style={{ width: "100%", height: 52, border: "none", borderRadius: 16, background: checkingGpsPermission ? "#3a1a22" : "linear-gradient(135deg, #e11d48, #ff3d63)", color: "#fff", fontSize: 14, fontWeight: 900, fontFamily: "inherit", cursor: checkingGpsPermission ? "not-allowed" : "pointer", boxShadow: checkingGpsPermission ? "none" : "0 14px 34px rgba(225,29,72,0.26)", marginBottom: 10 }}>
                {checkingGpsPermission ? "Solicitando permissão..." : "Permitir GPS e iniciar"}
              </button>

              <button onClick={() => { setShowGpsPermissionModal(false); setGpsError(""); }} style={{ width: "100%", height: 44, border: "1px solid rgba(255,255,255,0.10)", borderRadius: 14, background: "rgba(255,255,255,0.035)", color: "#aaa", fontSize: 13, fontWeight: 800, fontFamily: "inherit", cursor: "pointer" }}>
                Agora não
              </button>
            </div>
          </div>
        )}

        {/* Header */}
        <div style={{ padding: "16px 20px 16px", background: "linear-gradient(180deg, #0f0f18 0%, #0a0a0f 100%)", position: "sticky", top: 0, zIndex: 50 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "max(8px, env(safe-area-inset-top))", marginBottom: 0 }}>
            <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 24, fontWeight: 900, color: "#fff" }}>eu<span style={{ color: "#e11d48" }}>corredor</span></h1>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <button onClick={() => setShowSearch(!showSearch)} title="Buscar" style={{ width: 36, height: 36, borderRadius: "50%", background: "#13131a", border: "1px solid #1e1e2e", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#888" }}>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
              </button>
              <button onClick={() => { setShowNotifications(true); markAllRead(); }} title="Notificações" style={{ position: "relative", width: 36, height: 36, borderRadius: "50%", background: "#13131a", border: "1px solid #1e1e2e", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#888" }}>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
                {notifications.filter(n => !n.read).length > 0 && (
                  <span style={{ position: "absolute", top: 7, right: 7, minWidth: 15, height: 15, padding: "0 4px", background: "#e11d48", borderRadius: 999, border: "1.5px solid #0a0a0f", color: "#fff", fontSize: 9, fontWeight: 900, display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1 }}>
                    {notifications.filter(n => !n.read).length > 9 ? "9+" : notifications.filter(n => !n.read).length}
                  </span>
                )}
              </button>
              <button onClick={() => setTab("perfil")} title="Ver perfil" style={{ width: 36, height: 36, borderRadius: "50%", background: "#13131a", border: "1px solid #1e1e2e", padding: 0, cursor: "pointer", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} alt="Foto de perfil" style={{ width: 36, height: 36, borderRadius: "50%", objectFit: "cover", border: `2px solid ${level.color}` }} />
                ) : (
                  <div style={{ width: 36, height: 36, borderRadius: "50%", background: "#1e1e2e", border: `2px solid ${level.color}`, color: "#fff", fontSize: 14, fontWeight: 900, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {(profile?.name || userName || "C").charAt(0).toUpperCase()}
                  </div>
                )}
              </button>
              <button onClick={handleSignOut} title="Sair" style={{ background: "none", border: "1px solid #1e1e2e", borderRadius: 10, padding: "7px 10px", color: "#555", fontSize: 11, cursor: "pointer", fontFamily: "inherit", fontWeight: 700 }}>Sair</button>
            </div>
          </div>
        </div>

        {/* Bottom nav */}
        <nav className="bnav">
          {[
            { id: "eventos", label: "Eventos", svg: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg> },
            { id: "comunidade", label: "Feed", svg: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg> },
            { id: "publish", label: "", special: true },
            { id: "hub", label: "Hub", svg: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg> },
            { id: "perfil", label: "Perfil", svg: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> },
          ].map((t) => (
            <button key={t.id} className="nbtn"
              onClick={() => t.special ? setShowPublish(true) : setTab(t.id)}
              style={{ background: t.special ? "#e11d48" : "none", borderRadius: t.special ? "50%" : 0, width: t.special ? 54 : "100%", height: t.special ? 54 : "auto", marginTop: t.special ? -12 : 0, boxShadow: t.special ? "0 8px 24px rgba(225,29,72,0.38)" : "none", justifyContent: "center", justifySelf: "center", border: "none" }}>
              {t.special
                ? <svg width="22" height="22" viewBox="0 0 24 24" fill="#fff"><polygon points="12 4 22 20 2 20"/></svg>
                : <><span style={{ color: tab === t.id ? "#e11d48" : "#555" }}>{t.svg}</span><span style={{ fontSize: 10, fontWeight: 700, color: tab === t.id ? "#e11d48" : "#555" }}>{t.label}</span></>
              }
            </button>
          ))}
        </nav>

        <div style={{ padding: "20px", paddingBottom: "max(170px, calc(env(safe-area-inset-bottom) + 145px))" }}>

          {/* EVENTOS */}
          {tab === "eventos" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 14 }}>
                <div>
                  <h2 style={{ fontSize: 30, fontWeight: 900, letterSpacing: -1.2, lineHeight: 1.05, marginBottom: 8 }}>
                    Corridas no RS<span style={{ color: "#e11d48" }}>.</span>
                  </h2>
                  <p style={{ fontSize: 14, color: "#8b8b96", lineHeight: 1.45 }}>Encontre sua próxima prova.</p>
                </div>
                {user.id === ADMIN_ID && (
                  <button
                    onClick={() => setShowAdminEvents(true)}
                    title="Gerenciar eventos"
                    style={{
                      width: 52,
                      height: 52,
                      borderRadius: 18,
                      background: "rgba(255,255,255,0.045)",
                      border: "1px solid rgba(255,255,255,0.12)",
                      color: "#f0f0f0",
                      fontSize: 20,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06)",
                      flexShrink: 0
                    }}
                  >
                    ⚙
                  </button>
                )}
              </div>

              <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 2, marginLeft: -2, marginRight: -2 }}>
                {eventFilters.map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setEventFilter(filter)}
                    style={{
                      flex: "0 0 auto",
                      background: eventFilter === filter ? "linear-gradient(135deg, #e11d48, #ff3d63)" : "rgba(255,255,255,0.035)",
                      border: eventFilter === filter ? "1px solid rgba(255,255,255,0.18)" : "1px solid #1e1e2e",
                      color: eventFilter === filter ? "#fff" : "#c9c9d1",
                      borderRadius: 14,
                      padding: "11px 17px",
                      fontSize: 13,
                      fontWeight: 800,
                      cursor: "pointer",
                      fontFamily: "inherit",
                      boxShadow: eventFilter === filter ? "0 12px 26px rgba(225,29,72,0.22)" : "none"
                    }}
                  >
                    {filter}
                  </button>
                ))}
              </div>

              {loadingSections.events && <EventSkeleton />}

              {!loadingSections.events && dbEvents.length === 0 && (
                <EmptyState
                  icon="📅"
                  title="Ainda não há eventos cadastrados"
                  description="Assim que novas corridas entrarem na agenda, elas aparecem aqui para você explorar."
                />
              )}

              {!loadingSections.events && dbEvents.length > 0 && filteredEvents.length === 0 && (
                <EmptyState
                  icon="⌕"
                  title="Nenhuma prova neste filtro"
                  description="Tente outra distância para encontrar corridas disponíveis."
                  actionLabel="Ver todos"
                  onAction={() => setEventFilter("Todos")}
                />
              )}

              {!loadingSections.events && featuredEvent && (() => {
                const date = getDateParts(featuredEvent.date);
                return (
                  <div style={{
                    position: "relative",
                    overflow: "hidden",
                    borderRadius: 24,
                    padding: 20,
                    minHeight: 245,
                    border: "1px solid rgba(255,255,255,0.13)",
                    background: `linear-gradient(90deg, rgba(10,10,15,0.94), rgba(10,10,15,0.70), rgba(10,10,15,0.90)), url(${getEventImage(featuredEvent)}) center/cover`,
                    boxShadow: "0 22px 46px rgba(0,0,0,0.28), inset 0 1px 0 rgba(255,255,255,0.08)"
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 16, height: "100%", position: "relative", zIndex: 1 }}>
                      <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", minHeight: 205, maxWidth: 230 }}>
                        <div>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "#fff", border: "1px solid #e11d48", background: "rgba(225,29,72,0.10)", borderRadius: 10, padding: "7px 10px", fontSize: 11, fontWeight: 900, letterSpacing: 0.3, marginBottom: 18 }}>
                            ☆ DESTAQUE
                          </span>
                          <p style={{ fontWeight: 900, fontSize: 23, lineHeight: 1.12, letterSpacing: -0.8, marginBottom: 12 }}>{featuredEvent.name}</p>
                          <p style={{ fontSize: 14, color: "#b9b9c3", display: "flex", alignItems: "center", gap: 6 }}>
                            <span>⌖</span> {featuredEvent.city}, {featuredEvent.state}
                          </p>
                        </div>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 18 }}>
                          {(featuredEvent.distance || "").split(/,| e |\|/).map((dist, idx) => dist.trim()).filter(Boolean).map((dist, idx) => (
                            <span key={idx} style={{ border: "1px solid rgba(255,255,255,0.14)", background: "rgba(0,0,0,0.26)", color: "#fff", borderRadius: 999, padding: "8px 12px", fontSize: 13, fontWeight: 800 }}>{dist}</span>
                          ))}
                        </div>
                      </div>

                      <div style={{ width: 92, display: "flex", flexDirection: "column", alignItems: "flex-end", justifyContent: "space-between", gap: 14, flexShrink: 0 }}>
                        <div style={{ textAlign: "right", letterSpacing: 4, textTransform: "uppercase" }}>
                          <p style={{ color: "#a7a7b2", fontSize: 18, fontWeight: 800, marginBottom: 4 }}>{date.day}</p>
                          <p style={{ color: "#e11d48", fontSize: 40, fontWeight: 900, lineHeight: 0.9 }}>{date.month || ""}</p>
                          <p style={{ color: "#8a8a96", fontSize: 18, fontWeight: 800, marginTop: 8 }}>{date.year}</p>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          {user.id === ADMIN_ID && (
                            <button onClick={() => handleDeleteEvent(featuredEvent.id)} style={{ background: "rgba(0,0,0,0.35)", border: "1px solid rgba(255,255,255,0.12)", color: "#777", borderRadius: 12, width: 36, height: 36, cursor: "pointer", fontFamily: "inherit" }}>🗑️</button>
                          )}
                          {featuredEvent.race_event && user.id === ADMIN_ID ? (
                            <button
                              onClick={() => openRaceEventDetails(featuredEvent)}
                              style={{
                                background: "linear-gradient(135deg, #7c3aed, #a855f7)",
                                color: "#fff",
                                border: "none",
                                borderRadius: 14,
                                padding: "12px 17px",
                                fontSize: 13,
                                fontWeight: 900,
                                cursor: "pointer",
                                whiteSpace: "nowrap",
                                boxShadow: "0 12px 28px rgba(124,58,237,0.28)",
                                fontFamily: "inherit"
                              }}
                            >
                              Testar inscrição
                            </button>
                          ) : featuredEvent.link ? (
                            <a href={featuredEvent.link} target="_blank" rel="noopener noreferrer" style={{ background: "linear-gradient(135deg, #e11d48, #ff3d63)", color: "#fff", borderRadius: 14, padding: "12px 17px", fontSize: 13, fontWeight: 900, textDecoration: "none", whiteSpace: "nowrap", boxShadow: "0 12px 28px rgba(225,29,72,0.28)" }}>Inscrever</a>
                          ) : (
                            <button className="jbtn" style={{ opacity: 0.55, cursor: "not-allowed", borderRadius: 14, padding: "12px 17px", whiteSpace: "nowrap" }}>Em breve</button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {(loadingMyRaceRegistrations || myRaceRegistrations.length > 0) && (
                <div style={{ marginTop: 18, marginBottom: 18 }}>
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ marginBottom: 12 }}>
                      <h3 style={{ fontSize: 19, fontWeight: 900, letterSpacing: -0.4, marginBottom: 4 }}>
                        Minhas provas
                      </h3>
                      <p style={{ fontSize: 12.5, color: "#858591", fontWeight: 750 }}>
                        Inscrições e reservas feitas pelo EuCorredor.
                      </p>
                    </div>

                    <div
                      style={{
                        display: "flex",
                        gap: 8,
                        overflowX: "auto",
                        paddingBottom: 2
                      }}
                    >
                      {myRaceFilters.map((filter) => (
                        <button
                          key={filter}
                          type="button"
                          onClick={() => setMyRaceFilter(filter)}
                          style={{
                            flexShrink: 0,
                            border: myRaceFilter === filter
                              ? "1px solid rgba(255,61,99,0.72)"
                              : "1px solid rgba(255,255,255,0.10)",
                            background: myRaceFilter === filter
                              ? "linear-gradient(135deg, rgba(225,29,72,0.24), rgba(255,61,99,0.12))"
                              : "rgba(255,255,255,0.035)",
                            color: myRaceFilter === filter ? "#fff" : "#b9b9c5",
                            borderRadius: 999,
                            padding: "10px 13px",
                            fontSize: 12,
                            fontWeight: 900,
                            cursor: "pointer",
                            fontFamily: "inherit",
                            whiteSpace: "nowrap"
                          }}
                        >
                          {filter}
                        </button>
                      ))}
                    </div>
                  </div>

                  {loadingMyRaceRegistrations && (
                    <div
                      style={{
                        background: "rgba(255,255,255,0.04)",
                        border: "1px solid rgba(255,255,255,0.10)",
                        borderRadius: 22,
                        padding: 16,
                        color: "#b9b9c4",
                        fontSize: 13.5,
                        fontWeight: 800
                      }}
                    >
                      Carregando suas provas...
                    </div>
                  )}

                  {!loadingMyRaceRegistrations && myRaceRegistrations.length > 0 && filteredMyRaceRegistrations.length === 0 && (
                    <div
                      style={{
                        background: "rgba(255,255,255,0.04)",
                        border: "1px solid rgba(255,255,255,0.10)",
                        borderRadius: 22,
                        padding: 16,
                        color: "#b9b9c4",
                        fontSize: 13.5,
                        lineHeight: 1.45,
                        fontWeight: 800
                      }}
                    >
                      Nenhuma prova encontrada neste filtro.
                    </div>
                  )}

                  {!loadingMyRaceRegistrations && filteredMyRaceRegistrations.length > 0 && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                      {filteredMyRaceRegistrations.map((registration) => {
                        const event = registration.race_event?.base_event || {};
                        const isPending = isActivePendingRaceRegistration(registration);
                        const isConfirmed = registration.status === "confirmed";
                        const isExpired =
                          registration.status === "expired" ||
                          (
                            registration.status === "pending_payment" &&
                            !isActivePendingRaceRegistration(registration)
                          );

                        const remainingReservationMs = registration.reservation_expires_at
                          ? new Date(registration.reservation_expires_at).getTime() - Date.now()
                          : null;

                        const isExpiringSoon =
                          isPending &&
                          remainingReservationMs !== null &&
                          remainingReservationMs <= 3 * 60 * 1000;

                        const amount = Number.isFinite(registration.amount_cents)
                          ? (registration.amount_cents / 100).toLocaleString("pt-BR", {
                              style: "currency",
                              currency: "BRL"
                            })
                          : "—";

                        const reservationTime = registration.reservation_expires_at
                          ? new Date(registration.reservation_expires_at).toLocaleTimeString("pt-BR", {
                              hour: "2-digit",
                              minute: "2-digit"
                            })
                          : null;

                        return (
                          <div
                            key={registration.id}
                            style={{
                              background: isExpiringSoon
                                ? "linear-gradient(135deg, rgba(245,158,11,0.18), rgba(255,255,255,0.035))"
                                : isPending
                                  ? "linear-gradient(135deg, rgba(225,29,72,0.15), rgba(255,255,255,0.035))"
                                  : isConfirmed
                                    ? "linear-gradient(135deg, rgba(34,197,94,0.14), rgba(255,255,255,0.035))"
                                    : "linear-gradient(135deg, rgba(255,255,255,0.06), rgba(255,255,255,0.025))",
                              border: isExpiringSoon
                                ? "1px solid rgba(245,158,11,0.38)"
                                : isPending
                                  ? "1px solid rgba(255,61,99,0.28)"
                                  : isConfirmed
                                    ? "1px solid rgba(34,197,94,0.28)"
                                    : "1px solid rgba(255,255,255,0.14)",
                              borderRadius: 24,
                              padding: 16,
                              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05)"
                            }}
                          >
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 12 }}>
                              <div style={{ minWidth: 0 }}>
                                <span
                                  style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: 6,
                                    borderRadius: 999,
                                    padding: "6px 10px",
                                    fontSize: 10.5,
                                    fontWeight: 950,
                                    letterSpacing: 0.25,
                                    marginBottom: 10,
                                    color: isExpiringSoon ? "#fcd34d" : isPending ? "#ff8da3" : isConfirmed ? "#86efac" : "#c9c9d3",
                                    background: isExpiringSoon ? "rgba(245,158,11,0.15)" : isPending ? "rgba(225,29,72,0.14)" : isConfirmed ? "rgba(34,197,94,0.14)" : "rgba(255,255,255,0.08)",
                                    border: isExpiringSoon ? "1px solid rgba(252,211,77,0.34)" : isPending ? "1px solid rgba(255,61,99,0.32)" : isConfirmed ? "1px solid rgba(134,239,172,0.28)" : "1px solid rgba(255,255,255,0.16)"
                                  }}
                                >
                                  {isExpiringSoon ? "PAGAMENTO PENDENTE · URGENTE" : isPending ? "PAGAMENTO PENDENTE" : isConfirmed ? "INSCRIÇÃO CONFIRMADA" : isExpired ? "RESERVA EXPIRADA" : registration.status}
                                </span>

                                <p style={{ fontSize: 17, lineHeight: 1.18, fontWeight: 950, letterSpacing: -0.35, marginBottom: 6 }}>
                                  {event.name || "Prova"}
                                </p>

                                <p style={{ fontSize: 12.5, color: "#b6b6c2", fontWeight: 800 }}>
                                  {registration.modality?.name || "Modalidade"} · {registration.lot?.name || "Lote"}
                                </p>
                              </div>

                              <p style={{ fontSize: 19, color: "#fff", fontWeight: 950, whiteSpace: "nowrap" }}>
                                {amount}
                              </p>
                            </div>

                            <div
                              style={{
                                display: "grid",
                                gridTemplateColumns: "1fr 1fr",
                                gap: 10,
                                marginBottom: isPending ? 12 : 0
                              }}
                            >
                              <div
                                style={{
                                  background: "rgba(0,0,0,0.22)",
                                  border: "1px solid rgba(255,255,255,0.08)",
                                  borderRadius: 15,
                                  padding: "11px 12px"
                                }}
                              >
                                <p style={{ fontSize: 10.5, color: "#8f8f9d", fontWeight: 950, marginBottom: 5 }}>DATA</p>
                                <p style={{ fontSize: 12.5, color: "#f0f0f5", fontWeight: 900 }}>
                                  {event.date || "—"}
                                </p>
                              </div>

                              <div
                                style={{
                                  background: "rgba(0,0,0,0.22)",
                                  border: "1px solid rgba(255,255,255,0.08)",
                                  borderRadius: 15,
                                  padding: "11px 12px"
                                }}
                              >
                                <p style={{ fontSize: 10.5, color: "#8f8f9d", fontWeight: 950, marginBottom: 5 }}>
                                  {isPending ? "RESERVA ATÉ" : "LOCAL"}
                                </p>
                                <p style={{ fontSize: 12.5, color: "#f0f0f5", fontWeight: 900 }}>
                                  {isPending ? (reservationTime || "—") : `${event.city || ""}${event.state ? `, ${event.state}` : ""}` || "—"}
                                </p>
                              </div>
                            </div>

                            {isPending && (
                              <button
                                type="button"
                                onClick={() => handleCheckPixPaymentStatus(registration.id)}
                                style={{
                                  width: "100%",
                                  border: "none",
                                  borderRadius: 16,
                                  padding: "13px 15px",
                                  fontSize: 13.5,
                                  fontWeight: 950,
                                  color: "#fff",
                                  background: "linear-gradient(135deg, #e11d48, #ff3d63)",
                                  cursor: "pointer",
                                  fontFamily: "inherit"
                                }}
                              >
                                Acompanhar pagamento
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {!loadingSections.events && listEvents.length > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6 }}>
                  <h3 style={{ fontSize: 19, fontWeight: 900, letterSpacing: -0.4 }}>Próximos eventos</h3>
                  <span style={{ color: "#555", fontSize: 12, fontWeight: 800 }}>{listEvents.length} provas</span>
                </div>
              )}

              {!loadingSections.events && listEvents.map((e) => (
                <div key={e.id} style={{ display: "grid", gridTemplateColumns: "86px 1fr", gap: 14, background: "linear-gradient(180deg, rgba(255,255,255,0.045), rgba(255,255,255,0.025))", borderRadius: 22, padding: 14, border: "1px solid rgba(255,255,255,0.10)", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05)" }}>
                  <div style={{ height: 92, borderRadius: 16, background: `linear-gradient(180deg, rgba(0,0,0,0.05), rgba(0,0,0,0.26)), url(${getEventImage(e)}) center/cover`, border: "1px solid rgba(255,255,255,0.08)" }} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginBottom: 8 }}>
                      <span style={{ border: "1px solid #e11d48", color: "#ff4164", background: "rgba(225,29,72,0.08)", borderRadius: 8, padding: "5px 8px", fontSize: 10, fontWeight: 900, textTransform: "uppercase", letterSpacing: 0.3 }}>{e.category}</span>
                      {user.id === ADMIN_ID && (
                        <button onClick={() => handleDeleteEvent(e.id)} style={{ background: "none", border: "none", color: "#555", fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>🗑️</button>
                      )}
                    </div>
                    <p style={{ fontWeight: 900, fontSize: 15.5, lineHeight: 1.2, letterSpacing: -0.3, marginBottom: 7, textTransform: "uppercase" }}>{e.name}</p>
                    <p style={{ fontSize: 12.5, color: "#8b8b96", marginBottom: 12 }}>⌖ {e.city}, {e.state}</p>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, paddingTop: "max(6px, env(safe-area-inset-top))" }}>
                      <div style={{ minWidth: 0, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                        <span style={{ fontSize: 12, fontWeight: 900, color: "#e11d48" }}>▣ {e.date}</span>
                        <span style={{ width: 1, height: 14, background: "#333" }} />
                        <span style={{ fontSize: 12, color: "#aaa", fontWeight: 800 }}>{e.distance}</span>
                      </div>
                      {e.race_event && user.id === ADMIN_ID ? (
                        <button
                          onClick={() => openRaceEventDetails(e)}
                          style={{
                            background: "linear-gradient(135deg, #7c3aed, #a855f7)",
                            color: "#fff",
                            border: "none",
                            borderRadius: 12,
                            padding: "9px 12px",
                            fontSize: 12,
                            fontWeight: 900,
                            cursor: "pointer",
                            whiteSpace: "nowrap",
                            fontFamily: "inherit"
                          }}
                        >
                          Testar inscrição
                        </button>
                      ) : e.link ? (
                        <a href={e.link} target="_blank" rel="noopener noreferrer" style={{ background: "linear-gradient(135deg, #e11d48, #ff3d63)", color: "#fff", borderRadius: 12, padding: "9px 12px", fontSize: 12, fontWeight: 900, textDecoration: "none", whiteSpace: "nowrap" }}>Inscrever</a>
                      ) : (
                        <button className="jbtn" style={{ opacity: 0.55, cursor: "not-allowed", borderRadius: 12, padding: "9px 12px", whiteSpace: "nowrap" }}>Em breve</button>
                      )}
                    </div>
                  </div>
                </div>
              ))}

              {/* Modal de prova com inscrição nativa */}
              {selectedRaceEvent && (
                <div
                  style={{
                    position: "fixed",
                    inset: 0,
                    background: "rgba(0,0,0,0.92)",
                    zIndex: 240,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "flex-end"
                  }}
                >
                  <div
                    style={{
                      background: "#111118",
                      borderRadius: "28px 28px 0 0",
                      width: "100%",
                      maxWidth: 430,
                      maxHeight: "92vh",
                      overflowY: "auto",
                      border: "1px solid rgba(255,255,255,0.12)",
                      padding: "22px 20px max(38px, env(safe-area-inset-bottom))"
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 14, marginBottom: 20 }}>
                      <div>
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 6,
                            background: "rgba(124,58,237,0.16)",
                            color: "#c084fc",
                            border: "1px solid rgba(192,132,252,0.34)",
                            borderRadius: 999,
                            padding: "7px 11px",
                            fontSize: 11,
                            fontWeight: 900,
                            marginBottom: 12
                          }}
                        >
                          TESTE · INSCRIÇÃO NATIVA
                        </span>

                        <h3 style={{ fontSize: 24, lineHeight: 1.08, letterSpacing: -0.7, fontWeight: 950, marginBottom: 8 }}>
                          {selectedRaceEvent.name}
                        </h3>

                        <p style={{ color: "#9b9baa", fontSize: 13.5, lineHeight: 1.45 }}>
                          ⌖ {selectedRaceEvent.city}, {selectedRaceEvent.state}
                        </p>
                      </div>

                      <button
                        onClick={() => {
                          setSelectedRaceEvent(null);
                          setRaceEventDetails(null);
                          setSelectedRaceModalityId(null);
                          setRaceCheckoutStep("details");
                          setPendingRaceRegistration(null);
                          setRaceParticipantForm({
                            name: "",
                            cpf: "",
                            birthDate: "",
                            phone: "",
                            email: user?.email || "",
                            tshirtSize: "",
                            emergencyContactName: "",
                            emergencyContactPhone: "",
                          });
                          setLoadingRaceDetails(false);
                        }}
                        style={{
                          width: 42,
                          height: 42,
                          flexShrink: 0,
                          borderRadius: 14,
                          border: "1px solid rgba(255,255,255,0.12)",
                          background: "rgba(255,255,255,0.045)",
                          color: "#fff",
                          fontSize: 20,
                          cursor: "pointer",
                          fontFamily: "inherit"
                        }}
                      >
                        ✕
                      </button>
                    </div>

                    {loadingRaceDetails && (
                      <div
                        style={{
                          padding: 20,
                          borderRadius: 20,
                          background: "rgba(255,255,255,0.04)",
                          border: "1px solid rgba(255,255,255,0.08)",
                          color: "#b7b7c2",
                          fontSize: 14,
                          fontWeight: 800,
                          textAlign: "center"
                        }}
                      >
                        Carregando detalhes da prova...
                      </div>
                    )}

                    {!loadingRaceDetails && raceEventDetails && (
                      <>
                        {raceCheckoutStep === "details" ? (
                          <>
                            <div
                          style={{
                            display: "grid",
                            gridTemplateColumns: "1fr 1fr",
                            gap: 10,
                            marginBottom: 16
                          }}
                        >
                          <div
                            style={{
                              background: "rgba(255,255,255,0.04)",
                              border: "1px solid rgba(255,255,255,0.09)",
                              borderRadius: 18,
                              padding: 13
                            }}
                          >
                            <p style={{ fontSize: 11, color: "#777787", fontWeight: 900, marginBottom: 5 }}>STATUS</p>
                            <p style={{ fontSize: 14, fontWeight: 900, color: "#f4f4f7" }}>{raceEventDetails.sales_status}</p>
                          </div>

                          <div
                            style={{
                              background: "rgba(255,255,255,0.04)",
                              border: "1px solid rgba(255,255,255,0.09)",
                              borderRadius: 18,
                              padding: 13
                            }}
                          >
                            <p style={{ fontSize: 11, color: "#777787", fontWeight: 900, marginBottom: 5 }}>ORGANIZADOR</p>
                            <p style={{ fontSize: 14, fontWeight: 900, color: "#f4f4f7", lineHeight: 1.25 }}>
                              {raceEventDetails.organizer?.name || "Não informado"}
                            </p>
                          </div>
                        </div>

                        <div
                          style={{
                            background: "linear-gradient(180deg, rgba(225,29,72,0.10), rgba(255,255,255,0.035))",
                            border: "1px solid rgba(225,29,72,0.22)",
                            borderRadius: 22,
                            padding: 16,
                            marginBottom: 16
                          }}
                        >
                          <p style={{ fontSize: 12, color: "#ff6b86", fontWeight: 950, marginBottom: 8 }}>KIT DA PROVA</p>
                          <p style={{ fontSize: 14, color: "#d4d4df", lineHeight: 1.5, marginBottom: 12 }}>
                            {raceEventDetails.kit_description || "Nenhuma descrição de kit cadastrada."}
                          </p>

                          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                            {(Array.isArray(raceEventDetails.kit_items) ? raceEventDetails.kit_items : []).map((item, index) => (
                              <div
                                key={index}
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 9,
                                  padding: "9px 11px",
                                  borderRadius: 14,
                                  background: "rgba(0,0,0,0.22)",
                                  border: "1px solid rgba(255,255,255,0.08)",
                                  fontSize: 13,
                                  color: "#f0f0f5",
                                  fontWeight: 800
                                }}
                              >
                                <span style={{ color: "#e11d48" }}>✓</span>
                                {item}
                              </div>
                            ))}
                          </div>
                        </div>

                        <div style={{ marginBottom: 16 }}>
                          <p style={{ fontSize: 12, color: "#8f8f9d", fontWeight: 950, marginBottom: 10 }}>MODALIDADES E LOTES</p>

                          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                            {(raceEventDetails.modalities || []).map((modality) => {
                              const activeLot = (modality.lots || []).find((lot) => lot.is_active);
                              const activePrice = activeLot
                                ? (activeLot.price_cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
                                : null;

                              return (
                                <button
                                  key={modality.id}
                                  type="button"
                                  onClick={() => {
                                    if (activeLot) setSelectedRaceModalityId(modality.id);
                                  }}
                                  style={{
                                    width: "100%",
                                    background: selectedRaceModalityId === modality.id
                                      ? "linear-gradient(135deg, rgba(225,29,72,0.22), rgba(255,61,99,0.10))"
                                      : "rgba(255,255,255,0.04)",
                                    border: selectedRaceModalityId === modality.id
                                      ? "1px solid rgba(255,61,99,0.72)"
                                      : "1px solid rgba(255,255,255,0.10)",
                                    borderRadius: 20,
                                    padding: 15,
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "center",
                                    gap: 12,
                                    cursor: activeLot ? "pointer" : "not-allowed",
                                    textAlign: "left",
                                    color: "#fff",
                                    fontFamily: "inherit",
                                    boxShadow: selectedRaceModalityId === modality.id
                                      ? "0 14px 28px rgba(225,29,72,0.18)"
                                      : "none",
                                    opacity: activeLot ? 1 : 0.62
                                  }}
                                >
                                  <div>
                                    <p style={{ fontSize: 17, fontWeight: 950, marginBottom: 4 }}>{modality.name}</p>
                                    <p style={{ fontSize: 12.5, color: "#8f8f9d", fontWeight: 800 }}>
                                      {activeLot ? `${activeLot.name} · ${activeLot.total_slots} vagas no lote` : "Sem lote ativo"}
                                    </p>
                                  </div>

                                  <div style={{ textAlign: "right" }}>
                                    <p style={{ fontSize: 18, fontWeight: 950, color: "#fff" }}>
                                      {activePrice || "—"}
                                    </p>
                                    <p style={{ fontSize: 11, color: "#e11d48", fontWeight: 950 }}>
                                      {activeLot ? "ATIVO" : "INDISPONÍVEL"}
                                    </p>
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        <button
                          type="button"
                          disabled={!selectedRaceModalityId}
                          onClick={() => {
                            if (!selectedRaceModalityId) return;
                            setRaceCheckoutStep("participant");
                          }}
                          style={{
                            width: "100%",
                            border: "none",
                            borderRadius: 18,
                            padding: "16px 18px",
                            fontSize: 15,
                            fontWeight: 950,
                            color: "#fff",
                            background: selectedRaceModalityId
                              ? "linear-gradient(135deg, #e11d48, #ff3d63)"
                              : "linear-gradient(135deg, rgba(225,29,72,0.42), rgba(255,61,99,0.42))",
                            opacity: selectedRaceModalityId ? 1 : 0.72,
                            cursor: selectedRaceModalityId ? "pointer" : "not-allowed",
                            fontFamily: "inherit",
                            boxShadow: selectedRaceModalityId ? "0 16px 32px rgba(225,29,72,0.28)" : "none"
                          }}
                        >
                          {selectedRaceModalityId ? "Continuar inscrição" : "Selecione uma modalidade"}
                        </button>
                          </>
                        ) : raceCheckoutStep === "participant" ? (
                          <>
                            {(() => {
                              const selectedModality = (raceEventDetails.modalities || []).find(
                                (modality) => modality.id === selectedRaceModalityId
                              );

                              const activeLot = (selectedModality?.lots || []).find((lot) => lot.is_active);

                              const activePrice = activeLot
                                ? (activeLot.price_cents / 100).toLocaleString("pt-BR", {
                                    style: "currency",
                                    currency: "BRL"
                                  })
                                : "—";

                              const requiresTshirt = !!raceEventDetails.has_tshirt;
                              const requiresEmergencyContact = !!raceEventDetails.checkout_settings?.requires_emergency_contact;

                              const participantFormIsValid =
                                raceParticipantForm.name.trim() &&
                                raceParticipantForm.cpf.trim() &&
                                raceParticipantForm.birthDate &&
                                raceParticipantForm.phone.trim() &&
                                raceParticipantForm.email.trim() &&
                                (!requiresTshirt || raceParticipantForm.tshirtSize) &&
                                (
                                  !requiresEmergencyContact ||
                                  (
                                    raceParticipantForm.emergencyContactName.trim() &&
                                    raceParticipantForm.emergencyContactPhone.trim()
                                  )
                                );

                              return (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => setRaceCheckoutStep("details")}
                                    style={{
                                      display: "inline-flex",
                                      alignItems: "center",
                                      gap: 7,
                                      background: "rgba(255,255,255,0.045)",
                                      border: "1px solid rgba(255,255,255,0.10)",
                                      color: "#d6d6df",
                                      borderRadius: 999,
                                      padding: "9px 12px",
                                      fontSize: 12,
                                      fontWeight: 900,
                                      cursor: "pointer",
                                      fontFamily: "inherit",
                                      marginBottom: 16
                                    }}
                                  >
                                    ← Voltar para modalidades
                                  </button>

                                  <div
                                    style={{
                                      background: "linear-gradient(135deg, rgba(225,29,72,0.18), rgba(255,61,99,0.06))",
                                      border: "1px solid rgba(255,61,99,0.26)",
                                      borderRadius: 22,
                                      padding: 16,
                                      marginBottom: 16
                                    }}
                                  >
                                    <p style={{ fontSize: 12, color: "#ff6b86", fontWeight: 950, marginBottom: 8 }}>
                                      SUA ESCOLHA
                                    </p>

                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                                      <div>
                                        <p style={{ fontSize: 19, fontWeight: 950, marginBottom: 4 }}>
                                          {selectedModality?.name || "Modalidade"}
                                        </p>
                                        <p style={{ fontSize: 12.5, color: "#ababba", fontWeight: 800 }}>
                                          {activeLot ? activeLot.name : "Lote não encontrado"}
                                        </p>
                                      </div>

                                      <p style={{ fontSize: 21, fontWeight: 950, color: "#fff" }}>
                                        {activePrice}
                                      </p>
                                    </div>
                                  </div>

                                  <div style={{ marginBottom: 16 }}>
                                    <p style={{ fontSize: 12, color: "#8f8f9d", fontWeight: 950, marginBottom: 10 }}>
                                      DADOS DO PARTICIPANTE
                                    </p>

                                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                                      <input
                                        className="tinput"
                                        placeholder="Nome completo"
                                        value={raceParticipantForm.name}
                                        onChange={(e) => setRaceParticipantForm((form) => ({ ...form, name: e.target.value }))}
                                      />

                                      <input
                                        className="tinput"
                                        placeholder="CPF"
                                        value={raceParticipantForm.cpf}
                                        onChange={(e) => setRaceParticipantForm((form) => ({ ...form, cpf: e.target.value }))}
                                      />

                                      <input
                                        className="tinput"
                                        type="date"
                                        value={raceParticipantForm.birthDate}
                                        onChange={(e) => setRaceParticipantForm((form) => ({ ...form, birthDate: e.target.value }))}
                                      />

                                      <input
                                        className="tinput"
                                        placeholder="Telefone"
                                        value={raceParticipantForm.phone}
                                        onChange={(e) => setRaceParticipantForm((form) => ({ ...form, phone: e.target.value }))}
                                      />

                                      <input
                                        className="tinput"
                                        placeholder="E-mail da conta"
                                        value={raceParticipantForm.email}
                                        readOnly
                                      />
                                    </div>
                                  </div>

                                  {requiresTshirt && (
                                    <div style={{ marginBottom: 16 }}>
                                      <p style={{ fontSize: 12, color: "#8f8f9d", fontWeight: 950, marginBottom: 10 }}>
                                        TAMANHO DA CAMISETA
                                      </p>

                                      <select
                                        className="tinput"
                                        value={raceParticipantForm.tshirtSize}
                                        onChange={(e) => setRaceParticipantForm((form) => ({ ...form, tshirtSize: e.target.value }))}
                                      >
                                        <option value="">Selecione um tamanho</option>
                                        {(Array.isArray(raceEventDetails.tshirt_sizes) ? raceEventDetails.tshirt_sizes : []).map((size) => (
                                          <option key={size} value={size}>{size}</option>
                                        ))}
                                      </select>
                                    </div>
                                  )}

                                  {requiresEmergencyContact && (
                                    <div style={{ marginBottom: 16 }}>
                                      <p style={{ fontSize: 12, color: "#8f8f9d", fontWeight: 950, marginBottom: 10 }}>
                                        CONTATO DE EMERGÊNCIA
                                      </p>

                                      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                                        <input
                                          className="tinput"
                                          placeholder="Nome do contato"
                                          value={raceParticipantForm.emergencyContactName}
                                          onChange={(e) => setRaceParticipantForm((form) => ({ ...form, emergencyContactName: e.target.value }))}
                                        />

                                        <input
                                          className="tinput"
                                          placeholder="Telefone do contato"
                                          value={raceParticipantForm.emergencyContactPhone}
                                          onChange={(e) => setRaceParticipantForm((form) => ({ ...form, emergencyContactPhone: e.target.value }))}
                                        />
                                      </div>
                                    </div>
                                  )}

                                  <button
                                    type="button"
                                    disabled={!participantFormIsValid}
                                    onClick={() => {
                                      if (!participantFormIsValid) return;
                                      setRaceCheckoutStep("review");
                                    }}
                                    style={{
                                      width: "100%",
                                      border: "none",
                                      borderRadius: 18,
                                      padding: "16px 18px",
                                      fontSize: 15,
                                      fontWeight: 950,
                                      color: "#fff",
                                      background: participantFormIsValid
                                        ? "linear-gradient(135deg, #e11d48, #ff3d63)"
                                        : "linear-gradient(135deg, rgba(225,29,72,0.42), rgba(255,61,99,0.42))",
                                      opacity: participantFormIsValid ? 1 : 0.72,
                                      cursor: participantFormIsValid ? "pointer" : "not-allowed",
                                      fontFamily: "inherit",
                                      boxShadow: participantFormIsValid ? "0 16px 32px rgba(225,29,72,0.28)" : "none"
                                    }}
                                  >
                                    {participantFormIsValid ? "Continuar para revisão" : "Preencha os dados obrigatórios"}
                                  </button>
                                </>
                              );
                            })()}
                          </>
                        ) : raceCheckoutStep === "review" ? (
                          <>
                            {(() => {
                              const selectedModality = (raceEventDetails.modalities || []).find(
                                (modality) => modality.id === selectedRaceModalityId
                              );

                              const activeLot = (selectedModality?.lots || []).find((lot) => lot.is_active);

                              const activePrice = activeLot
                                ? (activeLot.price_cents / 100).toLocaleString("pt-BR", {
                                    style: "currency",
                                    currency: "BRL"
                                  })
                                : "—";

                              const requiresTshirt = !!raceEventDetails.has_tshirt;
                              const requiresEmergencyContact = !!raceEventDetails.checkout_settings?.requires_emergency_contact;

                              return (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => setRaceCheckoutStep("participant")}
                                    style={{
                                      display: "inline-flex",
                                      alignItems: "center",
                                      gap: 7,
                                      background: "rgba(255,255,255,0.045)",
                                      border: "1px solid rgba(255,255,255,0.10)",
                                      color: "#d6d6df",
                                      borderRadius: 999,
                                      padding: "9px 12px",
                                      fontSize: 12,
                                      fontWeight: 900,
                                      cursor: "pointer",
                                      fontFamily: "inherit",
                                      marginBottom: 16
                                    }}
                                  >
                                    ← Voltar para dados
                                  </button>

                                  <div
                                    style={{
                                      background: "linear-gradient(135deg, rgba(225,29,72,0.18), rgba(255,61,99,0.06))",
                                      border: "1px solid rgba(255,61,99,0.26)",
                                      borderRadius: 22,
                                      padding: 16,
                                      marginBottom: 16
                                    }}
                                  >
                                    <p style={{ fontSize: 12, color: "#ff6b86", fontWeight: 950, marginBottom: 8 }}>
                                      REVISE SUA INSCRIÇÃO
                                    </p>

                                    <p style={{ fontSize: 21, fontWeight: 950, lineHeight: 1.15, marginBottom: 6 }}>
                                      {selectedRaceEvent?.name}
                                    </p>

                                    <p style={{ fontSize: 13, color: "#ababba", fontWeight: 800 }}>
                                      {selectedModality?.name || "Modalidade"} · {activeLot?.name || "Lote"}
                                    </p>
                                  </div>

                                  <div
                                    style={{
                                      background: "rgba(255,255,255,0.04)",
                                      border: "1px solid rgba(255,255,255,0.10)",
                                      borderRadius: 22,
                                      padding: 16,
                                      marginBottom: 16
                                    }}
                                  >
                                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
                                      <div>
                                        <p style={{ fontSize: 12, color: "#8f8f9d", fontWeight: 950, marginBottom: 5 }}>
                                          VALOR DA INSCRIÇÃO
                                        </p>
                                        <p style={{ fontSize: 13, color: "#d4d4df", fontWeight: 800 }}>
                                          Pagamento será conectado na próxima etapa técnica.
                                        </p>
                                      </div>

                                      <p style={{ fontSize: 24, fontWeight: 950, color: "#fff", whiteSpace: "nowrap" }}>
                                        {activePrice}
                                      </p>
                                    </div>
                                  </div>

                                  <div style={{ marginBottom: 16 }}>
                                    <p style={{ fontSize: 12, color: "#8f8f9d", fontWeight: 950, marginBottom: 10 }}>
                                      PARTICIPANTE
                                    </p>

                                    <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                                      {[
                                        ["Nome", raceParticipantForm.name],
                                        ["CPF", raceParticipantForm.cpf],
                                        ["Nascimento", raceParticipantForm.birthDate],
                                        ["Telefone", raceParticipantForm.phone],
                                        ["E-mail", raceParticipantForm.email]
                                      ].map(([label, value]) => (
                                        <div
                                          key={label}
                                          style={{
                                            display: "flex",
                                            justifyContent: "space-between",
                                            gap: 12,
                                            padding: "11px 12px",
                                            borderRadius: 14,
                                            background: "rgba(255,255,255,0.04)",
                                            border: "1px solid rgba(255,255,255,0.08)"
                                          }}
                                        >
                                          <span style={{ fontSize: 12, color: "#8f8f9d", fontWeight: 900 }}>{label}</span>
                                          <span style={{ fontSize: 12.5, color: "#f0f0f5", fontWeight: 850, textAlign: "right" }}>{value || "—"}</span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>

                                  {requiresTshirt && (
                                    <div style={{ marginBottom: 16 }}>
                                      <p style={{ fontSize: 12, color: "#8f8f9d", fontWeight: 950, marginBottom: 10 }}>
                                        CAMISETA
                                      </p>

                                      <div
                                        style={{
                                          padding: "12px 13px",
                                          borderRadius: 14,
                                          background: "rgba(255,255,255,0.04)",
                                          border: "1px solid rgba(255,255,255,0.08)",
                                          display: "flex",
                                          justifyContent: "space-between",
                                          gap: 12
                                        }}
                                      >
                                        <span style={{ fontSize: 12, color: "#8f8f9d", fontWeight: 900 }}>Tamanho</span>
                                        <span style={{ fontSize: 13, color: "#fff", fontWeight: 950 }}>
                                          {raceParticipantForm.tshirtSize || "—"}
                                        </span>
                                      </div>
                                    </div>
                                  )}

                                  {requiresEmergencyContact && (
                                    <div style={{ marginBottom: 16 }}>
                                      <p style={{ fontSize: 12, color: "#8f8f9d", fontWeight: 950, marginBottom: 10 }}>
                                        CONTATO DE EMERGÊNCIA
                                      </p>

                                      <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                                        <div
                                          style={{
                                            display: "flex",
                                            justifyContent: "space-between",
                                            gap: 12,
                                            padding: "11px 12px",
                                            borderRadius: 14,
                                            background: "rgba(255,255,255,0.04)",
                                            border: "1px solid rgba(255,255,255,0.08)"
                                          }}
                                        >
                                          <span style={{ fontSize: 12, color: "#8f8f9d", fontWeight: 900 }}>Nome</span>
                                          <span style={{ fontSize: 12.5, color: "#f0f0f5", fontWeight: 850, textAlign: "right" }}>
                                            {raceParticipantForm.emergencyContactName || "—"}
                                          </span>
                                        </div>

                                        <div
                                          style={{
                                            display: "flex",
                                            justifyContent: "space-between",
                                            gap: 12,
                                            padding: "11px 12px",
                                            borderRadius: 14,
                                            background: "rgba(255,255,255,0.04)",
                                            border: "1px solid rgba(255,255,255,0.08)"
                                          }}
                                        >
                                          <span style={{ fontSize: 12, color: "#8f8f9d", fontWeight: 900 }}>Telefone</span>
                                          <span style={{ fontSize: 12.5, color: "#f0f0f5", fontWeight: 850, textAlign: "right" }}>
                                            {raceParticipantForm.emergencyContactPhone || "—"}
                                          </span>
                                        </div>
                                      </div>
                                    </div>
                                  )}

                                  <button
                                    type="button"
                                    onClick={handleCreatePendingRaceRegistration}
                                    disabled={creatingRaceRegistration}
                                    style={{
                                      width: "100%",
                                      border: "none",
                                      borderRadius: 18,
                                      padding: "16px 18px",
                                      fontSize: 15,
                                      fontWeight: 950,
                                      color: "#fff",
                                      background: "linear-gradient(135deg, #e11d48, #ff3d63)",
                                      cursor: "pointer",
                                      fontFamily: "inherit",
                                      boxShadow: "0 16px 32px rgba(225,29,72,0.28)"
                                    }}
                                  >
                                    {creatingRaceRegistration ? "Criando reserva..." : "Confirmar dados e seguir para pagamento"}
                                  </button>
                                </>
                              );
                            })()}
                          </>
                        ) : (
                          <>
                            {(() => {
                              const reservationExpiration = pendingRaceRegistration?.reservation_expires_at
                                ? new Date(pendingRaceRegistration.reservation_expires_at).toLocaleTimeString("pt-BR", {
                                    hour: "2-digit",
                                    minute: "2-digit"
                                  })
                                : null;

                              const reservedAmount = pendingRaceRegistration?.amount_cents
                                ? (pendingRaceRegistration.amount_cents / 100).toLocaleString("pt-BR", {
                                    style: "currency",
                                    currency: "BRL"
                                  })
                                : "—";

                              return (
                                <>
                                  <div
                                    style={{
                                      background: "linear-gradient(135deg, rgba(34,197,94,0.18), rgba(34,197,94,0.05))",
                                      border: "1px solid rgba(34,197,94,0.32)",
                                      borderRadius: 24,
                                      padding: 18,
                                      marginBottom: 16
                                    }}
                                  >
                                    <span
                                      style={{
                                        display: "inline-flex",
                                        alignItems: "center",
                                        gap: 6,
                                        background: "rgba(34,197,94,0.16)",
                                        color: "#86efac",
                                        border: "1px solid rgba(134,239,172,0.30)",
                                        borderRadius: 999,
                                        padding: "7px 11px",
                                        fontSize: 11,
                                        fontWeight: 950,
                                        marginBottom: 12
                                      }}
                                    >
                                      ✓ VAGA RESERVADA
                                    </span>

                                    <h3 style={{ fontSize: 24, lineHeight: 1.08, letterSpacing: -0.7, fontWeight: 950, marginBottom: 9 }}>
                                      Sua inscrição está aguardando pagamento.
                                    </h3>

                                    <p style={{ fontSize: 14, lineHeight: 1.5, color: "#d2d2dc", fontWeight: 750 }}>
                                      A vaga foi segurada por 15 minutos. Conclua o pagamento via Pix ou cartão pelo Mercado Pago para confirmar sua inscrição.
                                    </p>
                                  </div>

                                  <div
                                    style={{
                                      display: "grid",
                                      gridTemplateColumns: "1fr 1fr",
                                      gap: 10,
                                      marginBottom: 16
                                    }}
                                  >
                                    <div
                                      style={{
                                        background: "rgba(255,255,255,0.04)",
                                        border: "1px solid rgba(255,255,255,0.10)",
                                        borderRadius: 18,
                                        padding: 14
                                      }}
                                    >
                                      <p style={{ fontSize: 11, color: "#8f8f9d", fontWeight: 950, marginBottom: 6 }}>
                                        RESERVA ATÉ
                                      </p>
                                      <p style={{ fontSize: 18, color: "#fff", fontWeight: 950 }}>
                                        {reservationExpiration || "—"}
                                      </p>
                                    </div>

                                    <div
                                      style={{
                                        background: "rgba(255,255,255,0.04)",
                                        border: "1px solid rgba(255,255,255,0.10)",
                                        borderRadius: 18,
                                        padding: 14
                                      }}
                                    >
                                      <p style={{ fontSize: 11, color: "#8f8f9d", fontWeight: 950, marginBottom: 6 }}>
                                        VALOR
                                      </p>
                                      <p style={{ fontSize: 18, color: "#fff", fontWeight: 950 }}>
                                        {reservedAmount}
                                      </p>
                                    </div>
                                  </div>

                                  <div
                                    style={{
                                      background: "rgba(255,255,255,0.04)",
                                      border: "1px solid rgba(255,255,255,0.10)",
                                      borderRadius: 20,
                                      padding: 15,
                                      marginBottom: 16
                                    }}
                                  >
                                    <p style={{ fontSize: 12, color: "#8f8f9d", fontWeight: 950, marginBottom: 8 }}>
                                      STATUS DA INSCRIÇÃO
                                    </p>
                                    <p style={{ fontSize: 15, color: "#fff", fontWeight: 950, marginBottom: 4 }}>
                                      Pagamento pendente
                                    </p>
                                    <p style={{ fontSize: 13, color: "#b8b8c4", lineHeight: 1.45, fontWeight: 750 }}>
                                      A inscrição já existe no banco com status <strong>pending_payment</strong> e a vaga está reservada no lote.
                                    </p>
                                  </div>

                                  <div
                                    style={{
                                      display: "grid",
                                      gridTemplateColumns: "1fr 1fr",
                                      gap: 10,
                                      marginBottom: 14
                                    }}
                                  >
                                    <button
                                      type="button"
                                      onClick={() => setSelectedCheckoutPaymentMethod("pix")}
                                      style={{
                                        border: selectedCheckoutPaymentMethod === "pix"
                                          ? "1px solid rgba(255,61,99,0.72)"
                                          : "1px solid rgba(255,255,255,0.12)",
                                        borderRadius: 16,
                                        padding: "13px 14px",
                                        fontSize: 13.5,
                                        fontWeight: 950,
                                        color: selectedCheckoutPaymentMethod === "pix" ? "#fff" : "#b9b9c5",
                                        background: selectedCheckoutPaymentMethod === "pix"
                                          ? "linear-gradient(135deg, rgba(225,29,72,0.24), rgba(255,61,99,0.12))"
                                          : "rgba(255,255,255,0.04)",
                                        cursor: "pointer",
                                        fontFamily: "inherit"
                                      }}
                                    >
                                      Pix
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => setSelectedCheckoutPaymentMethod("card")}
                                      style={{
                                        border: selectedCheckoutPaymentMethod === "card"
                                          ? "1px solid rgba(255,61,99,0.72)"
                                          : "1px solid rgba(255,255,255,0.12)",
                                        borderRadius: 16,
                                        padding: "13px 14px",
                                        fontSize: 13.5,
                                        fontWeight: 950,
                                        color: selectedCheckoutPaymentMethod === "card" ? "#fff" : "#b9b9c5",
                                        background: selectedCheckoutPaymentMethod === "card"
                                          ? "linear-gradient(135deg, rgba(225,29,72,0.24), rgba(255,61,99,0.12))"
                                          : "rgba(255,255,255,0.04)",
                                        cursor: "pointer",
                                        fontFamily: "inherit"
                                      }}
                                    >
                                      Cartão
                                    </button>
                                  </div>

                                  {selectedCheckoutPaymentMethod === "pix" && (
                                    <>
                                      {!pixPaymentData ? (
                                    <>
                                      <button
                                        type="button"
                                        onClick={handleCreatePixPayment}
                                        disabled={creatingPixPayment}
                                        style={{
                                          width: "100%",
                                          border: "none",
                                          borderRadius: 18,
                                          padding: "16px 18px",
                                          fontSize: 15,
                                          fontWeight: 950,
                                          color: "#fff",
                                          background: "linear-gradient(135deg, #e11d48, #ff3d63)",
                                          opacity: creatingPixPayment ? 0.75 : 1,
                                          cursor: creatingPixPayment ? "wait" : "pointer",
                                          fontFamily: "inherit",
                                          marginBottom: 10
                                        }}
                                      >
                                        {creatingPixPayment ? "Gerando Pix..." : "Pagar com Pix"}
                                      </button>

                                      <p style={{ fontSize: 12.5, color: "#8f8f9d", lineHeight: 1.45, textAlign: "center", fontWeight: 750 }}>
                                        Gere o QR Code para concluir a inscrição via Mercado Pago.
                                      </p>
                                    </>
                                  ) : (
                                    <div
                                      style={{
                                        background: "rgba(255,255,255,0.04)",
                                        border: "1px solid rgba(255,255,255,0.10)",
                                        borderRadius: 22,
                                        padding: 16,
                                        marginTop: 4
                                      }}
                                    >
                                      <p style={{ fontSize: 12, color: "#8f8f9d", fontWeight: 950, marginBottom: 8 }}>
                                        PAGAMENTO PIX GERADO
                                      </p>

                                      <p style={{ fontSize: 14, color: "#fff", lineHeight: 1.45, fontWeight: 850, marginBottom: 14 }}>
                                        Escaneie o QR Code ou copie o código Pix para concluir o pagamento.
                                      </p>

                                      {pixPaymentData?.pagamento?.qr_code_base64 ? (
                                        <img
                                          src={`data:image/png;base64,${pixPaymentData.pagamento.qr_code_base64}`}
                                          alt="QR Code Pix"
                                          style={{
                                            display: "block",
                                            width: "100%",
                                            maxWidth: 260,
                                            margin: "0 auto 14px",
                                            borderRadius: 16,
                                            background: "#fff",
                                            padding: 10
                                          }}
                                        />
                                      ) : null}

                                      {pixPaymentData?.pagamento?.qr_code ? (
                                        <>
                                          <textarea
                                            readOnly
                                            value={pixPaymentData.pagamento.qr_code}
                                            style={{
                                              width: "100%",
                                              minHeight: 92,
                                              resize: "none",
                                              border: "1px solid rgba(255,255,255,0.12)",
                                              borderRadius: 16,
                                              padding: 12,
                                              fontSize: 12,
                                              lineHeight: 1.45,
                                              color: "#fff",
                                              background: "rgba(255,255,255,0.05)",
                                              fontFamily: "inherit",
                                              marginBottom: 10
                                            }}
                                          />

                                          <button
                                            type="button"
                                            onClick={async () => {
                                              try {
                                                await navigator.clipboard.writeText(pixPaymentData.pagamento.qr_code);
                                                alert("Código Pix copiado!");
                                              } catch {
                                                alert("Não foi possível copiar automaticamente. Selecione o código e copie manualmente.");
                                              }
                                            }}
                                            style={{
                                              width: "100%",
                                              border: "1px solid rgba(255,255,255,0.14)",
                                              borderRadius: 16,
                                              padding: "14px 16px",
                                              fontSize: 14,
                                              fontWeight: 950,
                                              color: "#fff",
                                              background: "rgba(255,255,255,0.08)",
                                              cursor: "pointer",
                                              fontFamily: "inherit",
                                              marginBottom: 10
                                            }}
                                          >
                                            Copiar código Pix
                                          </button>
                                        </>
                                      ) : null}

                                      {pixPaymentData?.pagamento?.ticket_url ? (
                                        <a
                                          href={pixPaymentData.pagamento.ticket_url}
                                          target="_blank"
                                          rel="noreferrer"
                                          style={{
                                            display: "block",
                                            width: "100%",
                                            textAlign: "center",
                                            textDecoration: "none",
                                            borderRadius: 16,
                                            padding: "14px 16px",
                                            fontSize: 14,
                                            fontWeight: 950,
                                            color: "#fff",
                                            background: "linear-gradient(135deg, #e11d48, #ff3d63)",
                                            marginBottom: 10
                                          }}
                                        >
                                          Abrir pagamento Pix
                                        </a>
                                      ) : null}

                                      {pixPaymentData?.payment_confirmed || pendingRaceRegistration?.status === "confirmed" ? (
                                        <div
                                          style={{
                                            background: "linear-gradient(135deg, rgba(34,197,94,0.18), rgba(34,197,94,0.06))",
                                            border: "1px solid rgba(34,197,94,0.34)",
                                            borderRadius: 18,
                                            padding: 15,
                                            marginTop: 6
                                          }}
                                        >
                                          <p style={{ fontSize: 12, color: "#86efac", fontWeight: 950, marginBottom: 7 }}>
                                            ✓ INSCRIÇÃO CONFIRMADA
                                          </p>
                                          <p style={{ fontSize: 13.5, color: "#dcfce7", lineHeight: 1.5, fontWeight: 800 }}>
                                            Pagamento identificado. Sua vaga nesta prova está confirmada.
                                          </p>
                                        </div>
                                      ) : (
                                        <>
                                          <div
                                            style={{
                                              background: "rgba(255,255,255,0.04)",
                                              border: "1px solid rgba(255,255,255,0.10)",
                                              borderRadius: 18,
                                              padding: 14,
                                              marginTop: 6,
                                              marginBottom: 10
                                            }}
                                          >
                                            <p style={{ fontSize: 12, color: "#fda4af", fontWeight: 950, marginBottom: 7 }}>
                                              AGUARDANDO PAGAMENTO
                                            </p>
                                            <p style={{ fontSize: 13.5, color: "#d2d2dc", lineHeight: 1.5, fontWeight: 780 }}>
                                              Assim que o Pix for aprovado, sua inscrição será confirmada automaticamente.
                                            </p>
                                          </div>

                                          <button
                                            type="button"
                                            onClick={handleCheckPixPaymentStatus}
                                            style={{
                                              width: "100%",
                                              border: "1px solid rgba(255,255,255,0.14)",
                                              borderRadius: 16,
                                              padding: "14px 16px",
                                              fontSize: 14,
                                              fontWeight: 950,
                                              color: "#fff",
                                              background: "rgba(255,255,255,0.08)",
                                              cursor: "pointer",
                                              fontFamily: "inherit",
                                              marginBottom: 10
                                            }}
                                          >
                                            Já paguei, verificar status
                                          </button>

                                          <p style={{ fontSize: 12.5, color: "#8f8f9d", lineHeight: 1.45, textAlign: "center", fontWeight: 750 }}>
                                            Status atual: {pixPaymentData?.status_detail || "aguardando pagamento"}.
                                          </p>
                                        </>
                                      )}
                                    </div>
                                  )}

                                      {pixPaymentError ? (
                                        <p
                                          style={{
                                            marginTop: 12,
                                            fontSize: 13,
                                            color: "#fda4af",
                                            lineHeight: 1.45,
                                            textAlign: "center",
                                            fontWeight: 850
                                          }}
                                        >
                                          {pixPaymentError}
                                        </p>
                                      ) : null}
                                    </>
                                  )}

                                  {selectedCheckoutPaymentMethod === "card" && (
                                    <div
                                      style={{
                                        background: "rgba(255,255,255,0.04)",
                                        border: "1px solid rgba(255,255,255,0.10)",
                                        borderRadius: 22,
                                        padding: 16,
                                        marginTop: 4
                                      }}
                                    >
                                      {cardPaymentData?.inscricao_confirmada || pendingRaceRegistration?.status === "confirmed" ? (
                                        <div
                                          style={{
                                            background: "linear-gradient(135deg, rgba(34,197,94,0.18), rgba(34,197,94,0.06))",
                                            border: "1px solid rgba(34,197,94,0.34)",
                                            borderRadius: 18,
                                            padding: 15
                                          }}
                                        >
                                          <p style={{ fontSize: 12, color: "#86efac", fontWeight: 950, marginBottom: 7 }}>
                                            ✓ INSCRIÇÃO CONFIRMADA
                                          </p>
                                          <p style={{ fontSize: 13.5, color: "#dcfce7", lineHeight: 1.5, fontWeight: 800 }}>
                                            Pagamento aprovado. Sua vaga nesta prova está confirmada.
                                          </p>
                                        </div>
                                      ) : (
                                        <>
                                          <p style={{ fontSize: 12, color: "#8f8f9d", fontWeight: 950, marginBottom: 8 }}>
                                            PAGAMENTO COM CARTÃO
                                          </p>

                                          <p style={{ fontSize: 14, color: "#fff", lineHeight: 1.45, fontWeight: 850, marginBottom: 14 }}>
                                            Preencha os dados com segurança para confirmar sua inscrição.
                                          </p>

                                          {MERCADOPAGO_PUBLIC_KEY ? (
                                            <CardPayment
                                              initialization={{
                                                amount: Number(((pendingRaceRegistration?.amount_cents || 0) / 100).toFixed(2)),
                                                payer: {
                                                  email: "test@testuser.com",
                                                  ...(raceParticipantForm.cpf
                                                    ? {
                                                        identification: {
                                                          type: "CPF",
                                                          number: raceParticipantForm.cpf.replace(/\D/g, "")
                                                        }
                                                      }
                                                    : {})
                                                }
                                              }}
                                              onSubmit={handleCreateCardPayment}
                                              onReady={() => {}}
                                              onError={(error) => {
                                                console.error("Erro no formulário de cartão:", error);
                                                setCardPaymentError("Não foi possível carregar ou processar o formulário de cartão.");
                                              }}
                                            />
                                          ) : (
                                            <p style={{ fontSize: 13, color: "#fda4af", lineHeight: 1.45, fontWeight: 850 }}>
                                              Public Key do Mercado Pago não encontrada.
                                            </p>
                                          )}

                                          {creatingCardPayment ? (
                                            <p style={{ marginTop: 12, fontSize: 13, color: "#d2d2dc", lineHeight: 1.45, textAlign: "center", fontWeight: 850 }}>
                                              Processando pagamento com cartão...
                                            </p>
                                          ) : null}

                                          {cardPaymentData && !cardPaymentData?.inscricao_confirmada ? (
                                            <p style={{ marginTop: 12, fontSize: 13, color: "#d2d2dc", lineHeight: 1.45, textAlign: "center", fontWeight: 850 }}>
                                              Status do pagamento: {cardPaymentData?.status_detail || cardPaymentData?.status || "em análise"}.
                                            </p>
                                          ) : null}

                                          {cardPaymentError ? (
                                            <p style={{ marginTop: 12, fontSize: 13, color: "#fda4af", lineHeight: 1.45, textAlign: "center", fontWeight: 850 }}>
                                              {cardPaymentError}
                                            </p>
                                          ) : null}
                                        </>
                                      )}
                                    </div>
                                  )}
                                </>
                              );
                            })()}
                          </>
                        )}
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* Modal admin de eventos */}
              {showAdminEvents && user.id === ADMIN_ID && (
                <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.92)", zIndex: 200, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end" }}>
                  <div style={{ background: "#13131a", borderRadius: "24px 24px 0 0", padding: "24px 20px 40px", width: "100%", maxWidth: 390, border: "1px solid #1e1e2e", maxHeight: "90vh", overflowY: "auto" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                      <p style={{ fontWeight: 700, fontSize: 16 }}>Gerenciar eventos</p>
                      <button onClick={() => setShowAdminEvents(false)} style={{ background: "none", border: "none", color: "#555", fontSize: 22, cursor: "pointer" }}>✕</button>
                    </div>
                    <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
                      {[
                        { id: "agenda", label: "Agenda" },
                        { id: "native", label: "Inscrição nativa" }
                      ].map((view) => (
                        <button
                          key={view.id}
                          type="button"
                          onClick={() => setAdminEventsView(view.id)}
                          style={{
                            flex: 1,
                            border: adminEventsView === view.id
                              ? "1px solid rgba(255,61,99,0.72)"
                              : "1px solid #1e1e2e",
                            background: adminEventsView === view.id
                              ? "linear-gradient(135deg, rgba(225,29,72,0.20), rgba(255,61,99,0.08))"
                              : "rgba(255,255,255,0.03)",
                            color: adminEventsView === view.id ? "#fff" : "#777",
                            borderRadius: 14,
                            padding: "12px 10px",
                            fontSize: 12.5,
                            fontWeight: 900,
                            cursor: "pointer",
                            fontFamily: "inherit"
                          }}
                        >
                          {view.label}
                        </button>
                      ))}
                    </div>

                    {adminEventsView === "agenda" ? (
                      <>
                        <p style={{ fontSize: 12, color: "#555", marginBottom: 14, fontWeight: 700 }}>Adicionar novo evento</p>
                        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
                      <input className="tinput" placeholder="Nome do evento" value={eventForm.name} onChange={(e) => setEventForm(f => ({ ...f, name: e.target.value }))} />
                      <div style={{ display: "flex", gap: 8 }}>
                        <input className="tinput" placeholder="Data (ex: 15 Jun)" value={eventForm.date} onChange={(e) => setEventForm(f => ({ ...f, date: e.target.value }))} />
                        <input className="tinput" placeholder="Distância (ex: 10km)" value={eventForm.distance} onChange={(e) => setEventForm(f => ({ ...f, distance: e.target.value }))} />
                      </div>
                      <div style={{ display: "flex", gap: 8 }}>
                        <input className="tinput" placeholder="Cidade" value={eventForm.city} onChange={(e) => setEventForm(f => ({ ...f, city: e.target.value }))} />
                        <input className="tinput" placeholder="Estado" value={eventForm.state} onChange={(e) => setEventForm(f => ({ ...f, state: e.target.value }))} />
                      </div>
                      <select className="tinput" value={eventForm.category} onChange={(e) => setEventForm(f => ({ ...f, category: e.target.value }))}>
                        {["3K", "5K", "10K", "21K", "42K", "Maratona", "Trail"].map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                      <input className="tinput" placeholder="Link de inscrição (Ticket Sports)" value={eventForm.link} onChange={(e) => setEventForm(f => ({ ...f, link: e.target.value }))} />

                      <button
                        type="button"
                        onClick={() => setEventForm(f => ({ ...f, featured: !f.featured }))}
                        style={{
                          width: "100%",
                          background: eventForm.featured ? "rgba(225,29,72,0.16)" : "rgba(255,255,255,0.035)",
                          border: eventForm.featured ? "1px solid #e11d48" : "1px solid #1e1e2e",
                          color: eventForm.featured ? "#fff" : "#888",
                          borderRadius: 12,
                          padding: "13px 14px",
                          fontSize: 13,
                          fontWeight: 800,
                          cursor: "pointer",
                          fontFamily: "inherit",
                          textAlign: "left"
                        }}
                      >
                        {eventForm.featured ? "★ Este evento será destaque" : "☆ Marcar como evento destaque"}
                      </button>
                    </div>
                        <button onClick={handleSaveEvent} disabled={savingEvent} style={{ width: "100%", background: "#e11d48", color: "#fff", border: "none", borderRadius: 14, padding: 16, fontSize: 15, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", marginBottom: 20 }}>
                          {savingEvent ? "Salvando..." : "Adicionar evento"}
                        </button>
                      </>
                    ) : nativeRaceStep === "basic" ? (
                        <div style={{ marginBottom: 20 }}>
                          <div
                          style={{
                            background: "linear-gradient(135deg, rgba(124,58,237,0.15), rgba(255,255,255,0.035))",
                            border: "1px solid rgba(168,85,247,0.25)",
                            borderRadius: 20,
                            padding: 16,
                            marginBottom: 16
                          }}
                        >
                          <p style={{ fontSize: 12, color: "#c4a7ff", fontWeight: 950, marginBottom: 8 }}>
                            INSCRIÇÃO NATIVA EUCORREDOR
                          </p>
                          <p style={{ fontSize: 17, lineHeight: 1.25, color: "#fff", fontWeight: 950, marginBottom: 8 }}>
                            Dados básicos da prova
                          </p>
                          <p style={{ fontSize: 13, lineHeight: 1.5, color: "#b9b9c4", fontWeight: 750 }}>
                            Primeiro definimos o evento e o organizador. Depois seguimos para kit, modalidades, lotes e vagas.
                          </p>
                        </div>

                        {lastSavedNativeOrganizer ? (
                          <div
                            style={{
                              background: "linear-gradient(135deg, rgba(34,197,94,0.16), rgba(255,255,255,0.035))",
                              border: "1px solid rgba(34,197,94,0.32)",
                              borderRadius: 20,
                              padding: 16,
                              marginBottom: 16
                            }}
                          >
                            <p style={{ fontSize: 12, color: "#86efac", fontWeight: 950, marginBottom: 8 }}>
                              PROVA SALVA COM SUCESSO
                            </p>

                            <p style={{ fontSize: 16, lineHeight: 1.35, color: "#fff", fontWeight: 950, marginBottom: 8 }}>
                              Conecte o Mercado Pago do organizador
                            </p>

                            <p style={{ fontSize: 13, lineHeight: 1.5, color: "#d1fae5", fontWeight: 750, marginBottom: 14 }}>
                              A prova {lastSavedNativeOrganizer.raceName} foi cadastrada para {lastSavedNativeOrganizer.name}. Para habilitar recebimentos com split, conecte a conta Mercado Pago desse organizador.
                            </p>

                            <button
                              type="button"
                              onClick={() => {
                                const oauthUrl = `/api/mercadopago/oauth/iniciar?organizerId=${encodeURIComponent(lastSavedNativeOrganizer.id)}`;
                                window.open(oauthUrl, "_blank", "noopener,noreferrer");
                              }}
                              style={{
                                width: "100%",
                                border: "none",
                                borderRadius: 14,
                                padding: "15px 16px",
                                fontSize: 14,
                                fontWeight: 950,
                                color: "#fff",
                                background: "linear-gradient(135deg, #16a34a, #22c55e)",
                                cursor: "pointer",
                                fontFamily: "inherit"
                              }}
                            >
                              Conectar Mercado Pago
                            </button>
                          </div>
                        ) : null}


                        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
                          <input
                            className="tinput"
                            placeholder="Nome da prova"
                            value={nativeRaceForm.name}
                            onChange={(e) => {
                              const name = e.target.value;
                              const autoSlug = name
                                .normalize("NFD")
                                .replace(/[\u0300-\u036f]/g, "")
                                .toLowerCase()
                                .trim()
                                .replace(/[^a-z0-9]+/g, "-")
                                .replace(/^-+|-+$/g, "");

                              setNativeRaceForm((form) => ({
                                ...form,
                                name,
                                slug: form.slug && form.slug !== autoSlug ? form.slug : autoSlug
                              }));
                            }}
                          />

                          <input
                            className="tinput"
                            placeholder="Slug da prova, ex: corrida-noturna-canoas"
                            value={nativeRaceForm.slug}
                            onChange={(e) => setNativeRaceForm((form) => ({ ...form, slug: e.target.value }))}
                          />

                          <div style={{ display: "flex", gap: 8 }}>
                            <input
                              className="tinput"
                              type="date"
                              value={nativeRaceForm.eventDate}
                              onChange={(e) => setNativeRaceForm((form) => ({ ...form, eventDate: e.target.value }))}
                            />

                            <select
                              className="tinput"
                              value={nativeRaceForm.salesStatus}
                              onChange={(e) => setNativeRaceForm((form) => ({ ...form, salesStatus: e.target.value }))}
                            >
                              <option value="open">Vendas abertas</option>
                              <option value="draft">Rascunho</option>
                              <option value="closed">Vendas encerradas</option>
                            </select>
                          </div>

                          <div style={{ display: "flex", gap: 8 }}>
                            <input
                              className="tinput"
                              placeholder="Cidade"
                              value={nativeRaceForm.city}
                              onChange={(e) => setNativeRaceForm((form) => ({ ...form, city: e.target.value }))}
                            />
                            <input
                              className="tinput"
                              placeholder="Estado"
                              value={nativeRaceForm.state}
                              onChange={(e) => setNativeRaceForm((form) => ({ ...form, state: e.target.value }))}
                            />
                          </div>

                          <input
                            className="tinput"
                            placeholder="Nome do organizador"
                            value={nativeRaceForm.organizerName}
                            onChange={(e) => setNativeRaceForm((form) => ({ ...form, organizerName: e.target.value }))}
                          />

                          <button
                            type="button"
                            onClick={() => setNativeRaceForm((form) => ({ ...form, featured: !form.featured }))}
                            style={{
                              width: "100%",
                              background: nativeRaceForm.featured ? "rgba(124,58,237,0.18)" : "rgba(255,255,255,0.035)",
                              border: nativeRaceForm.featured ? "1px solid rgba(168,85,247,0.72)" : "1px solid #1e1e2e",
                              color: nativeRaceForm.featured ? "#fff" : "#888",
                              borderRadius: 12,
                              padding: "13px 14px",
                              fontSize: 13,
                              fontWeight: 800,
                              cursor: "pointer",
                              fontFamily: "inherit",
                              textAlign: "left"
                            }}
                          >
                            {nativeRaceForm.featured ? "★ Esta prova será destaque" : "☆ Marcar como prova destaque"}
                          </button>
                        </div>

                        <button
                          type="button"
                          onClick={() => setNativeRaceStep("kit")}
                          disabled={
                            !nativeRaceForm.name.trim() ||
                            !nativeRaceForm.slug.trim() ||
                            !nativeRaceForm.eventDate ||
                            !nativeRaceForm.city.trim() ||
                            !nativeRaceForm.state.trim() ||
                            !nativeRaceForm.organizerName.trim()
                          }
                          style={{
                            width: "100%",
                            background:
                              nativeRaceForm.name.trim() &&
                              nativeRaceForm.slug.trim() &&
                              nativeRaceForm.eventDate &&
                              nativeRaceForm.city.trim() &&
                              nativeRaceForm.state.trim() &&
                              nativeRaceForm.organizerName.trim()
                                ? "linear-gradient(135deg, #7c3aed, #a855f7)"
                                : "linear-gradient(135deg, rgba(124,58,237,0.45), rgba(168,85,247,0.45))",
                            color: "#fff",
                            border: "none",
                            borderRadius: 14,
                            padding: 16,
                            fontSize: 15,
                            fontWeight: 800,
                            cursor:
                              nativeRaceForm.name.trim() &&
                              nativeRaceForm.slug.trim() &&
                              nativeRaceForm.eventDate &&
                              nativeRaceForm.city.trim() &&
                              nativeRaceForm.state.trim() &&
                              nativeRaceForm.organizerName.trim()
                                ? "pointer"
                                : "not-allowed",
                            opacity:
                              nativeRaceForm.name.trim() &&
                              nativeRaceForm.slug.trim() &&
                              nativeRaceForm.eventDate &&
                              nativeRaceForm.city.trim() &&
                              nativeRaceForm.state.trim() &&
                              nativeRaceForm.organizerName.trim()
                                ? 1
                                : 0.78,
                            fontFamily: "inherit"
                          }}
                        >
                          Próxima etapa: kit e configurações
                        </button>
                        </div>
                      ) : nativeRaceStep === "kit" ? (
                        <div style={{ marginBottom: 20 }}>
                          <button
                            type="button"
                            onClick={() => setNativeRaceStep("basic")}
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 7,
                              background: "rgba(255,255,255,0.045)",
                              border: "1px solid rgba(255,255,255,0.10)",
                              color: "#d6d6df",
                              borderRadius: 999,
                              padding: "9px 12px",
                              fontSize: 12,
                              fontWeight: 900,
                              cursor: "pointer",
                              fontFamily: "inherit",
                              marginBottom: 16
                            }}
                          >
                            ← Voltar para dados básicos
                          </button>

                          <div
                            style={{
                              background: "linear-gradient(135deg, rgba(124,58,237,0.15), rgba(255,255,255,0.035))",
                              border: "1px solid rgba(168,85,247,0.25)",
                              borderRadius: 20,
                              padding: 16,
                              marginBottom: 16
                            }}
                          >
                            <p style={{ fontSize: 12, color: "#c4a7ff", fontWeight: 950, marginBottom: 8 }}>
                              ETAPA 2
                            </p>
                            <p style={{ fontSize: 17, lineHeight: 1.25, color: "#fff", fontWeight: 950, marginBottom: 8 }}>
                              Kit e configurações da inscrição
                            </p>
                            <p style={{ fontSize: 13, lineHeight: 1.5, color: "#b9b9c4", fontWeight: 750 }}>
                              Defina o que o corredor recebe e quais campos extras serão exigidos no checkout.
                            </p>
                          </div>

                          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
                            <textarea
                              className="tinput"
                              placeholder="Descrição do kit"
                              value={nativeRaceForm.kitDescription}
                              onChange={(e) => setNativeRaceForm((form) => ({ ...form, kitDescription: e.target.value }))}
                              style={{ minHeight: 92, resize: "vertical" }}
                            />

                            <textarea
                              className="tinput"
                              placeholder="Itens do kit, separados por vírgula. Ex: camiseta, medalha, número de peito"
                              value={nativeRaceForm.kitItemsText}
                              onChange={(e) => setNativeRaceForm((form) => ({ ...form, kitItemsText: e.target.value }))}
                              style={{ minHeight: 92, resize: "vertical" }}
                            />

                            <div
                              style={{
                                background: "rgba(255,255,255,0.035)",
                                border: "1px solid rgba(255,255,255,0.10)",
                                borderRadius: 16,
                                padding: 14
                              }}
                            >
                              <p style={{ fontSize: 12, color: "#b9b9c4", fontWeight: 900, marginBottom: 5 }}>
                                FOTO DO KIT
                              </p>
                              <p style={{ fontSize: 12.5, color: "#7f7f8d", lineHeight: 1.45, fontWeight: 750, marginBottom: 12 }}>
                                Opcional. Use uma imagem da camiseta, medalha ou composição completa do kit.
                              </p>

                              {!nativeKitImagePreview ? (
                                <label
                                  style={{
                                    width: "100%",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    gap: 8,
                                    borderRadius: 14,
                                    padding: "14px 12px",
                                    border: "1px dashed rgba(168,85,247,0.55)",
                                    background: "rgba(124,58,237,0.10)",
                                    color: "#e4d4ff",
                                    fontSize: 13,
                                    fontWeight: 900,
                                    cursor: "pointer",
                                    fontFamily: "inherit"
                                  }}
                                >
                                  ＋ Adicionar foto do kit
                                  <input
                                    type="file"
                                    accept="image/*"
                                    style={{ display: "none" }}
                                    onChange={(e) => {
                                      const file = e.target.files?.[0];
                                      if (!file) return;

                                      setNativeKitImageFile(file);

                                      const reader = new FileReader();
                                      reader.onloadend = () => {
                                        setNativeKitImagePreview(reader.result);
                                      };
                                      reader.readAsDataURL(file);
                                    }}
                                  />
                                </label>
                              ) : (
                                <div>
                                  <div
                                    style={{
                                      width: "100%",
                                      height: 180,
                                      borderRadius: 16,
                                      overflow: "hidden",
                                      border: "1px solid rgba(255,255,255,0.12)",
                                      background: "#0f0f15",
                                      marginBottom: 10
                                    }}
                                  >
                                    <img
                                      src={nativeKitImagePreview}
                                      alt="Prévia do kit"
                                      style={{
                                        width: "100%",
                                        height: "100%",
                                        objectFit: "cover",
                                        display: "block"
                                      }}
                                    />
                                  </div>

                                  <button
                                    type="button"
                                    onClick={() => {
                                      setNativeKitImageFile(null);
                                      setNativeKitImagePreview(null);
                                    }}
                                    style={{
                                      width: "100%",
                                      background: "rgba(255,255,255,0.05)",
                                      border: "1px solid rgba(255,255,255,0.12)",
                                      color: "#d5d5df",
                                      borderRadius: 12,
                                      padding: "12px 14px",
                                      fontSize: 13,
                                      fontWeight: 850,
                                      cursor: "pointer",
                                      fontFamily: "inherit"
                                    }}
                                  >
                                    Remover imagem
                                  </button>
                                </div>
                              )}
                            </div>

                            <button
                              type="button"
                              onClick={() => setNativeRaceForm((form) => ({ ...form, hasTshirt: !form.hasTshirt }))}
                              style={{
                                width: "100%",
                                background: nativeRaceForm.hasTshirt ? "rgba(124,58,237,0.18)" : "rgba(255,255,255,0.035)",
                                border: nativeRaceForm.hasTshirt ? "1px solid rgba(168,85,247,0.72)" : "1px solid #1e1e2e",
                                color: nativeRaceForm.hasTshirt ? "#fff" : "#888",
                                borderRadius: 12,
                                padding: "13px 14px",
                                fontSize: 13,
                                fontWeight: 800,
                                cursor: "pointer",
                                fontFamily: "inherit",
                                textAlign: "left"
                              }}
                            >
                              {nativeRaceForm.hasTshirt ? "✓ A prova terá camiseta" : "Adicionar camiseta ao kit"}
                            </button>

                            {nativeRaceForm.hasTshirt && (
                              <input
                                className="tinput"
                                placeholder="Tamanhos da camiseta, separados por vírgula"
                                value={nativeRaceForm.tshirtSizesText}
                                onChange={(e) => setNativeRaceForm((form) => ({ ...form, tshirtSizesText: e.target.value }))}
                              />
                            )}

                            <button
                              type="button"
                              onClick={() => setNativeRaceForm((form) => ({ ...form, requiresEmergencyContact: !form.requiresEmergencyContact }))}
                              style={{
                                width: "100%",
                                background: nativeRaceForm.requiresEmergencyContact ? "rgba(124,58,237,0.18)" : "rgba(255,255,255,0.035)",
                                border: nativeRaceForm.requiresEmergencyContact ? "1px solid rgba(168,85,247,0.72)" : "1px solid #1e1e2e",
                                color: nativeRaceForm.requiresEmergencyContact ? "#fff" : "#888",
                                borderRadius: 12,
                                padding: "13px 14px",
                                fontSize: 13,
                                fontWeight: 800,
                                cursor: "pointer",
                                fontFamily: "inherit",
                                textAlign: "left"
                              }}
                            >
                              {nativeRaceForm.requiresEmergencyContact ? "✓ Exigir contato de emergência" : "Não exigir contato de emergência"}
                            </button>
                          </div>

                          <button
                            type="button"
                            onClick={() => setNativeRaceStep("modalities")}
                            style={{
                              width: "100%",
                              background: "linear-gradient(135deg, #7c3aed, #a855f7)",
                              color: "#fff",
                              border: "none",
                              borderRadius: 14,
                              padding: 16,
                              fontSize: 15,
                              fontWeight: 800,
                              cursor: "pointer",
                              fontFamily: "inherit"
                            }}
                          >
                            Próxima etapa: modalidades e lotes
                          </button>
                        </div>
                      ) : nativeRaceStep === "modalities" ? (
                        <div style={{ marginBottom: 20 }}>
                          <button
                            type="button"
                            onClick={() => setNativeRaceStep("kit")}
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 7,
                              background: "rgba(255,255,255,0.045)",
                              border: "1px solid rgba(255,255,255,0.10)",
                              color: "#d6d6df",
                              borderRadius: 999,
                              padding: "9px 12px",
                              fontSize: 12,
                              fontWeight: 900,
                              cursor: "pointer",
                              fontFamily: "inherit",
                              marginBottom: 16
                            }}
                          >
                            ← Voltar para kit e configurações
                          </button>

                          <div
                            style={{
                              background: "linear-gradient(135deg, rgba(124,58,237,0.15), rgba(255,255,255,0.035))",
                              border: "1px solid rgba(168,85,247,0.25)",
                              borderRadius: 20,
                              padding: 16,
                              marginBottom: 16
                            }}
                          >
                            <p style={{ fontSize: 12, color: "#c4a7ff", fontWeight: 950, marginBottom: 8 }}>
                              ETAPA 3
                            </p>
                            <p style={{ fontSize: 17, lineHeight: 1.25, color: "#fff", fontWeight: 950, marginBottom: 8 }}>
                              Modalidades e lotes
                            </p>
                            <p style={{ fontSize: 13, lineHeight: 1.5, color: "#b9b9c4", fontWeight: 750 }}>
                              Cadastre cada distância da prova com seu lote inicial, preço e quantidade de vagas.
                            </p>
                          </div>

                          <div
                            style={{
                              background: "rgba(255,255,255,0.035)",
                              border: "1px solid rgba(255,255,255,0.10)",
                              borderRadius: 18,
                              padding: 14,
                              marginBottom: 16
                            }}
                          >
                            <p style={{ fontSize: 12, color: "#b9b9c4", fontWeight: 950, marginBottom: 12 }}>
                              ADICIONAR MODALIDADE
                            </p>

                            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                              <input
                                className="tinput"
                                placeholder="Modalidade, ex: 5 km"
                                value={nativeModalityDraft.name}
                                onChange={(e) => setNativeModalityDraft((draft) => ({ ...draft, name: e.target.value }))}
                              />

                              <input
                                className="tinput"
                                placeholder="Nome do lote, ex: 1º lote"
                                value={nativeModalityDraft.lotName}
                                onChange={(e) => setNativeModalityDraft((draft) => ({ ...draft, lotName: e.target.value }))}
                              />

                              <div style={{ display: "flex", gap: 8 }}>
                                <input
                                  className="tinput"
                                  placeholder="Valor, ex: 79,00"
                                  value={nativeModalityDraft.price}
                                  onChange={(e) => setNativeModalityDraft((draft) => ({ ...draft, price: e.target.value }))}
                                />

                                <input
                                  className="tinput"
                                  placeholder="Vagas"
                                  value={nativeModalityDraft.totalSlots}
                                  onChange={(e) => setNativeModalityDraft((draft) => ({ ...draft, totalSlots: e.target.value }))}
                                />
                              </div>

                              <button
                                type="button"
                                onClick={() => {
                                  const modalityName = nativeModalityDraft.name.trim();
                                  const lotName = nativeModalityDraft.lotName.trim();
                                  const priceText = nativeModalityDraft.price.trim().replace(",", ".");
                                  const priceNumber = Number(priceText);
                                  const slotsNumber = Number(nativeModalityDraft.totalSlots);

                                  if (!modalityName || !lotName || !Number.isFinite(priceNumber) || priceNumber <= 0 || !Number.isFinite(slotsNumber) || slotsNumber <= 0) {
                                    alert("Preencha modalidade, lote, valor e vagas corretamente.");
                                    return;
                                  }

                                  setNativeRaceModalities((items) => ([
                                    ...items,
                                    {
                                      id: `mod-${Date.now()}`,
                                      name: modalityName,
                                      lots: [
                                        {
                                          id: `lot-${Date.now()}`,
                                          name: lotName,
                                          price: priceNumber,
                                          totalSlots: slotsNumber
                                        }
                                      ]
                                    }
                                  ]));

                                  setNativeModalityDraft({
                                    name: "",
                                    lotName: "1º lote",
                                    price: "",
                                    totalSlots: ""
                                  });
                                }}
                                style={{
                                  width: "100%",
                                  background: "linear-gradient(135deg, #7c3aed, #a855f7)",
                                  color: "#fff",
                                  border: "none",
                                  borderRadius: 14,
                                  padding: 14,
                                  fontSize: 14,
                                  fontWeight: 900,
                                  cursor: "pointer",
                                  fontFamily: "inherit"
                                }}
                              >
                                ＋ Adicionar modalidade
                              </button>
                            </div>
                          </div>

                          {nativeRaceModalities.length > 0 && (
                            <div style={{ marginBottom: 16 }}>
                              <p style={{ fontSize: 12, color: "#b9b9c4", fontWeight: 950, marginBottom: 12 }}>
                                MODALIDADES CADASTRADAS
                              </p>

                              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                                {nativeRaceModalities.map((modality) => {
                                  const lot = modality.lots?.[0];
                                  const formattedPrice = Number.isFinite(lot?.price)
                                    ? lot.price.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
                                    : "—";

                                  return (
                                    <div
                                      key={modality.id}
                                      style={{
                                        background: "rgba(255,255,255,0.04)",
                                        border: "1px solid rgba(255,255,255,0.10)",
                                        borderRadius: 18,
                                        padding: 14
                                      }}
                                    >
                                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, marginBottom: 10 }}>
                                        <div>
                                          <p style={{ fontSize: 16, color: "#fff", fontWeight: 950, marginBottom: 4 }}>
                                            {modality.name}
                                          </p>
                                          <p style={{ fontSize: 12.5, color: "#9e9eac", fontWeight: 800 }}>
                                            {lot?.name || "Lote"} · {lot?.totalSlots || 0} vagas
                                          </p>
                                        </div>

                                        <button
                                          type="button"
                                          onClick={() => setNativeRaceModalities((items) => items.filter((item) => item.id !== modality.id))}
                                          style={{
                                            background: "rgba(255,255,255,0.04)",
                                            border: "1px solid rgba(255,255,255,0.10)",
                                            color: "#aaa",
                                            borderRadius: 10,
                                            padding: "7px 10px",
                                            fontSize: 12,
                                            cursor: "pointer",
                                            fontFamily: "inherit"
                                          }}
                                        >
                                          🗑️
                                        </button>
                                      </div>

                                      <p style={{ fontSize: 18, color: "#fff", fontWeight: 950 }}>
                                        {formattedPrice}
                                      </p>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          <button
                            type="button"
                            disabled={nativeRaceModalities.length === 0}
                            onClick={() => {
                              if (nativeRaceModalities.length === 0) return;
                              setNativeRaceStep("review");
                            }}
                            style={{
                              width: "100%",
                              background: nativeRaceModalities.length > 0
                                ? "linear-gradient(135deg, #7c3aed, #a855f7)"
                                : "linear-gradient(135deg, rgba(124,58,237,0.45), rgba(168,85,247,0.45))",
                              color: "#fff",
                              border: "none",
                              borderRadius: 14,
                              padding: 16,
                              fontSize: 15,
                              fontWeight: 800,
                              cursor: nativeRaceModalities.length > 0 ? "pointer" : "not-allowed",
                              opacity: nativeRaceModalities.length > 0 ? 1 : 0.78,
                              fontFamily: "inherit"
                            }}
                          >
                            Próxima etapa: revisar e salvar
                          </button>
                        </div>
                      ) : (
                        <div style={{ marginBottom: 20 }}>
                          <button
                            type="button"
                            onClick={() => setNativeRaceStep("modalities")}
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 7,
                              background: "rgba(255,255,255,0.045)",
                              border: "1px solid rgba(255,255,255,0.10)",
                              color: "#d6d6df",
                              borderRadius: 999,
                              padding: "9px 12px",
                              fontSize: 12,
                              fontWeight: 900,
                              cursor: "pointer",
                              fontFamily: "inherit",
                              marginBottom: 16
                            }}
                          >
                            ← Voltar para modalidades e lotes
                          </button>

                          <div
                            style={{
                              background: "linear-gradient(135deg, rgba(124,58,237,0.15), rgba(255,255,255,0.035))",
                              border: "1px solid rgba(168,85,247,0.25)",
                              borderRadius: 20,
                              padding: 16,
                              marginBottom: 16
                            }}
                          >
                            <p style={{ fontSize: 12, color: "#c4a7ff", fontWeight: 950, marginBottom: 8 }}>
                              ETAPA 4
                            </p>
                            <p style={{ fontSize: 17, lineHeight: 1.25, color: "#fff", fontWeight: 950, marginBottom: 8 }}>
                              Revisar e salvar prova nativa
                            </p>
                            <p style={{ fontSize: 13, lineHeight: 1.5, color: "#b9b9c4", fontWeight: 750 }}>
                              Confira as informações antes de publicar a prova dentro do EuCorredor.
                            </p>
                          </div>

                          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 16 }}>
                            <div
                              style={{
                                background: "rgba(255,255,255,0.04)",
                                border: "1px solid rgba(255,255,255,0.10)",
                                borderRadius: 18,
                                padding: 14
                              }}
                            >
                              <p style={{ fontSize: 12, color: "#b9b9c4", fontWeight: 950, marginBottom: 10 }}>
                                DADOS DA PROVA
                              </p>
                              <p style={{ fontSize: 16, color: "#fff", fontWeight: 950, marginBottom: 6 }}>
                                {nativeRaceForm.name}
                              </p>
                              <p style={{ fontSize: 13, color: "#a4a4b2", fontWeight: 800, lineHeight: 1.5 }}>
                                {nativeRaceForm.eventDate} · {nativeRaceForm.city}/{nativeRaceForm.state}
                              </p>
                              <p style={{ fontSize: 13, color: "#a4a4b2", fontWeight: 800, lineHeight: 1.5 }}>
                                Organizador: {nativeRaceForm.organizerName}
                              </p>
                              <p style={{ fontSize: 13, color: "#a4a4b2", fontWeight: 800, lineHeight: 1.5 }}>
                                Status: {nativeRaceForm.salesStatus === "open" ? "Vendas abertas" : nativeRaceForm.salesStatus === "closed" ? "Vendas encerradas" : "Rascunho"}
                              </p>
                            </div>

                            <div
                              style={{
                                background: "rgba(255,255,255,0.04)",
                                border: "1px solid rgba(255,255,255,0.10)",
                                borderRadius: 18,
                                padding: 14
                              }}
                            >
                              <p style={{ fontSize: 12, color: "#b9b9c4", fontWeight: 950, marginBottom: 10 }}>
                                KIT E CONFIGURAÇÕES
                              </p>

                              {nativeKitImagePreview && (
                                <div
                                  style={{
                                    width: "100%",
                                    height: 170,
                                    borderRadius: 16,
                                    overflow: "hidden",
                                    border: "1px solid rgba(255,255,255,0.12)",
                                    background: "#0f0f15",
                                    marginBottom: 12
                                  }}
                                >
                                  <img
                                    src={nativeKitImagePreview}
                                    alt="Prévia do kit"
                                    style={{
                                      width: "100%",
                                      height: "100%",
                                      objectFit: "cover",
                                      display: "block"
                                    }}
                                  />
                                </div>
                              )}

                              <p style={{ fontSize: 13, color: "#a4a4b2", fontWeight: 800, lineHeight: 1.5 }}>
                                {nativeRaceForm.kitDescription?.trim() || "Sem descrição de kit."}
                              </p>

                              <p style={{ fontSize: 13, color: "#a4a4b2", fontWeight: 800, lineHeight: 1.5, marginTop: 8 }}>
                                Itens: {nativeRaceForm.kitItemsText?.trim() || "Não informado"}
                              </p>

                              <p style={{ fontSize: 13, color: "#a4a4b2", fontWeight: 800, lineHeight: 1.5 }}>
                                Camiseta: {nativeRaceForm.hasTshirt ? `Sim · ${nativeRaceForm.tshirtSizesText || "tamanhos não informados"}` : "Não"}
                              </p>

                              <p style={{ fontSize: 13, color: "#a4a4b2", fontWeight: 800, lineHeight: 1.5 }}>
                                Contato de emergência: {nativeRaceForm.requiresEmergencyContact ? "Obrigatório" : "Não obrigatório"}
                              </p>
                            </div>

                            <div
                              style={{
                                background: "rgba(255,255,255,0.04)",
                                border: "1px solid rgba(255,255,255,0.10)",
                                borderRadius: 18,
                                padding: 14
                              }}
                            >
                              <p style={{ fontSize: 12, color: "#b9b9c4", fontWeight: 950, marginBottom: 10 }}>
                                MODALIDADES E LOTES
                              </p>

                              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                                {nativeRaceModalities.map((modality) => {
                                  const lot = modality.lots?.[0];
                                  const formattedPrice = Number.isFinite(lot?.price)
                                    ? lot.price.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
                                    : "—";

                                  return (
                                    <div
                                      key={modality.id}
                                      style={{
                                        borderRadius: 14,
                                        padding: 12,
                                        background: "rgba(255,255,255,0.035)",
                                        border: "1px solid rgba(255,255,255,0.08)"
                                      }}
                                    >
                                      <p style={{ fontSize: 15, color: "#fff", fontWeight: 950, marginBottom: 4 }}>
                                        {modality.name}
                                      </p>
                                      <p style={{ fontSize: 12.5, color: "#a4a4b2", fontWeight: 800 }}>
                                        {lot?.name || "Lote"} · {formattedPrice} · {lot?.totalSlots || 0} vagas
                                      </p>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={handleSaveNativeRace}
                            disabled={savingNativeRace}
                            style={{
                              width: "100%",
                              background: savingNativeRace
                                ? "linear-gradient(135deg, rgba(124,58,237,0.5), rgba(168,85,247,0.5))"
                                : "linear-gradient(135deg, #7c3aed, #a855f7)",
                              color: "#fff",
                              border: "none",
                              borderRadius: 14,
                              padding: 16,
                              fontSize: 15,
                              fontWeight: 900,
                              cursor: savingNativeRace ? "wait" : "pointer",
                              opacity: savingNativeRace ? 0.82 : 1,
                              fontFamily: "inherit"
                            }}
                          >
                            {savingNativeRace ? "Salvando prova..." : "Salvar prova nativa"}
                          </button>
                        </div>
                      )}

                    {adminEventsView === "agenda" && dbEvents.length > 0 && (
                      <>
                        <p style={{ fontSize: 12, color: "#555", marginBottom: 12, fontWeight: 700 }}>Eventos cadastrados</p>
                        {dbEvents.map((e) => (
                          <div key={e.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid #1e1e2e" }}>
                            <div>
                              <p style={{ fontWeight: 700, fontSize: 13 }}>{e.name}</p>
                              <p style={{ fontSize: 11, color: "#555" }}>{e.date} · {e.distance} · {e.city}{e.featured ? " · destaque" : ""}</p>
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                              <button
                                onClick={() => e.featured ? handleRemoveFeaturedEvent(e.id) : handleSetFeaturedEvent(e.id)}
                                style={{
                                  background: e.featured ? "rgba(225,29,72,0.16)" : "none",
                                  border: e.featured ? "1px solid #e11d48" : "1px solid #1e1e2e",
                                  borderRadius: 8,
                                  padding: "5px 9px",
                                  color: e.featured ? "#fff" : "#777",
                                  fontSize: 12,
                                  cursor: "pointer",
                                  fontFamily: "inherit",
                                  fontWeight: 800
                                }}
                              >
                                {e.featured ? "★" : "☆"}
                              </button>
                              <button onClick={() => handleDeleteEvent(e.id)} style={{ background: "none", border: "1px solid #1e1e2e", borderRadius: 8, padding: "5px 10px", color: "#555", fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>🗑️</button>
                            </div>
                          </div>
                        ))}
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* COMUNIDADE */}
          {tab === "comunidade" && (
            <div style={{ display: "flex", flexDirection: "column", paddingBottom: 105 }}>
              <div style={{ display: "flex", borderBottom: "1px solid #1e1e2e", margin: "12px 0 18px" }}>
                {[
                  { id: "todos", label: "Comunidade" },
                  { id: "amigos", label: "Amigos" },
                  { id: "clube", label: "Clube" },
                ].map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setCommFeed(t.id)}
                    style={{
                      flex: 1,
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      fontFamily: "inherit",
                      fontSize: 14,
                      fontWeight: 900,
                      padding: "13px 0 12px",
                      color: commFeed === t.id ? "#f8f8fb" : "#555563",
                      position: "relative"
                    }}
                  >
                    {t.label}
                    {commFeed === t.id && (
                      <div style={{ width: 30, height: 2, background: "#e11d48", borderRadius: 999, margin: "7px auto 0", boxShadow: "0 0 18px rgba(225,29,72,0.6)" }} />
                    )}
                  </button>
                ))}
              </div>

              {commFeed !== "clube" && (
                <>
                  <div style={{ marginBottom: 20 }}>
                    <p style={{ fontSize: 13, fontWeight: 900, color: "#f4f4f6", marginBottom: 10 }}>
                      {commFeed === "amigos" ? "Compartilhe com seus amigos" : "Compartilhe com a comunidade"}
                    </p>
                    <div style={{
                      background: "linear-gradient(180deg, rgba(255,255,255,0.045), rgba(255,255,255,0.025))",
                      border: "1px solid rgba(255,255,255,0.10)",
                      borderRadius: 20,
                      overflow: "hidden",
                      boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06)"
                    }}>
                      <button
                        onClick={() => { setShowPublish(true); setPublishType("post"); }}
                        style={{
                          width: "100%",
                          display: "flex",
                          alignItems: "center",
                          gap: 12,
                          background: "none",
                          border: "none",
                          padding: 14,
                          color: "#777",
                          cursor: "pointer",
                          fontFamily: "inherit",
                          textAlign: "left"
                        }}
                      >
                        {getAvatar(profile, 42)}
                        <span style={{ fontSize: 13, color: "#777" }}>No que você está pensando?</span>
                      </button>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", borderTop: "1px solid #1e1e2e" }}>
                        {[
                          { label: "Foto", icon: "▧", type: "foto" },
                          { label: "Escrever", icon: "✎", type: "post" },
                        ].map((item, idx) => (
                          <button
                            key={item.type}
                            onClick={() => { setShowPublish(true); setPublishType(item.type); }}
                            style={{
                              background: "none",
                              border: "none",
                              borderRight: idx < 1 ? "1px solid #1e1e2e" : "none",
                              padding: "12px 6px",
                              color: "#cfcfd8",
                              fontSize: 12,
                              fontWeight: 800,
                              cursor: "pointer",
                              fontFamily: "inherit",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              gap: 6
                            }}
                          >
                            <span style={{ color: "#e11d48" }}>{item.icon}</span> {item.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div style={{ marginBottom: 22 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                      <p style={{ fontSize: 13, fontWeight: 900, color: "#f4f4f6" }}>Stories</p>
                      <button style={{ background: "none", border: "none", color: "#e11d48", fontSize: 11, fontWeight: 900, cursor: "pointer", fontFamily: "inherit" }}>Ver todos</button>
                    </div>
                    {loadingSections.stories ? (
                      <StoriesSkeleton />
                    ) : (
                      <div style={{ display: "flex", gap: 13, overflowX: "auto", padding: "2px 2px 4px" }}>
                      {(() => {
                        const myStory = stories.find(s => s.user_id === user.id);
                        return (
                          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, flexShrink: 0, cursor: "pointer" }} onClick={() => setShowStoryUpload(true)}>
                            <div style={{ position: "relative" }}>
                              <div style={{ width: 58, height: 58, borderRadius: "50%", padding: 2, background: myStory ? `linear-gradient(135deg, ${level.color}, #e11d48)` : "#1e1e2e" }}>
                                <div style={{ width: "100%", height: "100%", borderRadius: "50%", background: "#0a0a0f", padding: 2 }}>
                                  <div style={{ width: "100%", height: "100%", borderRadius: "50%", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", background: "#13131a", color: "#fff", fontWeight: 900 }}>
                                    {profile?.avatar_url ? <img src={profile.avatar_url} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : level.icon}
                                  </div>
                                </div>
                              </div>
                              <div style={{ position: "absolute", right: -2, bottom: -2, width: 21, height: 21, borderRadius: "50%", background: "#e11d48", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 900, border: "2px solid #0a0a0f" }}>+</div>
                            </div>
                            <span style={{ fontSize: 10, color: "#888", fontWeight: 700 }}>Seu story</span>
                          </div>
                        );
                      })()}

                      {Object.values(stories.filter(s => s.user_id !== user.id && !isBlockedUser(s.user_id)).reduce((acc, s) => {
                        if (!acc[s.user_id]) acc[s.user_id] = s;
                        return acc;
                      }, {})).slice(0, 8).map((s, i) => {
                        const seen = seenStories[s.user_id];
                        const storyColor = getLevelColor(s.profiles?.level);
                        return (
                          <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, flexShrink: 0, cursor: "pointer" }} onClick={() => { setSeenStories(st => ({ ...st, [s.user_id]: true })); setActiveStory({ user: s.profiles?.name, color: storyColor, level: s.profiles?.level, media_url: s.media_url, emoji: getLevelIcon(s.profiles?.level), avatar_url: s.profiles?.avatar_url }); }}>
                            <div style={{ width: 58, height: 58, borderRadius: "50%", padding: 2, background: seen ? "#1e1e2e" : `linear-gradient(135deg, #e11d48, ${storyColor})` }}>
                              <div style={{ width: "100%", height: "100%", borderRadius: "50%", background: "#0a0a0f", padding: 2 }}>
                                <div style={{ width: "100%", height: "100%", borderRadius: "50%", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", background: `${storyColor}22`, color: "#fff", fontWeight: 900 }}>
                                  {s.profiles?.avatar_url ? <img src={s.profiles.avatar_url} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : getLevelIcon(s.profiles?.level)}
                                </div>
                              </div>
                            </div>
                            <span style={{ fontSize: 10, color: seen ? "#555" : "#f0f0f0", fontWeight: 700, maxWidth: 58, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.profiles?.name?.split(" ")[0] || "Story"}</span>
                          </div>
                        );
                      })}
                      </div>
                    )}
                  </div>

                  {commFeed === "todos" && loadingSections.suggestions && (
                    <div style={{ marginBottom: 22 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                        <SkeletonBlock width="48%" height={13} />
                        <SkeletonBlock width={52} height={11} />
                      </div>
                      <SuggestionsSkeleton />
                    </div>
                  )}

                  {commFeed === "todos" && !loadingSections.suggestions && suggestions.length > 0 && (
                    <div style={{ marginBottom: 22 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                        <p style={{ fontSize: 13, fontWeight: 900, color: "#f4f4f6" }}>Corredores para seguir</p>
                        <button style={{ background: "none", border: "none", color: "#e11d48", fontSize: 11, fontWeight: 900, cursor: "pointer", fontFamily: "inherit" }}>Ver todos</button>
                      </div>
                      <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 4 }}>
                        {suggestions.filter((u) => !isBlockedUser(u.id)).slice(0, 6).map((u) => (
                          <div key={u.id} style={{ width: 112, flexShrink: 0, background: "linear-gradient(180deg, rgba(255,255,255,0.055), rgba(255,255,255,0.025))", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 18, padding: "14px 10px", display: "flex", flexDirection: "column", alignItems: "center", cursor: "pointer" }} onClick={() => openProfile(u.id)}>
                            <div style={{ width: 54, height: 54, borderRadius: "50%", border: `2px solid ${getLevelColor(u.level)}`, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", background: "#1e1e2e", color: "#fff", fontWeight: 900, marginBottom: 8 }}>
                              {u.avatar_url ? <img src={u.avatar_url} alt="av" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : u.name?.charAt(0) || "?"}
                            </div>
                            <p style={{ fontSize: 12, fontWeight: 900, color: "#fff", maxWidth: 90, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.name?.split(" ")[0]}</p>
                            <p style={{ fontSize: 10, color: getLevelColor(u.level), fontWeight: 800, marginTop: 2 }}>{getLevelIcon(u.level)} {u.level}</p>
                            <button onClick={(e) => { e.stopPropagation(); handleFollow(u.id); }} style={{ width: "100%", background: "#e11d48", border: "none", color: "#fff", borderRadius: 999, padding: "8px 0", fontSize: 11, fontWeight: 900, cursor: "pointer", fontFamily: "inherit", marginTop: 10 }}>
                              Seguir
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {commFeed === "amigos" && (
                    <div style={{ background: "linear-gradient(135deg, rgba(225,29,72,0.12), rgba(255,255,255,0.035))", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 18, padding: 16, marginBottom: 16, display: "flex", alignItems: "center", gap: 12 }}>
                      <div style={{ width: 44, height: 44, borderRadius: "50%", background: "rgba(225,29,72,0.16)", display: "flex", alignItems: "center", justifyContent: "center", color: "#e11d48", fontSize: 22 }}>👥</div>
                      <div>
                        <p style={{ fontWeight: 900, fontSize: 14, marginBottom: 4 }}>Este é o feed dos seus amigos</p>
                        <p style={{ color: "#777", fontSize: 12, lineHeight: 1.45 }}>Aqui aparecem apenas publicações de quem você segue.</p>
                      </div>
                    </div>
                  )}

                  {loadingSections.posts ? (
                    <>
                      <PostSkeleton />
                      <PostSkeleton withImage={false} />
                    </>
                  ) : (() => {
                    const visiblePosts = (commFeed === "amigos" ? posts.filter(p => p.user_id === user.id || realFollowing[p.user_id]) : posts).filter((post) => !isBlockedUser(post.user_id));
                    if (visiblePosts.length === 0) {
                      return (
                        <EmptyState
                          icon={commFeed === "amigos" ? "👥" : "💬"}
                          title={commFeed === "amigos" ? "Seu feed de amigos está começando" : "A comunidade ainda está quieta"}
                          description={commFeed === "amigos" ? "Siga corredores para ver publicações só de quem você acompanha." : "Publique uma foto ou escreva algo para abrir a conversa."}
                          actionLabel={commFeed === "amigos" ? "Ver comunidade" : "Criar publicação"}
                          onAction={() => commFeed === "amigos" ? setCommFeed("todos") : setShowPublish(true)}
                        />
                      );
                    }
                    return visiblePosts.map((p) => (
                      <div key={p.id} style={{ background: "linear-gradient(180deg, rgba(255,255,255,0.052), rgba(255,255,255,0.025))", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 22, padding: 16, marginBottom: 14, boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05)" }}>
                        <div style={{ display: "flex", gap: 11, alignItems: "center", marginBottom: 13 }}>
                          <div style={{ cursor: "pointer" }} onClick={() => p.profiles?.id && openProfile(p.profiles.id)}>{getAvatar(p.profiles, 44)}</div>
                          <div style={{ flex: 1, minWidth: 0, cursor: "pointer" }} onClick={() => p.profiles?.id && openProfile(p.profiles.id)}>
                            <p style={{ fontWeight: 900, fontSize: 14, lineHeight: 1.15, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.profiles?.name || "Corredor"}</p>
                            <p style={{ fontSize: 11, color: "#777", marginTop: 3 }}>
                              {p.profiles?.handle ? `@${p.profiles.handle}` : "@corredor"} · <span style={{ color: getLevelColor(p.profiles?.level), fontWeight: 800 }}>{getLevelIcon(p.profiles?.level)} {p.profiles?.level || "Iniciante"}</span>{p.created_at ? ` · ${timeAgo(p.created_at)}` : ""}
                            </p>
                          </div>
                          {p.user_id !== user.id && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                openModerationMenu({
                                  targetType: "post",
                                  targetId: p.id,
                                  targetUserId: p.user_id,
                                  targetLabel: p.profiles?.handle ? `@${p.profiles.handle}` : p.profiles?.name || "usuário",
                                });
                              }}
                              style={{ width: 36, height: 36, borderRadius: 12, background: "rgba(255,255,255,0.035)", border: "1px solid rgba(255,255,255,0.08)", color: "#888", fontSize: 18, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
                              title="Opções"
                            >
                              •••
                            </button>
                          )}
                        </div>

                        {p.text && <p style={{ fontSize: 14, color: "#f0f0f0", lineHeight: 1.55, marginBottom: 13 }}>{p.text}</p>}
                        {p.photo_url && (
                          <button
                            onClick={() => setSelectedPhotoPost(p)}
                            style={{
                              width: "100%",
                              border: "none",
                              padding: 0,
                              marginBottom: 13,
                              borderRadius: 16,
                              overflow: "hidden",
                              background: "#0d0d18",
                              cursor: "pointer",
                              display: "block"
                            }}
                          >
                            <img
                              src={p.photo_url}
                              alt="post"
                              style={{
                                width: "100%",
                                height: "auto",
                                maxHeight: 520,
                                objectFit: "contain",
                                display: "block",
                                background: "#0d0d18"
                              }}
                            />
                          </button>
                        )}

                        <div style={{ display: "flex", alignItems: "center", gap: 22, paddingTop: 10 }}>
                          <button className="lbtn" onClick={() => handleLikePost(p.id, p.user_id)} style={{ color: liked[p.id] ? "#e11d48" : "#8b8b96", fontWeight: 800 }}>
                            <span style={{ fontSize: 18 }}>{liked[p.id] ? "♥" : "♡"}</span>
                            <span>{(p.likes || 0) + (liked[p.id] ? 1 : 0)}</span>
                          </button>

                          <button
                            className="lbtn"
                            onClick={() => {
                              if (openComments === p.id) {
                                setOpenComments(null);
                              } else {
                                setOpenComments(p.id);
                                loadComments(p.id);
                              }
                            }}
                            style={{ color: openComments === p.id ? "#e11d48" : "#8b8b96", fontWeight: 800 }}
                          >
                            <span style={{ fontSize: 18 }}>💬</span>
                            <span>{(comments[p.id] || []).length || p.comments || 0}</span>
                          </button>

                          <button className="lbtn" onClick={() => handleShare("post", p)} style={{ marginLeft: "auto", color: "#8b8b96", fontSize: 18 }}>↗</button>
                          {(p.user_id === user.id || user.id === ADMIN_ID) && <button className="lbtn" onClick={() => handleDeletePost(p.id)} style={{ color: "#666", fontSize: 16 }}>🗑️</button>}
                        </div>

                        {openComments === p.id && (
                          <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid rgba(255,255,255,0.08)" }}>
                            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                              {commentsLoading[p.id] ? (
                                <div style={{ display: "flex", gap: 9, alignItems: "center" }}>
                                  <SkeletonCircle size={28} />
                                  <div style={{ flex: 1 }}>
                                    <SkeletonBlock width="42%" height={11} style={{ marginBottom: 7 }} />
                                    <SkeletonBlock width="78%" height={12} />
                                  </div>
                                </div>
                              ) : (comments[p.id] || []).length > 0 ? (
                                (comments[p.id] || []).map((comment) => (
                                  <div key={comment.id} style={{ display: "flex", alignItems: "flex-start", gap: 9 }}>
                                    {getAvatar(comment.profiles, 28)}
                                    <div style={{ flex: 1, background: "rgba(255,255,255,0.045)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: "9px 11px", position: "relative" }}>
                                      {comment.user_id !== user.id && (
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            openModerationMenu({
                                              targetType: "comment",
                                              targetId: comment.id,
                                              targetUserId: comment.user_id,
                                              targetLabel: comment.profiles?.handle ? `@${comment.profiles.handle}` : comment.profiles?.name || "usuário",
                                            });
                                          }}
                                          title="Opções"
                                          style={{ position: "absolute", top: 6, right: 7, background: "none", border: "none", color: "#666", fontSize: 15, cursor: "pointer", padding: 2 }}
                                        >
                                          •••
                                        </button>
                                      )}
                                      <p style={{ fontSize: 12, fontWeight: 900, color: "#fff", marginBottom: 3, paddingRight: comment.user_id !== user.id ? 28 : 0 }}>{comment.profiles?.name || "Corredor"}</p>
                                      <p style={{ fontSize: 13, color: "#d7d7df", lineHeight: 1.4 }}>{comment.text}</p>
                                    </div>
                                  </div>
                                ))
                              ) : (
                                <EmptyState
                                  compact
                                  icon="💬"
                                  title="Nenhum comentário ainda"
                                  description="Seja a primeira pessoa a comentar esta publicação."
                                />
                              )}
                            </div>

                            <div style={{ display: "flex", gap: 8, marginTop: 13 }}>
                              <input
                                value={newComment}
                                onChange={(e) => setNewComment(e.target.value)}
                                placeholder="Escreva um comentário..."
                                style={{
                                  flex: 1,
                                  background: "#0f0f17",
                                  border: "1px solid #1e1e2e",
                                  borderRadius: 14,
                                  padding: "11px 13px",
                                  color: "#fff",
                                  outline: "none",
                                  fontSize: 13,
                                  fontFamily: "inherit"
                                }}
                              />

                              <button
                                onClick={() => handleComment(p.id)}
                                disabled={!newComment.trim()}
                                style={{
                                  background: newComment.trim() ? "linear-gradient(135deg, #e11d48, #ff3d63)" : "#2a2a35",
                                  color: "#fff",
                                  border: "none",
                                  borderRadius: 14,
                                  padding: "0 14px",
                                  fontSize: 13,
                                  fontWeight: 900,
                                  cursor: newComment.trim() ? "pointer" : "not-allowed",
                                  fontFamily: "inherit"
                                }}
                              >
                                Enviar
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ));
                  })()}
                </>
              )}

              {commFeed === "clube" && (
                <div>
                  {activeClub ? (
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                        <button
                          onClick={() => {
                            setActiveClub(null);
                            setClubNotices([]);
                            setClubPosts([]);
                            setClubMembers([]);
                            setPendingRequests([]);
                            setActiveClubTab("posts");
                          }}
                          style={{ width: 36, height: 36, borderRadius: "50%", background: "#13131a", border: "1px solid #1e1e2e", color: "#fff", fontSize: 18, cursor: "pointer" }}
                        >
                          ←
                        </button>

                        <div style={{ width: 54, height: 54, borderRadius: 16, background: "linear-gradient(135deg, #e11d48, #f97316)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, overflow: "hidden", flexShrink: 0 }}>
                          {activeClub.avatar_url ? <img src={activeClub.avatar_url} alt={activeClub.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : "🏃"}
                        </div>

                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontWeight: 900, fontSize: 18, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{activeClub.name}</p>
                          <p style={{ fontSize: 12, color: "#777", marginTop: 3 }}>
                            {clubMembers.length} {clubMembers.length === 1 ? "membro" : "membros"}
                            <span style={{ color: "#22c55e", fontWeight: 900 }}> · {clubMembers.filter((member) => isUserOnline(member.profiles?.id)).length} online</span>
                            {activeClub.owner_id === user.id && <span style={{ color: "#e11d48", fontWeight: 900 }}> · você é administrador</span>}
                          </p>
                        </div>

                        {activeClub.owner_id === user.id ? (
                          <button
                            onClick={() => setShowCreateClubNotice(true)}
                            style={{ background: "#e11d48", color: "#fff", border: "none", borderRadius: 999, padding: "10px 13px", fontSize: 11, fontWeight: 900, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}
                          >
                            + Novo aviso
                          </button>
                        ) : clubMembership[activeClub.id] === "approved" ? (
                          <button onClick={() => handleLeaveClub(activeClub.id)} style={{ background: "none", border: "1px solid #1e1e2e", borderRadius: 12, padding: "8px 11px", fontSize: 11, color: "#777", cursor: "pointer", fontFamily: "inherit", fontWeight: 800 }}>Sair</button>
                        ) : null}
                      </div>

                      {clubNotices.find((n) => n.is_pinned) && (() => {
                        const pinnedNotice = clubNotices.find((n) => n.is_pinned);
                        return (
                          <div style={{ background: "linear-gradient(135deg, rgba(225,29,72,0.17), rgba(255,255,255,0.035))", border: "1px solid rgba(225,29,72,0.46)", borderRadius: 22, padding: 16, marginBottom: 18, boxShadow: "0 20px 40px rgba(0,0,0,0.22)" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 10 }}>
                              <p style={{ color: "#ff4a70", fontSize: 11, fontWeight: 900 }}>📌 Aviso fixado</p>
                              {activeClub.owner_id === user.id && <p style={{ color: "#777", fontSize: 10, fontWeight: 800 }}>Fixado por você 👑</p>}
                            </div>
                            <p style={{ fontSize: 18, fontWeight: 900, marginBottom: 10 }}>{pinnedNotice.title}</p>
                            {pinnedNotice.body && <p style={{ fontSize: 13, color: "#ddd", lineHeight: 1.5, marginBottom: 10 }}>{pinnedNotice.body}</p>}
                            <div style={{ display: "grid", gap: 6 }}>
                              {pinnedNotice.location && <p style={{ fontSize: 13, color: "#eee" }}>⌖ <strong>Local:</strong> {pinnedNotice.location}</p>}
                              {pinnedNotice.notice_time && <p style={{ fontSize: 13, color: "#eee" }}>◷ <strong>Horário:</strong> {pinnedNotice.notice_time}</p>}
                              {pinnedNotice.distance && <p style={{ fontSize: 13, color: "#eee" }}>⌁ <strong>Distância:</strong> {pinnedNotice.distance}</p>}
                            </div>
                          </div>
                        );
                      })()}

                      <div style={{ display: "flex", borderBottom: "1px solid #1e1e2e", marginBottom: 16 }}>
                        {[
                          { id: "posts", label: "Posts" },
                          { id: "avisos", label: "Avisos" },
                          { id: "membros", label: "Membros" },
                        ].map((item) => (
                          <button
                            key={item.id}
                            onClick={() => setActiveClubTab(item.id)}
                            style={{ flex: 1, background: "none", border: "none", color: activeClubTab === item.id ? "#fff" : "#666", fontSize: 13, fontWeight: 900, cursor: "pointer", fontFamily: "inherit", padding: "12px 0" }}
                          >
                            {item.label}
                            {activeClubTab === item.id && <div style={{ width: 28, height: 2, background: "#e11d48", borderRadius: 2, margin: "7px auto 0" }} />}
                          </button>
                        ))}
                      </div>

                      {activeClubTab === "posts" && (
                        <div>
                          {clubMembership[activeClub.id] === "approved" && (
                            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                              <input className="tinput" placeholder="Compartilhe algo com o clube..." value={newClubPost} onChange={(e) => setNewClubPost(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleClubPost()} style={{ flex: 1 }} />
                              <button onClick={handleClubPost} className="jbtn" style={{ borderRadius: 12 }}>↑</button>
                            </div>
                          )}

                          {clubPosts.length === 0 && (
                            <EmptyState
                              icon="🗣️"
                              title="O clube ainda não tem publicações"
                              description="Comece a conversa com um aviso, convite ou dica para os membros."
                            />
                          )}

                          {clubPosts.map((p) => (
                            <div key={p.id} style={{ background: "linear-gradient(180deg, rgba(255,255,255,0.052), rgba(255,255,255,0.025))", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 20, padding: 15, marginBottom: 12 }}>
                              <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 10 }}>
                                {getAvatar(p.profiles, 38)}
                                <div style={{ flex: 1 }}>
                                  <p style={{ fontSize: 14, fontWeight: 900 }}>{p.profiles?.name || "Corredor"}</p>
                                  <p style={{ fontSize: 11, color: "#777" }}>{timeAgo(p.created_at)}</p>
                                </div>
                              </div>
                              <p style={{ fontSize: 14, lineHeight: 1.55, color: "#f4f4f6" }}>{p.text}</p>
                            </div>
                          ))}
                        </div>
                      )}

                      {activeClubTab === "avisos" && (
                        <div>
                          {activeClub.owner_id === user.id && (
                            <button
                              onClick={() => setShowCreateClubNotice(true)}
                              style={{ width: "100%", background: "#e11d48", color: "#fff", border: "none", borderRadius: 16, padding: 14, fontSize: 13, fontWeight: 900, cursor: "pointer", fontFamily: "inherit", marginBottom: 14 }}
                            >
                              + Criar novo aviso
                            </button>
                          )}

                          {clubNotices.length === 0 && (
                            <EmptyState
                              icon="📌"
                              title="Nenhum aviso publicado"
                              description={activeClub.owner_id === user.id ? "Crie um aviso para organizar treinos, encontros ou recados importantes." : "Quando a administração publicar um aviso, ele aparece aqui."}
                              actionLabel={activeClub.owner_id === user.id ? "Criar primeiro aviso" : undefined}
                              onAction={activeClub.owner_id === user.id ? () => setShowCreateClubNotice(true) : undefined}
                            />
                          )}

                          {clubNotices.map((notice) => (
                            <div key={notice.id} style={{ background: notice.is_pinned ? "rgba(225,29,72,0.08)" : "linear-gradient(180deg, rgba(255,255,255,0.052), rgba(255,255,255,0.025))", border: notice.is_pinned ? "1px solid rgba(225,29,72,0.35)" : "1px solid rgba(255,255,255,0.10)", borderRadius: 20, padding: 15, marginBottom: 12 }}>
                              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginBottom: 8 }}>
                                <p style={{ color: notice.is_pinned ? "#ff4a70" : "#777", fontSize: 11, fontWeight: 900 }}>{notice.is_pinned ? "📌 Aviso fixado" : "Aviso do clube"}</p>
                                {activeClub.owner_id === user.id && (
                                  <div style={{ display: "flex", gap: 8 }}>
                                    {!notice.is_pinned && <button onClick={() => handlePinClubNotice(notice.id)} style={{ background: "none", border: "none", color: "#e11d48", fontSize: 11, fontWeight: 900, cursor: "pointer", fontFamily: "inherit" }}>Fixar</button>}
                                    <button onClick={() => handleDeleteClubNotice(notice.id)} style={{ background: "none", border: "none", color: "#777", fontSize: 11, fontWeight: 900, cursor: "pointer", fontFamily: "inherit" }}>Excluir</button>
                                  </div>
                                )}
                              </div>
                              <p style={{ fontSize: 16, fontWeight: 900, marginBottom: 8 }}>{notice.title}</p>
                              {notice.body && <p style={{ fontSize: 13, color: "#ddd", lineHeight: 1.5, marginBottom: 10 }}>{notice.body}</p>}
                              <div style={{ display: "grid", gap: 5 }}>
                                {notice.location && <p style={{ fontSize: 12, color: "#aaa" }}>⌖ {notice.location}</p>}
                                {notice.notice_time && <p style={{ fontSize: 12, color: "#aaa" }}>◷ {notice.notice_time}</p>}
                                {notice.distance && <p style={{ fontSize: 12, color: "#aaa" }}>⌁ {notice.distance}</p>}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {activeClubTab === "membros" && (
                        <div>
                          {activeClub.owner_id === user.id && pendingRequests.length > 0 && (
                            <div style={{ background: "rgba(225,29,72,0.08)", border: "1px solid rgba(225,29,72,0.22)", borderRadius: 18, padding: 14, marginBottom: 16 }}>
                              <p style={{ fontSize: 12, fontWeight: 900, color: "#e11d48", marginBottom: 10 }}>Solicitações pendentes ({pendingRequests.length})</p>
                              {pendingRequests.map((request) => (
                                <div key={request.id} style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 10 }}>
                                  {getAvatar(request.profiles, 34)}
                                  <div style={{ flex: 1 }}>
                                    <p style={{ fontSize: 13, fontWeight: 900 }}>{request.profiles?.name || "Corredor"}</p>
                                    <p style={{ fontSize: 11, color: "#777" }}>@{request.profiles?.handle || "usuario"}</p>
                                  </div>
                                  <button onClick={() => handleApproveMember(request.id)} style={{ background: "#e11d48", border: "none", color: "#fff", borderRadius: 999, padding: "7px 10px", fontSize: 11, fontWeight: 900, cursor: "pointer", fontFamily: "inherit" }}>Aceitar</button>
                                  <button onClick={() => handleRejectMember(request.id)} style={{ background: "none", border: "1px solid #1e1e2e", color: "#888", borderRadius: 999, padding: "7px 10px", fontSize: 11, fontWeight: 900, cursor: "pointer", fontFamily: "inherit" }}>Recusar</button>
                                </div>
                              ))}
                            </div>
                          )}

                          {clubMembers.map((member) => {
                            const memberOnline = isUserOnline(member.profiles?.id);
                            return (
                              <div key={member.id} style={{ display: "flex", alignItems: "center", gap: 12, background: "linear-gradient(180deg, rgba(255,255,255,0.045), rgba(255,255,255,0.025))", border: "1px solid rgba(255,255,255,0.09)", borderRadius: 18, padding: 13, marginBottom: 10 }}>
                                <div style={{ position: "relative", flexShrink: 0 }}>
                                  {getAvatar(member.profiles, 42)}
                                  <span style={{ position: "absolute", right: 0, bottom: 0, width: 12, height: 12, borderRadius: "50%", background: memberOnline ? "#22c55e" : "#555", border: "2px solid #13131a", boxShadow: memberOnline ? "0 0 14px rgba(34,197,94,0.65)" : "none" }} />
                                </div>
                                <div style={{ flex: 1 }}>
                                  <p style={{ fontSize: 14, fontWeight: 900 }}>{member.profiles?.name || "Corredor"}</p>
                                  <p style={{ fontSize: 11, color: "#777" }}>@{member.profiles?.handle || "usuario"} · {member.role === "owner" ? "Administrador" : "Membro"}</p>
                                  <p style={{ fontSize: 11, color: memberOnline ? "#22c55e" : "#666", fontWeight: 900, marginTop: 3 }}>● {memberOnline ? "Online agora" : "Offline"}</p>
                                </div>
                                {member.profiles?.id && member.profiles.id !== user.id && (
                                  <button onClick={() => openProfile(member.profiles.id)} style={{ background: "none", border: "1px solid #1e1e2e", color: "#ddd", borderRadius: 999, padding: "7px 10px", fontSize: 11, fontWeight: 900, cursor: "pointer", fontFamily: "inherit" }}>Ver</button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                        <p style={{ fontSize: 15, fontWeight: 900, color: "#f4f4f6" }}>Meus clubes</p>
                        <button onClick={() => setShowCreateClub(true)} style={{ background: "#e11d48", color: "#fff", border: "none", borderRadius: 12, padding: "9px 14px", fontSize: 12, fontWeight: 900, cursor: "pointer", fontFamily: "inherit" }}>+ Criar clube</button>
                      </div>

                      {myClubs.length === 0 && (
                        <div style={{ marginBottom: 16 }}>
                          <EmptyState
                            icon="🏃"
                            title="Você ainda não participa de clubes"
                            description="Crie um grupo próprio ou descubra comunidades para correr acompanhado."
                            actionLabel="Criar clube"
                            onAction={() => setShowCreateClub(true)}
                          />
                        </div>
                      )}

                      {myClubs.map((club) => (
                        <div key={club.id} style={{ background: "linear-gradient(180deg, rgba(255,255,255,0.055), rgba(255,255,255,0.025))", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 22, padding: 16, marginBottom: 14, cursor: "pointer" }} onClick={() => openClub(club)}>
                          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                            <div style={{ width: 64, height: 64, borderRadius: 18, background: "linear-gradient(135deg, #e11d48, #f97316)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, overflow: "hidden", flexShrink: 0 }}>
                              {club.avatar_url ? <img src={club.avatar_url} alt={club.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : "🏃"}
                            </div>
                            <div style={{ flex: 1 }}>
                              <p style={{ fontWeight: 900, fontSize: 16, marginBottom: 4 }}>{club.name}</p>
                              <p style={{ fontSize: 11, color: "#e11d48", fontWeight: 900 }}>
                                {club.owner_id === user.id ? "Administrador" : "Membro"}
                                <span style={{ color: "#666", marginLeft: 6 }}>{club.member_count || 0} {(club.member_count || 0) === 1 ? "membro" : "membros"}</span>
                              </p>
                            </div>
                            <button onClick={(event) => { event.stopPropagation(); openClub(club); }} style={{ background: "#e11d48", border: "none", color: "#fff", borderRadius: 12, padding: "10px 13px", fontSize: 11, fontWeight: 900, cursor: "pointer", fontFamily: "inherit" }}>Entrar</button>
                          </div>
                          <div style={{ borderTop: "1px solid #1e1e2e", paddingTop: 12 }}>
                            <p style={{ fontSize: 11, color: "#777", fontWeight: 900, marginBottom: 5 }}>Último aviso</p>
                            <p style={{ fontSize: 13, color: "#ddd", lineHeight: 1.4 }}>{club.latest_notice?.title || club.description || "Treinos, avisos e conversas do clube."}</p>
                            <p style={{ fontSize: 11, color: "#6ee7b7", fontWeight: 900, marginTop: 8 }}>
                              ● {club.posts_today || 0} {(club.posts_today || 0) === 1 ? "novo post hoje" : "novos posts hoje"}
                            </p>
                          </div>
                        </div>
                      ))}

                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "24px 0 8px" }}>
                        <div>
                          <p style={{ fontSize: 15, fontWeight: 900, color: "#f4f4f6" }}>Descobrir clubes</p>
                          <p style={{ color: "#777", fontSize: 12, marginTop: 4 }}>Encontre grupos para correr junto.</p>
                        </div>
                        <button style={{ background: "none", border: "none", color: "#e11d48", fontSize: 11, fontWeight: 900, cursor: "pointer", fontFamily: "inherit" }}>Ver todos</button>
                      </div>

                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                        {allClubs.filter((club) => clubMembership[club.id] !== "approved").map((club) => (
                          <div key={club.id} style={{ background: "linear-gradient(180deg, rgba(255,255,255,0.045), rgba(255,255,255,0.025))", borderRadius: 18, padding: 13, border: "1px solid rgba(255,255,255,0.09)", display: "flex", flexDirection: "column", minHeight: 208 }}>
                            <div style={{ width: 56, height: 56, borderRadius: 14, background: "linear-gradient(135deg, #1e1e2e, #2a2a3e)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0, overflow: "hidden", marginBottom: 10 }}>
                              {club.avatar_url ? <img src={club.avatar_url} alt={club.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : "🏃"}
                            </div>
                            <p style={{ fontWeight: 900, fontSize: 14, marginBottom: 4 }}>{club.name}</p>
                            <p style={{ fontSize: 11, color: "#777", lineHeight: 1.4, minHeight: 34 }}>{club.description || "Grupo de corredores."}</p>
                            <p style={{ fontSize: 10, color: "#555", marginTop: 8 }}>{club.member_count || 0} {(club.member_count || 0) === 1 ? "membro" : "membros"}</p>
                            <div style={{ marginTop: "auto", paddingTop: 12 }}>
                              {clubMembership[club.id] === "pending" ? (
                                <button onClick={() => handleCancelRequest(club.id)} style={{ width: "100%", background: "none", border: "1px solid #1e1e2e", color: "#777", borderRadius: 999, padding: "9px 10px", fontSize: 11, fontWeight: 900, cursor: "pointer", fontFamily: "inherit" }}>Pendente</button>
                              ) : (
                                <button onClick={() => handleRequestJoin(club.id)} style={{ width: "100%", background: "none", border: "1px solid #e11d48", color: "#e11d48", borderRadius: 999, padding: "9px 10px", fontSize: 11, fontWeight: 900, cursor: "pointer", fontFamily: "inherit" }}>Solicitar</button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {showCreateClub && (
                <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.92)", zIndex: 300, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end" }}>
                  <div style={{ background: "#13131a", borderRadius: "24px 24px 0 0", padding: "24px 20px 40px", width: "100%", maxWidth: 390, border: "1px solid #1e1e2e" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                      <p style={{ fontWeight: 900, fontSize: 17 }}>Criar clube</p>
                      <button onClick={() => { setShowCreateClub(false); setClubAvatarFile(null); setClubAvatarPreview(null); }} style={{ background: "none", border: "none", color: "#555", fontSize: 22, cursor: "pointer" }}>✕</button>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 20 }}>
                      <label htmlFor="club-avatar" style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: 14 }}>
                        <div style={{ width: 64, height: 64, borderRadius: 16, background: clubAvatarPreview ? "transparent" : "linear-gradient(135deg, #e11d48, #f97316)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, overflow: "hidden", flexShrink: 0, border: "2px dashed #1e1e2e" }}>{clubAvatarPreview ? <img src={clubAvatarPreview} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : "🏃"}</div>
                        <div><p style={{ fontSize: 13, fontWeight: 900, color: "#f0f0f0" }}>Foto do clube</p><p style={{ fontSize: 11, color: "#555", marginTop: 3 }}>Toque para selecionar</p></div>
                      </label>
                      <input id="club-avatar" type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => { const f = e.target.files[0]; if (f) { setClubAvatarFile(f); setClubAvatarPreview(URL.createObjectURL(f)); } }} />
                      <input className="tinput" placeholder="Nome do clube" value={clubForm.name} onChange={(e) => setClubForm(f => ({ ...f, name: e.target.value }))} />
                      <textarea className="tinput" rows={3} placeholder="Descrição ou último aviso" value={clubForm.description} onChange={(e) => setClubForm(f => ({ ...f, description: e.target.value }))} />
                    </div>
                    <p style={{ fontSize: 11, color: "#555", marginBottom: 16, lineHeight: 1.5 }}>Novos membros precisam da sua aprovação para entrar no clube.</p>
                    <button onClick={handleCreateClub} style={{ width: "100%", background: "#e11d48", color: "#fff", border: "none", borderRadius: 14, padding: 16, fontSize: 15, fontWeight: 900, cursor: "pointer", fontFamily: "inherit" }}>Criar clube</button>
                  </div>
                </div>
              )}

              {showCreateClubNotice && activeClub && activeClub.owner_id === user.id && (
                <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.92)", zIndex: 320, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end" }}>
                  <div style={{ background: "#13131a", borderRadius: "24px 24px 0 0", padding: "24px 20px 40px", width: "100%", maxWidth: 390, border: "1px solid #1e1e2e", maxHeight: "92vh", overflowY: "auto" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                      <p style={{ fontWeight: 900, fontSize: 17 }}>Novo aviso</p>
                      <button onClick={() => { setShowCreateClubNotice(false); resetClubNoticeForm(); }} style={{ background: "none", border: "none", color: "#555", fontSize: 22, cursor: "pointer" }}>✕</button>
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                      <input className="tinput" placeholder="Título do aviso. Ex: Treino de sábado" value={clubNoticeForm.title} onChange={(e) => setClubNoticeForm((form) => ({ ...form, title: e.target.value }))} />
                      <textarea className="tinput" rows={3} placeholder="Mensagem opcional para os membros" value={clubNoticeForm.body} onChange={(e) => setClubNoticeForm((form) => ({ ...form, body: e.target.value }))} />
                      <input className="tinput" placeholder="Local. Ex: Parcão" value={clubNoticeForm.location} onChange={(e) => setClubNoticeForm((form) => ({ ...form, location: e.target.value }))} />
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                        <input className="tinput" placeholder="Horário. Ex: 7h" value={clubNoticeForm.time} onChange={(e) => setClubNoticeForm((form) => ({ ...form, time: e.target.value }))} />
                        <input className="tinput" placeholder="Distância. Ex: 5 km" value={clubNoticeForm.distance} onChange={(e) => setClubNoticeForm((form) => ({ ...form, distance: e.target.value }))} />
                      </div>

                      <button
                        onClick={() => setClubNoticeForm((form) => ({ ...form, is_pinned: !form.is_pinned }))}
                        style={{ width: "100%", background: clubNoticeForm.is_pinned ? "rgba(225,29,72,0.12)" : "#0a0a0f", border: clubNoticeForm.is_pinned ? "1px solid rgba(225,29,72,0.35)" : "1px solid #1e1e2e", color: clubNoticeForm.is_pinned ? "#ff4a70" : "#888", borderRadius: 14, padding: 13, fontSize: 13, fontWeight: 900, cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}
                      >
                        {clubNoticeForm.is_pinned ? "📌 Este aviso ficará fixado no topo" : "Fixar este aviso no topo"}
                      </button>
                    </div>

                    <button onClick={handleCreateClubNotice} disabled={savingClubNotice || !clubNoticeForm.title.trim()} style={{ width: "100%", background: "#e11d48", color: "#fff", border: "none", borderRadius: 14, padding: 16, fontSize: 15, fontWeight: 900, cursor: savingClubNotice || !clubNoticeForm.title.trim() ? "not-allowed" : "pointer", fontFamily: "inherit", opacity: savingClubNotice || !clubNoticeForm.title.trim() ? 0.55 : 1, marginTop: 18 }}>
                      {savingClubNotice ? "Salvando..." : "Publicar aviso"}
                    </button>
                  </div>
                </div>
              )}

              {showPublish && (
                <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.94)", zIndex: 200, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end" }}>
                  <div style={{
                    width: "100%",
                    maxWidth: 390,
                    maxHeight: "94vh",
                    overflowY: "auto",
                    background: "radial-gradient(circle at 50% -10%, rgba(225,29,72,0.14), transparent 36%), linear-gradient(180deg, #15151d, #101018)",
                    borderRadius: "30px 30px 0 0",
                    padding: publishType ? "22px 20px 40px" : "22px 20px 34px",
                    border: "1px solid rgba(225,29,72,0.44)",
                    boxShadow: "0 -28px 80px rgba(0,0,0,0.72), inset 0 1px 0 rgba(255,255,255,0.08)"
                  }}>
                    {!publishType ? (
                      <>
                        <div style={{ position: "relative", marginBottom: 26 }}>
                          <div style={{ width: 48, height: 6, borderRadius: 999, background: "rgba(255,255,255,0.28)", margin: "0 auto 22px" }} />
                          <button
                            onClick={() => { setShowPublish(false); setPublishType(null); setNewPost(""); setPhotoFile(null); setPhotoPreview(null); }}
                            style={{
                              position: "absolute",
                              right: 0,
                              top: 0,
                              width: 42,
                              height: 42,
                              borderRadius: "50%",
                              background: "rgba(255,255,255,0.04)",
                              border: "1px solid rgba(225,29,72,0.34)",
                              color: "#ff4a70",
                              fontSize: 23,
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontFamily: "inherit"
                            }}
                          >
                            ✕
                          </button>
                          <div style={{ textAlign: "center", padding: "0 36px" }}>
                            <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", color: "#fff", fontSize: 27, lineHeight: 1.08, letterSpacing: -0.8, fontWeight: 900, marginBottom: 9 }}>
                              Compartilhe com a <span style={{ color: "#e11d48" }}>comunidade</span>
                            </h2>
                            <p style={{ color: "#c2c2cc", fontSize: 16, lineHeight: 1.4 }}>O que você quer publicar agora?</p>
                          </div>
                        </div>

                        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                          {[
                            {
                              id: "foto",
                              label: "Foto",
                              desc: "Compartilhe um registro da corrida, prova, medalha ou bastidor.",
                              icon: "▧"
                            },
                            {
                              id: "post",
                              label: "Post",
                              desc: "Escreva uma ideia, conquista, dica ou relato do seu treino.",
                              icon: "✎"
                            }
                          ].map((t) => (
                            <button
                              key={t.id}
                              onClick={() => setPublishType(t.id)}
                              style={{
                                width: "100%",
                                minHeight: 126,
                                background: "linear-gradient(180deg, rgba(255,255,255,0.045), rgba(255,255,255,0.018))",
                                border: "1px solid rgba(255,255,255,0.12)",
                                borderRadius: 24,
                                padding: "18px 18px 18px 16px",
                                cursor: "pointer",
                                fontFamily: "inherit",
                                display: "grid",
                                gridTemplateColumns: "94px 1fr 42px",
                                alignItems: "center",
                                gap: 16,
                                textAlign: "left",
                                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05)"
                              }}
                            >
                              <span style={{
                                width: 94,
                                height: 94,
                                borderRadius: 24,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                background: "radial-gradient(circle at 50% 30%, rgba(225,29,72,0.32), rgba(225,29,72,0.09))",
                                border: "1px solid rgba(225,29,72,0.42)",
                                color: "#ff5a7a",
                                fontSize: t.id === "foto" ? 42 : 44,
                                fontWeight: 900,
                                boxShadow: "0 18px 34px rgba(0,0,0,0.24), inset 0 1px 0 rgba(255,255,255,0.08)"
                              }}>
                                {t.icon}
                              </span>
                              <span style={{ display: "block", minWidth: 0 }}>
                                <span style={{ display: "block", color: "#fff", fontSize: 21, fontWeight: 900, marginBottom: 7, letterSpacing: -0.3 }}>{t.label}</span>
                                <span style={{ display: "block", color: "#b6b6c2", fontSize: 14, lineHeight: 1.42 }}>{t.desc}</span>
                              </span>
                              <span style={{
                                width: 42,
                                height: 42,
                                borderRadius: "50%",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                background: "rgba(255,255,255,0.035)",
                                border: "1px solid rgba(255,255,255,0.10)",
                                color: "#ff4a70",
                                fontSize: 28,
                                fontWeight: 500
                              }}>›</span>
                            </button>
                          ))}
                        </div>

                        <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", marginTop: 18, paddingTop: 17, display: "flex", alignItems: "center", justifyContent: "center", gap: 9, color: "#b8b8c2", fontSize: 13.5, lineHeight: 1.4, textAlign: "center" }}>
                          <span style={{ width: 20, height: 20, borderRadius: "50%", border: "1px solid rgba(225,29,72,0.55)", color: "#ff4a70", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 900, flexShrink: 0 }}>i</span>
                          <span>Atividades com GPS são publicadas pelo <strong style={{ color: "#ff4a70" }}>Hub</strong>.</span>
                        </div>
                      </>
                    ) : (
                      <>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 20 }}>
                          <button
                            onClick={() => { setPublishType(null); setNewPost(""); setPhotoFile(null); setPhotoPreview(null); }}
                            style={{
                              width: 40,
                              height: 40,
                              borderRadius: "50%",
                              background: "rgba(255,255,255,0.04)",
                              border: "1px solid rgba(255,255,255,0.10)",
                              color: "#bbb",
                              fontSize: 21,
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontFamily: "inherit"
                            }}
                          >
                            ‹
                          </button>
                          <div style={{ flex: 1 }}>
                            <p style={{ color: "#fff", fontWeight: 900, fontSize: 19, letterSpacing: -0.35 }}>{publishType === "post" ? "Novo post" : "Nova foto"}</p>
                            <p style={{ color: "#777", fontSize: 12, marginTop: 2 }}>{publishType === "post" ? "Escreva para a comunidade." : "Compartilhe um registro visual."}</p>
                          </div>
                          <button
                            onClick={() => { setShowPublish(false); setPublishType(null); setNewPost(""); setPhotoFile(null); setPhotoPreview(null); }}
                            style={{
                              width: 40,
                              height: 40,
                              borderRadius: "50%",
                              background: "rgba(255,255,255,0.04)",
                              border: "1px solid rgba(225,29,72,0.30)",
                              color: "#ff4a70",
                              fontSize: 21,
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontFamily: "inherit"
                            }}
                          >
                            ✕
                          </button>
                        </div>

                        {publishType === "post" && (
                          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                            <textarea className="tinput" rows={5} placeholder="Compartilhe uma ideia, conquista ou relato..." value={newPost} onChange={(e) => setNewPost(e.target.value)} style={{ minHeight: 128, resize: "vertical" }} />
                            <div style={{ display: "flex", gap: 10 }}>
                              <button onClick={() => { setPublishType(null); setNewPost(""); }} style={{ flex: 1, background: "none", border: "1px solid #1e1e2e", color: "#888", borderRadius: 14, padding: 14, fontSize: 13, cursor: "pointer", fontFamily: "inherit", fontWeight: 800 }}>Voltar</button>
                              <button onClick={async () => { await handlePost(); setShowPublish(false); setPublishType(null); }} disabled={loadingPost || !newPost.trim()} style={{ flex: 1, background: "linear-gradient(135deg, #e11d48, #ff3d63)", color: "#fff", border: "none", borderRadius: 14, padding: 14, fontSize: 13, fontWeight: 900, cursor: "pointer", fontFamily: "inherit", opacity: loadingPost || !newPost.trim() ? 0.5 : 1, boxShadow: loadingPost || !newPost.trim() ? "none" : "0 16px 30px rgba(225,29,72,0.22)" }}>Publicar</button>
                            </div>
                          </div>
                        )}

                        {publishType === "foto" && (
                          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                            <label style={{ border: "1.5px dashed rgba(225,29,72,0.35)", borderRadius: 20, padding: photoPreview ? 0 : 22, textAlign: "center", cursor: "pointer", background: "rgba(0,0,0,0.22)", overflow: "hidden" }}>
                              {photoPreview ? <img src={photoPreview} style={{ width: "100%", maxHeight: 280, objectFit: "cover", display: "block" }} /> : <><p style={{ fontSize: 40, marginBottom: 8 }}>▧</p><p style={{ fontSize: 14, fontWeight: 900, color: "#fff" }}>Selecionar foto</p><p style={{ fontSize: 12, color: "#777", marginTop: 5 }}>Toque para escolher uma imagem</p></>}
                              <input type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => { const f = e.target.files[0]; if (f) { setPhotoFile(f); setPhotoPreview(URL.createObjectURL(f)); } }} />
                            </label>
                            <textarea className="tinput" rows={3} placeholder="Escreva uma legenda..." value={newPost} onChange={(e) => setNewPost(e.target.value)} />
                            <div style={{ display: "flex", gap: 10 }}>
                              <button onClick={() => { setPublishType(null); setPhotoFile(null); setPhotoPreview(null); setNewPost(""); }} style={{ flex: 1, background: "none", border: "1px solid #1e1e2e", color: "#888", borderRadius: 14, padding: 14, fontSize: 13, cursor: "pointer", fontFamily: "inherit", fontWeight: 800 }}>Voltar</button>
                              <button onClick={async () => {
                                if (!photoFile) return alert("Selecione uma foto.");
                                setLoadingPost(true);
                                const ext = photoFile.name.split(".").pop();
                                const path = `${user.id}/post_${Date.now()}.${ext}`;
                                const { error: upErr } = await supabase.storage.from("posts").upload(path, photoFile);
                                if (upErr) { alert("Erro ao enviar foto: " + upErr.message); setLoadingPost(false); return; }
                                const { data: urlData } = supabase.storage.from("posts").getPublicUrl(path);
                                const { error } = await supabase.from("posts").insert({ user_id: user.id, text: newPost, photo_url: urlData.publicUrl });
                                if (error) alert("Erro: " + error.message);
                                else { setNewPost(""); setPhotoFile(null); setPhotoPreview(null); setShowPublish(false); setPublishType(null); await loadPosts(); }
                                setLoadingPost(false);
                              }} disabled={loadingPost || !photoFile} style={{ flex: 1, background: "linear-gradient(135deg, #e11d48, #ff3d63)", color: "#fff", border: "none", borderRadius: 14, padding: 14, fontSize: 13, fontWeight: 900, cursor: "pointer", fontFamily: "inherit", opacity: loadingPost || !photoFile ? 0.5 : 1, boxShadow: loadingPost || !photoFile ? "none" : "0 16px 30px rgba(225,29,72,0.22)" }}>{loadingPost ? "Enviando..." : "Publicar"}</button>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}


          {tab === "hub" && (
            <div style={{ padding: "16px 20px 112px" }}>
              {hubScreen === "hub" && (
                (loadingSections.activities || loadingSections.ranking) ? (
                  <HubSkeleton />
                ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                  <div style={{
                    position: "relative",
                    overflow: "hidden",
                    borderRadius: 26,
                    padding: 24,
                    minHeight: 236,
                    border: "1px solid rgba(225,29,72,0.26)",
                    background: "radial-gradient(circle at 84% 18%, rgba(225,29,72,0.24), transparent 32%), linear-gradient(135deg, rgba(19,19,26,0.96), rgba(9,9,14,0.98))",
                    boxShadow: "0 24px 54px rgba(0,0,0,0.36), inset 0 1px 0 rgba(255,255,255,0.06)"
                  }}>
                    <div style={{ position: "absolute", inset: 0, opacity: 0.23, background: "linear-gradient(120deg, transparent 0%, rgba(255,255,255,0.05) 46%, transparent 47%), repeating-linear-gradient(90deg, transparent 0 34px, rgba(255,255,255,0.06) 35px, transparent 36px), repeating-linear-gradient(0deg, transparent 0 34px, rgba(255,255,255,0.04) 35px, transparent 36px)" }} />
                    <svg viewBox="0 0 240 150" style={{ position: "absolute", right: -18, top: 20, width: 190, opacity: 0.9 }}>
                      <polyline points="22,118 62,92 98,100 126,76 152,78 190,45 210,20" fill="none" stroke="#e11d48" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
                      <circle cx="22" cy="118" r="11" fill="#e11d48" />
                      <circle cx="210" cy="20" r="11" fill="#fff" />
                      <circle cx="210" cy="20" r="7" fill="#e11d48" />
                    </svg>
                    <div style={{ position: "relative", zIndex: 1 }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 7, background: "rgba(0,0,0,0.28)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 999, padding: "7px 11px", color: "#d9d9df", fontSize: 12, fontWeight: 800, marginBottom: 18 }}>
                        <span style={{ width: 9, height: 9, borderRadius: "50%", background: "#6ee7b7", boxShadow: "0 0 14px #6ee7b7" }} /> GPS disponível
                      </span>
                      <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 36, lineHeight: 1.02, letterSpacing: -1.5, marginBottom: 10 }}>Pronto para correr?</h2>
                      <p style={{ color: "#b9b9c3", fontSize: 15, lineHeight: 1.55, maxWidth: 245, marginBottom: 18 }}>Registre sua corrida, acompanhe seu desempenho e transforme cada treino em evolução.</p>
                      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", color: "#aaa", fontSize: 12, fontWeight: 800, marginBottom: 22 }}>
                        <span>⌖ GPS</span><span>◷ pace</span><span>▥ rota</span>
                      </div>
                      <button onClick={startGpsRun} style={{ width: "100%", maxWidth: 270, height: 56, border: "none", borderRadius: 999, background: "linear-gradient(135deg, #e11d48, #ff3d63)", color: "#fff", fontSize: 17, fontWeight: 900, fontFamily: "inherit", cursor: "pointer", boxShadow: "0 18px 40px rgba(225,29,72,0.28)" }}>▶ Iniciar corrida</button>
                    </div>
                  </div>

                  <div style={{ background: "linear-gradient(180deg, rgba(255,255,255,0.045), rgba(255,255,255,0.02))", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 24, padding: 18 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                      <h3 style={{ fontSize: 19, fontWeight: 900, letterSpacing: -0.4 }}>Resumo da semana</h3>
                      <span style={{ color: "#777", fontSize: 12, fontWeight: 800 }}>últimos 7 dias</span>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 20 }}>
                      <div><p style={{ color: "#e11d48", fontSize: 22, fontWeight: 900 }}>{weekKm.toFixed(2).replace(".", ",")}</p><p style={{ color: "#777", fontSize: 11 }}>km</p></div>
                      <div><p style={{ color: "#fff", fontSize: 22, fontWeight: 900 }}>{weekActivities.length}</p><p style={{ color: "#777", fontSize: 11 }}>corridas</p></div>
                      <div><p style={{ color: "#fff", fontSize: 22, fontWeight: 900 }}>{weekPace}</p><p style={{ color: "#777", fontSize: 11 }}>pace médio</p></div>
                      <div><p style={{ color: "#fff", fontSize: 22, fontWeight: 900 }}>{formatSecondsLabel(weekSeconds)}</p><p style={{ color: "#777", fontSize: 11 }}>tempo</p></div>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 10, alignItems: "end", height: 90, padding: "0 4px" }}>
                      {weekBars.map((km, idx) => (
                        <div key={idx} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 7 }}>
                          <div style={{ width: 18, height: Math.max(10, (km / maxWeekBar) * 62), borderRadius: 5, background: km > 0 ? "linear-gradient(180deg, #ff3d63, #e11d48)" : "rgba(255,255,255,0.16)" }} />
                          <span style={{ color: "#777", fontSize: 10, fontWeight: 800 }}>{dayLabels[idx]}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                    <div style={{ background: "#13131a", border: "1px solid #1e1e2e", borderRadius: 22, padding: 16 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 18 }}>
                        <p style={{ color: "#fff", fontSize: 16, fontWeight: 900 }}>🎯 Meta do mês</p>
                        <button onClick={() => { setGoalDraft(String(monthGoal)); setShowGoalEditor(true); }} style={{ border: "1px solid rgba(255,255,255,0.10)", background: "rgba(255,255,255,0.04)", color: "#aaa", borderRadius: 999, padding: "5px 9px", fontSize: 10, fontWeight: 900, cursor: "pointer", fontFamily: "inherit" }}>Editar</button>
                      </div>
                      <p style={{ fontSize: 27, fontWeight: 900, marginBottom: 12 }}><span style={{ color: "#e11d48" }}>{monthKm.toFixed(1).replace(".", ",")}</span> / {monthGoal} km</p>
                      <div style={{ height: 9, borderRadius: 999, background: "#252536", overflow: "hidden", marginBottom: 12 }}><div style={{ width: `${monthProgress}%`, height: "100%", background: "linear-gradient(90deg, #e11d48, #ff3d63)", borderRadius: 999 }} /></div>
                      <p style={{ color: "#888", fontSize: 13, lineHeight: 1.45 }}>Faltam {Math.max(monthGoal - monthKm, 0).toFixed(1).replace(".", ",")} km para bater sua meta.</p>
                    </div>

                    <div style={{ background: "#13131a", border: "1px solid #1e1e2e", borderRadius: 22, padding: 16 }}>
                      <p style={{ color: "#fff", fontSize: 16, fontWeight: 900, marginBottom: 14 }}>⚡ Sua última corrida</p>
                      {lastActivity ? (
                        <>
                          <p style={{ fontSize: 28, fontWeight: 900, marginBottom: 6 }}>{Number(lastActivity.distance || 0).toFixed(2).replace(".", ",")} km</p>
                          <p style={{ color: "#ddd", fontSize: 14, fontWeight: 800, marginBottom: 4 }}>⏱ {lastActivity.duration || "--"}</p>
                          <p style={{ color: "#ddd", fontSize: 14, fontWeight: 800 }}>◴ {lastActivity.pace || "--"}</p>
                          <div style={{ marginTop: 14, height: 80, borderRadius: 16, background: "radial-gradient(circle at 70% 40%, rgba(225,29,72,0.22), transparent 30%), #0d0d18", border: "1px solid rgba(255,255,255,0.08)", position: "relative", overflow: "hidden" }}>
                            <svg viewBox="0 0 160 80" style={{ width: "100%", height: "100%" }}><polyline points="14,62 32,45 55,49 76,34 98,39 119,22 142,15" fill="none" stroke="#e11d48" strokeWidth="4" strokeLinecap="round"/><circle cx="14" cy="62" r="5" fill="#6ee7b7"/><circle cx="142" cy="15" r="5" fill="#fff"/></svg>
                          </div>
                        </>
                      ) : <EmptyState
                        compact
                        icon="⌁"
                        title="Nenhuma atividade recente"
                        description="Quando você registrar uma corrida no Hub, ela aparece aqui."
                        actionLabel="Iniciar corrida"
                        onAction={() => setHubScreen("hub")}
                      />}
                    </div>
                  </div>

                  <div style={{ background: "#13131a", border: "1px solid #1e1e2e", borderRadius: 22, padding: 16 }}>
                    <p style={{ color: "#fff", fontSize: 16, fontWeight: 900, marginBottom: 14 }}>🏆 Seus melhores números</p>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
                      <div style={{ background: "rgba(255,255,255,0.035)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: "12px 8px", textAlign: "center" }}><p style={{ color: "#e11d48", fontSize: 19, fontWeight: 900 }}>5K</p><p style={{ color: "#aaa", fontSize: 12 }}>{bestPaceLabel}</p></div>
                      <div style={{ background: "rgba(255,255,255,0.035)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: "12px 8px", textAlign: "center" }}><p style={{ color: "#fff", fontSize: 19, fontWeight: 900 }}>{bestDistance.toFixed(1).replace(".", ",")}</p><p style={{ color: "#aaa", fontSize: 12 }}>maior km</p></div>
                      <div style={{ background: "rgba(255,255,255,0.035)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: "12px 8px", textAlign: "center" }}><p style={{ color: "#fff", fontSize: 19, fontWeight: 900 }}>{bestPaceLabel}</p><p style={{ color: "#aaa", fontSize: 12 }}>melhor pace</p></div>
                      <div style={{ background: "rgba(255,255,255,0.035)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: "12px 8px", textAlign: "center" }}><p style={{ color: "#fff", fontSize: 19, fontWeight: 900 }}>{races}</p><p style={{ color: "#aaa", fontSize: 12 }}>corridas</p></div>
                    </div>
                  </div>

                  <div style={{ background: "linear-gradient(180deg, rgba(255,255,255,0.052), rgba(255,255,255,0.025))", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 24, padding: 16, boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 14 }}>
                      <div>
                        <p style={{ color: "#fff", fontSize: 17, fontWeight: 900, letterSpacing: -0.35 }}>🏆 Ranking do Hub</p>
                        <p style={{ color: "#7b7b89", fontSize: 12, marginTop: 3 }}>Acompanhe quem mais corre na comunidade.</p>
                      </div>
                      <span style={{ color: "#e11d48", fontSize: 11, fontWeight: 900, whiteSpace: "nowrap", paddingTop: 3 }}>Atualizado</span>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, background: "rgba(255,255,255,0.035)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 4, marginBottom: 10 }}>
                      {[
                        { id: "semanal", label: "Semanal" },
                        { id: "mensal", label: "Mensal" },
                        { id: "geral", label: "Geral" },
                      ].map((period) => (
                        <button key={period.id} onClick={() => setRankingPeriod(period.id)} style={{ border: "none", borderRadius: 12, minHeight: 38, background: rankingPeriod === period.id ? "linear-gradient(135deg, #e11d48, #ff3d63)" : "transparent", color: rankingPeriod === period.id ? "#fff" : "#8a8a96", fontSize: 11, fontWeight: 900, fontFamily: "inherit", cursor: "pointer", boxShadow: rankingPeriod === period.id ? "0 10px 24px rgba(225,29,72,0.18)" : "none" }}>{period.label}</button>
                      ))}
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, background: "rgba(255,255,255,0.035)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 4, marginBottom: 16 }}>
                      {[{ id: "km", label: "Distância (km)" }, { id: "corridas", label: "Corridas" }].map((mode) => (
                        <button key={mode.id} onClick={() => setRankingMode(mode.id)} style={{ border: "none", borderRadius: 12, minHeight: 40, background: rankingMode === mode.id ? "rgba(225,29,72,0.16)" : "transparent", color: rankingMode === mode.id ? "#fff" : "#8a8a96", outline: rankingMode === mode.id ? "1px solid rgba(225,29,72,0.55)" : "none", fontSize: 11, fontWeight: 900, fontFamily: "inherit", cursor: "pointer" }}>{mode.label}</button>
                      ))}
                    </div>

                    {rankedRunners.length > 0 ? (
                      <>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1.12fr 1fr", gap: 8, alignItems: "end", marginBottom: 16 }}>
                          {[podiumRunners[1], podiumRunners[0], podiumRunners[2]].map((runner, placeIdx) => {
                            if (!runner) return <div key={`empty-${placeIdx}`} />;
                            const actualPosition = placeIdx === 1 ? 1 : placeIdx === 0 ? 2 : 3;
                            const medal = actualPosition === 1 ? "🥇" : actualPosition === 2 ? "🥈" : "🥉";
                            const featured = actualPosition === 1;
                            return (
                              <div key={runner.id || placeIdx} style={{ background: featured ? "linear-gradient(180deg, rgba(225,29,72,0.16), rgba(255,255,255,0.035))" : "rgba(255,255,255,0.03)", border: featured ? "1px solid rgba(225,29,72,0.42)" : "1px solid rgba(255,255,255,0.08)", borderRadius: 18, padding: featured ? "14px 8px 12px" : "11px 8px", textAlign: "center", minHeight: featured ? 168 : 148, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "space-between", boxShadow: featured ? "0 18px 40px rgba(225,29,72,0.12)" : "none" }}>
                                <span style={{ fontSize: 18 }}>{medal}</span>
                                <div style={{ padding: featured ? 2 : 1, borderRadius: "50%", background: featured ? "linear-gradient(135deg, #facc15, #e11d48)" : "rgba(255,255,255,0.16)" }}>
                                  <div style={{ borderRadius: "50%", background: "#0a0a0f", padding: 2 }}>{getAvatar(runner, featured ? 52 : 44)}</div>
                                </div>
                                <div style={{ minWidth: 0, width: "100%" }}>
                                  <p style={{ color: "#fff", fontSize: 12.5, fontWeight: 900, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{runner?.name || "Corredor"}</p>
                                  <p style={{ color: featured ? "#ff5575" : "#c8c8d1", fontSize: 11, fontWeight: 900, marginTop: 4 }}>{rankingMode === "corridas" ? `${Number(runner?.rankingRaces || 0)} corridas` : `${Number(runner?.rankingKm || 0).toFixed(1).replace(".", ",")} km`}</p>
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        <div style={{ background: "linear-gradient(135deg, rgba(225,29,72,0.14), rgba(255,255,255,0.035))", border: "1px solid rgba(225,29,72,0.28)", borderRadius: 18, padding: 14, display: "grid", gridTemplateColumns: "auto 1fr auto", gap: 12, alignItems: "center", marginBottom: 14 }}>
                          <div style={{ width: 48, height: 48, borderRadius: "50%", border: "1px solid rgba(255,255,255,0.12)", display: "flex", alignItems: "center", justifyContent: "center", color: "#e11d48", fontSize: 20, fontWeight: 900 }}>{currentRankingPosition ? `${currentRankingPosition}º` : "—"}</div>
                          <div>
                            <p style={{ color: "#fff", fontSize: 13.5, fontWeight: 900 }}>Sua posição</p>
                            <p style={{ color: "#aaa", fontSize: 11.5, marginTop: 3 }}>{currentRankingPosition ? `Você aparece no ranking ${rankingPeriod}.` : `Registre uma atividade para entrar no ranking ${rankingPeriod}.`}</p>
                          </div>
                          <p style={{ color: "#fff", fontSize: 13, fontWeight: 900, whiteSpace: "nowrap" }}>{currentRankingLabel}</p>
                        </div>

                        <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                          {visibleRankedRunners.map((runner, idx) => (
                            <div key={runner.id || idx} style={{ display: "grid", gridTemplateColumns: "26px 38px 1fr auto", gap: 10, alignItems: "center", padding: "10px 0", borderBottom: idx < visibleRankedRunners.length - 1 ? "1px solid rgba(255,255,255,0.07)" : "none" }}>
                              <span style={{ color: idx === 0 ? "#e11d48" : "#777", fontSize: 13, fontWeight: 900 }}>#{idx + 1}</span>
                              {getAvatar(runner, 38)}
                              <div style={{ minWidth: 0 }}>
                                <p style={{ color: "#fff", fontSize: 14, fontWeight: 900, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{runner?.name || "Corredor"}</p>
                                <p style={{ color: getLevelColor(runner?.level), fontSize: 11, fontWeight: 800 }}>{getLevelIcon(runner?.level)} {runner?.level || "Iniciante"}</p>
                              </div>
                              <div style={{ textAlign: "right" }}>
                                <p style={{ color: "#fff", fontSize: 14, fontWeight: 900 }}>{rankingMode === "corridas" ? `${Number(runner?.rankingRaces || 0)} corridas` : `${Number(runner?.rankingKm || 0).toFixed(1).replace(".", ",")} km`}</p>
                                <p style={{ color: "#777", fontSize: 10 }}>{rankingPeriod === "geral" ? "total" : rankingPeriod}</p>
                              </div>
                            </div>
                          ))}

                          {currentRankingPosition && currentRankingPosition > 5 && (
                            <div style={{ marginTop: 10, background: "rgba(225,29,72,0.08)", border: "1px solid rgba(225,29,72,0.24)", borderRadius: 16, padding: "11px 12px", display: "grid", gridTemplateColumns: "26px 38px 1fr auto", gap: 10, alignItems: "center" }}>
                              <span style={{ color: "#e11d48", fontSize: 13, fontWeight: 900 }}>#{currentRankingPosition}</span>
                              {getAvatar(currentRankingRunner, 38)}
                              <div style={{ minWidth: 0 }}>
                                <p style={{ color: "#fff", fontSize: 14, fontWeight: 900 }}>Você</p>
                                <p style={{ color: "#ff6b82", fontSize: 11, fontWeight: 800 }}>Continue evoluindo</p>
                              </div>
                              <p style={{ color: "#fff", fontSize: 14, fontWeight: 900, whiteSpace: "nowrap" }}>{currentRankingLabel}</p>
                            </div>
                          )}
                        </div>
                      </>
                    ) : (
                      <EmptyState
                        compact
                        icon="🏆"
                        title="Ranking começando"
                        description={`Ainda não há atividades para o ranking ${rankingPeriod}.`}
                        actionLabel="Registrar corrida"
                        onAction={() => setShowGpsPermissionModal(true)}
                      />
                    )}
                  </div>
                </div>
                )
              )}

              {hubScreen === "tracking" && (
                <div style={{ minHeight: "calc(100vh - 170px)", display: "flex", flexDirection: "column", gap: 16 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 7, background: gpsError ? "rgba(225,29,72,0.12)" : "rgba(110,231,183,0.12)", border: `1px solid ${gpsError ? "rgba(225,29,72,0.24)" : "rgba(110,231,183,0.22)"}`, borderRadius: 999, padding: "8px 12px", color: gpsError ? "#ff6b82" : "#6ee7b7", fontSize: 12, fontWeight: 900 }}>
                      <span style={{ width: 8, height: 8, borderRadius: "50%", background: gpsError ? "#e11d48" : gpsLocated ? "#6ee7b7" : "#f59e0b" }} />
                      {gpsError ? "GPS precisa de atenção" : gpsLocated ? "GPS conectado" : "GPS ajustando sinal..."}
                    </span>
                    <button onClick={() => setGpsLocked(true)} style={{ border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.05)", color: "#fff", borderRadius: 999, padding: "8px 12px", fontSize: 12, fontWeight: 900, fontFamily: "inherit", cursor: "pointer" }}>🔒 Bloquear</button>
                  </div>

                  <div id="leaflet-map" style={{ height: 330, borderRadius: 26, overflow: "hidden", border: "1px solid rgba(255,255,255,0.12)", background: "#0d0d18" }} />

                  <div style={{ background: "#13131a", border: "1px solid #1e1e2e", borderRadius: 24, padding: 18 }}>
                    <div style={{ textAlign: "center", paddingBottom: 16, borderBottom: "1px solid rgba(255,255,255,0.08)", marginBottom: 16 }}>
                      <p style={{ color: "#e11d48", fontSize: 46, lineHeight: 1, fontWeight: 900, letterSpacing: -1.8 }}>{gpsDistance.toFixed(2).replace(".", ",")}</p>
                      <p style={{ color: "#777", fontSize: 13, fontWeight: 800, marginTop: 4 }}>quilômetros</p>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, textAlign: "center", marginBottom: 18 }}>
                      <div style={{ background: "rgba(255,255,255,0.035)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 18, padding: 14 }}><p style={{ fontSize: 24, fontWeight: 900 }}>{formatRunTime(gpsElapsed)}</p><p style={{ color: "#777", fontSize: 12 }}>tempo</p></div>
                      <div style={{ background: "rgba(255,255,255,0.035)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 18, padding: 14 }}><p style={{ fontSize: 22, fontWeight: 900 }}>{formatGpsPace(gpsDistance, gpsElapsed)}</p><p style={{ color: "#777", fontSize: 12 }}>pace</p></div>
                    </div>
                    {gpsError && <p style={{ color: "#ff6b82", background: "rgba(225,29,72,0.10)", border: "1px solid rgba(225,29,72,0.20)", borderRadius: 14, padding: "10px 12px", fontSize: 12.5, marginBottom: 12 }}>{gpsError}</p>}
                    <div style={{ display: "flex", gap: 10 }}>
                      <button onClick={() => setGpsPaused(p => !p)} style={{ flex: 1, height: 52, borderRadius: 16, border: "1px solid rgba(255,255,255,0.12)", background: gpsPaused ? "rgba(245,158,11,0.16)" : "rgba(255,255,255,0.05)", color: "#fff", fontWeight: 900, fontFamily: "inherit" }}>{gpsPaused ? "Retomar" : "Pausar"}</button>
                      <button onClick={finishGpsRun} style={{ flex: 1, height: 52, borderRadius: 16, border: "none", background: "linear-gradient(135deg, #e11d48, #ff3d63)", color: "#fff", fontWeight: 900, fontFamily: "inherit" }}>Finalizar</button>
                    </div>
                  </div>

                  {gpsLocked && (
                    <div style={{ position: "fixed", inset: 0, zIndex: 720, background: "rgba(5,5,9,0.96)", backdropFilter: "blur(18px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
                      <div style={{ width: "100%", maxWidth: 340, textAlign: "center" }}>
                        <p style={{ fontSize: 42, marginBottom: 12 }}>🔒</p>
                        <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 28, lineHeight: 1.1, marginBottom: 10 }}>Tela bloqueada</h2>
                        <p style={{ color: "#aaa", fontSize: 14, lineHeight: 1.55, marginBottom: 24 }}>Evite toques acidentais enquanto corre. O treino continua sendo registrado.</p>
                        <div style={{ background: "#13131a", border: "1px solid #1e1e2e", borderRadius: 22, padding: 18, marginBottom: 18 }}>
                          <p style={{ color: "#e11d48", fontSize: 42, fontWeight: 900, lineHeight: 1 }}>{gpsDistance.toFixed(2).replace(".", ",")} km</p>
                          <p style={{ color: "#fff", fontSize: 20, fontWeight: 900, marginTop: 10 }}>{formatRunTime(gpsElapsed)} · {formatGpsPace(gpsDistance, gpsElapsed)}</p>
                        </div>
                        <button onClick={() => setGpsLocked(false)} style={{ width: "100%", height: 54, border: "none", borderRadius: 18, background: "linear-gradient(135deg, #e11d48, #ff3d63)", color: "#fff", fontSize: 15, fontWeight: 900, fontFamily: "inherit", cursor: "pointer" }}>Desbloquear tela</button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {hubScreen === "summary" && (
                <div style={{ padding: "12px 0 20px" }}>
                  <div style={{ background: "linear-gradient(180deg, rgba(255,255,255,0.045), rgba(255,255,255,0.018))", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 28, padding: "max(22px, env(safe-area-inset-top)) 22px 22px", boxShadow: "0 20px 46px rgba(0,0,0,0.26)" }}>
                    <div style={{ textAlign: "center", marginBottom: 20 }}>
                      <p style={{ fontSize: 42, marginBottom: 8 }}>🏁</p>
                      <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 29, fontWeight: 900, marginBottom: 8 }}>Corrida concluída!</h2>
                      <p style={{ color: "#888", fontSize: 14 }}>Seu treino foi salvo no histórico.</p>
                    </div>

                    <div style={{ minHeight: 150, borderRadius: 20, background: "radial-gradient(circle at 70% 30%, rgba(225,29,72,0.20), transparent 34%), #0d0d18", border: "1px solid rgba(255,255,255,0.08)", overflow: "hidden", marginBottom: 16 }}>
                      {hasSummaryRouteSnapshot ? (
                        <img src={summaryRouteSnapshot} alt="Percurso registrado" style={{ width: "100%", height: 150, objectFit: "cover" }} />
                      ) : (
                        <div style={{ minHeight: 150, display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center", padding: 20 }}>
                          <div>
                            <p style={{ fontSize: 28, marginBottom: 8 }}>📍</p>
                            <p style={{ color: "#fff", fontWeight: 900, fontSize: 14, marginBottom: 5 }}>Percurso curto demais</p>
                            <p style={{ color: "#8a8a96", fontSize: 12, lineHeight: 1.5 }}>Não houve rota suficiente para gerar um mapa confiável.</p>
                          </div>
                        </div>
                      )}
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 18 }}>
                      <div className="sbox"><strong>{runSummary?.distanceLabel || gpsDistance.toFixed(2).replace(".", ",")}</strong><br/><span style={{ color: "#777", fontSize: 11 }}>km</span></div>
                      <div className="sbox"><strong>{runSummary?.durationLabel || formatRunTime(gpsElapsed)}</strong><br/><span style={{ color: "#777", fontSize: 11 }}>tempo</span></div>
                      <div className="sbox"><strong>{runSummary?.paceLabel || formatGpsPace(gpsDistance, gpsElapsed)}</strong><br/><span style={{ color: "#777", fontSize: 11 }}>pace</span></div>
                    </div>

                    <div style={{ background: "rgba(255,255,255,0.035)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 20, padding: 16, marginBottom: 16 }}>
                      <p style={{ color: "#fff", fontSize: 14, fontWeight: 900, marginBottom: 10 }}>Análise automática</p>
                      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                        <div style={{ width: 48, height: 48, borderRadius: 16, background: `${runSummary?.tone || "#e11d48"}22`, border: `1px solid ${runSummary?.tone || "#e11d48"}55`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 23, flexShrink: 0 }}>{runSummary?.emoji || "🏁"}</div>
                        <div>
                          <p style={{ color: runSummary?.tone || "#e11d48", fontSize: 18, fontWeight: 900, marginBottom: 5 }}>{runSummary?.type || "Atividade registrada"}</p>
                          <p style={{ color: "#b8b8c2", fontSize: 13, lineHeight: 1.55 }}>{runSummary?.explanation || "Seu treino foi concluído."}</p>
                        </div>
                      </div>
                    </div>

                    <div style={{ background: "rgba(255,255,255,0.035)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 20, padding: 14, marginBottom: 16 }}>
                      <p style={{ color: "#fff", fontSize: 14, fontWeight: 900, marginBottom: 10 }}>{isSummaryTooShortForFeed ? "Resumo da atividade" : "Post pronto para o feed"}</p>
                      <div style={{ width: "100%", borderRadius: 14, border: "1px solid #1e1e2e", background: "#0f0f17", color: "#fff", padding: 12, fontSize: 13, lineHeight: 1.55, minHeight: 74 }}>{runSummary?.feedText || summaryPostText}</div>
                      {hasSummaryRouteSnapshot ? (
                        <>
                          <div style={{ width: "100%", height: 148, borderRadius: 16, overflow: "hidden", border: "1px solid rgba(255,255,255,0.08)", marginTop: 12, background: "#0d0d18" }}>
                            <img src={summaryRouteSnapshot} alt="Prévia do percurso que será publicado" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                          </div>
                          <p style={{ color: "#777", fontSize: 11.5, lineHeight: 1.45, marginTop: 10 }}>Esse percurso será publicado junto com a análise da atividade.</p>
                        </>
                      ) : (
                        <p style={{ color: "#777", fontSize: 11.5, lineHeight: 1.45, marginTop: 10 }}>Percurso curto demais para gerar um mapa confiável. Esta atividade foi salva no histórico, mas não gera publicação automática.</p>
                      )}
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      {!isSummaryTooShortForFeed && (
                        <button onClick={handlePublishRunSummary} disabled={publishingRunSummary || !(runSummary?.feedText || summaryPostText).trim()} style={{ width: "100%", height: 52, border: "none", borderRadius: 16, background: publishingRunSummary || !(runSummary?.feedText || summaryPostText).trim() ? "#3a1a22" : "linear-gradient(135deg, #e11d48, #ff3d63)", color: "#fff", fontWeight: 900, fontFamily: "inherit", cursor: publishingRunSummary || !(runSummary?.feedText || summaryPostText).trim() ? "not-allowed" : "pointer" }}>{publishingRunSummary ? "Publicando..." : "Publicar no feed"}</button>
                      )}
                      <button onClick={() => { setRunSummary(null); setCompletedRunRoute([]); setSummaryPostText(""); setHubScreen("hub"); }} style={{ width: "100%", height: 48, border: "1px solid rgba(255,255,255,0.10)", borderRadius: 16, background: "rgba(255,255,255,0.035)", color: "#ddd", fontWeight: 900, fontFamily: "inherit", cursor: "pointer" }}>{isSummaryTooShortForFeed ? "Voltar ao Hub" : "Salvar sem publicar"}</button>
                    </div>
                  </div>
                </div>
              )}

              {showGoalEditor && (
                <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.76)", backdropFilter: "blur(14px)", zIndex: 710, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
                  <div style={{ width: "100%", maxWidth: 340, background: "#13131a", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 24, padding: 20 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 16 }}>
                      <h3 style={{ color: "#fff", fontSize: 19, fontWeight: 900 }}>Definir meta mensal</h3>
                      <button onClick={() => setShowGoalEditor(false)} style={{ border: "none", background: "none", color: "#888", fontSize: 25, cursor: "pointer" }}>×</button>
                    </div>
                    <p style={{ color: "#aaa", fontSize: 13, lineHeight: 1.5, marginBottom: 14 }}>Quantos quilômetros você quer correr neste mês?</p>
                    <input value={goalDraft} onChange={(e) => setGoalDraft(e.target.value.replace(/[^0-9,.]/g, ""))} inputMode="decimal" placeholder="Ex: 30" style={{ width: "100%", height: 52, borderRadius: 16, border: "1px solid #1e1e2e", background: "#0f0f17", color: "#fff", padding: "0 14px", fontSize: 16, fontWeight: 900, fontFamily: "inherit", outline: "none", marginBottom: 12 }} />
                    <button onClick={handleSaveMonthGoal} style={{ width: "100%", height: 52, border: "none", borderRadius: 16, background: "linear-gradient(135deg, #e11d48, #ff3d63)", color: "#fff", fontWeight: 900, fontFamily: "inherit", cursor: "pointer" }}>Salvar meta</button>
                  </div>
                </div>
              )}
            </div>
          )}

          {tab === "perfil" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14, paddingBottom: 105 }}>
              {loadingSections.profile ? (
                <ProfileSkeleton />
              ) : (
                <>
              <div
                style={{
                  position: "relative",
                  overflow: "hidden",
                  borderRadius: 26,
                  border: "1px solid rgba(225,29,72,0.22)",
                  background: `linear-gradient(90deg, rgba(12,12,18,0.98) 0%, rgba(12,12,18,0.90) 48%, rgba(12,12,18,0.52) 100%), url(https://images.unsplash.com/photo-1552674605-db6ffd4facb5?w=900&q=85) center/cover`,
                  boxShadow: "0 28px 70px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.06)",
                  padding: 18
                }}
              >
                <div style={{ position: "absolute", inset: 0, background: "radial-gradient(circle at 82% 10%, rgba(225,29,72,0.30), transparent 34%)", pointerEvents: "none" }} />

                <div style={{ position: "absolute", right: 16, top: 16, display: "flex", gap: 10, zIndex: 2 }}>
                  <button
                    onClick={openSettings}
                    title="Configurações"
                    style={{
                      width: 42,
                      height: 42,
                      borderRadius: "50%",
                      border: "1px solid rgba(255,255,255,0.16)",
                      background: "rgba(255,255,255,0.07)",
                      color: "#fff",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      cursor: "pointer",
                      fontSize: 17,
                      backdropFilter: "blur(14px)"
                    }}
                  >
                    ⚙
                  </button>
                  <button
                    onClick={() => { setShowEditProfile(true); setEditForm({ name: profile?.name || "", bio: profile?.bio || "", handle: profile?.handle || "" }); setAvatarPreview(null); }}
                    title="Editar perfil"
                    style={{
                      width: 42,
                      height: 42,
                      borderRadius: "50%",
                      border: "1px solid rgba(255,255,255,0.16)",
                      background: "rgba(255,255,255,0.07)",
                      color: "#fff",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      cursor: "pointer",
                      fontSize: 17,
                      backdropFilter: "blur(14px)"
                    }}
                  >
                    ✎
                  </button>
                </div>

                <div style={{ position: "relative", zIndex: 1 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "92px 1fr", gap: 16, alignItems: "center", marginBottom: 18, paddingRight: 38 }}>
                    <div style={{ position: "relative", width: 92, height: 92 }}>
                      <label htmlFor="av-upload" style={{ cursor: "pointer", display: "block" }}>
                        {profile?.avatar_url ? (
                          <img
                            src={profile.avatar_url}
                            alt="Foto de perfil"
                            style={{
                              width: 92,
                              height: 92,
                              borderRadius: "50%",
                              objectFit: "cover",
                              border: "3px solid #e11d48",
                              boxShadow: "0 0 0 5px rgba(225,29,72,0.12), 0 18px 40px rgba(0,0,0,0.45)"
                            }}
                          />
                        ) : (
                          <div
                            style={{
                              width: 92,
                              height: 92,
                              borderRadius: "50%",
                              background: "linear-gradient(135deg, #e11d48, #f97316)",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: 34,
                              border: "3px solid #e11d48",
                              boxShadow: "0 0 0 5px rgba(225,29,72,0.12), 0 18px 40px rgba(0,0,0,0.45)"
                            }}
                          >
                            {level.icon}
                          </div>
                        )}
                        <div
                          style={{
                            position: "absolute",
                            right: -2,
                            bottom: -2,
                            width: 32,
                            height: 32,
                            borderRadius: "50%",
                            background: "#161620",
                            border: "2px solid rgba(255,255,255,0.16)",
                            color: "#fff",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: 14
                          }}
                        >
                          {uploadingAvatar ? "⏳" : "📷"}
                        </div>
                      </label>
                      <input id="av-upload" type="file" accept="image/*" style={{ display: "none" }} onChange={handleAvatarUpload} />
                    </div>

                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(225,29,72,0.12)", border: "1px solid rgba(225,29,72,0.45)", borderRadius: 999, padding: "5px 11px", marginBottom: 10 }}>
                        <span style={{ fontSize: 12, color: level.color, fontWeight: 900 }}>{level.icon} {level.name}</span>
                      </div>

                      <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 30, fontWeight: 900, lineHeight: 0.98, letterSpacing: -1.2, marginBottom: 5 }}>
                        {profile?.name || userName}
                      </h2>

                      <p style={{ fontSize: 15, color: "#8b8b96", marginBottom: 12 }}>
                        @{profile?.handle || (profile?.name || userName).toLowerCase().replace(/\s/g, "")}
                      </p>

                      <p style={{ fontSize: 14, color: "#d3d3da", lineHeight: 1.45, maxWidth: 220 }}>
                        {profile?.bio || "Corro por saúde, desafio e liberdade."}
                      </p>
                    </div>
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(4, 1fr)",
                      gap: 0,
                      background: "rgba(5,5,8,0.52)",
                      border: "1px solid rgba(255,255,255,0.10)",
                      borderRadius: 22,
                      overflow: "hidden",
                      marginBottom: 12,
                      backdropFilter: "blur(18px)"
                    }}
                  >
                    <button onClick={() => loadFollowList("seguidores")} style={{ background: "none", border: "none", padding: "15px 4px", cursor: "pointer", fontFamily: "inherit", borderRight: "1px solid rgba(255,255,255,0.10)" }}>
                      <p style={{ color: "#fff", fontSize: 22, fontWeight: 900, lineHeight: 1 }}>{followersCount}</p>
                      <p style={{ color: "#8f8f99", fontSize: 10, fontWeight: 800, textTransform: "uppercase", marginTop: 6 }}>seguidores</p>
                    </button>

                    <button onClick={() => loadFollowList("seguindo")} style={{ background: "none", border: "none", padding: "15px 4px", cursor: "pointer", fontFamily: "inherit", borderRight: "1px solid rgba(255,255,255,0.10)" }}>
                      <p style={{ color: "#fff", fontSize: 22, fontWeight: 900, lineHeight: 1 }}>{followingCount}</p>
                      <p style={{ color: "#8f8f99", fontSize: 10, fontWeight: 800, textTransform: "uppercase", marginTop: 6 }}>seguindo</p>
                    </button>

                    <div style={{ padding: "15px 4px", textAlign: "center", borderRight: "1px solid rgba(255,255,255,0.10)" }}>
                      <p style={{ color: "#fff", fontSize: 22, fontWeight: 900, lineHeight: 1 }}>{races}</p>
                      <p style={{ color: "#8f8f99", fontSize: 10, fontWeight: 800, textTransform: "uppercase", marginTop: 6 }}>corridas</p>
                    </div>

                    <div style={{ padding: "15px 4px", textAlign: "center" }}>
                      <p style={{ color: "#ff4b6d", fontSize: 20, fontWeight: 900, lineHeight: 1 }}>{Number(profile?.total_km || 0).toFixed(1)} km</p>
                      <p style={{ color: "#8f8f99", fontSize: 10, fontWeight: 800, textTransform: "uppercase", marginTop: 6 }}>distância</p>
                    </div>
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: 0,
                      background: "rgba(255,255,255,0.045)",
                      border: "1px solid rgba(255,255,255,0.10)",
                      borderRadius: 20,
                      overflow: "hidden",
                      marginBottom: 16
                    }}
                  >
                    <div style={{ padding: "13px 14px", display: "flex", alignItems: "center", gap: 10, borderRight: "1px solid rgba(255,255,255,0.10)" }}>
                      <div style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(225,29,72,0.14)", border: "1px solid rgba(225,29,72,0.35)", color: "#e11d48", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>◷</div>
                      <div>
                        <p style={{ color: "#fff", fontWeight: 900, fontSize: 16 }}>5'18&quot;</p>
                        <p style={{ color: "#777", fontSize: 11, fontWeight: 700 }}>pace médio</p>
                      </div>
                    </div>

                    <div style={{ padding: "13px 14px", display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(225,29,72,0.14)", border: "1px solid rgba(225,29,72,0.35)", color: "#e11d48", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>⏱</div>
                      <div>
                        <p style={{ color: "#fff", fontWeight: 900, fontSize: 16 }}>00:42:34</p>
                        <p style={{ color: "#777", fontSize: 11, fontWeight: 700 }}>tempo total</p>
                      </div>
                    </div>
                  </div>

                  <div style={{ marginBottom: 4 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                      <span style={{ fontSize: 11, color: "#777", fontWeight: 700 }}>Próximo: {next?.name || "nível máximo"}</span>
                      <span style={{ fontSize: 11, color: level.color, fontWeight: 900 }}>{races}/{next?.min || races} corridas</span>
                    </div>
                    <div style={{ background: "rgba(255,255,255,0.10)", borderRadius: 99, height: 5 }}>
                      <div style={{ background: level.color, width: `${progress}%`, height: 5, borderRadius: 99 }} />
                    </div>
                  </div>
                </div>
              </div>

              {showFollowModal && (
                <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.92)", zIndex: 200, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end" }}>
                  <div style={{ background: "#13131a", borderRadius: "24px 24px 0 0", padding: "20px 20px 0", width: "100%", maxWidth: 390, border: "1px solid #1e1e2e", maxHeight: "80vh", display: "flex", flexDirection: "column" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                      <p style={{ fontWeight: 900, fontSize: 17, textTransform: "capitalize" }}>{showFollowModal}</p>
                      <button onClick={() => setShowFollowModal(null)} style={{ background: "none", border: "none", color: "#777", fontSize: 24, cursor: "pointer" }}>✕</button>
                    </div>
                    <div style={{ flex: 1, overflowY: "auto", paddingBottom: 32 }}>
                      {followList.length === 0 && (
                        <EmptyState
                          icon={showFollowModal === "seguidores" ? "👥" : "🔎"}
                          title={showFollowModal === "seguidores" ? "Nenhum seguidor ainda" : "Você ainda não segue ninguém"}
                          description={showFollowModal === "seguidores" ? "Conforme outras pessoas encontrarem seu perfil, elas aparecem aqui." : "Explore a comunidade e siga corredores para personalizar seu feed."}
                          compact
                        />
                      )}
                      {followList.map((u) => (
                        <div key={u.id} style={{ display: "flex", alignItems: "center", gap: 12, paddingBottom: 16, marginBottom: 16, borderBottom: "1px solid #1e1e2e" }}>
                          {getAvatar(u, 48)}
                          <div style={{ flex: 1 }}>
                            <p style={{ fontWeight: 900, fontSize: 15 }}>{u.name}</p>
                            <p style={{ fontSize: 12, color: "#555" }}>{u.handle ? `@${u.handle}` : ""}</p>
                            <p style={{ fontSize: 11, color: getLevelColor(u.level), fontWeight: 900, marginTop: 2 }}>{getLevelIcon(u.level)} {u.level} · {u.races_count || 0} corridas</p>
                          </div>
                          <button onClick={() => handleFollow(u.id)} style={{ border: `1.5px solid ${realFollowing[u.id] ? "#1e1e2e" : "#e11d48"}`, color: realFollowing[u.id] ? "#555" : "#e11d48", background: "none", borderRadius: 20, padding: "6px 16px", fontSize: 12, fontWeight: 900, cursor: "pointer", fontFamily: "inherit" }}>
                            {realFollowing[u.id] ? "Seguindo" : "Seguir"}
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {avatarPreview && (
                <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.92)", zIndex: 300, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 24, padding: 24 }}>
                  <p style={{ fontWeight: 900, fontSize: 17 }}>Nova foto de perfil</p>
                  <img src={avatarPreview.previewUrl} alt="prévia" style={{ width: 180, height: 180, borderRadius: "50%", objectFit: "cover", border: "4px solid #e11d48" }} />
                  <div style={{ display: "flex", gap: 12, width: "100%", maxWidth: 300 }}>
                    <button onClick={() => setAvatarPreview(null)} style={{ flex: 1, border: "1px solid #1e1e2e", background: "none", color: "#888", borderRadius: 12, padding: 14, fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}>Cancelar</button>
                    <button onClick={confirmAvatarUpload} disabled={uploadingAvatar} style={{ flex: 1, background: "#e11d48", color: "#fff", border: "none", borderRadius: 12, padding: 14, fontSize: 14, fontWeight: 900, cursor: "pointer", fontFamily: "inherit" }}>{uploadingAvatar ? "Enviando..." : "Usar foto"}</button>
                  </div>
                </div>
              )}

              {showEditProfile && (
                <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.92)", zIndex: 300, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end" }}>
                  <div style={{ background: "#13131a", borderRadius: "24px 24px 0 0", padding: "20px 20px 32px", width: "100%", maxWidth: 390, border: "1px solid #1e1e2e" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                      <p style={{ fontWeight: 900, fontSize: 18 }}>Editar perfil</p>
                      <button onClick={() => setShowEditProfile(false)} style={{ background: "none", border: "none", color: "#777", fontSize: 24, cursor: "pointer" }}>✕</button>
                    </div>
                    <div style={{ display: "flex", justifyContent: "center", marginBottom: 18 }}>
                      <label htmlFor="av-modal" style={{ cursor: "pointer", textAlign: "center" }}>
                        {avatarPreview ? <img src={avatarPreview.previewUrl} alt="prévia" style={{ width: 82, height: 82, borderRadius: "50%", objectFit: "cover", border: "3px solid #e11d48" }} /> : profile?.avatar_url ? <img src={profile.avatar_url} alt="avatar" style={{ width: 82, height: 82, borderRadius: "50%", objectFit: "cover", border: "3px solid #e11d48" }} /> : <div style={{ width: 82, height: 82, borderRadius: "50%", background: "linear-gradient(135deg, #e11d48, #f97316)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 30, border: "3px solid #e11d48" }}>{level.icon}</div>}
                        <input id="av-modal" type="file" accept="image/*" style={{ display: "none" }} onChange={handleAvatarUpload} />
                        <p style={{ fontSize: 12, color: "#777", marginTop: 8 }}>Alterar foto</p>
                      </label>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 20 }}>
                      <div>
                        <p style={{ fontSize: 11, color: "#777", marginBottom: 6, fontWeight: 900 }}>Nome</p>
                        <input className="tinput" value={editForm.name} onChange={(e) => setEditForm(f => ({ ...f, name: e.target.value }))} placeholder="Seu nome" />
                      </div>
                      <div>
                        <p style={{ fontSize: 11, color: "#777", marginBottom: 6, fontWeight: 900 }}>@ Handle</p>
                        <div style={{ position: "relative" }}>
                          <span style={{ position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)", color: "#555", fontSize: 14 }}>@</span>
                          <input className="tinput" style={{ paddingLeft: 28 }} value={editForm.handle} onChange={(e) => setEditForm(f => ({ ...f, handle: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "") }))} placeholder="seuhandle" />
                        </div>
                      </div>
                      <div>
                        <p style={{ fontSize: 11, color: "#777", marginBottom: 6, fontWeight: 900 }}>Bio</p>
                        <textarea className="tinput" rows={3} value={editForm.bio} onChange={(e) => setEditForm(f => ({ ...f, bio: e.target.value }))} placeholder="Conte um pouco sobre você..." />
                      </div>
                    </div>
                    <button onClick={async () => { await handleEditProfile(); if (avatarPreview) await confirmAvatarUpload(); }} style={{ width: "100%", background: "#e11d48", color: "#fff", border: "none", borderRadius: 14, padding: 16, fontSize: 15, fontWeight: 900, cursor: "pointer", fontFamily: "inherit" }}>Salvar alterações</button>
                  </div>
                </div>
              )}


              {showSettings && (
                <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.92)", backdropFilter: "blur(14px)", zIndex: 770, display: "flex", alignItems: "stretch", justifyContent: "center", padding: 0 }}>
                  <div style={{ width: "100%", maxWidth: 430, background: "linear-gradient(180deg, #0b0b12 0%, #090910 100%)", minHeight: "100vh", display: "flex", flexDirection: "column", color: "#fff", borderLeft: "1px solid rgba(255,255,255,0.08)", borderRight: "1px solid rgba(255,255,255,0.08)" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, minHeight: 76, padding: "18px 18px 12px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                      <button
                        onClick={() => {
                          if (settingsView === "menu") closeSettings();
                          else if (!deletingAccount) {
                            setSettingsView("menu");
                            setDeleteConfirmationText("");
                            setDeleteAccountError("");
                          }
                        }}
                        style={{ width: 42, height: 42, borderRadius: "50%", border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.04)", color: "#fff", fontSize: 20, cursor: deletingAccount ? "not-allowed" : "pointer", opacity: deletingAccount ? 0.55 : 1 }}
                      >
                        ←
                      </button>
                      <p style={{ flex: 1, textAlign: "center", fontWeight: 900, fontSize: 18, marginRight: 42 }}>
                        {settingsView === "menu" ? "Configurações" : "Excluir minha conta"}
                      </p>
                    </div>

                    <div style={{ flex: 1, overflowY: "auto", padding: "22px 18px 34px" }}>
                      {settingsView === "menu" && (
                        <>
                          <p style={{ color: "#737383", fontSize: 11, fontWeight: 900, letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 10 }}>Conta</p>
                          <div style={{ border: "1px solid rgba(255,255,255,0.08)", borderRadius: 22, overflow: "hidden", background: "rgba(255,255,255,0.03)", marginBottom: 18 }}>
                            <button
                              onClick={() => {
                                setShowSettings(false);
                                setShowEditProfile(true);
                                setEditForm({ name: profile?.name || "", bio: profile?.bio || "", handle: profile?.handle || "" });
                                setAvatarPreview(null);
                              }}
                              style={{ width: "100%", minHeight: 62, display: "flex", alignItems: "center", gap: 12, padding: "0 16px", background: "transparent", border: "none", borderBottom: "1px solid rgba(255,255,255,0.08)", color: "#fff", fontFamily: "inherit", cursor: "pointer", textAlign: "left" }}
                            >
                              <span style={{ width: 34, height: 34, borderRadius: 12, background: "rgba(255,255,255,0.05)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>👤</span>
                              <span style={{ flex: 1, fontSize: 14, fontWeight: 900 }}>Editar perfil</span>
                              <span style={{ color: "#777", fontSize: 18 }}>›</span>
                            </button>
                            <button
                              onClick={() => { setSettingsView("confirm"); setDeleteAccountError(""); }}
                              style={{ width: "100%", minHeight: 62, display: "flex", alignItems: "center", gap: 12, padding: "0 16px", background: "rgba(225,29,72,0.08)", border: "none", color: "#ff5578", fontFamily: "inherit", cursor: "pointer", textAlign: "left" }}
                            >
                              <span style={{ width: 34, height: 34, borderRadius: 12, background: "rgba(225,29,72,0.14)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>🗑</span>
                              <span style={{ flex: 1, fontSize: 14, fontWeight: 900 }}>Excluir minha conta</span>
                              <span style={{ color: "#ff5578", fontSize: 18 }}>›</span>
                            </button>
                          </div>

                          <div style={{ border: "1px solid rgba(255,255,255,0.08)", borderRadius: 22, padding: 16, background: "rgba(255,255,255,0.03)" }}>
                            <p style={{ fontWeight: 900, fontSize: 15, marginBottom: 7 }}>Segurança da conta</p>
                            <p style={{ color: "#9a9aaa", fontSize: 13, lineHeight: 1.55 }}>A exclusão é permanente. Para evitar ações acidentais, pedimos uma confirmação em duas etapas antes de remover a conta.</p>
                          </div>
                        </>
                      )}

                      {settingsView === "confirm" && (
                        <>
                          <div style={{ textAlign: "center", padding: "12px 0 20px" }}>
                            <div style={{ width: 82, height: 82, borderRadius: "50%", margin: "0 auto 16px", background: "rgba(225,29,72,0.16)", border: "1px solid rgba(225,29,72,0.28)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 36 }}>🗑</div>
                            <h3 style={{ fontSize: 28, lineHeight: 1.05, fontWeight: 900, marginBottom: 10, fontFamily: "'Space Grotesk', sans-serif" }}>Tem certeza?</h3>
                            <p style={{ color: "#b2b2bf", fontSize: 14, lineHeight: 1.55, maxWidth: 340, margin: "0 auto" }}>Esta ação é permanente e não pode ser desfeita.</p>
                          </div>

                          <div style={{ border: "1px solid rgba(255,255,255,0.08)", borderRadius: 22, background: "rgba(255,255,255,0.03)", padding: 16, marginBottom: 16 }}>
                            <p style={{ fontWeight: 900, fontSize: 14, marginBottom: 12 }}>O que será removido:</p>
                            {["Seu perfil e informações pessoais", "Publicações, fotos e comentários", "Atividades, treinos e histórico", "Clubes criados e participações", "Seguidores, seguindo e dados associados"].map((item) => (
                              <div key={item} style={{ display: "flex", gap: 10, alignItems: "flex-start", color: "#d6d6df", fontSize: 13, lineHeight: 1.45, marginBottom: 10 }}>
                                <span style={{ color: "#ff5578", fontWeight: 900 }}>×</span>
                                <span>{item}</span>
                              </div>
                            ))}
                          </div>

                          <button
                            onClick={() => setSettingsView("final")}
                            style={{ width: "100%", height: 54, border: "none", borderRadius: 18, background: "linear-gradient(135deg, #e11d48, #ff3d63)", color: "#fff", fontWeight: 900, fontSize: 15, fontFamily: "inherit", cursor: "pointer", marginBottom: 10 }}
                          >
                            Continuar
                          </button>
                          <button
                            onClick={() => setSettingsView("menu")}
                            style={{ width: "100%", height: 50, border: "1px solid rgba(255,255,255,0.10)", borderRadius: 18, background: "rgba(255,255,255,0.035)", color: "#ddd", fontWeight: 900, fontSize: 14, fontFamily: "inherit", cursor: "pointer" }}
                          >
                            Cancelar
                          </button>
                        </>
                      )}

                      {settingsView === "final" && (
                        <>
                          <div style={{ textAlign: "center", padding: "18px 0 20px" }}>
                            <div style={{ fontSize: 54, marginBottom: 10 }}>⚠️</div>
                            <h3 style={{ fontSize: 27, lineHeight: 1.08, fontWeight: 900, marginBottom: 10, fontFamily: "'Space Grotesk', sans-serif" }}>Confirmação final</h3>
                            <p style={{ color: "#b2b2bf", fontSize: 14, lineHeight: 1.55, maxWidth: 340, margin: "0 auto" }}>Para confirmar a exclusão da sua conta, digite a palavra abaixo:</p>
                          </div>

                          <div style={{ border: "1px solid rgba(255,255,255,0.10)", borderRadius: 18, background: "rgba(255,255,255,0.03)", padding: 16, textAlign: "center", color: "#ff5578", fontWeight: 900, fontSize: 16, letterSpacing: 0.8, marginBottom: 12 }}>EXCLUIR</div>
                          <input
                            value={deleteConfirmationText}
                            onChange={(e) => setDeleteConfirmationText(e.target.value)}
                            placeholder="Digite EXCLUIR"
                            autoCapitalize="characters"
                            style={{ width: "100%", height: 54, borderRadius: 18, border: "1px solid rgba(255,255,255,0.10)", background: "#101018", color: "#fff", padding: "0 16px", fontSize: 15, fontWeight: 900, fontFamily: "inherit", outline: "none", textAlign: "center", marginBottom: 12 }}
                          />
                          {deleteAccountError && (
                            <p style={{ color: "#ff7a92", background: "rgba(225,29,72,0.12)", border: "1px solid rgba(225,29,72,0.25)", borderRadius: 16, padding: "12px 14px", fontSize: 12.5, lineHeight: 1.5, marginBottom: 12 }}>{deleteAccountError}</p>
                          )}
                          <button
                            onClick={handleDeleteAccount}
                            disabled={deleteConfirmationText.trim().toUpperCase() !== "EXCLUIR" || deletingAccount}
                            style={{ width: "100%", height: 54, border: "none", borderRadius: 18, background: deleteConfirmationText.trim().toUpperCase() === "EXCLUIR" && !deletingAccount ? "linear-gradient(135deg, #e11d48, #ff3d63)" : "#3a1a22", color: "#fff", fontWeight: 900, fontSize: 15, fontFamily: "inherit", cursor: deleteConfirmationText.trim().toUpperCase() === "EXCLUIR" && !deletingAccount ? "pointer" : "not-allowed", marginBottom: 10 }}
                          >
                            {deletingAccount ? "Excluindo conta..." : "Excluir minha conta"}
                          </button>
                          <button
                            onClick={() => { setSettingsView("menu"); setDeleteConfirmationText(""); setDeleteAccountError(""); }}
                            disabled={deletingAccount}
                            style={{ width: "100%", height: 50, border: "1px solid rgba(255,255,255,0.10)", borderRadius: 18, background: "rgba(255,255,255,0.035)", color: "#ddd", fontWeight: 900, fontSize: 14, fontFamily: "inherit", cursor: deletingAccount ? "not-allowed" : "pointer", opacity: deletingAccount ? 0.55 : 1 }}
                          >
                            Cancelar
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(4, 1fr)",
                  borderBottom: "1px solid #1e1e2e",
                  background: "#0a0a0f",
                  position: "sticky",
                  top: 0,
                  zIndex: 10
                }}
              >
                {[{ id: "fotos", label: "Fotos" }, { id: "posts_p", label: "Posts" }, { id: "ativ_p", label: "Atividades" }, { id: "conquistas_p", label: "Conquistas" }].map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setProfileTab(t.id)}
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      fontFamily: "inherit",
                      fontSize: 12,
                      fontWeight: 900,
                      padding: "13px 0 12px",
                      color: profileTab === t.id ? "#e11d48" : "#666",
                      position: "relative"
                    }}
                  >
                    {t.label}
                    {profileTab === t.id && <span style={{ position: "absolute", left: "50%", transform: "translateX(-50%)", bottom: -1, width: 34, height: 2, background: "#e11d48", borderRadius: 2 }} />}
                  </button>
                ))}
              </div>

              {profileTab === "fotos" && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 3, paddingTop: 3 }}>
                  {posts.filter(p => p.user_id === user.id && p.photo_url).map((p) => (
                    <button
                      key={p.id}
                      onClick={() => { setSelectedPhotoPost(p); setOpenComments(p.id); loadComments(p.id); }}
                      aria-label="Abrir publicação da foto"
                      style={{ aspectRatio: "1", overflow: "hidden", cursor: "pointer", background: "#13131a", border: "none", padding: 0, position: "relative" }}
                    >
                      <img src={p.photo_url} alt="foto" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      <span style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, transparent 55%, rgba(0,0,0,0.42))", opacity: 0, transition: "opacity 0.18s ease" }} />
                    </button>
                  ))}
                  {posts.filter(p => p.user_id === user.id && p.photo_url).length === 0 && (
                    <div style={{ gridColumn: "1/-1" }}>
                      <EmptyState
                        icon="📸"
                        title="Sua galeria ainda está vazia"
                        description="Publique uma foto de treino, prova ou conquista para ela aparecer aqui."
                        actionLabel="Publicar foto"
                        onAction={() => { setPublishType("foto"); setShowPublish(true); }}
                      />
                    </div>
                  )}
                </div>
              )}

              {profileTab === "posts_p" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 14, paddingTop: 16 }}>
                  {posts.filter(p => p.user_id === user.id).map((p) => (
                    <div key={p.id} style={{ background: "linear-gradient(180deg, rgba(255,255,255,0.045), rgba(255,255,255,0.025))", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 22, padding: 16 }}>
                      <div style={{ display: "flex", gap: 11, alignItems: "center", marginBottom: 12 }}>
                        {getAvatar(profile, 42)}
                        <div style={{ flex: 1 }}>
                          <p style={{ fontSize: 14, fontWeight: 900 }}>{profile?.name || userName}</p>
                          <p style={{ fontSize: 12, color: "#777" }}>@{profile?.handle || "corredor"} · {timeAgo(p.created_at)}</p>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setModerationMenu({
                              targetType: "ownPost",
                              targetId: p.id,
                              targetUserId: user.id,
                              targetLabel: "Sua publicação",
                            });
                          }}
                          style={{ width: 36, height: 36, borderRadius: 12, background: "rgba(255,255,255,0.035)", border: "1px solid rgba(255,255,255,0.08)", color: "#888", cursor: "pointer", fontSize: 18, fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center" }}
                          title="Opções"
                        >•••</button>
                      </div>
                      {p.text && <p style={{ fontSize: 15, color: "#f0f0f0", lineHeight: 1.55, marginBottom: p.photo_url ? 12 : 0 }}>{p.text}</p>}
                      {p.photo_url && <div style={{ width: "100%", aspectRatio: "4/3", borderRadius: 16, marginTop: 12, overflow: "hidden" }}><img src={p.photo_url} alt="post" style={{ width: "100%", height: "100%", objectFit: "cover" }} /></div>}
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 13, marginTop: 16 }}>
                        <div style={{ display: "flex", gap: 18 }}>
                          <button onClick={() => handleLikePost(p.id, p.user_id)} style={{ background: "none", border: "none", color: liked[p.id] ? "#e11d48" : "#8a8a96", fontSize: 15, cursor: "pointer", fontFamily: "inherit" }}>{liked[p.id] ? "♥" : "♡"} {p.likes || 0}</button>
                          <button onClick={() => { if (openComments === p.id) setOpenComments(null); else { setOpenComments(p.id); loadComments(p.id); } }} style={{ background: "none", border: "none", color: openComments === p.id ? "#e11d48" : "#8a8a96", fontSize: 15, cursor: "pointer", fontFamily: "inherit" }}>💬 {comments[p.id]?.length || 0}</button>
                        </div>
                        <button onClick={() => handleShare("post", p)} style={{ background: "none", border: "none", color: "#8a8a96", fontSize: 18, cursor: "pointer" }}>↗</button>
                      </div>

                      {openComments === p.id && (
                        <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid rgba(255,255,255,0.08)" }}>
                          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                            {(comments[p.id] || []).map((comment) => (
                              <div key={comment.id} style={{ display: "flex", gap: 9, alignItems: "flex-start" }}>
                                {getAvatar(comment.profiles, 28)}
                                <div style={{ background: "rgba(255,255,255,0.045)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: "8px 10px", flex: 1, position: "relative" }}>
                                  {comment.user_id !== user.id && (
                                    <button
                                      onClick={() => openModerationMenu({
                                        targetType: "comment",
                                        targetId: comment.id,
                                        targetUserId: comment.user_id,
                                        targetLabel: comment.profiles?.handle ? `@${comment.profiles.handle}` : comment.profiles?.name || "usuário",
                                      })}
                                      title="Opções"
                                      style={{ position: "absolute", top: 6, right: 7, background: "none", border: "none", color: "#666", fontSize: 15, cursor: "pointer", padding: 2 }}
                                    >
                                      •••
                                    </button>
                                  )}
                                  <p style={{ fontSize: 12, fontWeight: 900, color: "#fff", marginBottom: 3, paddingRight: comment.user_id !== user.id ? 28 : 0 }}>{comment.profiles?.name || "Corredor"}</p>
                                  <p style={{ fontSize: 13, color: "#d7d7df", lineHeight: 1.4 }}>{comment.text}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                            <input value={newComment} onChange={(e) => setNewComment(e.target.value)} placeholder="Escreva um comentário..." style={{ flex: 1, background: "#0f0f17", border: "1px solid #1e1e2e", borderRadius: 14, padding: "11px 13px", color: "#fff", outline: "none", fontSize: 13, fontFamily: "inherit" }} />
                            <button onClick={() => handleComment(p.id)} disabled={!newComment.trim()} style={{ background: newComment.trim() ? "linear-gradient(135deg, #e11d48, #ff3d63)" : "#2a2a35", color: "#fff", border: "none", borderRadius: 14, padding: "0 14px", fontSize: 13, fontWeight: 900, cursor: newComment.trim() ? "pointer" : "not-allowed", fontFamily: "inherit" }}>Enviar</button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                  {posts.filter(p => p.user_id === user.id).length === 0 && (
                    <EmptyState
                      icon="✍️"
                      title="Você ainda não publicou textos"
                      description="Compartilhe uma reflexão, treino ou conquista com a comunidade."
                      actionLabel="Escrever post"
                      onAction={() => { setPublishType("post"); setShowPublish(true); }}
                    />
                  )}
                </div>
              )}

              {profileTab === "ativ_p" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 14, paddingTop: 16 }}>
                  {activities.filter(a => a.user_id === user.id).map((a) => (
                    <div key={a.id} style={{ background: "linear-gradient(180deg, rgba(255,255,255,0.045), rgba(255,255,255,0.025))", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 22, padding: 16 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                        <div>
                          <p style={{ fontSize: 15, fontWeight: 900 }}>Corrida ao ar livre</p>
                          <p style={{ fontSize: 12, color: "#777", marginTop: 3 }}>{timeAgo(a.created_at)}</p>
                        </div>
                        <button onClick={() => handleDeleteActivity(a.id)} style={{ background: "none", border: "none", color: "#777", cursor: "pointer", fontSize: 16 }}>🗑️</button>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 14 }}>
                        <div className="sbox"><p style={{ fontSize: 17, fontWeight: 900, color: "#e11d48" }}>{a.distance} km</p><p style={{ fontSize: 9, color: "#777", marginTop: 1 }}>distância</p></div>
                        <div className="sbox"><p style={{ fontSize: 16, fontWeight: 900 }}>{a.duration || "—"}</p><p style={{ fontSize: 9, color: "#777", marginTop: 1 }}>tempo</p></div>
                        <div className="sbox"><p style={{ fontSize: 13, fontWeight: 900 }}>{a.pace || "—"}</p><p style={{ fontSize: 9, color: "#777", marginTop: 1 }}>pace</p></div>
                      </div>
                      <RouteMap route={a.route || []} />
                      <button onClick={() => handleShare("atividade", { distance: a.distance, duration: a.duration, pace: a.pace })} style={{ background: "none", border: "1px solid rgba(255,255,255,0.10)", color: "#aaa", borderRadius: 12, padding: "10px 12px", fontSize: 12, fontWeight: 900, cursor: "pointer", fontFamily: "inherit", marginTop: 12 }}>↗ Compartilhar atividade</button>
                    </div>
                  ))}
                  {activities.filter(a => a.user_id === user.id).length === 0 && (
                    <EmptyState
                      icon="🏃"
                      title="Nenhuma atividade registrada"
                      description="Abra o Hub e registre sua primeira corrida com GPS."
                      actionLabel="Ir para o Hub"
                      onAction={() => setTab("hub")}
                    />
                  )}
                </div>
              )}

              {profileTab === "conquistas_p" && (
                <div style={{ paddingTop: 16, display: "flex", flexDirection: "column", gap: 14 }}>
                  <div style={{ background: "linear-gradient(180deg, rgba(255,255,255,0.045), rgba(255,255,255,0.025))", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 22, padding: 18 }}>
                    <p style={{ fontWeight: 900, fontSize: 17, marginBottom: 14 }}>Nível atual</p>
                    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                      <div style={{ width: 54, height: 54, borderRadius: 16, background: `${level.color}22`, border: `1.5px solid ${level.color}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 25 }}>{level.icon}</div>
                      <div style={{ flex: 1 }}>
                        <p style={{ fontSize: 20, fontWeight: 900, color: level.color }}>{level.name}</p>
                        <div style={{ background: "#1e1e2e", borderRadius: 99, height: 5, marginTop: 8 }}><div style={{ background: level.color, width: `${progress}%`, height: 5, borderRadius: 99 }} /></div>
                        <p style={{ fontSize: 12, color: "#777", marginTop: 7 }}>{races}/{next?.min || races} corridas</p>
                      </div>
                    </div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    {[{ title: "Primeira corrida", value: races >= 1 ? "Concluída" : "Bloqueada", icon: "🏁" }, { title: "5 corridas", value: races >= 5 ? "Concluída" : `${Math.max(5 - races, 0)} restantes`, icon: "🔥" }, { title: "10 km totais", value: (profile?.total_km || 0) >= 10 ? "Concluída" : "Em progresso", icon: "⚡" }, { title: "Comunidade", value: followersCount > 0 ? "Conectado" : "Em breve", icon: "🤝" }].map((badge) => (
                      <div key={badge.title} style={{ background: "rgba(255,255,255,0.045)", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 18, padding: 14 }}>
                        <p style={{ fontSize: 28, marginBottom: 10 }}>{badge.icon}</p>
                        <p style={{ fontSize: 13, fontWeight: 900 }}>{badge.title}</p>
                        <p style={{ fontSize: 11, color: "#777", marginTop: 5 }}>{badge.value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
                </>
              )}
            </div>
          )}
        </div>
      </div>

        {/* Perfil de outro usuário */}
        {viewingProfile && (() => {
          const vLevel = getLevel(viewingProfile.races_count || 0);
          const vNext = getNextLevel(viewingProfile.races_count || 0);
          const vProgress = vNext ? ((viewingProfile.races_count - vLevel.min) / (vNext.min - vLevel.min)) * 100 : 100;
          return (
            <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "#0a0a0f", zIndex: 400, overflowY: "auto" }}>
              <div style={{ padding: "52px 20px 16px", background: "linear-gradient(180deg, #0f0f18 0%, #0a0a0f 100%)", position: "sticky", top: 0, zIndex: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                  <button onClick={() => setViewingProfile(null)} style={{ background: "none", border: "none", color: "#888", fontSize: 22, cursor: "pointer" }}>←</button>
                  <p style={{ fontWeight: 700, fontSize: 16, flex: 1 }}>{viewingProfile.name}</p>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      openModerationMenu({
                        targetType: "user",
                        targetId: viewingProfile.id,
                        targetUserId: viewingProfile.id,
                        targetLabel: viewingProfile.handle ? `@${viewingProfile.handle}` : viewingProfile.name || "usuário",
                      });
                    }}
                    style={{ background: "rgba(255,255,255,0.035)", border: "1px solid #1e1e2e", color: "#888", width: 36, height: 36, borderRadius: 12, fontSize: 18, cursor: "pointer", fontFamily: "inherit" }}
                    title="Opções"
                  >
                    •••
                  </button>
                </div>
              </div>
              <div style={{ padding: "0 20px 100px" }}>
                <div style={{ background: "#13131a", borderRadius: 20, padding: 20, border: "1px solid #1e1e2e", marginBottom: 2, position: "relative", overflow: "hidden" }}>
                  <div style={{ display: "flex", gap: 14, alignItems: "center", marginBottom: 14 }}>
                    {(() => {
                    const story = stories.find(s => s.user_id === viewingProfile.id);
                    const vColor = vLevel.color;
                    return story ? (
                      <div style={{ padding: 2, borderRadius: "50%", background: vColor, cursor: "pointer", flexShrink: 0 }}
                        onClick={() => { setSeenStories(st => ({...st, [viewingProfile.id]: true})); setActiveStory({ user: viewingProfile.name, color: vColor, level: viewingProfile.level, media_url: story.media_url, emoji: vLevel.icon, avatar_url: viewingProfile.avatar_url }); }}>
                        <div style={{ padding: 2, borderRadius: "50%", background: "#0a0a0f" }}>
                          <div style={{ width: 64, height: 64, borderRadius: "50%", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(135deg, #e11d48, #f97316)", fontSize: 26 }}>
                            {viewingProfile.avatar_url ? <img src={viewingProfile.avatar_url} alt="av" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : vLevel.icon}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div style={{ width: 68, height: 68, borderRadius: "50%", background: "linear-gradient(135deg, #e11d48, #f97316)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, border: "3px solid #1e1e2e", overflow: "hidden", flexShrink: 0 }}>
                        {viewingProfile.avatar_url ? <img src={viewingProfile.avatar_url} alt="av" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : vLevel.icon}
                      </div>
                    );
                  })()}
                    <div style={{ flex: 1 }}>
                      <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 18, fontWeight: 800, marginBottom: 2 }}>{viewingProfile.name}</h2>
                      <p style={{ fontSize: 11, color: "#555", marginBottom: 6 }}>@{viewingProfile.handle || viewingProfile.name?.toLowerCase().replace(/\s/g, "")}</p>
                      <div style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "#1e1e2e", borderRadius: 99, padding: "3px 10px" }}>
                        <span style={{ fontSize: 11, color: vLevel.color, fontWeight: 700 }}>{vLevel.icon} {vLevel.name}</span>
                      </div>
                    </div>
                  </div>
                  {viewingProfile.bio && <p style={{ fontSize: 13, color: "#aaa", lineHeight: 1.5, marginBottom: 14 }}>{viewingProfile.bio}</p>}
                  <div style={{ marginBottom: 14 }}><div style={{ background: "#1e1e2e", borderRadius: 99, height: 4 }}><div style={{ background: vLevel.color, width: `${vProgress}%`, height: 4, borderRadius: 99 }} /></div></div>
                  <div style={{ display: "flex", gap: 5, marginBottom: 14 }}>
                    <div className="sbox"><p style={{ fontSize: 16, fontWeight: 700, color: "#e11d48" }}>{viewingProfile.races_count || 0}</p><p style={{ fontSize: 9, color: "#555", marginTop: 1 }}>corridas</p></div>
                    <div className="sbox"><p style={{ fontSize: 16, fontWeight: 700 }}>{Number(viewingProfile.total_km || 0).toFixed(1)} km</p><p style={{ fontSize: 9, color: "#555", marginTop: 1 }}>total</p></div>
                    <div className="sbox"><p style={{ fontSize: 14, fontWeight: 700 }}>{viewingProfile.avg_pace || "—"}</p><p style={{ fontSize: 9, color: "#555", marginTop: 1 }}>pace médio</p></div>
                  </div>
                  <div style={{ display: "flex", gap: 20, marginBottom: 14 }}>
                    <div style={{ textAlign: "center" }}><p style={{ fontWeight: 700, fontSize: 18 }}>{viewingProfile.followersCount}</p><p style={{ fontSize: 11, color: "#555", marginTop: 2 }}>seguidores</p></div>
                    <div style={{ textAlign: "center" }}><p style={{ fontWeight: 700, fontSize: 18 }}>{viewingProfile.followingCount}</p><p style={{ fontSize: 11, color: "#555", marginTop: 2 }}>seguindo</p></div>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={async () => { await handleFollow(viewingProfile.id); setViewingProfile(v => ({ ...v, followersCount: realFollowing[viewingProfile.id] ? v.followersCount - 1 : v.followersCount + 1 })); }} style={{ flex: 1, background: realFollowing[viewingProfile.id] ? "none" : "#e11d48", color: realFollowing[viewingProfile.id] ? "#666" : "#fff", border: realFollowing[viewingProfile.id] ? "1px solid #1e1e2e" : "none", borderRadius: 12, padding: "11px 0", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                      {realFollowing[viewingProfile.id] ? "Seguindo" : "Seguir"}
                    </button>
                    <button onClick={() => handleShare("perfil")} style={{ background: "none", color: "#888", border: "1px solid #1e1e2e", borderRadius: 12, padding: "11px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>↗</button>
                  </div>
                </div>
                <div style={{ display: "flex", borderBottom: "1px solid #1e1e2e", background: "#0a0a0f", position: "sticky", top: 100, zIndex: 9 }}>
                  {[{ id: "fotos", label: "Fotos" }, { id: "posts_v", label: "Posts" }, { id: "ativ_v", label: "Atividades" }, { id: "niveis_v", label: "Níveis" }].map((t) => (
                    <button key={t.id} onClick={() => setViewTab(t.id)} style={{ flex: 1, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 11, fontWeight: 700, padding: "10px 0", color: viewTab === t.id ? "#e11d48" : "#555" }}>
                      {t.label}
                      {viewTab === t.id && <div style={{ width: 20, height: 2, background: "#e11d48", borderRadius: 2, margin: "4px auto 0" }} />}
                    </button>
                  ))}
                </div>
                {viewTab === "fotos" && (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 2, marginTop: 2 }}>
                    {viewPosts.filter(p => p.photo_url).map((p) => <div key={p.id} style={{ aspectRatio: "1", overflow: "hidden" }}><img src={p.photo_url} alt="foto" style={{ width: "100%", height: "100%", objectFit: "cover" }} /></div>)}
                    {viewPosts.filter(p => p.photo_url).length === 0 && (
                      <div style={{ gridColumn: "1/-1" }}>
                        <EmptyState
                          compact
                          icon="📸"
                          title="Nenhuma foto publicada"
                          description="As imagens deste perfil aparecerão aqui."
                        />
                      </div>
                    )}
                  </div>
                )}
                {viewTab === "posts_v" && (
                  <div>
                    {viewPosts.filter(p => p.text).map((p) => (
                      <div key={p.id} style={{ padding: "16px 0", borderBottom: "1px solid #1e1e2e" }}>
                        {p.photo_url && <div style={{ aspectRatio: "4/5", borderRadius: 12, overflow: "hidden", marginBottom: 10 }}><img src={p.photo_url} style={{ width: "100%", height: "100%", objectFit: "cover" }} /></div>}
                        <p style={{ fontSize: 14, color: "#ccc", lineHeight: 1.6 }}>{p.text}</p>
                        <span style={{ fontSize: 11, color: "#555", marginTop: 6, display: "block" }}>❤️ {p.likes || 0}</span>
                      </div>
                    ))}
                    {viewPosts.filter(p => p.text).length === 0 && (
                      <EmptyState
                        compact
                        icon="✍️"
                        title="Nenhum post publicado"
                        description="Os textos deste perfil aparecerão aqui."
                      />
                    )}
                  </div>
                )}
                {viewTab === "ativ_v" && (
                  <div>
                    {viewActivities.map((a) => (
                      <div key={a.id} style={{ padding: "14px 0", borderBottom: "1px solid #1e1e2e" }}>
                        <div style={{ display: "flex", gap: 6 }}>
                          <div className="sbox"><p style={{ fontSize: 15, fontWeight: 700, color: "#e11d48" }}>{a.distance} km</p><p style={{ fontSize: 9, color: "#555", marginTop: 1 }}>distância</p></div>
                          {a.duration && <div className="sbox"><p style={{ fontSize: 15, fontWeight: 700 }}>{a.duration}</p><p style={{ fontSize: 9, color: "#555", marginTop: 1 }}>tempo</p></div>}
                          {a.pace && <div className="sbox"><p style={{ fontSize: 13, fontWeight: 700 }}>{a.pace}</p><p style={{ fontSize: 9, color: "#555", marginTop: 1 }}>pace</p></div>}
                        </div>
                      </div>
                    ))}
                    {viewActivities.length === 0 && (
                      <EmptyState
                        compact
                        icon="⌁"
                        title="Nenhuma atividade registrada"
                        description="As corridas deste perfil aparecerão aqui."
                      />
                    )}
                  </div>
                )}
                {viewTab === "niveis_v" && (
                  <div style={{ paddingTop: 16, display: "flex", flexDirection: "column", gap: 12 }}>
                    <div className="card">
                      {LEVELS.map((l, i) => {
                        const isActive = l.name === vLevel.name;
                        const isPast = (viewingProfile.races_count || 0) > l.max;
                        return (
                          <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, opacity: !isActive && !isPast ? 0.3 : 1, marginBottom: i < LEVELS.length - 1 ? 12 : 0 }}>
                            <div style={{ width: 36, height: 36, borderRadius: 10, background: isActive || isPast ? `${l.color}22` : "#1e1e2e", border: `1.5px solid ${isActive || isPast ? l.color : "#1e1e2e"}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>{l.icon}</div>
                            <div style={{ flex: 1 }}>
                              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                                <span style={{ fontSize: 13, fontWeight: 700, color: isActive ? l.color : isPast ? "#555" : "#333" }}>{l.name}</span>
                                <span style={{ fontSize: 11, color: "#444" }}>{l.min === 0 ? `0-${l.max}` : l.max === Infinity ? `${l.min}+` : `${l.min}-${l.max}`}</span>
                              </div>
                              <div style={{ background: "#1e1e2e", borderRadius: 99, height: 4 }}><div style={{ background: l.color, width: isPast ? "100%" : isActive ? `${vProgress}%` : "0%", height: 4, borderRadius: 99 }} /></div>
                            </div>
                            <span style={{ fontSize: 13 }}>{isPast ? "✅" : isActive ? "▶" : ""}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })()}

        {/* Modal de publicação da foto no perfil */}
        {selectedPhotoPost && (() => {
          const modalPost = posts.find((post) => post.id === selectedPhotoPost.id) || selectedPhotoPost;
          return (
            <div
              style={{ position: "fixed", inset: 0, zIndex: 520, background: "rgba(0,0,0,0.94)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}
              onClick={() => { setSelectedPhotoPost(null); setOpenComments(null); setNewComment(""); }}
            >
              <div
                onClick={(e) => e.stopPropagation()}
                style={{ width: "100%", maxWidth: 390, maxHeight: "94vh", overflowY: "auto", background: "#101018", border: "1px solid rgba(255,255,255,0.10)", borderRadius: "28px 28px 0 0", boxShadow: "0 -28px 70px rgba(0,0,0,0.55)" }}
              >
                <div style={{ position: "sticky", top: 0, zIndex: 3, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "16px 18px", background: "rgba(16,16,24,0.94)", backdropFilter: "blur(16px)", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                    {getAvatar(profile, 38)}
                    <div style={{ minWidth: 0 }}>
                      <p style={{ color: "#fff", fontSize: 14, fontWeight: 900, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{profile?.name || userName}</p>
                      <p style={{ color: "#777", fontSize: 11 }}>@{profile?.handle || "corredor"} · {timeAgo(modalPost.created_at)}</p>
                    </div>
                  </div>
                  <button onClick={() => { setSelectedPhotoPost(null); setOpenComments(null); setNewComment(""); }} style={{ width: 38, height: 38, borderRadius: "50%", border: "1px solid rgba(255,255,255,0.10)", background: "rgba(255,255,255,0.05)", color: "#aaa", fontSize: 20, cursor: "pointer" }}>✕</button>
                </div>

                {modalPost.photo_url && (
                  <div style={{ background: "#07070c" }}>
                    <img src={modalPost.photo_url} alt="Publicação" style={{ width: "100%", maxHeight: "52vh", objectFit: "contain", display: "block", background: "#07070c" }} />
                  </div>
                )}

                <div style={{ padding: "16px 18px 28px" }}>
                  {modalPost.text && <p style={{ color: "#f0f0f0", fontSize: 14.5, lineHeight: 1.58, marginBottom: 15 }}>{modalPost.text}</p>}

                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, borderTop: "1px solid rgba(255,255,255,0.08)", borderBottom: "1px solid rgba(255,255,255,0.08)", padding: "13px 0" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
                      <button onClick={() => handleLikePost(modalPost.id, modalPost.user_id)} style={{ background: "none", border: "none", color: liked[modalPost.id] ? "#e11d48" : "#a0a0aa", fontSize: 16, fontWeight: 900, cursor: "pointer", fontFamily: "inherit" }}>{liked[modalPost.id] ? "♥" : "♡"} {modalPost.likes || 0}</button>
                      <button onClick={() => { if (openComments === modalPost.id) setOpenComments(null); else { setOpenComments(modalPost.id); loadComments(modalPost.id); } }} style={{ background: "none", border: "none", color: openComments === modalPost.id ? "#e11d48" : "#a0a0aa", fontSize: 15, fontWeight: 900, cursor: "pointer", fontFamily: "inherit" }}>💬 {(comments[modalPost.id] || []).length || modalPost.comments || 0}</button>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <button onClick={() => handleShare("post", modalPost)} style={{ width: 36, height: 36, borderRadius: 12, border: "1px solid rgba(255,255,255,0.10)", background: "rgba(255,255,255,0.04)", color: "#aaa", fontSize: 18, cursor: "pointer" }}>↗</button>
                      <button onClick={async () => { await handleDeletePost(modalPost.id); setSelectedPhotoPost(null); setOpenComments(null); setNewComment(""); }} style={{ width: 36, height: 36, borderRadius: 12, border: "1px solid rgba(255,255,255,0.10)", background: "rgba(255,255,255,0.04)", color: "#aaa", fontSize: 16, cursor: "pointer" }}>🗑️</button>
                    </div>
                  </div>

                  <div style={{ marginTop: 16 }}>
                    <p style={{ color: "#fff", fontSize: 14, fontWeight: 900, marginBottom: 12 }}>Comentários</p>
                    <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 13 }}>
                      {(comments[modalPost.id] || []).length > 0 ? (comments[modalPost.id] || []).map((comment) => (
                        <div key={comment.id} style={{ display: "flex", gap: 9, alignItems: "flex-start" }}>
                          {getAvatar(comment.profiles, 28)}
                          <div style={{ background: "rgba(255,255,255,0.045)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: "8px 10px", flex: 1, position: "relative" }}>
                            {comment.user_id !== user.id && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openModerationMenu({
                                    targetType: "comment",
                                    targetId: comment.id,
                                    targetUserId: comment.user_id,
                                    targetLabel: comment.profiles?.handle ? `@${comment.profiles.handle}` : comment.profiles?.name || "usuário",
                                  });
                                }}
                                title="Opções"
                                style={{ position: "absolute", top: 6, right: 7, background: "none", border: "none", color: "#666", fontSize: 15, cursor: "pointer", padding: 2 }}
                              >
                                •••
                              </button>
                            )}
                            <p style={{ fontSize: 12, fontWeight: 900, color: "#fff", marginBottom: 3, paddingRight: comment.user_id !== user.id ? 28 : 0 }}>{comment.profiles?.name || "Corredor"}</p>
                            <p style={{ fontSize: 13, color: "#d7d7df", lineHeight: 1.4 }}>{comment.text}</p>
                          </div>
                        </div>
                      )) : <EmptyState
                        compact
                        icon="💬"
                        title="Nenhum comentário ainda"
                        description="Seja a primeira pessoa a comentar."
                      />}
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <input value={newComment} onChange={(e) => setNewComment(e.target.value)} placeholder="Escreva um comentário..." style={{ flex: 1, background: "#0b0b12", border: "1px solid #242435", borderRadius: 14, padding: "11px 13px", color: "#fff", outline: "none", fontSize: 13, fontFamily: "inherit" }} />
                      <button onClick={() => handleComment(modalPost.id)} disabled={!newComment.trim()} style={{ background: newComment.trim() ? "linear-gradient(135deg, #e11d48, #ff3d63)" : "#2a2a35", color: "#fff", border: "none", borderRadius: 14, padding: "0 14px", fontSize: 13, fontWeight: 900, cursor: newComment.trim() ? "pointer" : "not-allowed", fontFamily: "inherit" }}>Enviar</button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Story viewer */}
        {activeStory && (
          <div style={{ position:"fixed", top:0, left:0, right:0, bottom:0, background:"#000", zIndex:500, display:"flex", flexDirection:"column", maxWidth:390, margin:"0 auto" }}
            onClick={() => setActiveStory(null)}>
            <div style={{ padding:"52px 16px 12px" }}>
              <div style={{ background:"#333", borderRadius:99, height:3, overflow:"hidden" }}>
                <div style={{ background:"#fff", width:`${storyProgress}%`, height:"100%", borderRadius:99, transition:"width 0.1s linear" }}/>
              </div>
            </div>
            <div style={{ padding:"0 16px 16px", display:"flex", alignItems:"center", gap:10 }}>
              <div style={{ width:36, height:36, borderRadius:"50%", border:`2px solid ${activeStory.color}`, overflow:"hidden", display:"flex", alignItems:"center", justifyContent:"center", background:`${activeStory.color}33`, fontSize:18, flexShrink:0 }}>
                {activeStory.avatar_url
                  ? <img src={activeStory.avatar_url} style={{ width:"100%", height:"100%", objectFit:"cover" }} />
                  : activeStory.emoji
                }
              </div>
              <div style={{ flex:1 }}>
                <p style={{ fontWeight:700, fontSize:14, color:"#fff" }}>{activeStory.user}</p>
                <p style={{ fontSize:11, color:"rgba(255,255,255,0.5)" }}>há pouco</p>
              </div>
              <button onClick={(e) => { e.stopPropagation(); setActiveStory(null); }} style={{ background:"none", border:"none", color:"rgba(255,255,255,0.7)", fontSize:24, cursor:"pointer" }}>✕</button>
            </div>
            <div style={{ flex:1, margin:"0 16px", borderRadius:20, overflow:"hidden", display:"flex", alignItems:"center", justifyContent:"center", background:`linear-gradient(135deg, ${activeStory.color}44, #0a0a0f)` }}>
              {activeStory.media_url
                ? <img src={activeStory.media_url} style={{ width:"100%", height:"100%", objectFit:"cover" }} />
                : <span style={{ fontSize:80 }}>{activeStory.emoji}</span>
              }
            </div>
            <div style={{ padding:"16px 20px 48px", textAlign:"center" }}>
              <p style={{ fontSize:14, color:"rgba(255,255,255,0.7)" }}>{activeStory.user}</p>
            </div>
          </div>
        )}

        {/* Modal story upload */}
        {showStoryUpload && (
          <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.92)", zIndex: 200, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end" }}>
            <div style={{ background: "#13131a", borderRadius: "24px 24px 0 0", padding: "24px 20px 40px", width: "100%", maxWidth: 390, border: "1px solid #1e1e2e" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                <p style={{ fontWeight: 700, fontSize: 16 }}>Novo story</p>
                <button onClick={() => { setShowStoryUpload(false); setStoryFile(null); setStoryPreview(null); }} style={{ background: "none", border: "none", color: "#555", fontSize: 22, cursor: "pointer" }}>✕</button>
              </div>
              <label htmlFor="story-photo" style={{ cursor: "pointer" }}>
                <div style={{ background: "#0a0a0f", border: `2px dashed ${storyPreview ? "#e11d48" : "#1e1e2e"}`, borderRadius: 14, aspectRatio: "9/16", maxHeight: 340, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", overflow: "hidden", marginBottom: 16 }}>
                  {storyPreview
                    ? <img src={storyPreview} alt="preview" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    : <><span style={{ fontSize: 40 }}>📸</span><p style={{ fontSize: 13, color: "#555", marginTop: 10 }}>Toque para selecionar uma foto</p><p style={{ fontSize: 11, color: "#444", marginTop: 4 }}>Fica disponível por 24h</p></>
                  }
                </div>
              </label>
              <input id="story-photo" type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => { const f = e.target.files[0]; if (f) { setStoryFile(f); setStoryPreview(URL.createObjectURL(f)); } }} />
              <button onClick={handlePostStory} disabled={!storyFile || uploadingStory} style={{ width: "100%", background: storyFile ? "#e11d48" : "#1e1e2e", color: storyFile ? "#fff" : "#555", border: "none", borderRadius: 14, padding: 16, fontSize: 15, fontWeight: 700, cursor: storyFile ? "pointer" : "not-allowed", fontFamily: "inherit" }}>
                {uploadingStory ? "Publicando..." : "Publicar story"}
              </button>
            </div>
          </div>
        )}

        {/* Modais de segurança: denunciar e bloquear */}
        {moderationMenu && (
          <div
            onClick={closeModerationFlows}
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.86)", zIndex: 470, display: "flex", alignItems: "flex-end", justifyContent: "center", padding: 14 }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{ width: "100%", maxWidth: 390, background: "linear-gradient(180deg, rgba(255,255,255,0.055), rgba(255,255,255,0.02)), #13131a", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "28px 28px 20px 20px", overflow: "hidden", boxShadow: "0 24px 80px rgba(0,0,0,0.6)" }}
            >
              <div style={{ padding: "18px 18px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                <div>
                  <p style={{ fontSize: 16, fontWeight: 900 }}>
                    {moderationMenu.targetType === "post" && "Opções da publicação"}
                    {moderationMenu.targetType === "comment" && "Opções do comentário"}
                    {moderationMenu.targetType === "user" && "Opções do perfil"}
                    {moderationMenu.targetType === "ownPost" && "Opções da sua publicação"}
                  </p>
                  {moderationMenu.targetLabel && <p style={{ fontSize: 12, color: "#777", marginTop: 4 }}>{moderationMenu.targetLabel}</p>}
                </div>
                <button onClick={closeModerationFlows} style={{ width: 38, height: 38, borderRadius: "50%", border: "1px solid rgba(255,255,255,0.10)", background: "rgba(255,255,255,0.03)", color: "#e11d48", fontSize: 20, cursor: "pointer" }}>✕</button>
              </div>

              {moderationMenu.targetType === "ownPost" ? (
                <button
                  onClick={async () => {
                    await handleDeletePost(moderationMenu.targetId);
                    closeModerationFlows();
                  }}
                  style={{ width: "100%", minHeight: 64, padding: "0 20px", border: "none", borderTop: "1px solid rgba(255,255,255,0.08)", background: "transparent", color: "#ff5577", display: "flex", alignItems: "center", gap: 12, fontSize: 14, fontWeight: 900, cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}
                >
                  🗑️ Excluir publicação
                </button>
              ) : (
                <>
                  <button
                    onClick={() => openReportFlow(moderationMenu)}
                    style={{ width: "100%", minHeight: 64, padding: "0 20px", border: "none", borderTop: "1px solid rgba(255,255,255,0.08)", background: "transparent", color: "#ff5577", display: "flex", alignItems: "center", gap: 12, fontSize: 14, fontWeight: 900, cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}
                  >
                    ⚑
                    {moderationMenu.targetType === "post" && "Denunciar publicação"}
                    {moderationMenu.targetType === "comment" && "Denunciar comentário"}
                    {moderationMenu.targetType === "user" && "Denunciar usuário"}
                  </button>

                  <button
                    onClick={() => openBlockFlow(moderationMenu)}
                    style={{ width: "100%", minHeight: 64, padding: "0 20px", border: "none", borderTop: "1px solid rgba(255,255,255,0.08)", background: "transparent", color: "#ff5577", display: "flex", alignItems: "center", gap: 12, fontSize: 14, fontWeight: 900, cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}
                  >
                    ⛔ Bloquear usuário
                  </button>
                </>
              )}

              <button
                onClick={closeModerationFlows}
                style={{ width: "100%", minHeight: 62, padding: "0 20px", border: "none", borderTop: "1px solid rgba(255,255,255,0.08)", background: "transparent", color: "#ddd", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 900, cursor: "pointer", fontFamily: "inherit" }}
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        {reportTarget && (
          <div
            onClick={closeModerationFlows}
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.88)", zIndex: 480, display: "flex", alignItems: "flex-end", justifyContent: "center", padding: 14 }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{ width: "100%", maxWidth: 390, maxHeight: "88vh", overflowY: "auto", background: "linear-gradient(180deg, rgba(255,255,255,0.055), rgba(255,255,255,0.02)), #13131a", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "28px 28px 20px 20px", padding: "20px 18px 22px", boxShadow: "0 24px 80px rgba(0,0,0,0.6)" }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 14 }}>
                <div>
                  <p style={{ fontSize: 18, fontWeight: 900 }}>
                    {reportTarget.targetType === "post" && "Denunciar publicação"}
                    {reportTarget.targetType === "comment" && "Denunciar comentário"}
                    {reportTarget.targetType === "user" && "Denunciar usuário"}
                  </p>
                  <p style={{ color: "#888", fontSize: 12.5, lineHeight: 1.5, marginTop: 6 }}>
                    Sua denúncia ajuda a manter a comunidade segura para todos.
                  </p>
                </div>
                <button onClick={closeModerationFlows} style={{ width: 38, height: 38, borderRadius: "50%", border: "1px solid rgba(255,255,255,0.10)", background: "rgba(255,255,255,0.03)", color: "#e11d48", fontSize: 20, cursor: "pointer", flexShrink: 0 }}>✕</button>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {["Spam", "Conteúdo ofensivo", "Assédio ou bullying", "Informação enganosa", "Outro"].map((reason) => (
                  <label
                    key={reason}
                    style={{ display: "flex", alignItems: "center", gap: 12, minHeight: 52, borderRadius: 16, border: reportReason === reason ? "1px solid rgba(225,29,72,0.52)" : "1px solid #242435", background: reportReason === reason ? "rgba(225,29,72,0.12)" : "rgba(255,255,255,0.025)", padding: "0 14px", cursor: "pointer", color: "#f3f3f7", fontSize: 13.5, fontWeight: 800 }}
                  >
                    <input type="radio" checked={reportReason === reason} onChange={() => setReportReason(reason)} style={{ accentColor: "#e11d48", width: 16, height: 16 }} />
                    {reason}
                  </label>
                ))}
              </div>

              <textarea
                value={reportDetails}
                onChange={(e) => setReportDetails(e.target.value)}
                placeholder="Detalhes opcionais..."
                style={{ width: "100%", height: 92, resize: "none", marginTop: 12, background: "rgba(255,255,255,0.025)", border: "1px solid #242435", borderRadius: 16, padding: 14, color: "#fff", outline: "none", fontSize: 13, fontFamily: "inherit" }}
              />

              <button
                onClick={handleSubmitReport}
                style={{ width: "100%", marginTop: 14, background: "linear-gradient(135deg, #e11d48, #ff3d63)", color: "#fff", border: "none", borderRadius: 18, padding: "16px 0", fontSize: 14.5, fontWeight: 900, cursor: "pointer", fontFamily: "inherit", boxShadow: "0 14px 32px rgba(225,29,72,0.24)" }}
              >
                Enviar denúncia
              </button>
            </div>
          </div>
        )}

        {blockTarget && (
          <div
            onClick={closeModerationFlows}
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.88)", zIndex: 490, display: "flex", alignItems: "flex-end", justifyContent: "center", padding: 14 }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{ width: "100%", maxWidth: 390, background: "linear-gradient(180deg, rgba(255,255,255,0.055), rgba(255,255,255,0.02)), #13131a", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "28px 28px 20px 20px", padding: "20px 18px 22px", boxShadow: "0 24px 80px rgba(0,0,0,0.6)" }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                <div>
                  <p style={{ fontSize: 18, fontWeight: 900 }}>Bloquear {blockTarget.targetLabel || "usuário"}?</p>
                  <p style={{ color: "#888", fontSize: 12.5, lineHeight: 1.5, marginTop: 6 }}>
                    Esta ação ajuda você a controlar sua experiência no eucorredor.
                  </p>
                </div>
                <button onClick={closeModerationFlows} style={{ width: 38, height: 38, borderRadius: "50%", border: "1px solid rgba(255,255,255,0.10)", background: "rgba(255,255,255,0.03)", color: "#e11d48", fontSize: 20, cursor: "pointer", flexShrink: 0 }}>✕</button>
              </div>

              <div style={{ marginTop: 16, padding: 16, borderRadius: 18, background: "rgba(225,29,72,0.10)", border: "1px solid rgba(225,29,72,0.22)", color: "#f7d9e1", fontSize: 13, lineHeight: 1.55 }}>
                Você deixará de ver posts e comentários desse usuário. Ele também deixará de aparecer nas suas sugestões.
              </div>

              <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
                <button
                  onClick={closeModerationFlows}
                  style={{ flex: 1, background: "rgba(255,255,255,0.035)", color: "#fff", border: "1px solid #242435", borderRadius: 18, padding: "15px 0", fontSize: 14, fontWeight: 900, cursor: "pointer", fontFamily: "inherit" }}
                >
                  Cancelar
                </button>
                <button
                  onClick={handleBlockUser}
                  style={{ flex: 1, background: "linear-gradient(135deg, #e11d48, #ff3d63)", color: "#fff", border: "none", borderRadius: 18, padding: "15px 0", fontSize: 14, fontWeight: 900, cursor: "pointer", fontFamily: "inherit" }}
                >
                  Bloquear
                </button>
              </div>
            </div>
          </div>
        )}

        {moderationToast && (
          <div style={{ position: "fixed", left: "50%", transform: "translateX(-50%)", bottom: 112, zIndex: 520, width: "calc(100% - 32px)", maxWidth: 356, background: "#171722", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 999, padding: "13px 16px", boxShadow: "0 18px 50px rgba(0,0,0,0.54)", textAlign: "center", color: "#fff", fontSize: 13, fontWeight: 900 }}>
            {moderationToast}
          </div>
        )}

        {/* Modal notificações */}
        {showNotifications && (
          <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.92)", zIndex: 300, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end" }}>
            <div style={{ background: "#13131a", borderRadius: "24px 24px 0 0", padding: "20px 20px 0", width: "100%", maxWidth: 390, border: "1px solid #1e1e2e", maxHeight: "80vh", display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <p style={{ fontWeight: 700, fontSize: 16 }}>Notificações</p>
                <button onClick={() => setShowNotifications(false)} style={{ background: "none", border: "none", color: "#555", fontSize: 22, cursor: "pointer" }}>✕</button>
              </div>
              <div style={{ flex: 1, overflowY: "auto", paddingBottom: 32 }}>
                {loadingSections.notifications ? (
                  <NotificationsSkeleton />
                ) : notifications.length === 0 && (
                  <EmptyState
                    compact
                    icon="🔔"
                    title="Nenhuma notificação por enquanto"
                    description="Curtidas, comentários e novos seguidores aparecem aqui."
                  />
                )}
                {notifications.map((n) => (
                  <div
                    key={n.id}
                    onClick={() => handleNotificationClick(n)}
                    style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 0", borderBottom: "1px solid #1e1e2e", opacity: n.read ? 0.6 : 1, cursor: "pointer" }}
                  >
                    <div style={{ width: 42, height: 42, borderRadius: "50%", background: "#1e1e2e", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, flexShrink: 0, overflow: "hidden" }}>
                      {n.from_user?.avatar_url ? <img src={n.from_user.avatar_url} alt="av" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : n.from_user?.name?.charAt(0) || "?"}
                    </div>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: 13, color: "#f0f0f0", lineHeight: 1.4 }}>
                        {n.type === "comment" ? (
                          <>
                            <span style={{ fontWeight: 700 }}>@{n.from_user?.handle || (n.from_user?.name || "alguem").toLowerCase().replace(/\s+/g, "")}</span>
                            {" comentou na sua publicação"}
                            {n.comment_text && (
                              <> {" "}<span style={{ color: "#d7d7df" }}>“{n.comment_text}”</span></>
                            )}
                          </>
                        ) : (
                          <>
                            <span style={{ fontWeight: 700 }}>{n.from_user?.name || "Alguém"}</span>
                            {n.type === "follow" && " começou a te seguir"}
                            {n.type === "like" && " curtiu sua publicação"}
                          </>
                        )}
                      </p>
                      <p style={{ fontSize: 11, color: "#555", marginTop: 3 }}>{new Date(n.created_at).toLocaleDateString("pt-BR")}</p>
                    </div>
                    {n.type === "follow" && n.from_user_id && (
                      <button onClick={(e) => { e.stopPropagation(); handleFollow(n.from_user_id); }} style={{ border: `1.5px solid ${realFollowing[n.from_user_id] ? "#1e1e2e" : "#e11d48"}`, color: realFollowing[n.from_user_id] ? "#555" : "#e11d48", background: "none", borderRadius: 20, padding: "5px 12px", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", flexShrink: 0 }}>
                        {realFollowing[n.from_user_id] ? "Seguindo" : "Seguir"}
                      </button>
                    )}
                    {n.type !== "follow" && (
                      <span style={{ fontSize: 20 }}>
                        {n.type === "like" && "❤️"}
                        {n.type === "comment" && "💬"}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
    </div>
  );
}

// ─── ROOT ─────────────────────────────────────────────────────────────────────

function PublicProfilePage({ handle }) {
  const [profile, setProfile] = useState(null);
  const [posts, setPosts] = useState([]);
  const [activities, setActivities] = useState([]);
  const [tab, setTab] = useState("fotos");
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  const [isFollowing, setIsFollowing] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setCurrentUser(session.user);
    });
  }, []);

  useEffect(() => {
    const checkFollow = async () => {
      if (!currentUser || !profile) return;
      try {
        const { data } = await supabase.from("follows").select("*").eq("follower_id", currentUser.id).eq("following_id", profile.id).single();
        setIsFollowing(!!data);
      } catch { setIsFollowing(false); }
    };
    checkFollow();
  }, [currentUser, profile]);

  const handleFollowToggle = async () => {
    if (!currentUser) { window.location.href = "/"; return; }
    if (isFollowing) {
      await supabase.from("follows").delete().eq("follower_id", currentUser.id).eq("following_id", profile.id);
      setIsFollowing(false);
    } else {
      await supabase.from("follows").insert({ follower_id: currentUser.id, following_id: profile.id });
      await supabase.from("notifications").insert({ user_id: profile.id, from_user_id: currentUser.id, type: "follow" });
      setIsFollowing(true);
    }
  };

  useEffect(() => {
    const load = async () => {
      const { data: p } = await supabase.from("profiles").select("*").eq("handle", handle).single();
      if (!p) { setLoading(false); return; }
      const { data: ps } = await supabase.from("posts").select("*").eq("user_id", p.id).order("created_at", { ascending: false });
      const { data: acts } = await supabase.from("activities").select("*").eq("user_id", p.id).order("created_at", { ascending: false });
      const { count: fc } = await supabase.from("follows").select("*", { count: "exact", head: true }).eq("following_id", p.id);
      const { count: ing } = await supabase.from("follows").select("*", { count: "exact", head: true }).eq("follower_id", p.id);
      setProfile({ ...p, followersCount: fc || 0, followingCount: ing || 0 });
      setPosts(ps || []); setActivities(acts || []); setLoading(false);
    };
    load();
  }, [handle]);

  if (loading) return (
    <div style={{ background: "radial-gradient(circle at 50% 36%, rgba(225,29,72,0.18), transparent 30%), #0a0a0f", position: "fixed", inset: 0, width: "100vw", height: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'DM Sans', sans-serif", color: "#f0f0f0", overflow: "hidden" }}>
      <style>{`
        @keyframes loadingPulse {
          0%, 100% { transform: scale(1); opacity: 0.78; }
          50% { transform: scale(1.08); opacity: 1; }
        }
        @keyframes loadingGlow {
          0%, 100% { opacity: 0.35; transform: scaleX(0.72); }
          50% { opacity: 1; transform: scaleX(1); }
        }
      `}</style>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", padding: 24 }}>
        <div style={{ width: 74, height: 74, borderRadius: 24, background: "linear-gradient(135deg, rgba(225,29,72,0.26), rgba(225,29,72,0.10))", border: "1px solid rgba(225,29,72,0.38)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 20, boxShadow: "0 24px 70px rgba(225,29,72,0.18)", animation: "loadingPulse 1.8s ease-in-out infinite" }}>
          <img
            src="/logo-e.png"
            alt="Logo EuCorredor"
            style={{ width: 42, height: 42, objectFit: "contain", display: "block" }}
          />
        </div>
        <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 28, fontWeight: 900, letterSpacing: -0.8, marginBottom: 8 }}>
          eu<span style={{ color: "#e11d48" }}>corredor</span>
        </h1>
        <p style={{ color: "#8b8b96", fontSize: 13.5, fontWeight: 700, marginBottom: 18 }}>
          Preparando sua experiência
        </p>
        <div style={{ width: 112, height: 4, borderRadius: 999, background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
          <div style={{ width: "100%", height: "100%", borderRadius: 999, background: "linear-gradient(90deg, transparent, #e11d48, transparent)", animation: "loadingGlow 1.35s ease-in-out infinite" }} />
        </div>
      </div>
    </div>
  );

  if (!profile) return (
    <div style={{ background: "#0a0a0f", minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: "sans-serif", color: "#f0f0f0" }}>
      <p style={{ fontSize: 32, marginBottom: 16 }}>🏃</p>
      <p style={{ fontWeight: 700, fontSize: 18, marginBottom: 8 }}>Perfil não encontrado</p>
      <p style={{ fontSize: 13, color: "#555", marginBottom: 24 }}>@{handle} não existe no eucorredor.</p>
      <a href="/" style={{ background: "#e11d48", color: "#fff", borderRadius: 12, padding: "12px 24px", fontSize: 14, fontWeight: 700, textDecoration: "none" }}>Ir para o app</a>
    </div>
  );

  const vLevel = getLevel(profile.races_count || 0);
  const vNext = getNextLevel(profile.races_count || 0);
  const vProgress = vNext ? ((profile.races_count - vLevel.min) / (vNext.min - vLevel.min)) * 100 : 100;

  return (
    <div style={{ background: "#0a0a0f", minHeight: "100vh", fontFamily: "'DM Sans', sans-serif", color: "#f0f0f0", display: "flex", justifyContent: "center" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&family=Space+Grotesk:wght@700;800&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { display: none; }
        .sbox { background: #1a1a24; border-radius: 10px; padding: 10px 12px; flex: 1; text-align: center; }
        .card { background: #13131a; border-radius: 16px; padding: 16px; border: 1px solid #1e1e2e; }
      `}</style>
      <div style={{ width: "100%", maxWidth: 390 }}>
        <div style={{ padding: "52px 20px 16px", background: "linear-gradient(180deg, #0f0f18 0%, #0a0a0f 100%)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
            <a href="/" style={{ color: "#888", fontSize: 22, textDecoration: "none" }}>←</a>
            <p style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 800, fontSize: 16 }}>eu<span style={{ color: "#e11d48" }}>corredor</span></p>
          </div>
        </div>
        <div style={{ padding: "0 20px 80px" }}>
          <div style={{ background: "#13131a", borderRadius: 20, padding: 20, border: "1px solid #1e1e2e", marginBottom: 2 }}>
            <div style={{ display: "flex", gap: 14, alignItems: "center", marginBottom: 14 }}>
              <div style={{ width: 68, height: 68, borderRadius: "50%", background: "linear-gradient(135deg, #e11d48, #f97316)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, border: "3px solid #1e1e2e", overflow: "hidden", flexShrink: 0 }}>
                {profile.avatar_url ? <img src={profile.avatar_url} alt="av" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : vLevel.icon}
              </div>
              <div style={{ flex: 1 }}>
                <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 18, fontWeight: 800, marginBottom: 2 }}>{profile.name}</h1>
                <p style={{ fontSize: 11, color: "#555", marginBottom: 6 }}>@{profile.handle}</p>
                <div style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "#1e1e2e", borderRadius: 99, padding: "3px 10px" }}>
                  <span style={{ fontSize: 11, color: vLevel.color, fontWeight: 700 }}>{vLevel.icon} {vLevel.name}</span>
                </div>
              </div>
            </div>
            {profile.bio && <p style={{ fontSize: 13, color: "#aaa", lineHeight: 1.5, marginBottom: 14 }}>{profile.bio}</p>}
            <div style={{ background: "#1e1e2e", borderRadius: 99, height: 4, marginBottom: 14 }}><div style={{ background: vLevel.color, width: `${vProgress}%`, height: 4, borderRadius: 99 }} /></div>
            <div style={{ display: "flex", gap: 5, marginBottom: 14 }}>
              <div className="sbox"><p style={{ fontSize: 16, fontWeight: 700, color: "#e11d48" }}>{profile.races_count || 0}</p><p style={{ fontSize: 9, color: "#555", marginTop: 1 }}>corridas</p></div>
              <div className="sbox"><p style={{ fontSize: 16, fontWeight: 700 }}>{Number(profile.total_km || 0).toFixed(1)} km</p><p style={{ fontSize: 9, color: "#555", marginTop: 1 }}>total</p></div>
            </div>
            <div style={{ display: "flex", gap: 20, marginBottom: 14 }}>
              <div style={{ textAlign: "center" }}><p style={{ fontWeight: 700, fontSize: 18 }}>{profile.followersCount}</p><p style={{ fontSize: 11, color: "#555", marginTop: 2 }}>seguidores</p></div>
              <div style={{ textAlign: "center" }}><p style={{ fontWeight: 700, fontSize: 18 }}>{profile.followingCount}</p><p style={{ fontSize: 11, color: "#555", marginTop: 2 }}>seguindo</p></div>
            </div>
            {currentUser ? (
              currentUser.id !== profile.id ? (
                <button onClick={handleFollowToggle} style={{ width: "100%", background: isFollowing ? "none" : "#e11d48", color: isFollowing ? "#666" : "#fff", border: isFollowing ? "1px solid #1e1e2e" : "none", borderRadius: 12, padding: "12px 0", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                  {isFollowing ? "Seguindo" : "Seguir"}
                </button>
              ) : (
                <a href="/" style={{ display: "block", textAlign: "center", background: "#13131a", color: "#888", borderRadius: 12, padding: "12px 0", fontSize: 14, fontWeight: 700, textDecoration: "none", border: "1px solid #1e1e2e" }}>Seu perfil — voltar ao app</a>
              )
            ) : (
              <a href="/" style={{ display: "block", textAlign: "center", background: "#e11d48", color: "#fff", borderRadius: 12, padding: "12px 0", fontSize: 14, fontWeight: 700, textDecoration: "none" }}>Entrar no eucorredor para seguir</a>
            )}
          </div>
          <div style={{ display: "flex", borderBottom: "1px solid #1e1e2e", background: "#0a0a0f" }}>
            {[{ id: "fotos", label: "Fotos" }, { id: "posts", label: "Posts" }, { id: "ativ", label: "Atividades" }].map((t) => (
              <button key={t.id} onClick={() => setTab(t.id)} style={{ flex: 1, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 11, fontWeight: 700, padding: "10px 0", color: tab === t.id ? "#e11d48" : "#555" }}>
                {t.label}
                {tab === t.id && <div style={{ width: 20, height: 2, background: "#e11d48", borderRadius: 2, margin: "4px auto 0" }} />}
              </button>
            ))}
          </div>
          {tab === "fotos" && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 2, marginTop: 2 }}>
              {posts.filter(p => p.photo_url).map((p) => <div key={p.id} style={{ aspectRatio: "1", overflow: "hidden" }}><img src={p.photo_url} alt="foto" style={{ width: "100%", height: "100%", objectFit: "cover" }} /></div>)}
              {posts.filter(p => p.photo_url).length === 0 && (
                <div style={{ gridColumn: "1/-1" }}>
                  <EmptyState compact icon="📸" title="Nenhuma foto publicada" description="As imagens deste perfil aparecerão aqui." />
                </div>
              )}
            </div>
          )}
          {tab === "posts" && (
            <div>
              {posts.filter(p => p.text).map((p) => (
                <div key={p.id} style={{ padding: "16px 0", borderBottom: "1px solid #1e1e2e" }}>
                  {p.photo_url && <div style={{ aspectRatio: "4/5", borderRadius: 12, overflow: "hidden", marginBottom: 10 }}><img src={p.photo_url} style={{ width: "100%", height: "100%", objectFit: "cover" }} /></div>}
                  <p style={{ fontSize: 14, color: "#ccc", lineHeight: 1.6 }}>{p.text}</p>
                  <span style={{ fontSize: 11, color: "#555", marginTop: 6, display: "block" }}>❤️ {p.likes || 0}</span>
                </div>
              ))}
              {posts.filter(p => p.text).length === 0 && (
                <EmptyState compact icon="✍️" title="Nenhum post publicado" description="Os textos deste perfil aparecerão aqui." />
              )}
            </div>
          )}
          {tab === "ativ" && (
            <div>
              {activities.map((a) => (
                <div key={a.id} style={{ padding: "14px 0", borderBottom: "1px solid #1e1e2e" }}>
                  <div style={{ display: "flex", gap: 6 }}>
                    <div className="sbox"><p style={{ fontSize: 15, fontWeight: 700, color: "#e11d48" }}>{a.distance} km</p><p style={{ fontSize: 9, color: "#555", marginTop: 1 }}>distância</p></div>
                    {a.duration && <div className="sbox"><p style={{ fontSize: 15, fontWeight: 700 }}>{a.duration}</p><p style={{ fontSize: 9, color: "#555", marginTop: 1 }}>tempo</p></div>}
                    {a.pace && <div className="sbox"><p style={{ fontSize: 13, fontWeight: 700 }}>{a.pace}</p><p style={{ fontSize: 9, color: "#555", marginTop: 1 }}>pace</p></div>}
                  </div>
                </div>
              ))}
              {activities.length === 0 && (
                <EmptyState compact icon="⌁" title="Nenhuma atividade registrada" description="As corridas deste perfil aparecerão aqui." />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [session, setSession] = useState(null);
  const [userName, setUserName] = useState("");
  const [loading, setLoading] = useState(true);
  const [publicHandle, setPublicHandle] = useState(null);

  useEffect(() => {
    const path = window.location.pathname.replace("/", "").replace("@", "").toLowerCase();
    const reserved = ["privacidade", "termos", "privacy", "terms", "sobre", "contato", "favicon.ico"];
    if (path && path !== "" && !reserved.includes(path)) setPublicHandle(path);

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session) {
        const { data: profile } = await supabase.from("profiles").select("name").eq("id", session.user.id).single();
        setUserName(profile?.name || session.user.email.split("@")[0]);
        setSession(session);
      }
      setLoading(false);
    });
    supabase.auth.onAuthStateChange((_event, session) => { setSession(session); });
  }, []);

  if (loading) return (
    <div style={{ background: "radial-gradient(circle at 50% 36%, rgba(225,29,72,0.18), transparent 30%), #0a0a0f", position: "fixed", inset: 0, width: "100vw", height: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'DM Sans', sans-serif", color: "#f0f0f0", overflow: "hidden" }}>
      <style>{`
        @keyframes loadingPulse {
          0%, 100% { transform: scale(1); opacity: 0.78; }
          50% { transform: scale(1.08); opacity: 1; }
        }
        @keyframes loadingGlow {
          0%, 100% { opacity: 0.35; transform: scaleX(0.72); }
          50% { opacity: 1; transform: scaleX(1); }
        }
      `}</style>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", padding: 24 }}>
        <div style={{ width: 74, height: 74, borderRadius: 24, background: "linear-gradient(135deg, rgba(225,29,72,0.26), rgba(225,29,72,0.10))", border: "1px solid rgba(225,29,72,0.38)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 20, boxShadow: "0 24px 70px rgba(225,29,72,0.18)", animation: "loadingPulse 1.8s ease-in-out infinite" }}>
          <img
            src="/logo-e.png"
            alt="Logo EuCorredor"
            style={{ width: 42, height: 42, objectFit: "contain", display: "block" }}
          />
        </div>
        <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 28, fontWeight: 900, letterSpacing: -0.8, marginBottom: 8 }}>
          eu<span style={{ color: "#e11d48" }}>corredor</span>
        </h1>
        <p style={{ color: "#8b8b96", fontSize: 13.5, fontWeight: 700, marginBottom: 18 }}>
          Preparando sua experiência
        </p>
        <div style={{ width: 112, height: 4, borderRadius: 999, background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
          <div style={{ width: "100%", height: "100%", borderRadius: 999, background: "linear-gradient(90deg, transparent, #e11d48, transparent)", animation: "loadingGlow 1.35s ease-in-out infinite" }} />
        </div>
      </div>
    </div>
  );

  if (publicHandle) return <PublicProfilePage handle={publicHandle} />;
  if (!session) return <AuthScreen onLogin={(user, name) => { setSession({ user }); setUserName(name); }} />;
  return <AppMain user={session.user} userName={userName} />;
}
