import fs from 'fs-extra';
import { resolve } from 'path';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

const {ensureDir, existsSync, readJSONSync, remove, symlink} = fs;

const argv = yargs(hideBin(process.argv))
    .options({
        'linkType': {
            alias: "lt",
            demandOption: true,
            requiresArg: true,
            describe: 'Type of link operation to perform',
            type: 'string',
            choices: ['module', 'systems', 'foundry', 'all']
        }, 
        'clean': {
            alias: 'c',
            type: 'boolean',
            description: 'Remove the symlinks instead of creating them'
        }
    })
    .help() // Add help generation (--help)
    .argv;

console.log('Parsed argv:', argv);

const linkType = argv.linkType;
const isClean = argv.clean;

console.log(`[== Action: ${linkType} ${isClean ? '(Clean)' : '(Create/Update)'} ==]`);


try {
    if (linkType === 'module' || linkType === 'all') {
        console.log(`[-- Executing Module Link Task --]`);
        await createModuleSymlink();    // Checks isClean internally
    }
    if (linkType === 'systems' || linkType === 'all') {
        console.log(`[-- Executing System Links Task --]`);
        await createSystemSymlinks();   // Checks isClean internally
    }

    if (linkType === 'foundry' || linkType === 'all') {
        console.log(`[-- Executing Foundry Links Task --]`);
        await createFoundrySymlinks();  // Checks isClean internally
    }

    console.log(`[== Action '${linkType}' completed successfully ==]`);

} catch (error) {
    console.error(`\n[== Action '${linkType}' failed ==]`);
    console.error(error);
    process.exit(1);
}


/**
 * Get one of the paths for the FoundryVTT installation or data based on what is configured in `./foundry-data-path-config.json`
 * @param {"dataPath"|"installPath"} type 
 * @returns {string}
 */
function getFoundryPath(type) {
    const foundryPathsConfigFilePath = './foundry-paths-config.json';
    if(!["dataPath", "installPath"].includes(type)) throw new Error(`Argument 'type' must be either 'dataPath' or 'installPath'.`);

    const config = readJSONSync(foundryPathsConfigFilePath);

    if(!config?.[type]) throw new Error(`No Foundry ${type} defined in ${foundryPathsConfigFilePath}`);
    if(!existsSync(resolve(config[type]))) throw new Error(`Supplied Foundry ${type} is invalid, directory not found. | ${type}: ${config[type]}`);

    return resolve(config[type]);
}

/**
 * Handles creating or cleaning symlinks.
 * @param {string} symlinkSourceDir 
 * @param {string} symlinkTargetDir 
 */
async function handleLink(symlinkSourceDir, symlinkTargetDir) {
    if (isClean) {
        console.log(`[== Removing link: ${symlinkTargetDir} ==]\n`);
        await remove(symlinkTargetDir);
    } else if (!existsSync(symlinkTargetDir)) {
        console.log(`[== Linking source directory (${symlinkSourceDir}) to ${symlinkTargetDir} ==]\n`);
        await ensureDir(resolve(symlinkTargetDir, '..'));
        await symlink(symlinkSourceDir, symlinkTargetDir, 'junction'); // Using 'junction' for better Windows compatibility
    } else {
        console.log(`[== Link already exists: ${symlinkTargetDir} ==]\n`);
    }
}


/**
 * Symlink project root folder within Foundry VTT data folder
 */
async function createModuleSymlink() {
    const resolvedProjectRoot = resolve('.');

    const moduleJsonPath = resolve(resolvedProjectRoot, 'module.json');
    if (!existsSync(moduleJsonPath)) throw new Error(`Could not find module.json in project root (${resolvedProjectRoot})`);
    const moduleId = readJSONSync(moduleJsonPath)?.id;
    if(!moduleId || typeof moduleId !== "string") throw new Error(`Could not find a valid module id in ${moduleJsonPath}`);

    const symlinkTargetDir = resolve(
        getFoundryPath("dataPath"),
        'Data',
        'modules',
        moduleId
    );

    await handleLink(resolvedProjectRoot, symlinkTargetDir);
}

/**
 * Symlink systems folder within project root folder
 */
async function createSystemSymlinks() {
    const resolvedProjectRoot = resolve('.');
    const symlinkTargetDir = resolve(
        resolvedProjectRoot,
        'systems'
    );

    const symlinkSourceDir = resolve(
        getFoundryPath("dataPath"),
        "Data",
        "systems"
    );
    if(!existsSync(symlinkSourceDir)) throw new Error(`Link source directory (${symlinkSourceDir}) does not exist.`);

    await handleLink(symlinkSourceDir, symlinkTargetDir);
}

/**
 * Symlink the following foundry folders within the 'foundry' folder in the project root folder:
 * - client
 * - common
 * - common-esm (if it exists)
 */
async function createFoundrySymlinks() {
    const resolvedProjectRoot = resolve('.');

    for(const sourceDirName of ["client", "common", "common-esm"]) {
        const symlinkTargetDir = resolve(
            resolvedProjectRoot,
            'foundry',
            sourceDirName
        );

        const symlinkSourceDir = resolve(
            getFoundryPath("installPath"),
            sourceDirName
        );

        if(!existsSync(symlinkSourceDir)) {
            if(sourceDirName === "common-esm") {
                console.warn(`Link source directory (${symlinkSourceDir}) does not exist.`);
                continue;
            } else throw new Error(`Link source directory (${symlinkSourceDir}) does not exist.`);
        }

        await handleLink(symlinkSourceDir, symlinkTargetDir);
    }

    if(isClean) {
        // Remove foundry directory if isClean and it's empty after the symlinks inside have been cleaned 
        const projFoundryDir = resolve(
            resolvedProjectRoot,
            'foundry'
        );

        try {
            const stats = await fs.stat(projFoundryDir);
            if(!stats.isDirectory()) return;
            const items = await fs.readdir(projFoundryDir);
            if(items.length > 0) return;

            // If checks passed, delete the empty directory.
            console.log(`Deleting empty directory: '${projFoundryDir}'...`);
            await fs.rmdir(projFoundryDir);
            console.log(`Successfully deleted '${projFoundryDir}'.`);
        } catch (err) {
            // Ignore ENOENT (Not Found) errors, log others
            if(err.code !== "ENOENT") console.error(`Error processing directory '${projFoundryDir}':`, err.message)
        }
    }
}
