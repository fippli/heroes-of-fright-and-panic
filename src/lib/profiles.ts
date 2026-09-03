import { supabase } from "./supabase";

export type Profile = {
  readonly id: string;
  readonly username: string;
};

export type FriendEntry = {
  /** The other player */
  readonly userId: string;
  readonly username: string;
  readonly status: "friends" | "sent" | "received";
};

export const USERNAME_PATTERN = /^[a-z0-9_]{3,20}$/;

const currentUserId = async (): Promise<string> => {
  const { data } = await supabase.auth.getUser();
  if (data.user === null) throw new Error("Not signed in");
  return data.user.id;
};

export const profilesApi = {
  /** The signed-in player's profile, or null before a username is claimed */
  async getOwn(): Promise<Profile | null> {
    const userId = await currentUserId();
    const { data, error } = await supabase
      .from("profiles")
      .select("id, username")
      .eq("id", userId)
      .maybeSingle();
    if (error !== null) throw new Error(error.message);
    return (data as Profile | null) ?? null;
  },

  /** Claim a username (once — it cannot be changed) */
  async claim(username: string): Promise<Profile> {
    const normalized = username.trim().toLowerCase();
    if (!USERNAME_PATTERN.test(normalized)) {
      throw new Error("3–20 characters: lowercase letters, digits and _");
    }
    const userId = await currentUserId();
    const { data, error } = await supabase
      .from("profiles")
      .insert({ id: userId, username: normalized })
      .select("id, username")
      .single();
    if (error !== null) {
      throw new Error(
        error.code === "23505" ? "That username is taken" : error.message,
      );
    }
    return data as Profile;
  },

  /** Everyone this player is connected to, with the direction of pending requests */
  async friends(): Promise<readonly FriendEntry[]> {
    const userId = await currentUserId();
    const { data, error } = await supabase
      .from("friendships")
      .select(
        "requester, addressee, status, requester_profile:profiles!friendships_requester_fkey(username), addressee_profile:profiles!friendships_addressee_fkey(username)",
      )
      .order("created_at", { ascending: false });
    if (error !== null) throw new Error(error.message);
    type Row = {
      requester: string;
      addressee: string;
      status: "pending" | "accepted";
      requester_profile: { username: string } | null;
      addressee_profile: { username: string } | null;
    };
    // supabase-js types to-one FK embeds as arrays; at runtime they are objects
    return ((data ?? []) as unknown as Row[]).map((row) => {
      const iRequested = row.requester === userId;
      return {
        userId: iRequested ? row.addressee : row.requester,
        username:
          (iRequested ? row.addressee_profile : row.requester_profile)?.username ??
          "unknown",
        status:
          row.status === "accepted" ? "friends" : iRequested ? "sent" : "received",
      };
    });
  },

  /**
   * Send a friend request by username. If that player already sent one to
   * us, the two requests meet in the middle and become a friendship.
   */
  async sendRequest(username: string): Promise<"sent" | "friends"> {
    const normalized = username.trim().toLowerCase();
    const userId = await currentUserId();
    const { data: other, error: lookupError } = await supabase
      .from("profiles")
      .select("id, username")
      .eq("username", normalized)
      .maybeSingle();
    if (lookupError !== null) throw new Error(lookupError.message);
    if (other === null) throw new Error(`No player named "${normalized}"`);
    if ((other as Profile).id === userId) throw new Error("That's you");
    const otherId = (other as Profile).id;

    // A pending request from them to us? Accept it instead.
    const { data: reverse } = await supabase
      .from("friendships")
      .select("status")
      .eq("requester", otherId)
      .eq("addressee", userId)
      .maybeSingle();
    if (reverse !== null) {
      if ((reverse as { status: string }).status === "accepted") return "friends";
      await this.accept(otherId);
      return "friends";
    }

    const { error } = await supabase
      .from("friendships")
      .insert({ requester: userId, addressee: otherId });
    if (error !== null) {
      throw new Error(
        error.code === "23505" ? "Request already sent" : error.message,
      );
    }
    return "sent";
  },

  /** Accept a pending request from this player */
  async accept(requesterId: string): Promise<void> {
    const userId = await currentUserId();
    const { error } = await supabase
      .from("friendships")
      .update({ status: "accepted" })
      .eq("requester", requesterId)
      .eq("addressee", userId);
    if (error !== null) throw new Error(error.message);
  },

  /** Decline a request, cancel a sent one, or unfriend — all just delete the row */
  async remove(otherId: string): Promise<void> {
    const userId = await currentUserId();
    const { error } = await supabase
      .from("friendships")
      .delete()
      .or(
        `and(requester.eq.${userId},addressee.eq.${otherId}),and(requester.eq.${otherId},addressee.eq.${userId})`,
      );
    if (error !== null) throw new Error(error.message);
  },
};
