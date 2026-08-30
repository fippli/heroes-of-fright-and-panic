import { formatClock, type GameUiState } from "../../core/ui-state";

const RESOURCES: readonly { readonly key: "wood" | "stone" | "food" | "gold" | "iron" | "faith"; readonly label: string }[] = [
  { key: "wood", label: "Wood" },
  { key: "stone", label: "Stone" },
  { key: "food", label: "Food" },
  { key: "gold", label: "Gold" },
  { key: "iron", label: "Iron" },
  { key: "faith", label: "Faith" },
];

/** Clock, whose phase it is, the six resources with the coming production, and research */
export const EconomyPanel = ({ ui }: { readonly ui: GameUiState }) => {
  const { clock, research } = ui;
  const phase = clock.isDay ? "Day" : "Night";
  const next = clock.isDay ? "dusk" : "dawn";
  const turnText = !ui.isPlayer
    ? `${phase}'s phase`
    : ui.isMyTurn
      ? "Your turn"
      : `Waiting for ${ui.currentPlayer}`;
  const producer = ui.isPlayer && ((ui.currentPlayer === "day") === clock.isDay);

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
      </section>

      <section className="panel">
        <h2>Resources</h2>
        <div className="stat-grid">
          {RESOURCES.map(({ key, label }) => {
            const gain = ui.production[key] ?? 0;
            return (
              <div key={key} title={label}>
                <img src={ui.icons[key]} alt={label} />
                <div>{ui.resources[key] ?? 0}</div>
                {gain > 0 && <span className="stat-gain" title={`+${gain} at ${next}`}>+{gain}</span>}
              </div>
            );
          })}
        </div>
        {ui.isPlayer && (
          <p className="hint">
            {producer ? "Production arrives at the next " : "Your production arrives at the next "}{clock.isDay ? "dawn" : "dusk"}
            {" · "}Speed {research.speedLevel}
            {research.hasMiningII ? " · Mining II" : " · iron needs Mining II"}
            {research.hasMiningIII ? " · Mining III" : ""}
            {research.hasQueen ? " · Queen" : ""}
          </p>
        )}
      </section>
    </>
  );
};
