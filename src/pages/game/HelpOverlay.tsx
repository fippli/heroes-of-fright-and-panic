import { useEffect } from "react";

const SHORTCUTS: readonly (readonly [string, string])[] = [
  ["Click", "Select your piece or building; click again to move, attack, or open its menu"],
  ["Drag / wheel / + −", "Pan and zoom the map (touch: drag and pinch)"],
  ["H T W R K", "Pick a building to place (house, tower, wall, church, dock), then click a tile in your kingdom"],
  ["P", "Spawn a peasant (house selected)"],
  ["S D B", "Sword, shield, bow for the selected peasant"],
  ["N M", "Train a priest / summon an archangel (church selected)"],
  ["G", "Heal: select your priest, then click an ally"],
  ["O F", "Buy a horse next to the selected house / build a boat next to the selected dock"],
  ["7", "Research the Queen at a Castle (level 2+)"],
  ["U", "Upgrade the selected house or castle"],
  ["Space", "End your phase — everything rests, the other side plays"],
  ["Esc", "Cancel build or target mode"],
  ["?", "This help"],
];

/** Rules on one screen, opened with ? or the Help button */
export const HelpOverlay = ({ open, onClose }: { readonly open: boolean; readonly onClose: () => void }) => {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="help" role="dialog" aria-modal="true" aria-label="How to play" onClick={onClose}>
      <div className="help__card" onClick={(event) => event.stopPropagation()}>
        <div className="help__head">
          <h1>How to play</h1>
          <button type="button" className="action-btn help__close" onClick={onClose}>Close</button>
        </div>
        <div className="help__columns">
          <section>
            <h2>The game</h2>
            <p>Two alliances share an island and take turns as <strong>Day</strong> and <strong>Night</strong>. A phase is a round: every piece and every building may act once. End your phase when you are done — production arrives at dusk and dawn.</p>
            <p><strong>Win</strong> by killing the other king or razing their castle. You start with a <strong>Keep</strong> — upgrade it to a <strong>Castle</strong> (unlocks research) and on to a <strong>Citadel</strong>. If it falls, your kingdom falls.</p>
            <h2>Your kingdom</h2>
            <p>Your kingdom is what your pieces can see. You may only build on grass inside it. Forests and mountains cannot be entered; there is always a pass around them. Water needs a boat, built at a dock (docks go on sand by the shore).</p>
            <h2>Economy</h2>
            <p>At dawn (Day) and dusk (Night) your <strong>houses</strong> produce: +1 wood per adjacent forest tile, +1 food per adjacent farm (grass next to a house becomes farm), +1 stone per adjacent mountain. <strong>Upgrade</strong> a house (3 wood + 2 stone) into a homestead to get +2 stone and +1 iron per mountain, then (5 wood + 5 stone + 1 iron) into a manor for +1 gold per mountain and double wood and food. A priest in a church makes faith; a peasant in a boat on open water fishes.</p>
            <h2>Pieces</h2>
            <p>Peasants need housing: each house holds one, a homestead two, a manor three — the header shows peasants housed / room. Peasants work, fight and can carry a sword (+1 attack), shield (+1 defense) or bow (+1 range), plus iron armour — helmet, cuirass, greaves — worth +1 defense each; buy any of it with the + in the peasant's panel. Priests heal. Your castle stands from the first turn; upgrade it for reach, defense and research. Towers grow the same way: Watchpost (5 wood, sees 2) → Watchtower (8 stone, sees 3) → Beacon (5 gold, sees 4) — a bow inside shoots as far as the tower sees. Archangels are summoned with faith and ten praying priests.</p>
          </section>
          <section>
            <h2>Controls</h2>
            <dl className="help__keys">
              {SHORTCUTS.map(([keys, what]) => (
                <div key={keys}>
                  <dt><kbd>{keys}</kbd></dt>
                  <dd>{what}</dd>
                </div>
              ))}
            </dl>
            <p className="hint">Full rules: <a href="/docs/game-specification" target="_blank" rel="noreferrer">the specification</a>.</p>
          </section>
        </div>
      </div>
    </div>
  );
};
