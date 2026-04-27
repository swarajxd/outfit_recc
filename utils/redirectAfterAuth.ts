import { SERVER_BASE } from "../app/utils/config";

export async function checkAndRedirect(clerkId: string, router: any) {
  try {
    const res = await fetch(
      `${SERVER_BASE}/api/profile/preferences/${encodeURIComponent(clerkId)}`,
      {
        headers: {
          "x-user-id": clerkId,
        },
      },
    );

    if (!res.ok) {
      router.replace("/pref");
      return;
    }

    const json: { onboarding_complete?: boolean } = await res.json();
    if (json.onboarding_complete === true) {
      router.replace("/home");
      return;
    }

    router.replace("/pref");
  } catch {
    router.replace("/pref");
  }
}
