import {
  buildPrettyExpression,
  type PrettyFractionNode,
  type PrettyFunctionNode,
  type PrettyGroupNode,
  type PrettyNode,
  type PrettyPowerNode,
} from "./prettyExpression";

export interface MathFieldSelectionState {
  start: number;
  end: number;
  activeSlotPath: string | null;
}

export interface MathFieldPointerTarget {
  rawIndex: number;
  slotPath: string | null;
}

type MathSlotKind = "group" | "numerator" | "denominator" | "exponent" | "argument";

interface MathSlotDescriptor {
  path: string;
  kind: MathSlotKind;
  parentPath: string | null;
  contentStart: number;
  contentEnd: number;
  outerStart: number;
  outerEnd: number;
}

interface MathSlotIndex {
  slots: MathSlotDescriptor[];
  byPath: Map<string, MathSlotDescriptor>;
}

const IMPLICIT_FUNCTION_NAMES = new Set([
  "sin",
  "cos",
  "tan",
  "sec",
  "csc",
  "cot",
  "asin",
  "acos",
  "atan",
  "asec",
  "acsc",
  "acot",
  "sinh",
  "cosh",
  "tanh",
  "asinh",
  "acosh",
  "atanh",
  "sqrt",
  "abs",
  "ln",
  "log",
  "exp",
  "lg",
]);

const IMPLICIT_TOKEN_NAMES = new Set(["x", "y", "e", "pi", ...IMPLICIT_FUNCTION_NAMES]);
const IMPLICIT_TOKEN_PREFIXES = Array.from(IMPLICIT_TOKEN_NAMES).flatMap((name) =>
  Array.from({ length: name.length }, (_, index) => name.slice(0, index + 1)),
);

function makeSelection(start: number, end = start, activeSlotPath: string | null = null): MathFieldSelectionState {
  return { start, end, activeSlotPath };
}

function slotDepth(path: string): number {
  return path.split("/").length;
}

function isCollapsed(state: MathFieldSelectionState): boolean {
  return state.start === state.end;
}

function appendSlot(
  slots: MathSlotDescriptor[],
  byPath: Map<string, MathSlotDescriptor>,
  descriptor: MathSlotDescriptor,
) {
  slots.push(descriptor);
  byPath.set(descriptor.path, descriptor);
}

function collectSlots(
  node: PrettyNode,
  nodePath: string,
  containerSlotPath: string | null,
  slots: MathSlotDescriptor[],
  byPath: Map<string, MathSlotDescriptor>,
) {
  switch (node.kind) {
    case "leaf":
    case "placeholder":
      return;

    case "sequence":
      node.children.forEach((child, index) => collectSlots(child, `${nodePath}/${index}`, containerSlotPath, slots, byPath));
      return;

    case "group": {
      const groupPath = `${nodePath}/group`;
      appendSlot(slots, byPath, {
        path: groupPath,
        kind: "group",
        parentPath: containerSlotPath,
        contentStart: node.content.rawStart,
        contentEnd: node.content.rawEnd,
        outerStart: node.openStart,
        outerEnd: node.closeEnd ?? node.content.rawEnd,
      });
      collectSlots(node.content, `${groupPath}/content`, groupPath, slots, byPath);
      return;
    }

    case "power": {
      const exponentPath = `${nodePath}/exp`;
      appendSlot(slots, byPath, {
        path: exponentPath,
        kind: "exponent",
        parentPath: containerSlotPath,
        contentStart: node.exponent.rawStart,
        contentEnd: node.exponent.rawEnd,
        outerStart: node.exponent.rawStart,
        outerEnd: node.exponent.rawEnd,
      });
      collectSlots(node.base, `${nodePath}/base`, containerSlotPath, slots, byPath);
      collectSlots(node.exponent, `${exponentPath}/content`, exponentPath, slots, byPath);
      return;
    }

    case "fraction": {
      const numeratorPath = `${nodePath}/num`;
      appendSlot(slots, byPath, {
        path: numeratorPath,
        kind: "numerator",
        parentPath: containerSlotPath,
        contentStart: node.numerator.rawStart,
        contentEnd: node.numerator.rawEnd,
        outerStart: node.numerator.rawStart,
        outerEnd: node.numerator.rawEnd,
      });
      collectSlots(node.numerator, `${numeratorPath}/content`, numeratorPath, slots, byPath);

      const denominatorPath = `${nodePath}/den`;
      if (node.denominator.kind === "group") {
        appendSlot(slots, byPath, {
          path: denominatorPath,
          kind: "denominator",
          parentPath: containerSlotPath,
          contentStart: node.denominator.content.rawStart,
          contentEnd: node.denominator.content.rawEnd,
          outerStart: node.denominator.openStart,
          outerEnd: node.denominator.closeEnd ?? node.denominator.content.rawEnd,
        });
        collectSlots(
          node.denominator.content,
          `${denominatorPath}/content`,
          denominatorPath,
          slots,
          byPath,
        );
        return;
      }

      appendSlot(slots, byPath, {
        path: denominatorPath,
        kind: "denominator",
        parentPath: containerSlotPath,
        contentStart: node.denominator.rawStart,
        contentEnd: node.denominator.rawEnd,
        outerStart: node.denominator.rawStart,
        outerEnd: node.denominator.rawEnd,
      });
      collectSlots(node.denominator, `${denominatorPath}/content`, denominatorPath, slots, byPath);
      return;
    }

    case "function": {
      node.args.forEach((argument, index) => {
        const argumentPath = `${nodePath}/arg${index}`;
        appendSlot(slots, byPath, {
          path: argumentPath,
          kind: "argument",
          parentPath: containerSlotPath,
          contentStart: argument.rawStart,
          contentEnd: argument.rawEnd,
          outerStart: argument.rawStart,
          outerEnd: argument.rawEnd,
        });
        collectSlots(argument, `${argumentPath}/content`, argumentPath, slots, byPath);
      });
      return;
    }
  }
}

