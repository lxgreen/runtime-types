import * as A from "fp-ts/lib/Array";
import * as O from "fp-ts/lib/Option";
import { flow, pipe } from "fp-ts/lib/function";
import { isEmpty, negate, split, replace, join, curry } from "lodash/fp";

const ENUM_REGEX = /const enum (.+) \{((?:\n\s*\w+ = "\w+",?)+)\n\}/gm;
const ENUM_VAL_REGEX = /\s*\w* = ("\w+"),?/g;

const remove = (removed: string) => replace(removed, "");
const linesWith = curry(
  (filtered: string, line: string) => !line.includes(filtered)
);
const toLines = split("\n");
const mergeLines = join("\n");
const toUnion = join(" | ");
const toLiteral = replace(ENUM_VAL_REGEX, "$1");

const filterUnsupportedKeywords = (content: string) =>
  pipe(
    content,
    toLines,
    A.filter(linesWith(" function ")),
    A.filter(linesWith("sourceMappingURL=")),
    A.map(remove("declare ")),
    A.map(remove("export ")),
    mergeLines
  );

const extractEnumData = (
  regex: RegExp,
  typing: string,
  enumData: { name: string; literals: string }[] = []
): { name: string; literals: string }[] =>
  pipe(
    O.fromNullable(regex.exec(typing)),
    O.map(([, name, values]) => ({
      name,
      literals: pipe(
        values,
        toLines,
        A.map(toLiteral),
        A.filter(negate(isEmpty)),
        toUnion
      ),
    })),
    O.fold(
      () => enumData,
      ({ name, literals }) =>
        extractEnumData(regex, typing, [...enumData, { name, literals }])
    )
  );

const enumToUnion = (typing: string) =>
  extractEnumData(ENUM_REGEX, typing).reduce(
    (typing, { name, literals }) => typing.replace(name, literals),
    typing.replace(ENUM_REGEX, "")
  );

export const purifyTypes = flow(filterUnsupportedKeywords, enumToUnion);
