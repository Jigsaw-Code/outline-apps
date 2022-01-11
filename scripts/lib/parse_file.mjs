import fs from "fs";
import xml2js from "xml2js";

export default filePath =>
  new Promise(
    (resolve, reject) =>
      xml2js.parseString(fs.readFileSync(filePath), (error, result) =>
        error
          ? reject(error)
          : resolve(result)
      )
  );