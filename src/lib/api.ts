import { supabase, getEdgeFunctionError } from "./supabase";

export type Game = {
  id: string;
  _id?: string;
  name?: string | null;
  size: number;
  currentPlayer: "day" | "night";
  gameOver?: boolean;
  winner?: "day" | "night" | null;
  createdAt: string;
  updatedAt: string;
  creatorEmail?: string | null;
  dayPlayerEmail?: string | null;
  nightPlayerEmail?: string | null;
  dayPlayerLastMove?: string | null;
  nightPlayerLastMove?: string | null;
};

export const gamesApi = {
  async getAll(): Promise<Game[]> {
    const { data: userData } = await supabase.auth.getUser();
    if (userData.user === null || userData.user.email === undefined) {
      throw new Error("Not authenticated");
    }

    const email = userData.user.email;

    const { data, error } = await supabase
      .from("games")
      .select(
        "id, name, size, current_player, game_over, winner, created_at, updated_at, creator_email, day_player_email, night_player_email, day_player_last_move, night_player_last_move",
      )
      .or(
        `creator_email.eq.${email},day_player_email.eq.${email},night_player_email.eq.${email},invited_email.eq.${email}`,
      )
      .order("updated_at", { ascending: false })
      .limit(50);

    if (error !== null) {
      throw new Error(error.message);
    }

    return (data ?? []).map((row) => ({
      id: row.id,
      name: row.name ?? null,
      size: row.size,
      currentPlayer: row.current_player,
      gameOver: row.game_over ?? false,
      winner: row.winner ?? null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      creatorEmail: row.creator_email ?? null,
      dayPlayerEmail: row.day_player_email ?? null,
      nightPlayerEmail: row.night_player_email ?? null,
      dayPlayerLastMove: row.day_player_last_move ?? null,
      nightPlayerLastMove: row.night_player_last_move ?? null,
    }));
  },

  async create(params: {
    name: string;
    size: number;
    alliance: "day" | "night";
    inviteEmail?: string | null;
    themeId?: string | null;
    mapConfig?: { forestDensity: number; mountainDensity: number; waterLevel: number } | null;
    aiOpponent?: boolean;
  }): Promise<Game> {
    const { data, error } = await supabase.functions.invoke("game-create", {
      body: params,
    });

    if (error !== null) {
      throw new Error(await getEdgeFunctionError(error));
    }

    return data as Game;
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase.from("games").delete().eq("id", id);

    if (error !== null) {
      throw new Error(error.message);
    }
  },

  async join(gameId: string): Promise<void> {
    const { error } = await supabase.functions.invoke("game-join", {
      body: { gameId },
    });

    if (error !== null) {
      throw new Error(await getEdgeFunctionError(error));
    }
  },
};
