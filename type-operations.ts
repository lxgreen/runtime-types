import * as A from "fp-ts/lib/Array";
import * as O from "fp-ts/lib/Option";
import { flow, pipe } from "fp-ts/lib/function";
import { compact, split, replace, join } from "lodash/fp";

const toLines = split("\n");
const mergeLines = join("\n");
const toUnion = join(" | ");
const toLiteral = replace(/\s*\w* = ("\w+"),?/g, "$1");
const remove = (removed: string) => replace(removed, "");
const linesWith = (filtered: string) => (line: string) =>
  !line.includes(filtered);

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

const getEnumData = (
  getMatches: () => RegExpExecArray | null,
  enumData: { name: string; union: string }[] = []
): { name: string; union: string }[] =>
  pipe(
    O.fromNullable(getMatches()),
    O.map(([, name, values]) => ({
      name,
      union: pipe(values, toLines, A.map(toLiteral), compact, toUnion),
    })),
    O.fold(
      () => enumData,
      ({ name, union }) =>
        getEnumData(getMatches, [...enumData, { name, union }])
    )
  );

const enumToUnion = (typing: string) => {
  const ENUM_REGEX = /const enum (.+) \{((?:\n\s*\w+ = "\w+",?)+)\n\}/gm;
  const getMatches = ENUM_REGEX.exec.bind(ENUM_REGEX, typing);
  return getEnumData(getMatches).reduce(
    (typing, { name, union }) => typing.replace(name, union),
    typing.replace(ENUM_REGEX, "")
  );
};

export const purifyTypes = flow(filterUnsupportedKeywords, enumToUnion);
