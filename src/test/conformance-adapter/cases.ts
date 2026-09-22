import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

/**
 * Loads the conformance case files.
 *
 * The cases live in `cases/`, fetched by `scripts/fetch-conformance.sh` from
 * the version pinned in `conformance.lock`. They are not checked in: the lock
 * file plus its checksum is what makes a suite bump a reviewable one-line
 * diff, and a committed copy would drift from the tag it claims to be.
 */

const CASES_DIR = join(__dirname, '..', 'conformance', 'cases');

/** A rule id from SPEC.md, such as `R5` or `R22a`. */
export type Rule = string;

interface CaseFile<T> {
  suite: string;
  version: number;
  cases: T[];
}

export interface EvaluationCase {
  name: string;
  rules: Rule[];
  why?: string;
  now: string;
  features: Record<string, unknown>;
  key: string;
  expected: boolean;
}

export interface DecoratorCase {
  name: string;
  rules: Rule[];
  why?: string;
  target: 'class' | 'method' | 'async-method';
  toggle: 'on' | 'off' | 'on-then-off' | 'off-then-on' | 'no-provider';
  fallback: 'none' | 'class' | 'method';
  expected:
    | 'original'
    | 'fallback'
    | 'nothing'
    | 'resolved-nothing'
    | 'empty-shell'
    | 'decoration-error';
  assertions?: ('same-arguments' | 'same-receiver')[];
}

export interface MappingCase {
  name: string;
  rules: Rule[];
  why?: string;
  shape: 'feature' | 'boolean';
  response: unknown;
  expected: Record<string, unknown>;
}

function load<T>(suite: string): CaseFile<T> {
  const path = join(CASES_DIR, `${suite}.json`);

  if (!existsSync(path)) {
    throw new Error(
      `Conformance cases missing at ${path}.\n` +
        'Run scripts/fetch-conformance.sh before the tests; CI does this in a ' +
        'dedicated step.'
    );
  }

  const file = JSON.parse(readFileSync(path, 'utf8')) as CaseFile<T>;
  if (file.suite !== suite) {
    throw new Error(`${path} declares suite "${file.suite}", expected "${suite}"`);
  }
  return file;
}

export const evaluationCases = () => load<EvaluationCase>('evaluation').cases;
export const decoratorCases = () => load<DecoratorCase>('decorator').cases;
export const mappingCases = () => load<MappingCase>('mapping').cases;

/**
 * Names a case for the test output, so a failure points at a rule without
 * anyone having to open the case file.
 */
export function title(c: { name: string; rules: Rule[] }): string {
  return `${c.name} [${c.rules.join(', ')}]`;
}

/**
 * Rejects a value the adapter does not know how to handle.
 *
 * A case whose `target`, `toggle` or `expected` this adapter has never seen is
 * a rule that nothing enforces here. Skipping it would leave the suite looking
 * green while a requirement goes unchecked, so an unknown value is a failure
 * instead -- it means the suite grew and the adapter has to catch up.
 */
export function unsupported(kind: string, value: string, caseName: string): never {
  throw new Error(
    `Case "${caseName}" uses ${kind} "${value}", which this adapter does not ` +
      'implement. The conformance suite has gained a case this port does not ' +
      'cover yet -- extend the adapter rather than skipping the case.'
  );
}
