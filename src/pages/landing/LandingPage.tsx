import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";

export const LandingPage = () => {
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth
      .getUser()
      .then(({ data }) => {
        if (data.user !== null) {
          navigate("/games");
        } else {
          navigate("/signin");
        }
      })
      .catch(() => {
        navigate("/signin");
      });
  }, [navigate]);

  return null;
};