function buildSlotIndex(raw: string): MathSlotIndex {
  const slots: MathSlotDescriptor[] = [];
  const byPath = new Map<string, MathSlotDescriptor>();
  collectSlots(buildPrettyExpression(raw), "root", null, slots, byPath);
  return { slots, byPath };
}

function slotContainsPosition(slot: MathSlotDescriptor, position: number): boolean {
  return position >= slot.contentStart && position <= slot.contentEnd;
}

function slotOwnsBoundary(slot: MathSlotDescriptor, position: number): boolean {
  return position === slot.contentStart || position === slot.contentEnd;
}

function resolvePreferredSlot(
  index: MathSlotIndex,
  position: number,
  preferredPath: string | null,
): MathSlotDescriptor | null {
  if (!preferredPath) {
    return null;
  }

  const preferred = index.byPath.get(preferredPath);
  if (!preferred) {
    return null;
  }

  return slotContainsPosition(preferred, position) ? preferred : null;
}

function resolveDeepestSlot(index: MathSlotIndex, position: number): MathSlotDescriptor | null {
  const matches = index.slots
    .filter((slot) => slotContainsPosition(slot, position))
    .sort((left, right) => slotDepth(right.path) - slotDepth(left.path) || (left.contentEnd - left.contentStart) - (right.contentEnd - right.contentStart));

  return matches[0] ?? null;
}

function findDeepestChildEndingAt(index: MathSlotIndex, parentPath: string, position: number): MathSlotDescriptor | null {
  const matches = index.slots
    .filter(
      (slot) =>
        slot.parentPath === parentPath &&
        slot.contentEnd === position,
    )
    .sort((left, right) => slotDepth(right.path) - slotDepth(left.path));

  return matches[0] ?? null;
}

function findDeepestSlotEndingAt(index: MathSlotIndex, position: number): MathSlotDescriptor | null {
  const matches = index.slots
    .filter((slot) => slot.contentEnd === position)
    .sort((left, right) => slotDepth(right.path) - slotDepth(left.path));

  return matches[0] ?? null;
}

function findSlotWithOuterEnd(index: MathSlotIndex, position: number): MathSlotDescriptor | null {
  const matches = index.slots
    .filter((slot) => slot.outerEnd === position && slot.outerEnd > slot.contentEnd)
    .sort((left, right) => slotDepth(right.path) - slotDepth(left.path));

  return matches[0] ?? null;
}

