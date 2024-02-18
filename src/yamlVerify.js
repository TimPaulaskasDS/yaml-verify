#!/usr/bin/env node

import chalk from 'chalk'
import { program } from 'commander'
import yaml from 'js-yaml'
import fs from 'fs'
const fsPromises = fs.promises // Use fs.promises for async operations
import glob from 'fast-glob'
import { Listr } from 'listr2'

// Asynchronous function to check for duplicates in YAML data
const checkForDuplicates = (data) => {
	const errors = []

	// Handle layoutAssignments separately with custom logic
	if (data.layoutAssignments) {
		const layoutMap = new Map()

		data.layoutAssignments.forEach((item, index) => {
			const layout = item.layout
			const recordType = item.recordType || 'noRecordType' // Use a default value for items without recordType

			if (!layoutMap.has(layout)) {
				layoutMap.set(layout, new Set([recordType]))
			} else {
				const recordTypes = layoutMap.get(layout)
				if (
					recordTypes.has(recordType) &&
					recordType !== 'noRecordType'
				) {
					const errorMessage = `Duplicate layout/recordType combination found in 'layoutAssignments' at index ${index}: layout='${layout}', recordType='${recordType}'`
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
				const itemKey = JSON.stringify(item) // Convert item to string to use as a unique identifier

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
		const files = await glob(`${directory}/**/*.?(yaml|yml)`, { onlyFiles: true, unique: true })
		return files // Returns a Promise that resolves to an array of matching files
	} catch (err) {
		throw err // Propagate error
	}
}

// Asynchronously process and validate YAML files with listr2
async function processFiles(filePaths) {
	let allFilesPromises = filePaths.map(async (filePath) => {
		const stat = await fsPromises.stat(filePath)
		if (stat.isDirectory()) {
			return findYamlFilesAsync(filePath)
		}
		return [filePath]
	})

	let allFilesArrays = await Promise.all(allFilesPromises)
	let allFiles = allFilesArrays.flat()

	// Create listr2 tasks for each file
	const tasks = new Listr(
		allFiles.map((file) => ({
			title: `Validating YAML file ${file}`,
			task: async (ctx, task) => {
				const fileContents = await fsPromises.readFile(file, 'utf8')
				let data = null
				try {
					data = yaml.load(fileContents)
				} catch (error) {
					throw new Error(
						`Validation ${chalk.bgRed.whiteBright('FAILED')} for file ${file}: ${chalk.red(error.message)}`,
					)
				}
				const errors = checkForDuplicates(data)
				if (errors.length > 0) {
					// Generate a detailed error message including the filename
					throw new Error(
						`Validation ${chalk.bgRed.whiteBright('FAILED')} for file ${file}; Errors: ${chalk.red(errors.join('\n'))}`,
					)
				}
				task.title = `Validation ${chalk.bgAnsi256(22).whiteBright('PASSED')} for file ${file}`
				task.output = file
			},
		})),
		{
			concurrent: 50, // Run tasks concurrently
			exitOnError: false, // Continue with other tasks even if some fail
		},
	)

	let validationPassed = true // Track overall validation success
	let totalFiles = 0
	let totalErrors = 0

	// Run tasks
	try {
		await tasks.run()
		totalFiles = tasks.tasks.length
		// Check the state of each task after running
		tasks.tasks.forEach((task) => {
			if (task.state === 'FAILED') {
				validationPassed = false
				if (totalErrors == 0) console.log()
				totalErrors += 1
				console.error(
					`Task '${task.title}' ${chalk.bgRed.whiteBright('FAILED')}`,
				)
			}
		})
	} catch (e) {
		validationPassed = false // Update flag if any task fails
		console.error(
			chalk.red('Validation errors found in one or more files.'),
		)
	}

	// Check the overall validation result before printing the final message
	console.log()
	if (validationPassed) {
		console.log(
			chalk.green(
				`All ${totalFiles} file(s) have been successfully validated.`,
			),
		)
	} else {
		console.error(
			chalk.red(
				`${totalErrors} out of ${totalFiles} file(s) failed validation.`,
			),
		)
		process.exit(1)
	}
}

// Setting up the CLI utility with commander
program
	.description('A CLI utility to ensure proper formatting of YAML files.')
	.arguments('<filePaths...>')
	.action((filePaths) => {
		processFiles(filePaths).catch((e) => {
			console.error(chalk.red('An error occurred:'), e)
			process.exit(1)
		})
	})

program.parse(process.argv)
