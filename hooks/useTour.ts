
import { useState, useEffect } from 'react';
import { Step, CallBackProps, STATUS, EVENTS } from 'react-joyride';
import { useAuth } from '../context/AuthContext';
import { completeUserOnboarding } from '../services/genai';

export const TOUR_STEPS: Step[] = [
    {
        target: 'body',
        placement: 'center',
        content: "Welcome to ContentSpark! Let's get your content engine running in 3 simple steps.",
        disableBeacon: true,
    },
    {
        target: '#tour-team-switcher',
        content: "Manage your teams here. You can switch between workspaces or create a new team to collaborate.",
        placement: 'bottom',
        disableBeacon: true,
    },
    {
        target: '#tour-persona-card',
        content: "First, define your Audience here. The more details (Pains, Goals) you add, the better your AI ideas will be.",
        placement: 'left',
        disableBeacon: true,
    },
    {
        target: '#tour-generator-input',
        content: "Enter a topic here (e.g., 'Vegan Diet') and click Generate to see the magic happen.",
        placement: 'bottom',
        disableBeacon: true,
    },
    {
        target: '#tour-calendar',
        content: "Drag and drop your generated ideas onto the calendar to schedule your week.",
        placement: 'center',
        disableBeacon: true,
    }
];

interface UseTourProps {
    setIsFormOpen: (open: boolean) => void;
    setView: (view: any) => void;
}

export function useTour({ setIsFormOpen, setView }: UseTourProps) {
    const { user, profile, refreshProfile } = useAuth();
    const [runTour, setRunTour] = useState(false);
    const [stepIndex, setStepIndex] = useState(0);

    // Initial check
    useEffect(() => {
        if (profile && !profile.has_completed_onboarding) {
            setRunTour(true);
        }
    }, [profile]);

    const handleJoyrideCallback = async (data: CallBackProps) => {
        const { status, type, index, action } = data;

        if (status === STATUS.FINISHED || status === STATUS.SKIPPED) {
            setRunTour(false);
            setIsFormOpen(false);
            if (user) {
                await completeUserOnboarding(user.id);
                // Ensure profile is updated so we don't trigger tour again
                await refreshProfile();
            }
        } else if (type === EVENTS.STEP_AFTER && action === 'next') {
            const nextIndex = index + 1;

            if (index === 0) {
                // Step 0 -> Step 1: Both in Calendar View, just advance.
                setStepIndex(nextIndex);
            }
            else if (index === 1) {
                // Step 1 (Team Switcher) -> Step 2 (Persona).
                // Persona is in Profile Page, so switch view.
                setRunTour(false);
                // Just switch logic
                setRunTour(false);
                setView('profile');
                setTimeout(() => {
                    setStepIndex(nextIndex);
                    setRunTour(true);
                }, 500);
            }
            else if (index === 2) {
                // Step 2 (Persona) -> Step 3 (Generator).
                // Generator Input is in SparkForm (Calendar View).
                setRunTour(false);
                setView('calendar'); // Assuming 'calendar' is the view type string
                setTimeout(() => {
                    setIsFormOpen(true);
                    setTimeout(() => {
                        setStepIndex(nextIndex);
                        setRunTour(true);
                    }, 500);
                }, 100);
            }
            else {
                setStepIndex(nextIndex);
            }
        }
    };

    return {
        runTour,
        stepIndex,
        handleJoyrideCallback,
        TOUR_STEPS
    };
}
