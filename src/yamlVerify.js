#!/usr/bin/env node

import chalk from 'chalk'
import { program } from 'commander'
import yaml from 'js-yaml'
import fs from 'fs'
import ora from 'ora'
import _ from 'lodash'

const findDuplicates = (array, key) => _(array).groupBy(key).pickBy(x => x.length > 1).value()

const checkForDuplicates = (data) => {
  Object.keys(data).forEach(key => {
    if (Array.isArray(data[key])) {
      data[key].forEach((item, index) => {
        if (_.isPlainObject(item)) {
          const uniqueKey = Object.keys(item)[0]
          const duplicates = findDuplicates(data[key], uniqueKey)
          if (!_.isEmpty(duplicates)) {
            console.error(chalk.red(`Duplicate entries found in '${key}' for key '${uniqueKey}':`), duplicates)
          }
        }
      })
    }
  })
}

program
  .version('1.0.0')
  .description('A CLI tool for validating YAML files.')
  .argument('<filePath>', 'The path to the YAML file to validate')
  .action((filePath) => {
    const spinner = ora('Validating YAML file...').start()
    try {
      const fileContents = fs.readFileSync(filePath, 'utf8')
      const data = yaml.load(fileContents)
      checkForDuplicates(data)
      spinner.succeed(chalk.green('YAML validation passed. No duplicate keys found.'))
    } catch (e) {
      spinner.fail(chalk.red('YAML file validation failed.'))
      console.error(chalk.red(e.message))
    }
  })

program.parse()
