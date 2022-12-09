import {getRootDir} from '../../build/get_root_dir.mjs';
import {readFile, readdir, writeFile} from 'fs/promises';
import {getNativeAndroidMessageDirectory} from './get_native_android_message_directory.mjs';
import XML from 'xmlbuilder2';

export async function main() {
  const files = await readdir(`${getRootDir()}/www/messages`);

  for (const filepath of files) {
    const xmlStrings = [];
    for (const messageId in JSON.parse(await readFile(filepath, 'utf8'))) {
      xmlStrings.push({
        '@name': messageId.replaceAll('-', '_'),
      });
    }

    await writeFile(
      `${getNativeAndroidMessageDirectory(filepath)}/strings.xml`,
      XML.create({
        resources: {string: xmlStrings},
      }).end()
    );
  }
}
