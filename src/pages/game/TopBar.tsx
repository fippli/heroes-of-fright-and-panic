import type { GameUiState } from "../../core/ui-state";

/** Fixed strip over the map: your buildings and how many peasants they house */
export const TopBar = ({ ui }: { readonly ui: GameUiState }) => {
  if (!ui.isPlayer) return null;
  const { population } = ui;
  const full = population.peasants >= population.capacity;
  return (
    <header className="topbar" aria-label="Your buildings and population">
      <div className={`topbar__pop${full ? " topbar__pop--full" : ""}`} title={full ? "Every house slot is taken — build or upgrade houses to spawn more peasants" : "Peasants housed / room for peasants"}>
        <span className="topbar__label">Peasants</span>
        <span className="topbar__value">{population.peasants}/{population.capacity}</span>
      </div>
      <div className="topbar__buildings">
        {ui.buildings
          .filter((entry) => entry.count > 0 || entry.key === "house")
          .map((entry) => (
            <div key={entry.key} className="topbar__item" title={entry.label}>
              <img src={entry.sprite} alt={entry.label} />
              <span className="topbar__value">{entry.count}</span>
            </div>
          ))}
      </div>
    </header>
  );
};
