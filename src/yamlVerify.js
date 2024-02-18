#!/usr/bin/env node

import chalk from 'chalk'
import { program } from 'commander'
import yaml from 'js-yaml'
import fs from 'fs'
const fsPromises = fs.promises
import glob from 'fast-glob'
import { promisify } from 'util'

const readFileAsync = promisify(fs.readFile)
let validationFailed = false // Flag to track any validation failure
let totalErrors = 0

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
		const fileContents = await readFileAsync(file, 'utf8')
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

	while (index < files.length) {
		const batch = files.slice(index, index + batchSize)
		const promises = batch.map((file) => validateFile(file))
		results.push(...(await Promise.allSettled(promises)))
		index += batchSize
	}

	results.forEach((result) => {
		if (
			result.status === 'fulfilled' &&
			result.value.status === 'fulfilled'
		) {
			console.log(
				`${chalk.green('✓')} Validation ${chalk.bgAnsi256(22).whiteBright('PASSED')} for file ${result.value.file}`,
			)
		} else if (result.value.status === 'rejected') {
			console.error(
				`${chalk.red('✗')} Validation ${chalk.bgRed.whiteBright('FAILED')} for file ${result.value.file}; Errors: ${chalk.redBright(result.value.reason)}\n`,
			)
			totalErrors += 1
			validationFailed = true // Set the flag to true if any validation fails
		}
	})
}

// Setting up the CLI utility with commander
program
	.description('A CLI utility to ensure proper formatting of YAML files.')
	.arguments('<filePaths...>')
	.action(async (filePaths) => {
		let allFilesPromises = filePaths.map(async (filePath) => {
			const stat = await fsPromises.stat(filePath)
			if (stat.isDirectory()) {
				return findYamlFilesAsync(filePath)
			}
			return [filePath]
		})

		let allFilesArrays = await Promise.all(allFilesPromises)
		let allFiles = allFilesArrays.flat()

		await processFilesInBatches(allFiles).catch((e) => {
			console.error(chalk.red('An error occurred:'), e)
			process.exit(1)
		})

		// Check the flag and exit with status code 1 if any validation failed
		if (validationFailed) {
			console.error(
				`\nStatus: ${totalErrors} file(s) ${chalk.bgRed.whiteBright('FAILED')} validation.`
			)
			process.exit(1)
		} else {
			console.log(
				`\nStatus: ${chalk.bgAnsi256(22).whiteBright('PASSED')} validation.`
			)

		}
	})

program.parse(process.argv)
