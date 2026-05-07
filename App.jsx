// eucorredor v2.1 - perfil com foto e edicao
import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://atzbgyjenhfgrnwdstnl.supabase.co";
const SUPABASE_KEY = "sb_publishable_WB5ILhYe5FqHaPjHChWH1A_5fNq2_KI";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const LEVELS = [
  { name: "Iniciante", min: 0, max: 4, color: "#6ee7b7", icon: "🌱" },
  { name: "Intermediário", min: 5, max: 14, color: "#60a5fa", icon: "🏃" },
  { name: "Avançado", min: 15, max: 29, color: "#f59e0b", icon: "⚡" },
  { name: "Semi-profissional", min: 30, max: 59, color: "#f97316", icon: "🔥" },
  { name: "Profissional", min: 60, max: Infinity, color: "#e11d48", icon: "🏅" },
];

const getLevel = (races) => LEVELS.find((l) => races >= l.min && races <= l.max) || LEVELS[0];
const getNextLevel = (races) => LEVELS.find((l) => l.min > races);

const events = [
  { id: 1, name: "Maratona de Porto Alegre", date: "15 Jun", dist: "42km", local: "Porto Alegre, RS", km: "2,4 km de você", cat: "Maratona" },
  { id: 2, name: "Corrida das Pedras", date: "22 Jun", dist: "10km", local: "Gramado, RS", km: "38 km de você", cat: "10K" },
  { id: 3, name: "Night Run Canoas", date: "30 Jun", dist: "5km", local: "Canoas, RS", km: "12 km de você", cat: "5K" },
  { id: 4, name: "Trail da Serra Gaúcha", date: "7 Jul", dist: "21km", local: "Caxias do Sul, RS", km: "120 km de você", cat: "Trail" },
];

