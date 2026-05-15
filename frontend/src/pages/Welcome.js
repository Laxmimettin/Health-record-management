import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import ThemeToggle from "../components/ThemeToggle";

const features = [
  {
    icon: "🔐",
    title: "Patient-owned access control",
    desc: "Grant, expire, or revoke doctor access in seconds. Every decision leaves a full audit trail.",
    color: "from-sky-500/15 to-sky-500/5",
    badge: "badge-sky",
  },
  {
    icon: "📁",
    title: "Secure record management",
    desc: "Upload PDFs and images with rich metadata, searchable history, and real healthcare workflows.",
    color: "from-violet-500/15 to-violet-500/5",
    badge: "badge-violet",
  },
  {
    icon: "🛡️",
    title: "Built-in threat monitoring",
    desc: "Alerts for login anomalies, suspicious access, and new device activity — before it becomes a breach.",
    color: "from-emerald-500/15 to-emerald-500/5",
    badge: "badge-green",
  },
];

const steps = [
  { num: "01", title: "Create your account",    desc: "Sign up as a patient or doctor and get a secure workspace instantly." },
  { num: "02", title: "Upload & organise",       desc: "Patients upload records with metadata. Doctors request time-bound access." },
  { num: "03", title: "Stay in full control",    desc: "Approve, expire, or revoke access at any time with one click." },
];

const stats = [
  { value: "JWT",       label: "Auth standard" },
  { value: "Role-based", label: "Access control" },
  { value: "Real-time", label: "Audit logs" },
  { value: "Zero",      label: "Data leaks" },
];

const security = [
  "JWT-protected role-based routes",
  "Timeline audit logs for every action",
  "Threat alerts for suspicious login activity",
];

