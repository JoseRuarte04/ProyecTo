import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface TeamMemberWithProfile {
  user_id: string;
  role: "admin" | "member";
  joined_at: string;
  profiles: { full_name: string; email: string } | null;
}

export interface TeamInvitation {
  id: string;
  email: string;
  expires_at: string;
  status: string;
}

export interface MyTeam {
  id: string;
  name: string;
  member_limit: number;
  members: TeamMemberWithProfile[];
  invitations: TeamInvitation[];
}

export function useMyTeams() {
  const { user } = useAuth();
  const [teams, setTeams]     = useState<MyTeam[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!user) return;
    setLoading(true);

    const { data: adminRows } = await supabase
      .from("team_members")
      .select("team_id, teams(id, name, member_limit)")
      .eq("user_id", user.id)
      .eq("role", "admin");

    if (!adminRows || adminRows.length === 0) {
      setTeams([]);
      setLoading(false);
      return;
    }

    const teamIds = adminRows.map((r: any) => r.team_id as string);

    const [membersRes, invitationsRes] = await Promise.all([
      supabase
        .from("team_members")
        .select("team_id, user_id, role, joined_at, profiles(full_name, email)")
        .in("team_id", teamIds),
      supabase
        .from("team_invitations")
        .select("id, team_id, email, expires_at, status")
        .in("team_id", teamIds)
        .eq("status", "pending"),
    ]);

    const members     = (membersRes.data     as unknown as (TeamMemberWithProfile & { team_id: string })[]) || [];
    const invitations = (invitationsRes.data as unknown as (TeamInvitation    & { team_id: string })[]) || [];

    const result: MyTeam[] = adminRows.map((r: any) => ({
      id:           r.teams.id,
      name:         r.teams.name,
      member_limit: r.teams.member_limit,
      members:      members.filter((m) => m.team_id === r.team_id),
      invitations:  invitations.filter((i) => i.team_id === r.team_id),
    }));

    setTeams(result);
    setLoading(false);
  };

  useEffect(() => { load(); }, [user]);

  return { teams, loading, reload: load };
}
