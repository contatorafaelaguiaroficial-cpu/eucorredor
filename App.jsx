// eucorredor v3.0
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
  const [form, setForm] = useState({ name: "", email: "", password: "", handle: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

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
          await supabase.from("profiles").insert({ id: data.user.id, name: form.name, handle: form.handle, level: "Iniciante", races_count: 0, total_km: 0 });
          onLogin(data.user, form.name);
        }
      } else {
        let emailToUse = form.email.trim();
        // Se não contém @ ou começa com @, trata como handle
        if (!emailToUse.includes("@") || emailToUse.startsWith("@")) {
          const handle = emailToUse.replace("@", "").toLowerCase();
          const { data: profileData } = await supabase.from("profiles").select("id").eq("handle", handle).single();
          if (!profileData) throw new Error("Usuário @" + handle + " não encontrado.");
          const { data: userData } = await supabase.auth.admin?.getUserById(profileData.id);
          // fallback: busca o email pelo handle via profiles join auth
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
        {error && <p style={{ color: "#e11d48", fontSize: 12, marginTop: 10 }}>{error}</p>}
        <button className="ab" style={{ marginTop: 24 }} onClick={handleSubmit} disabled={loading}>
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
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [editForm, setEditForm] = useState({ name: "", bio: "" });
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [loadingPost, setLoadingPost] = useState(false);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [showFollowModal, setShowFollowModal] = useState(null);
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

  useEffect(() => { loadProfile(); loadPosts(); loadActivities(); loadFollowCounts(); loadNotifications(); }, []);

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
    }
    await loadFollowCounts();
    await loadNotifications();
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

  const loadFollowCounts = async () => {
    const { count: fc } = await supabase.from("follows").select("*", { count: "exact", head: true }).eq("following_id", user.id);
    const { count: ing } = await supabase.from("follows").select("*", { count: "exact", head: true }).eq("follower_id", user.id);
    setFollowersCount(fc || 0);
    setFollowingCount(ing || 0);
  };

  const loadProfile = async () => {
    const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
    setProfile(data);
  };
  const loadPosts = async () => {
    const { data } = await supabase.from("posts").select("*, profiles(name, level, avatar_url)").order("created_at", { ascending: false }).limit(20);
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
    const { data } = await supabase.from("comments")
      .select("*, profiles(name, avatar_url, level)")
      .eq("post_id", postId)
      .order("created_at", { ascending: true });
    setComments(c => ({ ...c, [postId]: data || [] }));
  };

  const handleComment = async (postId) => {
    if (!newComment.trim()) return;
    await supabase.from("comments").insert({ post_id: postId, user_id: user.id, text: newComment });
    const post = posts.find(p => p.id === postId);
    if (post && post.user_id !== user.id) {
      await supabase.from("notifications").insert({ user_id: post.user_id, from_user_id: user.id, type: "comment", post_id: postId });
    }
    setNewComment("");
    await loadComments(postId);
    await loadNotifications();
  };

  const handleSearch = async (query) => {
    setSearchQuery(query);
    if (!query.trim()) { setSearchResults([]); return; }
    const { data } = await supabase.from("profiles")
      .select("id, name, handle, level, avatar_url, races_count")
      .or(`name.ilike.%${query}%,handle.ilike.%${query}%`)
      .neq("id", user.id)
      .limit(10);
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

  const handleSignOut = async () => { await supabase.auth.signOut(); window.location.reload(); };

  const races = profile?.races_count || 0;
  const level = getLevel(races);
  const next = getNextLevel(races);
  const progress = next ? ((races - level.min) / (next.min - level.min)) * 100 : 100;

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
        .card { background: #13131a; border-radius: 16px; padding: 16px; border: 1px solid #1e1e2e; }
        .sbox { background: #1a1a24; border-radius: 10px; padding: 10px 12px; flex: 1; text-align: center; }
        .jbtn { background: #e11d48; color: #fff; border: none; border-radius: 10px; padding: 8px 16px; font-size: 12px; font-weight: 700; cursor: pointer; font-family: inherit; }
        .lbtn { background: none; border: none; cursor: pointer; display: flex; align-items: center; gap: 5px; color: #555; font-size: 13px; padding: 0; font-family: inherit; }
        .tinput { width: 100%; background: #13131a; border: 1.5px solid #1e1e2e; border-radius: 12px; padding: 12px 16px; color: #f0f0f0; font-size: 14px; font-family: inherit; outline: none; resize: none; }
        .tinput:focus { border-color: #e11d48; }
        .tinput::placeholder { color: #444; }
        .bnav { position: fixed; bottom: 0; left: 50%; transform: translateX(-50%); width: 100%; max-width: 390px; background: rgba(10,10,15,0.96); backdrop-filter: blur(12px); border-top: 1px solid #1e1e2e; display: flex; justify-content: space-around; padding: 10px 0 22px; z-index: 100; }
        .nbtn { background: none; border: none; cursor: pointer; display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 4px 16px; font-family: inherit; }
      `}</style>

      <div style={{ width: "100%", maxWidth: 390, minHeight: "100vh" }}>

        {/* Header */}
        <div style={{ padding: "52px 20px 16px", background: "linear-gradient(180deg, #0f0f18 0%, #0a0a0f 100%)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <p style={{ color: "#555", fontSize: 12, marginBottom: 2 }}>Bom dia, {userName.split(" ")[0]} 👋</p>
              <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 22, fontWeight: 800, color: "#fff" }}>eu<span style={{ color: "#e11d48" }}>corredor</span></h1>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <button onClick={() => { setShowNotifications(true); markAllRead(); }}
                style={{ position: "relative", background: "none", border: "1px solid #1e1e2e", borderRadius: 8, padding: "6px 10px", color: "#888", fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}>
                🔔
                {notifications.filter(n => !n.read).length > 0 && (
                  <span style={{ position: "absolute", top: -4, right: -4, background: "#e11d48", borderRadius: "50%", width: 16, height: 16, fontSize: 9, fontWeight: 700, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {notifications.filter(n => !n.read).length}
                  </span>
                )}
              </button>
              <button onClick={handleSignOut} style={{ background: "none", border: "1px solid #1e1e2e", borderRadius: 8, padding: "6px 10px", color: "#555", fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}>Sair</button>
            </div>
          </div>
          <div style={{ marginTop: 16, background: "#13131a", borderRadius: 12, padding: "10px 14px", border: "1px solid #1e1e2e" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <span style={{ fontSize: 12, color: level.color, fontWeight: 700 }}>{level.icon} {level.name}</span>
              {next && <span style={{ fontSize: 11, color: "#555" }}>{races}/{next.min} corridas</span>}
            </div>
            <div style={{ background: "#1e1e2e", borderRadius: 99, height: 5 }}>
              <div style={{ background: level.color, width: `${progress}%`, height: 5, borderRadius: 99 }} />
            </div>
          </div>
        </div>

        {/* Bottom nav */}
        <nav className="bnav">
          {[{ id: "eventos", label: "Eventos", icon: "📅" }, { id: "comunidade", label: "Comunidade", icon: "🤝" }, { id: "hub", label: "Hub", icon: "⚡" }, { id: "perfil", label: "Perfil", icon: "👤" }].map((t) => (
            <button key={t.id} className="nbtn" onClick={() => setTab(t.id)}>
              <span style={{ fontSize: 22 }}>{t.icon}</span>
              <span style={{ fontSize: 10, fontWeight: 700, color: tab === t.id ? "#e11d48" : "#555" }}>{t.label}</span>
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
                <div key={e.id} className="card" style={{ cursor: "pointer" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                    <div>
                      <p style={{ fontWeight: 700, fontSize: 15, marginBottom: 3 }}>{e.name}</p>
                      <p style={{ fontSize: 12, color: "#555" }}>{e.local}</p>
                    </div>
                    <span style={{ background: "#1e1e2e", color: "#999", borderRadius: 6, padding: "3px 9px", fontSize: 11, fontWeight: 700, marginLeft: 8 }}>{e.cat}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ display: "flex", gap: 10 }}>
                      <span style={{ fontSize: 12, color: "#e11d48", fontWeight: 700 }}>📅 {e.date}</span>
                      <span style={{ fontSize: 12, color: "#888" }}>🏃 {e.dist}</span>
                    </div>
                    <button className="jbtn">Inscrever</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* COMUNIDADE */}
          {tab === "comunidade" && (
            <div style={{ display: "flex", flexDirection: "column" }}>
              {/* Tabs */}
              <div style={{ display: "flex", borderBottom: "1px solid #1e1e2e", marginBottom: 14 }}>
                {[{ id: "todos", label: "Comunidade" }, { id: "amigos", label: "Amigos" }].map((t) => (
                  <button key={t.id} onClick={() => setCommFeed(t.id)}
                    style={{ flex: 1, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 14, fontWeight: 700, padding: "10px 0", color: commFeed === t.id ? "#f0f0f0" : "#555" }}>
                    {t.label}
                    {commFeed === t.id && <div style={{ width: 28, height: 2, background: "#e11d48", borderRadius: 2, margin: "6px auto 0" }} />}
                  </button>
                ))}
              </div>

              {/* Barra de ações */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <button onClick={() => setShowSearch(!showSearch)}
                  style={{ background: showSearch ? "#13131a" : "none", border: showSearch ? "1px solid #e11d48" : "1px solid #1e1e2e", borderRadius: 10, padding: "8px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", color: showSearch ? "#e11d48" : "#888", display: "flex", alignItems: "center", gap: 6 }}>
                  Buscar
                </button>
                <button className="jbtn" onClick={() => setShowPublish(true)}>+ Publicar</button>
              </div>

              {/* Modal de comentários */}
              {openComments && (
                <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.92)", zIndex: 200, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end" }}>
                  <div style={{ background: "#13131a", borderRadius: "24px 24px 0 0", padding: "20px 20px 0", width: "100%", maxWidth: 390, border: "1px solid #1e1e2e", maxHeight: "80vh", display: "flex", flexDirection: "column" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                      <p style={{ fontWeight: 700, fontSize: 16 }}>Comentários</p>
                      <button onClick={() => { setOpenComments(null); setNewComment(""); }} style={{ background: "none", border: "none", color: "#555", fontSize: 22, cursor: "pointer" }}>✕</button>
                    </div>

                    {/* Lista de comentários */}
                    <div style={{ flex: 1, overflowY: "auto", marginBottom: 16 }}>
                      {(comments[openComments] || []).length === 0 && (
                        <p style={{ textAlign: "center", color: "#555", fontSize: 13, padding: "20px 0" }}>Nenhum comentário ainda. Seja o primeiro!</p>
                      )}
                      {(comments[openComments] || []).map((c) => (
                        <div key={c.id} style={{ display: "flex", gap: 10, marginBottom: 16 }}>
                          <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#1e1e2e", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, border: `2px solid ${getLevelColor(c.profiles?.level)}`, flexShrink: 0 }}>
                            {c.profiles?.avatar_url
                              ? <img src={c.profiles.avatar_url} alt="av" style={{ width: 32, height: 32, borderRadius: "50%", objectFit: "cover" }} />
                              : c.profiles?.name?.charAt(0) || "?"
                            }
                          </div>
                          <div style={{ flex: 1, background: "#0a0a0f", borderRadius: 12, padding: "8px 12px" }}>
                            <p style={{ fontWeight: 700, fontSize: 12, marginBottom: 3 }}>{c.profiles?.name || "Corredor"}</p>
                            <p style={{ fontSize: 13, color: "#ccc", lineHeight: 1.4 }}>{c.text}</p>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Campo de novo comentário */}
                    <div style={{ display: "flex", gap: 10, paddingBottom: 32, borderTop: "1px solid #1e1e2e", paddingTop: 14 }}>
                      <div style={{ width: 32, height: 32, borderRadius: "50%", background: "linear-gradient(135deg, #e11d48, #f97316)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, flexShrink: 0 }}>
                        {level.icon}
                      </div>
                      <input className="tinput" placeholder="Adicione um comentário..." value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleComment(openComments)}
                        style={{ flex: 1, padding: "8px 14px", borderRadius: 20 }} />
                      <button onClick={() => handleComment(openComments)} className="jbtn" style={{ borderRadius: 20, padding: "8px 16px" }}>↑</button>
                    </div>
                  </div>
                </div>
              )}

              {/* Campo de busca */}
              {showSearch && (
                <div style={{ marginBottom: 14 }}>
                  <input className="tinput" placeholder="Buscar por nome ou @handle..." value={searchQuery}
                    onChange={(e) => handleSearch(e.target.value)}
                    style={{ marginBottom: searchResults.length > 0 ? 10 : 0 }} />
                  {searchResults.map((u) => (
                    <div key={u.id} style={{ background: "#13131a", border: "1px solid #1e1e2e", borderRadius: 12, padding: "12px 14px", marginBottom: 8, display: "flex", alignItems: "center", gap: 12 }}>
                      <div style={{ width: 40, height: 40, borderRadius: "50%", background: "#1e1e2e", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, border: `2px solid ${getLevelColor(u.level)}`, flexShrink: 0 }}>
                        {u.avatar_url
                          ? <img src={u.avatar_url} alt="av" style={{ width: 40, height: 40, borderRadius: "50%", objectFit: "cover" }} />
                          : u.name?.charAt(0) || "?"
                        }
                      </div>
                      <div style={{ flex: 1 }}>
                        <p style={{ fontWeight: 700, fontSize: 14 }}>{u.name}</p>
                        <p style={{ fontSize: 11, color: "#555" }}>{u.handle ? `@${u.handle}` : ""} · <span style={{ color: getLevelColor(u.level) }}>{getLevelIcon(u.level)} {u.level}</span></p>
                      </div>
                      <button onClick={() => handleFollow(u.id)}
                        style={{ border: `1.5px solid ${realFollowing[u.id] ? "#1e1e2e" : "#e11d48"}`, color: realFollowing[u.id] ? "#555" : "#e11d48", background: "none", borderRadius: 20, padding: "5px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                        {realFollowing[u.id] ? "Seguindo" : "Seguir"}
                      </button>
                    </div>
                  ))}
                  {searchQuery.length > 0 && searchResults.length === 0 && (
                    <p style={{ textAlign: "center", color: "#555", fontSize: 13, padding: "16px 0" }}>Nenhum corredor encontrado.</p>
                  )}
                </div>
              )}

              {/* Feed */}
              {commFeed === "amigos" ? (
                <div style={{ textAlign: "center", padding: "40px 20px" }}>
                  <p style={{ fontSize: 28, marginBottom: 10 }}>🏃</p>
                  <p style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>Feed de amigos</p>
                  <p style={{ fontSize: 13, color: "#555" }}>Siga corredores na aba Comunidade para ver o feed de amigos aqui.</p>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {posts.length === 0 && <p style={{ textAlign: "center", color: "#555", fontSize: 13, padding: "30px 0" }}>Nenhum post ainda. Seja o primeiro!</p>}
                  {posts.map((p) => (
                    <div key={p.id} className="card">
                      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                        {getAvatar(p.profiles, 38)}
                        <div style={{ flex: 1 }}>
                          <p style={{ fontWeight: 700, fontSize: 14 }}>{p.profiles?.name || "Corredor"}</p>
                          <span style={{ fontSize: 10, color: getLevelColor(p.profiles?.level), fontWeight: 700 }}>
                            {getLevelIcon(p.profiles?.level)} {p.profiles?.level || "Iniciante"}
                          </span>
                        </div>
                        {p.user_id !== user.id && (
                          <button onClick={() => handleFollow(p.profiles?.id || p.user_id)}
                            style={{ border: `1.5px solid ${realFollowing[p.profiles?.id || p.user_id] ? "#1e1e2e" : "#e11d48"}`, color: realFollowing[p.profiles?.id || p.user_id] ? "#555" : "#e11d48", background: "none", borderRadius: 20, padding: "4px 12px", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                            {realFollowing[p.profiles?.id || p.user_id] ? "Seguindo" : "Seguir"}
                          </button>
                        )}
                      </div>
                      {p.photo_url && (
                        <div style={{ width: "100%", aspectRatio: "4/5", borderRadius: 12, marginBottom: 10, overflow: "hidden" }}>
                          <img src={p.photo_url} alt="post" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        </div>
                      )}
                      {p.text && <p style={{ fontSize: 13, color: "#ccc", lineHeight: 1.55, marginBottom: 12 }}>{p.text}</p>}
                      <div style={{ display: "flex", gap: 18, borderTop: "1px solid #1e1e2e", paddingTop: 10 }}>
                        <button className="lbtn" onClick={() => handleLikePost(p.id, p.user_id)} style={{ color: liked[p.id] ? "#e11d48" : "#555" }}>
                          <span style={{ fontSize: 16 }}>{liked[p.id] ? "❤️" : "🤍"}</span>
                          <span>{(p.likes || 0) + (liked[p.id] ? 1 : 0)}</span>
                        </button>
                        <button className="lbtn" onClick={() => { setOpenComments(p.id); loadComments(p.id); }}><span style={{ fontSize: 16 }}>💬</span><span>{(comments[p.id] || []).length || p.comments || 0}</span></button>
                        <button className="lbtn" style={{ marginLeft: "auto" }}>↗️</button>
                        {p.user_id === user.id && (
                          <button className="lbtn" onClick={() => handleDeletePost(p.id)} style={{ color: "#555" }}>
                            <span style={{ fontSize: 16 }}>🗑️</span>
                          </button>
                        )}
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
                        {[
                          { id: "foto", label: "Foto", desc: "Compartilhe um momento da sua corrida", icon: "🖼️" },
                          { id: "post", label: "Post", desc: "Compartilhe uma ideia, dica ou conquista", icon: "✏️" },
                          { id: "atividade", label: "Atividade", desc: "Registre um treino com métricas", icon: "⚡" },
                        ].map((t) => (
                          <button key={t.id} onClick={() => setPublishType(t.id)}
                            style={{ background: "#0a0a0f", border: "1px solid #1e1e2e", borderRadius: 14, padding: "14px 16px", cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 14 }}>
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
                            {photoPreview
                              ? <img src={photoPreview} alt="preview" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                              : <><span style={{ fontSize: 32 }}>🖼️</span><p style={{ fontSize: 13, color: "#555", marginTop: 8 }}>Toque para selecionar (formato 4:5)</p></>
                            }
                          </div>
                        </label>
                        <input id="post-photo" type="file" accept="image/*" style={{ display: "none" }}
                          onChange={(e) => {
                            const f = e.target.files[0];
                            if (f) { setPhotoFile(f); setPhotoPreview(URL.createObjectURL(f)); }
                          }} />
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
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                <h2 style={{ fontSize: 16, fontWeight: 700 }}>Atividades recentes</h2>
                <button className="jbtn" onClick={() => setShowActivityForm(!showActivityForm)}>+ Registrar</button>
              </div>
              {showActivityForm && (
                <div className="card" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <p style={{ fontWeight: 700, fontSize: 14 }}>Nova atividade</p>
                  <input className="tinput" type="number" placeholder="Distância (km)" value={actForm.distance} onChange={(e) => setActForm(a => ({ ...a, distance: e.target.value }))} />
                  <input className="tinput" placeholder="Tempo (ex: 45min)" value={actForm.duration} onChange={(e) => setActForm(a => ({ ...a, duration: e.target.value }))} />
                  <input className="tinput" placeholder="Pace (ex: 5min30s/km)" value={actForm.pace} onChange={(e) => setActForm(a => ({ ...a, pace: e.target.value }))} />
                  <button className="jbtn" onClick={handleActivity}>Salvar</button>
                </div>
              )}
              {activities.length === 0 && <p style={{ textAlign: "center", color: "#555", fontSize: 13, padding: "20px 0" }}>Nenhuma atividade ainda.</p>}
              {activities.map((a) => (
                <div key={a.id} className="card">
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                    {getAvatar(a.profiles, 36)}
                    <p style={{ fontWeight: 700, fontSize: 14 }}>{a.profiles?.name || "Corredor"}</p>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <div className="sbox"><p style={{ fontSize: 18, fontWeight: 700, color: "#e11d48" }}>{a.distance} km</p><p style={{ fontSize: 10, color: "#555", marginTop: 2 }}>distância</p></div>
                    {a.duration && <div className="sbox"><p style={{ fontSize: 18, fontWeight: 700 }}>{a.duration}</p><p style={{ fontSize: 10, color: "#555", marginTop: 2 }}>tempo</p></div>}
                    {a.pace && <div className="sbox"><p style={{ fontSize: 15, fontWeight: 700 }}>{a.pace}</p><p style={{ fontSize: 10, color: "#555", marginTop: 2 }}>pace</p></div>}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* PERFIL */}
          {tab === "perfil" && (
            <div style={{ display: "flex", flexDirection: "column" }}>
              {/* Card perfil */}
              <div style={{ background: "#13131a", borderRadius: 20, padding: 20, border: "1px solid #1e1e2e", marginBottom: 2, position: "relative", overflow: "hidden" }}>
                <div style={{ position: "absolute", top: -20, right: -20, width: 100, height: 100, background: "radial-gradient(circle, #e11d4820 0%, transparent 70%)", pointerEvents: "none" }} />
                <div style={{ display: "flex", gap: 14, alignItems: "center", marginBottom: 14 }}>
                  <div style={{ position: "relative", flexShrink: 0 }}>
                    <label htmlFor="av-upload" style={{ cursor: "pointer" }}>
                      {profile?.avatar_url
                        ? <img src={profile.avatar_url} alt="av" style={{ width: 68, height: 68, borderRadius: "50%", objectFit: "cover", border: "3px solid #1e1e2e" }} />
                        : <div style={{ width: 68, height: 68, borderRadius: "50%", background: "linear-gradient(135deg, #e11d48, #f97316)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, border: "3px solid #1e1e2e" }}>{level.icon}</div>
                      }
                      <div style={{ position: "absolute", bottom: -1, right: -1, background: "#e11d48", borderRadius: "50%", width: 20, height: 20, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, border: "2px solid #13131a" }}>
                        {uploadingAvatar ? "⏳" : "📷"}
                      </div>
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

                {/* Seguidores e seguindo */}
                <div style={{ display: "flex", gap: 20, marginBottom: 14, paddingBottom: 14, borderBottom: "1px solid #1e1e2e" }}>
                  <button onClick={() => loadFollowList("seguidores")}
                    style={{ textAlign: "center", cursor: "pointer", background: "none", border: "none", fontFamily: "inherit" }}>
                    <p style={{ fontWeight: 700, fontSize: 18, color: "#f0f0f0" }}>{followersCount}</p>
                    <p style={{ fontSize: 11, color: "#555", marginTop: 2 }}>seguidores</p>
                  </button>
                  <button onClick={() => loadFollowList("seguindo")}
                    style={{ textAlign: "center", cursor: "pointer", background: "none", border: "none", fontFamily: "inherit" }}>
                    <p style={{ fontWeight: 700, fontSize: 18, color: "#f0f0f0" }}>{followingCount}</p>
                    <p style={{ fontSize: 11, color: "#555", marginTop: 2 }}>seguindo</p>
                  </button>
                </div>

                {/* Modal seguidores/seguindo */}
                {showFollowModal && (
                  <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.92)", zIndex: 200, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end" }}>
                    <div style={{ background: "#13131a", borderRadius: "24px 24px 0 0", padding: "20px 20px 0", width: "100%", maxWidth: 390, border: "1px solid #1e1e2e", maxHeight: "80vh", display: "flex", flexDirection: "column" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                        <p style={{ fontWeight: 700, fontSize: 16, textTransform: "capitalize" }}>{showFollowModal}</p>
                        <button onClick={() => setShowFollowModal(null)} style={{ background: "none", border: "none", color: "#555", fontSize: 22, cursor: "pointer" }}>✕</button>
                      </div>

                      <div style={{ flex: 1, overflowY: "auto", paddingBottom: 32 }}>
                        {followList.length === 0 && (
                          <p style={{ textAlign: "center", color: "#555", fontSize: 13, padding: "30px 0" }}>
                            {showFollowModal === "seguidores" ? "Nenhum seguidor ainda." : "Você não segue ninguém ainda."}
                          </p>
                        )}
                        {followList.map((u) => (
                          <div key={u.id} style={{ display: "flex", alignItems: "center", gap: 12, paddingBottom: 16, marginBottom: 16, borderBottom: "1px solid #1e1e2e" }}>
                            <div style={{ width: 48, height: 48, borderRadius: "50%", background: "#1e1e2e", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 700, border: `2px solid ${getLevelColor(u.level)}`, flexShrink: 0, overflow: "hidden" }}>
                              {u.avatar_url
                                ? <img src={u.avatar_url} alt="av" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                                : u.name?.charAt(0) || "?"
                              }
                            </div>
                            <div style={{ flex: 1 }}>
                              <p style={{ fontWeight: 700, fontSize: 15 }}>{u.name}</p>
                              <p style={{ fontSize: 12, color: "#555" }}>{u.handle ? `@${u.handle}` : ""}</p>
                              <p style={{ fontSize: 11, color: getLevelColor(u.level), fontWeight: 700, marginTop: 2 }}>{getLevelIcon(u.level)} {u.level} · {u.races_count || 0} corridas</p>
                            </div>
                            <button onClick={() => handleFollow(u.id)}
                              style={{ border: `1.5px solid ${realFollowing[u.id] ? "#1e1e2e" : "#e11d48"}`, color: realFollowing[u.id] ? "#555" : "#e11d48", background: "none", borderRadius: 20, padding: "6px 16px", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                              {realFollowing[u.id] ? "Seguindo" : "Seguir"}
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => { setShowEditProfile(true); setEditForm({ name: profile?.name || "", bio: profile?.bio || "", handle: profile?.handle || "" }); setAvatarPreview(null); }}
                    style={{ flex: 1, background: "none", color: "#888", border: "1px solid #1e1e2e", borderRadius: 12, padding: "11px 0", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                    ✏️ Editar perfil
                  </button>
                  <button style={{ background: "none", color: "#888", border: "1px solid #1e1e2e", borderRadius: 12, padding: "11px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>↗</button>
                </div>
              </div>

              {/* Preview avatar */}
              {avatarPreview && (
                <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.92)", zIndex: 300, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 24, padding: 24 }}>
                  <p style={{ fontWeight: 700, fontSize: 16 }}>Nova foto de perfil</p>
                  <img src={avatarPreview.previewUrl} alt="prev" style={{ width: 180, height: 180, borderRadius: "50%", objectFit: "cover", border: "4px solid #e11d48" }} />
                  <div style={{ display: "flex", gap: 12, width: "100%", maxWidth: 300 }}>
                    <button onClick={() => setAvatarPreview(null)} style={{ flex: 1, border: "1px solid #1e1e2e", background: "none", color: "#888", borderRadius: 12, padding: 14, fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}>Cancelar</button>
                    <button onClick={confirmAvatarUpload} disabled={uploadingAvatar} style={{ flex: 1, background: "#e11d48", color: "#fff", border: "none", borderRadius: 12, padding: 14, fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                      {uploadingAvatar ? "Enviando..." : "Usar essa foto"}
                    </button>
                  </div>
                </div>
              )}

              {/* Modal editar perfil */}
              {showEditProfile && (
                <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.85)", zIndex: 200, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end" }}>
                  <div style={{ background: "#13131a", borderRadius: "24px 24px 0 0", padding: "24px 24px 40px", width: "100%", maxWidth: 390, border: "1px solid #1e1e2e" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
                      <p style={{ fontWeight: 700, fontSize: 16 }}>Editar perfil</p>
                      <button onClick={() => setShowEditProfile(false)} style={{ background: "none", border: "none", color: "#555", fontSize: 22, cursor: "pointer" }}>✕</button>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 24 }}>
                      <label htmlFor="av-modal" style={{ cursor: "pointer", position: "relative" }}>
                        {profile?.avatar_url
                          ? <img src={profile.avatar_url} alt="av" style={{ width: 80, height: 80, borderRadius: "50%", objectFit: "cover", border: "3px solid #e11d48" }} />
                          : <div style={{ width: 80, height: 80, borderRadius: "50%", background: "linear-gradient(135deg, #e11d48, #f97316)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 30, border: "3px solid #1e1e2e" }}>{level.icon}</div>
                        }
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
                        <p style={{ fontSize: 10, color: "#555", marginTop: 4 }}>Somente letras minúsculas, números e _</p>
                      </div>
                      <div>
                        <p style={{ fontSize: 11, color: "#555", marginBottom: 6, fontWeight: 700 }}>Bio</p>
                        <textarea className="tinput" rows={3} value={editForm.bio} onChange={(e) => setEditForm(f => ({ ...f, bio: e.target.value }))} placeholder="Conte um pouco sobre você..." />
                      </div>
                    </div>
                    <button onClick={handleEditProfile} style={{ width: "100%", background: "#e11d48", color: "#fff", border: "none", borderRadius: 14, padding: 16, fontSize: 15, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                      Salvar alterações
                    </button>
                  </div>
                </div>
              )}

              {/* Sub-tabs perfil */}
              <div style={{ display: "flex", borderBottom: "1px solid #1e1e2e", background: "#0a0a0f", position: "sticky", top: 0, zIndex: 10 }}>
                {[{ id: "fotos", label: "Fotos" }, { id: "posts_p", label: "Posts" }, { id: "ativ_p", label: "Atividades" }, { id: "niveis_p", label: "Níveis" }].map((t) => (
                  <button key={t.id} onClick={() => setProfileTab(t.id)}
                    style={{ flex: 1, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 11, fontWeight: 700, padding: "10px 0", color: profileTab === t.id ? "#e11d48" : "#555" }}>
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
                  {posts.filter(p => p.user_id === user.id && p.photo_url).length === 0 && (
                    <div style={{ gridColumn: "1/-1", textAlign: "center", padding: "40px 0", color: "#555", fontSize: 13 }}>
                      Nenhuma foto publicada ainda.
                    </div>
                  )}
                </div>
              )}

              {profileTab === "posts_p" && (
                <div style={{ display: "flex", flexDirection: "column" }}>
                  {posts.filter(p => p.user_id === user.id).map((p) => (
                    <div key={p.id} style={{ padding: "16px 0", borderBottom: "1px solid #1e1e2e" }}>
                      {p.photo_url && (
                        <div style={{ width: "100%", aspectRatio: "4/5", borderRadius: 12, marginBottom: 10, overflow: "hidden" }}>
                          <img src={p.photo_url} alt="post" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        </div>
                      )}
                      {p.text && <p style={{ fontSize: 14, color: "#ccc", lineHeight: 1.6, marginBottom: 8 }}>{p.text}</p>}
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: 11, color: "#555" }}>❤️ {p.likes || 0}</span>
                        <button onClick={() => handleDeletePost(p.id)}
                          style={{ background: "none", border: "none", color: "#555", fontSize: 12, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 4 }}>
                          🗑️ Excluir
                        </button>
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
                      <button onClick={() => handleDeleteActivity(a.id)}
                        style={{ background: "none", border: "none", color: "#555", fontSize: 12, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 4 }}>
                        🗑️ Excluir atividade
                      </button>
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

        {/* Modal notificações */}
        {showNotifications && (
          <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.92)", zIndex: 300, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end" }}>
            <div style={{ background: "#13131a", borderRadius: "24px 24px 0 0", padding: "20px 20px 0", width: "100%", maxWidth: 390, border: "1px solid #1e1e2e", maxHeight: "80vh", display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <p style={{ fontWeight: 700, fontSize: 16 }}>Notificações</p>
                <button onClick={() => setShowNotifications(false)} style={{ background: "none", border: "none", color: "#555", fontSize: 22, cursor: "pointer" }}>✕</button>
              </div>
              <div style={{ flex: 1, overflowY: "auto", paddingBottom: 32 }}>
                {notifications.length === 0 && (
                  <p style={{ textAlign: "center", color: "#555", fontSize: 13, padding: "30px 0" }}>Nenhuma notificação ainda.</p>
                )}
                {notifications.map((n) => (
                  <div key={n.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 0", borderBottom: "1px solid #1e1e2e", opacity: n.read ? 0.6 : 1 }}>
                    <div style={{ width: 42, height: 42, borderRadius: "50%", background: "#1e1e2e", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, flexShrink: 0, overflow: "hidden" }}>
                      {n.from_user?.avatar_url
                        ? <img src={n.from_user.avatar_url} alt="av" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        : n.from_user?.name?.charAt(0) || "?"
                      }
                    </div>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: 13, color: "#f0f0f0", lineHeight: 1.4 }}>
                        <span style={{ fontWeight: 700 }}>{n.from_user?.name || "Alguém"}</span>
                        {n.type === "follow" && " começou a te seguir"}
                        {n.type === "like" && " curtiu sua publicação"}
                        {n.type === "comment" && " comentou na sua publicação"}
                      </p>
                      <p style={{ fontSize: 11, color: "#555", marginTop: 3 }}>
                        {new Date(n.created_at).toLocaleDateString("pt-BR")}
                      </p>
                    </div>
                    <span style={{ fontSize: 20 }}>
                      {n.type === "follow" && "👤"}
                      {n.type === "like" && "❤️"}
                      {n.type === "comment" && "💬"}
                    </span>
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
    supabase.auth.onAuthStateChange((_event, session) => { setSession(session); });
  }, []);

  if (loading) return (
    <div style={{ background: "#0a0a0f", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <p style={{ color: "#555", fontFamily: "sans-serif" }}>Carregando...</p>
    </div>
  );

  if (!session) return <AuthScreen onLogin={(user, name) => { setSession({ user }); setUserName(name); }} />;
  return <AppMain user={session.user} userName={userName} />;
}
