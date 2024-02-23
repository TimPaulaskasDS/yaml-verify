#!/usr/bin/env node

import fs from 'fs'
import chalk from 'chalk'
import { program } from 'commander'
import yaml from 'js-yaml'
import glob from 'fast-glob'
import ora from 'ora'

const startTime = new Date() // Capture the start time

let validationFailed = false // Flag to track any validation failure
let totalErrors = 0
let totalFiles = 0
let showSuccess = false

// Asynchronous function to check for duplicates in YAML data
const checkForDuplicates = (data) => {
	const errors = []

	// Handle layoutAssignments separately with custom logic
	if (data.layoutAssignments) {
		const layoutMap = new Map()

		data.layoutAssignments.forEach((item, index) => {
			const layout = item.layout
			const recordType = item.recordType || 'noRecordType'

			if (!layoutMap.has(layout)) {
				layoutMap.set(layout, new Set([recordType]))
			} else {
				const recordTypes = layoutMap.get(layout)
				if (
					recordTypes.has(recordType) &&
					recordType !== 'noRecordType'
				) {
					const errorMessage = `Duplicate layout/recordType combination found in 'layoutAssignments': layout='${layout}', recordType='${recordType}'`
					errors.push(errorMessage)
				} else {
					recordTypes.add(recordType)
				}
			}
		})
	}

	// Standard duplicate check for other keys
	Object.entries(data).forEach(([key, value]) => {
		if (key !== 'layoutAssignments' && Array.isArray(value)) {
			const seen = new Set()

			value.forEach((item, index) => {
				const itemKey = JSON.stringify(item)

				if (seen.has(itemKey)) {
					const errorMessage = `Duplicate entry found in '${key}': ${itemKey}`
					errors.push(errorMessage)
				} else {
					seen.add(itemKey)
				}
			})
		}
	})

	return errors
}

// Asynchronously find YAML files using fast-glob
const findYamlFilesAsync = async (directory) => {
	try {
		const files = await glob(`${directory}/**/*.?(yaml|yml)`, {
			onlyFiles: true,
			unique: true,
		})
		return files
	} catch (err) {
		throw err
	}
}

async function validateFile(file) {
	try {
		const fileContents = await fs.promises.readFile(file, 'utf8')
		const data = yaml.load(fileContents)
		const errors = checkForDuplicates(data)
		if (errors.length > 0) {
			return { file, status: 'rejected', reason: errors.join('\n') }
		}
		return { file, status: 'fulfilled' }
	} catch (error) {
		return { file, status: 'rejected', reason: error.message }
	}
}

async function processFilesInBatches(files, batchSize = 50) {
	let index = 0
	const results = []
	const spinner = ora('Validating YAML files...').start() // Start the spinner

	while (index < files.length) {
		const batch = files.slice(index, index + batchSize)
		const promises = batch.map((file) => validateFile(file))
		results.push(...(await Promise.allSettled(promises)))

		// Update the spinner text to show progress
		spinner.text = `Validating YAML files... ${index + batch.length}/${files.length} files processed`;

		index += batchSize
	}

	spinner.stop()
	results.forEach((result) => {
		totalFiles += 1
		if (
			result.status === 'fulfilled' &&
			result.value.status === 'fulfilled'
		) {
			if (showSuccess) {
				// Only log success messages if showSuccess is true
				console.log(
					`${chalk.green('✓')} Validation ${chalk.bgAnsi256(22).whiteBright('PASSED')} for file ${chalk.underline(result.value.file)}`,
				)
			}
		} else if (result.value.status === 'rejected') {
			console.error(
				`${chalk.red('✗')} Validation ${chalk.bgRed.whiteBright('FAILED')} for file ${chalk.underline(result.value.file)}; Errors: ${chalk.redBright(result.value.reason)}\n`,
			)
			totalErrors += 1
			validationFailed = true // Set the flag to true if any validation fails
		}
	})

	spinner.stop()
}

// Setting up the CLI utility with commander
program
	.description('A CLI utility to ensure proper formatting of YAML files.')
	.option('-s, --show-success', 'Display messages for successful validations')
	.arguments('<filePaths...>')
	.action(async (filePaths) => {
		showSuccess = program.opts().showSuccess // Update the showSuccess flag based on the command line option
        let allFiles = [];

        for (const filePath of filePaths) {
            try {
                const stat = await fs.promises.stat(filePath);
                if (stat.isDirectory()) {
                    const files = await findYamlFilesAsync(filePath);
                    allFiles.push(...files);
                } else {
                    allFiles.push(filePath);
                }
            } catch (err) {
                if (err.code === 'ENOENT') {
                    console.error(chalk.red(`Error: The path '${filePath}' does not exist.`));
                    continue; // Skip this path and continue with the next one
                } else {
                    throw err; // Rethrow unexpected errors
                }
            }
        }

        if (allFiles.length === 0) {
            console.error(chalk.red('No valid file paths provided. Exiting...'));
            process.exit(1);
        }

        await processFilesInBatches(allFiles).catch((e) => {
            console.error(chalk.red('An error occurred:'), e);
            process.exit(1);
        });

		// Execution of some code...
		const endTime = new Date() // Capture the end time
		const elapsed = (endTime - startTime) / 1000 // Calculate the elapsed time in seconds
		console.log(`Total execution time: ${elapsed.toFixed(2)} seconds.`)

		// Check the flag and exit with status code 1 if any validation failed
		if (validationFailed) {
			console.error(
				`\nStatus: ${totalErrors} file(s) ${chalk.bgRed.whiteBright('FAILED')} validation; ${totalFiles - totalErrors} files(s) ${chalk.bgAnsi256(22).whiteBright('PASSED')} validation.`,
			)
			process.exit(1)
		} else {
			console.log(
				`\nStatus: ${totalFiles} file(s) ${chalk.bgAnsi256(22).whiteBright('PASSED')} validation.`,
			)
		}
	})

program.parse(process.argv)

process.on('SIGINT', () => {
	console.log(chalk.yellow('\nProcess interrupted by user. Exiting...'))
	// Perform any necessary cleanup here

	process.exit(1) // Exit with a non-zero status code to indicate interruption
})
