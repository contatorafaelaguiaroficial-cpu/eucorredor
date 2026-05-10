// eucorredor v3.0
import { useState, useEffect, useRef } from "react";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://atzbgyjenhfgrnwdstnl.supabase.co";
const SUPABASE_KEY = "sb_publishable_WB5ILhYe5FqHaPjHChWH1A_5fNq2_KI";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const ADMIN_ID = "7cdb56e9-0525-48ac-901f-1f5ac23fe009";
const VAPID_PUBLIC_KEY = "BCqHJrzsjtka05tMWLJEQ_sJmeCpEDw6IYrNpBaG-lz_cD_qcCF04yjuBFVhetqN6SbmWKAmjFnXy8QWABMptYo";

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
        <div style={{ display: "flex", background: "#13131a", borderRadius: 12, padding: 4, marginBottom: 28, display: mode === "forgot" || mode === "reset" ? "none" : "flex" }}>
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
  const gpsIntervalRef = useRef(null);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [editForm, setEditForm] = useState({ name: "", bio: "" });
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [loadingPost, setLoadingPost] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingForm, setOnboardingForm] = useState({ name: "", handle: "", terms: false });
  const [dbEvents, setDbEvents] = useState([]);
  const [showAdminEvents, setShowAdminEvents] = useState(false);
  const [eventForm, setEventForm] = useState({ name: "", date: "", city: "", state: "RS", distance: "", category: "Corrida de Rua", link: "" });
  const [savingEvent, setSavingEvent] = useState(false);
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

  useEffect(() => { loadProfile(); loadPosts(); loadActivities(); loadFollowCounts(); loadNotifications(); loadRealFollowingList(); loadEvents(); loadStories(); loadSuggestions(); requestPushPermission(); }, []);

  const loadStories = async () => {
    const { data } = await supabase.from("stories")
      .select("*, profiles(id, name, avatar_url, level, handle)")
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false });
    setStories(data || []);
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
  };

  const registerPush = async () => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
    try {
      const reg = await navigator.serviceWorker.ready;
      const existing = await reg.pushManager.getSubscription();
      const sub = existing || await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: VAPID_PUBLIC_KEY,
      });
      const { endpoint, keys } = sub.toJSON();
      await supabase.from("push_subscriptions").upsert({
        user_id: user.id,
        endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth,
      }, { onConflict: "user_id,endpoint" });
    } catch (e) {
      console.log("Push registration failed:", e.message);
    }
  };

  const requestPushPermission = async () => {
    if (!("Notification" in window)) return;
    if (Notification.permission === "granted") { await registerPush(); return; }
    if (Notification.permission === "denied") return;
    const perm = await Notification.requestPermission();
    if (perm === "granted") await registerPush();
  };

  const sendPush = async (targetUserId, title, body, url = "/") => {
    try {
      await fetch(`${SUPABASE_URL}/functions/v1/send-push`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${SUPABASE_KEY}` },
        body: JSON.stringify({ user_id: targetUserId, title, body, url }),
      });
    } catch (e) { console.log("Push error:", e); }
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
  };

  const markAllRead = async () => {
    await supabase.from("notifications").update({ read: true }).eq("user_id", user.id).eq("read", false);
    await loadNotifications();
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
      sendPush(targetId, "eucorredor 🏃", `${profile?.name || "Alguém"} começou a te seguir`, "/");
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
        sendPush(postOwnerId, "eucorredor 🏃", `${profile?.name || "Alguém"} curtiu sua publicação`, "/");
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

  const loadEvents = async () => {
    const { data } = await supabase.from("events").select("*").order("created_at", { ascending: true });
    setDbEvents(data || []);
  };

  const handleSaveEvent = async () => {
    if (!eventForm.name || !eventForm.date || !eventForm.distance) return alert("Preencha nome, data e distância.");
    setSavingEvent(true);
    await supabase.from("events").insert({ name: eventForm.name, date: eventForm.date, city: eventForm.city, state: eventForm.state, distance: eventForm.distance, category: eventForm.category, link: eventForm.link });
    setEventForm({ name: "", date: "", city: "", state: "RS", distance: "", category: "Corrida de Rua", link: "" });
    await loadEvents();
    setSavingEvent(false);
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
    const hasHandle = data?.handle && data.handle.trim() !== "";
    if (!hasHandle) {
      const suggestedHandle = user.email?.split("@")[0]?.toLowerCase().replace(/[^a-z0-9_]/g, "") || "";
      const suggestedName = user.user_metadata?.full_name || user.user_metadata?.name || data?.name || "";
      setOnboardingForm({ name: suggestedName, handle: suggestedHandle });
      setShowOnboarding(true);
    }
  };

  const loadPosts = async () => {
    const { data } = await supabase.from("posts").select("*, profiles(id, name, level, avatar_url, handle)").order("created_at", { ascending: false }).limit(20);
    setPosts(data || []);
  };

  const loadActivities = async () => {
    const { data } = await supabase.from("activities").select("*, profiles(name, avatar_url)").order("created_at", { ascending: false }).limit(20);
    setActivities(data || []);
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
    if (minPerKm > 20 || minPerKm < 2) return "--'--";
    const min = Math.floor(minPerKm);
    const sec = Math.round((minPerKm - min) * 60);
    const adjMin = sec >= 60 ? min + 1 : min;
    const adjSec = sec >= 60 ? 0 : sec;
    return adjMin + "min" + String(adjSec).padStart(2, "0") + "s/km";
  };

  const startGpsRun = () => {
    setGpsElapsed(0); setGpsDistance(0); setGpsRoute([{ x: 195, y: 300 }]);
    setGpsPaused(false); setGpsHR(142); setGpsLocated(false); setGpsError("");
    setHubScreen("tracking");
  };

  const finishGpsRun = async () => {
    clearInterval(gpsIntervalRef.current);
    if (leafletMapRef.current?._watchId !== undefined) navigator.geolocation.clearWatch(leafletMapRef.current._watchId);
    if (leafletMapRef.current) { leafletMapRef.current.remove(); leafletMapRef.current = null; }
    if (gpsDistance > 0) {
      const pace = formatGpsPace(gpsDistance, gpsElapsed);
      const duration = formatRunTime(gpsElapsed);
      await supabase.from("activities").insert({ user_id: user.id, distance: parseFloat(gpsDistance.toFixed(2)), duration, pace });
      const newKm = (profile?.total_km || 0) + gpsDistance;
      const newCount = (profile?.races_count || 0) + 1;
      await supabase.from("profiles").update({ total_km: newKm, races_count: newCount, level: getLevel(newCount).name }).eq("id", user.id);
      await loadProfile(); await loadActivities();
    }
    setHubScreen("summary");
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
        }, (err) => { const msgs = { 1: "Permissão negada", 2: "GPS indisponível", 3: "Tempo esgotado" }; setGpsError(msgs[err.code] || "Erro GPS"); }, gpsOptions);
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
        }, (err) => { const msgs = { 1: "Permissão negada", 2: "GPS indisponível", 3: "Tempo esgotado" }; setGpsError(msgs[err.code] || "Erro GPS"); }, gpsOptions);
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
    const url = `https://eucorredor.com.br/@${handle}`;
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
    const { data } = await supabase.from("comments").select("*, profiles(name, avatar_url, level)").eq("post_id", postId).order("created_at", { ascending: true });
    setComments(c => ({ ...c, [postId]: data || [] }));
  };

  const handleComment = async (postId) => {
    if (!newComment.trim()) return;
    await supabase.from("comments").insert({ post_id: postId, user_id: user.id, text: newComment });
    const post = posts.find(p => p.id === postId);
    if (post && post.user_id !== user.id) {
      await supabase.from("notifications").insert({ user_id: post.user_id, from_user_id: user.id, type: "comment", post_id: postId });
      sendPush(post.user_id, "eucorredor 🏃", `${profile?.name || "Alguém"} comentou: "${newComment.slice(0, 60)}"`, "/");
    }
    setNewComment("");
    await loadComments(postId);
    await loadNotifications();
  };

  const handleSearch = async (query) => {
    setSearchQuery(query);
    if (!query.trim()) { setSearchResults([]); return; }
    const { data } = await supabase.from("profiles").select("id, name, handle, level, avatar_url, races_count").or(`name.ilike.%${query}%,handle.ilike.%${query}%`).neq("id", user.id).limit(10);
    setSearchResults(data || []);
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
        .bnav { position: fixed; bottom: 0; left: 50%; transform: translateX(-50%); width: 100%; max-width: 390px; background: rgba(10,10,15,0.96); backdrop-filter: blur(20px); border-top: 1px solid #1e1e2e; display: flex; justify-content: space-around; align-items: center; padding: 10px 4px 28px; z-index: 100; }
        .nbtn { background: none; border: none; cursor: pointer; display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 4px 8px; font-family: inherit; }
        .post-sep { border: none; border-top: 1px solid #1e1e2e; margin: 0; }
      `}</style>

      <div style={{ width: "100%", maxWidth: 390, minHeight: "100vh" }}>

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

        {/* Header */}
        <div style={{ padding: "16px 20px 16px", background: "linear-gradient(180deg, #0f0f18 0%, #0a0a0f 100%)", position: "sticky", top: 0, zIndex: 50 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 24, fontWeight: 900, color: "#fff" }}>eu<span style={{ color: "#e11d48" }}>corredor</span></h1>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <button onClick={() => setShowSearch(!showSearch)} style={{ width: 38, height: 38, borderRadius: "50%", background: "#13131a", border: "1px solid #1e1e2e", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#888" }}>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
              </button>
              <button onClick={() => { setShowNotifications(true); markAllRead(); }} style={{ position: "relative", width: 38, height: 38, borderRadius: "50%", background: "#13131a", border: "1px solid #1e1e2e", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#888" }}>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
                {notifications.filter(n => !n.read).length > 0 && (
                  <span style={{ position: "absolute", top: 7, right: 7, width: 7, height: 7, background: "#e11d48", borderRadius: "50%", border: "1.5px solid #0a0a0f" }}/>
                )}
              </button>
              <button onClick={handleSignOut} style={{ background: "none", border: "1px solid #1e1e2e", borderRadius: 8, padding: "6px 10px", color: "#555", fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}>Sair</button>
            </div>
          </div>
          <div style={{ background: "#13131a", borderRadius: 12, padding: "10px 14px", border: "1px solid #1e1e2e", display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: `${level.color}22`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>{level.icon}</div>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: level.color }}>{level.name}</span>
                {next && <span style={{ fontSize: 11, color: "#444" }}>{races}/{next.min} corridas</span>}
              </div>
              <div style={{ background: "#1e1e2e", borderRadius: 99, height: 4 }}>
                <div style={{ background: level.color, width: `${progress}%`, height: 4, borderRadius: 99 }} />
              </div>
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
              style={{ background: t.special ? "#e11d48" : "none", borderRadius: t.special ? "50%" : 0, width: t.special ? 54 : "auto", height: t.special ? 54 : "auto", marginTop: t.special ? -22 : 0, boxShadow: t.special ? "0 4px 24px #e11d4860" : "none", justifyContent: "center", border: "none" }}>
              {t.special
                ? <svg width="22" height="22" viewBox="0 0 24 24" fill="#fff"><polygon points="12 4 22 20 2 20"/></svg>
                : <><span style={{ color: tab === t.id ? "#e11d48" : "#555" }}>{t.svg}</span><span style={{ fontSize: 10, fontWeight: 700, color: tab === t.id ? "#e11d48" : "#555" }}>{t.label}</span></>
              }
            </button>
          ))}
        </nav>

        <div style={{ padding: "20px", paddingBottom: 90 }}>

          {/* EVENTOS */}
          {tab === "eventos" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                <h2 style={{ fontSize: 16, fontWeight: 700 }}>Próximos eventos</h2>
                {user.id === ADMIN_ID && (
                  <button onClick={() => setShowAdminEvents(true)} style={{ background: "#1e1e2e", border: "none", color: "#888", borderRadius: 8, padding: "5px 12px", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>+ Gerenciar</button>
                )}
              </div>
              {dbEvents.length === 0 && (
                <div style={{ textAlign: "center", padding: "40px 0" }}>
                  <p style={{ fontSize: 28, marginBottom: 10 }}>📅</p>
                  <p style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>Nenhum evento cadastrado</p>
                  <p style={{ fontSize: 13, color: "#555" }}>Novos eventos serão adicionados em breve.</p>
                </div>
              )}
              {dbEvents.map((e) => (
                <div key={e.id} style={{ background: "#13131a", borderRadius: 18, padding: "18px", border: "1px solid #1e1e2e" }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
                    <span style={{ background: "#1e1e2e", color: "#888", borderRadius: 6, padding: "3px 8px", fontSize: 10, fontWeight: 700 }}>{e.category}</span>
                  </div>
                  <p style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>{e.name}</p>
                  <p style={{ fontSize: 12, color: "#555", marginBottom: 14 }}>{e.city}, {e.state}</p>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ display: "flex", gap: 14 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: "#e11d48" }}>{e.date}</span>
                      <span style={{ fontSize: 13, color: "#888", fontWeight: 600 }}>{e.distance}</span>
                    </div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      {user.id === ADMIN_ID && (
                        <button onClick={() => handleDeleteEvent(e.id)} style={{ background: "none", border: "none", color: "#555", fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>🗑️</button>
                      )}
                      {e.link ? (
                        <a href={e.link} target="_blank" rel="noopener noreferrer" style={{ background: "#e11d48", color: "#fff", borderRadius: 10, padding: "8px 18px", fontSize: 12, fontWeight: 700, textDecoration: "none" }}>Inscrever</a>
                      ) : (
                        <button className="jbtn" style={{ opacity: 0.5, cursor: "not-allowed", borderRadius: 10 }}>Em breve</button>
                      )}
                    </div>
                  </div>
                </div>
              ))}

              {/* Modal admin de eventos */}
              {showAdminEvents && user.id === ADMIN_ID && (
                <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.92)", zIndex: 200, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end" }}>
                  <div style={{ background: "#13131a", borderRadius: "24px 24px 0 0", padding: "24px 20px 40px", width: "100%", maxWidth: 390, border: "1px solid #1e1e2e", maxHeight: "90vh", overflowY: "auto" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                      <p style={{ fontWeight: 700, fontSize: 16 }}>Gerenciar eventos</p>
                      <button onClick={() => setShowAdminEvents(false)} style={{ background: "none", border: "none", color: "#555", fontSize: 22, cursor: "pointer" }}>✕</button>
                    </div>
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
                        {["Corrida de Rua", "Maratona", "Meia Maratona", "10K", "5K", "Trail Run", "Ultramaratona"].map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                      <input className="tinput" placeholder="Link de inscrição (Ticket Sports)" value={eventForm.link} onChange={(e) => setEventForm(f => ({ ...f, link: e.target.value }))} />
                    </div>
                    <button onClick={handleSaveEvent} disabled={savingEvent} style={{ width: "100%", background: "#e11d48", color: "#fff", border: "none", borderRadius: 14, padding: 16, fontSize: 15, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", marginBottom: 20 }}>
                      {savingEvent ? "Salvando..." : "Adicionar evento"}
                    </button>
                    {dbEvents.length > 0 && (
                      <>
                        <p style={{ fontSize: 12, color: "#555", marginBottom: 12, fontWeight: 700 }}>Eventos cadastrados</p>
                        {dbEvents.map((e) => (
                          <div key={e.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid #1e1e2e" }}>
                            <div>
                              <p style={{ fontWeight: 700, fontSize: 13 }}>{e.name}</p>
                              <p style={{ fontSize: 11, color: "#555" }}>{e.date} · {e.distance} · {e.city}</p>
                            </div>
                            <button onClick={() => handleDeleteEvent(e.id)} style={{ background: "none", border: "1px solid #1e1e2e", borderRadius: 8, padding: "5px 10px", color: "#555", fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>🗑️</button>
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
            <div style={{ display: "flex", flexDirection: "column" }}>
              {/* Tabs */}
              <div style={{ display: "flex", borderBottom: "1px solid #1e1e2e", marginBottom: 14 }}>
                {[{ id: "todos", label: "Comunidade" }, { id: "amigos", label: "Amigos" }].map((t) => (
                  <button key={t.id} onClick={() => setCommFeed(t.id)} style={{ flex: 1, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 14, fontWeight: 700, padding: "10px 0", color: commFeed === t.id ? "#f0f0f0" : "#555" }}>
                    {t.label}
                    {commFeed === t.id && <div style={{ width: 28, height: 2, background: "#e11d48", borderRadius: 2, margin: "6px auto 0" }} />}
                  </button>
                ))}
              </div>

              {/* Stories */}
              <div style={{ borderBottom: "1px solid #1e1e2e", padding: "12px 0", marginBottom: 14 }}>
                <div style={{ display: "flex", gap: 14, overflowX: "auto", padding: "0 4px" }}>
                  {/* Meu story */}
                  {(() => {
                    const myStory = stories.find(s => s.user_id === user.id);
                    const myColor = level.color;
                    return (
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5, flexShrink: 0, cursor: "pointer" }}
                        onClick={() => setShowStoryUpload(true)}>
                        <div style={{ position: "relative" }}>
                          <div style={{ padding: myStory ? 2 : 0, borderRadius: "50%", background: myStory ? myColor : "transparent" }}>
                            <div style={{ padding: myStory ? 2 : 0, borderRadius: "50%", background: myStory ? "#0a0a0f" : "transparent" }}>
                              <div style={{ width: 54, height: 54, borderRadius: "50%", background: "#13131a", border: myStory ? `2px solid ${myColor}` : "2px dashed #1e1e2e", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, overflow: "hidden" }}>
                                {profile?.avatar_url ? <img src={profile.avatar_url} style={{ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover" }}/> : "🏃"}
                              </div>
                            </div>
                          </div>
                          <div style={{ position: "absolute", bottom: -1, right: -1, width: 20, height: 20, background: "#e11d48", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: "#fff", border: "2px solid #0a0a0f" }}>+</div>
                        </div>
                        <span style={{ fontSize: 10, color: myStory ? "#f0f0f0" : "#555", fontWeight: myStory ? 700 : 600 }}>Seu story</span>
                      </div>
                    );
                  })()}

                  {/* Stories reais do banco - agrupados por usuario */}
                  {Object.values(stories.filter(s => s.user_id !== user.id).reduce((acc, s) => {
                    if (!acc[s.user_id]) acc[s.user_id] = s;
                    return acc;
                  }, {})).slice(0, 8).map((s, i) => {
                    const seen = seenStories[s.user_id];
                    const storyColor = getLevelColor(s.profiles?.level);
                    return (
                      <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5, flexShrink: 0, cursor: "pointer" }}
                        onClick={() => { setSeenStories(st => ({...st, [s.user_id]: true})); setActiveStory({ user: s.profiles?.name, color: storyColor, level: s.profiles?.level, media_url: s.media_url, emoji: getLevelIcon(s.profiles?.level), avatar_url: s.profiles?.avatar_url }); }}>
                        <div style={{ padding: 2, borderRadius: "50%", background: seen ? "#1e1e2e" : storyColor }}>
                          <div style={{ padding: 2, borderRadius: "50%", background: "#0a0a0f" }}>
                            <div style={{ width: 54, height: 54, borderRadius: "50%", background: `${storyColor}22`, border: `2px solid ${seen ? "#1e1e2e" : storyColor}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, overflow: "hidden" }}>
                              {s.profiles?.avatar_url ? <img src={s.profiles.avatar_url} style={{ width: "100%", height: "100%", objectFit: "cover" }}/> : getLevelIcon(s.profiles?.level)}
                            </div>
                          </div>
                        </div>
                        <span style={{ fontSize: 10, color: seen ? "#444" : "#f0f0f0", fontWeight: seen ? 400 : 700, maxWidth: 58, textAlign: "center", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {s.profiles?.name?.split(" ")[0]}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Sugestões de quem seguir */}
              {suggestions.length > 0 && (
                <div style={{ marginBottom: 14 }}>
                  <p style={{ fontSize: 12, fontWeight: 700, color: "#555", marginBottom: 10 }}>Corredores para seguir</p>
                  <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 4 }}>
                    {suggestions.map((u) => (
                      <div key={u.id} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, flexShrink: 0, background: "#13131a", border: "1px solid #1e1e2e", borderRadius: 16, padding: "14px 12px", width: 110, cursor: "pointer" }}
                        onClick={() => openProfile(u.id)}>
                        <div style={{ width: 48, height: 48, borderRadius: "50%", background: "#1e1e2e", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 700, border: `2px solid ${getLevelColor(u.level)}`, overflow: "hidden", flexShrink: 0 }}>
                          {u.avatar_url ? <img src={u.avatar_url} alt="av" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : u.name?.charAt(0) || "?"}
                        </div>
                        <div style={{ textAlign: "center" }}>
                          <p style={{ fontSize: 12, fontWeight: 700, color: "#f0f0f0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 86 }}>{u.name?.split(" ")[0]}</p>
                          <p style={{ fontSize: 10, color: getLevelColor(u.level), fontWeight: 700, marginTop: 2 }}>{getLevelIcon(u.level)} {u.level}</p>
                          <p style={{ fontSize: 10, color: "#555", marginTop: 1 }}>{u.races_count || 0} corridas</p>
                        </div>
                        <button onClick={(e) => { e.stopPropagation(); handleFollow(u.id); }}
                          style={{ width: "100%", background: realFollowing[u.id] ? "none" : "#e11d48", color: realFollowing[u.id] ? "#555" : "#fff", border: realFollowing[u.id] ? "1px solid #1e1e2e" : "none", borderRadius: 20, padding: "5px 0", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                          {realFollowing[u.id] ? "Seguindo" : "Seguir"}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Modal de comentários */}
              {openComments && (
                <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.92)", zIndex: 200, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end" }}>
                  <div style={{ background: "#13131a", borderRadius: "24px 24px 0 0", padding: "20px 20px 0", width: "100%", maxWidth: 390, border: "1px solid #1e1e2e", maxHeight: "80vh", display: "flex", flexDirection: "column" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                      <p style={{ fontWeight: 700, fontSize: 16 }}>Comentários</p>
                      <button onClick={() => { setOpenComments(null); setNewComment(""); }} style={{ background: "none", border: "none", color: "#555", fontSize: 22, cursor: "pointer" }}>✕</button>
                    </div>
                    <div style={{ flex: 1, overflowY: "auto", marginBottom: 16 }}>
                      {(comments[openComments] || []).length === 0 && <p style={{ textAlign: "center", color: "#555", fontSize: 13, padding: "20px 0" }}>Nenhum comentário ainda. Seja o primeiro!</p>}
                      {(comments[openComments] || []).map((c) => (
                        <div key={c.id} style={{ display: "flex", gap: 10, marginBottom: 16 }}>
                          <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#1e1e2e", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, border: `2px solid ${getLevelColor(c.profiles?.level)}`, flexShrink: 0 }}>
                            {c.profiles?.avatar_url ? <img src={c.profiles.avatar_url} alt="av" style={{ width: 32, height: 32, borderRadius: "50%", objectFit: "cover" }} /> : c.profiles?.name?.charAt(0) || "?"}
                          </div>
                          <div style={{ flex: 1, background: "#0a0a0f", borderRadius: 12, padding: "8px 12px" }}>
                            <p style={{ fontWeight: 700, fontSize: 12, marginBottom: 3 }}>{c.profiles?.name || "Corredor"}</p>
                            <p style={{ fontSize: 13, color: "#ccc", lineHeight: 1.4 }}>{c.text}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div style={{ display: "flex", gap: 10, paddingBottom: 32, borderTop: "1px solid #1e1e2e", paddingTop: 14 }}>
                      <div style={{ width: 32, height: 32, borderRadius: "50%", background: "linear-gradient(135deg, #e11d48, #f97316)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, flexShrink: 0 }}>{level.icon}</div>
                      <input className="tinput" placeholder="Adicione um comentário..." value={newComment} onChange={(e) => setNewComment(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleComment(openComments)} style={{ flex: 1, padding: "8px 14px", borderRadius: 20 }} />
                      <button onClick={() => handleComment(openComments)} className="jbtn" style={{ borderRadius: 20, padding: "8px 16px" }}>↑</button>
                    </div>
                  </div>
                </div>
              )}

              {/* Campo de busca */}
              {showSearch && (
                <div style={{ marginBottom: 14 }}>
                  <input className="tinput" placeholder="Buscar por nome ou @handle..." value={searchQuery} onChange={(e) => handleSearch(e.target.value)} style={{ marginBottom: searchResults.length > 0 ? 10 : 0 }} />
                  {searchResults.map((u) => (
                    <div key={u.id} style={{ background: "#13131a", border: "1px solid #1e1e2e", borderRadius: 12, padding: "12px 14px", marginBottom: 8, display: "flex", alignItems: "center", gap: 12 }}>
                      <div onClick={() => openProfile(u.id)} style={{ width: 40, height: 40, borderRadius: "50%", background: "#1e1e2e", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, border: `2px solid ${getLevelColor(u.level)}`, flexShrink: 0, cursor: "pointer", overflow: "hidden" }}>
                        {u.avatar_url ? <img src={u.avatar_url} alt="av" style={{ width: 40, height: 40, borderRadius: "50%", objectFit: "cover" }} /> : u.name?.charAt(0) || "?"}
                      </div>
                      <div style={{ flex: 1, cursor: "pointer" }} onClick={() => openProfile(u.id)}>
                        <p style={{ fontWeight: 700, fontSize: 14 }}>{u.name}</p>
                        <p style={{ fontSize: 11, color: "#555" }}>{u.handle ? `@${u.handle}` : ""} · <span style={{ color: getLevelColor(u.level) }}>{getLevelIcon(u.level)} {u.level}</span></p>
                      </div>
                      <button onClick={() => handleFollow(u.id)} style={{ border: `1.5px solid ${realFollowing[u.id] ? "#1e1e2e" : "#e11d48"}`, color: realFollowing[u.id] ? "#555" : "#e11d48", background: "none", borderRadius: 20, padding: "5px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                        {realFollowing[u.id] ? "Seguindo" : "Seguir"}
                      </button>
                    </div>
                  ))}
                  {searchQuery.length > 0 && searchResults.length === 0 && <p style={{ textAlign: "center", color: "#555", fontSize: 13, padding: "16px 0" }}>Nenhum corredor encontrado.</p>}
                </div>
              )}

              {/* Feed */}
              {commFeed === "amigos" ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {(() => {
                    const friendPosts = posts.filter(p => realFollowing[p.user_id]).map(p => ({ ...p, _type: "post", _date: p.created_at }));
                    const friendActivities = activities.filter(a => realFollowing[a.user_id]).map(a => ({ ...a, _type: "activity", _date: a.created_at }));
                    const feed = [...friendPosts, ...friendActivities].sort((a, b) => new Date(b._date) - new Date(a._date));
                    if (feed.length === 0) return (
                      <div style={{ textAlign: "center", padding: "40px 20px" }}>
                        <p style={{ fontSize: 28, marginBottom: 10 }}>🏃</p>
                        <p style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>Feed de amigos</p>
                        <p style={{ fontSize: 13, color: "#555" }}>Siga corredores para ver as publicações deles aqui.</p>
                      </div>
                    );
                    return feed.map((item) => item._type === "activity" ? (
                      <div key={`act-${item.id}`} style={{ background: "#13131a", borderRadius: 16, padding: 16, border: "1px solid #1e1e2e" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                          {getAvatar(item.profiles, 38)}
                          <div style={{ flex: 1 }}>
                            <p style={{ fontWeight: 700, fontSize: 14 }}>{item.profiles?.name || "Corredor"}</p>
                            <p style={{ fontSize: 11, color: "#888" }}>🏃 corrida · {timeAgo(item._date)}</p>
                          </div>
                          <p style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 22, fontWeight: 800, color: "#e11d48" }}>{item.distance} km</p>
                        </div>
                        <div style={{ display: "flex", gap: 8 }}>
                          {item.duration && <div style={{ flex: 1, background: "#1a1a24", borderRadius: 10, padding: "8px 10px" }}><p style={{ fontSize: 13, fontWeight: 700 }}>{item.duration}</p><p style={{ fontSize: 9, color: "#555", marginTop: 2 }}>tempo</p></div>}
                          {item.pace && <div style={{ flex: 1, background: "#1a1a24", borderRadius: 10, padding: "8px 10px" }}><p style={{ fontSize: 13, fontWeight: 700 }}>{item.pace}</p><p style={{ fontSize: 9, color: "#555", marginTop: 2 }}>pace</p></div>}
                          {item.distance && <div style={{ flex: 1, background: "#1a1a24", borderRadius: 10, padding: "8px 10px" }}><p style={{ fontSize: 13, fontWeight: 700 }}>{Math.round(item.distance * 65)} kcal</p><p style={{ fontSize: 9, color: "#555", marginTop: 2 }}>calorias</p></div>}
                        </div>
                      </div>
                    ) : (
                      <div key={`post-${item.id}`} style={{ padding: "20px 20px 0" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                        <div onClick={() => openProfile(item.user_id)} style={{ cursor: "pointer" }}>{getAvatar(item.profiles, 42)}</div>
                        <div style={{ flex: 1, cursor: "pointer" }} onClick={() => openProfile(item.user_id)}>
                          <p style={{ fontWeight: 700, fontSize: 14 }}>{item.profiles?.name || "Corredor"}</p>
                          <p style={{ fontSize: 11, color: "#888" }}>{item.created_at ? timeAgo(item.created_at) : "agora"} · <span style={{ color: getLevelColor(item.profiles?.level), fontWeight: 700 }}>{item.profiles?.level || "Iniciante"}</span></p>
                        </div>
                        {item.user_id !== user.id && (
                          <button onClick={() => handleFollow(item.profiles?.id || item.user_id)} style={{ border: `1.5px solid ${realFollowing[item.profiles?.id || item.user_id] ? "#1e1e2e" : "#e11d48"}`, color: realFollowing[item.profiles?.id || item.user_id] ? "#555" : "#e11d48", background: "none", borderRadius: 20, padding: "4px 12px", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                            {realFollowing[item.profiles?.id || item.user_id] ? "Seguindo" : "Seguir"}
                          </button>
                        )}
                      </div>
                      {item.photo_url && <div style={{ width: "100%", aspectRatio: "4/5", borderRadius: 16, marginBottom: 12, overflow: "hidden" }}><img src={item.photo_url} alt="post" style={{ width: "100%", height: "100%", objectFit: "cover" }} /></div>}
                      {item.text && !item.photo_url && <p style={{ fontSize: 14, color: "#ccc", lineHeight: 1.6, marginBottom: 12 }}>{item.text}</p>}
                      {item.text && item.photo_url && <p style={{ fontSize: 14, color: "#ccc", lineHeight: 1.55, marginBottom: 12 }}><span style={{ fontWeight: 700, color: "#f0f0f0" }}>{(item.profiles?.name || "").split(" ")[0].toLowerCase()} </span>{item.text}</p>}
                      <div style={{ display: "flex", alignItems: "center", gap: 18, padding: "12px 0", borderBottom: "1px solid #1e1e2e" }}>
                        <button onClick={() => handleLikePost(item.id, item.user_id)} style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, color: liked[item.id] ? "#e11d48" : "#555", fontSize: 13, fontWeight: 600, fontFamily: "inherit" }}>
                          <svg width="18" height="18" viewBox="0 0 24 24" fill={liked[item.id] ? "#e11d48" : "none"} stroke={liked[item.id] ? "#e11d48" : "#555"} strokeWidth="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
                          {(item.likes || 0) + (liked[item.id] ? 1 : 0)}
                        </button>
                        <button onClick={() => { setOpenComments(item.id); loadComments(item.id); }} style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, color: "#555", fontSize: 13, fontWeight: 600, fontFamily: "inherit" }}>
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                          {(comments[item.id] || []).length || item.comments || 0}
                        </button>
                        {item.user_id === user.id && <button onClick={() => handleDeletePost(item.id)} style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: "#555" }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg></button>}
                      </div>
                    </div>
                    ));
                  })()}
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {posts.length === 0 && <p style={{ textAlign: "center", color: "#555", fontSize: 13, padding: "30px 0" }}>Nenhum post ainda. Seja o primeiro!</p>}
                  {posts.map((p) => (
                    <div key={p.id} className="card">
                      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                        <div style={{ cursor: "pointer", flexShrink: 0 }} onClick={() => {
                          const pid = p.profiles?.id;
                          if (!pid) return;
                          const story = stories.find(s => s.user_id === pid);
                          if (story) { setSeenStories(st => ({...st, [pid]: true})); setActiveStory({ user: p.profiles?.name, color: getLevelColor(p.profiles?.level), level: p.profiles?.level, media_url: story.media_url, emoji: getLevelIcon(p.profiles?.level), avatar_url: p.profiles?.avatar_url }); }
                          else openProfile(pid);
                        }}>
                          {hasActiveStory(p.profiles?.id)
                            ? <div style={{ padding: 2, borderRadius: "50%", background: getLevelColor(p.profiles?.level) }}>
                                <div style={{ padding: 2, borderRadius: "50%", background: "#0a0a0f" }}>
                                  <div style={{ width: 38, height: 38, borderRadius: "50%", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", background: "#1e1e2e", fontSize: 14, fontWeight: 700, color: "#fff" }}>
                                    {p.profiles?.avatar_url
                                      ? <img src={p.profiles.avatar_url} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                                      : p.profiles?.name?.charAt(0) || "?"
                                    }
                                  </div>
                                </div>
                              </div>
                            : getAvatar(p.profiles, 38)
                          }
                        </div>
                        <div style={{ flex: 1, cursor: "pointer" }} onClick={() => p.profiles?.id && openProfile(p.profiles.id)}>
                          <p style={{ fontWeight: 700, fontSize: 14 }}>{p.profiles?.name || "Corredor"}</p>
                          <span style={{ fontSize: 10, color: "#888" }}>{getLevelIcon(p.profiles?.level)} <span style={{ color: getLevelColor(p.profiles?.level), fontWeight: 700 }}>{p.profiles?.level || "Iniciante"}</span>{p.created_at ? ` · ${timeAgo(p.created_at)}` : ""}</span>
                        </div>
                        {p.user_id !== user.id && (
                          <button onClick={() => handleFollow(p.profiles?.id || p.user_id)} style={{ border: `1.5px solid ${realFollowing[p.profiles?.id || p.user_id] ? "#1e1e2e" : "#e11d48"}`, color: realFollowing[p.profiles?.id || p.user_id] ? "#555" : "#e11d48", background: "none", borderRadius: 20, padding: "4px 12px", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                            {realFollowing[p.profiles?.id || p.user_id] ? "Seguindo" : "Seguir"}
                          </button>
                        )}
                      </div>
                      {p.photo_url && <div style={{ width: "100%", aspectRatio: "4/5", borderRadius: 12, marginBottom: 10, overflow: "hidden" }}><img src={p.photo_url} alt="post" style={{ width: "100%", height: "100%", objectFit: "cover" }} /></div>}
                      {p.text && <p style={{ fontSize: 13, color: "#ccc", lineHeight: 1.55, marginBottom: 12 }}>{p.text}</p>}
                      <div style={{ display: "flex", gap: 18, borderTop: "1px solid #1e1e2e", paddingTop: 10 }}>
                        <button className="lbtn" onClick={() => handleLikePost(p.id, p.user_id)} style={{ color: liked[p.id] ? "#e11d48" : "#555" }}>
                          <span style={{ fontSize: 16 }}>{liked[p.id] ? "❤️" : "🤍"}</span>
                          <span>{(p.likes || 0) + (liked[p.id] ? 1 : 0)}</span>
                        </button>
                        <button className="lbtn" onClick={() => { setOpenComments(p.id); loadComments(p.id); }}><span style={{ fontSize: 16 }}>💬</span><span>{(comments[p.id] || []).length || p.comments || 0}</span></button>
                        <button className="lbtn" style={{ marginLeft: "auto" }}>↗️</button>
                        {p.user_id === user.id && <button className="lbtn" onClick={() => handleDeletePost(p.id)} style={{ color: "#555" }}><span style={{ fontSize: 16 }}>🗑️</span></button>}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Modal publicar */}
              {showPublish && (
                <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.92)", zIndex: 200, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end" }}>
                  <div style={{ background: "#13131a", borderRadius: "24px 24px 0 0", padding: "24px 20px 40px", width: "100%", maxWidth: 390, border: "1px solid #1e1e2e" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                      <p style={{ fontWeight: 700, fontSize: 16 }}>{publishType ? (publishType === "post" ? "Novo post" : publishType === "foto" ? "Nova foto" : "Nova atividade") : "O que quer publicar?"}</p>
                      <button onClick={() => { setShowPublish(false); setPublishType(null); setNewPost(""); }} style={{ background: "none", border: "none", color: "#555", fontSize: 22, cursor: "pointer" }}>✕</button>
                    </div>
                    {!publishType && (
                      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                        {[{ id: "foto", label: "Foto", desc: "Compartilhe um momento da sua corrida", icon: "🖼️" }, { id: "post", label: "Post", desc: "Compartilhe uma ideia, dica ou conquista", icon: "✏️" }, { id: "atividade", label: "Atividade", desc: "Registre um treino com métricas", icon: "⚡" }].map((t) => (
                          <button key={t.id} onClick={() => setPublishType(t.id)} style={{ background: "#0a0a0f", border: "1px solid #1e1e2e", borderRadius: 14, padding: "14px 16px", cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 14 }}>
                            <span style={{ fontSize: 24 }}>{t.icon}</span>
                            <div style={{ textAlign: "left" }}>
                              <p style={{ fontWeight: 700, fontSize: 14, color: "#f0f0f0" }}>{t.label}</p>
                              <p style={{ fontSize: 12, color: "#555", marginTop: 2 }}>{t.desc}</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                    {publishType === "post" && (
                      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                        <textarea className="tinput" rows={4} placeholder="O que está pensando?" value={newPost} onChange={(e) => setNewPost(e.target.value)} />
                        <div style={{ display: "flex", gap: 10 }}>
                          <button onClick={() => setPublishType(null)} style={{ flex: 1, background: "none", border: "1px solid #1e1e2e", color: "#888", borderRadius: 12, padding: 13, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>Voltar</button>
                          <button onClick={() => { handlePost(); setShowPublish(false); setPublishType(null); }} style={{ flex: 2, background: "#e11d48", color: "#fff", border: "none", borderRadius: 12, padding: 13, fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Publicar</button>
                        </div>
                      </div>
                    )}
                    {publishType === "foto" && (
                      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                        <label htmlFor="post-photo" style={{ cursor: "pointer" }}>
                          <div style={{ background: "#0a0a0f", border: `2px dashed ${photoPreview ? "#e11d48" : "#1e1e2e"}`, borderRadius: 14, aspectRatio: "4/5", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                            {photoPreview ? <img src={photoPreview} alt="preview" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <><span style={{ fontSize: 32 }}>🖼️</span><p style={{ fontSize: 13, color: "#555", marginTop: 8 }}>Toque para selecionar (formato 4:5)</p></>}
                          </div>
                        </label>
                        <input id="post-photo" type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => { const f = e.target.files[0]; if (f) { setPhotoFile(f); setPhotoPreview(URL.createObjectURL(f)); } }} />
                        <textarea className="tinput" rows={3} placeholder="Adicione uma legenda..." value={newPost} onChange={(e) => setNewPost(e.target.value)} />
                        <div style={{ display: "flex", gap: 10 }}>
                          <button onClick={() => { setPublishType(null); setPhotoFile(null); setPhotoPreview(null); }} style={{ flex: 1, background: "none", border: "1px solid #1e1e2e", color: "#888", borderRadius: 12, padding: 13, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>Voltar</button>
                          <button onClick={async () => {
                            if (photoFile) {
                              const ext = photoFile.name.split(".").pop();
                              const path = `${user.id}/${Date.now()}.${ext}`;
                              const { error } = await supabase.storage.from("posts").upload(path, photoFile);
                              if (error) { alert("Erro ao enviar foto: " + error.message); return; }
                              const { data } = supabase.storage.from("posts").getPublicUrl(path);
                              await supabase.from("posts").insert({ user_id: user.id, text: newPost, photo_url: data.publicUrl });
                            } else {
                              await supabase.from("posts").insert({ user_id: user.id, text: newPost });
                            }
                            await loadPosts();
                            setShowPublish(false); setPublishType(null); setNewPost(""); setPhotoFile(null); setPhotoPreview(null);
                          }} style={{ flex: 2, background: "#e11d48", color: "#fff", border: "none", borderRadius: 12, padding: 13, fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Publicar</button>
                        </div>
                      </div>
                    )}
                    {publishType === "atividade" && (
                      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                        <input className="tinput" placeholder="Distância (ex: 10.5)" type="number" value={actForm.distance} onChange={(e) => setActForm(a => ({ ...a, distance: e.target.value }))} />
                        <input className="tinput" placeholder="Tempo (ex: 52min)" value={actForm.duration} onChange={(e) => setActForm(a => ({ ...a, duration: e.target.value }))} />
                        <input className="tinput" placeholder="Pace (ex: 5min12s/km)" value={actForm.pace} onChange={(e) => setActForm(a => ({ ...a, pace: e.target.value }))} />
                        <div style={{ display: "flex", gap: 10 }}>
                          <button onClick={() => setPublishType(null)} style={{ flex: 1, background: "none", border: "1px solid #1e1e2e", color: "#888", borderRadius: 12, padding: 13, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>Voltar</button>
                          <button onClick={handleActivity} style={{ flex: 2, background: "#e11d48", color: "#fff", border: "none", borderRadius: 12, padding: 13, fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Publicar</button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* HUB */}
          {tab === "hub" && (
            <div style={{ display: "flex", flexDirection: "column" }}>
              {hubScreen === "tracking" && (
                <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "#0a0a0f", zIndex: 300, maxWidth: 390, margin: "0 auto" }}>
                  <div id="leaflet-map" style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: "90px", zIndex: 1 }}></div>
                  <div style={{ position: "absolute", top: 52, left: 16, right: 16, zIndex: 1000 }}>
                    <div style={{ background: "rgba(10,10,15,0.88)", backdropFilter: "blur(12px)", borderRadius: 10, padding: "6px 12px", border: "1px solid #1e1e2e", marginBottom: 8, display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ width: 8, height: 8, borderRadius: "50%", background: gpsLocated ? "#6ee7b7" : gpsError ? "#e11d48" : "#f59e0b" }} />
                      <span style={{ fontSize: 11, color: "#888" }}>{gpsLocated ? "GPS ativo" : gpsError ? gpsError : "Aguardando GPS..."}</span>
                    </div>
                  </div>
                  <div style={{ position: "absolute", top: 110, left: 16, right: 16, zIndex: 1000 }}>
                    <div style={{ background: "rgba(10,10,15,0.88)", backdropFilter: "blur(12px)", borderRadius: 16, padding: "14px 16px", border: "1px solid #1e1e2e" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div style={{ textAlign: "center" }}>
                          <p style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 30, fontWeight: 800, color: "#e11d48", lineHeight: 1 }}>{gpsDistance.toFixed(2)}</p>
                          <p style={{ fontSize: 10, color: "#555", marginTop: 2 }}>km</p>
                        </div>
                        <div style={{ textAlign: "center" }}>
                          <p style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 30, fontWeight: 800, lineHeight: 1 }}>{formatRunTime(gpsElapsed)}</p>
                          <p style={{ fontSize: 10, color: "#555", marginTop: 2 }}>tempo</p>
                        </div>
                        <div style={{ textAlign: "center" }}>
                          <p style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 30, fontWeight: 800, lineHeight: 1 }}>{formatGpsPace(gpsDistance, gpsElapsed)}</p>
                          <p style={{ fontSize: 10, color: "#555", marginTop: 2 }}>pace/km</p>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div style={{ position: "absolute", bottom: 100, right: 16, background: "rgba(10,10,15,0.9)", backdropFilter: "blur(12px)", borderRadius: 14, padding: "10px 14px", border: "1px solid #1e1e2e", display: "flex", alignItems: "center", gap: 8, zIndex: 1000 }}>
                    <span style={{ fontSize: 18 }}>❤️</span>
                    <div>
                      <p style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 22, fontWeight: 800, color: "#e11d48", lineHeight: 1 }}>{gpsHR}</p>
                      <p style={{ fontSize: 9, color: "#555" }}>bpm</p>
                    </div>
                  </div>
                  <div style={{ position: "absolute", bottom: 100, left: 16, background: "rgba(10,10,15,0.9)", backdropFilter: "blur(12px)", borderRadius: 14, padding: "10px 14px", border: "1px solid #1e1e2e", zIndex: 1000 }}>
                    <p style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 22, fontWeight: 800, color: "#f97316", lineHeight: 1 }}>{Math.floor(gpsDistance * 65)}</p>
                    <p style={{ fontSize: 9, color: "#555" }}>kcal</p>
                  </div>
                  <div style={{ background: "#0a0a0f", borderTop: "1px solid #1e1e2e", padding: "20px 24px 36px", display: "flex", alignItems: "center", gap: 16, position: "absolute", bottom: 0, left: 0, right: 0, zIndex: 1000 }}>
                    <button onClick={() => setGpsPaused(p => !p)} style={{ width: 56, height: 56, borderRadius: "50%", background: "#13131a", border: "1px solid #1e1e2e", color: "#888", fontSize: 20, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {gpsPaused ? "▶" : "⏸"}
                    </button>
                    <button onClick={finishGpsRun} style={{ flex: 1, background: "#e11d48", color: "#fff", border: "none", borderRadius: 16, padding: "16px 0", fontSize: 16, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Finalizar corrida</button>
                    <div style={{ width: 56, height: 56, borderRadius: "50%", background: "#13131a", border: "1px solid #1e1e2e", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <div style={{ width: 10, height: 10, borderRadius: "50%", background: gpsPaused ? "#555" : "#e11d48" }} />
                    </div>
                  </div>
                </div>
              )}

              {hubScreen === "summary" && (
                <div style={{ paddingBottom: 40 }}>
                  <div style={{ textAlign: "center", marginBottom: 24 }}>
                    <p style={{ fontSize: 48, marginBottom: 8 }}>🏅</p>
                    <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 22, fontWeight: 800, marginBottom: 4 }}>Corrida finalizada!</h2>
                    <p style={{ fontSize: 13, color: "#555" }}>Seus dados foram salvos.</p>
                  </div>
                  <div style={{ background: "linear-gradient(135deg, #1a0a10, #13131a)", borderRadius: 20, padding: 24, border: "1px solid #e11d4833", textAlign: "center", marginBottom: 14 }}>
                    <p style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 64, fontWeight: 800, color: "#e11d48", lineHeight: 1 }}>{gpsDistance.toFixed(2)}</p>
                    <p style={{ fontSize: 16, color: "#888", marginTop: 4 }}>quilômetros</p>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 14 }}>
                    {[{ v: formatRunTime(gpsElapsed), l: "Tempo total", icon: "⏱" }, { v: formatGpsPace(gpsDistance, gpsElapsed), l: "Pace médio", icon: "⚡" }, { v: `${gpsHR} bpm`, l: "FC média", icon: "❤️" }, { v: `${Math.floor(gpsDistance * 65)} kcal`, l: "Calorias", icon: "🔥" }].map((s, i) => (
                      <div key={i} className="card" style={{ textAlign: "center" }}>
                        <p style={{ fontSize: 18, marginBottom: 4 }}>{s.icon}</p>
                        <p style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 18, fontWeight: 800, marginBottom: 2 }}>{s.v}</p>
                        <p style={{ fontSize: 11, color: "#555" }}>{s.l}</p>
                      </div>
                    ))}
                  </div>
                  <div style={{ display: "flex", gap: 10 }}>
                    <button onClick={() => setHubScreen("hub")} style={{ flex: 1, background: "none", border: "1px solid #1e1e2e", color: "#888", borderRadius: 12, padding: 14, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Ver hub</button>
                    <button onClick={() => handleShare("resumo_gps", { distance: gpsDistance.toFixed(2), time: formatRunTime(gpsElapsed), pace: formatGpsPace(gpsDistance, gpsElapsed), calories: Math.floor(gpsDistance * 65) })} style={{ flex: 2, background: "#e11d48", color: "#fff", border: "none", borderRadius: 12, padding: 14, fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Compartilhar corrida</button>
                  </div>
                </div>
              )}

              {hubScreen === "hub" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <div style={{ background: "linear-gradient(135deg, #1a0a10, #13131a)", borderRadius: 20, padding: 20, border: "1px solid #e11d4833", position: "relative", overflow: "hidden" }}>
                    <div style={{ position: "absolute", top: -20, right: -20, width: 100, height: 100, background: "radial-gradient(circle, #e11d4825 0%, transparent 70%)", pointerEvents: "none" }} />
                    <p style={{ fontSize: 12, color: "#888", marginBottom: 4 }}>Pronto para correr?</p>
                    <p style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 18, fontWeight: 800, marginBottom: 16 }}>Registre com <span style={{ color: "#e11d48" }}>GPS</span></p>
                    <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
                      {["📍 GPS", "❤️ FC", "⚡ Pace", "🔥 Calorias"].map((f, i) => <div key={i} style={{ background: "#0a0a0f", borderRadius: 8, padding: "4px 10px", fontSize: 10, color: "#888", fontWeight: 700 }}>{f}</div>)}
                    </div>
                    <button onClick={startGpsRun} style={{ width: "100%", background: "#e11d48", color: "#fff", border: "none", borderRadius: 12, padding: "14px 0", fontSize: 15, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Iniciar corrida</button>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <div className="sbox"><p style={{ fontSize: 20, fontWeight: 700, color: "#e11d48" }}>{(profile?.total_km || 0).toFixed(1)}</p><p style={{ fontSize: 10, color: "#555", marginTop: 2 }}>km total</p></div>
                    <div className="sbox"><p style={{ fontSize: 20, fontWeight: 700 }}>{races}</p><p style={{ fontSize: 10, color: "#555", marginTop: 2 }}>corridas</p></div>
                    <div className="sbox"><p style={{ fontSize: 18, fontWeight: 700 }}>5'18"</p><p style={{ fontSize: 10, color: "#555", marginTop: 2 }}>pace médio</p></div>
                  </div>
                  <p style={{ fontSize: 13, fontWeight: 700, color: "#888", marginTop: 4 }}>Atividades recentes</p>
                  {activities.length === 0 && <p style={{ textAlign: "center", color: "#555", fontSize: 13, padding: "20px 0" }}>Nenhuma atividade ainda. Inicie sua primeira corrida!</p>}
                  {activities.map((a) => (
                    <div key={a.id} style={{ background: "#13131a", borderRadius: 16, padding: 16, border: "1px solid #1e1e2e" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          {getAvatar(a.profiles, 34)}
                          <div>
                            <p style={{ fontWeight: 700, fontSize: 13 }}>{a.profiles?.name || "Corredor"}</p>
                            <p style={{ fontSize: 10, color: "#555" }}>Corrida ao ar livre</p>
                          </div>
                        </div>
                        <p style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 24, fontWeight: 800, color: "#e11d48" }}>{a.distance} km</p>
                      </div>
                      <div style={{ display: "flex", gap: 8 }}>
                        {a.duration && <div style={{ flex: 1, background: "#1a1a24", borderRadius: 10, padding: "8px 10px" }}><p style={{ fontSize: 13, fontWeight: 700 }}>{a.duration}</p><p style={{ fontSize: 9, color: "#555", marginTop: 2 }}>tempo</p></div>}
                        {a.pace && <div style={{ flex: 1, background: "#1a1a24", borderRadius: 10, padding: "8px 10px" }}><p style={{ fontSize: 13, fontWeight: 700 }}>{a.pace}</p><p style={{ fontSize: 9, color: "#555", marginTop: 2 }}>pace</p></div>}
                        {a.user_id === user.id && <button onClick={() => handleDeleteActivity(a.id)} style={{ background: "none", border: "1px solid #1e1e2e", borderRadius: 10, padding: "8px 10px", color: "#555", fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}>🗑️</button>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* PERFIL */}
          {tab === "perfil" && (
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ background: "#13131a", borderRadius: 20, padding: 20, border: "1px solid #1e1e2e", marginBottom: 2, position: "relative", overflow: "hidden" }}>
                <div style={{ position: "absolute", top: -20, right: -20, width: 100, height: 100, background: "radial-gradient(circle, #e11d4820 0%, transparent 70%)", pointerEvents: "none" }} />
                <div style={{ display: "flex", gap: 14, alignItems: "center", marginBottom: 14 }}>
                  <div style={{ position: "relative", flexShrink: 0 }}>
                    <label htmlFor="av-upload" style={{ cursor: "pointer" }}>
                      {profile?.avatar_url ? <img src={profile.avatar_url} alt="av" style={{ width: 68, height: 68, borderRadius: "50%", objectFit: "cover", border: "3px solid #1e1e2e" }} /> : <div style={{ width: 68, height: 68, borderRadius: "50%", background: "linear-gradient(135deg, #e11d48, #f97316)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, border: "3px solid #1e1e2e" }}>{level.icon}</div>}
                      <div style={{ position: "absolute", bottom: -1, right: -1, background: "#e11d48", borderRadius: "50%", width: 20, height: 20, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, border: "2px solid #13131a" }}>{uploadingAvatar ? "⏳" : "📷"}</div>
                    </label>
                    <input id="av-upload" type="file" accept="image/*" style={{ display: "none" }} onChange={handleAvatarUpload} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 18, fontWeight: 800, marginBottom: 2 }}>{profile?.name || userName}</h2>
                    <p style={{ fontSize: 11, color: "#555", marginBottom: 6 }}>@{profile?.handle || (profile?.name || userName).toLowerCase().replace(/\s/g, "")}</p>
                    <div style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "#1e1e2e", borderRadius: 99, padding: "3px 10px" }}>
                      <span style={{ fontSize: 11, color: level.color, fontWeight: 700 }}>{level.icon} {level.name}</span>
                    </div>
                  </div>
                </div>
                {profile?.bio && <p style={{ fontSize: 13, color: "#aaa", lineHeight: 1.5, marginBottom: 14 }}>{profile.bio}</p>}
                <div style={{ marginBottom: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                    <span style={{ fontSize: 10, color: "#555" }}>Próximo: {next?.name}</span>
                    <span style={{ fontSize: 10, color: level.color, fontWeight: 700 }}>{races}/{next?.min} corridas</span>
                  </div>
                  <div style={{ background: "#1e1e2e", borderRadius: 99, height: 4 }}>
                    <div style={{ background: level.color, width: `${progress}%`, height: 4, borderRadius: 99 }} />
                  </div>
                </div>
                <div style={{ display: "flex", gap: 5, marginBottom: 14 }}>
                  <div className="sbox"><p style={{ fontSize: 16, fontWeight: 700, color: "#e11d48" }}>{races}</p><p style={{ fontSize: 9, color: "#555", marginTop: 1 }}>corridas</p></div>
                  <div className="sbox"><p style={{ fontSize: 16, fontWeight: 700 }}>{profile?.total_km?.toFixed(1) || 0} km</p><p style={{ fontSize: 9, color: "#555", marginTop: 1 }}>km total</p></div>
                  <div className="sbox"><p style={{ fontSize: 14, fontWeight: 700 }}>5'18"</p><p style={{ fontSize: 9, color: "#555", marginTop: 1 }}>pace médio</p></div>
                </div>
                <div style={{ display: "flex", gap: 20, marginBottom: 14, paddingBottom: 14, borderBottom: "1px solid #1e1e2e" }}>
                  <button onClick={() => loadFollowList("seguidores")} style={{ textAlign: "center", cursor: "pointer", background: "none", border: "none", fontFamily: "inherit" }}>
                    <p style={{ fontWeight: 700, fontSize: 18, color: "#f0f0f0" }}>{followersCount}</p>
                    <p style={{ fontSize: 11, color: "#555", marginTop: 2 }}>seguidores</p>
                  </button>
                  <button onClick={() => loadFollowList("seguindo")} style={{ textAlign: "center", cursor: "pointer", background: "none", border: "none", fontFamily: "inherit" }}>
                    <p style={{ fontWeight: 700, fontSize: 18, color: "#f0f0f0" }}>{followingCount}</p>
                    <p style={{ fontSize: 11, color: "#555", marginTop: 2 }}>seguindo</p>
                  </button>
                </div>
                {showFollowModal && (
                  <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.92)", zIndex: 200, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end" }}>
                    <div style={{ background: "#13131a", borderRadius: "24px 24px 0 0", padding: "20px 20px 0", width: "100%", maxWidth: 390, border: "1px solid #1e1e2e", maxHeight: "80vh", display: "flex", flexDirection: "column" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                        <p style={{ fontWeight: 700, fontSize: 16, textTransform: "capitalize" }}>{showFollowModal}</p>
                        <button onClick={() => setShowFollowModal(null)} style={{ background: "none", border: "none", color: "#555", fontSize: 22, cursor: "pointer" }}>✕</button>
                      </div>
                      <div style={{ flex: 1, overflowY: "auto", paddingBottom: 32 }}>
                        {followList.length === 0 && <p style={{ textAlign: "center", color: "#555", fontSize: 13, padding: "30px 0" }}>{showFollowModal === "seguidores" ? "Nenhum seguidor ainda." : "Você não segue ninguém ainda."}</p>}
                        {followList.map((u) => (
                          <div key={u.id} style={{ display: "flex", alignItems: "center", gap: 12, paddingBottom: 16, marginBottom: 16, borderBottom: "1px solid #1e1e2e" }}>
                            <div style={{ width: 48, height: 48, borderRadius: "50%", background: "#1e1e2e", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 700, border: `2px solid ${getLevelColor(u.level)}`, flexShrink: 0, overflow: "hidden" }}>
                              {u.avatar_url ? <img src={u.avatar_url} alt="av" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : u.name?.charAt(0) || "?"}
                            </div>
                            <div style={{ flex: 1 }}>
                              <p style={{ fontWeight: 700, fontSize: 15 }}>{u.name}</p>
                              <p style={{ fontSize: 12, color: "#555" }}>{u.handle ? `@${u.handle}` : ""}</p>
                              <p style={{ fontSize: 11, color: getLevelColor(u.level), fontWeight: 700, marginTop: 2 }}>{getLevelIcon(u.level)} {u.level} · {u.races_count || 0} corridas</p>
                            </div>
                            <button onClick={() => handleFollow(u.id)} style={{ border: `1.5px solid ${realFollowing[u.id] ? "#1e1e2e" : "#e11d48"}`, color: realFollowing[u.id] ? "#555" : "#e11d48", background: "none", borderRadius: 20, padding: "6px 16px", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                              {realFollowing[u.id] ? "Seguindo" : "Seguir"}
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => { setShowEditProfile(true); setEditForm({ name: profile?.name || "", bio: profile?.bio || "", handle: profile?.handle || "" }); setAvatarPreview(null); }} style={{ flex: 1, background: "none", color: "#888", border: "1px solid #1e1e2e", borderRadius: 12, padding: "11px 0", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>✏️ Editar perfil</button>
                  <button onClick={() => handleShare("perfil")} style={{ background: "none", color: "#888", border: "1px solid #1e1e2e", borderRadius: 12, padding: "11px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>↗</button>
                </div>
              </div>

              {avatarPreview && (
                <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.92)", zIndex: 300, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 24, padding: 24 }}>
                  <p style={{ fontWeight: 700, fontSize: 16 }}>Nova foto de perfil</p>
                  <img src={avatarPreview.previewUrl} alt="prev" style={{ width: 180, height: 180, borderRadius: "50%", objectFit: "cover", border: "4px solid #e11d48" }} />
                  <div style={{ display: "flex", gap: 12, width: "100%", maxWidth: 300 }}>
                    <button onClick={() => setAvatarPreview(null)} style={{ flex: 1, border: "1px solid #1e1e2e", background: "none", color: "#888", borderRadius: 12, padding: 14, fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}>Cancelar</button>
                    <button onClick={confirmAvatarUpload} disabled={uploadingAvatar} style={{ flex: 1, background: "#e11d48", color: "#fff", border: "none", borderRadius: 12, padding: 14, fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>{uploadingAvatar ? "Enviando..." : "Usar essa foto"}</button>
                  </div>
                </div>
              )}

              {showEditProfile && (
                <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.85)", zIndex: 200, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end" }}>
                  <div style={{ background: "#13131a", borderRadius: "24px 24px 0 0", padding: "24px 24px 40px", width: "100%", maxWidth: 390, border: "1px solid #1e1e2e" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
                      <p style={{ fontWeight: 700, fontSize: 16 }}>Editar perfil</p>
                      <button onClick={() => setShowEditProfile(false)} style={{ background: "none", border: "none", color: "#555", fontSize: 22, cursor: "pointer" }}>✕</button>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 24 }}>
                      <label htmlFor="av-modal" style={{ cursor: "pointer", position: "relative" }}>
                        {profile?.avatar_url ? <img src={profile.avatar_url} alt="av" style={{ width: 80, height: 80, borderRadius: "50%", objectFit: "cover", border: "3px solid #e11d48" }} /> : <div style={{ width: 80, height: 80, borderRadius: "50%", background: "linear-gradient(135deg, #e11d48, #f97316)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 30, border: "3px solid #1e1e2e" }}>{level.icon}</div>}
                        <div style={{ position: "absolute", bottom: 0, right: 0, background: "#e11d48", borderRadius: "50%", width: 26, height: 26, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, border: "2px solid #13131a" }}>📷</div>
                      </label>
                      <input id="av-modal" type="file" accept="image/*" style={{ display: "none" }} onChange={handleAvatarUpload} />
                      <p style={{ fontSize: 12, color: "#555", marginTop: 10 }}>Toque para alterar a foto</p>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 20 }}>
                      <div>
                        <p style={{ fontSize: 11, color: "#555", marginBottom: 6, fontWeight: 700 }}>Nome</p>
                        <input className="tinput" value={editForm.name} onChange={(e) => setEditForm(f => ({ ...f, name: e.target.value }))} placeholder="Seu nome" />
                      </div>
                      <div>
                        <p style={{ fontSize: 11, color: "#555", marginBottom: 6, fontWeight: 700 }}>@ Handle</p>
                        <div style={{ position: "relative" }}>
                          <span style={{ position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)", color: "#555", fontSize: 14 }}>@</span>
                          <input className="tinput" style={{ paddingLeft: 28 }} value={editForm.handle} onChange={(e) => setEditForm(f => ({ ...f, handle: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "") }))} placeholder="seuhandle" />
                        </div>
                      </div>
                      <div>
                        <p style={{ fontSize: 11, color: "#555", marginBottom: 6, fontWeight: 700 }}>Bio</p>
                        <textarea className="tinput" rows={3} value={editForm.bio} onChange={(e) => setEditForm(f => ({ ...f, bio: e.target.value }))} placeholder="Conte um pouco sobre você..." />
                      </div>
                    </div>
                    <button onClick={handleEditProfile} style={{ width: "100%", background: "#e11d48", color: "#fff", border: "none", borderRadius: 14, padding: 16, fontSize: 15, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Salvar alterações</button>
                  </div>
                </div>
              )}

              <div style={{ display: "flex", borderBottom: "1px solid #1e1e2e", background: "#0a0a0f", position: "sticky", top: 0, zIndex: 10 }}>
                {[{ id: "fotos", label: "Fotos" }, { id: "posts_p", label: "Posts" }, { id: "ativ_p", label: "Atividades" }, { id: "niveis_p", label: "Níveis" }].map((t) => (
                  <button key={t.id} onClick={() => setProfileTab(t.id)} style={{ flex: 1, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 11, fontWeight: 700, padding: "10px 0", color: profileTab === t.id ? "#e11d48" : "#555" }}>
                    {t.label}
                    {profileTab === t.id && <div style={{ width: 20, height: 2, background: "#e11d48", borderRadius: 2, margin: "4px auto 0" }} />}
                  </button>
                ))}
              </div>

              {profileTab === "fotos" && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 2 }}>
                  {posts.filter(p => p.user_id === user.id && p.photo_url).map((p) => (
                    <div key={p.id} style={{ aspectRatio: "1", overflow: "hidden", cursor: "pointer" }}>
                      <img src={p.photo_url} alt="foto" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    </div>
                  ))}
                  {posts.filter(p => p.user_id === user.id && p.photo_url).length === 0 && <div style={{ gridColumn: "1/-1", textAlign: "center", padding: "40px 0", color: "#555", fontSize: 13 }}>Nenhuma foto publicada ainda.</div>}
                </div>
              )}
              {profileTab === "posts_p" && (
                <div style={{ display: "flex", flexDirection: "column" }}>
                  {posts.filter(p => p.user_id === user.id).map((p) => (
                    <div key={p.id} style={{ padding: "16px 0", borderBottom: "1px solid #1e1e2e" }}>
                      {p.photo_url && <div style={{ width: "100%", aspectRatio: "4/5", borderRadius: 12, marginBottom: 10, overflow: "hidden" }}><img src={p.photo_url} alt="post" style={{ width: "100%", height: "100%", objectFit: "cover" }} /></div>}
                      {p.text && <p style={{ fontSize: 14, color: "#ccc", lineHeight: 1.6, marginBottom: 8 }}>{p.text}</p>}
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: 11, color: "#555" }}>❤️ {p.likes || 0}</span>
                        <button onClick={() => handleDeletePost(p.id)} style={{ background: "none", border: "none", color: "#555", fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>🗑️ Excluir</button>
                      </div>
                    </div>
                  ))}
                  {posts.filter(p => p.user_id === user.id).length === 0 && <p style={{ textAlign: "center", color: "#555", fontSize: 13, padding: "30px 0" }}>Nenhum post ainda.</p>}
                </div>
              )}
              {profileTab === "ativ_p" && (
                <div style={{ display: "flex", flexDirection: "column" }}>
                  {activities.filter(a => a.user_id === user.id).map((a) => (
                    <div key={a.id} style={{ padding: "14px 0", borderBottom: "1px solid #1e1e2e" }}>
                      <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
                        <div className="sbox"><p style={{ fontSize: 15, fontWeight: 700, color: "#e11d48" }}>{a.distance} km</p><p style={{ fontSize: 9, color: "#555", marginTop: 1 }}>distância</p></div>
                        {a.duration && <div className="sbox"><p style={{ fontSize: 15, fontWeight: 700 }}>{a.duration}</p><p style={{ fontSize: 9, color: "#555", marginTop: 1 }}>tempo</p></div>}
                        {a.pace && <div className="sbox"><p style={{ fontSize: 13, fontWeight: 700 }}>{a.pace}</p><p style={{ fontSize: 9, color: "#555", marginTop: 1 }}>pace</p></div>}
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <button onClick={() => handleShare("atividade", { distance: a.distance, duration: a.duration, pace: a.pace })} style={{ background: "none", border: "none", color: "#555", fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>↗ Compartilhar</button>
                        <button onClick={() => handleDeleteActivity(a.id)} style={{ background: "none", border: "none", color: "#555", fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>🗑️ Excluir</button>
                      </div>
                    </div>
                  ))}
                  {activities.filter(a => a.user_id === user.id).length === 0 && <p style={{ textAlign: "center", color: "#555", fontSize: 13, padding: "30px 0" }}>Nenhuma atividade ainda.</p>}
                </div>
              )}
              {profileTab === "niveis_p" && (
                <div style={{ padding: "16px 0", display: "flex", flexDirection: "column", gap: 12 }}>
                  <div className="card">
                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                      {LEVELS.map((l, i) => {
                        const isActive = l.name === level.name;
                        const isPast = races > l.max;
                        return (
                          <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, opacity: !isActive && !isPast ? 0.3 : 1 }}>
                            <div style={{ width: 38, height: 38, borderRadius: 10, background: isActive || isPast ? `${l.color}22` : "#1e1e2e", border: `1.5px solid ${isActive || isPast ? l.color : "#1e1e2e"}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>{l.icon}</div>
                            <div style={{ flex: 1 }}>
                              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                                <span style={{ fontSize: 13, fontWeight: 700, color: isActive ? l.color : isPast ? "#555" : "#333" }}>{l.name}</span>
                                <span style={{ fontSize: 11, color: "#444" }}>{l.min === 0 ? `0-${l.max}` : l.max === Infinity ? `${l.min}+` : `${l.min}-${l.max}`} corridas</span>
                              </div>
                              <div style={{ background: "#1e1e2e", borderRadius: 99, height: 4 }}>
                                <div style={{ background: l.color, width: isPast ? "100%" : isActive ? `${progress}%` : "0%", height: 4, borderRadius: 99 }} />
                              </div>
                            </div>
                            <span style={{ fontSize: 14 }}>{isPast ? "✅" : isActive ? "▶" : ""}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  {next && <div style={{ background: "#13131a", borderRadius: 12, padding: "12px 16px", border: "1px solid #1e1e2e", textAlign: "center" }}><p style={{ fontSize: 12, color: "#555" }}>Faltam <span style={{ color: "#f0f0f0", fontWeight: 700 }}>{next.min - races} corridas</span> para {next.name} {next.icon}</p></div>}
                </div>
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
                  <p style={{ fontWeight: 700, fontSize: 16 }}>{viewingProfile.name}</p>
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
                    {viewPosts.filter(p => p.photo_url).length === 0 && <div style={{ gridColumn: "1/-1", textAlign: "center", padding: "40px 0", color: "#555", fontSize: 13 }}>Nenhuma foto ainda.</div>}
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
                    {viewPosts.filter(p => p.text).length === 0 && <p style={{ textAlign: "center", color: "#555", fontSize: 13, padding: "30px 0" }}>Nenhum post ainda.</p>}
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
                    {viewActivities.length === 0 && <p style={{ textAlign: "center", color: "#555", fontSize: 13, padding: "30px 0" }}>Nenhuma atividade ainda.</p>}
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

        {/* Modal notificações */}
        {showNotifications && (
          <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.92)", zIndex: 300, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end" }}>
            <div style={{ background: "#13131a", borderRadius: "24px 24px 0 0", padding: "20px 20px 0", width: "100%", maxWidth: 390, border: "1px solid #1e1e2e", maxHeight: "80vh", display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <p style={{ fontWeight: 700, fontSize: 16 }}>Notificações</p>
                <button onClick={() => setShowNotifications(false)} style={{ background: "none", border: "none", color: "#555", fontSize: 22, cursor: "pointer" }}>✕</button>
              </div>
              <div style={{ flex: 1, overflowY: "auto", paddingBottom: 32 }}>
                {notifications.length === 0 && <p style={{ textAlign: "center", color: "#555", fontSize: 13, padding: "30px 0" }}>Nenhuma notificação ainda.</p>}
                {notifications.map((n) => (
                  <div key={n.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 0", borderBottom: "1px solid #1e1e2e", opacity: n.read ? 0.6 : 1 }}>
                    <div onClick={() => { if (n.from_user_id) { setShowNotifications(false); openProfile(n.from_user_id); } }} style={{ width: 42, height: 42, borderRadius: "50%", background: "#1e1e2e", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, flexShrink: 0, overflow: "hidden", cursor: "pointer" }}>
                      {n.from_user?.avatar_url ? <img src={n.from_user.avatar_url} alt="av" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : n.from_user?.name?.charAt(0) || "?"}
                    </div>
                    <div style={{ flex: 1, cursor: "pointer" }} onClick={() => { if (n.from_user_id) { setShowNotifications(false); openProfile(n.from_user_id); } }}>
                      <p style={{ fontSize: 13, color: "#f0f0f0", lineHeight: 1.4 }}>
                        <span style={{ fontWeight: 700 }}>{n.from_user?.name || "Alguém"}</span>
                        {n.type === "follow" && " começou a te seguir"}
                        {n.type === "like" && " curtiu sua publicação"}
                        {n.type === "comment" && " comentou na sua publicação"}
                      </p>
                      <p style={{ fontSize: 11, color: "#555", marginTop: 3 }}>{new Date(n.created_at).toLocaleDateString("pt-BR")}</p>
                    </div>
                    {n.type === "follow" && n.from_user_id && (
                      <button onClick={() => handleFollow(n.from_user_id)} style={{ border: `1.5px solid ${realFollowing[n.from_user_id] ? "#1e1e2e" : "#e11d48"}`, color: realFollowing[n.from_user_id] ? "#555" : "#e11d48", background: "none", borderRadius: 20, padding: "5px 12px", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", flexShrink: 0 }}>
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

  if (loading) return <div style={{ background: "#0a0a0f", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}><p style={{ color: "#555", fontFamily: "sans-serif" }}>Carregando...</p></div>;

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
              {posts.filter(p => p.photo_url).length === 0 && <div style={{ gridColumn: "1/-1", textAlign: "center", padding: "40px 0", color: "#555", fontSize: 13 }}>Nenhuma foto ainda.</div>}
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
              {posts.filter(p => p.text).length === 0 && <p style={{ textAlign: "center", color: "#555", fontSize: 13, padding: "30px 0" }}>Nenhum post ainda.</p>}
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
              {activities.length === 0 && <p style={{ textAlign: "center", color: "#555", fontSize: 13, padding: "30px 0" }}>Nenhuma atividade ainda.</p>}
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

  if (loading) return <div style={{ background: "#0a0a0f", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}><p style={{ color: "#555", fontFamily: "sans-serif" }}>Carregando...</p></div>;

  if (publicHandle) return <PublicProfilePage handle={publicHandle} />;
  if (!session) return <AuthScreen onLogin={(user, name) => { setSession({ user }); setUserName(name); }} />;
  return <AppMain user={session.user} userName={userName} />;
}
