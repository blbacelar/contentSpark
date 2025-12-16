import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Copy, RefreshCw, Check, Loader2 } from 'lucide-react';
import { useTeam } from '../context/TeamContext';
import { Team } from '../types';
import { getInviteLink } from '../services/teams';
import { toast } from 'sonner';

interface InviteMemberModalProps {
    isOpen: boolean;
    onClose: () => void;
    team: Team;
}

export default function InviteMemberModal({ isOpen, onClose, team }: InviteMemberModalProps) {
    const { t } = useTranslation();
    const { updateTeamCode } = useTeam();
    const [coppied, setCoppied] = useState(false);
    const [isRegenerating, setIsRegenerating] = useState(false);

    const inviteLink = team.invitation_code ? getInviteLink(team.invitation_code) : '';

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(inviteLink);
            setCoppied(true);
            toast.success(t('invite.copy_success') || "Link copied to clipboard!");
            setTimeout(() => setCoppied(false), 2000);
        } catch (err) {
            toast.error("Failed to copy link");
        }
    };

    const handleRegenerate = async () => {
        if (!confirm("Are you sure? Old links will stop working.")) return;

        setIsRegenerating(true);
        try {
            await updateTeamCode(team.id);
            toast.success("Invitation code updated!");
        } catch (error) {
            toast.error("Failed to regenerate code");
        } finally {
            setIsRegenerating(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>{t('invite.title', 'Invite Members')}</DialogTitle>
                    <p className="text-sm text-gray-500">
                        {t('invite.subtitle', { teamName: team.name, defaultValue: `Share this link to invite people to ${team.name}` })}
                    </p>
                </DialogHeader>

                <div className="py-4 space-y-4">
                    <div className="flex items-center gap-2">
                        <Input
                            value={inviteLink}
                            readOnly
                            className="bg-gray-50 font-mono text-sm"
                        />
                        <Button
                            variant="outline"
                            size="icon"
                            onClick={handleCopy}
                            title="Copy Link"
                            className={coppied ? "text-green-600 border-green-200 bg-green-50" : ""}
                        >
                            {coppied ? <Check size={16} /> : <Copy size={16} />}
                        </Button>
                    </div>

                    <div className="bg-blue-50 p-4 rounded-xl flex items-start gap-3 text-sm text-blue-700">
                        <div className="mt-0.5">ℹ️</div>
                        <p>
                            Any user with this link can join <strong>{team.name}</strong> as a member.
                        </p>
                    </div>

                    <div className="flex justify-between items-center pt-2">
                        <Button
                            variant="ghost"
                            size="sm"
                            className="text-gray-400 hover:text-red-500 text-xs"
                            onClick={handleRegenerate}
                            disabled={isRegenerating}
                        >
                            {isRegenerating ? <Loader2 className="animate-spin w-3 h-3 mr-1" /> : <RefreshCw className="w-3 h-3 mr-1" />}
                            Revoke & Generate New Link
                        </Button>

                        <Button onClick={onClose}>
                            Done
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
