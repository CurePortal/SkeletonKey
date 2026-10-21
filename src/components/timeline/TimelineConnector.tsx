import React from "react";

// This is a simplified example of the modified TimelineFlowView component
// that focuses on the connector path fix
const TimelineConnectorDemo = () => {
  const [zoom, setZoom] = React.useState(1);
  const [pan, setPan] = React.useState({ x: 0, y: 0 });

  // Constants used in the original component
  const CARD_WIDTH = 250;
  const CARD_HEIGHT = 80;
  const VERTICAL_SPACING = 140;
  const EVENTS_AREA_WIDTH = 800;

  // Render SVG showing both paths for comparison
  return (
    <div className="flex flex-col h-full bg-gray-100 p-4">
      <h2 className="text-xl font-bold mb-4">Timeline Connector Comparison</h2>

      <div className="flex space-x-4 mb-4">
        <button
          className="px-4 py-2 bg-blue-500 text-white rounded"
          onClick={() => setZoom(Math.min(2, zoom + 0.1))}
        >
          Zoom In
        </button>
        <button
          className="px-4 py-2 bg-blue-500 text-white rounded"
          onClick={() => setZoom(Math.max(0.5, zoom - 0.1))}
        >
          Zoom Out
        </button>
        <button
          className="px-4 py-2 bg-blue-500 text-white rounded"
          onClick={() => {
            setZoom(1);
            setPan({ x: 0, y: 0 });
          }}
        >
          Reset
        </button>
      </div>

      <div
        className="flex-1 border border-gray-300 rounded-lg overflow-hidden bg-white relative"
        onMouseDown={(e) => {
          if (e.button === 0) {
            const startX = e.clientX - pan.x;
            const startY = e.clientY - pan.y;

            const handleMove = (e: MouseEvent) => {
              setPan({
                x: e.clientX - startX,
                y: e.clientY - startY,
              });
            };

            const handleUp = () => {
              document.removeEventListener("mousemove", handleMove);
              document.removeEventListener("mouseup", handleUp);
            };

            document.addEventListener("mousemove", handleMove);
            document.addEventListener("mouseup", handleUp);
          }
        }}
      >
        <div
          style={{
            transform: `scale(${zoom}) translate(${pan.x / zoom}px, ${pan.y / zoom}px)`,
            transformOrigin: "0 0",
            width: "100%",
            height: "100%",
            position: "absolute",
          }}
        >
          {/* Parent Timeline Card */}
          <div
            className="absolute bg-white rounded-lg shadow-md border-l-4"
            style={{
              left: "50px",
              top: "50px",
              width: `${CARD_WIDTH}px`,
              height: `${CARD_HEIGHT}px`,
              borderLeftColor: "#3B82F6",
            }}
          >
            <div className="p-3">
              <div className="flex justify-between">
                <h3 className="font-medium">Main Timeline</h3>
                <span className="h-3 w-3 rounded-full bg-blue-500"></span>
              </div>
              <div className="text-xs text-gray-500 mt-1">
                Has 4 events and 1 child timeline
              </div>
            </div>
          </div>

          {/* Parent Timeline Events */}
          {[1, 2, 3, 4].map((num, index) => {
            const segmentWidth = Math.max(150, EVENTS_AREA_WIDTH / 5);
            const posX = 50 + CARD_WIDTH + (index + 1) * segmentWidth;

            return (
              <div
                key={`event-${num}`}
                className="absolute bg-white rounded-md shadow-sm border border-gray-200"
                style={{
                  left: `${posX}px`,
                  top: "90px",
                  width: "120px",
                  transform: "translate(-50%, 0)",
                  padding: "8px",
                }}
              >
                <div className="text-xs font-medium">Event {num}</div>
                <div className="text-xs text-gray-500 mt-1">Date {num}</div>
              </div>
            );
          })}

          {/* Original Connector Path */}
          <svg
            className="absolute top-0 left-0 pointer-events-none"
            style={{
              width: "100%",
              height: "100%",
              overflow: "visible",
              zIndex: -1,
            }}
          >
            <path
              d={`M ${50 + CARD_WIDTH / 2} ${50 + CARD_HEIGHT}
                V ${50 + CARD_HEIGHT + 20}
                H ${50 + 20}
                V ${50 + VERTICAL_SPACING - 20}
                H ${50 + CARD_WIDTH / 2}`}
              fill="none"
              stroke="#3B82F6"
              strokeWidth={2}
              strokeDasharray="5,5"
              strokeOpacity={0.4}
            />
            <text x="60" y="170" className="text-xs fill-gray-500">
              Original Path
            </text>
          </svg>

          {/* Improved Connector Path */}
          <svg
            className="absolute top-0 left-0 pointer-events-none"
            style={{
              width: "100%",
              height: "100%",
              overflow: "visible",
              zIndex: -1,
            }}
          >
            {(() => {
              // Calculate horizontal extension for events
              const eventCount = 4;
              const eventSegments = eventCount + 1;
              const segmentWidth = Math.max(
                150,
                EVENTS_AREA_WIDTH / eventSegments,
              );
              const lastEventPosition =
                50 + CARD_WIDTH + eventCount * segmentWidth;
              const horizontalExtension = lastEventPosition + 100;

              return (
                <path
                  d={`M ${50 + CARD_WIDTH / 2} ${50 + CARD_HEIGHT}
                    V ${50 + CARD_HEIGHT + 20}
                    H ${horizontalExtension}
                    V ${50 + VERTICAL_SPACING - 20}
                    H ${50 + CARD_WIDTH / 2}`}
                  fill="none"
                  stroke="#3B82F6"
                  strokeWidth={2}
                  strokeDasharray="5,5"
                  strokeOpacity={0.8}
                />
              );
            })()}
            <text x="60" y="195" className="text-xs fill-gray-500">
              Improved Path
            </text>
          </svg>

          {/* Child Timeline Card */}
          <div
            className="absolute bg-white rounded-lg shadow-md border-l-4"
            style={{
              left: "50px",
              top: `${50 + VERTICAL_SPACING}px`,
              width: `${CARD_WIDTH}px`,
              height: `${CARD_HEIGHT}px`,
              borderLeftColor: "#EF4444",
            }}
          >
            <div className="p-3">
              <div className="flex justify-between">
                <h3 className="font-medium">Child Timeline</h3>
                <span className="h-3 w-3 rounded-full bg-red-500"></span>
              </div>
              <div className="text-xs text-gray-500 mt-1">Has 2 events</div>
            </div>
          </div>

          {/* Labels for visual guidance */}
          <div
            className="absolute text-xs text-gray-500"
            style={{ left: "50px", top: "20px" }}
          >
            Parent Timeline
          </div>
          <div
            className="absolute text-xs text-gray-500"
            style={{ left: "50px", top: `${50 + VERTICAL_SPACING - 20}px` }}
          >
            Child Timeline
          </div>
        </div>
      </div>

      <div className="mt-4 bg-white p-4 rounded-lg shadow">
        <h3 className="font-bold mb-2">Issue Explanation:</h3>
        <p className="mb-2">
          The original connector path (faded blue) doesn't extend over all
          events, which makes the visual relationship unclear.
        </p>
        <p>
          The improved connector path (solid blue) extends horizontally to cover
          all events, making it clear which events belong to which timeline.
        </p>
      </div>
    </div>
  );
};

export default TimelineConnectorDemo;
