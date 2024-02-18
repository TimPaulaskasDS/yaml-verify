#!/usr/bin/env node

import chalk from 'chalk'
import { program } from 'commander'
import yaml from 'js-yaml'
import fs from 'fs'
const fsPromises = fs.promises // Use fs.promises for async operations
import ora from 'ora'
import * as glob from 'glob' // Adjusted import statement for glob

// Asynchronous function to check for duplicates in YAML data
const checkForDuplicates = (data) => {
  const errors = [];

  // Handle layoutAssignments separately with custom logic
  if (data.layoutAssignments) {
      const layoutMap = new Map();

      data.layoutAssignments.forEach((item, index) => {
          const layout = item.layout;
          const recordType = item.recordType || 'noRecordType'; // Use a default value for items without recordType

          if (!layoutMap.has(layout)) {
              layoutMap.set(layout, new Set([recordType]));
          } else {
              const recordTypes = layoutMap.get(layout);
              if (recordTypes.has(recordType) && recordType !== 'noRecordType') {
                  const errorMessage = `Duplicate layout/recordType combination found in 'layoutAssignments' at index ${index}: layout='${layout}', recordType='${recordType}'`;
                  errors.push(errorMessage);
              } else {
                  recordTypes.add(recordType);
              }
          }
      });
  }

  // Standard duplicate check for other keys
  Object.entries(data).forEach(([key, value]) => {
      if (key !== 'layoutAssignments' && Array.isArray(value)) {
          const seen = new Set();

          value.forEach((item, index) => {
              const itemKey = JSON.stringify(item); // Convert item to string to use as a unique identifier

              if (seen.has(itemKey)) {
                  const errorMessage = `Duplicate entry found in '${key}' at index ${index}: ${itemKey}`;
                  errors.push(errorMessage);
              } else {
                  seen.add(itemKey);
              }
          });
      }
  });

  return errors;
};


// Synchronous function to find YAML files using glob.sync
const findYamlFiles = (directory) => {
	try {
		const files = glob.sync(`${directory}/**/*.?(yaml|yml)`)
		return files // Returns an array of matching files
	} catch (err) {
		throw err // Handle or throw the error as needed
	}
}

// Asynchronous function to process and validate YAML files
async function processFiles(filePaths) {
	let allFiles = []

	for (const filePath of filePaths) {
		const stat = await fsPromises.stat(filePath)
		if (stat.isDirectory()) {
			const filesInDir = await findYamlFiles(filePath)
			allFiles = allFiles.concat(filesInDir)
		} else {
			allFiles.push(filePath)
		}
	}

	for (const file of allFiles) {
		const spinner = ora(`Validating YAML file ${file}...`).start()

		try {
			const fileContents = await fsPromises.readFile(file, 'utf8')
			const data = yaml.load(fileContents)
			const errors = checkForDuplicates(data)

			if (errors.length > 0) {
				spinner.fail(chalk.red(`Validation failed for file ${file}.`))
				errors.forEach((error) => console.error(chalk.red(error)))
			} else {
				spinner.succeed(
					chalk.green(`Validation passed for file ${file}.`),
				)
			}
		} catch (e) {
			spinner.fail(
				chalk.red(`YAML file validation failed for file ${file}.`),
			)
			console.error(chalk.red(e.message))
		}
		console.log()
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
