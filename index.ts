import * as E from "fp-ts/lib/Either";
import * as A from "fp-ts/lib/Array";
import { pipe } from "fp-ts/lib/function";
import * as TE from "fp-ts/lib/TaskEither";
import * as T from "fp-ts/lib/Task";
import { join } from "lodash/fp";

import {
  getTypingFileList,
  getFileContents,
  writeContentToFile,
} from "./file-operations";
import { purifyTypes } from "./type-operations";

async function run() {
  const TYPES_DIR_GLOB =
    "./node_modules/ricos-schema/dist/types/rich_content/*.d.ts";
  const SAFE_TYPES_PATH = "./dist/types.d.ts";
  const preprocessTypes = pipe(
    getTypingFileList(TYPES_DIR_GLOB),
    TE.chain((paths) =>
      A.array.traverse(TE.taskEither)(paths, getFileContents)
    ),
    TE.map(A.map(purifyTypes)),
    TE.map(join("\n")),
    TE.chain(writeContentToFile(SAFE_TYPES_PATH)),
    TE.fold(
      (e) => T.of(`error occurred: ${e.message}`),
      () => T.of("done")
    )
  );

  const files = await preprocessTypes();
  console.log(files);
}

run();
