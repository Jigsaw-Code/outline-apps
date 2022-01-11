import parseFile from "./lib/parse_file.mjs";

const [, , platform] = process.argv;

switch (platform) {
  case "android":
  case "browser":
    const { widget } = await parseFile("config.xml");

    console.log(widget.$.version);
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

    console.log(plistValues[plistKeys.indexOf("CFBundleShortVersionString")]);
    break;
  case "windows":
    console.log("1.7.0");
    break;
  case "linux":
  default:
    console.log("1.4.0");
    break;
}
