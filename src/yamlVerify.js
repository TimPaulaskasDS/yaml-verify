#!/usr/bin/env node

import chalk from 'chalk'
import { program } from 'commander'
import yaml from 'js-yaml'
import fs from 'fs'
const fsPromises = fs.promises // Use fs.promises for async operations
import ora from 'ora'
import glob from 'fast-glob'

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
		const files = await glob(`${directory}/**/*.?(yaml|yml)`)
		return files // Returns a Promise that resolves to an array of matching files
	} catch (err) {
		throw err // Propagate error
	}
}

// Asynchronously process and validate YAML files with parallel processing
async function processFiles(filePaths) {
	let allFilesPromises = filePaths.map(async (filePath) => {
		const stat = await fsPromises.stat(filePath)
		if (stat.isDirectory()) {
			return findYamlFilesAsync(filePath) // Returns a promise
		}
		return [filePath] // Wrap in array to normalize structure
	})

	let allFilesArrays = await Promise.all(allFilesPromises) // Resolve all promises
	let allFiles = allFilesArrays.flat() // Flatten array of arrays into a single array

	// Process files in parallel
	const validationPromises = allFiles.map(async (file) => {
		const spinner = ora(`Validating YAML file ${file}...`).start()

		try {
			const fileContents = await fsPromises.readFile(file, 'utf8')
			const data = yaml.load(fileContents)
			const errors = checkForDuplicates(data)

			if (errors.length > 0) {
				spinner.fail(`Validation failed for file ${file}.`)
				errors.forEach((error) => console.error(error))
			} else {
				spinner.succeed(`Validation passed for file ${file}.`)
			}
		} catch (e) {
			spinner.fail(`YAML file validation failed for file ${file}.`)
			console.error(e.message)
		}
		console.log()
	})

	// Wait for all validations to complete
	await Promise.allSettled(validationPromises)
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
