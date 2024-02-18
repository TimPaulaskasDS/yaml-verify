#!/usr/bin/env node

import chalk from 'chalk'
import { program } from 'commander'
import yaml from 'js-yaml'
import fs from 'fs'
import ora from 'ora'
import * as glob from 'glob' // Adjusted import statement for glob
import _ from 'lodash'
import packageJson from '../package.json' assert { type: 'json' };


const checkForDuplicates = (data) => {
	const errors = []

	Object.entries(data).forEach(([key, value]) => {
		if (Array.isArray(value)) {
			const seen = new Map()

			value.forEach((item, index) => {
				if (_.isPlainObject(item)) {
					const uniqueKey = Object.keys(item)[0]
					const uniqueValue = item[uniqueKey]

					if (seen.has(uniqueValue)) {
						const errorMessage = `Duplicate entry found in '${key}' at index ${index} for key '${uniqueKey}': ${uniqueValue}`
						errors.push(errorMessage)
					} else {
						seen.set(uniqueValue, index)
					}
				}
			})
		}
	})

	return errors
}

const findYamlFiles = (directory) => {
	const files = glob.sync(`${directory}/**/*.?(yaml|yml)`)
	return files
}

program
  .version(packageJson.version, '-v, --version', 'Output the current version')
  .description(packageJson.description)
	.arguments('<filePaths...>')
	.action(async (filePaths) => {
		let allFiles = []
		for (const filePath of filePaths) {
			const stat = fs.statSync(filePath)
			if (stat.isDirectory()) {
				const filesInDir = await findYamlFiles(filePath)
				allFiles = allFiles.concat(filesInDir)
			} else {
				allFiles.push(filePath)
			}
		}

		let hasErrors = false // Flag to track if any errors occurred
		for (const file of allFiles) {
			const spinner = ora().start()
			spinner.text = `Validating YAML file ${file}...`
			try {
				const fileContents = fs.readFileSync(file, 'utf8')
				const data = yaml.load(fileContents)
				const errors = checkForDuplicates(data)
				if (errors.length > 0) {
					spinner.fail(
						chalk.red(`Validation failed for file ${file}.`),
					)
					errors.forEach((error) => console.error(chalk.red(error)))
					hasErrors = true // Set flag to true if any errors occurred
				} else {
					spinner.succeed(
						chalk.green(`Validation passed for file ${file}.`),
					)
				}
			} catch (e) {
				hasErrors = true // Set flag to true if any errors occurred
				spinner.fail(
					chalk.red(`YAML file validation failed for file ${file}.`),
				)
				console.error(chalk.red(e.message))
			}

			console.log() // Add a line break after each output
		}

		// Exit with error code if any errors occurred
		if (hasErrors) {
			process.exit(1)
		}
	})

program.parse()
