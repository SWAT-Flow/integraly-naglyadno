export type Tone = "slate" | "blue" | "emerald" | "rose" | "amber" | "violet";
export type ExpressionOrientation = "yOfX" | "xOfY";

export type ToolMode =
  | "none"
  | "under"
  | "between"
  | "riemann"
  | "trap"
  | "volume"
  | "newtonLeibniz"
  | "averageValue";
export type SampleMode = "left" | "mid" | "right";

export interface ExpressionDraft {
  id: string;
  text: string;
  visible: boolean;
  color: string;
}

export interface CompiledExpression {
  id: string;
  raw: string;
  normalized: string;
  visible: boolean;
  color: string;
  orientation: ExpressionOrientation;
  evaluate: (value: number) => number;
}

export interface ExpressionViewModel extends ExpressionDraft {
  normalized: string;
  orientation: ExpressionOrientation;
  error: string | null;
  isValid: boolean;
}

export interface ToolState {
  mode: ToolMode;
  exprA: string | null;
  exprB: string | null;
  a: number;
  b: number;
  n: number;
  sample: SampleMode;
}

export interface GraphPoint {
  x: number;
  y: number;
  label?: string;
  color?: string;
  radius?: number;
}

export interface GraphRegion {
  x1: number;
  x2: number;
  topFn: (x: number) => number;
  bottomFn: (x: number) => number;
  fill: string;
  opacity?: number;
  stroke?: string;
  strokeWidth?: number;
}

export interface GraphPolygon {
  points: GraphPoint[];
  fill: string;
  opacity?: number;
  stroke?: string;
  strokeWidth?: number;
}

export interface GraphPolyline {
  points: GraphPoint[];
  stroke: string;
  strokeWidth?: number;
  dash?: number[];
}

export interface GraphVertical {
  x: number;
  label?: string;
  color?: string;
  dash?: number[];
}

export interface OverlayMetric {
  label: string;
  value: string;
  tone?: Tone;
}

export interface VolumeSlice {
  x: number;
  outerR: number;
  innerR: number;
  section: "disk" | "washer";
}

export interface VolumePreviewData {
  a: number;
  b: number;
  sampleX: number;
  sampleOuterR: number;
  sampleInnerR: number;
  section: "disk" | "washer";
  slices: VolumeSlice[];
}

export interface OverlayData {
  regions: GraphRegion[];
  polygons: GraphPolygon[];
  polylines: GraphPolyline[];
  points: GraphPoint[];
  verticals: GraphVertical[];
  metrics: OverlayMetric[];
  formulaTex: string | null;
  formulaSteps: string[];
  explanation: string[];
  volumePreview: VolumePreviewData | null;
}

export interface ViewBox {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
}

export interface LearningPresetExpression {
  text: string;
  visible?: boolean;
  color?: string;
}

export interface LearningPresetScenario {
  expressions: LearningPresetExpression[];
  tool: Partial<ToolState>;
  view?: Partial<ViewBox>;
  highlightedExplanation?: string | null;
}
