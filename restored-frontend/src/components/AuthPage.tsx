import React, { useState } from 'react';
import { User, KeyRound, Eye, EyeOff, AlertCircle, Loader2 } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

type TabType = 'login' | 'register';

export function AuthPage() {
  const { login, register } = useAuth();

  const [activeTab, setActiveTab] = useState<TabType>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // 基本验证
    if (!username.trim()) {
      setError('请输入用户名');
      return;
    }

    if (!password) {
      setError('请输入密码');
      return;
    }

    if (activeTab === 'register') {
      if (password !== confirmPassword) {
        setError('两次输入的密码不一致');
        return;
      }
    }

    setLoading(true);

    try {
      if (activeTab === 'login') {
        await login(username, password);
      } else {
        await register(username, password);
      }
    } catch (err: any) {
      setError(err.message || '操作失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  const switchTab = (tab: TabType) => {
    setActiveTab(tab);
    setError('');
    setPassword('');
    setConfirmPassword('');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-100 via-purple-50 to-blue-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-white rounded-full shadow-lg mb-4">
            <span className="text-4xl">🐱</span>
          </div>
          <h1 className="text-3xl font-black text-slate-800">班级宠物园</h1>
          <p className="text-slate-500 mt-2">让学习变得更有趣</p>
        </div>

        {/* Auth Card */}
        <div className="bg-white rounded-3xl shadow-xl overflow-hidden">
          {/* Tabs */}
          <div className="flex border-b border-slate-100">
            <button
              onClick={() => switchTab('login')}
              className={`flex-1 py-4 text-center font-bold transition-colors ${
                activeTab === 'login'
                  ? 'text-pink-600 border-b-2 border-pink-500 bg-pink-50/50'
                  : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              登录
            </button>
            <button
              onClick={() => switchTab('register')}
              className={`flex-1 py-4 text-center font-bold transition-colors ${
                activeTab === 'register'
                  ? 'text-pink-600 border-b-2 border-pink-500 bg-pink-50/50'
                  : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              注册
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-6 space-y-5">
            {/* Error Message */}
            {error && (
              <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-100 rounded-xl text-red-700">
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                <p className="text-sm font-medium">{error}</p>
              </div>
            )}

            {/* Username */}
            <div className="space-y-2">
              <label className="block text-sm font-bold text-slate-700">用户名</label>
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                  <User size={20} />
                </div>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="请输入用户名"
                  className="w-full pl-12 pr-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-pink-500 focus:border-pink-500 outline-none transition-all"
                  disabled={loading}
                  autoComplete="username"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  enterKeyHint={activeTab === 'login' ? 'next' : 'next'}
                />
              </div>
              {activeTab === 'register' && (
                <p className="text-xs text-slate-400 leading-relaxed">
                  💡 这是您的登录账号，请牢记！<br />
                  • 至少6个字符<br />
                  • 只能使用字母、数字、下划线<br />
                  • 注册后无法修改
                </p>
              )}
            </div>

            {/* Password */}
            <div className="space-y-2">
              <label className="block text-sm font-bold text-slate-700">密码</label>
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                  <KeyRound size={20} />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="请输入密码"
                  className="w-full pl-12 pr-12 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-pink-500 focus:border-pink-500 outline-none transition-all"
                  disabled={loading}
                  autoComplete={activeTab === 'login' ? 'current-password' : 'new-password'}
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  enterKeyHint={activeTab === 'login' ? 'done' : 'next'}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
              {activeTab === 'register' && (
                <p className="text-xs text-slate-400 leading-relaxed">
                  💡 这是您的登录密码<br />
                  • 至少6个字符<br />
                  • 建议字母+数字组合更安全
                </p>
              )}
            </div>

            {/* Confirm Password (Register only) */}
            {activeTab === 'register' && (
              <div className="space-y-2">
                <label className="block text-sm font-bold text-slate-700">确认密码</label>
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                    <KeyRound size={20} />
                  </div>
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="请再次输入密码"
                    className="w-full pl-12 pr-12 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-pink-500 focus:border-pink-500 outline-none transition-all"
                    disabled={loading}
                    autoComplete="new-password"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    enterKeyHint="done"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    tabIndex={-1}
                  >
                    {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
                <p className="text-xs text-slate-400">
                  💡 请再次输入密码，确保没有输错
                </p>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-gradient-to-r from-pink-500 to-rose-500 text-white font-bold rounded-xl shadow-lg shadow-pink-200 hover:shadow-xl hover:scale-[1.02] transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  处理中...
                </>
              ) : (
                activeTab === 'login' ? '立即登录' : '立即注册'
              )}
            </button>

            {/* Forgot Password (Login only) */}
            {activeTab === 'login' && (
              <div className="text-center pt-2 text-sm text-slate-400">
                忘记密码请联系管理员重置
              </div>
            )}
          </form>
        </div>

        {/* Footer */}
        <p className="text-center text-sm text-slate-400 mt-6">
          {activeTab === 'login' ? '还没有账号？' : '已有账号？'}
          <button
            onClick={() => switchTab(activeTab === 'login' ? 'register' : 'login')}
            className="text-pink-600 font-bold ml-1 hover:underline"
          >
            {activeTab === 'login' ? '立即注册' : '立即登录'}
          </button>
        </p>
      </div>

    </div>
  );
}
