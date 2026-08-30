import type { ResourceMap } from "@shared/player/resource-map";
import { canAffordCost } from "@shared/resource";
import { createPlayer } from "@shared/player";
import { costEntries } from "../../core/ui-state";

export const affordable = (resources: ResourceMap, cost: ResourceMap): boolean =>
  canAffordCost(createPlayer({ type: "day", resources }), cost);

export const Cost = ({ cost, icons }: { readonly cost: ResourceMap; readonly icons: Record<string, string> }) => {
  const entries = costEntries(cost);
  if (entries.length === 0) return <span className="cost cost--free">free</span>;
  return (
    <span className="cost">
      {entries.map(({ resource, amount }) => (
        <span key={resource} className="cost__entry" title={resource}>
          <img src={icons[resource]} alt={resource} />
          {amount}
        </span>
      ))}
    </span>
  );
};

type ActionButtonProps = {
  readonly label: string;
  readonly hotkey?: string;
  readonly cost: ResourceMap;
  readonly icons: Record<string, string>;
  readonly icon?: string;
  readonly active?: boolean;
  readonly enabled: boolean;
  readonly onClick: () => void;
  readonly title?: string;
};

export const ActionButton = ({ label, hotkey, cost, icons, icon, active, enabled, onClick, title }: ActionButtonProps) => (
  <button
    type="button"
    className={`action-btn${active === true ? " action-btn--active" : ""}`}
    disabled={!enabled}
    onClick={onClick}
    title={title}
  >
    {icon !== undefined && <img className="action-btn__icon" src={icon} alt="" />}
    <span className="action-btn__label">{label}</span>
    {hotkey !== undefined && <kbd className="action-btn__key">{hotkey}</kbd>}
    <Cost cost={cost} icons={icons} />
  </button>
);
