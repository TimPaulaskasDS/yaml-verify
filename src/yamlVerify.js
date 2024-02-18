#!/usr/bin/env node

import chalk from 'chalk'
import { program } from 'commander'
import yaml from 'js-yaml'
import fs from 'fs'
const fsPromises = fs.promises // Use fs.promises for async operations
import ora from 'ora'
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
		const files = await glob(`${directory}/**/*.?(yaml|yml)`)
		return files // Returns a Promise that resolves to an array of matching files
	} catch (err) {
		throw err // Propagate error
	}
}

// Function to create a task for validating a single YAML file
const validateYamlFileTask = (file) => ({
  title: `Validating YAML file ${file}`,
  task: async (ctx, task) => {
      try {
          const fileContents = await fsPromises.readFile(file, 'utf8');
          const data = yaml.load(fileContents);
          const errors = checkForDuplicates(data);

          if (errors.length > 0) {
              // Concatenate all errors into a single message, including the filename
              const errorMessage = `File: ${file}\nErrors:\n${errors.join('\n')}`;
              throw new Error(errorMessage);
          }
          task.title = `Validation passed for file ${file}`;
      } catch (error) {
          // Catch any error, add the filename to the message, and rethrow
          error.message = `Error in file ${file}: ${error.message}`;
          throw error;
      }
  }
});

// Asynchronously process and validate YAML files with listr2
async function processFiles(filePaths) {
  let allFilesPromises = filePaths.map(async (filePath) => {
      const stat = await fsPromises.stat(filePath);
      if (stat.isDirectory()) {
          return findYamlFilesAsync(filePath);
      }
      return [filePath];
  });

  let allFilesArrays = await Promise.all(allFilesPromises);
  let allFiles = allFilesArrays.flat();

  // Create listr2 tasks for each file
  const tasks = new Listr(
      allFiles.map(file => ({
          title: `Validating YAML file ${file}`,
          task: async (ctx, task) => {
              const fileContents = await fsPromises.readFile(file, 'utf8');
              const data = yaml.load(fileContents);
              const errors = checkForDuplicates(data);
              if (errors.length > 0) {
                  // Generate a detailed error message including the filename
                  throw new Error(`File: ${file}\nErrors:\n${errors.join('\n')}`);
              }
              task.title = `Validation passed for file ${file}`;
          }
      })),
      {
          concurrent: true, // Run tasks concurrently
          exitOnError: false, // Continue with other tasks even if some fail
      }
  );

  let validationPassed = true; // Track overall validation success

  // Run tasks
  try {
      await tasks.run();
  } catch (e) {
      validationPassed = false; // Update flag if any task fails
      console.error(chalk.red('Validation errors found in one or more files.'));
      if (Array.isArray(e.errors)) {
          e.errors.forEach((taskError) => {
              console.error(chalk.red(taskError.error.message));
          });
      } else {
          console.error(chalk.red(e.message));
      }
  }

  // Check the overall validation result before printing the final message
  if (validationPassed) {
      console.log(chalk.green('All files have been successfully validated.'));
  } else {
      console.error(chalk.red('One or more files failed validation.'));
      process.exit(1);
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