function isSimpleCollapsibleNode(node: PrettyNode): boolean {
  switch (node.kind) {
    case "leaf":
    case "placeholder":
      return true;
    case "power":
      return true;
    case "function":
      return node.args.every(isSimpleCollapsibleNode);
    case "group":
      return isSimpleCollapsibleNode(node.content);
    case "sequence":
      return false;
    case "fraction":
      return false;
  }
}

function collectSimpleFractionGroupRanges(node: PrettyNode, ranges: Array<{ start: number; end: number }>) {
  switch (node.kind) {
    case "leaf":
    case "placeholder":
      return;

    case "sequence":
      node.children.forEach((child) => collectSimpleFractionGroupRanges(child, ranges));
      return;

    case "group":
      collectSimpleFractionGroupRanges(node.content, ranges);
      return;

    case "power":
      collectSimpleFractionGroupRanges(node.base, ranges);
      collectSimpleFractionGroupRanges(node.exponent, ranges);
      return;

    case "function":
      node.args.forEach((argument) => collectSimpleFractionGroupRanges(argument, ranges));
      return;

    case "fraction":
      collectSimpleFractionGroupRanges(node.numerator, ranges);
      collectSimpleFractionGroupRanges(node.denominator, ranges);
      if (
        node.denominator.kind === "group" &&
        node.denominator.closeStart !== null &&
        node.denominator.closeEnd !== null &&
        isSimpleCollapsibleNode(node.denominator.content)
      ) {
        ranges.push({ start: node.denominator.openStart, end: node.denominator.openEnd });
        ranges.push({ start: node.denominator.closeStart, end: node.denominator.closeEnd });
      }
      return;
  }
}

function clampSelection(raw: string, selection: MathFieldSelectionState): MathFieldSelectionState {
  const max = raw.length;
  const start = Math.max(0, Math.min(selection.start, max));
  const end = Math.max(start, Math.min(selection.end, max));
  return { ...selection, start, end };
}

function needsImplicitProduct(raw: string, caret: number, key: string): boolean {
  if (!/^[a-z]$/i.test(key) || caret <= 0) {
    return false;
  }

  const before = raw.slice(0, caret);
  const previousChar = before[before.length - 1] ?? "";
  const previousToken = before.match(/[a-z]+$/i)?.[0]?.toLowerCase() ?? "";
  if (!previousToken) {
    return /[0-9)]/.test(previousChar);
  }

  if (!IMPLICIT_TOKEN_NAMES.has(previousToken) || IMPLICIT_FUNCTION_NAMES.has(previousToken)) {
    return false;
  }

  const combined = `${previousToken}${key.toLowerCase()}`;
  return !IMPLICIT_TOKEN_PREFIXES.some((prefix) => prefix === combined);
}

export function resolveActiveSlotPath(raw: string, position: number, preferredPath: string | null): string | null {
  const index = buildSlotIndex(raw);
  const preferred = resolvePreferredSlot(index, position, preferredPath);
  const deepest = resolveDeepestSlot(index, position);

  if (
    preferred &&
    deepest &&
    deepest.path !== preferred.path &&
    slotDepth(deepest.path) > slotDepth(preferred.path) &&
    slotOwnsBoundary(deepest, position)
  ) {
    return deepest.path;
  }

  if (preferred) {
    return preferred.path;
  }

  return deepest?.path ?? null;
}

