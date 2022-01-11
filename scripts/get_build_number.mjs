import parseFile from "./lib/parse_file.mjs";

const [, , platform] = process.argv;

switch (platform) {
  case "android":
  case "browser":
    const { widget } = await parseFile("config.xml");

    console.log(widget.$["android-versionCode"]);
    break;
  case "ios":
  case "osx":
    const { 
      plist: { 
        dict: 
          [{ 
            key: plistKeys, 
            string: plistValues 
        }] 
      } 
    } = await parseFile(`apple/xcode/${platform}/Outline/Outline-Info.plist`);

    console.log(plistValues[plistKeys.indexOf("CFBundleVersion")]);
    break;
  case "windows":
  case "linux":
  default:
    console.log("NA");
    break;
}