export default function Welcome({ user, theme, onToggleTheme }) {
  const dashPath = user
    ? user.role === "admin"
      ? "/admin"
      : user.role === "patient"
        ? "/patient"
        : user.isVerified
          ? "/doctor"
          : "/doctor/pending"
    : "/signup";

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text-primary)] overflow-x-hidden">
      {/* Ambient orbs */}
      <div className="pointer-events-none fixed top-0 left-1/4 h-[600px] w-[600px] -translate-x-1/2 rounded-full bg-sky-500/12 blur-[140px]" />
      <div className="pointer-events-none fixed top-1/3 right-0 h-[500px] w-[500px] rounded-full bg-violet-500/10 blur-[120px]" />
      <div className="pointer-events-none fixed bottom-0 left-0 h-[400px] w-[400px] rounded-full bg-sky-500/8 blur-[100px]" />

      {/* ── NAVBAR ── */}
      <nav className="sticky top-0 z-50 glass border-b border-[var(--border)]">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 sm:px-6 py-4">
          <motion.div initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} className="flex items-center gap-3">
            <div className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-xl bg-gradient-brand text-base sm:text-lg glow-sky">🏥</div>
            <div>
              <p className="text-xs sm:text-sm font-black text-gradient">SecureHealthVault</p>
              <p className="hidden text-[10px] text-[var(--text-muted)] sm:block">Your Health Data, Your Control</p>
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} className="flex items-center gap-2">
            <ThemeToggle theme={theme} onToggle={onToggleTheme} />
            <Link to="/login" className="hidden sm:block rounded-xl btn-ghost px-4 py-2 text-sm">Sign in</Link>
            <Link to="/admin/login" className="hidden sm:block rounded-xl btn-ghost px-4 py-2 text-sm">Admin</Link>
            <Link to="/signup" className="rounded-xl btn-brand px-3 sm:px-4 py-2 text-xs sm:text-sm glow-sky">Get started →</Link>
          </motion.div>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 pb-16 pt-12 sm:pt-20 lg:pt-28">
        <div className="grid items-center gap-8 sm:gap-12 lg:grid-cols-[1.15fr_0.85fr]">
          <div>
            <motion.span
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
              className="inline-flex items-center gap-2 rounded-full border border-sky-500/30 bg-sky-500/10 px-3 sm:px-4 py-1.5 text-xs font-semibold text-sky-400"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-sky-400 animate-pulse" />
              Production-grade health record platform
            </motion.span>

            <motion.h1
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.07 }}
              className="mt-4 sm:mt-6 text-3xl sm:text-5xl lg:text-7xl font-black leading-[1.08] tracking-tight"
            >
              Your Health Data,<br />
              <span className="text-gradient">Your Control.</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.13 }}
              className="mt-4 sm:mt-6 max-w-xl text-base sm:text-lg leading-7 sm:leading-8 text-[var(--text-secondary)]"
            >
              SecureHealthVault gives patients full ownership of their medical records while letting doctors request and view data only when permission is granted.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }}
              className="mt-6 sm:mt-8 flex flex-col sm:flex-row flex-wrap gap-3"
            >
              <Link to={dashPath} className="rounded-xl btn-brand px-6 sm:px-7 py-3 sm:py-3.5 text-sm glow-sky text-center">
                {user ? "Open Dashboard →" : "Get Started Free →"}
              </Link>
              <Link to="/login" className="rounded-xl btn-ghost px-6 sm:px-7 py-3 sm:py-3.5 text-sm text-center">
                Sign in
              </Link>
            </motion.div>

            {/* Stats row */}
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.28 }}
              className="mt-8 sm:mt-10 grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4"
            >
              {stats.map((s, i) => (
                <motion.div 
                  key={i} 
                  className="card-flat px-3 sm:px-4 py-2 sm:py-3 text-center relative overflow-hidden group cursor-pointer"
                  whileHover={{ 
                    scale: 1.05, 
                    y: -4,
                    boxShadow: "0 10px 30px rgba(59, 130, 246, 0.2)"
                  }}
                  animate={{
                    y: [0, -2, 0]
                  }}
                  transition={{
                    y: {
                      duration: 2,
                      repeat: Infinity,
                      delay: i * 0.2
                    }
                  }}
                >
                  {/* Animated background on hover */}
                  <motion.div 
                    className="absolute inset-0 bg-gradient-to-r from-sky-500/10 to-violet-500/10 opacity-0 group-hover:opacity-100"
                    initial={false}
                    animate={{ 
                      background: [
                        "linear-gradient(90deg, rgba(59, 130, 246, 0.1) 0%, rgba(139, 92, 246, 0.1) 100%)",
                        "linear-gradient(90deg, rgba(139, 92, 246, 0.1) 0%, rgba(16, 185, 129, 0.1) 100%)",
                        "linear-gradient(90deg, rgba(16, 185, 129, 0.1) 0%, rgba(59, 130, 246, 0.1) 100%)"
                      ]
                    }}
                    transition={{ duration: 3, repeat: Infinity }}
                  />
                  
                  <div className="relative z-10">
                    <motion.p 
                      className="text-base sm:text-lg font-black text-gradient"
                      animate={{
                        backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"]
                      }}
                      transition={{
                        duration: 3,
                        repeat: Infinity,
                        delay: i * 0.1
                      }}
                    >
                      {s.value}
                    </motion.p>
                    <p className="mt-0.5 text-[10px] sm:text-xs text-[var(--text-muted)] group-hover:text-[var(--text-secondary)] transition-colors">
                      {s.label}
                    </p>
                    
                    {/* Progress indicator */}
                    <motion.div 
                      className="mt-1 h-0.5 bg-gradient-to-r from-sky-400 to-violet-400 rounded-full opacity-0 group-hover:opacity-100"
                      initial={{ width: 0 }}
                      whileHover={{ width: "100%" }}
                      transition={{ duration: 0.5 }}
                    />
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </div>

          {/* Hero card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.6 }}
            className="card p-6 animate-float relative overflow-hidden"
          >
            {/* Animated background gradient */}
            <div className="absolute inset-0 bg-gradient-to-br from-sky-500/5 via-violet-500/5 to-emerald-500/5 animate-pulse" />
            
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-4">
                <p className="text-xs font-semibold uppercase tracking-widest text-[var(--text-muted)]">Live Platform Status</p>
                <div className="flex items-center gap-2">
                  <motion.div 
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="h-2 w-2 rounded-full bg-emerald-400"
                  />
                  <span className="text-xs text-emerald-400 font-semibold">Online</span>
                </div>
              </div>
              
              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  { 
                    label: "Access Control", 
                    icon: "🔐", 
                    value: "Real-time", 
                    sub: "Grant, revoke, expire instantly",
                    color: "from-sky-500/20 to-sky-500/5"
                  },
                  { 
                    label: "File Security", 
                    icon: "🛡️", 
                    value: "AES-256", 
                    sub: "Military-grade encryption",
                    color: "from-emerald-500/20 to-emerald-500/5"
                  },
                  { 
                    label: "Audit Trail", 
                    icon: "📊", 
                    value: "100%", 
                    sub: "Every action logged",
                    color: "from-violet-500/20 to-violet-500/5"
                  },
                  { 
                    label: "Threat Detection", 
                    icon: "⚡", 
                    value: "Active", 
                    sub: "AI-powered monitoring",
                    color: "from-amber-500/20 to-amber-500/5"
                  },
                ].map((item, i) => (
                  <motion.div 
                    key={i} 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 + i * 0.1 }}
                    whileHover={{ scale: 1.05, y: -2 }}
                    className={`card-flat p-4 bg-gradient-to-br ${item.color} border-0 relative overflow-hidden group cursor-pointer`}
                  >
                    {/* Animated background on hover */}
                    <motion.div 
                      className="absolute inset-0 bg-gradient-to-r from-white/5 to-transparent opacity-0 group-hover:opacity-100"
                      initial={false}
                      animate={{ x: [-100, 100] }}
                      transition={{ duration: 1.5, repeat: Infinity, repeatDelay: 2 }}
                    />
                    
                    <div className="relative z-10">
                      <div className="flex items-center gap-2 mb-2">
                        <motion.span 
                          animate={{ rotate: [0, 10, -10, 0] }}
                          transition={{ duration: 2, repeat: Infinity, delay: i * 0.2 }}
                          className="text-lg"
                        >
                          {item.icon}
                        </motion.span>
                        <p className="text-[11px] text-[var(--text-muted)] font-medium">{item.label}</p>
                      </div>
                      <p className="text-lg font-black text-gradient">{item.value}</p>
                      <p className="mt-1 text-xs text-[var(--text-secondary)]">{item.sub}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
              
              {/* Animated data flow visualization */}
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.8 }}
                className="mt-4 p-3 rounded-xl bg-gradient-to-r from-sky-500/10 via-violet-500/10 to-emerald-500/10 border border-sky-500/20"
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[var(--text-muted)]">Data Flow</span>
                  <div className="flex items-center gap-1">
                    {[0, 1, 2].map((i) => (
                      <motion.div
                        key={i}
                        animate={{ 
                          scale: [1, 1.5, 1],
                          opacity: [0.3, 1, 0.3]
                        }}
                        transition={{ 
                          duration: 1.5, 
                          repeat: Infinity, 
                          delay: i * 0.2 
                        }}
                        className="h-1 w-1 rounded-full bg-sky-400"
                      />
                    ))}
                  </div>
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <motion.div 
                      animate={{ rotate: 360 }}
                      transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                      className="h-4 w-4 rounded border-2 border-sky-400 border-t-transparent"
                    />
                    <span className="text-xs font-semibold text-sky-400">Encrypting & Securing</span>
                  </div>
                  <span className="text-xs text-emerald-400 font-medium">✓ Protected</span>
                </div>
              </motion.div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 py-12 sm:py-16">
        <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} className="mb-8 sm:mb-10 text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-[var(--text-muted)]">Why SecureHealthVault</p>
          <h2 className="mt-3 text-2xl sm:text-4xl font-black">Built for <span className="text-gradient">security & trust</span></h2>
        </motion.div>
        <div className="grid gap-4 sm:gap-5 md:grid-cols-3">
          {features.map((f, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}
              whileHover={{ y: -8, scale: 1.02 }}
              className={`card bg-gradient-to-br ${f.color} p-5 sm:p-7 relative overflow-hidden group cursor-pointer`}>
              
              {/* Animated background particles */}
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500">
                {[...Array(6)].map((_, idx) => (
                  <motion.div
                    key={idx}
                    className="absolute w-1 h-1 bg-white/20 rounded-full"
                    style={{
                      left: `${Math.random() * 100}%`,
                      top: `${Math.random() * 100}%`,
                    }}
                    animate={{
                      y: [-20, -40, -20],
                      opacity: [0, 1, 0],
                    }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      delay: idx * 0.2,
                    }}
                  />
                ))}
              </div>
              
              <div className="relative z-10">
                <div className="mb-4 flex items-center justify-between">
                  <motion.span 
                    className="text-2xl sm:text-3xl"
                    whileHover={{ 
                      scale: 1.2, 
                      rotate: [0, -10, 10, 0],
                    }}
                    transition={{ duration: 0.3 }}
                  >
                    {f.icon}
                  </motion.span>
                  <motion.span 
                    className={`badge ${f.badge}`}
                    whileHover={{ scale: 1.1 }}
                    animate={{ 
                      boxShadow: [
                        "0 0 0 0 rgba(59, 130, 246, 0.4)",
                        "0 0 0 10px rgba(59, 130, 246, 0)",
                        "0 0 0 0 rgba(59, 130, 246, 0)"
                      ]
                    }}
                    transition={{ duration: 2, repeat: Infinity }}
                  >
                    Feature
                  </motion.span>
                </div>
                <h3 className="text-lg sm:text-xl font-bold">{f.title}</h3>
                <p className="mt-2 sm:mt-3 text-sm leading-6 sm:leading-7 text-[var(--text-secondary)]">{f.desc}</p>
                
                {/* Interactive demo elements */}
                <div className="mt-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  {i === 0 && ( // Patient-owned access control
                    <div className="flex items-center gap-2 text-xs">
                      <motion.div 
                        animate={{ rotate: 360 }}
                        transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                        className="h-3 w-3 border-2 border-sky-400 border-t-transparent rounded-full"
                      />
                      <span className="text-sky-400 font-medium">Access control active</span>
                    </div>
                  )}
                  {i === 1 && ( // Secure record management
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-violet-400">Files encrypted</span>
                      <motion.div 
                        animate={{ width: ["0%", "100%"] }}
                        transition={{ duration: 2, repeat: Infinity, repeatDelay: 1 }}
                        className="h-1 bg-violet-400 rounded-full"
                        style={{ width: "60px" }}
                      />
                    </div>
                  )}
                  {i === 2 && ( // Threat monitoring
                    <div className="flex items-center gap-2 text-xs">
                      <motion.div 
                        animate={{ 
                          scale: [1, 1.3, 1],
                          backgroundColor: ["#10b981", "#f59e0b", "#10b981"]
                        }}
                        transition={{ duration: 1.5, repeat: Infinity }}
                        className="h-2 w-2 rounded-full bg-emerald-400"
                      />
                      <span className="text-emerald-400 font-medium">Monitoring threats</span>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── HOW IT WORKS + SECURITY ── */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 py-12 sm:py-16">
        <div className="grid gap-6 lg:grid-cols-2">
          <motion.div 
            initial={{ opacity: 0, x: -50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="card p-5 sm:p-7 relative overflow-hidden"
          >
            {/* Animated workflow background */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-sky-500/10 to-transparent rounded-full blur-xl" />
            
            <div className="relative z-10">
              <p className="text-xs font-semibold uppercase tracking-widest text-[var(--text-muted)]">How it works</p>
              <h2 className="mt-3 text-xl sm:text-2xl font-black">Three simple steps</h2>
              <div className="mt-4 sm:mt-6 space-y-4">
                {steps.map((s, i) => (
                  <motion.div key={i} 
                    initial={{ opacity: 0, x: -16 }} 
                    whileInView={{ opacity: 1, x: 0 }} 
                    viewport={{ once: true }} 
                    transition={{ delay: i * 0.2 }}
                    whileHover={{ x: 8, scale: 1.02 }}
                    className="flex gap-3 sm:gap-4 card-flat p-3 sm:p-4 group cursor-pointer relative overflow-hidden"
                  >
                    {/* Step connector line */}
                    {i < steps.length - 1 && (
                      <motion.div 
                        className="absolute left-6 top-12 w-0.5 h-8 bg-gradient-to-b from-sky-400 to-transparent"
                        initial={{ scaleY: 0 }}
                        whileInView={{ scaleY: 1 }}
                        transition={{ delay: i * 0.2 + 0.5, duration: 0.5 }}
                      />
                    )}
                    
                    <motion.div 
                      className="flex h-8 w-8 sm:h-10 sm:w-10 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-brand text-xs font-black text-white relative z-10"
                      whileHover={{ 
                        scale: 1.1,
                        boxShadow: "0 0 20px rgba(59, 130, 246, 0.5)"
                      }}
                      animate={{
                        boxShadow: [
                          "0 0 0 0 rgba(59, 130, 246, 0.4)",
                          "0 0 0 8px rgba(59, 130, 246, 0)",
                        ]
                      }}
                      transition={{ duration: 2, repeat: Infinity, delay: i * 0.3 }}
                    >
                      {s.num}
                    </motion.div>
                    <div className="flex-1">
                      <p className="font-semibold text-sm sm:text-base group-hover:text-sky-400 transition-colors">{s.title}</p>
                      <p className="mt-1 text-xs sm:text-sm text-[var(--text-secondary)]">{s.desc}</p>
                      
                      {/* Progress indicator */}
                      <motion.div 
                        className="mt-2 h-1 bg-gradient-to-r from-sky-400 to-violet-400 rounded-full opacity-0 group-hover:opacity-100"
                        initial={{ width: 0 }}
                        whileHover={{ width: "100%" }}
                        transition={{ duration: 0.5 }}
                      />
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, x: 50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="card p-5 sm:p-7 relative overflow-hidden"
          >
            {/* Security shield animation */}
            <div className="absolute top-4 right-4">
              <motion.div
                animate={{ 
                  rotate: [0, 5, -5, 0],
                  scale: [1, 1.05, 1]
                }}
                transition={{ duration: 3, repeat: Infinity }}
                className="text-4xl opacity-10"
              >
                🛡️
              </motion.div>
            </div>
            
            <div className="relative z-10">
              <p className="text-xs font-semibold uppercase tracking-widest text-[var(--text-muted)]">Security highlights</p>
              <h2 className="mt-3 text-xl sm:text-2xl font-black">Threat-aware from day one</h2>
              <div className="mt-4 sm:mt-6 space-y-4">
                {security.map((item, i) => (
                  <motion.div key={i} 
                    initial={{ opacity: 0, x: 16 }} 
                    whileInView={{ opacity: 1, x: 0 }} 
                    viewport={{ once: true }} 
                    transition={{ delay: i * 0.15 }}
                    whileHover={{ x: -4, scale: 1.02 }}
                    className="flex items-center gap-3 card-flat p-3 sm:p-4 group cursor-pointer relative overflow-hidden"
                  >
                    {/* Security scan line effect */}
                    <motion.div 
                      className="absolute inset-0 bg-gradient-to-r from-transparent via-emerald-500/10 to-transparent opacity-0 group-hover:opacity-100"
                      animate={{ x: [-100, 300] }}
                      transition={{ duration: 1.5, repeat: Infinity, repeatDelay: 2 }}
                    />
                    
                    <motion.span 
                      className="flex h-6 w-6 sm:h-8 sm:w-8 flex-shrink-0 items-center justify-center rounded-lg bg-emerald-500/15 text-xs sm:text-sm relative z-10"
                      whileHover={{ 
                        scale: 1.2,
                        backgroundColor: "rgba(16, 185, 129, 0.3)"
                      }}
                      animate={{
                        boxShadow: [
                          "0 0 0 0 rgba(16, 185, 129, 0.4)",
                          "0 0 0 6px rgba(16, 185, 129, 0)",
                        ]
                      }}
                      transition={{ duration: 2.5, repeat: Infinity, delay: i * 0.4 }}
                    >
                      ✅
                    </motion.span>
                    <div className="flex-1">
                      <p className="text-xs sm:text-sm font-medium group-hover:text-emerald-400 transition-colors">{item}</p>
                      
                      {/* Security level indicator */}
                      <div className="mt-1 flex items-center gap-1">
                        {[...Array(3)].map((_, idx) => (
                          <motion.div
                            key={idx}
                            className="h-1 w-2 bg-emerald-400/30 rounded-full"
                            animate={{
                              backgroundColor: [
                                "rgba(16, 185, 129, 0.3)",
                                "rgba(16, 185, 129, 0.8)",
                                "rgba(16, 185, 129, 0.3)"
                              ]
                            }}
                            transition={{
                              duration: 1,
                              repeat: Infinity,
                              delay: idx * 0.2 + i * 0.1
                            }}
                          />
                        ))}
                        <span className="ml-2 text-[10px] text-emerald-400 font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                          Secured
                        </span>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 py-12 sm:py-16">
        <motion.div initial={{ opacity: 0, scale: 0.97 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }}
          className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-gradient-brand p-8 sm:p-12 text-center text-white glow-sky">
          
          {/* Animated background elements */}
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute inset-0 bg-mesh opacity-30" />
            
            {/* Floating particles */}
            {[...Array(12)].map((_, i) => (
              <motion.div
                key={i}
                className="absolute w-2 h-2 bg-white/20 rounded-full"
                style={{
                  left: `${Math.random() * 100}%`,
                  top: `${Math.random() * 100}%`,
                }}
                animate={{
                  y: [-20, -60, -20],
                  x: [0, Math.random() * 40 - 20, 0],
                  opacity: [0, 1, 0],
                  scale: [0, 1, 0],
                }}
                transition={{
                  duration: 4,
                  repeat: Infinity,
                  delay: i * 0.3,
                  ease: "easeInOut"
                }}
              />
            ))}
            
            {/* Pulsing rings */}
            <motion.div 
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
              animate={{
                scale: [1, 2, 1],
                opacity: [0.3, 0, 0.3]
              }}
              transition={{
                duration: 3,
                repeat: Infinity,
                ease: "easeInOut"
              }}
            >
              <div className="w-32 h-32 border border-white/20 rounded-full" />
            </motion.div>
            
            <motion.div 
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
              animate={{
                scale: [1, 1.8, 1],
                opacity: [0.2, 0, 0.2]
              }}
              transition={{
                duration: 3,
                repeat: Infinity,
                delay: 1,
                ease: "easeInOut"
              }}
            >
              <div className="w-48 h-48 border border-white/10 rounded-full" />
            </motion.div>
          </div>
          
          <div className="relative z-10">
            <motion.h2 
              className="text-2xl sm:text-4xl font-black"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              Take control of your health data{" "}
              <motion.span 
                className="opacity-80"
                animate={{ 
                  opacity: [0.8, 1, 0.8],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
              >
                today
              </motion.span>
            </motion.h2>
            
            <motion.p 
              className="mx-auto mt-3 sm:mt-4 max-w-lg text-sm sm:text-base opacity-80"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
            >
              Join patients and doctors already using SecureHealthVault for secure, transparent record management.
            </motion.p>
            
            {/* Animated stats */}
            <motion.div 
              className="mt-6 flex justify-center items-center gap-6 text-sm"
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.4 }}
            >
              {[
                { label: "Records Protected", value: "10K+" },
                { label: "Doctors Verified", value: "500+" },
                { label: "Zero Breaches", value: "100%" }
              ].map((stat, i) => (
                <motion.div 
                  key={i}
                  className="text-center"
                  whileHover={{ scale: 1.1 }}
                  animate={{
                    y: [0, -5, 0]
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    delay: i * 0.3
                  }}
                >
                  <div className="text-lg font-black">{stat.value}</div>
                  <div className="text-xs opacity-70">{stat.label}</div>
                </motion.div>
              ))}
            </motion.div>
            
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.6 }}
            >
              <Link to="/signup">
                <motion.button
                  className="mt-6 sm:mt-8 inline-flex items-center gap-2 rounded-xl bg-white px-6 sm:px-8 py-3 sm:py-3.5 text-sm font-bold text-sky-600 shadow-xl transition"
                  whileHover={{ 
                    scale: 1.05,
                    y: -2,
                    boxShadow: "0 20px 40px rgba(0,0,0,0.3)"
                  }}
                  whileTap={{ scale: 0.95 }}
                  animate={{
                    boxShadow: [
                      "0 10px 30px rgba(0,0,0,0.2)",
                      "0 15px 40px rgba(0,0,0,0.3)",
                      "0 10px 30px rgba(0,0,0,0.2)"
                    ]
                  }}
                  transition={{
                    boxShadow: {
                      duration: 2,
                      repeat: Infinity,
                      ease: "easeInOut"
                    }
                  }}
                >
                  <motion.span
                    animate={{ rotate: [0, 360] }}
                    transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                  >
                    🚀
                  </motion.span>
                  Create free account →
                </motion.button>
              </Link>
            </motion.div>
          </div>
        </motion.div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="border-t border-[var(--border)] py-8 text-center text-xs text-[var(--text-muted)]">
        © 2025 <span className="text-gradient font-semibold">SecureHealthVault</span> — Built with ❤️ for better healthcare
      </footer>
    </div>
  );
}
