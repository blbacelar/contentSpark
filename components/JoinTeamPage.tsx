import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTeam } from '../context/TeamContext';
import { joinTeamByCode } from '../services/teams';
import { Button } from './ui/button';
import { Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';

export default function JoinTeamPage() {
    const { code } = useParams<{ code: string }>();
    const { user, session, loading: authLoading, refreshProfile } = useAuth();
    const { refreshTeams, switchTeam } = useTeam();
    const navigate = useNavigate();

    const [status, setStatus] = useState<'checking' | 'joining' | 'success' | 'error'>('checking');
    const [teamName, setTeamName] = useState<string>('');
    const [errorMsg, setErrorMsg] = useState<string>('');

    useEffect(() => {
        if (authLoading) return;

        if (!user || !session) {
            // Redirect or wait
            return;
        }

        if (!code) {
            setStatus('error');
            setErrorMsg("Invalid invitation link.");
            return;
        }

        handleJoin();
    }, [user, session, authLoading, code]);

    const handleJoin = async () => {
        if (!user || !session?.access_token || !code) return;
        setStatus('joining');

        const result = await joinTeamByCode(code, user.id, session.access_token);

        if (result.success && result.team) {
            setTeamName(result.team.name);
            setStatus('success');

            // Refresh global state
            await Promise.all([
                refreshTeams(),
                refreshProfile()
            ]);

            // Switch to new team context
            switchTeam(result.team.id);

            // Redirect after delay
            setTimeout(() => {
                navigate('/app');
            }, 2000);
        } else {
            setStatus('error');
            setErrorMsg(result.error || "Failed to join team.");
        }
    };

    if (authLoading) {
        return (
            <div className="flex h-screen items-center justify-center bg-[#F2F2F2]">
                <Loader2 className="animate-spin text-[#FFDA47] w-8 h-8" />
            </div>
        );
    }

    return (
        <div className="flex h-screen w-screen items-center justify-center bg-[#F2F2F2] p-4">
            <div className="bg-white rounded-[32px] shadow-xl p-8 max-w-md w-full text-center space-y-6 animate-scale-in">

                {status === 'joining' && (
                    <>
                        <Loader2 className="w-12 h-12 text-[#FFDA47] animate-spin mx-auto" />
                        <h2 className="text-xl font-bold text-[#1A1A1A]">Joining Team...</h2>
                        <p className="text-gray-500">Please wait while we add you to the team.</p>
                    </>
                )}

                {status === 'success' && (
                    <>
                        <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                            <CheckCircle2 size={32} />
                        </div>
                        <h2 className="text-2xl font-bold text-[#1A1A1A]">Welcome to {teamName}!</h2>
                        <p className="text-gray-500">You have successfully joined the team.</p>
                        <Button onClick={() => navigate('/app')} className="w-full mt-4">
                            Go to Dashboard
                        </Button>
                    </>
                )}

                {status === 'error' && (
                    <>
                        <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
                            <AlertCircle size={32} />
                        </div>
                        <h2 className="text-xl font-bold text-[#1A1A1A]">Unable to Join</h2>
                        <p className="text-gray-500">{errorMsg}</p>
                        <Button variant="outline" onClick={() => navigate('/app')} className="w-full mt-4">
                            Back to Dashboard
                        </Button>
                    </>
                )}
            </div>
        </div>
    );
}
