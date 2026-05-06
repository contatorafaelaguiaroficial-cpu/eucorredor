import { useState } from "react";

function AuthScreen({ onLogin }) {
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSubmit = () => {
    setError("");
    if (mode === "register" && !form.name.trim()) return setError("Informe seu nome.");
    if (!form.email.includes("@")) return setError("E-mail inválido.");
    if (form.password.length < 6) return setError("Senha com no mínimo 6 caracteres.");
    setLoading(true);
    setTimeout(() => { setLoading(false); onLogin(form.name || "Corredor"); }, 900);
  };

  return (
    <div style={{ background: "#0a0a0f", minHeight: "100vh", display: "flex", justifyContent: "center", alignItems: "center", fontFamily: "'DM Sans', sans-serif", color: "#f0f0f0" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&family=Space+Grotesk:wght@700;800&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        .auth-input { width: 100%; background: #13131a; border: 1.5px solid #1e1e2e; border-radius: 12px; padding: 14px 16px; color: #f0f0f0; font-size: 14px; font-family: inherit; outline: none; transition: border-color .2s; }
        .auth-input:focus { border-color: #e11d48; }
        .auth-input::placeholder { color: #444; }
        .auth-btn { width: 100%; background: #e11d48; color: #fff; border: none; border-radius: 12px; padding: 15px; font-size: 15px; font-weight: 700; cursor: pointer; font-family: inherit; transition: background .2s; }
        .auth-btn:hover { background: #be123c; }
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
              style={{ flex: 1, background: mode === m ? "#1e1e2e" : "none", border: "none", borderRadius: 9, padding: "9px 0", color: mode === m ? "#fff" : "#555", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit", transition: "all .2s" }}>
              {m === "login" ? "Entrar" : "Criar conta"}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {mode === "register" && (
            <input className="auth-input" placeholder="Seu nome" value={form.name} onChange={set("name")} />
          )}
          <input className="auth-input" placeholder="E-mail" type="email" value={form.email} onChange={set("email")} />
          <input className="auth-input" placeholder="Senha" type="password" value={form.password} onChange={set("password")} />
        </div>
        {error && <p style={{ color: "#e11d48", fontSize: 12, marginTop: 10 }}>{error}</p>}
        {mode === "login" && (
          <div style={{ textAlign: "right", marginTop: 10 }}>
            <button style={{ background: "none", border: "none", color: "#555", fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>Esqueci minha senha</button>
          </div>
        )}
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

const LEVELS = [
  { name: "Iniciante", min: 0, max: 4, color: "#6ee7b7", icon: "🌱" },
  { name: "Intermediário", min: 5, max: 14, color: "#60a5fa", icon: "🏃" },
  { name: "Avançado", min: 15, max: 29, color: "#f59e0b", icon: "⚡" },
  { name: "Semi-profissional", min: 30, max: 59, color: "#f97316", icon: "🔥" },
  { name: "Profissional", min: 60, max: Infinity, color: "#e11d48", icon: "🏅" },
];

const getLevel = (races) => LEVELS.find((l) => races >= l.min && races <= l.max);
const getNextLevel = (races) => LEVELS.find((l) => l.min > races);

const events = [
  { id: 1, name: "Maratona de Porto Alegre", date: "15 Jun", dist: "42km", local: "Porto Alegre, RS", km: "2,4 km de você", cat: "Maratona" },
  { id: 2, name: "Corrida das Pedras", date: "22 Jun", dist: "10km", local: "Gramado, RS", km: "38 km de você", cat: "10K" },
  { id: 3, name: "Night Run Canoas", date: "30 Jun", dist: "5km", local: "Canoas, RS", km: "12 km de você", cat: "5K" },
  { id: 4, name: "Trail da Serra Gaúcha", date: "7 Jul", dist: "21km", local: "Caxias do Sul, RS", km: "120 km de você", cat: "Trail" },
];

const hubFeed = [
  { id: 1, user: "Lucas M.", avatar: "LM", dist: "12,4 km", time: "1h02min", pace: "5'01\"/km", ago: "há 23 min", likes: 14 },
  { id: 2, user: "Ana P.", avatar: "AP", dist: "5,0 km", time: "28min", pace: "5'36\"/km", ago: "há 1h", likes: 31 },
  { id: 3, user: "Rodrigo K.", avatar: "RK", dist: "21,1 km", time: "1h55min", pace: "5'27\"/km", ago: "há 3h", likes: 57 },
];

const communityPosts = [
  { id: 1, user: "Fernanda O.", avatar: "FO", level: "Avançado", levelColor: "#f59e0b", levelIcon: "⚡", ago: "há 12 min", type: "post", text: "Primeira vez correndo 21km abaixo de 1h50! Treino longo de hoje valeu cada gota de suor. 💪", likes: 42, comments: 8 },
  { id: 2, user: "Bruno T.", avatar: "BT", level: "Intermediário", levelColor: "#60a5fa", levelIcon: "🏃", ago: "há 1h", type: "run", dist: "8,2 km", time: "45min", pace: "5'29\"/km", text: "Treino matinal antes do trabalho. Quem mais acorda cedo para correr? ☀️", likes: 19, comments: 4 },
  { id: 3, user: "Carla M.", avatar: "CM", level: "Semi-profissional", levelColor: "#f97316", levelIcon: "🔥", ago: "há 2h", type: "post", text: "Dica de hoje: não subestime o alongamento pós-treino. Passei semanas ignorando e paguei caro. Agora faço 15 minutos todo dia e a diferença é enorme.", likes: 88, comments: 21 },
  { id: 4, user: "Rafael S.", avatar: "RS", level: "Iniciante", levelColor: "#6ee7b7", levelIcon: "🌱", ago: "há 4h", type: "run", dist: "3,1 km", time: "22min", pace: "7'05\"/km", text: "Primeira semana correndo! Estou no início, mas não vou parar. 🌱", likes: 134, comments: 37 },
];

const suggestedUsers = [
  { id: 1, name: "Julia R.", avatar: "JR", level: "Profissional", levelColor: "#e11d48", levelIcon: "🏅", races: 73, mutuals: 3 },
  { id: 2, name: "Pedro A.", avatar: "PA", level: "Avançado", levelColor: "#f59e0b", levelIcon: "⚡", races: 22, mutuals: 1 },
  { id: 3, name: "Camila W.", avatar: "CW", level: "Intermediário", levelColor: "#60a5fa", levelIcon: "🏃", races: 11, mutuals: 5 },
];

const myRaces = 7;
const myFollowers = 48;
const myFollowing = 31;

function AppMain({ userName }) {
  const [tab, setTab] = useState("eventos");
  const [liked, setLiked] = useState({});
  const [communityLiked, setCommunityLiked] = useState({});
  const [following, setFollowing] = useState({});
  const [communityTab, setCommunityTab] = useState("feed");
  const [profileTab, setProfileTab] = useState("stats");

  const level = getLevel(myRaces);
  const next = getNextLevel(myRaces);
  const progress = next ? ((myRaces - level.min) / (next.min - level.min)) * 100 : 100;
  const followingCount = myFollowing + Object.values(following).filter(Boolean).length;

  return (
    <div style={{ background: "#0a0a0f", minHeight: "100vh", fontFamily: "'DM Sans', sans-serif", color: "#f0f0f0", display: "flex", justifyContent: "center" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&family=Space+Grotesk:wght@700;800&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { display: none; }
        .event-card { background: #13131a; border-radius: 16px; padding: 16px; border: 1px solid #1e1e2e; transition: border-color .2s; cursor: pointer; }
        .event-card:hover { border-color: #e11d48; }
        .card { background: #13131a; border-radius: 16px; padding: 18px; border: 1px solid #1e1e2e; }
        .like-btn { background: none; border: none; cursor: pointer; display: flex; align-items: center; gap: 6px; color: #666; font-size: 13px; transition: color .2s; padding: 0; font-family: inherit; }
        .like-btn:hover { color: #e11d48; }
        .stat-box { background: #1a1a24; border-radius: 12px; padding: 12px 16px; flex: 1; text-align: center; }
        .join-btn { background: #e11d48; color: #fff; border: none; border-radius: 10px; padding: 8px 16px; font-size: 12px; font-weight: 700; cursor: pointer; font-family: inherit; }
        .badge { border-radius: 6px; padding: 3px 9px; font-size: 11px; font-weight: 700; }
        .follow-btn { border: 1.5px solid #e11d48; color: #e11d48; background: none; border-radius: 20px; padding: 5px 14px; font-size: 12px; font-weight: 700; cursor: pointer; font-family: inherit; transition: all .2s; }
        .sub-tab { background: none; border: none; cursor: pointer; font-family: inherit; font-size: 13px; font-weight: 700; padding: 8px 16px; border-radius: 20px; transition: all .2s; }
        .profile-stat-btn { background: none; border: none; cursor: pointer; text-align: center; font-family: inherit; transition: opacity .2s; }
        .bottom-nav { position: fixed; bottom: 0; left: 50%; transform: translateX(-50%); width: 100%; max-width: 390px; background: rgba(10,10,15,0.96); backdrop-filter: blur(12px); border-top: 1px solid #1e1e2e; display: flex; justify-content: space-around; padding: 10px 0 22px; z-index: 100; }
        .nav-btn { background: none; border: none; cursor: pointer; display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 4px 16px; font-family: inherit; transition: all .2s; }
        .nav-icon { font-size: 22px; line-height: 1; transition: transform .2s; }
        .nav-btn.active .nav-icon { transform: scale(1.15); }
        .nav-label { font-size: 10px; font-weight: 700; }
      `}</style>

      <div style={{ width: "100%", maxWidth: 390, background: "#0a0a0f", minHeight: "100vh" }}>

        <div style={{ padding: "52px 20px 16px", background: "linear-gradient(180deg, #0f0f18 0%, #0a0a0f 100%)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <p style={{ color: "#555", fontSize: 12, marginBottom: 2 }}>Bom dia, {userName.split(" ")[0]} 👋</p>
              <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 22, fontWeight: 800, color: "#fff" }}>
                eu<span style={{ color: "#e11d48" }}>corredor</span>
              </h1>
            </div>
            <div style={{ width: 40, height: 40, borderRadius: "50%", background: "linear-gradient(135deg, #e11d48, #f97316)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>
              {level.icon}
            </div>
          </div>
          <div style={{ marginTop: 16, background: "#13131a", borderRadius: 12, padding: "10px 14px", border: "1px solid #1e1e2e" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <span style={{ fontSize: 12, color: level.color, fontWeight: 700 }}>{level.icon} {level.name}</span>
              {next && <span style={{ fontSize: 11, color: "#555" }}>{myRaces}/{next.min} corridas → {next.name}</span>}
            </div>
            <div style={{ background: "#1e1e2e", borderRadius: 99, height: 5 }}>
              <div style={{ background: level.color, width: `${progress}%`, height: 5, borderRadius: 99 }} />
            </div>
          </div>
        </div>

        <nav className="bottom-nav">
          {[
            { id: "eventos", label: "Eventos", icon: "📅" },
            { id: "comunidade", label: "Comunidade", icon: "🤝" },
            { id: "hub", label: "Hub", icon: "⚡" },
            { id: "perfil", label: "Perfil", icon: "👤" },
          ].map((t) => (
            <button key={t.id} className={`nav-btn${tab === t.id ? " active" : ""}`} onClick={() => setTab(t.id)}>
              <span className="nav-icon">{t.icon}</span>
              <span className="nav-label" style={{ color: tab === t.id ? "#e11d48" : "#555" }}>{t.label}</span>
              {tab === t.id && <div style={{ width: 4, height: 4, borderRadius: "50%", background: "#e11d48", marginTop: 1 }} />}
            </button>
          ))}
        </nav>

        <div style={{ padding: "20px", paddingBottom: 90 }}>

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
                    <span className="badge" style={{ background: "#1e1e2e", color: "#999", marginLeft: 8, flexShrink: 0 }}>{e.cat}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ display: "flex", gap: 10 }}>
                      <span style={{ fontSize: 12, color: "#e11d48", fontWeight: 700 }}>📅 {e.date}</span>
                      <span style={{ fontSize: 12, color: "#888" }}>🏃 {e.dist}</span>
                      <span style={{ fontSize: 12, color: "#555" }}>{e.km}</span>
                    </div>
                    <button className="join-btn">Inscrever</button>
                  </div>
                </div>
              ))}
            </div>
          )}

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
                  {communityPosts.map((p) => (
                    <div key={p.id} className="card">
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div style={{ width: 38, height: 38, borderRadius: "50%", background: "#1e1e2e", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: "#fff", border: `2px solid ${p.levelColor}`, flexShrink: 0 }}>
                            {p.avatar}
                          </div>
                          <div>
                            <p style={{ fontWeight: 700, fontSize: 14 }}>{p.user}</p>
                            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                              <span style={{ fontSize: 10, color: p.levelColor, fontWeight: 700 }}>{p.levelIcon} {p.level}</span>
                              <span style={{ fontSize: 10, color: "#444" }}>· {p.ago}</span>
                            </div>
                          </div>
                        </div>
                        <button className="follow-btn"
                          onClick={() => setFollowing(f => ({ ...f, [p.id]: !f[p.id] }))}
                          style={following[p.id] ? { borderColor: "#555", color: "#555" } : {}}>
                          {following[p.id] ? "Seguindo" : "Seguir"}
                        </button>
                      </div>
                      {p.type === "run" && (
                        <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
                          {[{ v: p.dist, l: "distância" }, { v: p.time, l: "tempo" }, { v: p.pace, l: "pace" }].map((s, i) => (
                            <div key={i} className="stat-box" style={{ padding: "8px 10px" }}>
                              <p style={{ fontSize: 14, fontWeight: 700, color: i === 0 ? "#e11d48" : "#f0f0f0" }}>{s.v}</p>
                              <p style={{ fontSize: 9, color: "#555", marginTop: 1 }}>{s.l}</p>
                            </div>
                          ))}
                        </div>
                      )}
                      <p style={{ fontSize: 13, color: "#ccc", lineHeight: 1.55, marginBottom: 12 }}>{p.text}</p>
                      <div style={{ display: "flex", gap: 18, borderTop: "1px solid #1e1e2e", paddingTop: 10 }}>
                        <button className="like-btn" onClick={() => setCommunityLiked(l => ({ ...l, [p.id]: !l[p.id] }))}
                          style={{ color: communityLiked[p.id] ? "#e11d48" : "#555" }}>
                          <span style={{ fontSize: 15 }}>{communityLiked[p.id] ? "❤️" : "🤍"}</span>
                          <span>{p.likes + (communityLiked[p.id] ? 1 : 0)}</span>
                        </button>
                        <button className="like-btn"><span style={{ fontSize: 15 }}>💬</span><span>{p.comments}</span></button>
                        <button className="like-btn"><span style={{ fontSize: 15 }}>↗️</span><span>Compartilhar</span></button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {communityTab === "pessoas" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <p style={{ fontSize: 12, color: "#555", marginBottom: 2 }}>Sugestões para você</p>
                  {suggestedUsers.map((u) => (
                    <div key={u.id} className="card" style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <div style={{ width: 44, height: 44, borderRadius: "50%", background: "#1e1e2e", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: "#fff", border: `2px solid ${u.levelColor}`, flexShrink: 0 }}>
                        {u.avatar}
                      </div>
                      <div style={{ flex: 1 }}>
                        <p style={{ fontWeight: 700, fontSize: 14 }}>{u.name}</p>
                        <p style={{ fontSize: 11, color: u.levelColor, fontWeight: 700 }}>{u.levelIcon} {u.level}</p>
                        <p style={{ fontSize: 10, color: "#444", marginTop: 2 }}>{u.races} corridas · {u.mutuals} em comum</p>
                      </div>
                      <button className="follow-btn"
                        onClick={() => setFollowing(f => ({ ...f, [`u${u.id}`]: !f[`u${u.id}`] }))}
                        style={following[`u${u.id}`] ? { borderColor: "#555", color: "#555" } : {}}>
                        {following[`u${u.id}`] ? "Seguindo" : "Seguir"}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === "hub" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                <h2 style={{ fontSize: 16, fontWeight: 700 }}>Atividades recentes</h2>
                <button style={{ background: "#e11d48", border: "none", color: "#fff", borderRadius: 8, padding: "6px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>+ Registrar</button>
              </div>
              {hubFeed.map((f) => (
                <div key={f.id} className="card">
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                    <div style={{ width: 36, height: 36, borderRadius: "50%", background: "linear-gradient(135deg, #e11d48, #f97316)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: "#fff", flexShrink: 0 }}>
                      {f.avatar}
                    </div>
                    <div>
                      <p style={{ fontWeight: 700, fontSize: 14 }}>{f.user}</p>
                      <p style={{ fontSize: 11, color: "#555" }}>{f.ago}</p>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
                    <div className="stat-box">
                      <p style={{ fontSize: 18, fontWeight: 700, color: "#e11d48" }}>{f.dist}</p>
                      <p style={{ fontSize: 10, color: "#555", marginTop: 2 }}>distância</p>
                    </div>
                    <div className="stat-box">
                      <p style={{ fontSize: 18, fontWeight: 700 }}>{f.time}</p>
                      <p style={{ fontSize: 10, color: "#555", marginTop: 2 }}>tempo</p>
                    </div>
                    <div className="stat-box">
                      <p style={{ fontSize: 18, fontWeight: 700 }}>{f.pace}</p>
                      <p style={{ fontSize: 10, color: "#555", marginTop: 2 }}>pace</p>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 16 }}>
                    <button className="like-btn" onClick={() => setLiked(p => ({ ...p, [f.id]: !p[f.id] }))} style={{ color: liked[f.id] ? "#e11d48" : "#555" }}>
                      <span style={{ fontSize: 16 }}>{liked[f.id] ? "❤️" : "🤍"}</span>
                      <span>{f.likes + (liked[f.id] ? 1 : 0)}</span>
                    </button>
                    <button className="like-btn">💬 Comentar</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {tab === "perfil" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14, paddingTop: 8 }}>
                <div style={{ width: 72, height: 72, borderRadius: "50%", background: "linear-gradient(135deg, #e11d48, #f97316)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, border: "3px solid #1e1e2e" }}>
                  {level.icon}
                </div>
                <div style={{ textAlign: "center" }}>
                  <p style={{ fontWeight: 700, fontSize: 18 }}>{userName}</p>
                  <p style={{ fontSize: 13, color: level.color, fontWeight: 700, marginTop: 2 }}>{level.name}</p>
                </div>
                <div style={{ display: "flex", gap: 0, background: "#13131a", borderRadius: 14, border: "1px solid #1e1e2e", overflow: "hidden", width: "100%" }}>
                  {[
                    { label: "seguidores", value: myFollowers, id: "seguidores" },
                    { label: "seguindo", value: followingCount, id: "seguindo" },
                    { label: "corridas", value: myRaces, id: "stats" },
                  ].map((s, i) => (
                    <button key={s.id} className="profile-stat-btn" onClick={() => setProfileTab(s.id)}
                      style={{ flex: 1, padding: "14px 8px", borderRight: i < 2 ? "1px solid #1e1e2e" : "none", color: profileTab === s.id ? "#fff" : "#888" }}>
                      <p style={{ fontSize: 20, fontWeight: 700, color: profileTab === s.id ? "#e11d48" : "#f0f0f0" }}>{s.value}</p>
                      <p style={{ fontSize: 10, marginTop: 2 }}>{s.label}</p>
                    </button>
                  ))}
                </div>
              </div>

              {profileTab === "stats" && (
                <>
                  <div style={{ display: "flex", gap: 8 }}>
                    <div className="stat-box">
                      <p style={{ fontSize: 22, fontWeight: 700, color: "#e11d48" }}>84 km</p>
                      <p style={{ fontSize: 11, color: "#555", marginTop: 2 }}>total</p>
                    </div>
                    <div className="stat-box">
                      <p style={{ fontSize: 22, fontWeight: 700 }}>5'18"</p>
                      <p style={{ fontSize: 11, color: "#555", marginTop: 2 }}>pace médio</p>
                    </div>
                  </div>
                  <div style={{ background: "#13131a", borderRadius: 16, padding: 16, border: "1px solid #1e1e2e" }}>
                    <p style={{ fontWeight: 700, fontSize: 14, marginBottom: 14 }}>Jornada de níveis</p>
                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                      {LEVELS.map((l, i) => {
                        const isActive = l.name === level.name;
                        const isPast = myRaces > l.max;
                        return (
                          <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, opacity: !isActive && !isPast ? 0.3 : 1 }}>
                            <span style={{ fontSize: 20, width: 28, textAlign: "center" }}>{l.icon}</span>
                            <div style={{ flex: 1 }}>
                              <div style={{ display: "flex", justifyContent: "space-between" }}>
                                <span style={{ fontSize: 13, fontWeight: 700, color: isActive ? l.color : isPast ? "#555" : "#333" }}>{l.name}</span>
                                <span style={{ fontSize: 11, color: "#444" }}>{l.min === 0 ? `0–${l.max}` : l.max === Infinity ? `${l.min}+` : `${l.min}–${l.max}`} corridas</span>
                              </div>
                              <div style={{ background: "#1e1e2e", borderRadius: 99, height: 4, marginTop: 5 }}>
                                <div style={{ background: l.color, width: isPast ? "100%" : isActive ? `${progress}%` : "0%", height: 4, borderRadius: 99 }} />
                              </div>
                            </div>
                            {(isPast || isActive) && <span style={{ fontSize: 14 }}>{isPast ? "✅" : "▶"}</span>}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  {next && (
                    <div style={{ background: "#13131a", borderRadius: 12, padding: "12px 16px", border: "1px solid #1e1e2e", textAlign: "center" }}>
                      <p style={{ fontSize: 12, color: "#555" }}>Faltam <span style={{ color: "#f0f0f0", fontWeight: 700 }}>{next.min - myRaces} corridas</span> para {next.name} {next.icon}</p>
                    </div>
                  )}
                </>
              )}

              {(profileTab === "seguidores" || profileTab === "seguindo") && (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <p style={{ fontSize: 12, color: "#555" }}>{profileTab === "seguidores" ? "Quem te segue" : "Quem você segue"}</p>
                  {(profileTab === "seguindo" ? [...suggestedUsers].reverse() : suggestedUsers).map((u) => (
                    <div key={u.id} className="card" style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <div style={{ width: 44, height: 44, borderRadius: "50%", background: "#1e1e2e", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, border: `2px solid ${u.levelColor}`, flexShrink: 0 }}>
                        {u.avatar}
                      </div>
                      <div style={{ flex: 1 }}>
                        <p style={{ fontWeight: 700, fontSize: 14 }}>{u.name}</p>
                        <p style={{ fontSize: 11, color: u.levelColor, fontWeight: 700 }}>{u.levelIcon} {u.level}</p>
                        <p style={{ fontSize: 10, color: "#444", marginTop: 2 }}>{u.races} corridas</p>
                      </div>
                      <button className="follow-btn"
                        onClick={() => setFollowing(f => ({ ...f, [`u${u.id}`]: !f[`u${u.id}`] }))}
                        style={following[`u${u.id}`] ? { borderColor: "#555", color: "#555" } : {}}>
                        {following[`u${u.id}`] ? "Seguindo" : "Seguir"}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [authed, setAuthed] = useState(false);
  const [userName, setUserName] = useState("");

  if (!authed) {
    return <AuthScreen onLogin={(name) => { setUserName(name); setAuthed(true); }} />;
  }
  return <AppMain userName={userName} />;
}
