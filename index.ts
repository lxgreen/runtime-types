import * as E from "fp-ts/lib/Either";
import * as A from "fp-ts/lib/Array";
import * as TE from "fp-ts/lib/TaskEither";
import * as T from "fp-ts/lib/Task";
import { join } from "lodash/fp";
import { pipe } from "fp-ts/lib/function";
import { generateRtoModules, RtoModules } from "typeonly";

import {
  getTypingFileList,
  getFileContents,
  writeContentToFile,
} from "./file-operations";
import { purifyTypes } from "./type-operations";

const log = (label: string) => <T>(data: T): T => {
  console.log(label);
  console.dir(data);
  return data;
};

async function run() {
  const TYPES_DIR_GLOB =
    "./node_modules/ricos-schema/dist/types/rich_content/*.d.ts";
  const SAFE_TYPES_PATH = "./dist/types.d.ts";

  const generateRto = () =>
    TE.tryCatch(
      () =>
        generateRtoModules({
          modulePaths: ["./types"],
          readFiles: {
            sourceDir: `${__dirname}/dist`,
          },
          writeFiles: {
            outputDir: "./dist",
            prettify: 2,
          },
          returnRtoModules: true,
        }),
      E.toError
    );

  const preprocessTypes = pipe(
    getTypingFileList(TYPES_DIR_GLOB),
    TE.chain((paths) =>
      A.array.traverse(TE.taskEither)(paths, getFileContents)
    ),
    TE.map(A.map(purifyTypes)),
    TE.map(join("\n")),
    TE.chain(writeContentToFile(SAFE_TYPES_PATH)),
    TE.chain(generateRto)
    // TE.fold(
    //   (e) => T.of(`error occurred: ${e.message}`),
    //   (modules) => T.of(modules)
    // )
  );

  const files = await preprocessTypes();
  console.log(files);
}

run();
