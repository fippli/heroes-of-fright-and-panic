/**
 * API utilities for making requests to the server
 */

export interface ApiError {
  error: string;
}

export interface User {
  id: string;
  email: string;
  createdAt: string;
}

export interface Game {
  id: string;
  _id?: string;
  size: number;
  currentPlayer: "day" | "night";
  createdAt: string;
  updatedAt: string;
  creatorEmail?: string | null;
  dayPlayerEmail?: string | null;
  nightPlayerEmail?: string | null;
  dayPlayerLastMove?: string | null;
  nightPlayerLastMove?: string | null;
}

/**
 * Generic fetch wrapper with error handling
 */
async function fetchApi<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...options?.headers,
    },
  });

  // Check if response is JSON
  const contentType = response.headers.get("content-type");
  if (!contentType || !contentType.includes("application/json")) {
    const text = await response.text();
    throw new Error(
      `Expected JSON response but got ${contentType}. Response: ${text.substring(0, 200)}`,
    );
  }

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      (data as ApiError).error || `Request failed: ${response.statusText}`,
    );
  }

  return data as T;
}

/**
 * Auth API
 */
export const authApi = {
  /**
   * Request a magic link email
   */
  async requestMagicLink(
    email: string,
  ): Promise<{ success: boolean; message: string }> {
    return fetchApi("/api/auth/magic-link", {
      method: "POST",
      body: JSON.stringify({ email }),
    });
  },

  /**
   * Get the current authenticated user
   */
  async getCurrentUser(): Promise<User> {
    return fetchApi("/api/auth/me");
  },

  /**
   * Check if user is authenticated (doesn't throw)
   */
  async isAuthenticated(): Promise<boolean> {
    try {
      await this.getCurrentUser();
      return true;
    } catch {
      return false;
    }
  },

  /**
   * Log out the current user
   */
  async logout(): Promise<void> {
    await fetchApi("/api/auth/logout", { method: "POST" });
  },
};

/**
 * Games API
 */
export const gamesApi = {
  /**
   * Get all games
   */
  async getAll(): Promise<Game[]> {
    return fetchApi("/api/game");
  },

  /**
   * Get a specific game
   */
  async get(id: string, player?: "day" | "night"): Promise<Game> {
    const url = player ? `/api/game/${id}?player=${player}` : `/api/game/${id}`;
    return fetchApi(url);
  },

  /**
   * Create a new game
   */
  async create(params: {
    name: string;
    size: number;
    alliance: "day" | "night";
    inviteEmail?: string | null;
  }): Promise<Game> {
    return fetchApi("/api/game", {
      method: "POST",
      body: JSON.stringify(params),
    });
  },

  /**
   * Delete a game (only creator can delete)
   */
  async delete(id: string): Promise<void> {
    return fetchApi(`/api/game/${id}`, {
      method: "DELETE",
    });
  },
};
