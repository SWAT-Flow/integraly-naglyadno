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
  pendingAutoExponentPath?: string | null;
}

export interface MathFieldPointerTarget {
  rawIndex: number;
  slotPath: string | null;
}

type MathSlotKind = "group" | "numerator" | "denominator" | "exponent" | "argument" | "logBase";

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

interface SlotBounds {
  contentStart: number;
  contentEnd: number;
  outerStart: number;
  outerEnd: number;
  contentNode: PrettyNode;
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

function makeSelection(
  start: number,
  end = start,
  activeSlotPath: string | null = null,
  pendingAutoExponentPath: string | null = null,
): MathFieldSelectionState {
  return { start, end, activeSlotPath, pendingAutoExponentPath };
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

function getWrappedSlotBounds(node: PrettyNode): SlotBounds {
  if (node.kind === "group") {
    return {
      contentStart: node.content.rawStart,
      contentEnd: node.content.rawEnd,
      outerStart: node.openStart,
      outerEnd: node.closeEnd ?? node.content.rawEnd,
      contentNode: node.content,
    };
  }

  return {
    contentStart: node.rawStart,
    contentEnd: node.rawEnd,
    outerStart: node.rawStart,
    outerEnd: node.rawEnd,
    contentNode: node,
  };
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
      const exponentBounds = getWrappedSlotBounds(node.exponent);
      appendSlot(slots, byPath, {
        path: exponentPath,
        kind: "exponent",
        parentPath: containerSlotPath,
        contentStart: exponentBounds.contentStart,
        contentEnd: exponentBounds.contentEnd,
        outerStart: exponentBounds.outerStart,
        outerEnd: exponentBounds.outerEnd,
      });
      collectSlots(node.base, `${nodePath}/base`, containerSlotPath, slots, byPath);
      collectSlots(exponentBounds.contentNode, `${exponentPath}/content`, exponentPath, slots, byPath);
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
        const argumentBounds = getWrappedSlotBounds(argument);
        appendSlot(slots, byPath, {
          path: argumentPath,
          kind: node.functionType === "logBase" && index === 0 ? "logBase" : "argument",
          parentPath: containerSlotPath,
          contentStart: argumentBounds.contentStart,
          contentEnd: argumentBounds.contentEnd,
          outerStart: argumentBounds.outerStart,
          outerEnd: argumentBounds.outerEnd,
        });
        collectSlots(argumentBounds.contentNode, `${argumentPath}/content`, argumentPath, slots, byPath);
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

function getArgumentSibling(index: MathSlotIndex, path: string, direction: -1 | 1): MathSlotDescriptor | null {
  const match = /^(.*\/arg)(\d+)$/.exec(path);
  if (!match) {
    return null;
  }

  return index.byPath.get(`${match[1]}${Number(match[2]) + direction}`) ?? null;
}

function getFractionSibling(index: MathSlotIndex, path: string, targetKind: "numerator" | "denominator"): MathSlotDescriptor | null {
  const match = /^(.*\/)(num|den)$/.exec(path);
  if (!match) {
    return null;
  }

  const siblingSuffix = targetKind === "numerator" ? "num" : "den";
  return index.byPath.get(`${match[1]}${siblingSuffix}`) ?? null;
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
      if (
        node.exponent.kind === "group" &&
        node.exponent.closeStart !== null &&
        node.exponent.closeEnd !== null &&
        isSimpleCollapsibleNode(node.exponent.content)
      ) {
        ranges.push({ start: node.exponent.openStart, end: node.exponent.openEnd });
        ranges.push({ start: node.exponent.closeStart, end: node.exponent.closeEnd });
        collectSimpleFractionGroupRanges(node.exponent.content, ranges);
        return;
      }
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
      next: makeSelection(
        position,
        position,
        resolveActiveSlotPath(updated, position, selection.activeSlotPath),
        selection.pendingAutoExponentPath ?? null,
      ),
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

  if (normalizedKey === "^") {
    const updated = `${raw.slice(0, selection.start)}^()${raw.slice(selection.end)}`;
    const position = selection.start + 2;
    const exponentPath = resolveActiveSlotPath(updated, position, null);
    return {
      handled: true,
      raw: updated,
      next: makeSelection(position, position, exponentPath, exponentPath),
    };
  }

  if (/^[a-z0-9]$/i.test(normalizedKey) && raw.slice(0, selection.start).toLowerCase().endsWith("sqrt")) {
    const functionStart = selection.start - 4;
    const updated = `${raw.slice(0, functionStart)}sqrt(${normalizedKey})${raw.slice(selection.end)}`;
    const position = functionStart + `sqrt(${normalizedKey}`.length;
    return {
      handled: true,
      raw: updated,
      next: makeSelection(position, position, resolveActiveSlotPath(updated, position, null)),
    };
  }

  const index = buildSlotIndex(raw);
  const active = resolvePreferredSlot(index, selection.start, selection.activeSlotPath);

  if (
    normalizedKey === "(" &&
    (active?.kind === "denominator" || active?.kind === "exponent") &&
    active.contentStart === active.contentEnd &&
    selection.start === active.contentStart
  ) {
    return {
      handled: true,
      raw,
      next: makeSelection(selection.start, selection.end, selection.activeSlotPath, null),
    };
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
      selection.pendingAutoExponentPath === active?.path ? selection.pendingAutoExponentPath : null,
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
      if (active.kind === "numerator") {
        const denominator = getFractionSibling(index, active.path, "denominator");
        if (denominator) {
          return makeSelection(denominator.contentStart, denominator.contentStart, denominator.path);
        }
      }

      if (active.kind === "logBase") {
        const nextArgument = getArgumentSibling(index, active.path, 1);
        if (nextArgument) {
          return makeSelection(nextArgument.contentStart, nextArgument.contentStart, nextArgument.path);
        }
      }

      if (active.kind === "exponent" && active.parentPath) {
        const nextPosition = active.outerEnd > active.contentEnd ? active.outerEnd : selection.start;
        return makeSelection(nextPosition, nextPosition, active.parentPath);
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

  if (active?.kind === "argument" && selection.start === active.contentStart) {
    const previousArgument = getArgumentSibling(index, active.path, -1);
    if (previousArgument) {
      return makeSelection(previousArgument.contentEnd, previousArgument.contentEnd, previousArgument.path);
    }
  }

  if (active?.kind === "denominator" && selection.start === active.contentStart) {
    const numerator = getFractionSibling(index, active.path, "numerator");
    if (numerator) {
      return makeSelection(numerator.contentEnd, numerator.contentEnd, numerator.path);
    }
  }

  if (active?.kind === "exponent") {
    if (selection.start > active.contentStart) {
      return null;
    }

    if (active.parentPath) {
      const parent = index.byPath.get(active.parentPath);
      if (parent) {
        return makeSelection(parent.contentStart, parent.contentStart, parent.path);
      }
    }
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
  if (reentry && reentry.path !== active?.path) {
    return makeSelection(selection.start, selection.start, reentry.path);
  }

  return null;
}

export function applyMathFieldBackspace(
  raw: string,
  state: MathFieldSelectionState,
): { handled: boolean; raw: string; next: MathFieldSelectionState } | null {
  const selection = clampSelection(raw, state);
  if (!isCollapsed(selection)) {
    return null;
  }

  const index = buildSlotIndex(raw);
  const active =
    resolvePreferredSlot(index, selection.start, selection.activeSlotPath) ??
    resolveDeepestSlot(index, selection.start);

  if (!active) {
    return null;
  }

  if (active.kind === "argument" && selection.start === active.contentStart) {
    const previousArgument = getArgumentSibling(index, active.path, -1);
    if (previousArgument) {
      return {
        handled: true,
        raw,
        next: makeSelection(previousArgument.contentEnd, previousArgument.contentEnd, previousArgument.path),
      };
    }
  }

  if (
    (active.kind === "logBase" ||
      active.kind === "argument" ||
      active.kind === "denominator" ||
      active.kind === "exponent" ||
      active.kind === "group") &&
    selection.start === active.contentStart
  ) {
    return {
      handled: true,
      raw,
      next: makeSelection(selection.start, selection.start, active.path, state.pendingAutoExponentPath ?? null),
    };
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
