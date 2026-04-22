import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { useNavigate } from 'react-router-dom';
import { Lock, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';

export default function UpdatePassword() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { user, loading: authLoading } = useAuth();
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    // Track if we gave up waiting for session
    const [timeoutReached, setTimeoutReached] = useState(false);

    useEffect(() => {
        // Timer to separate "Waiting" from "Failed"
        // Supabase might take a second to process the hash and set the session
        const timer = setTimeout(() => {
            if (!user) {
                setTimeoutReached(true);
            }
        }, 3000);

        return () => clearTimeout(timer);
    }, [user]);

    // Show processing if:
    // 1. AuthContext is loading
    // 2. We don't have a user yet, but we haven't timed out (grace period for hash processing)
    const isProcessingSession = authLoading || (!user && !timeoutReached);

    const handleUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const { error } = await supabase.auth.updateUser({
                password: password
            });

            if (error) throw error;

            setSuccess(true);

            // Standard flow: Sign out after password change and ask user to login again
            setTimeout(async () => {
                await supabase.auth.signOut();
                navigate('/login', {
                    state: { message: t('auth.password_updated_login', { defaultValue: 'Password updated! Please log in.' }) }
                });
            }, 2000);

        } catch (err: any) {
            console.error("Update password failed:", err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    if (isProcessingSession) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-[#F2F2F2] gap-4">
                <Loader2 className="w-8 h-8 animate-spin text-[#FFDA47]" />
                <p className="text-gray-500 font-medium text-sm">Verifying reset link...</p>
            </div>
        );
    }

    // If we're done processing and still no user, the link is dead.
    if (!user) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#F2F2F2] p-4">
                <div className="bg-white p-8 rounded-[32px] shadow-xl max-w-sm w-full text-center border border-white">
                    <div className="bg-red-50 p-4 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-6">
                        <AlertCircle className="w-8 h-8 text-red-500" />
                    </div>
                    <h2 className="text-xl font-bold text-[#1A1A1A] mb-2">Link Expired or Invalid</h2>
                    <p className="text-gray-500 text-sm mb-8 leading-relaxed">
                        We couldn't verify your session. The link might have expired or was already used.
                    </p>
                    <button
                        onClick={() => navigate('/login')}
                        className="w-full bg-[#1A1A1A] text-white py-4 rounded-xl font-bold hover:bg-black hover:scale-[1.02] transition-all"
                    >
                        Back to Login
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#F2F2F2] flex items-center justify-center p-4">
            <div className="bg-white rounded-[32px] w-full max-w-md shadow-2xl overflow-hidden animate-scale-in border border-white p-8">

                <div className="flex flex-col items-center mb-8">
                    <div className="bg-[#1A1A1A] p-3 rounded-2xl shadow-lg shadow-black/10 mb-4">
                        <Lock className="w-8 h-8 text-[#FFE566] fill-[#FFE566]" />
                    </div>
                    <h1 className="text-2xl font-bold text-[#1A1A1A] tracking-tight">
                        {t('auth.update_password', { defaultValue: 'Set New Password' })}
                    </h1>
                    <p className="text-gray-400 text-sm mt-1 font-medium text-center">
                        {t('auth.update_password_desc', { defaultValue: 'Please enter a new password for your account.' })}
                    </p>
                </div>

                {error && (
                    <div className="bg-red-50 text-red-600 px-4 py-3 rounded-xl text-xs font-bold mb-6 border border-red-100 flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 mt-0.5" />
                        {error}
                    </div>
                )}

                {success && (
                    <div className="bg-green-50 text-green-700 px-4 py-4 rounded-xl text-sm font-medium mb-6 border border-green-100 flex items-start gap-3">
                        <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-green-600" />
                        <div>
                            Password updated successfully! <br />
                            <span className="text-xs opacity-75">Redirecting to login...</span>
                        </div>
                    </div>
                )}

                {!success && (
                    <form onSubmit={handleUpdate} className="space-y-4">
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider pl-2">New Password</label>
                            <div className="relative group">
                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-[#1A1A1A] transition-colors" />
                                <input
                                    type="password"
                                    required
                                    minLength={6}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full bg-gray-50 border-2 border-transparent focus:border-[#FFDA47] focus:bg-white rounded-xl pl-11 pr-4 py-3.5 text-[#1A1A1A] font-medium placeholder-gray-300 outline-none transition-all"
                                    placeholder="Enter new password"
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full mt-2 bg-[#FFDA47] text-[#1A1A1A] py-4 rounded-xl font-bold text-base hover:bg-[#FFC040] hover:scale-[1.02] hover:shadow-lg hover:shadow-yellow-400/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                        >
                            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Update Password"}
                        </button>
                    </form>
                )}
            </div>
        </div>
    );
}
