import { randomBytes } from "node:crypto";

export type AttributeValue = string | number | boolean | readonly string[];
export type Attributes = Record<string, AttributeValue | undefined>;

type OtlpAnyValue =
  | { stringValue: string }
  | { boolValue: boolean }
  | { intValue: string }
  | { doubleValue: number }
  | { arrayValue: { values: { stringValue: string }[] } };

type OtlpKeyValue = { key: string; value: OtlpAnyValue };

const SPAN_KIND_INTERNAL = 1;
const STATUS_CODE_UNSET = 0;
const STATUS_CODE_ERROR = 2;

function toAnyValue(value: AttributeValue): OtlpAnyValue {
  if (typeof value === "string") {
    return { stringValue: value };
  }
  if (typeof value === "boolean") {
    return { boolValue: value };
  }
  if (typeof value === "number") {
    return Number.isInteger(value) ? { intValue: String(value) } : { doubleValue: value };
  }
  return { arrayValue: { values: value.map((item) => ({ stringValue: item })) } };
}

function toKeyValues(attributes: Attributes): OtlpKeyValue[] {
  return Object.entries(attributes)
    .filter((entry): entry is [string, AttributeValue] => entry[1] !== undefined)
    .map(([key, value]) => ({ key, value: toAnyValue(value) }));
}

function toUnixNano(epochMs: number): string {
  return (BigInt(Math.round(epochMs)) * 1_000_000n).toString();
}

type Scope = { name: string; version: string };

export type TraceContext = { traceId: string; spanId: string };

export function createTraceContext(): TraceContext {
  return { traceId: randomBytes(16).toString("hex"), spanId: randomBytes(8).toString("hex") };
}

export type SpanInput = {
  name: string;
  context: TraceContext;
  startTime: number;
  endTime: number;
  attributes: Attributes;
  isError: boolean;
};

export function buildTracesPayload(resource: Attributes, scope: Scope, span: SpanInput) {
  return {
    resourceSpans: [
      {
        resource: { attributes: toKeyValues(resource) },
        scopeSpans: [
          {
            scope,
            spans: [
              {
                traceId: span.context.traceId,
                spanId: span.context.spanId,
                name: span.name,
                kind: SPAN_KIND_INTERNAL,
                startTimeUnixNano: toUnixNano(span.startTime),
                endTimeUnixNano: toUnixNano(span.endTime),
                attributes: toKeyValues(span.attributes),
                status: { code: span.isError ? STATUS_CODE_ERROR : STATUS_CODE_UNSET },
              },
            ],
          },
        ],
      },
    ],
  };
}
