import type { GameUiState } from "../../core/ui-state";

const RESOURCES: readonly { readonly key: "wood" | "stone" | "food" | "gold" | "iron" | "faith"; readonly label: string }[] = [
  { key: "wood", label: "Wood" },
  { key: "stone", label: "Stone" },
  { key: "food", label: "Food" },
  { key: "gold", label: "Gold" },
  { key: "iron", label: "Iron" },
  { key: "faith", label: "Faith" },
];

/** Fixed strip over the map: resources (with the coming production), population and buildings */
export const TopBar = ({ ui }: { readonly ui: GameUiState }) => {
  if (!ui.isPlayer) return null;
  const { population, clock } = ui;
  const full = population.peasants >= population.capacity;
  const next = clock.isDay ? "dusk" : "dawn";
  return (
    <header className="topbar" aria-label="Resources, population and buildings">
      <div className="topbar__group topbar__resources">
        {RESOURCES.map(({ key, label }) => {
          const gain = ui.production[key] ?? 0;
          const upkeep = key === "food" ? ui.round.total : 0;
          const title =
            key === "food"
              ? `${label}: +${gain} at ${next}, −${upkeep} eaten (one per piece)`
              : gain > 0
                ? `${label}: +${gain} at ${next}`
                : label;
          return (
            <div key={key} className="topbar__item" title={title}>
              <img src={ui.icons[key]} alt={label} />
              <span className="topbar__value">{ui.resources[key] ?? 0}</span>
              {gain > 0 && <span className="topbar__gain">+{gain}</span>}
              {upkeep > 0 && <span className="topbar__upkeep">−{upkeep}</span>}
            </div>
          );
        })}
      </div>
      <div className={`topbar__pop${full ? " topbar__pop--full" : ""}`} title={full ? "Every house slot is taken — build or upgrade houses to spawn more peasants" : "Peasants housed / room for peasants"}>
        <span className="topbar__label">Peasants</span>
        <span className="topbar__value">{population.peasants}/{population.capacity}</span>
      </div>
      <div className="topbar__group topbar__buildings">
        {ui.buildings
          .filter((entry) => entry.count > 0 || entry.key === "house")
          .map((entry) => (
            <div key={entry.key} className="topbar__item" title={entry.label}>
              <img src={entry.sprite} alt={entry.label} />
              <span className="topbar__value">{entry.count}</span>
            </div>
          ))}
      </div>
      <div
        className="topbar__clock"
        title={`${clock.hoursLeft} hour${clock.hoursLeft === 1 ? "" : "s"} until ${next}`}
      >
        <span aria-hidden="true">{clock.isDay ? "☀" : "☾"}</span>
        <span className="topbar__value">
          {String(((clock.time % 24) + 24) % 24).padStart(2, "0")}:00
        </span>
      </div>
      <div className={`topbar__turn${ui.isMyTurn ? " topbar__turn--mine" : ""}`}>
        {ui.isMyTurn ? "Your turn" : "Opponents turn"}
      </div>
    </header>
  );
};
