import { formatClock, type GameUiState } from "../../core/ui-state";

/** Clock, whose phase it is, and research */
export const EconomyPanel = ({ ui }: { readonly ui: GameUiState }) => {
  const { clock, research } = ui;
  const phase = clock.isDay ? "Day" : "Night";
  const next = clock.isDay ? "dusk" : "dawn";
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
          <span className="clock__phase">{phase} · {clock.hoursLeft}h to {next}</span>
        </div>
        <div className="phasebar" aria-hidden="true">
          <div className={`phasebar__fill phasebar__fill--${clock.isDay ? "day" : "night"}`} style={{ width: `${Math.round(clock.progress * 100)}%` }} />
        </div>
        <div className={`turn-indicator${ui.isPlayer && ui.isMyTurn ? " turn-indicator--mine" : ""}`}>{turnText}</div>
        {ui.isPlayer && (
          <p className="hint">
            Production arrives at the next {clock.isDay ? "dawn" : "dusk"} · Speed {research.speedLevel}
            {research.hasQueen ? " · Queen" : ""} · iron and gold come from upgraded houses next to mountains
          </p>
        )}
      </section>

    </>
  );
};
