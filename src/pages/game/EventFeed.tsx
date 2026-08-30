import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { describeEvent, eventPositions } from "@shared/game/describe";
import type { GameEvent } from "@shared/game/events";
import type { Game } from "../../core/Board";

const POLL_MS = 3000;
const SHOW = 12;

type Row = {
  seq: number; kind: GameEvent["kind"]; player: string | null; action: GameEvent["action"];
  result: GameEvent["result"]; created_at: string;
};

const timeOf = (iso: string): string => {
  const date = new Date(iso);
  return `${date.getHours().toString().padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}`;
};

/** What happened in this game, newest first, limited to what this player can see */
export const EventFeed = ({ game, gameId, player }: { readonly game: Game; readonly gameId: string; readonly player: string | null }) => {
  const [rows, setRows] = useState<readonly Row[]>([]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const { data } = await supabase
        .from("game_events")
        .select("seq, kind, player, action, result, created_at")
        .eq("game_id", gameId)
        .in("kind", ["action", "ai"])
        .order("seq", { ascending: false })
        .limit(40);
      if (!cancelled && data !== null) setRows(data as Row[]);
    };
    void load();
    const timer = window.setInterval(() => void load(), POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [gameId]);

  const visible = rows.filter((row) => {
    // Own actions always; the opponent's only where you could have seen them
    if (row.player === player || player === null) return true;
    if (row.result !== null && !row.result.success) return false;
    const positions = eventPositions(row.action);
    return positions.length > 0 && positions.some((position) => game.isExplored(position));
  }).slice(0, SHOW);

  if (visible.length === 0) return null;
  return (
    <section className="panel">
      <h2>Chronicle</h2>
      <ol className="feed">
        {visible.map((row) => (
          <li key={row.seq} className={row.player === player ? "feed__mine" : "feed__theirs"}>
            <span className="feed__time">{timeOf(row.created_at)}</span>
            <span>{describeEvent({ seq: row.seq, kind: row.kind, player: row.player as GameEvent["player"], action: row.action, result: row.result, state: null, engineVersion: null })}</span>
          </li>
        ))}
      </ol>
    </section>
  );
};
