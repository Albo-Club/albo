import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export function useRecentSignupCount() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const fetch = async () => {
      const since = new Date(Date.now() - 86400000).toISOString();
      const { count: c } = await supabase
        .from("pipeline_logs" as any)
        .select("run_id", { count: "exact", head: true })
        .eq("pipeline", "user-signup")
        .eq("step", "signup-detected")
        .gte("created_at", since);
      if (c != null) setCount(c);
    };
    fetch();
  }, []);

  return count;
}
