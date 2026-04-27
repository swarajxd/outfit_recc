import { useEffect, useState } from "react";
import { SERVER_BASE } from "../app/utils/config";

type OnboardingStatusState = {
  loading: boolean;
  onboardingComplete: boolean | null;
};

export default function useOnboardingStatus(
  clerkId: string | null | undefined,
): OnboardingStatusState {
  const [state, setState] = useState<OnboardingStatusState>({
    loading: !!clerkId,
    onboardingComplete: null,
  });

  useEffect(() => {
    let cancelled = false;

    const checkStatus = async () => {
      if (!clerkId) {
        if (!cancelled) {
          setState({ loading: false, onboardingComplete: null });
        }
        return;
      }

      if (!cancelled) {
        setState({ loading: true, onboardingComplete: null });
      }

      try {
        const res = await fetch(
          `${SERVER_BASE}/api/profile/preferences/${encodeURIComponent(clerkId)}`,
          {
            headers: {
              "x-user-id": clerkId,
            },
          },
        );

        if (!res.ok) throw new Error(`Status ${res.status}`);
        const json: { onboarding_complete?: boolean } = await res.json();

        if (!cancelled) {
          setState({
            loading: false,
            onboardingComplete: json.onboarding_complete === true,
          });
        }
      } catch {
        if (!cancelled) {
          setState({ loading: false, onboardingComplete: false });
        }
      }
    };

    checkStatus();
    return () => {
      cancelled = true;
    };
  }, [clerkId]);

  return state;
}
