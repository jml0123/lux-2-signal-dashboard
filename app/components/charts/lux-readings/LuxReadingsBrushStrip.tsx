"use client";

import { Brush } from "@visx/brush";
import type BaseBrush from "@visx/brush/lib/BaseBrush";
import type { BrushHandleRenderProps } from "@visx/brush/lib/BrushHandle";
import type { Bounds, Scale } from "@visx/brush/lib/types";
import type { CurveFactory } from "d3-shape";
import { Group } from "@visx/group";
import { AreaClosed } from "@visx/shape";
import type { PositionScale } from "@visx/shape/lib/types/base";
import type { ReactNode, RefObject } from "react";
import type { LuxChartPoint } from "@/app/lib/readings/readings.types";
import { dashboardTheme } from "@/app/lib/theme/dashboardTheme";

export function LuxBrushResizeHandle({
  x,
  height,
  isBrushActive,
}: BrushHandleRenderProps) {
  const pathW = 8;
  const pathH = 16;
  if (!isBrushActive) return null;
  return (
    <Group left={x + pathW / 2} top={(height - pathH) / 2}>
      <path
        fill="var(--app-field-surface)"
        d="M -4.5 0.5 L 3.5 0.5 L 3.5 15.5 L -4.5 15.5 L -4.5 0.5 M -1.5 4 L -1.5 12 M 0.5 4 L 0.5 12"
        stroke={dashboardTheme.chartGlyphStroke}
        strokeWidth={1}
        style={{ cursor: "ew-resize" }}
      />
    </Group>
  );
}

export type LuxReadingsBrushStripProps = {
  outerGroupLeft: number;
  outerGroupTop: number;
  innerWidth: number;
  brushStageHeight: number;
  brushHolderPadding: {
    top: number;
    bottom: number;
    left: number;
    right: number;
  };
  brushInnerWidth: number;
  overviewInnerHeight: number;
  brushPatternId: string;
  overviewPoints: LuxChartPoint[];
  brushXScale: Scale;
  brushYScale: PositionScale;
  brushRef: RefObject<BaseBrush | null>;
  onBrushChange: (domain: Bounds | null) => void;
  onBrushResetClick: () => void;
  luxLineCurve: CurveFactory;
  luxBrushAreaFillOpacity: number;
  children?: ReactNode;
};

export function LuxReadingsBrushStrip({
  outerGroupLeft,
  outerGroupTop,
  innerWidth,
  brushStageHeight,
  brushHolderPadding,
  brushInnerWidth,
  overviewInnerHeight,
  brushPatternId,
  overviewPoints,
  brushXScale,
  brushYScale,
  brushRef,
  onBrushChange,
  onBrushResetClick,
  luxLineCurve,
  luxBrushAreaFillOpacity,
  children,
}: LuxReadingsBrushStripProps) {
  return (
    <Group left={outerGroupLeft} top={outerGroupTop}>
      <rect
        x={0}
        y={0}
        width={innerWidth}
        height={brushStageHeight}
        rx={8}
        fill="var(--app-brush-holder-fill)"
        stroke="var(--app-brush-holder-border)"
        strokeWidth={1}
      />
      <Group left={brushHolderPadding.left} top={brushHolderPadding.top}>
        {children}
        {overviewPoints.length >= 2 ? (
          <AreaClosed<LuxChartPoint>
            data={overviewPoints}
            x={(d) => Number(brushXScale(new Date(d.time)))}
            y={(d) => Number(brushYScale(d.lux))}
            yScale={brushYScale}
            curve={luxLineCurve}
            fill="var(--palette-celadon)"
            fillOpacity={luxBrushAreaFillOpacity}
            style={{ pointerEvents: "none" }}
          />
        ) : null}
        <Brush
          innerRef={brushRef}
          xScale={brushXScale}
          yScale={brushYScale}
          width={brushInnerWidth}
          height={overviewInnerHeight}
          margin={{ top: 0, right: 0, bottom: 0, left: 0 }}
          handleSize={8}
          brushDirection="horizontal"
          resizeTriggerAreas={["left", "right"]}
          onChange={onBrushChange}
          onClick={onBrushResetClick}
          selectedBoxStyle={{
            fill: `url(#${brushPatternId})`,
            stroke: "var(--chart-brush-selection-stroke)",
            strokeWidth: 1.5,
          }}
          renderBrushHandle={(props) => <LuxBrushResizeHandle {...props} />}
          useWindowMoveEvents
          disableDraggingSelection={false}
        />
      </Group>
    </Group>
  );
}