export function applyMathFieldCharacter(
  raw: string,
  state: MathFieldSelectionState,
  key: string,
): { handled: boolean; raw: string; next: MathFieldSelectionState } {
  const selection = clampSelection(raw, state);
  const normalizedKey = /^[a-z]$/i.test(key) ? key.toLowerCase() : key;

  if (!isCollapsed(selection)) {
    const updated = `${raw.slice(0, selection.start)}${normalizedKey}${raw.slice(selection.end)}`;
    const position = selection.start + normalizedKey.length;
    return {
      handled: true,
      raw: updated,
      next: makeSelection(position, position, resolveActiveSlotPath(updated, position, selection.activeSlotPath)),
    };
  }

  if (normalizedKey === "/") {
    const updated = `${raw.slice(0, selection.start)}/()${raw.slice(selection.end)}`;
    const position = selection.start + 2;
    return {
      handled: true,
      raw: updated,
      next: makeSelection(position, position, resolveActiveSlotPath(updated, position, null)),
    };
  }

  const index = buildSlotIndex(raw);
  const active = resolvePreferredSlot(index, selection.start, selection.activeSlotPath);

  if (active?.kind === "exponent" && selection.start === active.contentEnd && ["+", "-", "*", "/"].includes(normalizedKey)) {
    const parentState = makeSelection(selection.start, selection.start, active.parentPath);
    if (normalizedKey === "/") {
      return applyMathFieldCharacter(raw, parentState, normalizedKey);
    }

    const updated = `${raw.slice(0, selection.start)}${normalizedKey}${raw.slice(selection.end)}`;
    const position = selection.start + normalizedKey.length;
    return {
      handled: true,
      raw: updated,
      next: makeSelection(position, position, resolveActiveSlotPath(updated, position, active.parentPath)),
    };
  }

  if (
    normalizedKey === "(" &&
    active?.kind === "denominator" &&
    active.contentStart === active.contentEnd &&
    selection.start === active.contentStart
  ) {
    return { handled: true, raw, next: selection };
  }

  if (normalizedKey === ")" && active && selection.start === active.contentEnd && active.outerEnd > active.contentEnd) {
    return {
      handled: true,
      raw,
      next: makeSelection(active.outerEnd, active.outerEnd, active.parentPath),
    };
  }

  const prefix = needsImplicitProduct(raw, selection.start, normalizedKey) ? "*" : "";
  const updated = `${raw.slice(0, selection.start)}${prefix}${normalizedKey}${raw.slice(selection.end)}`;
  const position = selection.start + prefix.length + normalizedKey.length;
  return {
    handled: true,
    raw: updated,
    next: makeSelection(
      position,
      position,
      resolveActiveSlotPath(updated, position, prefix ? null : selection.activeSlotPath),
    ),
  };
}

export function moveMathFieldSelection(
  raw: string,
  state: MathFieldSelectionState,
  direction: "left" | "right",
): MathFieldSelectionState | null {
  const selection = clampSelection(raw, state);
  if (!isCollapsed(selection)) {
    return null;
  }

  const index = buildSlotIndex(raw);
  const active =
    resolvePreferredSlot(index, selection.start, selection.activeSlotPath) ??
    resolveDeepestSlot(index, selection.start);

  if (direction === "right") {
    if (active && selection.start === active.contentEnd) {
      if (active.kind === "exponent" && active.parentPath) {
        return makeSelection(selection.start, selection.start, active.parentPath);
      }

      if (active.kind === "denominator") {
        return makeSelection(
          active.outerEnd > active.contentEnd ? active.outerEnd : selection.start,
          active.outerEnd > active.contentEnd ? active.outerEnd : selection.start,
          active.parentPath,
        );
      }

      if (active.outerEnd > active.contentEnd) {
        return makeSelection(active.outerEnd, active.outerEnd, active.parentPath);
      }
    }
    return null;
  }

  if (active) {
    const child = findDeepestChildEndingAt(index, active.path, selection.start);
    if (child) {
      return makeSelection(selection.start, selection.start, child.path);
    }
  }

  const slot = findSlotWithOuterEnd(index, selection.start);
  if (slot) {
    return makeSelection(slot.contentEnd, slot.contentEnd, slot.path);
  }

  const reentry = findDeepestSlotEndingAt(index, selection.start);
  if (reentry) {
    return makeSelection(selection.start, selection.start, reentry.path);
  }

  return null;
}

export function collapseSimpleDenominatorGroups(raw: string): string {
  const model = buildPrettyExpression(raw);
  const ranges: Array<{ start: number; end: number }> = [];
  collectSimpleFractionGroupRanges(model, ranges);

  if (!ranges.length) {
    return raw;
  }

  return ranges
    .sort((left, right) => right.start - left.start)
    .reduce((result, range) => result.slice(0, range.start) + result.slice(range.end), raw);
}
