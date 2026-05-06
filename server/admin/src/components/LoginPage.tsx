import { useState, type FormEvent } from "react";
import { bgPresets, colorPresets, glassCardClasses, glassInputClasses } from "../constants/theme";
import { loadTheme, saveTheme } from "../utils/themeStorage";
import { login as apiLogin } from "../api/client";
import { setStoredToken } from "../auth/token";

type Props = {
  onLoggedIn: () => void;
};

const initialTheme = loadTheme();

export default function LoginPage({ onLoggedIn }: Props) {
  const [themeColor, setThemeColor] = useState(initialTheme.themeColor);
  const [bgIndex, setBgIndex] = useState(initialTheme.bgIndex);
  const [showThemePanel, setShowThemePanel] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const u = username.trim();
    if (!u || !password) {
      setError("请输入用户名和密码");
      return;
    }
    setLoading(true);
    try {
      const data = await apiLogin(u, password);
      setStoredToken(data.token);
      saveTheme({ themeColor, bgIndex });
      onLoggedIn();
    } catch (err) {
      setError(err instanceof Error ? err.message : "登录失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-dvh w-full overflow-x-hidden font-sans text-slate-800">
      <div className={`fixed inset-0 z-[-1] bg-gradient-to-br ${bgPresets[bgIndex].base} transition-colors duration-700`}>
        <div
          className={`absolute top-[-10%] left-[-10%] w-96 h-96 ${bgPresets[bgIndex].blob1} rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-[pulse_8s_ease-in-out_infinite] transition-colors duration-700`}
        />
        <div
          className={`absolute top-[20%] right-[-10%] w-96 h-96 ${bgPresets[bgIndex].blob2} rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-[pulse_10s_ease-in-out_infinite_reverse] transition-colors duration-700`}
        />
        <div
          className={`absolute bottom-[-20%] left-[20%] w-96 h-96 ${bgPresets[bgIndex].blob3} rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-[pulse_9s_ease-in-out_infinite] transition-colors duration-700`}
        />
      </div>

      <div className="relative z-10 flex flex-1 flex-col items-center justify-center p-4 sm:p-6">
        <div className="absolute top-6 right-6 z-50">
          <button
            type="button"
            onClick={() => setShowThemePanel(!showThemePanel)}
            className="p-2 text-slate-500 hover:text-slate-800 hover:bg-white/50 rounded-full transition-colors"
            aria-label="主题"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01"
              />
            </svg>
          </button>
          {showThemePanel && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowThemePanel(false)} aria-hidden />
              <div className="absolute top-12 right-0 w-[min(16rem,calc(100vw-2rem))] bg-white/90 backdrop-blur-2xl border border-white/60 rounded-3xl shadow-[0_10px_40px_rgba(0,0,0,0.1)] p-5 z-50 animate-fade-in-up">
                <h3 className="text-[11px] font-bold text-slate-500 mb-3 tracking-widest uppercase">背景渐变</h3>
                <div className="grid grid-cols-4 gap-2 mb-6">
                  {bgPresets.map((bg, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setBgIndex(idx)}
                      className={`h-6 rounded-full border-2 ${bgIndex === idx ? "border-slate-800 scale-110 shadow-md" : "border-transparent hover:scale-105"} bg-gradient-to-r ${bg.base} transition-all`}
                    />
                  ))}
                </div>
                <h3 className="text-[11px] font-bold text-slate-500 mb-3 tracking-widest uppercase">主题颜色</h3>
                <div className="grid grid-cols-4 gap-3">
                  {colorPresets.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setThemeColor(color)}
                      className={`w-8 h-8 rounded-full border-2 transition-all ${themeColor === color ? "border-slate-800 scale-110 shadow-md" : "border-transparent hover:scale-105"}`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                  <div
                    className={`relative w-8 h-8 rounded-full overflow-hidden border-2 transition-all cursor-pointer ${!colorPresets.includes(themeColor) ? "border-slate-800 scale-110 shadow-md" : "border-transparent hover:border-slate-400"}`}
                  >
                    <div className="absolute inset-0 bg-gradient-to-tr from-red-500 via-green-500 to-blue-500 pointer-events-none" />
                    <div className="absolute inset-1 bg-white rounded-full pointer-events-none flex items-center justify-center">
                      <div className="w-4 h-4 rounded-full" style={{ backgroundColor: themeColor }} />
                    </div>
                    <input
                      type="color"
                      value={colorPresets.includes(themeColor) ? "#ffffff" : themeColor}
                      onChange={(e) => setThemeColor(e.target.value)}
                      className="absolute inset-[-10px] w-12 h-12 opacity-0 cursor-pointer"
                    />
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        <div className={`${glassCardClasses} w-full max-w-md animate-fade-in-up`}>
          <div className="flex items-center gap-4 mb-8">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg" style={{ backgroundColor: themeColor }}>
              <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                />
              </svg>
            </div>
            <div>
              <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight">PisaAdmin</h1>
              <p className="text-sm text-slate-500 font-medium mt-0.5">请登录后继续</p>
            </div>
          </div>

          <form onSubmit={(e) => void submit(e)} className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2 ml-1">用户名</label>
              <input
                type="text"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className={glassInputClasses}
                placeholder="admin"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2 ml-1">密码</label>
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={glassInputClasses}
                placeholder="••••••••"
              />
            </div>
            {error && <p className="text-sm text-red-600 font-medium px-1">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              style={{ backgroundColor: themeColor, boxShadow: `0 10px 15px -3px ${themeColor}40` }}
              className="w-full py-3.5 rounded-2xl text-white font-bold text-sm transition-all hover:opacity-90 disabled:opacity-50"
            >
              {loading ? "登录中…" : "登录"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
