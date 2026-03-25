import { Routes, Route, Link, useLocation, Navigate } from "react-router-dom";
import { OverworldSandbox } from "./OverworldSandbox";
import { BattleSandbox } from "./BattleSandbox";
import "./sandbox.css";

const MODES = [
  { path: "battle", label: "Battle" },
  { path: "overworld", label: "Overworld" },
  { path: "castle", label: "Castle" },
  { path: "army", label: "Army" },
] as const;

const NotImplemented = ({ title }: { readonly title: string }) => (
  <div className="sandbox-not-implemented">
    <h2>{title}</h2>
    <p>Not implemented yet</p>
  </div>
);

export const SandboxPage = () => {
  const location = useLocation();
  const activePath = location.pathname.split("/").at(-1) ?? "";

  return (
    <div className="sandbox-layout">
      <nav className="sandbox-mode-nav">
        {MODES.map((mode) => (
          <Link
            key={mode.path}
            to={`/sandbox/${mode.path}`}
            className={`sandbox-mode-link ${activePath === mode.path ? "sandbox-mode-link-active" : ""}`}
          >
            {mode.label}
          </Link>
        ))}
      </nav>

      <div className="sandbox-mode-content">
        <Routes>
          <Route index element={<Navigate to="battle" replace />} />
          <Route path="battle" element={<BattleSandbox />} />
          <Route path="overworld" element={<OverworldSandbox />} />
          <Route path="castle" element={<NotImplemented title="Castle" />} />
          <Route path="army" element={<NotImplemented title="Army" />} />
        </Routes>
      </div>
    </div>
  );
};
