/* eslint-disable jsdoc/require-jsdoc */
import * as fs from "fs";
import path, { dirname } from "path";
import { parseArgs } from "util";

const DEST_ROOT_DIR = "foundry";  // Hardcoded because it's referenced in jsconfig
const ABORT = "abort";

await (async () => {
    process.exitCode = 1;

    const options = getOptions();
    if(!options) return;

    const sourceRootDir = getSourceRootDir(options.installPath);
    if(!sourceRootDir) return;

    // Create destinatin dir if it doesn't already exist.
    await fs.promises.mkdir(DEST_ROOT_DIR, { recursive: true });

    // Link JS files
    for(const p of ["client", "common", "tsconfig.json"]) {
        const targetPath = path.join(sourceRootDir, p);
        const symlinkPath = path.join(DEST_ROOT_DIR, p);

        if(await tryCreateSymlink(targetPath, symlinkPath) === ABORT) return;
    }

    // Link Lang files
    const targetPath = path.join(sourceRootDir, "public", "lang");
    const symlinkPath = path.join(DEST_ROOT_DIR, "lang");

    if(await tryCreateSymlink(targetPath, symlinkPath) === ABORT) return;

    console.log("Successfully created foundry symlinks.");
    process.exitCode = 0;
})();


function getOptions() {
    const { values: parsedArgs } = parseArgs({ 
        options: {
            'foundry-install-path': { type: "string" }
        }
    });

    const opts = {
        installPath: parsedArgs["foundry-install-path"]
    }

    if(!opts.installPath) return console.error("Missing required argument '--foundry-install-path=<string>'");
    if(!fs.existsSync(opts.installPath)) return console.error(`Foundry install path does not exist: ${opts.installPath}`);

    return opts;
}


/**
 * @param {string} foundryInstallPath 
 */
function getSourceRootDir(foundryInstallPath) {
    // As of 13.338, the Node install is not nested but electron installs are
    const isNested = fs.existsSync(path.join(foundryInstallPath, "resources", "app"));

    const root = isNested 
        ? path.join(foundryInstallPath, "resources", "app")
        : foundryInstallPath;

    if(!fs.existsSync(root)) {
        console.error(`Foundry install path '${root}' does not exist.`);
        return;
    }

    return root;
}

/**
 * @param {string} targetPath 
 * @param {string} symlinkPath
 */
async function tryCreateSymlink(targetPath, symlinkPath) {
    const stat = await fs.promises.lstat(symlinkPath, { throwIfNoEntry: false });

    // Does the path already exist?
    if(stat) {
        // Is it a non-symlink file/dir?
        if(!stat.isSymbolicLink()) {
            console.error(`Unable to create symlink because file/directory exists at: ${symlinkPath}`);
            console.error("Remove existing file/directory and run this script again.");
            return ABORT;
        }

        // Is the existing symlink already correct?
        const currentTarget = await fs.promises.readlink(symlinkPath);
        const absoluteCurrent = path.resolve(path.dirname(symlinkPath), currentTarget); // Resolve paths to handle both absolute and relative targets accurately
        const absoluteTarget = path.resolve(targetPath);
        if(absoluteCurrent === absoluteTarget) return;

        console.log(`Unlinking existing symlink: ${symlinkPath}`);
        await fs.promises.unlink(symlinkPath);
    }

    await fs.promises.symlink(targetPath, symlinkPath);
    console.log(`Symlinked: ${symlinkPath} -> ${targetPath}`);
}
