"use client";

import { createContext, useContext, useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";

type AvatarContextType = {
  avatarUrl: string | null;
  setAvatarUrl: (url: string | null) => void;
};

const AvatarContext = createContext<AvatarContextType>({
  avatarUrl: null,
  setAvatarUrl: () => {},
});

export function AvatarProvider({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const fetchedForUser = useRef<string | null>(null);

  useEffect(() => {
    const userId = session?.user?.id;
    if (userId && userId !== fetchedForUser.current) {
      // Reset avatar when user changes to prevent showing stale data
      setAvatarUrl(null);
      fetchedForUser.current = userId;

      fetch("/api/upload/avatar")
        .then((res) => res.json())
        .then((data) => {
          if (data.image) setAvatarUrl(data.image);
        })
        .catch(() => {});
    }

    // Clear when logged out
    if (!userId) {
      fetchedForUser.current = null;
      setAvatarUrl(null);
    }
  }, [session?.user?.id]);

  return (
    <AvatarContext.Provider value={{ avatarUrl, setAvatarUrl }}>
      {children}
    </AvatarContext.Provider>
  );
}

export function useAvatar() {
  return useContext(AvatarContext);
}
