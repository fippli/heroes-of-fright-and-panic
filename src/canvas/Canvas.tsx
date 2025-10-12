import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Action, State } from "../state";

const render = ({
  canvas,
  state,
  mouseX,
  mouseY,
  translationX,
  translationY,
}: {
  canvas: HTMLCanvasElement;
  state: State;
  mouseX: number;
  mouseY: number;
  translationX: number;
  translationY: number;
}) => {
  const ctx = canvas?.getContext("2d");

  if (ctx != null) {
    ctx.clearRect(0, 0,      ctx.canvas.width,      ctx.canvas.height );
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    state.board.render(ctx);

    // state.buildings.forEach((building: House) => {
    //   building.render(ctx, mouseX - translationX, mouseY - translationY);
    // });

    // state.player.render(ctx);

    // new Cursor().render(
    //   ctx,
    //   mouseX - translationX,
    //   mouseY - translationY,
    //   state
    // );
  }
};

export const Canvas = ({
  state,
  onAction,
}: {
  state: State;
  onAction: (action: Action) => void;
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [width, setWidth] = useState(0);
  const [height, setHeight] = useState(0);

  const mouseX = useRef(0);
  const mouseY = useRef(0);

  // Add a resize observer to fill the parent size
  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (canvas != null) {
      const resizeCanvas = () => {
        const parent = canvas.parentElement;
        if (parent) {
          const { width, height } = parent.getBoundingClientRect();
          setWidth(width);
          setHeight(height);
        }
      };

      resizeCanvas();

      const resizeObserver = new window.ResizeObserver(resizeCanvas);
      if (canvas.parentElement) {
        resizeObserver.observe(canvas.parentElement);
      }

      return () => {
        resizeObserver.disconnect();
      };
    }
  }, []);

  useEffect(() => {
    const canvas = canvasRef?.current;
    if (canvas != null) {
      canvas.width = width;
      canvas.height = height;
    }
  }, [width, height]);

  //  create a render loop

  useEffect(() => {
    let animationFrameId: number;

    const renderLoop = () => {
      if (canvasRef?.current != null) {
        render({
          canvas: canvasRef.current,
          state,
          mouseX: mouseX.current,
          mouseY: mouseY.current,
          translationX: state.mapPosition.x,
          translationY: state.mapPosition.y,
        });
      }
      animationFrameId = requestAnimationFrame(renderLoop);
    };

    renderLoop();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [state, width, height]);

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        cursor: "none",
      }}
      onKeyDown={(event) => {
        event.preventDefault();
        event.stopPropagation();

        const speed = 16;

        if (event.key === "ArrowLeft") {
          onAction({
            moveMap: {
              deltaX: -speed,
              deltaY: 0,
            },
          });
        }

        if (event.key === "ArrowRight") {
          onAction({
            moveMap: {
              deltaX: speed,
              deltaY: 0,
            },
          });
        }

        if (event.key === "ArrowUp") {
          onAction({
            moveMap: {
              deltaX: 0,
              deltaY: -speed,
            },
          });
        }

        if (event.key === "ArrowDown") {
          onAction({
            moveMap: {
              deltaX: 0,
              deltaY: speed,
            },
          });
        }
      }}
      onMouseMove={(event) => {
        event.preventDefault();
        event.stopPropagation();

        const { clientX, clientY } = event;

        mouseX.current = clientX;
        mouseY.current = clientY;
      }}
      onClick={() => {
        onAction({
          click: {
            x: mouseX.current - state.mapPosition.x,
            y: mouseY.current - state.mapPosition.y,
          },
        });
      }}
      onContextMenu={(event) => {
        console.log("context menu");
        event.preventDefault();
        event.stopPropagation();

        onAction({
          rightClick: {
            clientX: event.clientX,
            clientY: event.clientY,
            x: mouseX.current - state.mapPosition.x,
            y: mouseY.current - state.mapPosition.y,
          },
        });
      }}
    >
      <canvas
        ref={canvasRef}
        tabIndex={1}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: `${width}px`,
          height: `${height}px`,
        }}
        onWheel={(event) => {
          // event.stopPropagation();
          // event.preventDefault();

          onAction({
            moveMap: {
              deltaX: event.deltaX,
              deltaY: event.deltaY,
            },
          });
        }}
      />
    </div>
  );
};
