import { promisify } from "util";
import { readFile, appendFile } from "fs";
// import { parse } from "path";
import globby from "globby";
import * as E from "fp-ts/lib/Either";
import * as A from "fp-ts/lib/Array";
import { flow, pipe } from "fp-ts/lib/function";
import * as TE from "fp-ts/lib/TaskEither";
import * as T from "fp-ts/lib/Task";

import { curry } from "lodash/fp";

const TYPES_DIR_GLOB =
  "./node_modules/ricos-schema/dist/types/rich_content/*.d.ts";

const MERGED_FILE = "./merged";

// TODO: replace with logging-ts?
const log = (label: string) => (data: unknown) => {
  console.log(label);
  console.dir(data);
  return data;
};

const readFromFile = promisify(readFile);
const writeToFile = promisify(appendFile);

const getTypingFileList = (glob: string) =>
  TE.tryCatch(() => <Promise<string[]>>globby(glob), E.toError);

const getFileContents = (path: string) =>
  TE.tryCatch(() => readFromFile(path, "utf-8"), E.toError);

const writeContentsToFile = (path: string) => (contents: string) =>
  TE.tryCatch(() => writeToFile(path, contents), E.toError);

const remove = curry((removed: string, processed: string) =>
  processed.replace(removed, "")
);

const linesWith = curry(
  (removed: string, line: string) => !line.includes(removed)
);

const sanitizeTyping = (content: string) =>
  pipe(
    content.split("\n"),
    A.filter(linesWith(" function ")),
    A.filter(linesWith("sourceMappingURL=")),
    A.map(remove("declare ")),
    A.map(remove("export ")),
    A.reduce("", (acc, line) => acc.concat(line).concat("\n"))
  );

const extractEnumData = (
  regex: RegExp,
  typing: string,
  enumData: { name: string; literals: string }[] = []
): { name: string; literals: string }[] => {
  const matches = regex.exec(typing);
  if (!matches) {
    return enumData;
  }
  const [, name, values] = matches;
  const literals = values
    .split("\n")
    .map((line) => line.replace(/\s*\w* = ("\w+"),?/g, "$1"))
    .filter((line) => !!line)
    .join(" | ");
  enumData.push({ name, literals });
  return extractEnumData(regex, typing, enumData);
};

const enumToUnion = (typing: string) => {
  const ENUM_REGEX = /const enum (.+) \{((?:\n\s*\w+ = "\w+",?)+)\n\}/gm;
  const enumData = extractEnumData(ENUM_REGEX, typing);
  const cleaned = typing.replace(ENUM_REGEX, ``);
  return enumData.reduce(
    (typing, { name, literals }) => typing.replace(name, literals),
    cleaned
  );
};

async function run() {
  const fileListTE = pipe(
    getTypingFileList(TYPES_DIR_GLOB),
    TE.chain((paths) =>
      A.array.traverse(TE.taskEither)(paths, getFileContents)
    ),
    TE.map(A.map(sanitizeTyping)),
    TE.map(A.map(enumToUnion)),
    TE.fold(
      (e) => T.of(`error occurred: ${e.message}`),
      (res) => T.of(res.join("\n"))
    )
  );

  const files = await fileListTE();
  console.log(files);

  // const getFileData = flow(
  //   getFileContents,
  //   chain((rawString: string) => fromIOEither(parseStringifiedData(rawString)))
  // );
  //
  // export const generateTypeDecriptors = (path: string) => (data: Todo) =>
  //   flow(
  //     getFileData,
  //     map(append(data)),
  //     chain((todos) => fromIOEither(stringifyData(todos))),
  //     chain(writeContentsToFile(FILE_PATH))
  //   )(path);
}

run();
