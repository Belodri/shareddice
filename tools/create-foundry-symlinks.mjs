/* eslint-disable jsdoc/require-jsdoc */
import * as fs from "fs";
import yaml from "js-yaml";
import path from "path";

/*
    Env vars:
    "foundry-config-path": string (default "foundry-config.yaml")
    "dest-root-dir": string (default "foundry")
*/
await execute()

async function execute() {
    process.exitCode = 1;

    const options = getEnvOptions();

    const config = await loadConfig(options.foundryConfigPath);
    if(!config) return;

    const sourceRootDir = getSourceRootDir(config);
    if(!sourceRootDir) return false;

    await createDestinationRootDir(options.destRootDir);
    await linkJsFiles(sourceRootDir, options.destRootDir);
    await linkLangFiles(sourceRootDir, options.destRootDir);

    console.log("Successfully created foundry symlinks.");
    process.exitCode = 0;
}

/**
 * @typedef {object} EnvOptions
 * @property {string} foundryConfigPath
 * @property {string} destRootDir
 */

function getEnvOptions() {
    const foundryConfigPath = process.env.npm_config_foundry_config_path ?? "foundry-config.yaml";
    const destRootDir = process.env.npm_config_dest_root_dir ?? "foundry";

    /** @type {EnvOptions} */
    const options = {
        foundryConfigPath,
        destRootDir
    }

    return options
}

/**
 * @param {string} sourceRootDir 
 * @param {string} destRootDir
 */
async function linkJsFiles(sourceRootDir, destRootDir) {
    for(const p of ["client", "common", "tsconfig.json"]) {
        const targetPath = path.join(sourceRootDir, p);
        const symlinkPath = path.join(destRootDir, p);

        const canCreate = await canCreateSymlink(targetPath, symlinkPath)
        if(canCreate) await createSymlink(targetPath, symlinkPath);
    }
}

async function linkLangFiles(sourceRootDir, destRootDir) {
    const targetPath = path.join(sourceRootDir, "public", "lang");
    const symlinkPath = path.join(destRootDir, "lang");

    const canCreate = await canCreateSymlink(targetPath, symlinkPath)
    if(canCreate) await createSymlink(targetPath, symlinkPath);
}

async function createSymlink(targetPath, symlinkPath) {
    await fs.promises.symlink(targetPath, symlinkPath);
    console.log(`Symlinked: ${symlinkPath} -> ${targetPath}`);
}


/**
 * @typedef {object} Config
 * @property {string} installPath
 */

/**
 * @param {string} configYamlPath 
 */
async function loadConfig(configYamlPath) {
    if(!fs.existsSync(configYamlPath)) {
        console.error(`Config yaml file '${configYamlPath}' not found.`);
        return;
    }

    try {
        const fc = await fs.promises.readFile(configYamlPath, "utf-8");

        /** @type {Config} */
        const foundryConfig = yaml.load(fc);
        return foundryConfig
    } catch (err) {
        console.error(`Error reading ${configYamlPath}: ${err}`);
    }
}

/**
 * @param {Config} config 
 */
function getSourceRootDir(config) {
    // As of 13.338, the Node install is not nested but electron installs are
    const isNested = fs.existsSync(path.join(config.installPath, "resources", "app"));

    const root = isNested 
        ? path.join(config.installPath, "resources", "app")
        : config.installPath;

    if(!fs.existsSync(root)) {
        console.error(`Foundry install path '${root}' does not exist.`);
        return;
    }

    return root;
}

/**
 * @param {string} dirName 
 */
async function createDestinationRootDir(dirName) {
    await fs.promises.mkdir(dirName, { recursive: true });
}

/**
 * @param {string} targetPath 
 * @param {string} symlinkPath 
 */
async function canCreateSymlink(targetPath, symlinkPath) {
    const stat = await fs.promises.lstat(symlinkPath, { throwIfNoEntry: false });

    // Is the path empty?
    if(!stat) return true;

    // Is it a non-symlink file/dir?
    if(!stat.isSymbolicLink()) {
        console.error(`Unable to create symlink because file/directory exists at: ${symlinkPath}`);
        console.error("Remove existing file/directory and run this script again.");
        return false;
    }

    // Is existing symlink correct?
    const currentTarget = await fs.promises.readlink(symlinkPath);
    const absoluteCurrent = path.resolve(path.dirname(symlinkPath), currentTarget); // Resolve paths to handle both absolute and relative targets accurately
    const absoluteTarget = path.resolve(targetPath);
    if(absoluteCurrent === absoluteTarget) return false;


    console.log(`Unlinking existing symlink: ${symlinkPath}`);
    await fs.promises.unlink(symlinkPath);

    return true;
}
