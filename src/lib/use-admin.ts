import { useEffect, useState } from "react";
import { supabase } from "./supabase";

type AdminState = {
  readonly isAdmin: boolean;
  readonly isLoading: boolean;
  readonly user: { readonly id: string; readonly email: string } | null;
};

export const useAdmin = (): AdminState => {
  const [state, setState] = useState<AdminState>({
    isAdmin: false,
    isLoading: true,
    user: null,
  });

  useEffect(() => {
    const controller = new AbortController();

    (async () => {
      const { data, error } = await supabase.auth.getUser();
      if (controller.signal.aborted) return;

      if (
        error !== null ||
        data.user === null ||
        data.user.email === undefined
      ) {
        setState({ isAdmin: false, isLoading: false, user: null });
        return;
      }

      const email = data.user.email;
      const user = { id: data.user.id, email };

      const { data: adminRow, error: adminError } = await supabase
        .from("admin_users")
        .select("email")
        .eq("email", email)
        .maybeSingle();

      if (controller.signal.aborted) return;

      if (adminError !== null) {
        setState({ isAdmin: false, isLoading: false, user });
        return;
      }

      setState({
        isAdmin: adminRow !== null,
        isLoading: false,
        user,
      });
    })();

    return () => {
      controller.abort();
    };
  }, []);

  return state;
};
