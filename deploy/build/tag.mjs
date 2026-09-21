// The image tag: the instance's core version and the model's short commit, so a tag names the
// one snapshot inside the image.
import { snapshot } from "./config.mjs";

const s = snapshot();
process.stdout.write(`${s.core.version}-${s.commit.slice(0, 7)}\n`);