// ─── AUTH ────────────────────────────────────────────────────────────────────
function AuthScreen({ onLogin }) {
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async () => {
    setError("");
    if (mode === "register" && !form.name.trim()) return setError("Informe seu nome.");
    if (!form.email.includes("@")) return setError("E-mail inválido.");
    if (form.password.length < 6) return setError("Senha com no mínimo 6 caracteres.");
    setLoading(true);

    try {
      if (mode === "register") {
        const { data, error: err } = await supabase.auth.signUp({
          email: form.email,
          password: form.password,
          options: { data: { name: form.name } },
        });
        if (err) throw err;
        if (data.user) {
          await supabase.from("profiles").insert({
            id: data.user.id,
            name: form.name,
            level: "Iniciante",
            races_count: 0,
            total_km: 0,
          });
          onLogin(data.user, form.name);
        }
      } else {
        const { data, error: err } = await supabase.auth.signInWithPassword({
          email: form.email,
          password: form.password,
        });
        if (err) throw err;
        const { data: profile } = await supabase.from("profiles").select("*").eq("id", data.user.id).single();
        onLogin(data.user, profile?.name || form.email.split("@")[0]);
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
        .auth-input { width: 100%; background: #13131a; border: 1.5px solid #1e1e2e; border-radius: 12px; padding: 14px 16px; color: #f0f0f0; font-size: 14px; font-family: inherit; outline: none; transition: border-color .2s; }
        .auth-input:focus { border-color: #e11d48; }
        .auth-input::placeholder { color: #444; }
        .auth-btn { width: 100%; background: #e11d48; color: #fff; border: none; border-radius: 12px; padding: 15px; font-size: 15px; font-weight: 700; cursor: pointer; font-family: inherit; }
        .auth-btn:disabled { background: #3a1a22; color: #666; cursor: not-allowed; }
      `}</style>
      <div style={{ width: "100%", maxWidth: 390, padding: "40px 28px" }}>
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🏃</div>
          <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 32, fontWeight: 800 }}>
            eu<span style={{ color: "#e11d48" }}>corredor</span>
          </h1>
          <p style={{ color: "#555", fontSize: 13, marginTop: 8 }}>A comunidade dos corredores</p>
        </div>
        <div style={{ display: "flex", background: "#13131a", borderRadius: 12, padding: 4, marginBottom: 28 }}>
          {["login", "register"].map((m) => (
            <button key={m} onClick={() => { setMode(m); setError(""); }}
              style={{ flex: 1, background: mode === m ? "#1e1e2e" : "none", border: "none", borderRadius: 9, padding: "9px 0", color: mode === m ? "#fff" : "#555", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
              {m === "login" ? "Entrar" : "Criar conta"}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {mode === "register" && <input className="auth-input" placeholder="Seu nome" value={form.name} onChange={set("name")} />}
          <input className="auth-input" placeholder="E-mail" type="email" value={form.email} onChange={set("email")} />
          <input className="auth-input" placeholder="Senha" type="password" value={form.password} onChange={set("password")} />
        </div>
        {error && <p style={{ color: "#e11d48", fontSize: 12, marginTop: 10 }}>{error}</p>}
        <button className="auth-btn" style={{ marginTop: 24 }} onClick={handleSubmit} disabled={loading}>
          {loading ? "Aguarde..." : mode === "login" ? "Entrar" : "Criar conta"}
        </button>
        <p style={{ textAlign: "center", fontSize: 13, color: "#555", marginTop: 24 }}>
          {mode === "login" ? "Ainda não tem conta? " : "Já tem conta? "}
          <button onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); }}
            style={{ background: "none", border: "none", color: "#e11d48", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
            {mode === "login" ? "Criar agora" : "Entrar"}
          </button>
        </p>
      </div>
    </div>
  );
}

// ─── APP PRINCIPAL ────────────────────────────────────────────────────────────
function AppMain({ user, userName }) {
  const [tab, setTab] = useState("eventos");
  const [communityTab, setCommunityTab] = useState("feed");
  const [profileTab, setProfileTab] = useState("stats");
  const [profile, setProfile] = useState(null);
  const [posts, setPosts] = useState([]);
  const [activities, setActivities] = useState([]);
  const [following, setFollowing] = useState({});
  const [liked, setLiked] = useState({});
  const [newPost, setNewPost] = useState("");
  const [showActivityForm, setShowActivityForm] = useState(false);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [editForm, setEditForm] = useState({ name: "", bio: "" });
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [actForm, setActForm] = useState({ distance: "", duration: "", pace: "" });
  const [loadingPost, setLoadingPost] = useState(false);

  useEffect(() => {
    loadProfile();
    loadPosts();
    loadActivities();
  }, []);

  const loadProfile = async () => {
    const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
    setProfile(data);
  };

  const loadPosts = async () => {
    const { data } = await supabase.from("posts").select("*, profiles(name, level, races_count, avatar_url)").order("created_at", { ascending: false }).limit(20);
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
    if (error) {
      alert("Erro ao publicar: " + error.message);
    } else {
      setNewPost("");
      await loadPosts();
    }
    setLoadingPost(false);
  };

  const handleActivity = async () => {
    if (!actForm.distance) return;
    const { error } = await supabase.from("activities").insert({
      user_id: user.id,
      distance: parseFloat(actForm.distance),
      duration: actForm.duration,
      pace: actForm.pace,
    });
    if (error) {
      alert("Erro ao salvar atividade: " + error.message);
      return;
    }
    const newKm = (profile?.total_km || 0) + parseFloat(actForm.distance);
    const newCount = (profile?.races_count || 0) + 1;
    const newLevel = getLevel(newCount).name;
    await supabase.from("profiles").update({ total_km: newKm, races_count: newCount, level: newLevel }).eq("id", user.id);
    setActForm({ distance: "", duration: "", pace: "" });
    setShowActivityForm(false);
    await loadProfile();
    await loadActivities();
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    window.location.reload();
  };

  const handleEditProfile = async () => {
    await supabase.from("profiles").update({ name: editForm.name, bio: editForm.bio }).eq("id", user.id);
    await loadProfile();
    setShowEditProfile(false);
  };

  const handleAvatarUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const previewUrl = URL.createObjectURL(file);
    setAvatarPreview({ file, previewUrl });
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

  const races = profile?.races_count || 0;
  const level = getLevel(races);
  const next = getNextLevel(races);
  const progress = next ? ((races - level.min) / (next.min - level.min)) * 100 : 100;

  const getLevelColor = (levelName) => LEVELS.find(l => l.name === levelName)?.color || "#888";
  const getLevelIcon = (levelName) => LEVELS.find(l => l.name === levelName)?.icon || "🏃";

  const getAvatar = (profile, size = 38) => {
    if (profile?.avatar_url) {
      return <img src={profile.avatar_url} alt="avatar" style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", flexShrink: 0, border: "2px solid #1e1e2e" }} />;
    }
    return (
      <div style={{ width: size, height: size, borderRadius: "50%", background: "#1e1e2e", display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.32, fontWeight: 700, color: "#fff", border: `2px solid ${getLevelColor(profile?.level)}`, flexShrink: 0 }}>
        {profile?.name?.charAt(0) || "?"}
      </div>
    );
  };


  return (
    <div style={{ background: "#0a0a0f", minHeight: "100vh", fontFamily: "'DM Sans', sans-serif", color: "#f0f0f0", display: "flex", justifyContent: "center" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&family=Space+Grotesk:wght@700;800&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { display: none; }
        .event-card { background: #13131a; border-radius: 16px; padding: 16px; border: 1px solid #1e1e2e; cursor: pointer; }
        .event-card:hover { border-color: #e11d48; }
        .card { background: #13131a; border-radius: 16px; padding: 18px; border: 1px solid #1e1e2e; }
        .like-btn { background: none; border: none; cursor: pointer; display: flex; align-items: center; gap: 6px; color: #666; font-size: 13px; padding: 0; font-family: inherit; }
        .stat-box { background: #1a1a24; border-radius: 12px; padding: 12px 16px; flex: 1; text-align: center; }
        .join-btn { background: #e11d48; color: #fff; border: none; border-radius: 10px; padding: 8px 16px; font-size: 12px; font-weight: 700; cursor: pointer; font-family: inherit; }
        .badge { border-radius: 6px; padding: 3px 9px; font-size: 11px; font-weight: 700; }
        .follow-btn { border: 1.5px solid #e11d48; color: #e11d48; background: none; border-radius: 20px; padding: 5px 14px; font-size: 12px; font-weight: 700; cursor: pointer; font-family: inherit; }
        .sub-tab { background: none; border: none; cursor: pointer; font-family: inherit; font-size: 13px; font-weight: 700; padding: 8px 16px; border-radius: 20px; }
        .bottom-nav { position: fixed; bottom: 0; left: 50%; transform: translateX(-50%); width: 100%; max-width: 390px; background: rgba(10,10,15,0.96); backdrop-filter: blur(12px); border-top: 1px solid #1e1e2e; display: flex; justify-content: space-around; padding: 10px 0 22px; z-index: 100; }
        .nav-btn { background: none; border: none; cursor: pointer; display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 4px 16px; font-family: inherit; }
        .nav-icon { font-size: 22px; line-height: 1; }
        .nav-label { font-size: 10px; font-weight: 700; }
        .text-input { width: 100%; background: #13131a; border: 1.5px solid #1e1e2e; border-radius: 12px; padding: 12px 16px; color: #f0f0f0; font-size: 14px; font-family: inherit; outline: none; resize: none; }
        .text-input:focus { border-color: #e11d48; }
        .text-input::placeholder { color: #444; }
        .profile-stat-btn { background: none; border: none; cursor: pointer; text-align: center; font-family: inherit; }
      `}</style>

      <div style={{ width: "100%", maxWidth: 390, background: "#0a0a0f", minHeight: "100vh" }}>

        {/* Header */}
        <div style={{ padding: "52px 20px 16px", background: "linear-gradient(180deg, #0f0f18 0%, #0a0a0f 100%)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <p style={{ color: "#555", fontSize: 12, marginBottom: 2 }}>Bom dia, {userName.split(" ")[0]} 👋</p>
              <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 22, fontWeight: 800, color: "#fff" }}>
                eu<span style={{ color: "#e11d48" }}>corredor</span>
              </h1>
            </div>
            <button onClick={handleSignOut} style={{ background: "none", border: "1px solid #1e1e2e", borderRadius: 8, padding: "6px 10px", color: "#555", fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}>Sair</button>
          </div>
          <div style={{ marginTop: 16, background: "#13131a", borderRadius: 12, padding: "10px 14px", border: "1px solid #1e1e2e" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <span style={{ fontSize: 12, color: level.color, fontWeight: 700 }}>{level.icon} {level.name}</span>
              {next && <span style={{ fontSize: 11, color: "#555" }}>{races}/{next.min} corridas → {next.name}</span>}
            </div>
            <div style={{ background: "#1e1e2e", borderRadius: 99, height: 5 }}>
              <div style={{ background: level.color, width: `${progress}%`, height: 5, borderRadius: 99 }} />
            </div>
          </div>
        </div>

        {/* Bottom nav */}
        <nav className="bottom-nav">
          {[
            { id: "eventos", label: "Eventos", icon: "📅" },
            { id: "comunidade", label: "Comunidade", icon: "🤝" },
            { id: "hub", label: "Hub", icon: "⚡" },
            { id: "perfil", label: "Perfil", icon: "👤" },
          ].map((t) => (
            <button key={t.id} className="nav-btn" onClick={() => setTab(t.id)}>
              <span className="nav-icon">{t.icon}</span>
              <span className="nav-label" style={{ color: tab === t.id ? "#e11d48" : "#555" }}>{t.label}</span>
              {tab === t.id && <div style={{ width: 4, height: 4, borderRadius: "50%", background: "#e11d48" }} />}
            </button>
          ))}
        </nav>

        <div style={{ padding: "20px", paddingBottom: 90 }}>

          {/* EVENTOS */}
          {tab === "eventos" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                <h2 style={{ fontSize: 16, fontWeight: 700 }}>Próximos eventos</h2>
                <span style={{ fontSize: 12, color: "#555" }}>📍 Porto Alegre, RS</span>
              </div>
              {events.map((e) => (
                <div key={e.id} className="event-card">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                    <div>
                      <p style={{ fontWeight: 700, fontSize: 15, marginBottom: 3 }}>{e.name}</p>
                      <p style={{ fontSize: 12, color: "#555" }}>{e.local}</p>
                    </div>
                    <span className="badge" style={{ background: "#1e1e2e", color: "#999", marginLeft: 8 }}>{e.cat}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ display: "flex", gap: 10 }}>
                      <span style={{ fontSize: 12, color: "#e11d48", fontWeight: 700 }}>📅 {e.date}</span>
                      <span style={{ fontSize: 12, color: "#888" }}>🏃 {e.dist}</span>
                    </div>
                    <button className="join-btn">Inscrever</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* COMUNIDADE */}
          {tab === "comunidade" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ display: "flex", gap: 8, background: "#13131a", borderRadius: 12, padding: 4 }}>
                {[{ id: "feed", label: "Feed" }, { id: "pessoas", label: "Pessoas" }].map((s) => (
                  <button key={s.id} className="sub-tab" onClick={() => setCommunityTab(s.id)}
                    style={{ flex: 1, background: communityTab === s.id ? "#1e1e2e" : "none", color: communityTab === s.id ? "#fff" : "#555" }}>
                    {s.label}
                  </button>
                ))}
              </div>

              {communityTab === "feed" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {/* Caixa de novo post */}
                  <div className="card">
                    <textarea className="text-input" placeholder="Compartilhe algo com a comunidade..." rows={3}
                      value={newPost} onChange={(e) => setNewPost(e.target.value)} />
                    <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 10 }}>
                      <button className="join-btn" onClick={handlePost} disabled={loadingPost}>
                        {loadingPost ? "Publicando..." : "Publicar"}
                      </button>
                    </div>
                  </div>

                  {posts.length === 0 && (
                    <p style={{ textAlign: "center", color: "#555", fontSize: 13, padding: "20px 0" }}>Nenhum post ainda. Seja o primeiro!</p>
                  )}

                  {posts.map((p) => (
                    <div key={p.id} className="card">
                      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                        {getAvatar(p.profiles, 38)}
                        <div>
                          <p style={{ fontWeight: 700, fontSize: 14 }}>{p.profiles?.name || "Corredor"}</p>
                          <span style={{ fontSize: 10, color: getLevelColor(p.profiles?.level), fontWeight: 700 }}>
                            {getLevelIcon(p.profiles?.level)} {p.profiles?.level || "Iniciante"}
                          </span>
                        </div>
                      </div>
                      <p style={{ fontSize: 13, color: "#ccc", lineHeight: 1.55, marginBottom: 10 }}>{p.text}</p>
                      <div style={{ display: "flex", gap: 18, borderTop: "1px solid #1e1e2e", paddingTop: 10 }}>
                        <button className="like-btn" onClick={() => setLiked(l => ({ ...l, [p.id]: !l[p.id] }))}
                          style={{ color: liked[p.id] ? "#e11d48" : "#555" }}>
                          <span>{liked[p.id] ? "❤️" : "🤍"}</span>
                          <span>{p.likes + (liked[p.id] ? 1 : 0)}</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {communityTab === "pessoas" && (
                <p style={{ textAlign: "center", color: "#555", fontSize: 13, padding: "20px 0" }}>Em breve — lista de corredores para seguir.</p>
              )}
            </div>
          )}

          {/* HUB */}
          {tab === "hub" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                <h2 style={{ fontSize: 16, fontWeight: 700 }}>Atividades recentes</h2>
                <button className="join-btn" onClick={() => setShowActivityForm(!showActivityForm)}>+ Registrar</button>
              </div>

              {showActivityForm && (
                <div className="card" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <p style={{ fontWeight: 700, fontSize: 14 }}>Nova atividade</p>
                  {[
                    { key: "distance", placeholder: "Distância (km)", type: "number" },
                    { key: "duration", placeholder: "Tempo (ex: 45min)", type: "text" },
                    { key: "pace", placeholder: "Pace (ex: 5'30\"/km)", type: "text" },
                  ].map((f) => (
                    <input key={f.key} className="text-input" type={f.type} placeholder={f.placeholder}
                      value={actForm[f.key]} onChange={(e) => setActForm(a => ({ ...a, [f.key]: e.target.value }))} />
                  ))}
                  <button className="join-btn" onClick={handleActivity}>Salvar</button>
                </div>
              )}

              {activities.length === 0 && (
                <p style={{ textAlign: "center", color: "#555", fontSize: 13, padding: "20px 0" }}>Nenhuma atividade ainda. Registre a primeira!</p>
              )}

              {activities.map((a) => (
                <div key={a.id} className="card">
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                    {getAvatar(a.profiles, 36)}
                    <div>
                      <p style={{ fontWeight: 700, fontSize: 14 }}>{a.profiles?.name || "Corredor"}</p>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <div className="stat-box">
                      <p style={{ fontSize: 18, fontWeight: 700, color: "#e11d48" }}>{a.distance} km</p>
                      <p style={{ fontSize: 10, color: "#555", marginTop: 2 }}>distância</p>
                    </div>
                    {a.duration && <div className="stat-box">
                      <p style={{ fontSize: 18, fontWeight: 700 }}>{a.duration}</p>
                      <p style={{ fontSize: 10, color: "#555", marginTop: 2 }}>tempo</p>
                    </div>}
                    {a.pace && <div className="stat-box">
                      <p style={{ fontSize: 16, fontWeight: 700 }}>{a.pace}</p>
                      <p style={{ fontSize: 10, color: "#555", marginTop: 2 }}>pace</p>
                    </div>}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* PERFIL */}
          {tab === "perfil" && (
            <div style={{ display: "flex", flexDirection: "column" }}>

              {/* Card do perfil */}
              <div style={{ background: "#13131a", borderRadius: 20, padding: "20px", border: "1px solid #1e1e2e", margin: "0 0 2px", position: "relative", overflow: "hidden" }}>
                <div style={{ position: "absolute", top: -20, right: -20, width: 100, height: 100, background: "radial-gradient(circle, #e11d4820 0%, transparent 70%)", pointerEvents: "none" }} />

                {/* Avatar + info */}
                <div style={{ display: "flex", gap: 14, alignItems: "center", marginBottom: 14 }}>
                  <div style={{ position: "relative", flexShrink: 0 }}>
                    <label htmlFor="avatar-upload" style={{ cursor: "pointer" }}>
                      {profile?.avatar_url ? (
                        <img src={profile.avatar_url} alt="avatar" style={{ width: 68, height: 68, borderRadius: "50%", objectFit: "cover", border: "3px solid #1e1e2e" }} />
                      ) : (
                        <div style={{ width: 68, height: 68, borderRadius: "50%", background: "linear-gradient(135deg, #e11d48, #f97316)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, border: "3px solid #1e1e2e" }}>
                          {level.icon}
                        </div>
                      )}
                      <div style={{ position: "absolute", bottom: -1, right: -1, background: "#e11d48", borderRadius: "50%", width: 20, height: 20, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, border: "2px solid #13131a" }}>
                        {uploadingAvatar ? "⏳" : "📷"}
                      </div>
                    </label>
                    <input id="avatar-upload" type="file" accept="image/*" style={{ display: "none" }} onChange={handleAvatarUpload} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 18, fontWeight: 800, marginBottom: 2 }}>{profile?.name || userName}</h2>
                    <p style={{ fontSize: 11, color: "#555", marginBottom: 6 }}>@{(profile?.name || userName).toLowerCase().replace(" ", "")}</p>
                    <div style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "#1e1e2e", borderRadius: 99, padding: "3px 10px" }}>
                      <span style={{ fontSize: 11, color: level.color, fontWeight: 700 }}>{level.icon} {level.name}</span>
                    </div>
                  </div>
                </div>

                {profile?.bio && <p style={{ fontSize: 13, color: "#aaa", lineHeight: 1.5, marginBottom: 14 }}>{profile.bio}</p>}

                {/* Progresso */}
                <div style={{ marginBottom: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                    <span style={{ fontSize: 10, color: "#555" }}>Próximo: {next?.name}</span>
                    <span style={{ fontSize: 10, color: level.color, fontWeight: 700 }}>{races}/{next?.min} corridas</span>
                  </div>
                  <div style={{ background: "#1e1e2e", borderRadius: 99, height: 4 }}>
                    <div style={{ background: level.color, width: `${progress}%`, height: 4, borderRadius: 99 }} />
                  </div>
                </div>

                {/* Stats */}
                <div style={{ display: "flex", gap: 5, marginBottom: 14 }}>
                  <div className="stat-box">
                    <p style={{ fontSize: 16, fontWeight: 700, color: "#e11d48" }}>{races}</p>
                    <p style={{ fontSize: 9, color: "#555", marginTop: 1 }}>corridas</p>
                  </div>
                  <div className="stat-box">
                    <p style={{ fontSize: 16, fontWeight: 700 }}>{profile?.total_km?.toFixed(1) || 0} km</p>
                    <p style={{ fontSize: 9, color: "#555", marginTop: 1 }}>total</p>
                  </div>
                  <div className="stat-box">
                    <p style={{ fontSize: 14, fontWeight: 700 }}>5'18"</p>
                    <p style={{ fontSize: 9, color: "#555", marginTop: 1 }}>pace médio</p>
                  </div>
                </div>

                {/* Botões */}
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => { setShowEditProfile(true); setEditForm({ name: profile?.name || "", bio: profile?.bio || "" }); setAvatarPreview(null); }}
                    style={{ flex: 1, background: "none", color: "#888", border: "1px solid #1e1e2e", borderRadius: 12, padding: "11px 0", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                    ✏️ Editar perfil
                  </button>
                  <button onClick={() => { navigator.clipboard?.writeText(`eucorredor.com.br/${(profile?.name || userName).toLowerCase().replace(" ", "")}`); }}
                    style={{ background: "none", color: "#888", border: "1px solid #1e1e2e", borderRadius: 12, padding: "11px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                    ↗
                  </button>
                </div>
              </div>

              {/* Modal de preview da foto */}
              {avatarPreview && (
                <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.92)", zIndex: 300, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 24, padding: 24 }}>
                  <p style={{ fontWeight: 700, fontSize: 16, color: "#fff" }}>Nova foto de perfil</p>
                  <img src={avatarPreview.previewUrl} alt="preview" style={{ width: 180, height: 180, borderRadius: "50%", objectFit: "cover", border: "4px solid #e11d48", boxShadow: "0 0 40px #e11d4840" }} />
                  <p style={{ fontSize: 13, color: "#555", textAlign: "center" }}>Essa foto vai aparecer no seu perfil e nos posts da comunidade.</p>
                  <div style={{ display: "flex", gap: 12, width: "100%", maxWidth: 300 }}>
                    <button onClick={() => setAvatarPreview(null)} style={{ flex: 1, border: "1px solid #1e1e2e", background: "none", color: "#888", borderRadius: 12, padding: 14, fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}>Cancelar</button>
                    <button onClick={confirmAvatarUpload} disabled={uploadingAvatar} style={{ flex: 1, background: "#e11d48", color: "#fff", border: "none", borderRadius: 12, padding: 14, fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                      {uploadingAvatar ? "Enviando..." : "Usar essa foto"}
                    </button>
                  </div>
                </div>
              )}

              {/* Modal editar perfil - sheet deslizante */}
              {showEditProfile && (
                <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.85)", zIndex: 200, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end" }}>
                  <div style={{ background: "#13131a", borderRadius: "24px 24px 0 0", padding: "24px 24px 40px", width: "100%", maxWidth: 390, border: "1px solid #1e1e2e" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
                      <p style={{ fontWeight: 700, fontSize: 16 }}>Editar perfil</p>
                      <button onClick={() => setShowEditProfile(false)} style={{ background: "none", border: "none", color: "#555", fontSize: 22, cursor: "pointer" }}>✕</button>
                    </div>

                    {/* Avatar editável */}
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 24 }}>
                      <label htmlFor="edit-avatar-modal" style={{ cursor: "pointer", position: "relative" }}>
                        {profile?.avatar_url ? (
                          <img src={profile.avatar_url} alt="avatar" style={{ width: 80, height: 80, borderRadius: "50%", objectFit: "cover", border: "3px solid #e11d48" }} />
                        ) : (
                          <div style={{ width: 80, height: 80, borderRadius: "50%", background: "linear-gradient(135deg, #e11d48, #f97316)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 30, border: "3px solid #1e1e2e" }}>
                            {level.icon}
                          </div>
                        )}
                        <div style={{ position: "absolute", bottom: 0, right: 0, background: "#e11d48", borderRadius: "50%", width: 26, height: 26, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, border: "2px solid #13131a" }}>📷</div>
                      </label>
                      <input id="edit-avatar-modal" type="file" accept="image/*" style={{ display: "none" }} onChange={handleAvatarUpload} />
                      <p style={{ fontSize: 12, color: "#555", marginTop: 10 }}>Toque para alterar a foto</p>
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 20 }}>
                      <div>
                        <p style={{ fontSize: 11, color: "#555", marginBottom: 6, fontWeight: 700 }}>Nome</p>
                        <input className="text-input" value={editForm.name} onChange={(e) => setEditForm(f => ({ ...f, name: e.target.value }))} placeholder="Seu nome" />
                      </div>
                      <div>
                        <p style={{ fontSize: 11, color: "#555", marginBottom: 6, fontWeight: 700 }}>Bio</p>
                        <textarea className="text-input" rows={3} value={editForm.bio} onChange={(e) => setEditForm(f => ({ ...f, bio: e.target.value }))} placeholder="Conte um pouco sobre você..." />
                      </div>
                    </div>

                    <button onClick={handleEditProfile}
                      style={{ width: "100%", background: "#e11d48", color: "#fff", border: "none", borderRadius: 14, padding: 16, fontSize: 15, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                      Salvar alterações
                    </button>
                  </div>
                </div>
              )}

              {/* Sub-tabs do perfil */}
              <div style={{ display: "flex", borderBottom: "1px solid #1e1e2e", background: "#0a0a0f", position: "sticky", top: 0, zIndex: 10 }}>
                {[
                  { id: "fotos", label: "Fotos" },
                  { id: "posts_perfil", label: "Posts" },
                  { id: "ativ_perfil", label: "Atividades" },
                  { id: "niveis_perfil", label: "Níveis" },
                ].map((t) => (
                  <button key={t.id} onClick={() => setProfileTab(t.id)}
                    style={{ flex: 1, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 11, fontWeight: 700, padding: "10px 0", color: profileTab === t.id ? "#e11d48" : "#555" }}>
                    {t.label}
                    {profileTab === t.id && <div style={{ width: 20, height: 2, background: "#e11d48", borderRadius: 2, margin: "4px auto 0" }} />}
                  </button>
                ))}
              </div>

              {/* Fotos 3x3 */}
              {profileTab === "fotos" && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 2 }}>
                  {[
                    { c1: "#e11d48", c2: "#f97316", e: "🏅" },
                    { c1: "#60a5fa", c2: "#6ee7b7", e: "🌄" },
                    { c1: "#f59e0b", c2: "#f97316", e: "👟" },
                    { c1: "#6ee7b7", c2: "#60a5fa", e: "☀️" },
                    { c1: "#f97316", c2: "#e11d48", e: "🏁" },
                    { c1: "#e11d48", c2: "#60a5fa", e: "💪" },
                  ].map((p, i) => (
                    <div key={i} style={{ aspectRatio: "1", background: `linear-gradient(135deg, ${p.c1}, ${p.c2})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, cursor: "pointer" }}>
                      {p.e}
                    </div>
                  ))}
                </div>
              )}

              {/* Posts do perfil */}
              {profileTab === "posts_perfil" && (
                <div style={{ display: "flex", flexDirection: "column" }}>
                  {posts.map((p) => (
                    <div key={p.id} style={{ padding: "16px 20px", borderBottom: "1px solid #1e1e2e" }}>
                      <p style={{ fontSize: 14, color: "#ccc", lineHeight: 1.6, marginBottom: 10 }}>{p.text}</p>
                      <span style={{ fontSize: 11, color: "#555" }}>❤️ {p.likes} · 💬 {p.comments}</span>
                    </div>
                  ))}
                  {posts.length === 0 && <p style={{ textAlign: "center", color: "#555", fontSize: 13, padding: "30px 0" }}>Nenhum post ainda.</p>}
                </div>
              )}

              {/* Atividades do perfil */}
              {profileTab === "ativ_perfil" && (
                <div style={{ display: "flex", flexDirection: "column" }}>
                  {activities.map((a) => (
                    <div key={a.id} style={{ padding: "14px 20px", borderBottom: "1px solid #1e1e2e" }}>
                      <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
                        <div className="stat-box">
                          <p style={{ fontSize: 15, fontWeight: 700, color: "#e11d48" }}>{a.distance} km</p>
                          <p style={{ fontSize: 9, color: "#555", marginTop: 1 }}>distância</p>
                        </div>
                        {a.duration && <div className="stat-box">
                          <p style={{ fontSize: 15, fontWeight: 700 }}>{a.duration}</p>
                          <p style={{ fontSize: 9, color: "#555", marginTop: 1 }}>tempo</p>
                        </div>}
                        {a.pace && <div className="stat-box">
                          <p style={{ fontSize: 13, fontWeight: 700 }}>{a.pace}</p>
                          <p style={{ fontSize: 9, color: "#555", marginTop: 1 }}>pace</p>
                        </div>}
                      </div>
                    </div>
                  ))}
                  {activities.length === 0 && <p style={{ textAlign: "center", color: "#555", fontSize: 13, padding: "30px 0" }}>Nenhuma atividade ainda.</p>}
                </div>
              )}

              {/* Níveis do perfil */}
              {profileTab === "niveis_perfil" && (
                <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
                  <div className="card">
                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                      {LEVELS.map((l, i) => {
                        const isActive = l.name === level.name;
                        const isPast = races > l.max;
                        return (
                          <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, opacity: !isActive && !isPast ? 0.3 : 1 }}>
                            <div style={{ width: 38, height: 38, borderRadius: 10, background: isActive || isPast ? `${l.color}22` : "#1e1e2e", border: `1.5px solid ${isActive || isPast ? l.color : "#1e1e2e"}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>
                              {l.icon}
                            </div>
                            <div style={{ flex: 1 }}>
                              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                                <span style={{ fontSize: 13, fontWeight: 700, color: isActive ? l.color : isPast ? "#555" : "#333" }}>{l.name}</span>
                                <span style={{ fontSize: 11, color: "#444" }}>{l.min === 0 ? `0–${l.max}` : l.max === Infinity ? `${l.min}+` : `${l.min}–${l.max}`} corridas</span>
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
                  {next && (
                    <div style={{ background: "#13131a", borderRadius: 12, padding: "12px 16px", border: "1px solid #1e1e2e", textAlign: "center" }}>
                      <p style={{ fontSize: 12, color: "#555" }}>Faltam <span style={{ color: "#f0f0f0", fontWeight: 700 }}>{next.min - races} corridas</span> para {next.name} {next.icon}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── ROOT ─────────────────────────────────────────────────────────────────────
export default function App() {
  const [session, setSession] = useState(null);
  const [userName, setUserName] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session) {
        const { data: profile } = await supabase.from("profiles").select("name").eq("id", session.user.id).single();
        setUserName(profile?.name || session.user.email.split("@")[0]);
        setSession(session);
      }
      setLoading(false);
    });
    supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
  }, []);

  if (loading) return (
    <div style={{ background: "#0a0a0f", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <p style={{ color: "#555", fontFamily: "sans-serif" }}>Carregando...</p>
    </div>
  );

  if (!session) return <AuthScreen onLogin={(user, name) => { setSession({ user }); setUserName(name); }} />;
  return <AppMain user={session.user} userName={userName} />;
}
