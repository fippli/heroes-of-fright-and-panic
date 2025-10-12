import React, { Reducer, useLayoutEffect, useReducer } from "react";
import { Canvas } from "./canvas/Canvas.jsx";
import type { Action, State } from "./state";
import { initialState } from "./state";
import { reducer } from "./state/index.ts";
import woodSrc from "./assets/wood.png";

export const App = () => {
  const [state, dispatch] = useReducer<Reducer<State, Action>>(
    reducer,
    initialState
  );

  useLayoutEffect(() => {
    dispatch({ initiate: null });
  }, []);

  return (
    <div className="layout" style={{ backgroundColor: "black" }}>
      <Canvas
        state={state}
        onAction={(action) => {
          dispatch(action);
        }}
      />

      {state.contextMenu != null && (
        <div
          className="context-menu"
          style={{
            top: state.contextMenu?.clientY,
            left: state.contextMenu?.clientX,
          }}
        >
          hello, world
        </div>
      )}

      <div className="menu">
        <div className="time">
          {state.time.toString().length === 1 ? "0" : ""}
          {state.time}:00
        </div>
        <div>
          <img src={woodSrc} alt="wood" className="resource-icon" />
          {state.resources.wood}
        </div>
      </div>
    </div>
  );
};
