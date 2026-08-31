import { formatClock, type GameUiState } from "../../core/ui-state";

/** Clock, whose phase it is, and research */
export const EconomyPanel = ({ ui }: { readonly ui: GameUiState }) => {
  const { clock, research } = ui;
  const phase = clock.isDay ? "Day" : "Night";
  const next = clock.isDay ? "dusk" : "dawn";
  const { round } = ui;
  const turnText = !ui.isPlayer
    ? `${phase}'s phase`
    : ui.isMyTurn
      ? "Your turn"
      : `Waiting for ${ui.currentPlayer}`;

  return (
    <>
      <section className="panel">
        <h2>Time</h2>
        <div className="clock">
          <span className="clock__time">{formatClock(clock.time)}</span>
          <span className="clock__phase">{phase}&apos;s round</span>
        </div>
        {ui.isPlayer && round.total > 0 && (
          <div className="phasebar" aria-hidden="true" title={`${round.acted} of ${round.total} pieces have acted`}>
            <div className={`phasebar__fill phasebar__fill--${clock.isDay ? "day" : "night"}`} style={{ width: `${Math.round((round.acted / round.total) * 100)}%` }} />
          </div>
        )}
        {ui.isPlayer && <p className="hint">{round.acted}/{round.total} pieces have acted · every piece and building may act once, then end the phase</p>}
        <div className={`turn-indicator${ui.isPlayer && ui.isMyTurn ? " turn-indicator--mine" : ""}`}>{turnText}</div>
        {ui.isPlayer && (
          <p className="hint">
            Production arrives at {next}{research.hasQueen ? " · Queen researched" : ""} · iron and gold come from upgraded houses next to mountains
          </p>
        )}
      </section>

    </>
  );
};
