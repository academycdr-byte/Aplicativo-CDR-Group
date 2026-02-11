"use client";

import { createContext, useContext, useState, useEffect } from "react";
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
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (session?.user?.id && !loaded) {
      fetch("/api/upload/avatar")
        .then((res) => res.json())
        .then((data) => {
          if (data.image) setAvatarUrl(data.image);
          setLoaded(true);
        })
        .catch(() => setLoaded(true));
    }
  }, [session?.user?.id, loaded]);

  return (
    <AvatarContext.Provider value={{ avatarUrl, setAvatarUrl }}>
      {children}
    </AvatarContext.Provider>
  );
}

export function useAvatar() {
  return useContext(AvatarContext);
}
