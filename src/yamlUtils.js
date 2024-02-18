import _ from 'lodash'

export const findDuplicates = (array, key) =>
	_(array)
		.groupBy(key)
		.pickBy((x) => x.length > 1)
		.value()

export const checkForDuplicates = (data) => {
	const errors = []
	Object.keys(data).forEach((key) => {
		if (Array.isArray(data[key])) {
			data[key].forEach((item, index) => {
				if (_.isPlainObject(item)) {
					const uniqueKey = Object.keys(item)[0]
					const duplicates = findDuplicates(data[key], uniqueKey)
					if (!_.isEmpty(duplicates)) {
						const duplicateKeys = Object.keys(duplicates)
						const errorMessage = `Duplicate entries found in '${key}' for key '${uniqueKey}': ${duplicateKeys.join(', ')}`
						if (!errors.includes(errorMessage)) {
							errors.push(errorMessage)
						}
					}
				}
			})
		}
	})
	return errors
}

