const exec = require("exec-sh");
const inquirer = require("inquirer");
const fs = require("fs");
const path = require("path");
const pkg = require("../package.json");
const childPkg = require("../package-child.json");
const simpleGit = require("simple-git");

const packageFolder = "lib";

async function release() {
	const options = await inquirer.prompt([
		{
			type: "input",
			name: "version",
			message: "Version:",
			default: pkg.version,
		},
		{
			type: "list",
			name: "alpha",
			message: "Alpha?",
			when: (opts) => opts.version.indexOf("alpha") >= 0,
			choices: [
				{
					name: "YES",
					value: true,
				},
				{
					name: "NO",
					value: false,
				},
			],
		},
		{
			type: "list",
			name: "beta",
			message: "Beta?",
			when: (opts) => opts.version.indexOf("beta") >= 0,
			choices: [
				{
					name: "YES",
					value: true,
				},
				{
					name: "NO",
					value: false,
				},
			],
		},
		{
			type: "list",
			name: "next",
			message: "Next?",
			when: (opts) => opts.version.indexOf("next") >= 0,
			choices: [
				{
					name: "YES",
					value: true,
				},
				{
					name: "NO",
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

	const gitClient = simpleGit();

	await gitClient.pull();
	await exec.promise("npm i");

	fs.writeFileSync(path.resolve(__dirname, "../package.json"), JSON.stringify(pkg, null, 2));
	fs.writeFileSync(path.resolve(__dirname, "../package-child.json"), JSON.stringify(childPkg, null, 2));

	await exec.promise(`npm run build-lib`);

	fs.copyFileSync(path.resolve(__dirname, "../package-child.json"), path.resolve(__dirname, `../${packageFolder}/package.json`));
	fs.copyFileSync(path.resolve(__dirname, "../README.md"), path.resolve(__dirname, `../${packageFolder}/README.md`));
	fs.copyFileSync(path.resolve(__dirname, "../CHANGELOG.md"), path.resolve(__dirname, `../${packageFolder}/CHANGELOG.md`));

	await gitClient.add(".");
	await gitClient.commit(`Release ${pkg.version}`, ".", { "--author": "KoRnFactory" });
	await gitClient.addTag(`v${pkg.version}`);
	await gitClient.push();
	await gitClient.pushTags();

	let versionParameter = "";

	if (options.beta) {
		versionParameter = " --tag beta";
	} else if (options.alpha || options.next) {
		versionParameter = " --tag next";
	}

	await exec.promise(`npm publish ${packageFolder}${versionParameter}`);
}

release().then();
