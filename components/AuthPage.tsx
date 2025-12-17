import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '../services/supabase';
import { Zap, Mail, Lock, ArrowRight, Loader2, CheckCircle2, User } from 'lucide-react';

import { useNavigate, useLocation } from 'react-router-dom';

export default function AuthPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(location.state?.message || null);
  const [isResetMode, setIsResetMode] = useState(false);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      if (isResetMode) {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin + '/update-password'
        });
        if (error) throw error;
        setSuccessMessage(t('auth.check_email_reset'));
        return;
      }

      if (isSignUp) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              first_name: firstName,
              last_name: lastName,
            }
          }
        });

        if (error) throw error;

        // If session is created immediately, the onAuthStateChange listener in AuthContext will handle the redirect.
        if (data.session) {
          return;
        }

        // If no session returned (e.g. "Auto Confirm" is on but signUp didn't return session, or verification is required)
        // We attempt to sign in immediately to "bypass" the manual step if possible.
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password
        });

        if (signInData.session) {
          return;
        }

        // If immediate sign-in fails, it means verification is strictly enforced by Supabase settings.
        if (data.user && !data.session) {
          setSuccessMessage(t('auth.account_created'));
          setTimeout(() => {
            navigate('/');
          }, 2000);
          return;
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
      }
    } catch (err: any) {
      // If we failed during the auto-signin attempt in the signup flow, we might want to mask "Email not confirmed" error 
      // with a friendly message if the user was just created.
      if (isSignUp && err.message.includes("Email not confirmed")) {
        setSuccessMessage(t('auth.account_created'));
      } else if (err.message === "Invalid login credentials") {
        setError(t('auth.invalid_credentials'));
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F2F2F2] flex items-center justify-center p-4">
      <div className="bg-white rounded-[32px] w-full max-w-md shadow-2xl overflow-hidden animate-scale-in border border-white p-8">

        {/* Header */}
        <div className="flex flex-col items-center mb-8">
          <div className="bg-[#1A1A1A] p-3 rounded-2xl shadow-lg shadow-black/10 mb-4">
            <Zap className="w-8 h-8 text-[#FFE566] fill-[#FFE566]" />
          </div>
          <h1 className="text-2xl font-bold text-[#1A1A1A] tracking-tight">
            {t('auth.title')}
          </h1>
          <p className="text-gray-400 text-sm mt-1 font-medium">
            {t('auth.subtitle')}
          </p>
        </div>

        {/* Messages */}
        {error && (
          <div className="bg-red-50 text-red-600 px-4 py-3 rounded-xl text-xs font-bold mb-6 border border-red-100 flex items-start gap-2">
            <div className="mt-0.5 min-w-[4px] h-[4px] rounded-full bg-red-600" />
            {error}
          </div>
        )}

        {successMessage && (
          <div className="bg-green-50 text-green-700 px-4 py-4 rounded-xl text-sm font-medium mb-6 border border-green-100 flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-green-600" />
            {successMessage}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleAuth} className="space-y-4">

          {/* Name Fields for Sign Up */}
          {isSignUp && !isResetMode && (
            <div className="grid grid-cols-2 gap-4 animate-fade-in">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider pl-2">{t('auth.first_name')}</label>
                <div className="relative group">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-[#1A1A1A] transition-colors" />
                  <input
                    type="text"
                    required
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="w-full bg-gray-50 border-2 border-transparent focus:border-[#FFDA47] focus:bg-white rounded-xl pl-11 pr-3 py-3.5 text-[#1A1A1A] font-medium placeholder-gray-300 outline-none transition-all"
                    placeholder={t('auth.name_placeholder')}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider pl-2">{t('auth.last_name')}</label>
                <div className="relative group">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-[#1A1A1A] transition-colors" />
                  <input
                    type="text"
                    required
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="w-full bg-gray-50 border-2 border-transparent focus:border-[#FFDA47] focus:bg-white rounded-xl pl-11 pr-3 py-3.5 text-[#1A1A1A] font-medium placeholder-gray-300 outline-none transition-all"
                    placeholder={t('auth.surname_placeholder')}
                  />
                </div>
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider pl-2">{t('auth.email')}</label>
            <div className="relative group">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-[#1A1A1A] transition-colors" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-gray-50 border-2 border-transparent focus:border-[#FFDA47] focus:bg-white rounded-xl pl-11 pr-4 py-3.5 text-[#1A1A1A] font-medium placeholder-gray-300 outline-none transition-all"
                placeholder={t('auth.email_placeholder')}
              />
            </div>
          </div>

          {!isResetMode && (
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-wider pl-2">{t('auth.password')}</label>
              <div className="relative group">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-[#1A1A1A] transition-colors" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-gray-50 border-2 border-transparent focus:border-[#FFDA47] focus:bg-white rounded-xl pl-11 pr-4 py-3.5 text-[#1A1A1A] font-medium placeholder-gray-300 outline-none transition-all"
                  placeholder={t('auth.password_placeholder')}
                />
              </div>
            </div>
          )}

          {!isSignUp && !isResetMode && (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setIsResetMode(true);
                  setError(null);
                  setSuccessMessage(null);
                }}
                className="text-xs font-bold text-gray-500 hover:text-[#1A1A1A] hover:underline"
              >
                {t('auth.forgot_password')}
              </button>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 bg-[#FFDA47] text-[#1A1A1A] py-4 rounded-xl font-bold text-base hover:bg-[#FFC040] hover:scale-[1.02] hover:shadow-lg hover:shadow-yellow-400/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
              <>
                {isResetMode ? t('auth.reset_password') : (isSignUp ? t('auth.create_account') : t('auth.sign_in'))} <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Toggle */}
        <div className="mt-8 text-center">
          <p className="text-sm font-medium text-gray-500">
            {isResetMode ? (
              <>
                {t('auth.remember_password')}
                <button
                  onClick={() => {
                    setIsResetMode(false);
                    setIsSignUp(false);
                    setError(null);
                  }}
                  className="ml-2 text-[#1A1A1A] font-bold hover:underline decoration-[#FFDA47] decoration-2 underline-offset-2"
                >
                  {t('auth.sign_in')}
                </button>
              </>
            ) : (
              <>
                {isSignUp ? t('auth.already_have_account') : t('auth.new_to_app')}
                <button
                  onClick={() => {
                    setIsSignUp(!isSignUp);
                    setError(null);
                    setSuccessMessage(null);
                  }}
                  className="ml-2 text-[#1A1A1A] font-bold hover:underline decoration-[#FFDA47] decoration-2 underline-offset-2"
                >
                  {isSignUp ? t('auth.sign_in') : t('auth.create_account')}
                </button>
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}