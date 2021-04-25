const exec = require('exec-sh');
const inquirer = require('inquirer');
const fs = require('fs');
const path = require('path');
const pkg = require('../package.json');
const childPkg = require('../package-child.json');

const packageFolder = "lib";

async function release() {
    const options = await inquirer.prompt([
        {
            type: 'input',
            name: 'version',
            message: 'Version:',
            default: pkg.version,
        },
        {
            type: 'list',
            name: 'alpha',
            message: 'Alpha?',
            when: (opts) => opts.version.indexOf('alpha') >= 0,
            choices: [
                {
                    name: 'YES',
                    value: true,
                },
                {
                    name: 'NO',
                    value: false,
                },
            ],
        },
        {
            type: 'list',
            name: 'beta',
            message: 'Beta?',
            when: (opts) => opts.version.indexOf('beta') >= 0,
            choices: [
                {
                    name: 'YES',
                    value: true,
                },
                {
                    name: 'NO',
                    value: false,
                },
            ],
        },
        {
            type: 'list',
            name: 'next',
            message: 'Next?',
            when: (opts) => opts.version.indexOf('next') >= 0,
            choices: [
                {
                    name: 'YES',
                    value: true,
                },
                {
                    name: 'NO',
                    value: false,
                },
            ],
        },
    ]);
    // Set version
    pkg.version = options.version;
    childPkg.version = options.version;

    // Copy dependencies
    childPkg.dependencies = pkg.dependencies;

    fs.writeFileSync(path.resolve(__dirname, '../package.json'), JSON.stringify(pkg, null, 2));
    fs.writeFileSync(path.resolve(__dirname, '../package-child.json'), JSON.stringify(childPkg, null, 2));

    fs.copyFileSync(path.resolve(__dirname, '../package-child.json'),  path.resolve(__dirname, `../${packageFolder}/package.json`))

    await exec.promise('git pull');
    await exec.promise('npm i');
    await exec.promise(`npm run build`);
    await exec.promise('git add .');
    await exec.promise(`git commit -m \"${pkg.version} release\"`);
    await exec.promise('git push');
    await exec.promise(`git tag v${pkg.version}`);
    await exec.promise('git push origin --tags');
    //
    // if (options.beta) {
    //     await exec.promise(`cd ./${packageFolder} && npm publish --tag beta`);
    // } else if (options.alpha || options.next) {
    //     await exec.promise(`cd ./${packageFolder} && npm publish --tag next`);
    // } else {
    //     await exec.promise(`cd ./${packageFolder} && npm publish`);
    // }
    //
    // await exec.promise("cd ..");
}

release().then();
