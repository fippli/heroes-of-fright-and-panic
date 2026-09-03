import { type GameUiState } from "../../core/ui-state";

/** Round progress and production notes; the clock and turn live in the header */
export const EconomyPanel = ({ ui }: { readonly ui: GameUiState }) => {
  const { clock, research } = ui;
  const next = clock.isDay ? "dusk" : "dawn";
  const { round } = ui;

  return (
    <>
      <section className="panel">
        <h2>Round</h2>
        {ui.isPlayer && round.total > 0 && (
          <div className="phasebar" aria-hidden="true" title={`${round.acted} of ${round.total} pieces have acted`}>
            <div className={`phasebar__fill phasebar__fill--${clock.isDay ? "day" : "night"}`} style={{ width: `${Math.round((round.acted / round.total) * 100)}%` }} />
          </div>
        )}
        {ui.isPlayer && <p className="hint">{round.acted}/{round.total} pieces have acted · every piece and building may act once, then end the phase</p>}
        {ui.isPlayer && (
          <p className="hint">
            Production arrives at {next}{research.hasQueen ? " · Queen researched" : ""} · iron and gold come from upgraded houses next to mountains
          </p>
        )}
      </section>

    </>
  );
};
